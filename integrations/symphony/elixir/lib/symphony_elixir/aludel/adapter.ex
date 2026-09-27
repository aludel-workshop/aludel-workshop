defmodule SymphonyElixir.Aludel.Adapter do
  @moduledoc """
  Aludel's Go-authorized Work queue as a Symphony tracker. This module is an overlay
  for pinned OpenAI Symphony revision be10a1b79df723d6d7612b5651c8522704dafb2e.
  """
  @behaviour SymphonyElixir.Tracker

  alias SymphonyElixir.Config
  alias SymphonyElixir.Tracker.Issue

  @page_size 100
  @context_tool "aludel_task_context"
  @open_tool "aludel_task_open"
  @map_tool "aludel_knowledge_map"
  @search_tool "aludel_knowledge_search"
  @read_tool "aludel_knowledge_read"
  @audit_tool "aludel_submit_audit"
  @proposal_tool "aludel_submit_proposal"
  @ask_tool "aludel_task_ask"
  @plan_tool "aludel_task_plan"
  @progress_tool "aludel_task_progress"
  @submit_tool "aludel_submit_candidate"
  @commit_tool "aludel_commit_candidate"
  @check_schema %{
    "type" => "object",
    "additionalProperties" => false,
    "required" => ["name", "status"],
    "properties" => %{
      "name" => %{"type" => "string", "minLength" => 1, "maxLength" => 120},
      "status" => %{"type" => "string", "enum" => ["passed", "failed", "skipped"]},
      "detail" => %{"type" => "string", "maxLength" => 500}
    }
  }

  @impl true
  def validate_config(settings) do
    endpoint = settings.endpoint
    uri = if is_binary(endpoint), do: URI.parse(endpoint), else: nil

    cond do
      is_nil(uri) or is_nil(uri.host) or
          not (uri.scheme == "https" or
                   (uri.scheme == "http" and uri.host in ["localhost", "aludel.localhost", "127.0.0.1", "::1"])) ->
        {:error, :invalid_aludel_endpoint}

      not is_list(settings.active_states) or "Ready" not in settings.active_states ->
        {:error, :missing_aludel_ready_state}

      not is_list(settings.terminal_states) or settings.terminal_states == [] ->
        {:error, :missing_aludel_terminal_states}

      not present?(worker_token()) ->
        {:error, :missing_aludel_worker_token}

      true ->
        :ok
    end
  end

  @impl true
  def secret_environment_names(_settings), do: ["ALUDEL_WORKER_TOKEN", "ALUDEL_WORKER_TOKEN_FILE"]

  @impl true
  def report_blocked(%Issue{native_ref: %{"attempt_id" => attempt_id}}, error) when is_binary(attempt_id) do
    event_id = "symphony-blocked-" <> Integer.to_string(System.unique_integer([:positive]))
    message = error |> inspect(limit: 20, printable_limit: 500) |> String.slice(0, 500)

    case post_request("attempts/" <> attempt_id <> "/events", %{"eventId" => event_id, "kind" => "error", "message" => message}, Config.settings!().tracker) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  def report_blocked(_issue, _error), do: :ok

  @impl true
  def fetch_issues_by_states(states) when is_list(states) do
    with :ok <- require_single_turn_runs() do
      if states == [], do: {:ok, []}, else: fetch_pages(%{"states" => Enum.join(states, ","), "capacity" => host_capacity(), "profile_overrides" => profile_overrides()}, "", [])
    end
  end

  @impl true
  def fetch_issues_by_ids(ids) when is_list(ids) do
    with :ok <- require_single_turn_runs() do
      ids
      |> Enum.uniq()
      |> Enum.chunk_every(@page_size)
      |> Enum.reduce_while({:ok, []}, fn chunk, {:ok, all} ->
        case request("issues", %{"ids" => Enum.join(chunk, ","), "limit" => @page_size, "capacity" => host_capacity(), "profile_overrides" => profile_overrides()}) do
          {:ok, %{"issues" => issues}} when is_list(issues) ->
            case normalize_issues(issues) do
              {:ok, normalized} -> {:cont, {:ok, all ++ normalized}}
              error -> {:halt, error}
            end

          {:ok, _} ->
            {:halt, {:error, :invalid_aludel_issue_page}}

          error ->
            {:halt, error}
        end
      end)
    end
  end

  # WORK-ITEM-UX-01 WI-6: what the reviewer should check for each criterion, pointing only at what this submission contains.
  @evidence_schema %{
    "type" => "array",
    "maxItems" => 40,
    "items" => %{
      "type" => "object",
      "additionalProperties" => false,
      "required" => ["criterion", "type", "ref"],
      "properties" => %{
        "criterion" => %{"type" => "integer", "minimum" => 0, "maximum" => 11},
        "type" => %{"type" => "string", "enum" => ["change", "test", "try"]},
        "ref" => %{"type" => "string", "minLength" => 1, "maxLength" => 300},
        "note" => %{"type" => "string", "maxLength" => 300}
      }
    }
  }

  @impl true
  def agent_tool_specs do
    [
      %{
        "name" => @open_tool,
        "description" => "Open the compact pinned Aludel task card for this authorized attempt.",
        "inputSchema" => %{"type" => "object", "additionalProperties" => false, "required" => ["digest"], "properties" => %{"digest" => %{"type" => "string", "pattern" => "^[a-f0-9]{64}$"}}}
      },
      %{
        "name" => @map_tool,
        "description" => "List the permitted project knowledge kinds and counts for a pinned task.",
        "inputSchema" => digest_schema()
      },
      %{
        "name" => @search_tool,
        "description" => "Search permitted project knowledge; returns brief records in bounded pages.",
        "inputSchema" => %{
          "type" => "object",
          "additionalProperties" => false,
          "required" => ["digest", "query"],
          "properties" => %{
            "digest" => %{"type" => "string", "pattern" => "^[a-f0-9]{64}$"},
            "query" => %{"type" => "string", "minLength" => 2, "maxLength" => 100},
            "kind" => %{"type" => "string"},
            "cursor" => %{"type" => "integer", "minimum" => 0}
          }
        }
      },
      %{
        "name" => @read_tool,
        "description" => "Read one permitted project record at its exact revision or current revision.",
        "inputSchema" => %{
          "type" => "object",
          "additionalProperties" => false,
          "required" => ["digest", "id"],
          "properties" => %{"digest" => %{"type" => "string", "pattern" => "^[a-f0-9]{64}$"}, "id" => %{"type" => "string"}, "revision" => %{"type" => "integer", "minimum" => 1}}
        }
      },
      %{
        "name" => @ask_tool,
        "description" => "Pause the authorized task on one concrete question for the owner. Stop work after calling this.",
        "inputSchema" => %{
          "type" => "object",
          "additionalProperties" => false,
          "required" => ["attemptId", "question", "reason"],
          "properties" => %{
            "attemptId" => %{"type" => "string", "pattern" => "^att-[0-9a-f-]{36}$"},
            "question" => %{"type" => "string", "minLength" => 10, "maxLength" => 400},
            "reason" => %{"type" => "string", "minLength" => 5, "maxLength" => 1000},
            "options" => %{"type" => "array", "maxItems" => 4, "items" => %{"type" => "string", "maxLength" => 200}}
          }
        }
      },
      %{
        "name" => @plan_tool,
        "description" => "Report a short ordered plan anchored in this task's request and criteria, not generic action phases. The reviewer sees it as the run's progress. Report again if the plan changes.",
        "inputSchema" => %{
          "type" => "object",
          "additionalProperties" => false,
          "required" => ["attemptId", "objectives"],
          "properties" => %{
            "attemptId" => %{"type" => "string", "pattern" => "^att-[0-9a-f-]{36}$"},
            "objectives" => %{"type" => "array", "minItems" => 1, "maxItems" => 12, "items" => %{"type" => "string", "minLength" => 3, "maxLength" => 160}}
          }
        }
      },
      %{
        "name" => @progress_tool,
        "description" => "Mark one planned objective active, done or stuck. Stuck means the objective blocks the run: it immediately ends the run as failed, and you must stop. Keep recoverable obstacles active and explain them in the note.",
        "inputSchema" => %{
          "type" => "object",
          "additionalProperties" => false,
          "required" => ["attemptId", "index", "status"],
          "properties" => %{
            "attemptId" => %{"type" => "string", "pattern" => "^att-[0-9a-f-]{36}$"},
            "index" => %{"type" => "integer", "minimum" => 0, "maximum" => 11},
            "status" => %{"type" => "string", "enum" => ["active", "done", "stuck"]},
            "note" => %{"type" => "string", "maxLength" => 300}
          }
        }
      },
      %{
        "name" => @audit_tool,
        "description" => "Submit a read-only security findings report to Aludel Work review.",
        "inputSchema" => %{
          "type" => "object",
          "additionalProperties" => false,
          "required" => ["attemptId", "report"],
          "properties" => %{
            "attemptId" => %{"type" => "string", "pattern" => "^att-[0-9a-f-]{36}$"},
            "evidence" => @evidence_schema,
            "report" => %{
              "type" => "object",
              "additionalProperties" => false,
              "required" => ["summary", "findings", "checks"],
              "properties" => %{
                "summary" => %{"type" => "string", "minLength" => 15, "maxLength" => 2000},
                "findings" => %{
                  "type" => "array",
                  "maxItems" => 30,
                  "items" => %{
                    "type" => "object",
                    "additionalProperties" => false,
                    "required" => ["severity", "title", "affected", "evidence", "recommendation"],
                    "properties" => %{
                      "severity" => %{"type" => "string", "enum" => ["critical", "high", "medium", "low", "informational"]},
                      "title" => %{"type" => "string", "maxLength" => 160},
                      "affected" => %{"type" => "string", "maxLength" => 250},
                      "evidence" => %{"type" => "string", "maxLength" => 3000},
                      "recommendation" => %{"type" => "string", "maxLength" => 1000}
                    }
                  }
                },
                "checks" => %{"type" => "array", "maxItems" => 30, "items" => @check_schema},
                "usedInputs" => %{
                  "type" => "array",
                  "maxItems" => 40,
                  "items" => %{
                    "type" => "object",
                    "additionalProperties" => false,
                    "required" => ["id", "revision"],
                    "properties" => %{"id" => %{"type" => "string"}, "revision" => %{"type" => "integer", "minimum" => 1}}
                  }
                }
              }
            }
          }
        }
      },
      %{
        "name" => @proposal_tool,
        "description" =>
          "Submit a bounded read-only action proposal to Aludel Work review. Product.brief content needs section, text, note, basis. Other supported actions use their task card output fields.",
        "inputSchema" => %{
          "type" => "object",
          "additionalProperties" => false,
          "required" => ["attemptId", "proposal"],
          "properties" => %{
            "attemptId" => %{"type" => "string", "pattern" => "^att-[0-9a-f-]{36}$"},
            "evidence" => @evidence_schema,
            "proposal" => %{
              "type" => "object",
              "required" => ["summary", "content"],
              "properties" => %{
                "summary" => %{"type" => "string", "minLength" => 10, "maxLength" => 1000},
                "content" => %{"type" => "object"},
                "usedInputs" => %{
                  "type" => "array",
                  "maxItems" => 40,
                  "items" => %{"type" => "object", "required" => ["id", "revision"], "properties" => %{"id" => %{"type" => "string"}, "revision" => %{"type" => "integer", "minimum" => 1}}}
                }
              }
            }
          }
        }
      },
      %{
        "name" => @context_tool,
        "description" => "Read the pinned Aludel context for this authorized Work item by its digest.",
        "inputSchema" => %{
          "type" => "object",
          "additionalProperties" => false,
          "required" => ["digest"],
          "properties" => %{"digest" => %{"type" => "string", "pattern" => "^[a-f0-9]{64}$"}}
        }
      },
      %{
        "name" => @commit_tool,
        "description" => "Have the trusted Aludel host commit allowed changes in the registered workspace and submit the candidate for review. Use this when .git is read only in the coding sandbox.",
        "inputSchema" => %{
          "type" => "object",
          "additionalProperties" => false,
          "required" => ["attemptId"],
          "properties" => %{
            "attemptId" => %{"type" => "string", "pattern" => "^att-[0-9a-f-]{36}$"},
            "message" => %{"type" => "string", "maxLength" => 160},
            "checks" => %{"type" => "array", "maxItems" => 30, "items" => @check_schema},
            "evidence" => @evidence_schema
          }
        }
      },
      %{
        "name" => @submit_tool,
        "description" => "Submit an existing commit in the registered workspace for Aludel validation and owner review.",
        "inputSchema" => %{
          "type" => "object",
          "additionalProperties" => false,
          "required" => ["attemptId", "commit"],
          "properties" => %{
            "attemptId" => %{"type" => "string", "pattern" => "^att-[0-9a-f-]{36}$"},
            "commit" => %{"type" => "string", "pattern" => "^[a-f0-9]{40}$"},
            "checks" => %{"type" => "array", "maxItems" => 30, "items" => @check_schema},
            "evidence" => @evidence_schema
          }
        }
      }
    ]
  end

  defp digest_schema do
    %{"type" => "object", "additionalProperties" => false, "required" => ["digest"], "properties" => %{"digest" => %{"type" => "string", "pattern" => "^[a-f0-9]{64}$"}}}
  end

  @impl true
  def execute_agent_tool(@open_tool, %{"digest" => digest}, opts) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)

    case request("tasks/" <> digest, %{}, settings) do
      {:ok, result} -> tool_result(true, result)
      {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
    end
  end

  def execute_agent_tool(@map_tool, %{"digest" => digest}, opts) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)

    case request("knowledge/map", %{"digest" => digest}, settings) do
      {:ok, result} -> tool_result(true, result)
      {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
    end
  end

  def execute_agent_tool(@search_tool, %{"digest" => digest, "query" => query} = args, opts) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)
    params = %{"digest" => digest, "q" => query}
    params = if Map.has_key?(args, "kind"), do: Map.put(params, "kind", args["kind"]), else: params
    params = if Map.has_key?(args, "cursor"), do: Map.put(params, "cursor", args["cursor"]), else: params

    case request("knowledge/search", params, settings) do
      {:ok, result} -> tool_result(true, result)
      {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
    end
  end

  def execute_agent_tool(@read_tool, %{"digest" => digest, "id" => id} = args, opts) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)
    params = %{"digest" => digest}
    params = if Map.has_key?(args, "revision"), do: Map.put(params, "revision", args["revision"]), else: params

    case request("knowledge/records/" <> URI.encode(id), params, settings) do
      {:ok, result} -> tool_result(true, result)
      {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
    end
  end

  def execute_agent_tool(@ask_tool, %{"attemptId" => attempt_id, "question" => question, "reason" => reason} = args, opts) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)
    body = %{"question" => question, "reason" => reason, "options" => Map.get(args, "options", [])}

    case post_request("attempts/" <> attempt_id <> "/question", body, settings) do
      {:ok, result} -> tool_result(true, result)
      {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
    end
  end

  def execute_agent_tool(@plan_tool, %{"attemptId" => attempt_id, "objectives" => objectives}, opts) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)

    case post_request("attempts/" <> attempt_id <> "/plan", %{"objectives" => objectives}, settings) do
      {:ok, result} -> tool_result(true, result)
      {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
    end
  end

  def execute_agent_tool(@progress_tool, %{"attemptId" => attempt_id, "index" => index, "status" => status} = args, opts) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)
    body = %{"index" => index, "status" => status, "note" => Map.get(args, "note", "")}

    case post_request("attempts/" <> attempt_id <> "/progress", body, settings) do
      {:ok, result} -> tool_result(true, result)
      {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
    end
  end

  def execute_agent_tool(@audit_tool, %{"attemptId" => attempt_id, "report" => report} = args, opts) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)

    case post_request("attempts/" <> attempt_id <> "/audit", %{"report" => report, "evidence" => Map.get(args, "evidence", [])}, settings) do
      {:ok, result} -> tool_result(true, result)
      {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
    end
  end

  def execute_agent_tool(@proposal_tool, %{"attemptId" => attempt_id, "proposal" => proposal} = args, opts) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)

    case post_request("attempts/" <> attempt_id <> "/proposal", %{"proposal" => proposal, "evidence" => Map.get(args, "evidence", [])}, settings) do
      {:ok, result} -> tool_result(true, result)
      {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
    end
  end

  @impl true
  def execute_agent_tool(@context_tool, %{"digest" => digest}, opts)
      when is_binary(digest) and byte_size(digest) == 64 do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)

    case request("bundles/" <> digest, %{}, settings) do
      {:ok, bundle} -> tool_result(true, bundle)
      {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
    end
  end

  def execute_agent_tool(@commit_tool, %{"attemptId" => attempt_id} = arguments, opts)
      when is_binary(attempt_id) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)
    checks = Map.get(arguments, "checks", [])
    message = Map.get(arguments, "message", "Implement authorized Work item")

    if not String.match?(attempt_id, ~r/^att-[0-9a-f-]{36}$/) or not is_binary(message) do
      tool_result(false, %{"error" => "Invalid attempt or message"})
    else
      case post_request("attempts/" <> attempt_id <> "/commit", %{"message" => message, "checks" => checks, "evidence" => Map.get(arguments, "evidence", [])}, settings) do
        {:ok, result} -> tool_result(true, result)
        {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
      end
    end
  end

  def execute_agent_tool(@submit_tool, %{"attemptId" => attempt_id, "commit" => commit} = arguments, opts)
      when is_binary(attempt_id) and is_binary(commit) do
    settings = Keyword.get_lazy(opts, :tracker_settings, fn -> Config.settings!().tracker end)
    checks = Map.get(arguments, "checks", [])

    if not (String.match?(attempt_id, ~r/^att-[0-9a-f-]{36}$/) and
              String.match?(commit, ~r/^[a-f0-9]{40}$/)) do
      tool_result(false, %{"error" => "Invalid attempt or commit"})
    else
      case post_request("attempts/" <> attempt_id <> "/candidate", %{"commit" => commit, "checks" => checks, "evidence" => Map.get(arguments, "evidence", [])}, settings) do
        {:ok, result} -> tool_result(true, result)
        {:error, reason} -> tool_result(false, %{"error" => inspect(reason)})
      end
    end
  end

  def execute_agent_tool(_tool, _arguments, _opts),
    do: tool_result(false, %{"error" => "Invalid Aludel tool request"})

  defp worker_token do
    case System.get_env("ALUDEL_WORKER_TOKEN_FILE") do
      path when is_binary(path) and byte_size(path) > 0 ->
        case File.read(path) do
          {:ok, value} -> String.trim(value)
          _ -> nil
        end

      _ ->
        System.get_env("ALUDEL_WORKER_TOKEN")
    end
  end

  defp profile_overrides do
    if Code.ensure_loaded?(SymphonyElixir.Codex.AppServer) and
         function_exported?(SymphonyElixir.Codex.AppServer, :profile_turn_overrides?, 0),
       do: "1",
       else: "0"
  end

  defp host_capacity do
    case Config.settings() do
      {:ok, %{agent: %{max_concurrent_agents: count}}} when is_integer(count) and count > 0 -> count
      _ -> 1
    end
  end

  defp require_single_turn_runs do
    case Config.settings() do
      {:ok, %{agent: %{max_turns: 1}}} -> :ok
      _ -> {:error, :aludel_requires_one_turn_per_run}
    end
  end

  defp fetch_pages(params, cursor, acc) do
    case request("issues", Map.merge(params, %{"cursor" => cursor, "limit" => @page_size})) do
      {:ok, %{"issues" => issues, "nextCursor" => next_cursor}} when is_list(issues) ->
        with {:ok, normalized} <- normalize_issues(issues) do
          all = acc ++ normalized

          if is_binary(next_cursor) and next_cursor > cursor,
            do: fetch_pages(params, next_cursor, all),
            else: {:ok, all}
        end

      {:ok, _} ->
        {:error, :invalid_aludel_issue_page}

      error ->
        error
    end
  end

  defp request(path, params, settings \\ nil) do
    tracker = settings || Config.settings!().tracker
    token = worker_token()

    if not present?(token) do
      {:error, :missing_aludel_worker_token}
    else
      url = String.trim_trailing(tracker.endpoint, "/") <> "/" <> path

      case Req.get(url, headers: [{"authorization", "Bearer " <> token}], params: params, receive_timeout: 10_000, retry: false) do
        {:ok, %{status: 200, body: body}} when is_map(body) -> {:ok, body}
        {:ok, %{status: status}} -> {:error, {:aludel_http_status, status}}
        {:error, reason} -> {:error, {:aludel_request, reason}}
      end
    end
  end

  defp post_request(path, body, settings) do
    token = worker_token()

    if not present?(token) do
      {:error, :missing_aludel_worker_token}
    else
      url = String.trim_trailing(settings.endpoint, "/") <> "/" <> path

      case Req.post(url, headers: [{"authorization", "Bearer " <> token}], json: body, receive_timeout: 10_000, retry: false) do
        {:ok, %{status: status, body: result}} when status in [200, 201] and is_map(result) ->
          {:ok, result}

        {:ok, %{status: status, body: %{"error" => reason}}} when is_binary(reason) ->
          {:error, {:aludel_http_status, status, String.slice(reason, 0, 200)}}

        {:ok, %{status: status}} ->
          {:error, {:aludel_http_status, status}}

        {:error, reason} ->
          {:error, {:aludel_request, reason}}
      end
    end
  end

  defp normalize_issues(issues) do
    result =
      Enum.reduce_while(issues, {:ok, []}, fn issue, {:ok, acc} ->
        case normalize_issue(issue) do
          {:ok, normalized} -> {:cont, {:ok, [normalized | acc]}}
          error -> {:halt, error}
        end
      end)

    case result do
      {:ok, reversed} -> {:ok, Enum.reverse(reversed)}
      error -> error
    end
  end

  defp normalize_issue(%{"id" => id, "identifier" => identifier, "title" => title, "state" => state, "dispatchable" => dispatchable} = issue)
       when is_binary(id) and is_binary(identifier) and is_binary(title) and
              is_binary(state) and is_boolean(dispatchable) do
    {:ok,
     %Issue{
       id: id,
       identifier: identifier,
       title: title,
       state: state,
       description: issue["description"],
       priority: issue["priority"],
       dispatchable: dispatchable,
       native_ref: issue["native_ref"],
       branch_name: issue["branch_name"],
       url: issue["url"],
       labels: issue["labels"] || [],
       blocked_by: issue["blocked_by"] || [],
       created_at: datetime(issue["created_at"]),
       updated_at: datetime(issue["updated_at"])
     }}
  end

  defp normalize_issue(_), do: {:error, :invalid_aludel_issue}

  defp datetime(value) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, parsed, _offset} -> parsed
      _ -> nil
    end
  end

  defp datetime(_), do: nil
  defp present?(value), do: is_binary(value) and String.trim(value) != ""

  defp tool_result(success, body) do
    output = Jason.encode!(body)
    %{"success" => success, "output" => output, "contentItems" => [%{"type" => "inputText", "text" => output}]}
  end
end

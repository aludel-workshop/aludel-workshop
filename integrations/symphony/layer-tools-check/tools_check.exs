# LAYER-TOOLS-01 stage 2: the compiled adapter's layer tools against a real portal, no model turn.
alias SymphonyElixir.Aludel.Adapter
{:ok, _} = Application.ensure_all_started(:req)
settings = %{endpoint: System.fetch_env!("ALUDEL_WORKER_URL")}
attempt = System.fetch_env!("ATTEMPT")
[browse, detail] = String.split(System.fetch_env!("PAGES"), ",")

call = fn name, args ->
  result = Adapter.execute_agent_tool(name, Map.put(args, "attemptId", attempt), tracker_settings: settings)
  body = Jason.decode!(result["output"])
  IO.puts("#{name} #{inspect(Map.take(args, ["operation", "id"]))} -> success=#{result["success"]} #{String.slice(result["output"], 0, 260)}")
  {result["success"], body}
end

specs = Adapter.agent_tool_specs() |> Enum.map(& &1["name"])
true = "aludel_layer_call" in specs and "aludel_layer_commit" in specs
IO.puts("advertised: #{Enum.filter(specs, &String.starts_with?(&1, "aludel_layer"))|> inspect}")

{true, listed} = call.("aludel_layer_call", %{"operation" => "listPages"})
3 = length(listed["result"])
plan_schema = Adapter.agent_tool_specs() |> Enum.find(&(&1["name"] == "aludel_task_plan"))
true = Map.has_key?(plan_schema["inputSchema"]["properties"], "journeyAssessment")
{false, rejected} = call.("aludel_task_plan", %{"objectives" => ["Assess affected journeys"], "journeyAssessment" => %{"reason" => "Pages work", "journeys" => []}})
true = String.contains?(rejected["error"], "Code layer run")
{true, _} = call.("aludel_task_plan", %{"objectives" => ["Create flow and revise description", "Check layer methods", "Submit changes"]})
{true, _} = call.("aludel_layer_call", %{"operation" => "createFlow", "body" => %{"flow" => %{"title" => "Find a tool", "steps" => [%{"page" => browse, "name" => "Browse tools", "trigger" => "Open Tools"}, %{"page" => detail, "name" => "Read the detail"}]}}})
{true, _} = call.("aludel_layer_call", %{"operation" => "updatePage", "id" => detail, "body" => %{"changes" => %{"description" => "Everything a neighbour needs before borrowing."}}})
{true, got} = call.("aludel_layer_call", %{"operation" => "getPage", "id" => detail})
"Everything a neighbour needs before borrowing." = get_in(got, ["result", "data", "description"])
{false, _} = call.("aludel_layer_call", %{"operation" => "updatePage", "id" => browse, "body" => %{"changes" => %{"label" => String.duplicate("x", 31)}}})
{false, _} = call.("aludel_layer_call", %{"operation" => "deleteEverything"})
{true, _} = call.("aludel_layer_call", %{"operation" => "listFlows"})

{true, %{"files" => [%{"path" => "knowledge/flow-method.md"}], "tests" => [%{"status" => "passed"}]}} = call.("aludel_layer_commit", %{"message" => "Name the goal before the first step", "tests" => [%{"name" => "node --test tests/*.test.mjs", "status" => "passed", "detail" => System.get_env("TESTS", "")}]})
{true, _} = call.("aludel_submit_proposal", %{"proposal" => %{"summary" => "Scripted: flow, description, method rule.", "content" => %{"notes" => "No model turn."},
  "followUps" => [%{"layer" => "platform", "title" => "Build Tool detail", "brief" => "Implement the page.", "why" => "The flow ends on a page not built yet."}]}})
IO.puts("OK")

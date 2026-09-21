#!/usr/bin/env python3
"""Check project allocation records and optionally render their Markdown maps.

This validates representation, not tool capability or product readiness.
Run from any directory; no dependencies beyond Python's standard library.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs/system"
STATES = {"manual", "experiment", "partial", "none", "deferred", "inapplicable", "verified"}
ADOPTIONS = {"candidate", "trial-selected", "selected-direction", "adopted", "deferred"}


def check(catalog, projects):
    errors = []
    ids = [c["id"] for c in catalog["capabilities"]]
    project_ids = [p["id"] for p in projects]
    if len(ids) != len(set(ids)) or len(project_ids) != len(set(project_ids)):
        errors.append("duplicate catalog or project identity")
    for project in projects:
        pid = project["id"]
        if project["catalog_revision"] != catalog["revision"]:
            errors.append(f"{pid}: stale capability catalog revision")
        entries = project["allocations"]
        allocated = [e["capability"] for e in entries]
        if set(allocated) != set(ids) or len(allocated) != len(ids):
            errors.append(f"{pid}: missing, duplicate or unknown capability allocation")
        for entry in entries:
            label = f"{pid}/{entry['capability']}"
            current, target = entry["current"], entry["target"]
            if current["state"] not in STATES or target["adoption"] not in ADOPTIONS:
                errors.append(f"{label}: invalid evidence/adoption state")
            if entry["usage"] not in {"delivery", "experience", "runtime"}:
                errors.append(f"{label}: unknown usage label")
            if len(target["authorities"]) != 1 or not target["authorities"][0].strip():
                errors.append(f"{label}: output requires one explicit target authority")
            if not entry["gap"].strip() or not entry["next_evidence"].strip():
                errors.append(f"{label}: missing gap disposition or next evidence")
            if not entry.get("required_by"):
                errors.append(f"{label}: missing project-specific review horizon")
            if not current["evidence"]:
                errors.append(f"{label}: evidence reference required (including deferral rationale)")
            for evidence in current["evidence"]:
                if not (ROOT / evidence).is_file():
                    errors.append(f"{label}: missing evidence {evidence}")
            if current["state"] == "verified" and not current.get("verification_scope"):
                errors.append(f"{label}: verified claim lacks explicit verification scope")
        for binding in project["service_bindings"]:
            label = f"{pid}/{binding['id']}"
            if binding["consumer_project"] != pid or binding["provider_project"] not in project_ids:
                errors.append(f"{label}: unknown or incorrect project binding")
            if not set(binding["capabilities"]).issubset(set(ids)):
                errors.append(f"{label}: unknown bound capability")
            if not binding["contract"] or not binding["provider_revision"] or not binding["recovery"]:
                errors.append(f"{label}: missing service contract, revision or recovery")
            if binding["provider_project"] == pid:
                if not binding.get("candidate_revision") or binding["candidate_revision"] == binding["provider_revision"]:
                    errors.append(f"{label}: self-development must separate provider and candidate revisions")
            if binding["state"] not in {"planned", "illustrative", "verified"}:
                errors.append(f"{label}: invalid service binding state")
            if binding["state"] == "verified" and not binding.get("evidence"):
                errors.append(f"{label}: verified service binding lacks integration evidence")
        handoff_ids = [h["id"] for h in project["handoffs"]]
        if len(handoff_ids) != len(set(handoff_ids)):
            errors.append(f"{pid}: duplicate handoff identity")
        for handoff in project["handoffs"]:
            if handoff["producer"] not in allocated or handoff["consumer"] not in allocated:
                errors.append(f"{pid}/{handoff['id']}: handoff references unallocated capability")
            if not all(handoff[k].strip() for k in ["payload", "validation", "next_evidence"]):
                errors.append(f"{pid}/{handoff['id']}: incomplete handoff contract")
    return errors


def render(catalog, project):
    names = {c["id"]: c["name"] for c in catalog["capabilities"]}
    lines = [f"# {project['id']}: capability coverage", "",
             f"Generated from `{project['id']}.json`; catalog revision {catalog['revision']}, project revision {project['revision']}.", "",
             f"Status: **{project['status']}**. Structural consistency is not operational readiness.", "",
             "Both projects use the same schema. Providers below are explicit project choices, not global defaults.", "",
             "| Capability / usage | Current evidence | Target provider(s) / adoption | Gap and next evidence |",
             "|---|---|---|---|"]
    for e in project["allocations"]:
        refs = ", ".join(f"[source {i+1}](../../{ref})" for i, ref in enumerate(e["current"]["evidence"]))
        providers = "; ".join(e["target"]["providers"]) or "Unselected"
        lines.append(f"| {e['capability']} {names[e['capability']]} / {e['usage']} | {e['current']['state']} — {refs} | {providers} / {e['target']['adoption']} | {e['gap']} → **{e['next_evidence']}** (horizon: {e['required_by']}) |")
    lines += ["", "## Authority by output", "", "| Capability | Authoritative output | Target authority |", "|---|---|---|"]
    for e in project["allocations"]:
        lines.append(f"| {e['capability']} | {e['output']} | {e['target']['authorities'][0]} |")
    lines += ["", "## Service provision between projects", ""]
    for b in project["service_bindings"]:
        lines += [f"- **{b['id']}** ({b['state']}): `{b['consumer_project']}` consumes `{b['provider_project']}` through {b['contract']}. Provider: {b['provider_revision']}. Candidate: {b.get('candidate_revision', 'not applicable')}. Recovery: {b['recovery']}."]
    lines += ["", "## Handoffs", "", "| ID / producer → consumer | Payload | Boundary / failure rule | Next evidence |", "|---|---|---|---|"]
    for h in project["handoffs"]:
        lines.append(f"| {h['id']} / {h['producer']} → {h['consumer']} | {h['payload']} | {h['validation']} | {h['next_evidence']} |")
    if not project["handoffs"]:
        lines += ["| — | Not specified for the fictional fixture | No live workflow claimed | Real project selection and scoped brief |"]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Regenerate readable maps after checks pass")
    args = parser.parse_args()
    catalog = json.loads((DATA / "capabilities.json").read_text())
    projects = [json.loads(p.read_text()) for p in sorted(DATA.glob("*.json")) if p.name != "capabilities.json"]
    errors = check(catalog, projects)
    if errors:
        print("\n".join(errors))
        return 1
    for project in projects:
        path = DATA / f"{project['id']}.md"
        content = render(catalog, project)
        if args.write:
            path.write_text(content)
        elif not path.exists() or path.read_text() != content:
            print(f"Stale generated map: {path.relative_to(ROOT)}; run with --write")
            return 1
    print(f"PASS: {len(catalog['capabilities'])} capabilities, {len(projects)} projects, explicit allocations and handoffs.")
    print("No operational readiness inferred. Inspect recorded gaps before the relevant gate.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

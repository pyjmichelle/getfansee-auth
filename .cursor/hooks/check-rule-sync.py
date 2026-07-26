#!/usr/bin/env python3
"""postToolUse hook: enforce agent/skill sync when governance files change.

When an edit (Write/StrReplace/MultiEdit/Delete) touches a rule / gate /
schema / route file, this hook injects an `additional_context` checklist
reminding the agent that `agent-skill-sync.mdc` triggers now apply and which
docs must be reconciled in the SAME task.

It only REMINDS — it never rewrites docs (full auto-rewrite needs judgment).

SAFE BY DEFAULT (fail open): any error, missing path, or non-governance file
results in `{}` (no-op). The hook can never block an edit.
"""
import json
import os
import re
import sys

# Governance / gate trigger paths (glob-ish, ** and * supported).
GOVERNANCE_GLOBS = [
    ".cursor/rules/**",
    ".cursor/agents/**",
    ".cursor/skills/**",
    "AGENTS.md",
    "package.json",
    "scripts/ci/**",
    "migrations/**",
    "app/**/route.ts",
]


def glob_to_regex(glob: str) -> str:
    i, n = 0, len(glob)
    out = ["^"]
    while i < n:
        if glob[i:i + 3] == "**/":
            out.append("(?:.*/)?")
            i += 3
        elif glob[i:i + 2] == "**":
            out.append(".*")
            i += 2
        elif glob[i] == "*":
            out.append("[^/]*")
            i += 1
        elif glob[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(glob[i]))
            i += 1
    out.append("$")
    return "".join(out)


def matches(glob: str, rel_path: str) -> bool:
    g = glob + "**" if glob.endswith("/") else glob
    try:
        return re.match(glob_to_regex(g), rel_path) is not None
    except re.error:
        return False


def noop():
    print(json.dumps({}))
    sys.exit(0)


CHECKLIST = (
    "⚠️ agent-skill-sync TRIGGER: you edited a governance/gate file ('{rel}').\n"
    "Per .cursor/rules/agent-skill-sync.mdc you MUST reconcile, in THIS task:\n"
    "  1. Relevant .cursor/agents/*.md (+ matching docs/agents/*.md mirror).\n"
    "  2. .cursor/skills/SKILLS_APPLICATION_GUIDE.md if usage scope changed.\n"
    "  3. AGENTS.md / kernel cross-references if a rule/gate changed.\n"
    "  4. Refresh the guide's '最后更新' date.\n"
    "Then run `pnpm check-all` (and `pnpm build` if gate commands changed). "
    "Do not declare done until dependent docs match the new rule."
)


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        noop()

    ti = data.get("tool_input") or data.get("input") or {}
    fp = (
        ti.get("file_path")
        or ti.get("path")
        or ti.get("target_file")
        or data.get("file_path")
        or ""
    )
    if not fp:
        noop()

    repo = os.getcwd()
    abspath = fp if os.path.isabs(fp) else os.path.join(repo, fp)
    try:
        rel = os.path.relpath(abspath, repo).replace(os.sep, "/")
    except Exception:
        noop()

    # Ignore generated/log artifacts under .cursor that are not governance docs.
    if rel.endswith(".ndjson") or rel.startswith(".cursor/hooks/"):
        noop()

    for g in GOVERNANCE_GLOBS:
        if matches(g, rel):
            print(json.dumps({"additional_context": CHECKLIST.format(rel=rel)}))
            sys.exit(0)

    noop()


if __name__ == "__main__":
    main()

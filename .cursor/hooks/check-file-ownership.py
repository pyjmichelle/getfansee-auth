#!/usr/bin/env python3
"""preToolUse hook: enforce parallel-agent file ownership.

Reads the tool-call JSON on stdin, looks up the edited file path against
.cursor/agent-locks.json, and denies the write/delete only when:
  - registry.enforce is true, AND
  - the path matches an *active* claim owned by a DIFFERENT owner than the
    current session's CURSOR_AGENT_OWNER.

SAFE BY DEFAULT: any error, missing registry, enforce=false, unset owner, or
non-matching path results in {"permission": "allow"}. This hook can never lock
the user (or a single solo agent) out of editing.
"""
import json
import os
import re
import sys


def glob_to_regex(glob: str) -> str:
    # Translate a path glob (supporting ** and *) to a regex.
    i, n = 0, len(glob)
    out = ["^"]
    while i < n:
        c = glob[i]
        if glob[i:i + 3] == "**/":
            out.append("(?:.*/)?")
            i += 3
        elif glob[i:i + 2] == "**":
            out.append(".*")
            i += 2
        elif c == "*":
            out.append("[^/]*")
            i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(c))
            i += 1
    out.append("$")
    return "".join(out)


def matches(glob: str, rel_path: str) -> bool:
    g = glob
    # Treat "dir/" and "dir/**" as directory-prefix claims.
    if g.endswith("/"):
        g = g + "**"
    try:
        return re.match(glob_to_regex(g), rel_path) is not None
    except re.error:
        return False


def allow():
    print(json.dumps({"permission": "allow"}))
    sys.exit(0)


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        allow()

    # Extract the target file path across possible field shapes.
    ti = data.get("tool_input") or data.get("input") or {}
    fp = (
        ti.get("file_path")
        or ti.get("path")
        or ti.get("target_file")
        or data.get("file_path")
        or ""
    )
    if not fp:
        allow()

    repo = os.getcwd()
    abspath = fp if os.path.isabs(fp) else os.path.join(repo, fp)
    try:
        rel = os.path.relpath(abspath, repo)
    except Exception:
        allow()
    rel = rel.replace(os.sep, "/")

    registry_path = os.path.join(repo, ".cursor", "agent-locks.json")
    try:
        with open(registry_path, "r", encoding="utf-8") as f:
            reg = json.load(f)
    except Exception:
        allow()

    if not reg.get("enforce"):
        allow()

    current = os.environ.get("CURSOR_AGENT_OWNER", "").strip()

    for claim in reg.get("claims", []):
        if not claim.get("active"):
            continue
        owner = str(claim.get("owner", "")).strip()
        if not owner or owner == current:
            continue
        for g in claim.get("globs", []):
            if matches(g, rel):
                msg = (
                    f"File '{rel}' is claimed by parallel agent '{owner}'. "
                    f"Current owner is '{current or '(unset)'}'. "
                    "Coordinate via .cursor/agent-locks.json or work in a separate worktree."
                )
                print(json.dumps({
                    "permission": "deny",
                    "agent_message": msg,
                    "user_message": f"Blocked edit to {rel}: owned by '{owner}'.",
                }))
                sys.exit(0)

    allow()


if __name__ == "__main__":
    main()

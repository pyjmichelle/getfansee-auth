#!/bin/bash
# afterFileEdit hook: append an audit line recording who edited which file.
# Best-effort and always exits 0 (never blocks).
input=$(cat)
log=".cursor/agent-edit-log.ndjson"
ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
owner="${CURSOR_AGENT_OWNER:-unknown}"

file=$(printf '%s' "$input" | jq -r '.file_path // .tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

if [ -n "$file" ]; then
  printf '{"ts":"%s","owner":"%s","file":%s}\n' "$ts" "$owner" "$(printf '%s' "$file" | jq -R .)" >> "$log" 2>/dev/null || true
fi

exit 0

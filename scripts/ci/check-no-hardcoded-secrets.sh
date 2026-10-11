#!/usr/bin/env bash
# Scan tracked files, including environment files and generated artifacts.
# Print paths only: diagnostics must never repeat a discovered credential.
set -euo pipefail

python3 - <<'PY'
import pathlib
import re
import subprocess
import sys

patterns = [
    re.compile(r'sbp_[a-f0-9]{20,}'),
    re.compile(r'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'),
    re.compile(r'"(?:access_token|refresh_token)"\s*:\s*"[^"\s]{20,}"'),
]
files = subprocess.check_output(['git', 'ls-files', '-z']).split(b'\0')
leaks = []
for raw_path in files:
    if not raw_path:
        continue
    path = pathlib.Path(raw_path.decode())
    if not path.is_file():
        continue
    contents = path.read_text(errors='replace')
    if any(pattern.search(contents) for pattern in patterns):
        leaks.append(str(path))
if leaks:
    print('ERROR: possible committed credentials found in:')
    for path in leaks:
        print(path)
    print('Remove credentials and rotate any exposed secrets.')
    sys.exit(1)
print('OK: no committed Supabase credentials or browser session tokens.')
PY

#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
demo_root="${TMPDIR:-/tmp}/proofpack-demo"
mkdir -p "$demo_root"

cd "$demo_root"
git init -q -b main
git config user.name "Proofpack Demo"
git config user.email "demo@example.invalid"
printf 'export function add(a, b) { return a + b; }\n' > calculator.js
printf '# Demo\n' > README.md
git add .
git commit -qm "initial"

printf 'export function add(a, b) { return a + b; }\nexport function multiply(a, b) { return a * b; }\n' > calculator.js
printf 'node -e "if (2 + 3 !== 5) process.exit(1)"\n' > check.sh
chmod +x check.sh

printf '\n$ npx -y --package=proofpack-cli@0.3.2 proofpack check\n'
"$root/node_modules/.bin/tsx" "$root/src/cli.ts" check --format markdown | sed -n '1,28p'

printf '\n$ npx -y --package=proofpack-cli@0.3.2 proofpack check --run "./check.sh"\n'
"$root/node_modules/.bin/tsx" "$root/src/cli.ts" check --run "./check.sh" --format markdown | sed -n '/## Checks/,/## Not checked/p'

printf '\nTemporary demo repository: %s\n' "$demo_root"
printf 'Remove it manually when the recording is finished.\n'

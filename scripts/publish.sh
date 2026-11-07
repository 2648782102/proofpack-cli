#!/bin/sh
set -eu

if [ -z "${NPM_TOKEN:-}" ]; then
  echo "NPM_TOKEN is required for noninteractive publishing." >&2
  echo "Create a granular npm token with publish permission and bypass 2FA." >&2
  exit 2
fi

package_version=$(node -p 'require("./package.json").version')
cli_version=$(node dist/cli.js --version | sed 's/^proofpack //')
if [ "$package_version" != "$cli_version" ]; then
  echo "package.json version ($package_version) does not match CLI version ($cli_version)." >&2
  exit 2
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree must be clean before publishing." >&2
  exit 2
fi

npm run check
npm test
npm run build
npm pack --dry-run

NPM_CONFIG_USERCONFIG="$(mktemp)" || exit 2
export NPM_CONFIG_USERCONFIG
trap 'rm -f "$NPM_CONFIG_USERCONFIG"' EXIT HUP INT TERM
printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$NPM_CONFIG_USERCONFIG"

npm publish --access public --provenance
npm view "proofpack-cli@$package_version" version dist.integrity

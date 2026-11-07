#!/bin/sh
set -eu

NPM_KEYCHAIN_SERVICE="proofpack-cli-npm-token"
NPM_KEYCHAIN_ACCOUNT="2648782102h"

if [ -z "${NPM_TOKEN:-}" ]; then
  if [ "$(uname -s)" = "Darwin" ] && security find-generic-password \
    -a "$NPM_KEYCHAIN_ACCOUNT" \
    -s "$NPM_KEYCHAIN_SERVICE" \
    -w >/dev/null 2>&1; then
    NPM_TOKEN="$(security find-generic-password \
      -a "$NPM_KEYCHAIN_ACCOUNT" \
      -s "$NPM_KEYCHAIN_SERVICE" \
      -w)"
    export NPM_TOKEN
  else
    echo "NPM_TOKEN is required for noninteractive publishing." >&2
    echo "Run scripts/setup-npm-token.sh or export a granular token with publish permission and bypass 2FA." >&2
    exit 2
  fi
fi

case "$NPM_TOKEN" in
  *'
'*) echo "NPM_TOKEN must be a single-line value." >&2; exit 2 ;;
esac

if [ "${PUBLISH_MODE:-direct}" = "stage" ]; then
  PUBLISH_COMMAND="stage publish"
elif [ "${PUBLISH_MODE:-direct}" = "direct" ]; then
  PUBLISH_COMMAND="publish"
else
  echo "PUBLISH_MODE must be 'direct' or 'stage'." >&2
  exit 2
fi

if [ "${PROVENANCE:-0}" = "1" ]; then
  PROVENANCE_ARGS="--provenance"
else
  PROVENANCE_ARGS=""
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
trap 'rm -f "$NPM_CONFIG_USERCONFIG"; unset NPM_TOKEN' EXIT HUP INT TERM
printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$NPM_CONFIG_USERCONFIG"

if npm $PUBLISH_COMMAND --access public $PROVENANCE_ARGS; then
  :
else
  publish_status=$?
  echo "npm $PUBLISH_COMMAND failed; the version may not exist on the live registry." >&2
  echo "Check token scope and bypass-2FA. If E_STAGE_REQUIRED appears, rerun with PUBLISH_MODE=stage and approve the staged package with 2FA." >&2
  exit "$publish_status"
fi

if [ "$PUBLISH_COMMAND" = "publish" ]; then
  npm view "proofpack-cli@$package_version" version dist.integrity
else
  echo "Staged package submitted. Review and approve it with 2FA in npmjs.com's Staged Packages tab; the version is not live until approval."
  npm stage list proofpack-cli --json
fi

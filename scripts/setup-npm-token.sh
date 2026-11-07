#!/bin/sh
set -eu

NPM_KEYCHAIN_SERVICE="proofpack-cli-npm-token"
NPM_KEYCHAIN_ACCOUNT="2648782102h"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This helper requires macOS Keychain." >&2
  echo "Set NPM_TOKEN through your platform's secret store instead." >&2
  exit 2
fi

if [ ! -t 0 ]; then
  echo "Use a secure secret store for this platform." >&2
  echo "In a terminal, run: read -rs NPM_TOKEN; export NPM_TOKEN" >&2
  echo "Do not put the literal token in a command line or committed file." >&2
  exit 2
fi

echo "Create a granular npm token with publish permission and Bypass two-factor authentication."
echo "For this unscoped package, the token must allow all packages or explicitly include proofpack-cli; a token limited to @2648782102h cannot publish it."
echo "If a token was displayed in a local diagnostic dialog, revoke it at https://www.npmjs.com/settings/2648782102h/tokens and generate a replacement first."
if ! command -v osascript >/dev/null 2>&1; then
  echo "macOS osascript is required for hidden token entry." >&2
  exit 2
fi
if ! NPM_TOKEN_VALUE="$(osascript -e 'display dialog "Paste the granular npm token. It will be stored in macOS Keychain." default answer "" with hidden answer' -e 'return text returned of result')"; then
  echo "Token entry was cancelled." >&2
  exit 2
fi

NPM_TOKEN_VALUE="$(printf '%s' "$NPM_TOKEN_VALUE" | tr -d '\r\n')"
if [ -z "$NPM_TOKEN_VALUE" ]; then
  echo "Token must not be empty." >&2
  exit 2
fi

NPM_TOKEN_HEX="$(printf '%s' "$NPM_TOKEN_VALUE" | xxd -p -c 256)" || exit 2
unset NPM_TOKEN_VALUE
security add-generic-password -U \
  -a "$NPM_KEYCHAIN_ACCOUNT" \
  -s "$NPM_KEYCHAIN_SERVICE" \
  -T /usr/bin/security \
  -X "$NPM_TOKEN_HEX" >/dev/null || exit 2
unset NPM_TOKEN_HEX

echo "Stored the npm token in macOS Keychain as '$NPM_KEYCHAIN_SERVICE'."
echo "No token was added to shell history, .npmrc, or the repository."

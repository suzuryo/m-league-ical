#!/usr/bin/env bash
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/takumi-guard.sh"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
mkdir "$scratch/bin" "$scratch/runner"
cat > "$scratch/bin/curl" <<'CURL'
#!/usr/bin/env bash
set -euo pipefail
test "$1" = --disable
test "$2" = --config
test "$3" = -
test "${!#}" = https://npm.flatt.tech/api/v1/tokens/status
case "$*" in *tg_anon_*) exit 90;; esac
cat > "$GUARD_CAPTURE"
printf '%s' "${GUARD_HTTP_STATUS:-200}"
exit "${GUARD_CURL_EXIT:-0}"
CURL
chmod +x "$scratch/bin/curl"
export PATH="$scratch/bin:$PATH"
export RUNNER_TEMP="$scratch/runner"
export GITHUB_OUTPUT="$scratch/output"
export GUARD_CAPTURE="$scratch/capture"
export TAKUMI_GUARD_TOKEN=tg_anon_test_only_never_real
export TAKUMI_GUARD_AUTH=required

bash "$script" prepare > "$scratch/log" 2>&1
directory="$(sed -n 's/^directory=//p' "$GITHUB_OUTPUT")"
npmrc="$(sed -n 's/^npmrc=//p' "$GITHUB_OUTPUT")"
test -d "$directory"
test "$npmrc" = "$directory/npmrc"
test "$(cat "$GUARD_CAPTURE")" = 'header = "Authorization: Bearer tg_anon_test_only_never_real"'
test "$(cat "$npmrc")" = "registry=https://npm.flatt.tech/
//npm.flatt.tech/:_authToken=\${TAKUMI_GUARD_TOKEN}"
if grep -Fqr "$TAKUMI_GUARD_TOKEN" "$directory" "$scratch/log" "$GITHUB_OUTPUT"; then exit 1; fi
if stat -c '%a' "$npmrc" >/dev/null 2>&1; then
  test "$(stat -c '%a' "$npmrc")" = 600
else
  test "$(stat -f '%Lp' "$npmrc")" = 600
fi
bash "$script" cleanup "$directory"
test ! -e "$directory"

for GUARD_HTTP_STATUS in 401 403 429 500; do
  export GUARD_HTTP_STATUS
  : > "$GITHUB_OUTPUT"
  if bash "$script" prepare > "$scratch/log" 2>&1; then exit 1; fi
  test ! -s "$GITHUB_OUTPUT"
  if grep -Fq "$TAKUMI_GUARD_TOKEN" "$scratch/log"; then exit 1; fi
done
unset GUARD_HTTP_STATUS
export GUARD_CURL_EXIT=7
if bash "$script" prepare > "$scratch/log" 2>&1; then exit 1; fi
unset GUARD_CURL_EXIT

for invalid in '' wrong-prefix $'tg_anon_bad\nregistry=bad'; do
  rm -f "$GUARD_CAPTURE"
  if TAKUMI_GUARD_TOKEN="$invalid" bash "$script" prepare > "$scratch/log" 2>&1; then exit 1; fi
  test ! -e "$GUARD_CAPTURE"
done
if TAKUMI_GUARD_AUTH=optional bash "$script" prepare > "$scratch/log" 2>&1; then exit 1; fi

: > "$GITHUB_OUTPUT"
rm -f "$GUARD_CAPTURE"
TAKUMI_GUARD_AUTH=anonymous bash "$script" prepare > "$scratch/log" 2>&1
directory="$(sed -n 's/^directory=//p' "$GITHUB_OUTPUT")"
test "$(cat "$directory/npmrc")" = 'registry=https://npm.flatt.tech/'
test ! -e "$GUARD_CAPTURE"
bash "$script" cleanup "$directory"
mkdir "$RUNNER_TEMP/unrelated"
if bash "$script" cleanup "$RUNNER_TEMP/unrelated" > "$scratch/log" 2>&1; then exit 1; fi
test -d "$RUNNER_TEMP/unrelated"
if bash "$script" cleanup "$RUNNER_TEMP/takumi-guard.bad/../unrelated" > "$scratch/log" 2>&1; then exit 1; fi
test -d "$RUNNER_TEMP/unrelated"
printf '%s\n' 'PASS: Takumi auth, failures, anonymous config, secret isolation, and cleanup'

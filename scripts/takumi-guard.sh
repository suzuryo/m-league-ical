#!/usr/bin/env bash
# Keep this portable: it runs before Node/Ruby/Go package-manager setup.
set +x
set -euo pipefail

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

case "${1:-}" in
  cleanup)
    directory="${2:-}"
    test -n "$directory" || exit 0
    test "${directory%/*}" = "${RUNNER_TEMP:?}" || fail 'Invalid cleanup directory.'
    case "${directory##*/}" in
      takumi-guard.*) rm -rf -- "$directory" ;;
      *) fail 'Invalid cleanup directory.' ;;
    esac
    exit 0
    ;;
  prepare) ;;
  *) fail 'Usage: takumi-guard.sh prepare | cleanup <directory>' ;;
esac

mode="${TAKUMI_GUARD_AUTH:-required}"
case "$mode" in
  required)
    [[ "${TAKUMI_GUARD_TOKEN:-}" =~ ^tg_anon_[A-Za-z0-9_-]+$ ]] ||
      fail 'TAKUMI_GUARD_TOKEN must contain a tg_anon_ token.'
    if ! status="$(
      printf 'header = "Authorization: Bearer %s"\n' "$TAKUMI_GUARD_TOKEN" |
        curl --disable --config - --proto '=https' --no-location --silent \
          --connect-timeout 10 --max-time 20 --output /dev/null --write-out '%{http_code}' \
          'https://npm.flatt.tech/api/v1/tokens/status'
    )"; then
      fail 'Takumi Guard token validation request failed.'
    fi
    [[ "$status" =~ ^[0-9]{3}$ ]] || fail 'Invalid token validation response.'
    test "$status" = 200 || fail "Takumi Guard token validation failed: HTTP $status."
    printf '%s\n' 'Takumi Guard token validated.'
    ;;
  anonymous)
    printf '%s\n' 'Takumi Guard anonymous mode (workflow without repository secrets).'
    ;;
  *) fail 'TAKUMI_GUARD_AUTH must be required or anonymous.' ;;
esac

test -d "${RUNNER_TEMP:?}" || fail 'RUNNER_TEMP is not a directory.'
test -n "${GITHUB_OUTPUT:?}" || fail 'GITHUB_OUTPUT is required.'
umask 077
directory="$(mktemp -d "$RUNNER_TEMP/takumi-guard.XXXXXXXX")"
trap 'rm -rf -- "$directory"' EXIT
printf '%s\n' 'registry=https://npm.flatt.tech/' > "$directory/npmrc"
if test "$mode" = required; then
  printf '%s\n' "//npm.flatt.tech/:_authToken=\${TAKUMI_GUARD_TOKEN}" >> "$directory/npmrc"
fi
printf 'directory=%s\nnpmrc=%s\nmode=%s\n' "$directory" "$directory/npmrc" "$mode" >> "$GITHUB_OUTPUT"
trap - EXIT

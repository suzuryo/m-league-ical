#!/usr/bin/env bash
#MISE description="ARC停止時に選択したworkflowをGitHub-hostedで起動する(既定: ci.yml、main)"
set -euo pipefail

usage() {
  printf '%s\n' 'Usage: mise run ci:github-hosted -- [workflow] [branch-or-tag]' \
    'workflow: ci.yml | github-pages.yml (Pages deploy)'
}

if [ "$#" -gt 2 ]; then
  usage >&2
  exit 2
fi

workflow="${1-ci.yml}"
case "$workflow" in
  -h|--help) usage; exit 0 ;;
  ci.yml|github-pages.yml) ;;
  *) usage >&2; exit 2 ;;
esac

ref="${2-main}"
case "$ref" in
  ''|-*|*[[:space:]]*) usage >&2; exit 2 ;;
esac

if ! command -v gh >/dev/null 2>&1; then
  printf '%s\n' 'GitHub CLI (gh) が必要です。' >&2
  exit 1
fi

exec gh workflow run "$workflow" \
  -R suzuryo/m-league-ical \
  --ref "$ref" \
  -f runner=github-hosted

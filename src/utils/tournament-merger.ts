import type { TournamentMatch } from '../types/tournament-match'

function makeKey(match: TournamentMatch): string {
  return `${match.date}|${match.stage}|${match.table}`
}

function compare(a: TournamentMatch, b: TournamentMatch): number {
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date)
  }
  return a.startTime.localeCompare(b.startTime)
}

/**
 * 公式データと補助データをマージ。重複時は公式優先。
 * 結果は日付・時刻順にソート。
 */
export function mergeMatches(
  official: TournamentMatch[],
  extra: TournamentMatch[],
): TournamentMatch[] {
  const officialKeys = new Set(official.map(makeKey))
  const filteredExtra = extra.filter((m) => !officialKeys.has(makeKey(m)))
  return [...official, ...filteredExtra].sort(compare)
}

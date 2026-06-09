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
 * 公式データと補助データをマージ。重複時は原則として公式優先。
 * ただし補助側に override:true のエントリがある場合は、同キーの公式試合を
 * 上書きして補助を優先する (例: 出場辞退で公式の出場者枠が未定のまま掲載され、
 * X で発表された正規メンバーを補助データに記録したケース)。
 * 結果は日付・時刻順にソート。
 */
export function mergeMatches(
  official: TournamentMatch[],
  extra: TournamentMatch[],
): TournamentMatch[] {
  const overrideKeys = new Set(extra.filter((m) => m.override).map(makeKey))
  // override 指定された補助と同キーの公式試合は除外する。
  const filteredOfficial = official.filter((m) => !overrideKeys.has(makeKey(m)))

  const officialKeys = new Set(filteredOfficial.map(makeKey))
  // override 指定の補助は常に採用。それ以外は公式に同キーが無い場合のみ採用。
  const filteredExtra = extra.filter(
    (m) => m.override || !officialKeys.has(makeKey(m)),
  )

  return [...filteredOfficial, ...filteredExtra].sort(compare)
}

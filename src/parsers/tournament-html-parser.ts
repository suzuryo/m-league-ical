import { M_TOURNAMENT_CONFIG } from '../config-tournament'
import type { TournamentMatch } from '../types/tournament-match'
import { addMinutesToTime } from '../utils/calendar-utils'

type SectionConfig =
  (typeof M_TOURNAMENT_CONFIG.sections)[keyof typeof M_TOURNAMENT_CONFIG.sections]

/**
 * Extract all match card HTML strings from the section.
 * Uses the section's matchBlock regex with the `g` flag.
 */
function parseMatchCards(html: string, section: SectionConfig): string[] {
  const cards: string[] = []
  const regex = new RegExp(section.matchBlock.source, section.matchBlock.flags)
  let match = regex.exec(html)

  while (match !== null) {
    cards.push(match[1])
    match = regex.exec(html)
  }

  return cards
}

/**
 * Parse date and start time from a single match card.
 * Returns null when the date cannot be extracted.
 */
function parseDateTime(
  cardContent: string,
  year: number,
  section: SectionConfig,
): { date: string; startTime: string } | null {
  const dtMatch = cardContent.match(section.dateTime)
  if (!dtMatch) return null

  const monthStr = dtMatch[1].padStart(2, '0')
  const dayStr = dtMatch[2].padStart(2, '0')
  const date = `${year}-${monthStr}-${dayStr}`

  let startTime: string = M_TOURNAMENT_CONFIG.calendar.defaultStartTime
  if (
    section.hasTimeInfo &&
    dtMatch[3] !== undefined &&
    dtMatch[4] !== undefined
  ) {
    const hour = dtMatch[3].padStart(2, '0')
    const minute = dtMatch[4].padStart(2, '0')
    startTime = `${hour}${minute}00`
  }

  return { date, startTime }
}

/**
 * Normalize stage name. "FINALSTAGE" → "FINAL STAGE" for readability.
 */
function normalizeStage(stage: string): string {
  if (stage === 'FINALSTAGE') return 'FINAL STAGE'
  return stage
}

/**
 * Parse stage name and table label from a match card.
 * Falls back to empty strings when the regex does not match.
 */
function parseStageAndTable(
  cardContent: string,
  section: SectionConfig,
): { stage: string; table: string } {
  const m = cardContent.match(section.stageAndTable)
  if (!m) return { stage: '', table: '' }

  // group1 (stage) は両セクションの正規表現で必須キャプチャなので必ず定義される。
  // group2 (table) は finalStage では任意 (FINAL は卓なし) のため undefined になりうる。
  const stage = normalizeStage(m[1].trim())
  const table = (m[2] ?? '').trim()
  return { stage, table }
}

/**
 * Extract the 4 players from the dedicated logos block.
 * Restricting the source to the logos block avoids picking up
 * unrelated <img> tags from modal popups elsewhere in the card.
 */
function parsePlayers(cardContent: string, section: SectionConfig): string[] {
  const blockMatch = cardContent.match(section.logosBlock)
  if (!blockMatch) return []

  const block = blockMatch[1]
  const players: string[] = []
  const regex = new RegExp(section.player.source, section.player.flags)
  let match = regex.exec(block)

  while (match !== null) {
    const name = match[1].trim()
    if (name) players.push(name)
    match = regex.exec(block)
  }

  return players
}

/**
 * Extract the broadcast URL from a match card.
 * Trims trailing whitespace observed inside some onclick values.
 * 未定カードは onclick="window.open('#')" のようにプレースホルダを持つ。
 * http(s) でない値は視聴URLではないので undefined 扱いにし、
 * generator のデフォルトロケーションにフォールバックさせる。
 */
function parseUrl(
  cardContent: string,
  section: SectionConfig,
): string | undefined {
  const m = cardContent.match(section.url)
  if (!m) return undefined
  const url = m[1].trim()
  return /^https?:\/\//.test(url) ? url : undefined
}

/**
 * 時刻情報を持たないセクション (予選) の開始時刻を位置ベースで割り当てる。
 * 同一日付の中でカード出現順に 1番目=firstMatchStartTime / 2番目=defaultStartTime。
 * 3番目以降は想定外データなのでエラーを投げる。終了時刻も再計算する。
 */
function assignPositionalStartTimes(matches: TournamentMatch[]): void {
  const countByDate = new Map<string, number>()
  for (const match of matches) {
    const index = countByDate.get(match.date) ?? 0
    countByDate.set(match.date, index + 1)

    let startTime: string
    if (index === 0) {
      startTime = M_TOURNAMENT_CONFIG.calendar.firstMatchStartTime
    } else if (index === 1) {
      startTime = M_TOURNAMENT_CONFIG.calendar.defaultStartTime
    } else {
      throw new Error(
        `Unexpected 3rd+ qualifier match on ${match.date} ` +
          `(stage=${match.stage}, table=${match.table})`,
      )
    }

    match.startTime = startTime
    match.endTime = addMinutesToTime(
      startTime,
      M_TOURNAMENT_CONFIG.calendar.matchDurationMinutes,
    )
  }
}

/**
 * Parse all matches contained in a single section.
 * 出場者未定 (players が空) のカードもイベント化する。必須は日付のみ。
 */
function parseSection(
  html: string,
  year: number,
  section: SectionConfig,
): TournamentMatch[] {
  const matches = parseMatchCards(html, section)
    .map((card): TournamentMatch | null => {
      const dt = parseDateTime(card, year, section)
      if (!dt) return null

      const players = parsePlayers(card, section)
      const st = parseStageAndTable(card, section)
      const url = parseUrl(card, section)

      return {
        date: dt.date,
        startTime: dt.startTime,
        endTime: addMinutesToTime(
          dt.startTime,
          M_TOURNAMENT_CONFIG.calendar.matchDurationMinutes,
        ),
        stage: st.stage,
        table: st.table,
        players,
        url,
      }
    })
    .filter((m): m is TournamentMatch => m !== null)

  // 時刻非掲載セクションでは parseDateTime の startTime は仮値。
  // assignPositionalStartTimes が日付内の位置で上書きする。
  if (!section.hasTimeInfo) {
    assignPositionalStartTimes(matches)
  }

  return matches
}

/**
 * Parse M-Tournament matches from HTML content.
 * Processes the FINAL STAGE and qualifier sections separately and concatenates.
 * @param html - HTML content from M-Tournament website
 * @param year - Year for the schedules
 * @returns Array of TournamentMatch objects
 */
export function parseTournamentMatches(
  html: string,
  year: number,
): TournamentMatch[] {
  return [
    ...parseSection(html, year, M_TOURNAMENT_CONFIG.sections.finalStage),
    ...parseSection(html, year, M_TOURNAMENT_CONFIG.sections.qualifier),
  ]
}

/**
 * Check if the HTML contains any tournament schedule data.
 * @param html - HTML content to check
 * @returns true if at least one of the section markers is present
 */
export function hasTournamentData(html: string): boolean {
  return (
    html.includes('c-schedule__list') || html.includes('p-gamesSchedule2__list')
  )
}

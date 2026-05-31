import { M_TOURNAMENT_CONFIG } from '../config-tournament'
import type { TournamentMatch } from '../types/tournament-match'
import { formatDateTime, generateTournamentUid } from '../utils/calendar-utils'

/**
 * Generate iCalendar timezone section
 * @returns Array of VTIMEZONE lines
 */
function generateTimezone(): string[] {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${M_TOURNAMENT_CONFIG.calendar.timezone}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
}

/**
 * Generate iCalendar alarm section
 * @param summary - Event summary for alarm description
 * @returns Array of VALARM lines
 */
function generateAlarm(summary: string): string[] {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${summary}`,
    'END:VALARM',
  ]
}

/**
 * Generate iCalendar event section for a tournament match
 * @param match - TournamentMatch object
 * @returns Array of VEVENT lines
 */
function generateEvent(match: TournamentMatch): string[] {
  const uid = generateTournamentUid(match)
  const dtStart = formatDateTime(match.date, match.startTime)
  const dtEnd = formatDateTime(match.date, match.endTime)

  const headerParts: string[] = []
  if (match.stage) {
    headerParts.push(match.stage)
  }
  if (match.table) {
    headerParts.push(match.table)
  }
  const header = headerParts.length > 0 ? `[${headerParts.join(' ')}]` : ''
  const playersStr = match.players.join('・')
  const summary =
    header && playersStr ? `${header} ${playersStr}` : `${header}${playersStr}`

  const location = match.url || M_TOURNAMENT_CONFIG.calendar.defaultLocation

  const eventLines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;TZID=${M_TOURNAMENT_CONFIG.calendar.timezone}:${dtStart}`,
    `DTEND;TZID=${M_TOURNAMENT_CONFIG.calendar.timezone}:${dtEnd}`,
    `SUMMARY:${summary}`,
  ]

  if (match.players.length > 0) {
    const playerList = match.players
      .map(
        (player) =>
          `${M_TOURNAMENT_CONFIG.calendar.description.playerBullet}${player}`,
      )
      .join('\\n')
    const description = `${M_TOURNAMENT_CONFIG.calendar.description.prefix}\\n${playerList}`
    eventLines.push(`DESCRIPTION:${description}`)
  }

  eventLines.push(`LOCATION:${location}`)
  eventLines.push(...generateAlarm(summary))
  eventLines.push('END:VEVENT')

  return eventLines
}

/**
 * Generate complete iCalendar content for tournament matches
 * @param matches - Array of TournamentMatch objects
 * @returns iCalendar formatted string
 */
export function generateTournamentICalendar(
  matches: TournamentMatch[],
): string {
  const lines: string[] = []

  // Calendar header
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//M-Tournament Schedule//JP')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push(`X-WR-CALNAME:${M_TOURNAMENT_CONFIG.calendar.name}`)
  lines.push(`X-WR-TIMEZONE:${M_TOURNAMENT_CONFIG.calendar.timezone}`)

  // Timezone
  lines.push(...generateTimezone())

  // Events
  for (const match of matches) {
    lines.push(...generateEvent(match))
  }

  // Calendar footer
  lines.push('END:VCALENDAR')

  return lines.join('\r\n')
}

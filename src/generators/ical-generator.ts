import { M_LEAGUE_CONFIG } from '../config'
import type { Schedule } from '../types/schedule'
import { formatDateTime, generateUid } from '../utils/calendar-utils'

/**
 * Generate iCalendar timezone section
 * @returns Array of VTIMEZONE lines
 */
function generateTimezone(): string[] {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${M_LEAGUE_CONFIG.calendar.timezone}`,
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
 * Generate iCalendar event section
 * @param schedule - Schedule object
 * @returns Array of VEVENT lines
 */
function generateEvent(schedule: Schedule): string[] {
  const uid = generateUid(schedule)
  const dtStart = formatDateTime(
    schedule.date,
    M_LEAGUE_CONFIG.calendar.eventStartTime,
  )
  const dtEnd = formatDateTime(
    schedule.date,
    M_LEAGUE_CONFIG.calendar.eventEndTime,
  )

  const summary = schedule.teams.map((team) => `[${team}]`).join('')
  const description = `対戦チーム:\\n${schedule.teams.map((team) => `・${team}`).join('\\n')}`
  const location = schedule.url || M_LEAGUE_CONFIG.calendar.defaultLocation

  const eventLines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;TZID=${M_LEAGUE_CONFIG.calendar.timezone}:${dtStart}`,
    `DTEND;TZID=${M_LEAGUE_CONFIG.calendar.timezone}:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
  ]

  eventLines.push(...generateAlarm(summary))
  eventLines.push('END:VEVENT')

  return eventLines
}

/**
 * Generate complete iCalendar content
 * @param schedules - Array of Schedule objects
 * @returns iCalendar formatted string
 */
export function generateICalendar(schedules: Schedule[]): string {
  const lines: string[] = []

  // Calendar header
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//M-League Schedule//JP')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push(`X-WR-CALNAME:${M_LEAGUE_CONFIG.calendar.name}`)
  lines.push(`X-WR-TIMEZONE:${M_LEAGUE_CONFIG.calendar.timezone}`)

  // Timezone
  lines.push(...generateTimezone())

  // Events
  for (const schedule of schedules) {
    lines.push(...generateEvent(schedule))
  }

  // Calendar footer
  lines.push('END:VCALENDAR')

  return lines.join('\r\n')
}

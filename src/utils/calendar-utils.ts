import { createHash } from 'node:crypto'

import type { Schedule } from '../types/schedule'
import type { TournamentMatch } from '../types/tournament-match'

/**
 * Number of characters to use from the SHA-256 hash for UID generation
 */
const HASH_LENGTH = 12

/**
 * Generate a deterministic UID for a schedule event
 * @param schedule - Schedule object containing date and teams
 * @returns UID string in the format: YYYY-MM-DD-hash@m-league.jp
 */
export function generateUid(schedule: Schedule): string {
  const teamHash = createHash('sha256')
    .update(schedule.date + [...schedule.teams].sort().join(','))
    .digest('hex')
    .substring(0, HASH_LENGTH)

  return `${schedule.date}-${teamHash}@m-league.jp`
}

/**
 * Format a date string to iCalendar datetime format
 * @param dateString - Date string in YYYY-MM-DD format
 * @param timeString - Time string in HHMMSS format
 * @returns Formatted datetime string: YYYYMMDDTHHMMSS
 */
export function formatDateTime(dateString: string, timeString: string): string {
  const [year, month, day] = dateString.split('-')
  return `${year}${month}${day}T${timeString}`
}

/**
 * Add minutes to a HHMMSS time string. Wraps within 24 hours.
 * @param timeString - HHMMSS format time
 * @param minutes - Minutes to add (non-negative)
 * @returns HHMMSS format
 */
export function addMinutesToTime(timeString: string, minutes: number): string {
  const h = Number.parseInt(timeString.substring(0, 2), 10)
  const m = Number.parseInt(timeString.substring(2, 4), 10)
  const s = timeString.substring(4, 6)
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60) % 24
  const newM = total % 60
  return `${String(newH).padStart(2, '0')}${String(newM).padStart(2, '0')}${s}`
}

/**
 * Generate a deterministic UID for a tournament match event
 * @param match - TournamentMatch object containing date, stage, table, and players
 * @returns UID string in the format: YYYY-MM-DD-hash@m-tournament.m-league.jp
 */
export function generateTournamentUid(match: TournamentMatch): string {
  const sortedPlayers = [...match.players].sort().join(',')
  const hash = createHash('sha256')
    .update(`${match.date}|${match.stage}|${match.table}|${sortedPlayers}`)
    .digest('hex')
    .substring(0, HASH_LENGTH)

  return `${match.date}-${hash}@m-tournament.m-league.jp`
}

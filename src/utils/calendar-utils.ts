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
 * Generate a deterministic UID for a tournament match event
 * @param match - TournamentMatch object containing date, stage, table, and players
 * @returns UID string in the format: YYYY-MM-DD-hash@m-tournament.jp
 */
export function generateTournamentUid(match: TournamentMatch): string {
  const sortedPlayers = [...match.players].sort().join(',')
  const hash = createHash('sha256')
    .update(`${match.date}|${match.stage}|${match.table}|${sortedPlayers}`)
    .digest('hex')
    .substring(0, HASH_LENGTH)

  return `${match.date}-${hash}@m-tournament.jp`
}

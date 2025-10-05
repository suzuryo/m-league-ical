import { M_LEAGUE_CONFIG } from '../config'
import type { Schedule } from '../types/schedule'

/**
 * Parse schedule list items from HTML content
 * @param html - HTML content from M-League website
 * @returns Array of list item HTML strings
 */
function parseScheduleListItems(html: string): string[] {
  const items: string[] = []
  const listRegex = M_LEAGUE_CONFIG.regex.listItem
  let match

  while ((match = listRegex.exec(html)) !== null) {
    items.push(match[0])
  }

  return items
}

/**
 * Parse date from list item HTML
 * @param listContent - HTML content of a single list item
 * @param year - Year for the schedule
 * @returns Date string in YYYY-MM-DD format, or null if not found
 */
function parseDate(listContent: string, year: number): string | null {
  const dateMatch = listContent.match(M_LEAGUE_CONFIG.regex.date)
  if (!dateMatch) return null

  const monthStr = dateMatch[1].padStart(2, '0')
  const dayStr = dateMatch[2].padStart(2, '0')
  return `${year}-${monthStr}-${dayStr}`
}

/**
 * Parse team names from list item HTML
 * @param listContent - HTML content of a single list item
 * @returns Array of team names
 */
function parseTeams(listContent: string): string[] {
  const teams: string[] = []
  const teamRegex = M_LEAGUE_CONFIG.regex.team
  let match

  while ((match = teamRegex.exec(listContent)) !== null) {
    const teamName = match[1].trim()
    if (teamName && !teamName.includes('M.League')) {
      teams.push(teamName)
    }
  }

  return teams
}

/**
 * Parse URL from list item HTML
 * @param listContent - HTML content of a single list item
 * @returns URL string or undefined if not found
 */
function parseUrl(listContent: string): string | undefined {
  const urlMatch = listContent.match(M_LEAGUE_CONFIG.regex.url)
  return urlMatch ? urlMatch[1] : undefined
}

/**
 * Parse M-League schedules from HTML content
 * @param html - HTML content from M-League website
 * @param year - Year for the schedules
 * @returns Array of Schedule objects
 */
export function parseSchedules(html: string, year: number): Schedule[] {
  const listItems = parseScheduleListItems(html)

  return listItems
    .map((listContent) => {
      const date = parseDate(listContent, year)
      if (!date) return null

      const teams = parseTeams(listContent)
      if (teams.length === 0) return null

      const url = parseUrl(listContent)

      return {
        date,
        teams,
        url,
      } as Schedule
    })
    .filter((schedule): schedule is Schedule => schedule !== null)
}

/**
 * Check if HTML contains schedule data
 * @param html - HTML content to check
 * @returns true if schedule data exists
 */
export function hasScheduleData(html: string): boolean {
  return html.includes(M_LEAGUE_CONFIG.selectors.listClass)
}

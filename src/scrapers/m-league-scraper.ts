import { M_LEAGUE_CONFIG } from '../config'
import { hasScheduleData, parseSchedules } from '../parsers/html-parser'
import type { Period, Schedule } from '../types/schedule'

export class MLeagueScraper {
  /**
   * Fetch schedule for a specific month
   * @param year - Year to fetch
   * @param month - Month to fetch
   * @returns Array of Schedule objects
   */
  async fetchMonth(year: number, month: number): Promise<Schedule[]> {
    const url = `${M_LEAGUE_CONFIG.baseUrl}?mly=${year}&mlm=${month}#schedule`

    console.log(`Fetching schedule from: ${url}`)

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const html = await response.text()

      // Check if schedule data exists
      if (!hasScheduleData(html)) {
        console.log(`  No schedule data available for ${year}/${month}`)
        return []
      }

      return parseSchedules(html, year)
    } catch (error) {
      console.log(`  Error fetching schedule for ${year}/${month}:`, error)
      return []
    }
  }

  /**
   * Fetch schedules for all configured periods
   * @returns Array of all Schedule objects
   */
  async fetchAll(): Promise<Schedule[]> {
    const allSchedules: Schedule[] = []

    for (const period of M_LEAGUE_CONFIG.periods) {
      const monthSchedules = await this.fetchMonth(period.year, period.month)
      allSchedules.push(...monthSchedules)
      console.log(
        `  Found ${monthSchedules.length} matches for ${period.year}/${period.month}`,
      )
    }

    return allSchedules
  }

  /**
   * Fetch schedules for custom periods
   * @param periods - Array of Period objects to fetch
   * @returns Array of Schedule objects
   */
  async fetchPeriods(periods: Period[]): Promise<Schedule[]> {
    const allSchedules: Schedule[] = []

    for (const period of periods) {
      const monthSchedules = await this.fetchMonth(period.year, period.month)
      allSchedules.push(...monthSchedules)
      console.log(
        `  Found ${monthSchedules.length} matches for ${period.year}/${period.month}`,
      )
    }

    return allSchedules
  }
}

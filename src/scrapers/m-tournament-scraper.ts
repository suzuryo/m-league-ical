import { M_TOURNAMENT_CONFIG } from '../config-tournament'
import {
  hasTournamentData,
  parseTournamentMatches,
} from '../parsers/tournament-html-parser'
import type { TournamentMatch } from '../types/tournament-match'

export class MTournamentScraper {
  /**
   * Fetch tournament schedule
   * @returns Array of TournamentMatch objects
   */
  async fetch(): Promise<TournamentMatch[]> {
    const url = M_TOURNAMENT_CONFIG.baseUrl

    console.log(`Fetching tournament schedule from: ${url}`)

    try {
      const response = await globalThis.fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const html = await response.text()

      // Check if tournament data exists
      if (!hasTournamentData(html)) {
        console.log('  No tournament data available')
        return []
      }

      return parseTournamentMatches(html, M_TOURNAMENT_CONFIG.year)
    } catch (error) {
      console.log('  Error fetching tournament schedule:', error)
      return []
    }
  }
}

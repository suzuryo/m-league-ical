import { generateICalendar } from './generators/ical-generator'
import { generateTournamentICalendar } from './generators/tournament-ical-generator'
import { parseExtraData } from './parsers/tournament-extra-parser'
import { MLeagueScraper } from './scrapers/m-league-scraper'
import { MTournamentScraper } from './scrapers/m-tournament-scraper'
import { saveToFile } from './utils/file-utils'
import { mergeMatches } from './utils/tournament-merger'

async function fetchMLeague(): Promise<void> {
  console.log('=== M-League ===')
  console.log('Fetching all schedules from 2025/9 to 2026/5...\n')

  const scraper = new MLeagueScraper()
  const schedules = await scraper.fetchAll()

  if (schedules.length === 0) {
    console.log('No M-League schedule data found')
    return
  }

  console.log(`\nTotal: ${schedules.length} M-League matches found\n`)
  const ical = generateICalendar(schedules)
  saveToFile('public/m-league-schedule.ics', ical)
  console.log('- public/m-league-schedule.ics generated')
}

async function fetchMTournament(): Promise<void> {
  console.log('\n=== M-Tournament ===')

  const scraper = new MTournamentScraper()
  const officialMatches = await scraper.fetch()
  const extraMatches = parseExtraData('data/m-tournament-extra.yaml')
  const merged = mergeMatches(officialMatches, extraMatches)

  if (merged.length === 0) {
    console.log('No M-Tournament schedule data found')
    return
  }

  const extraCount = merged.length - officialMatches.length
  console.log(
    `\nTotal: ${merged.length} M-Tournament matches ` +
      `(official: ${officialMatches.length}, extra: ${extraCount})\n`,
  )

  const ical = generateTournamentICalendar(merged)
  saveToFile('public/m-tournament-schedule.ics', ical)
  console.log('- public/m-tournament-schedule.ics generated')
}

async function main() {
  try {
    console.log('Starting schedule fetcher...\n')

    await fetchMLeague()
    await fetchMTournament()

    console.log('\nAll files generated successfully!')
  } catch (error) {
    console.error('Error scraping schedule:', error)
    process.exit(1)
  }
}

void main()

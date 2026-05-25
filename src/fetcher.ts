import { generateICalendar } from './generators/ical-generator'
import { generateTournamentICalendar } from './generators/tournament-ical-generator'
import { MLeagueScraper } from './scrapers/m-league-scraper'
import { MTournamentScraper } from './scrapers/m-tournament-scraper'
import { saveToFile } from './utils/file-utils'

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
  saveToFile('docs/m-league-schedule.ics', ical)
  console.log('- docs/m-league-schedule.ics generated')
}

async function fetchMTournament(): Promise<void> {
  console.log('\n=== M-Tournament ===')

  const scraper = new MTournamentScraper()
  const matches = await scraper.fetch()

  if (matches.length === 0) {
    console.log('No M-Tournament schedule data found')
    return
  }

  console.log(`\nTotal: ${matches.length} M-Tournament matches found\n`)
  const ical = generateTournamentICalendar(matches)
  saveToFile('docs/m-tournament-schedule.ics', ical)
  console.log('- docs/m-tournament-schedule.ics generated')
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

import { generateICalendar } from './generators/ical-generator'
import { MLeagueScraper } from './scrapers/m-league-scraper'
import { saveToFile } from './utils/file-utils'

async function main() {
  try {
    console.log('Starting M-League schedule fetcher...')
    console.log('Fetching all schedules from 2025/9 to 2026/5...\n')

    const scraper = new MLeagueScraper()
    const schedules = await scraper.fetchAll()

    if (schedules.length === 0) {
      console.log('No schedule data found')
    } else {
      console.log(`\nTotal: ${schedules.length} matches found\n`)

      const icalContent = generateICalendar(schedules)

      // Save to docs folder for GitHub Pages
      saveToFile('docs/m-league-schedule.ics', icalContent)

      console.log('\nFiles generated successfully!')
      console.log(
        '- docs/m-league-schedule.ics: GitHub Pages URL for calendar subscription',
      )
    }
  } catch (error) {
    console.error('Error scraping schedule:', error)
    process.exit(1)
  }
}

// ESモジュールのエントリポイント
void main()

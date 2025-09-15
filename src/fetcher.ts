import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseISO } from 'date-fns'
import type { Browser } from 'playwright'
import { chromium } from 'playwright'

interface Schedule {
  date: string
  teams: string[]
  url?: string
}

async function scrapeMLeagueScheduleForMonth(
  browser: Browser,
  year: number,
  month: number,
): Promise<Schedule[]> {
  const page = await browser.newPage()

  try {
    const url = `https://m-league.jp/games/?mly=${year}&mlm=${month}#schedule`

    console.log(`Fetching schedule from: ${url}`)
    await page.goto(url, { waitUntil: 'networkidle' })

    try {
      await page.waitForSelector('.p-gamesSchedule2__list', { timeout: 3000 })
    } catch {
      console.log(`  No schedule data available for ${year}/${month}`)
      return []
    }

    const schedules = await page.evaluate((targetYear: number) => {
      const scheduleData: { date: string; teams: string[]; url?: string }[] = []

      const gameItems = document.querySelectorAll('.p-gamesSchedule2__list')

      gameItems.forEach((item) => {
        const dateElement = item.querySelector('.p-gamesSchedule2__data')
        const teamImages = item.querySelectorAll('.p-gamesSchedule2__logos img')
        const linkElement = item.querySelector('a')

        if (dateElement && teamImages.length > 0) {
          const dateText = dateElement.textContent?.trim() || ''

          const dateMatch = dateText.match(/(\d+)\/(\d+)/)
          if (dateMatch) {
            const month = dateMatch[1].padStart(2, '0')
            const day = dateMatch[2].padStart(2, '0')
            const formattedDate = `${targetYear}-${month}-${day}`

            const teams: string[] = []
            teamImages.forEach((img) => {
              const teamName = img.getAttribute('alt')
              if (teamName && teamName.trim() !== '') {
                teams.push(teamName.trim())
              }
            })

            if (teams.length > 0) {
              const scheduleItem: {
                date: string
                teams: string[]
                url?: string
              } = {
                date: formattedDate,
                teams: teams,
              }

              // Get the URL from the anchor tag
              const url = linkElement?.getAttribute('href')
              if (url) {
                scheduleItem.url = url
              }

              scheduleData.push(scheduleItem)
            }
          }
        }
      })

      return scheduleData
    }, year)

    return schedules
  } finally {
    await page.close()
  }
}

async function scrapeAllMLeagueSchedules(): Promise<Schedule[]> {
  const browser = await chromium.launch({
    headless: true,
  })

  try {
    const allSchedules: Schedule[] = []

    const periods = [
      { year: 2025, month: 9 },
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
    ]

    for (const period of periods) {
      const monthSchedules = await scrapeMLeagueScheduleForMonth(
        browser,
        period.year,
        period.month,
      )
      allSchedules.push(...monthSchedules)
      console.log(
        `  Found ${monthSchedules.length} matches for ${period.year}/${period.month}`,
      )
    }

    return allSchedules
  } finally {
    await browser.close()
  }
}

function generateICalendar(schedules: Schedule[]): string {
  const icalLines: string[] = []

  icalLines.push('BEGIN:VCALENDAR')
  icalLines.push('VERSION:2.0')
  icalLines.push('PRODID:-//M-League Schedule//JP')
  icalLines.push('CALSCALE:GREGORIAN')
  icalLines.push('METHOD:PUBLISH')
  icalLines.push('X-WR-CALNAME:Mリーグ 2025-26 スケジュール')
  icalLines.push('X-WR-TIMEZONE:Asia/Tokyo')

  icalLines.push('BEGIN:VTIMEZONE')
  icalLines.push('TZID:Asia/Tokyo')
  icalLines.push('BEGIN:STANDARD')
  icalLines.push('DTSTART:19700101T000000')
  icalLines.push('TZOFFSETFROM:+0900')
  icalLines.push('TZOFFSETTO:+0900')
  icalLines.push('END:STANDARD')
  icalLines.push('END:VTIMEZONE')

  schedules.forEach((schedule) => {
    const date = parseISO(schedule.date)
    const startYear = date.getFullYear()
    const startMonth = String(date.getMonth() + 1).padStart(2, '0')
    const startDay = String(date.getDate()).padStart(2, '0')

    const uid = `${schedule.date}-${randomUUID()}@m-league.jp`
    const dtStart = `${startYear}${startMonth}${startDay}T190000`
    const dtEnd = `${startYear}${startMonth}${startDay}T240000`

    const summary = schedule.teams.map((team) => `[${team}]`).join('')
    const description = `対戦チーム:\\n${schedule.teams.map((team) => `・${team}`).join('\\n')}`

    icalLines.push('BEGIN:VEVENT')
    icalLines.push(`UID:${uid}`)
    icalLines.push(`DTSTART;TZID=Asia/Tokyo:${dtStart}`)
    icalLines.push(`DTEND;TZID=Asia/Tokyo:${dtEnd}`)
    icalLines.push(`SUMMARY:${summary}`)
    icalLines.push(`DESCRIPTION:${description}`)
    icalLines.push(`LOCATION:${schedule.url || 'ABEMA TV'}`)

    // アラート設定（開始時刻に通知）
    icalLines.push('BEGIN:VALARM')
    icalLines.push('ACTION:DISPLAY')
    icalLines.push('TRIGGER:PT0M')
    icalLines.push(`DESCRIPTION:${summary}`)
    icalLines.push('END:VALARM')

    icalLines.push('END:VEVENT')
  })

  icalLines.push('END:VCALENDAR')

  return icalLines.join('\r\n')
}

function saveToFile(filename: string, content: string): void {
  const filepath = join(process.cwd(), filename)
  writeFileSync(filepath, content, 'utf-8')
  console.log(`Saved to ${filename}`)
}

async function main() {
  try {
    console.log('Starting M-League schedule fetcher...')
    console.log('Fetching all schedules from 2025/9 to 2026/5...\n')

    const schedules = await scrapeAllMLeagueSchedules()

    if (schedules.length === 0) {
      console.log('No schedule data found')
    } else {
      console.log(`\nTotal: ${schedules.length} matches found\n`)

      const icalContent = generateICalendar(schedules)

      // Also save to docs folder for GitHub Pages
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
main()

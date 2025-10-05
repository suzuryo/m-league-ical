import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseISO } from 'date-fns'

interface Schedule {
  date: string
  teams: string[]
  url?: string
}

async function scrapeMLeagueScheduleForMonth(
  year: number,
  month: number,
): Promise<Schedule[]> {
  const url = `https://m-league.jp/games/?mly=${year}&mlm=${month}#schedule`

  console.log(`Fetching schedule from: ${url}`)

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()

    // Check if schedule data exists
    if (!html.includes('p-gamesSchedule2__list')) {
      console.log(`  No schedule data available for ${year}/${month}`)
      return []
    }

    const schedules: Schedule[] = []

    // Parse schedule items - need to be careful with nested li tags
    // Match both finished games (with is-finish class) and upcoming games (without)
    const listRegex =
      /<li class="p-gamesSchedule2__list[^"]*"[^>]*>([\s\S]*?)(?=<li class="p-gamesSchedule2__list|<\/ul>)/g
    let listMatch

    while ((listMatch = listRegex.exec(html)) !== null) {
      const listContent = listMatch[0]

      // Extract date
      const dateMatch = listContent.match(
        /<p class="p-gamesSchedule2__data">(\d+)<span[^>]*>\/[^<]*<\/span>(\d+)/,
      )
      if (!dateMatch) continue

      const monthStr = dateMatch[1].padStart(2, '0')
      const dayStr = dateMatch[2].padStart(2, '0')
      const formattedDate = `${year}-${monthStr}-${dayStr}`

      // Extract teams from img alt attributes
      const teams: string[] = []
      const teamRegex = /<img[^>]*alt="([^"]+)"[^>]*>/g
      let teamMatch

      while ((teamMatch = teamRegex.exec(listContent)) !== null) {
        const teamName = teamMatch[1].trim()
        if (teamName && !teamName.includes('M.League')) {
          teams.push(teamName)
        }
      }

      if (teams.length === 0) continue

      // Extract URL
      const urlMatch = listContent.match(/<a href="([^"]+)"/)
      const gameUrl = urlMatch ? urlMatch[1] : undefined

      schedules.push({
        date: formattedDate,
        teams: teams,
        url: gameUrl,
      })
    }

    return schedules
  } catch (error) {
    console.log(`  Error fetching schedule for ${year}/${month}:`, error)
    return []
  }
}

async function scrapeAllMLeagueSchedules(): Promise<Schedule[]> {
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
      period.year,
      period.month,
    )
    allSchedules.push(...monthSchedules)
    console.log(
      `  Found ${monthSchedules.length} matches for ${period.year}/${period.month}`,
    )
  }

  return allSchedules
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

    // Generate deterministic UID based on date and team names (sorted for consistency)
    const teamHash = createHash('sha256')
      .update(schedule.date + [...schedule.teams].sort().join(','))
      .digest('hex')
      .substring(0, 12)
    const uid = `${schedule.date}-${teamHash}@m-league.jp`
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
    icalLines.push(
      `LOCATION:${schedule.url || 'https://abema.tv/now-on-air/mahjong'}`,
    )

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

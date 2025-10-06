import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { hasScheduleData, parseSchedules } from '../parsers/html-parser'

const FIXTURES_DIR = join(__dirname, './fixtures')

describe('html-parser', () => {
  describe('parseSchedules', () => {
    it('2025年9月のHTMLから正しくスケジュールを抽出する', () => {
      const html = readFileSync(join(FIXTURES_DIR, '2025-09.html'), 'utf-8')
      const schedules = parseSchedules(html, 2025)

      expect(schedules.length).toBe(12)
      expect(schedules[0].date).toBe('2025-09-15')
      expect(schedules[0].teams.length).toBeGreaterThan(0)
    })

    it('2025年10月のHTMLから正しくスケジュールを抽出する', () => {
      const html = readFileSync(join(FIXTURES_DIR, '2025-10.html'), 'utf-8')
      const schedules = parseSchedules(html, 2025)

      expect(schedules.length).toBe(28)
    })

    it('2026年1月のHTMLから正しくスケジュールを抽出する', () => {
      const html = readFileSync(join(FIXTURES_DIR, '2026-01.html'), 'utf-8')
      const schedules = parseSchedules(html, 2026)

      expect(schedules.length).toBe(24)
    })

    it('スケジュールがない月(2026年4月)は空配列を返す', () => {
      const html = readFileSync(join(FIXTURES_DIR, '2026-04.html'), 'utf-8')
      const schedules = parseSchedules(html, 2026)

      expect(schedules.length).toBe(0)
    })

    it('全期間で合計150試合のスケジュールを抽出する', () => {
      const files = [
        '2025-09.html',
        '2025-10.html',
        '2025-11.html',
        '2025-12.html',
        '2026-01.html',
        '2026-02.html',
        '2026-03.html',
        '2026-04.html',
        '2026-05.html',
      ]

      let total = 0
      files.forEach((file) => {
        const html = readFileSync(join(FIXTURES_DIR, file), 'utf-8')
        const year = file.startsWith('2026') ? 2026 : 2025
        const schedules = parseSchedules(html, year)
        total += schedules.length
      })

      expect(total).toBe(150)
    })

    it('抽出したスケジュールが正しい形式を持つ', () => {
      const html = readFileSync(join(FIXTURES_DIR, '2025-09.html'), 'utf-8')
      const schedules = parseSchedules(html, 2025)

      schedules.forEach((schedule) => {
        expect(schedule.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(Array.isArray(schedule.teams)).toBe(true)
        expect(schedule.teams.length).toBeGreaterThan(0)
        if (schedule.url) {
          expect(schedule.url).toMatch(/^https?:\/\//)
        }
      })
    })

    it('空のHTMLから空の配列を返す', () => {
      const html = '<html><body></body></html>'
      const schedules = parseSchedules(html, 2025)

      expect(schedules).toEqual([])
    })

    it('日付情報のないリストアイテムをスキップする', () => {
      const html = `
        <ul>
          <li class="p-gamesSchedule2__list">
            <div class="p-gamesSchedule2__teams">
              <img src="/team1.png" alt="チームA" />
            </div>
          </li>
        </ul>
      `
      const schedules = parseSchedules(html, 2025)

      expect(schedules).toEqual([])
    })

    it('チーム情報のないリストアイテムをスキップする', () => {
      const html = `
        <ul>
          <li class="p-gamesSchedule2__list">
            <p class="p-gamesSchedule2__data">9<span class="u-slash">/</span>2</p>
          </li>
        </ul>
      `
      const schedules = parseSchedules(html, 2025)

      expect(schedules).toEqual([])
    })

    it('1桁の月日を2桁にゼロパディングする', () => {
      const html = `
        <ul>
          <li class="p-gamesSchedule2__list">
            <p class="p-gamesSchedule2__data">1<span class="u-slash">/</span>5</p>
            <div class="p-gamesSchedule2__teams">
              <img src="/team1.png" alt="チームA" />
            </div>
          </li>
        </ul>
      `
      const schedules = parseSchedules(html, 2026)

      expect(schedules).toHaveLength(1)
      expect(schedules[0].date).toBe('2026-01-05')
    })

    it('M.Leagueを含むチーム名を除外する', () => {
      const html = `
        <ul>
          <li class="p-gamesSchedule2__list">
            <p class="p-gamesSchedule2__data">9<span class="u-slash">/</span>2</p>
            <div class="p-gamesSchedule2__teams">
              <img src="/team1.png" alt="M.League公式" />
              <img src="/team2.png" alt="チームA" />
              <img src="/team3.png" alt="チームB" />
            </div>
          </li>
        </ul>
      `
      const schedules = parseSchedules(html, 2025)

      expect(schedules).toHaveLength(1)
      expect(schedules[0].teams).toEqual(['チームA', 'チームB'])
    })

    it('複数の試合を正しく処理する', () => {
      const html = `
        <ul>
          <li class="p-gamesSchedule2__list">
            <p class="p-gamesSchedule2__data">9<span class="u-slash">/</span>2</p>
            <img src="/team1.png" alt="チームA" />
          </li>
          <li class="p-gamesSchedule2__list">
            <p class="p-gamesSchedule2__data">9<span class="u-slash">/</span>3</p>
            <img src="/team2.png" alt="チームB" />
          </li>
          <li class="p-gamesSchedule2__list">
            <p class="p-gamesSchedule2__data">9<span class="u-slash">/</span>4</p>
            <img src="/team3.png" alt="チームC" />
          </li>
        </ul>
      `
      const schedules = parseSchedules(html, 2025)

      expect(schedules).toHaveLength(3)
      expect(schedules.map((s) => s.date)).toEqual([
        '2025-09-02',
        '2025-09-03',
        '2025-09-04',
      ])
    })
  })

  describe('hasScheduleData', () => {
    it('スケジュールデータが含まれる場合にtrueを返す', () => {
      const html = '<div class="p-gamesSchedule2__list">Content</div>'
      expect(hasScheduleData(html)).toBe(true)
    })

    it('スケジュールデータが含まれない場合にfalseを返す', () => {
      const html = '<div class="other-class">Content</div>'
      expect(hasScheduleData(html)).toBe(false)
    })

    it('空のHTMLに対してfalseを返す', () => {
      const html = ''
      expect(hasScheduleData(html)).toBe(false)
    })

    it('実際のHTMLファイルでスケジュールの有無を正しく判定する', () => {
      const html2025_09 = readFileSync(
        join(FIXTURES_DIR, '2025-09.html'),
        'utf-8',
      )
      const html2026_04 = readFileSync(
        join(FIXTURES_DIR, '2026-04.html'),
        'utf-8',
      )

      expect(hasScheduleData(html2025_09)).toBe(true)
      expect(hasScheduleData(html2026_04)).toBe(true) // HTMLにはクラスが存在するがデータがない
    })
  })
})

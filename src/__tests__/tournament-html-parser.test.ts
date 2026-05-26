import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  hasTournamentData,
  parseTournamentMatches,
} from '../parsers/tournament-html-parser'

const FIXTURES_DIR = join(__dirname, './fixtures')
const FIXTURE_HTML = readFileSync(
  join(FIXTURES_DIR, 'm-tournament.html'),
  'utf-8',
)

describe('tournament-html-parser', () => {
  describe('parseTournamentMatches', () => {
    it('フィクスチャから29試合を抽出する', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      expect(matches.length).toBe(29)
    })

    it('FINAL STAGEの試合が含まれている', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      const finalMatches = matches.filter(
        (m) =>
          m.stage === 'FINAL' ||
          m.stage === 'FINAL STAGE' ||
          m.stage === 'SEMIFINAL',
      )
      expect(finalMatches.length).toBe(7)
    })

    it('予選1st/2ndの試合が含まれている', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      const qualifierMatches = matches.filter(
        (m) => m.stage === '予選1st' || m.stage === '予選2nd',
      )
      expect(qualifierMatches.length).toBe(22)
    })

    it('FINALSTAGEはFINAL STAGEに正規化される', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      const hasFinalStage = matches.some((m) => m.stage === 'FINAL STAGE')
      const hasUnnormalized = matches.some((m) => m.stage === 'FINALSTAGE')
      expect(hasFinalStage).toBe(true)
      expect(hasUnnormalized).toBe(false)
    })

    it('全試合で必須項目(date, players)が揃っている', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      for (const match of matches) {
        expect(match.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(match.players.length).toBeGreaterThan(0)
      }
    })

    it('各試合に4名の選手が含まれている', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      for (const match of matches) {
        expect(match.players.length).toBe(4)
      }
    })

    it('FINAL STAGE系の試合は時刻情報を保持する', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      const finalMatches = matches.filter(
        (m) =>
          m.stage === 'FINAL' ||
          m.stage === 'FINAL STAGE' ||
          m.stage === 'SEMIFINAL',
      )
      // フィクスチャ実態は 19:00 開始と 15:00 開始の混在。
      // どちらも HTML 由来の時刻として 6 桁のフォーマットで保持されていることを検証する。
      for (const match of finalMatches) {
        expect(match.startTime).toMatch(/^(190000|150000)$/)
      }
    })

    it('予選系の試合はdefaultStartTimeを使う', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      const qualifierMatches = matches.filter(
        (m) => m.stage === '予選1st' || m.stage === '予選2nd',
      )
      for (const match of qualifierMatches) {
        expect(match.startTime).toBe('190000')
      }
    })

    it('endTimeはstartTimeから3時間30分後', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      for (const match of matches) {
        if (match.startTime === '190000') {
          expect(match.endTime).toBe('223000')
        } else if (match.startTime === '150000') {
          expect(match.endTime).toBe('183000')
        }
      }
    })

    it('指定した年が日付に反映される', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)

      for (const match of matches) {
        expect(match.date.startsWith('2026-')).toBe(true)
      }
    })

    it('視聴URLが取得できる試合がある', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      const withUrl = matches.filter((m) => m.url !== undefined)
      expect(withUrl.length).toBeGreaterThan(0)
    })

    it('URLは末尾の空白がtrimされている', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      for (const match of matches) {
        if (match.url !== undefined) {
          expect(match.url).toBe(match.url.trim())
        }
      }
    })

    it('空のHTMLに対しては空配列を返す', () => {
      const matches = parseTournamentMatches('<html></html>', 2025)
      expect(matches).toEqual([])
    })
  })

  describe('hasTournamentData', () => {
    it('フィクスチャHTMLに対してtrueを返す', () => {
      expect(hasTournamentData(FIXTURE_HTML)).toBe(true)
    })

    it('FINAL STAGEクラスを含むHTMLに対してtrueを返す', () => {
      const html = '<li class="c-schedule__list">...</li>'
      expect(hasTournamentData(html)).toBe(true)
    })

    it('予選クラスを含むHTMLに対してtrueを返す', () => {
      const html = '<li class="p-gamesSchedule2__list">...</li>'
      expect(hasTournamentData(html)).toBe(true)
    })

    it('試合データを含まないHTMLに対してfalseを返す', () => {
      expect(hasTournamentData('<html><body></body></html>')).toBe(false)
    })
  })
})

import { describe, expect, it } from 'vitest'

import type { Schedule } from '../types/schedule'
import type { TournamentMatch } from '../types/tournament-match'
import {
  formatDateTime,
  generateTournamentUid,
  generateUid,
} from '../utils/calendar-utils'

describe('calendar-utils', () => {
  describe('generateUid', () => {
    it('同じスケジュールに対して常に同じUIDを生成する', () => {
      const schedule: Schedule = {
        date: '2025-09-02',
        teams: [
          '赤坂ドリブンズ',
          '渋谷ABEMAS',
          'KONAMI麻雀格闘倶楽部',
          'セガサミーフェニックス',
        ],
        url: 'https://abema.tv/test',
      }

      const uid1 = generateUid(schedule)
      const uid2 = generateUid(schedule)

      expect(uid1).toBe(uid2)
      expect(uid1).toMatch(/^2025-09-02-[a-f0-9]{12}@m-league\.jp$/)
    })

    it('チームの順序が異なっても同じUIDを生成する', () => {
      const schedule1: Schedule = {
        date: '2025-09-02',
        teams: ['チームA', 'チームB', 'チームC', 'チームD'],
      }

      const schedule2: Schedule = {
        date: '2025-09-02',
        teams: ['チームD', 'チームC', 'チームB', 'チームA'],
      }

      expect(generateUid(schedule1)).toBe(generateUid(schedule2))
    })

    it('日付が異なると異なるUIDを生成する', () => {
      const schedule1: Schedule = {
        date: '2025-09-02',
        teams: ['チームA', 'チームB'],
      }

      const schedule2: Schedule = {
        date: '2025-09-03',
        teams: ['チームA', 'チームB'],
      }

      expect(generateUid(schedule1)).not.toBe(generateUid(schedule2))
    })

    it('チームが異なると異なるUIDを生成する', () => {
      const schedule1: Schedule = {
        date: '2025-09-02',
        teams: ['チームA', 'チームB'],
      }

      const schedule2: Schedule = {
        date: '2025-09-02',
        teams: ['チームC', 'チームD'],
      }

      expect(generateUid(schedule1)).not.toBe(generateUid(schedule2))
    })

    it('URLの有無はUIDに影響しない', () => {
      const schedule1: Schedule = {
        date: '2025-09-02',
        teams: ['チームA', 'チームB'],
      }

      const schedule2: Schedule = {
        date: '2025-09-02',
        teams: ['チームA', 'チームB'],
        url: 'https://example.com',
      }

      expect(generateUid(schedule1)).toBe(generateUid(schedule2))
    })
  })

  describe('generateTournamentUid', () => {
    it('同じ試合に対して常に同じUIDを生成する', () => {
      const match: TournamentMatch = {
        date: '2026-07-28',
        startTime: '190000',
        endTime: '235959',
        stage: 'FINAL STAGE',
        table: 'A卓',
        players: ['小林剛', '伊達朱里紗', '佐々木寿人', '堀慎吾'],
      }

      const uid1 = generateTournamentUid(match)
      const uid2 = generateTournamentUid(match)

      expect(uid1).toBe(uid2)
      expect(uid1).toMatch(
        /^2026-07-28-[a-f0-9]{12}@m-tournament\.m-league\.jp$/,
      )
    })

    it('選手の順序が異なっても同じUIDを生成する', () => {
      const match1: TournamentMatch = {
        date: '2026-07-28',
        startTime: '190000',
        endTime: '235959',
        stage: 'FINAL STAGE',
        table: 'A卓',
        players: ['A', 'B', 'C', 'D'],
      }
      const match2: TournamentMatch = {
        ...match1,
        players: ['D', 'C', 'B', 'A'],
      }

      expect(generateTournamentUid(match1)).toBe(generateTournamentUid(match2))
    })

    it('卓が異なれば異なるUIDを生成する', () => {
      const base: TournamentMatch = {
        date: '2026-07-28',
        startTime: '190000',
        endTime: '235959',
        stage: 'FINAL STAGE',
        table: 'A卓',
        players: ['A', 'B', 'C', 'D'],
      }
      const other: TournamentMatch = { ...base, table: 'B卓' }

      expect(generateTournamentUid(base)).not.toBe(generateTournamentUid(other))
    })

    it('ステージが異なれば異なるUIDを生成する', () => {
      const base: TournamentMatch = {
        date: '2026-07-28',
        startTime: '190000',
        endTime: '235959',
        stage: 'FINAL STAGE',
        table: 'A卓',
        players: ['A', 'B', 'C', 'D'],
      }
      const other: TournamentMatch = { ...base, stage: '予選1st' }

      expect(generateTournamentUid(base)).not.toBe(generateTournamentUid(other))
    })

    it('URLの有無はUIDに影響しない', () => {
      const base: TournamentMatch = {
        date: '2026-07-28',
        startTime: '190000',
        endTime: '235959',
        stage: 'FINAL STAGE',
        table: 'A卓',
        players: ['A', 'B', 'C', 'D'],
      }
      const other: TournamentMatch = { ...base, url: 'https://example.com' }

      expect(generateTournamentUid(base)).toBe(generateTournamentUid(other))
    })
  })

  describe('formatDateTime', () => {
    it('日付文字列と時刻文字列を正しくフォーマットする', () => {
      const result = formatDateTime('2025-09-02', '190000')
      expect(result).toBe('20250902T190000')
    })

    it('1桁の月日を正しく処理する', () => {
      const result = formatDateTime('2025-01-05', '235959')
      expect(result).toBe('20250105T235959')
    })

    it('年末年始の日付を正しく処理する', () => {
      const result1 = formatDateTime('2025-12-31', '190000')
      const result2 = formatDateTime('2026-01-01', '190000')

      expect(result1).toBe('20251231T190000')
      expect(result2).toBe('20260101T190000')
    })

    it('異なる時刻形式を正しく処理する', () => {
      const result1 = formatDateTime('2025-09-02', '000000')
      const result2 = formatDateTime('2025-09-02', '123456')

      expect(result1).toBe('20250902T000000')
      expect(result2).toBe('20250902T123456')
    })
  })
})

import { describe, expect, it } from 'vitest'

import type { Schedule } from '../types/schedule'
import { formatDateTime, generateUid } from '../utils/calendar-utils'

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

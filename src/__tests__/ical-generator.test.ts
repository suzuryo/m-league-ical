import { describe, expect, it } from 'vitest'

import { generateICalendar } from '../generators/ical-generator'
import type { Schedule } from '../types/schedule'

describe('ical-generator', () => {
  describe('generateICalendar', () => {
    it('単一のスケジュールから正しいiCalendarを生成する', () => {
      const schedules: Schedule[] = [
        {
          date: '2025-09-02',
          teams: ['赤坂ドリブンズ', '渋谷ABEMAS'],
          url: 'https://abema.tv/test',
        },
      ]

      const ical = generateICalendar(schedules)

      expect(ical).toContain('BEGIN:VCALENDAR')
      expect(ical).toContain('VERSION:2.0')
      expect(ical).toContain('PRODID:-//M-League Schedule//JP')
      expect(ical).toContain('X-WR-CALNAME:Mリーグ 2025-26 スケジュール')
      expect(ical).toContain('X-WR-TIMEZONE:Asia/Tokyo')
      expect(ical).toContain('BEGIN:VTIMEZONE')
      expect(ical).toContain('TZID:Asia/Tokyo')
      expect(ical).toContain('BEGIN:VEVENT')
      expect(ical).toContain('SUMMARY:[赤坂ドリブンズ][渋谷ABEMAS]')
      expect(ical).toContain('DTSTART;TZID=Asia/Tokyo:20250902T190000')
      expect(ical).toContain('DTEND;TZID=Asia/Tokyo:20250902T235959')
      expect(ical).toContain('LOCATION:https://abema.tv/test')
      expect(ical).toContain(
        'DESCRIPTION:対戦チーム:\\n・赤坂ドリブンズ\\n・渋谷ABEMAS',
      )
      expect(ical).toContain('BEGIN:VALARM')
      expect(ical).toContain('ACTION:DISPLAY')
      expect(ical).toContain('TRIGGER:PT0M')
      expect(ical).toContain('END:VALARM')
      expect(ical).toContain('END:VEVENT')
      expect(ical).toContain('END:VCALENDAR')
    })

    it('URLが未定義の場合はデフォルトURLを使用する', () => {
      const schedules: Schedule[] = [
        {
          date: '2025-09-02',
          teams: ['チームA', 'チームB'],
        },
      ]

      const ical = generateICalendar(schedules)

      expect(ical).toContain('LOCATION:https://abema.tv/now-on-air/mahjong')
    })

    it('複数のスケジュールから複数のイベントを生成する', () => {
      const schedules: Schedule[] = [
        {
          date: '2025-09-02',
          teams: ['チームA', 'チームB'],
        },
        {
          date: '2025-09-03',
          teams: ['チームC', 'チームD'],
        },
      ]

      const ical = generateICalendar(schedules)

      const eventCount = (ical.match(/BEGIN:VEVENT/g) || []).length
      expect(eventCount).toBe(2)

      expect(ical).toContain('SUMMARY:[チームA][チームB]')
      expect(ical).toContain('SUMMARY:[チームC][チームD]')
      expect(ical).toContain('DTSTART;TZID=Asia/Tokyo:20250902T190000')
      expect(ical).toContain('DTSTART;TZID=Asia/Tokyo:20250903T190000')
    })

    it('4チームの対戦を正しく処理する', () => {
      const schedules: Schedule[] = [
        {
          date: '2025-09-02',
          teams: ['チームA', 'チームB', 'チームC', 'チームD'],
        },
      ]

      const ical = generateICalendar(schedules)

      expect(ical).toContain('SUMMARY:[チームA][チームB][チームC][チームD]')
      expect(ical).toContain(
        'DESCRIPTION:対戦チーム:\\n・チームA\\n・チームB\\n・チームC\\n・チームD',
      )
    })

    it('空の配列から有効なiCalendarを生成する', () => {
      const schedules: Schedule[] = []

      const ical = generateICalendar(schedules)

      expect(ical).toContain('BEGIN:VCALENDAR')
      expect(ical).toContain('END:VCALENDAR')
      expect(ical).not.toContain('BEGIN:VEVENT')
    })

    it('改行コードがCRLFであることを確認する', () => {
      const schedules: Schedule[] = [
        {
          date: '2025-09-02',
          teams: ['チームA'],
        },
      ]

      const ical = generateICalendar(schedules)

      expect(ical).toContain('\r\n')
      expect(ical.split('\r\n').length).toBeGreaterThan(1)
    })

    it('各イベントに一意のUIDが設定される', () => {
      const schedules: Schedule[] = [
        {
          date: '2025-09-02',
          teams: ['チームA', 'チームB'],
        },
        {
          date: '2025-09-03',
          teams: ['チームC', 'チームD'],
        },
      ]

      const ical = generateICalendar(schedules)

      const uidMatches = ical.match(/UID:([^\r\n]+)/g)
      expect(uidMatches).toHaveLength(2)

      const uids = uidMatches
        ? uidMatches.map((m) => m.replace('UID:', ''))
        : []
      expect(uids[0]).not.toBe(uids[1])
      expect(uids[0]).toMatch(/^2025-09-02-[a-f0-9]{12}@m-league\.jp$/)
      expect(uids[1]).toMatch(/^2025-09-03-[a-f0-9]{12}@m-league\.jp$/)
    })

    it('タイムゾーン情報が正しく設定される', () => {
      const schedules: Schedule[] = [
        {
          date: '2025-09-02',
          teams: ['チームA'],
        },
      ]

      const ical = generateICalendar(schedules)

      expect(ical).toContain('BEGIN:VTIMEZONE')
      expect(ical).toContain('TZID:Asia/Tokyo')
      expect(ical).toContain('TZOFFSETFROM:+0900')
      expect(ical).toContain('TZOFFSETTO:+0900')
      expect(ical).toContain('END:VTIMEZONE')
    })
  })
})

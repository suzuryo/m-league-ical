import { describe, expect, it } from 'vitest'

import { generateTournamentICalendar } from '../generators/tournament-ical-generator'
import type { TournamentMatch } from '../types/tournament-match'

describe('tournament-ical-generator', () => {
  describe('generateTournamentICalendar', () => {
    it('単一の試合から正しいiCalendarを生成する', () => {
      const matches: TournamentMatch[] = [
        {
          date: '2026-07-28',
          startTime: '190000',
          endTime: '235959',
          stage: 'FINAL STAGE',
          table: 'A卓',
          players: ['小林剛', '伊達朱里紗', '佐々木寿人', '堀慎吾'],
          url: 'https://abema.tv/test',
        },
      ]

      const ical = generateTournamentICalendar(matches)

      expect(ical).toContain('BEGIN:VCALENDAR')
      expect(ical).toContain('VERSION:2.0')
      expect(ical).toContain('PRODID:-//M-Tournament Schedule//JP')
      expect(ical).toContain('X-WR-CALNAME:Mトーナメント 2025-26 スケジュール')
      expect(ical).toContain('X-WR-TIMEZONE:Asia/Tokyo')
      expect(ical).toContain('BEGIN:VTIMEZONE')
      expect(ical).toContain('TZID:Asia/Tokyo')
      expect(ical).toContain('BEGIN:VEVENT')
      expect(ical).toContain(
        'SUMMARY:[FINAL STAGE][A卓][小林剛][伊達朱里紗][佐々木寿人][堀慎吾]',
      )
      expect(ical).toContain('DTSTART;TZID=Asia/Tokyo:20260728T190000')
      expect(ical).toContain('DTEND;TZID=Asia/Tokyo:20260728T235959')
      expect(ical).toContain('LOCATION:https://abema.tv/test')
      expect(ical).toContain(
        'DESCRIPTION:対戦選手:\\n・小林剛\\n・伊達朱里紗\\n・佐々木寿人\\n・堀慎吾',
      )
      expect(ical).toContain('BEGIN:VALARM')
      expect(ical).toContain('ACTION:DISPLAY')
      expect(ical).toContain('TRIGGER:PT0M')
      expect(ical).toContain('END:VALARM')
      expect(ical).toContain('END:VEVENT')
      expect(ical).toContain('END:VCALENDAR')
    })

    it('URLが未定義の場合はデフォルトURLを使用する', () => {
      const matches: TournamentMatch[] = [
        {
          date: '2026-07-28',
          startTime: '190000',
          endTime: '235959',
          stage: 'FINAL STAGE',
          table: 'A卓',
          players: ['A', 'B', 'C', 'D'],
        },
      ]

      const ical = generateTournamentICalendar(matches)

      expect(ical).toContain('LOCATION:https://abema.tv/now-on-air/mahjong')
    })

    it('複数の試合から複数のVEVENTを生成する', () => {
      const matches: TournamentMatch[] = [
        {
          date: '2026-07-28',
          startTime: '190000',
          endTime: '235959',
          stage: '予選1st',
          table: 'A卓',
          players: ['A', 'B', 'C', 'D'],
        },
        {
          date: '2026-07-29',
          startTime: '150000',
          endTime: '235959',
          stage: '予選1st',
          table: 'B卓',
          players: ['E', 'F', 'G', 'H'],
        },
      ]

      const ical = generateTournamentICalendar(matches)

      const eventCount = (ical.match(/BEGIN:VEVENT/g) || []).length
      expect(eventCount).toBe(2)

      expect(ical).toContain('SUMMARY:[予選1st][A卓][A][B][C][D]')
      expect(ical).toContain('SUMMARY:[予選1st][B卓][E][F][G][H]')
      expect(ical).toContain('DTSTART;TZID=Asia/Tokyo:20260728T190000')
      expect(ical).toContain('DTSTART;TZID=Asia/Tokyo:20260729T150000')
    })

    it('空配列を渡すとイベントなしのVCALENDARを返す', () => {
      const ical = generateTournamentICalendar([])

      expect(ical).toContain('BEGIN:VCALENDAR')
      expect(ical).toContain('END:VCALENDAR')
      expect(ical).not.toContain('BEGIN:VEVENT')
    })

    it('UIDが試合ごとに含まれる', () => {
      const matches: TournamentMatch[] = [
        {
          date: '2026-07-28',
          startTime: '190000',
          endTime: '235959',
          stage: 'FINAL STAGE',
          table: 'A卓',
          players: ['A', 'B', 'C', 'D'],
        },
      ]

      const ical = generateTournamentICalendar(matches)

      expect(ical).toMatch(/UID:2026-07-28-[a-f0-9]{12}@m-tournament\.jp/)
    })

    it('開始時刻が試合ごとに異なる場合も正しく出力する', () => {
      const matches: TournamentMatch[] = [
        {
          date: '2026-07-28',
          startTime: '150000',
          endTime: '235959',
          stage: 'FINAL STAGE',
          table: 'A卓',
          players: ['A', 'B', 'C', 'D'],
        },
      ]

      const ical = generateTournamentICalendar(matches)

      expect(ical).toContain('DTSTART;TZID=Asia/Tokyo:20260728T150000')
    })

    it('卓名が空文字でもVEVENTが生成される（FINAL想定）', () => {
      const matches: TournamentMatch[] = [
        {
          date: '2026-07-28',
          startTime: '190000',
          endTime: '235959',
          stage: 'FINAL',
          table: '',
          players: ['A', 'B', 'C', 'D'],
        },
      ]

      const ical = generateTournamentICalendar(matches)

      // 卓部分は空のブラケットや欠落でも、stage と players は出る
      expect(ical).toContain('[FINAL]')
      expect(ical).toContain('[A]')
    })
  })
})

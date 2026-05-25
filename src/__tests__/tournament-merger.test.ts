import { describe, expect, it } from 'vitest'

import type { TournamentMatch } from '../types/tournament-match'
import { mergeMatches } from '../utils/tournament-merger'

function makeMatch(overrides: Partial<TournamentMatch> = {}): TournamentMatch {
  return {
    date: '2026-08-15',
    startTime: '190000',
    endTime: '235959',
    stage: '予選1st',
    table: 'A卓',
    players: ['A', 'B', 'C', 'D'],
    ...overrides,
  }
}

describe('tournament-merger', () => {
  describe('mergeMatches', () => {
    it('両方空なら空配列を返す', () => {
      expect(mergeMatches([], [])).toEqual([])
    })

    it('公式のみなら公式をそのまま返す', () => {
      const official = [makeMatch()]
      expect(mergeMatches(official, [])).toEqual(official)
    })

    it('補助のみなら補助をそのまま返す', () => {
      const extra = [makeMatch()]
      expect(mergeMatches([], extra)).toEqual(extra)
    })

    it('重複なし(date違い)では両方を含む', () => {
      const official = [makeMatch({ date: '2026-08-15' })]
      const extra = [makeMatch({ date: '2026-08-20' })]

      const merged = mergeMatches(official, extra)
      expect(merged.length).toBe(2)
    })

    it('重複なし(stage違い)では両方を含む', () => {
      const official = [makeMatch({ stage: '予選1st' })]
      const extra = [makeMatch({ stage: '予選2nd' })]

      const merged = mergeMatches(official, extra)
      expect(merged.length).toBe(2)
    })

    it('重複なし(table違い)では両方を含む', () => {
      const official = [makeMatch({ table: 'A卓' })]
      const extra = [makeMatch({ table: 'B卓' })]

      const merged = mergeMatches(official, extra)
      expect(merged.length).toBe(2)
    })

    it('完全重複の場合は公式を残し補助を捨てる', () => {
      const official = [
        makeMatch({
          players: ['official1', 'official2', 'official3', 'official4'],
        }),
      ]
      const extra = [
        makeMatch({ players: ['extra1', 'extra2', 'extra3', 'extra4'] }),
      ]

      const merged = mergeMatches(official, extra)
      expect(merged.length).toBe(1)
      expect(merged[0].players).toEqual([
        'official1',
        'official2',
        'official3',
        'official4',
      ])
    })

    it('結果は日付順にソートされる', () => {
      const official = [
        makeMatch({ date: '2026-09-01', table: 'A卓' }),
        makeMatch({ date: '2026-08-15', table: 'A卓' }),
      ]
      const extra = [makeMatch({ date: '2026-08-20', table: 'B卓' })]

      const merged = mergeMatches(official, extra)
      expect(merged.map((m) => m.date)).toEqual([
        '2026-08-15',
        '2026-08-20',
        '2026-09-01',
      ])
    })

    it('同日内ではstartTime順にソートされる', () => {
      const official = [
        makeMatch({ date: '2026-08-15', table: 'A卓', startTime: '190000' }),
        makeMatch({ date: '2026-08-15', table: 'B卓', startTime: '150000' }),
      ]

      const merged = mergeMatches(official, [])
      expect(merged.map((m) => m.startTime)).toEqual(['150000', '190000'])
    })

    it('table空文字でも重複判定できる', () => {
      const official = [makeMatch({ stage: 'FINAL', table: '' })]
      const extra = [makeMatch({ stage: 'FINAL', table: '' })]

      const merged = mergeMatches(official, extra)
      expect(merged.length).toBe(1)
    })
  })
})

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
  describe('parseTournamentMatches (2026 fixture)', () => {
    it('全35試合を抽出する (確定16 + 未定19)', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      expect(matches.length).toBe(35)
    })

    it('出場者ありは予選1stの16試合で全て4名', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      const withPlayers = matches.filter((m) => m.players.length > 0)
      expect(withPlayers.length).toBe(16)
      for (const m of withPlayers) {
        expect(m.stage).toBe('予選1st')
        expect(m.players.length).toBe(4)
      }
    })

    it('出場者未定の19試合はplayers空でイベント化される', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      const empty = matches.filter((m) => m.players.length === 0)
      expect(empty.length).toBe(19)
    })

    it('FINAL系7試合は出場者未定で時刻はサイト由来(15:00/19:00)', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      const fin = matches.filter((m) =>
        ['FINAL', 'FINAL STAGE', 'SEMIFINAL'].includes(m.stage),
      )
      expect(fin.length).toBe(7)
      for (const m of fin) {
        expect(m.players.length).toBe(0)
        expect(m.startTime).toMatch(/^(150000|190000)$/)
      }
    })

    it('FINALSTAGEはFINAL STAGEに正規化される', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      expect(matches.some((m) => m.stage === 'FINAL STAGE')).toBe(true)
      expect(matches.some((m) => m.stage === 'FINALSTAGE')).toBe(false)
    })

    it('予選は同日1番目が15:00・2番目が19:00', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      const a = matches.find(
        (m) =>
          m.stage === '予選1st' && m.table === 'A卓' && m.date === '2026-06-01',
      )
      const b = matches.find(
        (m) =>
          m.stage === '予選1st' && m.table === 'B卓' && m.date === '2026-06-01',
      )
      expect(a?.startTime).toBe('150000')
      expect(b?.startTime).toBe('190000')
    })

    it('endTimeはstartTime+3時間30分', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      for (const m of matches) {
        if (m.startTime === '150000') expect(m.endTime).toBe('183000')
        if (m.startTime === '190000') expect(m.endTime).toBe('223000')
      }
    })

    it('全試合が日付フォーマットを持つ', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      for (const m of matches) {
        expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })

    it('指定した年が日付に反映される', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      for (const m of matches) {
        expect(m.date.startsWith('2026-')).toBe(true)
      }
    })

    it('視聴URLが取得できる試合がある', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      expect(matches.filter((m) => m.url !== undefined).length).toBeGreaterThan(
        0,
      )
    })

    it('URLは末尾の空白がtrimされている', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)
      for (const m of matches) {
        if (m.url !== undefined) expect(m.url).toBe(m.url.trim())
      }
    })

    it('空のHTMLに対しては空配列を返す', () => {
      expect(parseTournamentMatches('<html></html>', 2026)).toEqual([])
    })
  })

  describe('予選の位置ベース時刻ルール (合成HTML)', () => {
    const qCard = (table: string) =>
      `<li class="p-gamesSchedule2__list"><p class="p-gamesSchedule2__data">予選1st</p><p class="p-gamesSchedule2__data">${table}</p><p><span style="font-size:24px;">8/1</span></p><ul class="p-gamesSchedule2__logos"><li><img alt="x"></li></ul></li>`

    it('同日3試合以上はエラーを投げる', () => {
      const html = `<ul>${qCard('A卓')}${qCard('B卓')}${qCard('C卓')}</ul>`
      expect(() => parseTournamentMatches(html, 2026)).toThrow(
        /Unexpected 3rd\+ qualifier match on 2026-08-01 \(stage=予選1st, table=C卓\)/,
      )
    })
  })

  describe('FINAL系の合成HTML (上書きで失う旧カバレッジ補完)', () => {
    it('<div>ラッパー + 出場者あり + 時刻を抽出する', () => {
      const html = `<ol><li class="c-schedule__list"><div class="c-schedule__date">FINALSTAGE<br>A卓</div><span>7/27</span> (月) <span>15:00</span><ul class="c-schedule__logos"><li><img alt="選手1"></li><li><img alt="選手2"></li><li><img alt="選手3"></li><li><img alt="選手4"></li></ul><button onclick="window.open('https://example.com/x');">視聴</button></li></ol>`
      const matches = parseTournamentMatches(html, 2026)
      expect(matches).toHaveLength(1)
      expect(matches[0]).toMatchObject({
        date: '2026-07-27',
        startTime: '150000',
        endTime: '183000',
        stage: 'FINAL STAGE',
        table: 'A卓',
        players: ['選手1', '選手2', '選手3', '選手4'],
        url: 'https://example.com/x',
      })
    })

    it('日付なしカードはイベント化しない', () => {
      const html = `<ol><li class="c-schedule__list"><p class="c-schedule__date">FINAL</p></li></ol>`
      expect(parseTournamentMatches(html, 2026)).toEqual([])
    })

    it('logosブロックが無いカードはplayers空のイベントになる', () => {
      const html = `<ol><li class="c-schedule__list"><p class="c-schedule__date">FINAL</p><span>7/1</span> (火) <span>19:00</span></li></ol>`
      const matches = parseTournamentMatches(html, 2026)
      expect(matches).toHaveLength(1)
      expect(matches[0]).toMatchObject({
        date: '2026-07-01',
        startTime: '190000',
        stage: 'FINAL',
        table: '',
        players: [],
        url: undefined,
      })
    })

    it('stage表記がFINAL/SEMIFINAL以外のカードはstage/table空になる', () => {
      const html = `<ol><li class="c-schedule__list"><p class="c-schedule__date">準決勝</p><span>7/2</span> (木) <span>19:00</span><ul class="c-schedule__logos"><li><img alt="p1"></li></ul></li></ol>`
      const matches = parseTournamentMatches(html, 2026)
      expect(matches).toHaveLength(1)
      expect(matches[0]).toMatchObject({
        stage: '',
        table: '',
        players: ['p1'],
      })
    })

    it('altが空白のみのimgはplayersに含めない', () => {
      const html = `<ol><li class="c-schedule__list"><p class="c-schedule__date">FINAL</p><span>7/3</span> (金) <span>19:00</span><ul class="c-schedule__logos"><li><img alt=" "></li><li><img alt="p2"></li></ul></li></ol>`
      const matches = parseTournamentMatches(html, 2026)
      expect(matches).toHaveLength(1)
      expect(matches[0].players).toEqual(['p2'])
    })
  })

  describe('hasTournamentData', () => {
    it('フィクスチャHTMLに対してtrueを返す', () => {
      expect(hasTournamentData(FIXTURE_HTML)).toBe(true)
    })

    it('FINAL STAGEクラスを含むHTMLに対してtrueを返す', () => {
      expect(hasTournamentData('<li class="c-schedule__list">...</li>')).toBe(
        true,
      )
    })

    it('予選クラスを含むHTMLに対してtrueを返す', () => {
      expect(
        hasTournamentData('<li class="p-gamesSchedule2__list">...</li>'),
      ).toBe(true)
    })

    it('試合データを含まないHTMLに対してfalseを返す', () => {
      expect(hasTournamentData('<html><body></body></html>')).toBe(false)
    })
  })
})

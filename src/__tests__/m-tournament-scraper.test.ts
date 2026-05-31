import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MTournamentScraper } from '../scrapers/m-tournament-scraper'

const FIXTURES_DIR = join(__dirname, './fixtures')

// フィクスチャは現シーズン (2026) の実HTML。生でマーカー (2026トーナメント) を含む。
function loadFixture(): string {
  return readFileSync(join(FIXTURES_DIR, 'm-tournament.html'), 'utf-8')
}

// マーカーを除去して「前シーズン表示中」を再現する。
function loadFixtureWithoutMarker(): string {
  return loadFixture().replace('2026トーナメント', '2025トーナメント')
}

describe('m-tournament-scraper', () => {
  let scraper: MTournamentScraper

  beforeEach(() => {
    scraper = new MTournamentScraper()
    vi.clearAllMocks()
  })

  describe('fetch', () => {
    it('HTMLを取得してパースする', async () => {
      const html = loadFixture()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      }) as unknown as typeof fetch

      const matches = await scraper.fetch()

      expect(matches.length).toBe(35)
    })

    it('現在シーズンのマーカーが無いHTMLは空配列を返す', async () => {
      const html = loadFixtureWithoutMarker()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      }) as unknown as typeof fetch

      const consoleSpy = vi.spyOn(console, 'log')

      const matches = await scraper.fetch()

      expect(matches).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Site does not yet show 2026 season'),
      )

      consoleSpy.mockRestore()
    })

    it('試合データが存在しないHTMLでは空配列を返す', async () => {
      const html = '<html><body></body></html>'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      }) as unknown as typeof fetch

      const consoleSpy = vi.spyOn(console, 'log')

      const matches = await scraper.fetch()

      expect(matches).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No tournament data available'),
      )

      consoleSpy.mockRestore()
    })

    it('HTTPエラーの場合は空配列を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }) as unknown as typeof fetch

      const consoleSpy = vi.spyOn(console, 'log')

      const matches = await scraper.fetch()

      expect(matches).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching tournament schedule'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('ネットワークエラーの場合は空配列を返す', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(
          new Error('Network error'),
        ) as unknown as typeof fetch

      const consoleSpy = vi.spyOn(console, 'log')

      const matches = await scraper.fetch()

      expect(matches).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching tournament schedule'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('fetchを呼び出すURLはconfigのbaseUrl', async () => {
      const html = loadFixture()

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      })
      global.fetch = fetchMock as unknown as typeof fetch

      await scraper.fetch()

      expect(fetchMock).toHaveBeenCalledWith(
        'https://m-tournament.m-league.jp/',
      )
    })
  })
})

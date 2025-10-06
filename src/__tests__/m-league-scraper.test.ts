import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MLeagueScraper } from '../scrapers/m-league-scraper'

const FIXTURES_DIR = join(__dirname, './fixtures')

describe('m-league-scraper', () => {
  let scraper: MLeagueScraper

  beforeEach(() => {
    scraper = new MLeagueScraper()
    vi.clearAllMocks()
  })

  describe('fetchMonth', () => {
    it('HTMLを取得してスケジュールをパースする', async () => {
      const html = readFileSync(join(FIXTURES_DIR, '2025-09.html'), 'utf-8')

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      })

      const schedules = await scraper.fetchMonth(2025, 9)

      expect(schedules).toHaveLength(12)
      expect(schedules[0].date).toBe('2025-09-15')
    })

    it('スケジュールデータが存在しない場合は空配列を返す', async () => {
      const html = '<html><body>No schedule</body></html>'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      })

      const consoleSpy = vi.spyOn(console, 'log')

      const schedules = await scraper.fetchMonth(2025, 4)

      expect(schedules).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No schedule data available'),
      )

      consoleSpy.mockRestore()
    })

    it('HTTP エラーの場合は空配列を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })

      const consoleSpy = vi.spyOn(console, 'log')

      const schedules = await scraper.fetchMonth(2025, 9)

      expect(schedules).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching schedule'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('ネットワークエラーの場合は空配列を返す', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const consoleSpy = vi.spyOn(console, 'log')

      const schedules = await scraper.fetchMonth(2025, 9)

      expect(schedules).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching schedule'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('正しいURLでfetchを呼び出す', async () => {
      const html = '<html><body></body></html>'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      })

      await scraper.fetchMonth(2025, 9)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://m-league.jp/games/?mly=2025&mlm=9#schedule',
      )
    })

    it('ログメッセージを出力する', async () => {
      const html = '<html><body></body></html>'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      })

      const consoleSpy = vi.spyOn(console, 'log')

      await scraper.fetchMonth(2025, 9)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Fetching schedule from: https://m-league.jp/games/?mly=2025&mlm=9#schedule',
      )

      consoleSpy.mockRestore()
    })
  })

  describe('fetchAll', () => {
    it('全期間のスケジュールを取得する', async () => {
      // 各月の実際のデータを使用
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        const monthMatch = url.match(/mlm=(\d+)/)
        const yearMatch = url.match(/mly=(\d+)/)
        if (!monthMatch || !yearMatch) {
          return Promise.resolve({ ok: false, status: 404 })
        }

        const month = monthMatch[1].padStart(2, '0')
        const year = yearMatch[1]
        const filename = `${year}-${month}.html`

        try {
          const html = readFileSync(join(FIXTURES_DIR, filename), 'utf-8')
          return Promise.resolve({
            ok: true,
            text: async () => html,
          })
        } catch {
          return Promise.resolve({
            ok: true,
            text: async () => '<html><body></body></html>',
          })
        }
      })

      global.fetch = mockFetch

      const schedules = await scraper.fetchAll()

      // 実際のデータに基づく合計: 150試合
      expect(schedules.length).toBe(150)
      expect(global.fetch).toHaveBeenCalledTimes(9)
    })

    it('各月のログを出力する', async () => {
      const html = readFileSync(join(FIXTURES_DIR, '2025-09.html'), 'utf-8')

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      })

      const consoleSpy = vi.spyOn(console, 'log')

      await scraper.fetchAll()

      // 2025/9は12試合
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 12 matches for 2025/9'),
      )

      consoleSpy.mockRestore()
    })

    it('一部の月にスケジュールがなくても処理を継続する', async () => {
      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        const html =
          callCount === 1
            ? readFileSync(join(FIXTURES_DIR, '2025-09.html'), 'utf-8')
            : '<html><body>No schedule</body></html>'

        return Promise.resolve({
          ok: true,
          text: async () => html,
        })
      })

      const schedules = await scraper.fetchAll()

      // 最初の月だけ12試合
      expect(schedules.length).toBe(12)
      expect(global.fetch).toHaveBeenCalledTimes(9)
    })

    it('エラーがあっても全期間の処理を完了する', async () => {
      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({
          ok: true,
          text: async () => '<html><body></body></html>',
        })
      })

      const consoleSpy = vi.spyOn(console, 'log')

      const schedules = await scraper.fetchAll()

      expect(schedules).toEqual([])
      expect(global.fetch).toHaveBeenCalledTimes(9)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching schedule'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })
})

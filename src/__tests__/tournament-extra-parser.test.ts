import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseExtraData } from '../parsers/tournament-extra-parser'

const FIXTURES_DIR = join(__dirname, './fixtures')
const SAMPLE_FILE = join(FIXTURES_DIR, 'm-tournament-extra-sample.yaml')

describe('tournament-extra-parser', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tournament-extra-'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('parseExtraData', () => {
    it('フィクスチャから3件のmatchを読み込む', () => {
      const matches = parseExtraData(SAMPLE_FILE)

      expect(matches.length).toBe(3)
    })

    it('完全なエントリが正しくパースされる', () => {
      const matches = parseExtraData(SAMPLE_FILE)

      expect(matches[0]).toEqual({
        date: '2026-08-15',
        startTime: '190000',
        endTime: '223000',
        stage: '予選1st',
        table: 'C卓',
        players: ['選手A', '選手B', '選手C', '選手D'],
        url: 'https://abema.tv/sample',
      })
    })

    it('startTime欠落時はデフォルト値が入る', () => {
      const matches = parseExtraData(SAMPLE_FILE)

      expect(matches[1].startTime).toBe('190000')
    })

    it('endTimeはstartTimeから3時間30分後', () => {
      const matches = parseExtraData(SAMPLE_FILE)

      for (const match of matches) {
        expect(match.endTime).toBe('223000')
      }
    })

    it('stage/table欠落時は空文字になる', () => {
      const matches = parseExtraData(SAMPLE_FILE)

      expect(matches[2].stage).toBe('')
      expect(matches[2].table).toBe('')
    })

    it('url欠落時はundefined', () => {
      const matches = parseExtraData(SAMPLE_FILE)

      expect(matches[1].url).toBeUndefined()
      expect(matches[2].url).toBeUndefined()
    })

    it('sourceフィールドは結果オブジェクトに含まれない', () => {
      const matches = parseExtraData(SAMPLE_FILE)

      for (const match of matches) {
        expect(match).not.toHaveProperty('source')
      }
    })

    it('ファイルが存在しない場合は空配列を返す(ログなし)', () => {
      const consoleSpy = vi.spyOn(console, 'log')

      const matches = parseExtraData(join(tempDir, 'nonexistent.yaml'))

      expect(matches).toEqual([])
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('matchesが空配列のYAMLは空配列を返す', () => {
      const file = join(tempDir, 'empty.yaml')
      writeFileSync(file, 'matches: []\n', 'utf-8')

      const matches = parseExtraData(file)

      expect(matches).toEqual([])
    })

    it('matchesキーが無いYAMLは空配列を返す', () => {
      const file = join(tempDir, 'no-matches.yaml')
      writeFileSync(file, 'other: value\n', 'utf-8')

      const matches = parseExtraData(file)

      expect(matches).toEqual([])
    })

    it('YAML構文エラーは空配列+ログ出力', () => {
      const file = join(tempDir, 'broken.yaml')
      writeFileSync(file, 'matches:\n  - date: "broken\n', 'utf-8')

      const consoleSpy = vi.spyOn(console, 'log')

      const matches = parseExtraData(file)

      expect(matches).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse extra data YAML'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it('date欠落エントリはスキップ+ログ', () => {
      const file = join(tempDir, 'no-date.yaml')
      writeFileSync(file, 'matches:\n  - players: [A, B, C, D]\n', 'utf-8')

      const consoleSpy = vi.spyOn(console, 'log')

      const matches = parseExtraData(file)

      expect(matches).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipped invalid extra data entry'),
        expect.anything(),
      )

      consoleSpy.mockRestore()
    })

    it('players欠落エントリはスキップ', () => {
      const file = join(tempDir, 'no-players.yaml')
      writeFileSync(file, 'matches:\n  - date: "2026-08-15"\n', 'utf-8')

      const matches = parseExtraData(file)

      expect(matches).toEqual([])
    })

    it('players空配列のエントリはスキップ', () => {
      const file = join(tempDir, 'empty-players.yaml')
      writeFileSync(
        file,
        'matches:\n  - date: "2026-08-15"\n    players: []\n',
        'utf-8',
      )

      const matches = parseExtraData(file)

      expect(matches).toEqual([])
    })

    it('playersが非文字列のみのエントリはスキップ', () => {
      const file = join(tempDir, 'non-string-players.yaml')
      writeFileSync(
        file,
        'matches:\n  - date: "2026-08-15"\n    players: [123, true, null]\n',
        'utf-8',
      )

      const matches = parseExtraData(file)

      expect(matches).toEqual([])
    })

    it('不正なdate形式のエントリはスキップ', () => {
      const file = join(tempDir, 'bad-date.yaml')
      writeFileSync(
        file,
        'matches:\n  - date: "2026/08/15"\n    players: [A, B, C, D]\n',
        'utf-8',
      )

      const matches = parseExtraData(file)

      expect(matches).toEqual([])
    })

    it('startTime形式不正のエントリはスキップ', () => {
      const file = join(tempDir, 'bad-time.yaml')
      writeFileSync(
        file,
        'matches:\n  - date: "2026-08-15"\n    startTime: "19:00"\n    players: [A, B, C, D]\n',
        'utf-8',
      )

      const matches = parseExtraData(file)

      expect(matches).toEqual([])
    })

    it('一部不正なエントリがあっても正常なものは取得できる', () => {
      const file = join(tempDir, 'mixed.yaml')
      writeFileSync(
        file,
        [
          'matches:',
          '  - date: "2026-08-15"',
          '    players: [A, B, C, D]',
          '  - players: [E, F, G, H]',
          '  - date: "2026-08-20"',
          '    players: [I, J, K, L]',
          '',
        ].join('\n'),
        'utf-8',
      )

      const matches = parseExtraData(file)

      expect(matches.length).toBe(2)
      expect(matches[0].date).toBe('2026-08-15')
      expect(matches[1].date).toBe('2026-08-20')
    })
  })
})

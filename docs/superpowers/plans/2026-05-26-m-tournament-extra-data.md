# Mトーナメント X補助データ統合 実装計画

<!-- markdownlint-disable MD013 -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mトーナメントの試合カードをYAML形式の補助データで先取り入力できる
仕組みを追加し、公式サイトから取得したデータと自動マージして
`docs/m-tournament-schedule.ics` に統合する。

**Architecture:** 設計書 `docs/superpowers/specs/2026-05-26-m-tournament-extra-data-design.md`
に従い、YAMLパーサーとマージャーを新規モジュールとして追加。
`fetcher.ts` から呼び出して既存の Mトーナメント パイプラインに合流させる。
既存PR (#69, ブランチ `feat/add-m-tournament`) を拡張する形で進める。

**Tech Stack:** TypeScript / Bun runtime / Vitest / Biome / yaml package

---

## ファイル構成

**新規作成:**

- `data/m-tournament-extra.yaml` — 補助データ本体（初期は空の matches リスト）
- `src/parsers/tournament-extra-parser.ts` — YAML読み込み + バリデーション
- `src/utils/tournament-merger.ts` — 公式と補助のマージ + ソート
- `src/__tests__/tournament-extra-parser.test.ts`
- `src/__tests__/tournament-merger.test.ts`
- `src/__tests__/fixtures/m-tournament-extra-sample.yaml` — テスト用フィクスチャ

**修正:**

- `package.json` — `yaml` パッケージを追加
- `src/fetcher.ts` — マージステップを追加
- `CLAUDE.md` — モジュール構成・データフロー・テスト件数を更新

---

## Task 1: yaml パッケージ追加

**Files:**

- Modify: `package.json` (依存関係に追加)

- [ ] **Step 1: パッケージインストール**

```bash
cd /Users/suzuryo/repos/github.com/suzuryo/m-league-ical
bun add yaml
```

期待値: `package.json` の `dependencies` に `yaml` が追加される。`bun.lock` も更新される。

- [ ] **Step 2: 型チェック**

```bash
bun run typecheck
```

期待値: エラー無し（`yaml` は自前で型定義を持つ）。

- [ ] **Step 3: 動作確認**

```bash
bun -e 'import { parse } from "yaml"; console.log(parse("foo: bar"))'
```

期待値: `{ foo: "bar" }` が出力される。

- [ ] **Step 4: コミット**

```bash
git add package.json bun.lock
git commit -m "chore: yamlパッケージを追加"
```

---

## Task 2: 補助データの初期ファイル作成

**Files:**

- Create: `data/m-tournament-extra.yaml`
- Create: `src/__tests__/fixtures/m-tournament-extra-sample.yaml`

- [ ] **Step 1: ディレクトリと初期ファイル作成**

```bash
mkdir -p data
```

`data/m-tournament-extra.yaml` を以下の内容で作成:

```yaml
# X (Twitter) で発表された対戦カードの手動記録
# 公式サイト (https://m-tournament.m-league.jp/) に同じ試合が掲載されたら、
# その時点で自動的に公式の情報に置き換わる。
#
# 重複判定は (date, stage, table) の3つ組で行う。
# 卓名が確定していない場合は table を省略するか空文字にする。
#
# スキーマ:
# matches:
#   - date: "YYYY-MM-DD"        # 必須
#     stage: "予選1st"          # 任意
#     table: "A卓"              # 任意
#     startTime: "190000"       # 任意 (HHMMSS, デフォルト 190000)
#     players: [選手A, 選手B]   # 必須 (1人以上)
#     url: "https://abema.tv/.."  # 任意
#     source: "https://x.com/.."  # 任意 (Xの投稿URL、人間用メモ)

matches: []
```

- [ ] **Step 2: テスト用フィクスチャ作成**

`src/__tests__/fixtures/m-tournament-extra-sample.yaml` を以下の内容で作成:

```yaml
matches:
  - date: "2026-08-15"
    stage: "予選1st"
    table: "C卓"
    startTime: "190000"
    players:
      - 選手A
      - 選手B
      - 選手C
      - 選手D
    url: "https://abema.tv/sample"
    source: "https://x.com/m_league_/status/123"

  - date: "2026-08-20"
    stage: "予選2nd"
    table: "B卓"
    players:
      - 選手E
      - 選手F
      - 選手G
      - 選手H

  - date: "2026-08-25"
    players:
      - 選手I
      - 選手J
      - 選手K
      - 選手L
```

3件目は stage / table / startTime / url / source が欠落しているケース（最小構成のテスト）。

- [ ] **Step 3: コミット**

```bash
git add data/m-tournament-extra.yaml \
        src/__tests__/fixtures/m-tournament-extra-sample.yaml
git commit -m "feat: Mトーナメント補助データの初期ファイルを追加"
```

---

## Task 3: tournament-extra-parser を実装 (TDD)

**Files:**

- Create: `src/parsers/tournament-extra-parser.ts`
- Create: `src/__tests__/tournament-extra-parser.test.ts`

- [ ] **Step 1: 失敗するテストを作成**

`src/__tests__/tournament-extra-parser.test.ts`:

```typescript
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs'
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
        endTime: '235959',
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

    it('endTimeは常に235959', () => {
      const matches = parseExtraData(SAMPLE_FILE)

      for (const match of matches) {
        expect(match.endTime).toBe('235959')
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

    it('ファイルが存在しない場合は空配列を返す（ログなし）', () => {
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
      writeFileSync(
        file,
        'matches:\n  - players: [A, B, C, D]\n',
        'utf-8',
      )

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
      writeFileSync(
        file,
        'matches:\n  - date: "2026-08-15"\n',
        'utf-8',
      )

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
          '  - players: [E, F, G, H]', // date欠落
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
```

- [ ] **Step 2: 失敗を確認**

```bash
bun run test src/__tests__/tournament-extra-parser.test.ts
```

期待値: importエラーで全テスト失敗。

- [ ] **Step 3: パーサー実装を作成**

`src/parsers/tournament-extra-parser.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs'

import { parse } from 'yaml'

import { M_TOURNAMENT_CONFIG } from '../config-tournament'
import type { TournamentMatch } from '../types/tournament-match'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{6}$/

type RawEntry = {
  date?: unknown
  stage?: unknown
  table?: unknown
  startTime?: unknown
  players?: unknown
  url?: unknown
  source?: unknown
}

type RawDocument = {
  matches?: unknown
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function validateEntry(entry: RawEntry): TournamentMatch | null {
  if (!isString(entry.date) || !DATE_PATTERN.test(entry.date)) {
    return null
  }

  if (!Array.isArray(entry.players) || entry.players.length === 0) {
    return null
  }
  const players = entry.players.filter(isString)
  if (players.length === 0) {
    return null
  }

  let startTime = M_TOURNAMENT_CONFIG.calendar.defaultStartTime
  if (entry.startTime !== undefined) {
    if (!isString(entry.startTime) || !TIME_PATTERN.test(entry.startTime)) {
      return null
    }
    startTime = entry.startTime
  }

  const stage = isString(entry.stage) ? entry.stage : ''
  const table = isString(entry.table) ? entry.table : ''
  const url = isString(entry.url) ? entry.url : undefined

  return {
    date: entry.date,
    startTime,
    endTime: M_TOURNAMENT_CONFIG.calendar.defaultEndTime,
    stage,
    table,
    players,
    url,
  }
}

export function parseExtraData(filePath: string): TournamentMatch[] {
  if (!existsSync(filePath)) {
    return []
  }

  const content = readFileSync(filePath, 'utf-8')

  let doc: RawDocument
  try {
    doc = parse(content) as RawDocument
  } catch (error) {
    console.log('Failed to parse extra data YAML:', error)
    return []
  }

  if (!doc || !Array.isArray(doc.matches)) {
    return []
  }

  const results: TournamentMatch[] = []
  for (const rawEntry of doc.matches) {
    const validated = validateEntry(rawEntry as RawEntry)
    if (validated === null) {
      console.log('Skipped invalid extra data entry:', rawEntry)
      continue
    }
    results.push(validated)
  }

  return results
}
```

- [ ] **Step 4: テスト・型・lint**

```bash
bun run test src/__tests__/tournament-extra-parser.test.ts
bun run test  # 全体確認
bun run typecheck
bun run lint
```

期待値: 全部成功。lintエラーは `bun run format` で自動修正してから再実行。

- [ ] **Step 5: コミット**

```bash
git add src/parsers/tournament-extra-parser.ts \
        src/__tests__/tournament-extra-parser.test.ts
git commit -m "feat: Mトーナメント補助データYAMLパーサーを追加"
```

---

## Task 4: tournament-merger を実装 (TDD)

**Files:**

- Create: `src/utils/tournament-merger.ts`
- Create: `src/__tests__/tournament-merger.test.ts`

- [ ] **Step 1: 失敗するテストを作成**

`src/__tests__/tournament-merger.test.ts`:

```typescript
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
      const official = [makeMatch({ players: ['official1', 'official2', 'official3', 'official4'] })]
      const extra = [makeMatch({ players: ['extra1', 'extra2', 'extra3', 'extra4'] })]

      const merged = mergeMatches(official, extra)
      expect(merged.length).toBe(1)
      expect(merged[0].players).toEqual(['official1', 'official2', 'official3', 'official4'])
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
```

- [ ] **Step 2: 失敗を確認**

```bash
bun run test src/__tests__/tournament-merger.test.ts
```

期待値: importエラーで失敗。

- [ ] **Step 3: マージャー実装を作成**

`src/utils/tournament-merger.ts`:

```typescript
import type { TournamentMatch } from '../types/tournament-match'

function makeKey(match: TournamentMatch): string {
  return `${match.date}|${match.stage}|${match.table}`
}

function compare(a: TournamentMatch, b: TournamentMatch): number {
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date)
  }
  return a.startTime.localeCompare(b.startTime)
}

/**
 * 公式データと補助データをマージ。重複時は公式優先。
 * 結果は日付・時刻順にソート。
 */
export function mergeMatches(
  official: TournamentMatch[],
  extra: TournamentMatch[],
): TournamentMatch[] {
  const officialKeys = new Set(official.map(makeKey))
  const filteredExtra = extra.filter((m) => !officialKeys.has(makeKey(m)))
  return [...official, ...filteredExtra].sort(compare)
}
```

- [ ] **Step 4: テスト・型・lint**

```bash
bun run test src/__tests__/tournament-merger.test.ts
bun run test
bun run typecheck
bun run lint
```

期待値: 全部成功。

- [ ] **Step 5: コミット**

```bash
git add src/utils/tournament-merger.ts \
        src/__tests__/tournament-merger.test.ts
git commit -m "feat: Mトーナメント公式と補助データのマージ関数を追加"
```

---

## Task 5: fetcher.ts に統合

**Files:**

- Modify: `src/fetcher.ts`

- [ ] **Step 1: fetcher.ts を修正**

既存の `src/fetcher.ts` を以下に置き換える（imports とfetchMTournament を変更）:

```typescript
import { generateICalendar } from './generators/ical-generator'
import { generateTournamentICalendar } from './generators/tournament-ical-generator'
import { parseExtraData } from './parsers/tournament-extra-parser'
import { MLeagueScraper } from './scrapers/m-league-scraper'
import { MTournamentScraper } from './scrapers/m-tournament-scraper'
import { saveToFile } from './utils/file-utils'
import { mergeMatches } from './utils/tournament-merger'

async function fetchMLeague(): Promise<void> {
  console.log('=== M-League ===')
  console.log('Fetching all schedules from 2025/9 to 2026/5...\n')

  const scraper = new MLeagueScraper()
  const schedules = await scraper.fetchAll()

  if (schedules.length === 0) {
    console.log('No M-League schedule data found')
    return
  }

  console.log(`\nTotal: ${schedules.length} M-League matches found\n`)
  const ical = generateICalendar(schedules)
  saveToFile('docs/m-league-schedule.ics', ical)
  console.log('- docs/m-league-schedule.ics generated')
}

async function fetchMTournament(): Promise<void> {
  console.log('\n=== M-Tournament ===')

  const scraper = new MTournamentScraper()
  const officialMatches = await scraper.fetch()
  const extraMatches = parseExtraData('data/m-tournament-extra.yaml')
  const merged = mergeMatches(officialMatches, extraMatches)

  if (merged.length === 0) {
    console.log('No M-Tournament schedule data found')
    return
  }

  const extraCount = merged.length - officialMatches.length
  console.log(
    `\nTotal: ${merged.length} M-Tournament matches ` +
      `(official: ${officialMatches.length}, extra: ${extraCount})\n`,
  )

  const ical = generateTournamentICalendar(merged)
  saveToFile('docs/m-tournament-schedule.ics', ical)
  console.log('- docs/m-tournament-schedule.ics generated')
}

async function main() {
  try {
    console.log('Starting schedule fetcher...\n')

    await fetchMLeague()
    await fetchMTournament()

    console.log('\nAll files generated successfully!')
  } catch (error) {
    console.error('Error scraping schedule:', error)
    process.exit(1)
  }
}

void main()
```

- [ ] **Step 2: 全テスト・型・lint を実行**

```bash
bun run test
bun run typecheck
bun run lint
```

期待値: 全テスト pass。

- [ ] **Step 3: 実環境で動作確認 (補助データが空のケース)**

```bash
bun run fetch
```

期待値:

- `=== M-Tournament ===` セクションで `(official: 29, extra: 0)` のような表示
- `docs/m-tournament-schedule.ics` が生成される
- 既存通り29試合分のVEVENT

- [ ] **Step 4: 一時的に補助データを追加して動作確認**

`data/m-tournament-extra.yaml` を一時的に以下に書き換える:

```yaml
matches:
  - date: "2026-12-31"
    stage: "テスト試合"
    table: "X卓"
    players:
      - テストA
      - テストB
      - テストC
      - テストD
    source: "https://x.com/test"
```

```bash
bun run fetch
```

期待値:

- ログに `(official: 29, extra: 1)` のような表示
- `docs/m-tournament-schedule.ics` を grep して `テスト試合` の VEVENT が含まれていることを確認:

```bash
grep -A 1 'SUMMARY:\[テスト試合\]' docs/m-tournament-schedule.ics
```

- 動作確認後、`data/m-tournament-extra.yaml` を元の `matches: []` だけの状態に戻す:

```bash
git checkout data/m-tournament-extra.yaml
```

- [ ] **Step 5: 再生成して空状態に戻す**

```bash
bun run fetch
```

期待値: `(official: 29, extra: 0)` で `docs/m-tournament-schedule.ics` が更新される。

- [ ] **Step 6: コミット**

```bash
git add src/fetcher.ts docs/m-tournament-schedule.ics
git commit -m "feat: fetcherに補助データのマージステップを追加"
```

`docs/m-tournament-schedule.ics` は再ソートにより一部行順が変わっている可能性があるが、これは設計通りの挙動（日付・時刻順）。

---

## Task 6: CLAUDE.md 更新

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: カバレッジ確認**

```bash
bun run test:coverage
```

期待値: 新規モジュール (tournament-extra-parser, tournament-merger) も Lines 100%。

- [ ] **Step 2: CLAUDE.md の更新**

以下の項目を編集する。**Edit ツールで部分編集**を推奨（Write での全置換は既存の細かい記述を失う恐れがあるため）。

### 2-1. Module Structure 図に追加

```text
src/
├── parsers/
│   ├── ... (既存)
│   └── tournament-extra-parser.ts     # 補助データYAMLパーサー
└── utils/
    ├── ... (既存)
    └── tournament-merger.ts           # 公式と補助のマージ
data/
└── m-tournament-extra.yaml            # X発表カードの手動補助データ
```

### 2-2. Data Flow セクションに追記

Mトーナメントの取得フロー（既存記述）の後に、以下を追加:

```text
3a. parseExtraData('data/m-tournament-extra.yaml') で補助データを読み込む
3b. mergeMatches(official, extra) で重複除去 (キー: date+stage+table、公式優先)
3c. 日付・時刻順にソートしてから generateTournamentICalendar に渡す
```

### 2-3. Key Configuration セクションに追記

```markdown
### Extra Data

`data/m-tournament-extra.yaml` には X (Twitter) で先行発表された
対戦カードを手動で記録する。スキーマは
`docs/superpowers/specs/2026-05-26-m-tournament-extra-data-design.md` を参照。
公式サイトに同じ試合 (date+stage+table キー) が掲載されたら
自動的に公式情報で上書きされる。
```

### 2-4. Testing Infrastructure セクション

新規テストファイル2つを追記:

- `tournament-extra-parser.test.ts` - 補助データYAMLパース (15 tests)
- `tournament-merger.test.ts` - 公式と補助のマージ (10 tests)

総テスト件数を更新: 81 → 106 tests

フィクスチャに追記:

- `m-tournament-extra-sample.yaml` - 補助データテスト用

### 2-5. Important Notes セクションに追記

```markdown
- `data/m-tournament-extra.yaml` は X 等で先行発表された対戦カードを
  人間が手動で記録するファイル。公式に同じ試合が出てきたら自動的に
  公式情報で上書きされる。ファイルが無くても動作する。
```

- [ ] **Step 3: markdown lint**

```bash
markdownlint-cli2 CLAUDE.md
```

期待値: エラー無し。

- [ ] **Step 4: 全検証**

```bash
bun run test
bun run typecheck
bun run lint
```

期待値: 全部成功。

- [ ] **Step 5: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: 補助データ機能追加にあわせてCLAUDE.mdを更新"
```

---

## Task 7: pushしてPR #69 に追加

**Files:** なし (git操作のみ)

- [ ] **Step 1: コミット履歴を確認**

```bash
git log --oneline origin/feat/add-m-tournament..HEAD
```

Task 1-6 のコミットが順番に並んでいることを確認:

- chore: yamlパッケージを追加
- feat: Mトーナメント補助データの初期ファイルを追加
- feat: Mトーナメント補助データYAMLパーサーを追加
- feat: Mトーナメント公式と補助データのマージ関数を追加
- feat: fetcherに補助データのマージステップを追加
- docs: 補助データ機能追加にあわせてCLAUDE.mdを更新

- [ ] **Step 2: push**

```bash
git push
```

期待値: PR #69 に新コミットが追加される。CI が再実行される。

- [ ] **Step 3: PRに補助データ機能を追記**

```bash
gh pr view 69 --json body --jq .body > /tmp/pr-body.md
```

`/tmp/pr-body.md` を以下のように修正（既存内容に追記）。
`## 追加: X補助データ統合` セクションを `## Test plan` の前に挿入:

```bash
gh pr edit 69 --body "$(cat <<'EOF'
[既存の PR本文をここに貼り付け]

## 追加: X補助データ統合

X (Twitter) で先行発表される対戦カードを手動で記録できる仕組みも追加。

- `data/m-tournament-extra.yaml` に手書きで対戦カードを追加可能
- 公式サイトに同じ試合 (date+stage+table キー) が掲載されたら自動的に
  公式情報で上書きされる
- 重複なしの場合は補助データの試合がそのまま iCal に追加される
- 結果は日付・時刻順にソート
- 詳細: `docs/superpowers/specs/2026-05-26-m-tournament-extra-data-design.md`

EOF
)"
```

または手動で `gh pr edit 69 --web` でブラウザを開き追記する。

- [ ] **Step 4: 完了確認**

```bash
gh pr view 69 --json statusCheckRollup --jq '.statusCheckRollup[] | {name, status, conclusion}'
```

期待値: CI checks (lint / typecheck / test) が全て成功。

---

## 自己レビュー結果

### 1. Spec coverage

設計書の各セクションがタスクでカバーされているか:

- [x] YAML形式採用 → Task 1 (yaml package) + Task 2 (file format)
- [x] 重複時は公式優先 → Task 4 (merger logic)
- [x] 同じ .ics にマージ → Task 5 (fetcher 統合)
- [x] 重複判定キー (date+stage+table) → Task 4 のテストとコード
- [x] バリデーション (date/players必須、startTime形式、空配列等) → Task 3
- [x] エラー時挙動 (ファイル不在=ログなし空配列、構文エラー=ログ+空配列、エントリ無効=スキップ+ログ) → Task 3
- [x] 日付・時刻順ソート → Task 4
- [x] yaml パッケージ追加 → Task 1
- [x] 補助データファイル (空初期状態) → Task 2
- [x] テスト 100% カバレッジ → Task 6 Step 1
- [x] CLAUDE.md 更新 → Task 6
- [x] 設計書記載の API (parseExtraData, mergeMatches) → Task 3, 4 で実装

### 2. Placeholder scan

"TBD" / "TODO" / "後で" / 「適切に」のような曖昧表現は無いことを確認。

Task 7 Step 3 の PR 本文編集だけは「既存内容をここに貼り付け」となっているが、これは
`gh pr view 69 --json body --jq .body` で実取得する手順を Step 2 で先に示しているので、
実際の操作はコピペで成立する。プレースホルダーではなく明示的な手順。

### 3. Type consistency

- `parseExtraData(filePath: string): TournamentMatch[]` (Task 3) →
  `parseExtraData('data/m-tournament-extra.yaml')` (Task 5) → 一致
- `mergeMatches(official, extra): TournamentMatch[]` (Task 4) →
  `mergeMatches(officialMatches, extraMatches)` (Task 5) → 一致
- `M_TOURNAMENT_CONFIG.calendar.defaultStartTime` / `defaultEndTime` (Task 3) →
  既存 config-tournament.ts に存在 (PR #69 で追加済) → 一致
- `TournamentMatch` 型 (date, startTime, endTime, stage, table, players, url?) →
  PR #69 の Task 2 で確定済、本計画でも同じ → 一致

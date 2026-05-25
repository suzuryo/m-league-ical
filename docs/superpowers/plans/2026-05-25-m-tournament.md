# Mトーナメント対応 実装計画

<!-- markdownlint-disable MD013 -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mトーナメントの試合日程を取得して
`docs/m-tournament-schedule.ics` を生成する機能を追加し、
既存Mリーグ機能と並行運用する。

**Architecture:** 既存Mリーグコードと並列モジュール構成（設計書「案A」）。
型・config・parser・scraper・generator を新規ファイルとして追加し、
既存コードには手を入れない。エントリポイント `fetcher.ts` のみ拡張する。
詳細は `docs/superpowers/specs/2026-05-25-m-tournament-design.md` を参照。

**Tech Stack:** TypeScript / Bun runtime / Vitest / Biome /
標準fetch API / native crypto.createHash

---

## ファイル構成

**新規作成:**

- `src/types/tournament-match.d.ts` — `TournamentMatch` 型定義
- `src/config-tournament.ts` — Mトーナメント用設定（URL/regex/calendar設定）
- `src/parsers/tournament-html-parser.ts` — HTML→`TournamentMatch[]` パース
- `src/scrapers/m-tournament-scraper.ts` — `MTournamentScraper` クラス
- `src/generators/tournament-ical-generator.ts` — iCalendar生成
- `src/__tests__/fixtures/m-tournament.html` — 実HTMLフィクスチャ
- `src/__tests__/tournament-html-parser.test.ts`
- `src/__tests__/m-tournament-scraper.test.ts`
- `src/__tests__/tournament-ical-generator.test.ts`

**修正:**

- `src/utils/calendar-utils.ts` — `generateTournamentUid()` 関数を追加
- `src/__tests__/calendar-utils.test.ts` — `generateTournamentUid` テスト追加
- `src/fetcher.ts` — `fetchMTournament()` を追加して `main()` から呼び出す
- `CLAUDE.md` — モジュール構成・データフロー・iCal仕様・テスト件数・配信URL を更新

---

## Task 1: フィクスチャ取得とサイト構造の確認

**Files:**

- Create: `src/__tests__/fixtures/m-tournament.html`

このタスクの目的は実HTMLを取得し、後続タスクで使う正規表現とセレクタの実物を観察すること。設計書に書いた regex は推定値なので、ここで実物に合わせて検証する。

- [ ] **Step 1: 実HTMLを取得して保存**

```bash
curl -sSL https://m-tournament.m-league.jp/ \
  -o src/__tests__/fixtures/m-tournament.html
wc -l src/__tests__/fixtures/m-tournament.html
```

期待値: ファイルが0バイトでないこと、複数行あること。

- [ ] **Step 2: 試合ブロックの構造を観察**

`src/__tests__/fixtures/m-tournament.html` をエディタ等で開き、以下の項目を**特定してメモする**:

1. 1試合分のHTMLを囲む最外要素のタグとクラス名（例: `<div class="xxx">`）
2. 日付・時刻が書かれている要素と書式（例: `7/28 (月) 19:00`）
3. ステージ・卓名が書かれている要素と書式（例: `FINAL STAGE A卓`）
4. 選手名が書かれている場所（`<img alt="名前">` か `<span>名前</span>` か）
5. 「視聴する」ボタンの構造とhref属性
6. 試合データが存在しない場合（未公開の卓など）の表示

メモは作業ノートで構わない。`config-tournament.ts` を書くTask 3で参照する。

- [ ] **Step 3: フィクスチャをコミット**

```bash
git add src/__tests__/fixtures/m-tournament.html
git commit -m "test: Mトーナメントのフィクスチャを追加"
```

---

## Task 2: TournamentMatch 型定義

**Files:**

- Create: `src/types/tournament-match.d.ts`

- [ ] **Step 1: 型ファイルを作成**

```typescript
export interface TournamentMatch {
  date: string
  startTime: string
  endTime: string
  stage: string
  table: string
  players: string[]
  url?: string
}
```

- [ ] **Step 2: 型チェックを通す**

```bash
bun run typecheck
```

期待値: エラー無し（既存コードに影響しないため新規ファイル単体で通る）。

- [ ] **Step 3: コミット**

```bash
git add src/types/tournament-match.d.ts
git commit -m "feat: TournamentMatch型を追加"
```

---

## Task 3: 設定ファイル config-tournament.ts

**Files:**

- Create: `src/config-tournament.ts`

このタスクではTask 1で観察した実HTMLに合わせて regex/selectors を**実値で確定**する。設計書の推定値はあくまで出発点。

- [ ] **Step 1: 雛形を作成**

```typescript
export const M_TOURNAMENT_CONFIG = {
  baseUrl: 'https://m-tournament.m-league.jp/',
  year: 2026,

  calendar: {
    name: 'Mトーナメント 2025-26 スケジュール',
    timezone: 'Asia/Tokyo',
    defaultStartTime: '190000',
    defaultEndTime: '235959',
    defaultLocation: 'https://abema.tv/now-on-air/mahjong',
    description: {
      prefix: '対戦選手:',
      playerBullet: '・',
    },
  },

  selectors: {
    matchClass: '',
  },

  regex: {
    matchBlock: /placeholder/g,
    dateTime: /placeholder/,
    stageTable: /placeholder/,
    player: /placeholder/g,
    url: /placeholder/,
  },
} as const
```

- [ ] **Step 2: Task 1 のメモを見て regex/selectors を確定**

Task 1 で観察した実HTML構造に基づき、以下の方針で各値を埋める:

1. `selectors.matchClass`: Task 1 で特定した試合ブロックの class 名（先頭の `.` は付けない）
2. `regex.matchBlock`: 試合ブロック1つ分を抽出する正規表現（gフラグ付き、Mリーグの `listItem` 正規表現を参考に non-greedy + lookahead パターンで書く）
3. `regex.dateTime`: 日付と時刻を抽出する正規表現。月/日/時/分の4キャプチャ。時刻が無い場合のフォールバックは parser 側で扱うので、ここでは時刻ありの場合のパターンを書く。例: `/(\d+)\/(\d+)\s*\([^)]*\)\s*(?:(\d{1,2}):(\d{2}))?/`
4. `regex.stageTable`: ステージ名と卓名を1つの式で抽出。stageキャプチャ・tableキャプチャの2グループ
5. `regex.player`: 選手名を抽出するパターン（gフラグ付き、複数マッチ）
6. `regex.url`: 視聴URLを抽出。href属性の値を1キャプチャ

**注意:** 正規表現は実フィクスチャでマッチすることを Task 5（パーサーTDD）で検証する。ここで正確性を100%担保する必要はなく、Task 5 で調整しても良い。ただし matchBlock の構造（試合ブロックを分割する正規表現）だけは正しくないと parser テストが全滅するので、慎重に確認する。

- [ ] **Step 3: 型チェック**

```bash
bun run typecheck
```

期待値: エラー無し。

- [ ] **Step 4: コミット**

```bash
git add src/config-tournament.ts
git commit -m "feat: Mトーナメント用configを追加"
```

---

## Task 4: generateTournamentUid を calendar-utils に追加

**Files:**

- Modify: `src/utils/calendar-utils.ts`
- Modify: `src/__tests__/calendar-utils.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`src/__tests__/calendar-utils.test.ts` の `describe('calendar-utils', ...)` ブロック内、`describe('formatDateTime', ...)` の**前**に以下を挿入する:

```typescript
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
    expect(uid1).toMatch(/^2026-07-28-[a-f0-9]{12}@m-tournament\.jp$/)
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
    const match2: TournamentMatch = { ...match1, players: ['D', 'C', 'B', 'A'] }

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
```

ファイル冒頭の import 行を以下に変更する（`TournamentMatch` と `generateTournamentUid` を追加）:

```typescript
import { describe, expect, it } from 'vitest'

import type { Schedule } from '../types/schedule'
import type { TournamentMatch } from '../types/tournament-match'
import {
  formatDateTime,
  generateTournamentUid,
  generateUid,
} from '../utils/calendar-utils'
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
bun run test src/__tests__/calendar-utils.test.ts
```

期待値: `generateTournamentUid is not a function` のような import エラーで失敗。

- [ ] **Step 3: 実装を追加**

`src/utils/calendar-utils.ts` の末尾に以下を追加:

```typescript
import type { TournamentMatch } from '../types/tournament-match'

export function generateTournamentUid(match: TournamentMatch): string {
  const sortedPlayers = [...match.players].sort().join(',')
  const hash = createHash('sha256')
    .update(`${match.date}|${match.stage}|${match.table}|${sortedPlayers}`)
    .digest('hex')
    .substring(0, HASH_LENGTH)

  return `${match.date}-${hash}@m-tournament.jp`
}
```

`import type { TournamentMatch }` はファイル上部の既存 import の近くに移動して整理する（Biome の import 順序ルールに従う）。

- [ ] **Step 4: テスト・型チェック・lint を全部通す**

```bash
bun run test src/__tests__/calendar-utils.test.ts
bun run typecheck
bun run lint
```

期待値: 全て成功。lint で format エラーが出た場合は `bun run format` で自動修正してから再実行。

- [ ] **Step 5: コミット**

```bash
git add src/utils/calendar-utils.ts src/__tests__/calendar-utils.test.ts
git commit -m "feat: generateTournamentUid関数を追加"
```

---

## Task 5: tournament-html-parser を実装

**Files:**

- Create: `src/parsers/tournament-html-parser.ts`
- Create: `src/__tests__/tournament-html-parser.test.ts`

このタスクが最も繊細。実HTMLフィクスチャに対する期待値を先にテストで書き、それを通す実装を書く。

- [ ] **Step 1: フィクスチャを目視して期待値を決める**

`src/__tests__/fixtures/m-tournament.html` を開き、以下の情報を**メモする**（テストの期待値に使う）:

- 試合の総件数（全カードを数える）
- 最初の試合の: date, startTime, stage, table, players (4名), url
- ステージ名の種類（FINAL STAGE / 予選1st / 予選2nd など）
- 日時が未公開の試合があるか（あれば parsed object でどう扱うか）

これらのメモは次のテストの期待値として使う。

- [ ] **Step 2: 失敗するテストを書く**

`src/__tests__/tournament-html-parser.test.ts` を作成:

```typescript
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
  describe('parseTournamentMatches', () => {
    it('フィクスチャから試合データを抽出する', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      expect(matches.length).toBeGreaterThan(0)
    })

    it('最初の試合が想定の形でパースされる', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)
      const first = matches[0]

      expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(first.startTime).toMatch(/^\d{6}$/)
      expect(first.endTime).toBe('235959')
      expect(first.stage.length).toBeGreaterThan(0)
      expect(first.table).toMatch(/[A-Z]卓/)
      expect(first.players.length).toBe(4)
    })

    it('全試合で必須項目(date, players)が揃っている', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2025)

      for (const match of matches) {
        expect(match.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(match.players.length).toBeGreaterThan(0)
      }
    })

    it('指定した年が日付に反映される', () => {
      const matches = parseTournamentMatches(FIXTURE_HTML, 2026)

      expect(matches[0].date.startsWith('2026-')).toBe(true)
    })

    it('空のHTMLに対しては空配列を返す', () => {
      const matches = parseTournamentMatches('<html></html>', 2025)
      expect(matches).toEqual([])
    })

    it('startTimeが取れない試合はdefaultStartTimeを使う', () => {
      const html = `
        <div class="DUMMY_MATCH_CLASS">
          <h3>予選1st A卓</h3>
          <p>7/1 (月)</p>
          <ul>
            <li><img src="profile/x/T_A.png" alt="選手A"></li>
            <li><img src="profile/x/T_B.png" alt="選手B"></li>
            <li><img src="profile/x/T_C.png" alt="選手C"></li>
            <li><img src="profile/x/T_D.png" alt="選手D"></li>
          </ul>
        </div>
      `
      const matches = parseTournamentMatches(html, 2026)

      if (matches.length > 0) {
        expect(matches[0].startTime).toBe('190000')
      }
    })
  })

  describe('hasTournamentData', () => {
    it('フィクスチャHTMLに対してtrueを返す', () => {
      expect(hasTournamentData(FIXTURE_HTML)).toBe(true)
    })

    it('試合データを含まないHTMLに対してfalseを返す', () => {
      expect(hasTournamentData('<html><body></body></html>')).toBe(false)
    })
  })
})
```

**注意:** `DUMMY_MATCH_CLASS` の部分は Task 3 で確定した `M_TOURNAMENT_CONFIG.selectors.matchClass` の値に置き換える。また、最初の試合の具体値（date, stage など）が Task 5-Step 1 のメモで判明している場合は、そのテストを追加する形で `expect(first.date).toBe('2025-07-28')` のようにすると精度が上がる。

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
bun run test src/__tests__/tournament-html-parser.test.ts
```

期待値: import エラーで失敗（モジュールが存在しない）。

- [ ] **Step 4: パーサー実装を作成**

`src/parsers/tournament-html-parser.ts`:

```typescript
import { M_TOURNAMENT_CONFIG } from '../config-tournament'
import type { TournamentMatch } from '../types/tournament-match'

function parseMatchCards(html: string): string[] {
  const items: string[] = []
  const regex = new RegExp(M_TOURNAMENT_CONFIG.regex.matchBlock)
  let match = regex.exec(html)

  while (match !== null) {
    items.push(match[0])
    match = regex.exec(html)
  }
  return items
}

function parseDateTime(
  cardContent: string,
  year: number,
): { date: string; startTime: string } | null {
  const m = cardContent.match(M_TOURNAMENT_CONFIG.regex.dateTime)
  if (!m) return null

  const month = m[1].padStart(2, '0')
  const day = m[2].padStart(2, '0')
  const hourStr = m[3]
  const minStr = m[4]

  const startTime =
    hourStr && minStr
      ? `${hourStr.padStart(2, '0')}${minStr.padStart(2, '0')}00`
      : M_TOURNAMENT_CONFIG.calendar.defaultStartTime

  return { date: `${year}-${month}-${day}`, startTime }
}

function parseStageAndTable(
  cardContent: string,
): { stage: string; table: string } | null {
  const m = cardContent.match(M_TOURNAMENT_CONFIG.regex.stageTable)
  if (!m) return null
  return { stage: m[1].trim(), table: m[2].trim() }
}

function parsePlayers(cardContent: string): string[] {
  const players: string[] = []
  const regex = new RegExp(M_TOURNAMENT_CONFIG.regex.player)
  let m = regex.exec(cardContent)
  while (m !== null) {
    const name = m[1].trim()
    if (name) players.push(name)
    m = regex.exec(cardContent)
  }
  return players
}

function parseUrl(cardContent: string): string | undefined {
  const m = cardContent.match(M_TOURNAMENT_CONFIG.regex.url)
  return m ? m[1] : undefined
}

export function parseTournamentMatches(
  html: string,
  year: number,
): TournamentMatch[] {
  return parseMatchCards(html)
    .map((card): TournamentMatch | null => {
      const dt = parseDateTime(card, year)
      if (!dt) return null

      const players = parsePlayers(card)
      if (players.length === 0) return null

      const st = parseStageAndTable(card)
      const url = parseUrl(card)

      return {
        date: dt.date,
        startTime: dt.startTime,
        endTime: M_TOURNAMENT_CONFIG.calendar.defaultEndTime,
        stage: st?.stage ?? '',
        table: st?.table ?? '',
        players,
        url,
      }
    })
    .filter((m): m is TournamentMatch => m !== null)
}

export function hasTournamentData(html: string): boolean {
  return (
    M_TOURNAMENT_CONFIG.selectors.matchClass !== '' &&
    html.includes(M_TOURNAMENT_CONFIG.selectors.matchClass)
  )
}
```

- [ ] **Step 5: テストを実行**

```bash
bun run test src/__tests__/tournament-html-parser.test.ts
```

期待値: 全テストpass。失敗した場合は:

1. `console.log(matches)` でパース結果を確認
2. `config-tournament.ts` の regex を実HTMLに対して再調整
3. 必要に応じて parser のロジックを修正
4. Step 3 の expected を実値に合わせて精度UP

- [ ] **Step 6: lint と型チェック**

```bash
bun run lint
bun run typecheck
```

期待値: エラー無し。

- [ ] **Step 7: コミット**

```bash
git add src/parsers/tournament-html-parser.ts \
        src/__tests__/tournament-html-parser.test.ts \
        src/config-tournament.ts
git commit -m "feat: MトーナメントHTMLパーサーを実装"
```

`config-tournament.ts` を含めるのは Step 5 で regex を調整した可能性があるため。

---

## Task 6: m-tournament-scraper を実装

**Files:**

- Create: `src/scrapers/m-tournament-scraper.ts`
- Create: `src/__tests__/m-tournament-scraper.test.ts`

- [ ] **Step 1: 失敗するテストを作成**

`src/__tests__/m-tournament-scraper.test.ts`:

```typescript
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MTournamentScraper } from '../scrapers/m-tournament-scraper'

const FIXTURES_DIR = join(__dirname, './fixtures')

describe('m-tournament-scraper', () => {
  let scraper: MTournamentScraper

  beforeEach(() => {
    scraper = new MTournamentScraper()
    vi.clearAllMocks()
  })

  describe('fetch', () => {
    it('HTMLを取得してパースする', async () => {
      const html = readFileSync(join(FIXTURES_DIR, 'm-tournament.html'), 'utf-8')

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      }) as unknown as typeof fetch

      const matches = await scraper.fetch()

      expect(matches.length).toBeGreaterThan(0)
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
        .mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

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
      const html = readFileSync(join(FIXTURES_DIR, 'm-tournament.html'), 'utf-8')

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      })
      global.fetch = fetchMock as unknown as typeof fetch

      await scraper.fetch()

      expect(fetchMock).toHaveBeenCalledWith('https://m-tournament.m-league.jp/')
    })
  })
})
```

- [ ] **Step 2: 失敗を確認**

```bash
bun run test src/__tests__/m-tournament-scraper.test.ts
```

期待値: import エラーで失敗。

- [ ] **Step 3: 実装を作成**

`src/scrapers/m-tournament-scraper.ts`:

```typescript
import { M_TOURNAMENT_CONFIG } from '../config-tournament'
import {
  hasTournamentData,
  parseTournamentMatches,
} from '../parsers/tournament-html-parser'
import type { TournamentMatch } from '../types/tournament-match'

export class MTournamentScraper {
  async fetch(): Promise<TournamentMatch[]> {
    const url = M_TOURNAMENT_CONFIG.baseUrl
    console.log(`Fetching tournament schedule from: ${url}`)

    try {
      const response = await globalThis.fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const html = await response.text()

      if (!hasTournamentData(html)) {
        console.log('  No tournament data available')
        return []
      }

      return parseTournamentMatches(html, M_TOURNAMENT_CONFIG.year)
    } catch (error) {
      console.log('  Error fetching tournament schedule:', error)
      return []
    }
  }
}
```

- [ ] **Step 4: テスト・型・lint**

```bash
bun run test src/__tests__/m-tournament-scraper.test.ts
bun run typecheck
bun run lint
```

期待値: 全て成功。

- [ ] **Step 5: コミット**

```bash
git add src/scrapers/m-tournament-scraper.ts \
        src/__tests__/m-tournament-scraper.test.ts
git commit -m "feat: Mトーナメントスクレイパーを実装"
```

---

## Task 7: tournament-ical-generator を実装

**Files:**

- Create: `src/generators/tournament-ical-generator.ts`
- Create: `src/__tests__/tournament-ical-generator.test.ts`

- [ ] **Step 1: 失敗するテストを作成**

`src/__tests__/tournament-ical-generator.test.ts`:

```typescript
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

      expect(ical).toMatch(
        /UID:2026-07-28-[a-f0-9]{12}@m-tournament\.jp/,
      )
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
  })
})
```

- [ ] **Step 2: 失敗を確認**

```bash
bun run test src/__tests__/tournament-ical-generator.test.ts
```

期待値: import エラーで失敗。

- [ ] **Step 3: 実装を作成**

`src/generators/tournament-ical-generator.ts`:

```typescript
import { M_TOURNAMENT_CONFIG } from '../config-tournament'
import type { TournamentMatch } from '../types/tournament-match'
import { formatDateTime, generateTournamentUid } from '../utils/calendar-utils'

function generateTimezone(): string[] {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${M_TOURNAMENT_CONFIG.calendar.timezone}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
}

function generateAlarm(summary: string): string[] {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${summary}`,
    'END:VALARM',
  ]
}

function generateEvent(match: TournamentMatch): string[] {
  const uid = generateTournamentUid(match)
  const dtStart = formatDateTime(match.date, match.startTime)
  const dtEnd = formatDateTime(match.date, match.endTime)

  const summaryParts: string[] = []
  if (match.stage) summaryParts.push(`[${match.stage}]`)
  if (match.table) summaryParts.push(`[${match.table}]`)
  for (const player of match.players) summaryParts.push(`[${player}]`)
  const summary = summaryParts.join('')

  const playerList = match.players
    .map(
      (p) => `${M_TOURNAMENT_CONFIG.calendar.description.playerBullet}${p}`,
    )
    .join('\\n')
  const description = `${M_TOURNAMENT_CONFIG.calendar.description.prefix}\\n${playerList}`
  const location = match.url || M_TOURNAMENT_CONFIG.calendar.defaultLocation

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;TZID=${M_TOURNAMENT_CONFIG.calendar.timezone}:${dtStart}`,
    `DTEND;TZID=${M_TOURNAMENT_CONFIG.calendar.timezone}:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
  ]

  lines.push(...generateAlarm(summary))
  lines.push('END:VEVENT')
  return lines
}

export function generateTournamentICalendar(
  matches: TournamentMatch[],
): string {
  const lines: string[] = []

  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//M-Tournament Schedule//JP')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push(`X-WR-CALNAME:${M_TOURNAMENT_CONFIG.calendar.name}`)
  lines.push(`X-WR-TIMEZONE:${M_TOURNAMENT_CONFIG.calendar.timezone}`)

  lines.push(...generateTimezone())

  for (const match of matches) {
    lines.push(...generateEvent(match))
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
```

- [ ] **Step 4: テスト・型・lint**

```bash
bun run test src/__tests__/tournament-ical-generator.test.ts
bun run typecheck
bun run lint
```

期待値: 全て成功。

- [ ] **Step 5: コミット**

```bash
git add src/generators/tournament-ical-generator.ts \
        src/__tests__/tournament-ical-generator.test.ts
git commit -m "feat: MトーナメントiCalジェネレーターを実装"
```

---

## Task 8: fetcher.ts に統合

**Files:**

- Modify: `src/fetcher.ts`

- [ ] **Step 1: fetcher.ts を書き換え**

`src/fetcher.ts` を以下の内容で**完全に置き換える**:

```typescript
import { generateICalendar } from './generators/ical-generator'
import { generateTournamentICalendar } from './generators/tournament-ical-generator'
import { MLeagueScraper } from './scrapers/m-league-scraper'
import { MTournamentScraper } from './scrapers/m-tournament-scraper'
import { saveToFile } from './utils/file-utils'

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
  const matches = await scraper.fetch()

  if (matches.length === 0) {
    console.log('No M-Tournament schedule data found')
    return
  }

  console.log(`\nTotal: ${matches.length} M-Tournament matches found\n`)
  const ical = generateTournamentICalendar(matches)
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

- [ ] **Step 2: 全テスト・型・lintを実行**

```bash
bun run test
bun run typecheck
bun run lint
```

期待値: 全て成功（既存テストも含めて）。

- [ ] **Step 3: 実環境で動作確認**

```bash
bun run fetch
```

期待値:

- Mリーグ・Mトーナメント両方の取得ログが出る
- `docs/m-league-schedule.ics` と `docs/m-tournament-schedule.ics` の両方が更新される（タイムスタンプを `ls -la docs/` で確認）
- エラーで終了しない

問題があれば parser/scraper のロジックに戻って修正する。

- [ ] **Step 4: 生成されたicsの形式確認**

```bash
head -30 docs/m-tournament-schedule.ics
grep -c 'BEGIN:VEVENT' docs/m-tournament-schedule.ics
```

期待値:

- ヘッダに `PRODID:-//M-Tournament Schedule//JP` と `X-WR-CALNAME:Mトーナメント 2025-26 スケジュール` が含まれる
- VEVENT数が0より大きい

- [ ] **Step 5: コミット**

```bash
git add src/fetcher.ts docs/m-league-schedule.ics docs/m-tournament-schedule.ics
git commit -m "feat: fetcherにMトーナメント取得を統合"
```

`docs/*.ics` を含めるのは GitHub Pages 用の成果物を更新するため（既存運用の踏襲）。

---

## Task 9: テストカバレッジ確認とCLAUDE.md更新

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: カバレッジレポートを取得**

```bash
bun run test:coverage
```

期待値:

- 新規モジュール（config-tournament.ts / tournament-html-parser.ts / m-tournament-scraper.ts / tournament-ical-generator.ts）のカバレッジが100%
- calendar-utils.ts も100%（generateTournamentUid 追加分含む）
- 全体テスト数が増加している

カバレッジが100%未満の行があれば、その行を通すテストケースを該当テストファイルに追加して `bun run test` が通ることを確認する。

- [ ] **Step 2: CLAUDE.md の対応セクションを更新**

`CLAUDE.md` を編集。**以下の項目をそれぞれ更新する**:

1. **Module Structure 図** — Mトーナメント関連ファイル(`config-tournament.ts`、`types/tournament-match.d.ts`、`parsers/tournament-html-parser.ts`、`scrapers/m-tournament-scraper.ts`、`generators/tournament-ical-generator.ts`) を追加
2. **Data Flow** — Mトーナメントの取得フロー（`MTournamentScraper.fetch()` → `parseTournamentMatches` → `generateTournamentICalendar` → `docs/m-tournament-schedule.ics`）を追加説明
3. **Key Configuration** — `M_TOURNAMENT_CONFIG` の存在と役割を1段落追加
4. **iCal Format Specifications** — Mトーナメント用の項目を追加:
   - イベントタイトル: `[Stage][Table][Player1][Player2][Player3][Player4]`
   - 時刻: 試合ごとに異なる（サイトから取得、フォールバック19:00開始）
   - カレンダー名: `Mトーナメント 2025-26 スケジュール`
   - UID prefix: `@m-tournament.jp`
5. **GitHub Pages URL** — `https://suzuryo.github.io/m-league-ical/m-tournament-schedule.ics` を追加
6. **Testing Infrastructure** — テストファイル一覧に追加 (tournament-html-parser.test.ts / m-tournament-scraper.test.ts / tournament-ical-generator.test.ts) とテスト件数の見直し
7. **Important Notes** — 「Mトーナメントは年を跨がない短期大会で、`M_TOURNAMENT_CONFIG.year` はシーズン切り替え時に手動更新する」を追記

- [ ] **Step 3: markdown lint を実行**

```bash
pnpm run lint:md
```

`pnpm run lint:md` が存在しない場合:

```bash
markdownlint-cli2 CLAUDE.md docs/superpowers/specs/2026-05-25-m-tournament-design.md docs/superpowers/plans/2026-05-25-m-tournament.md
```

期待値: エラー無し。エラーが出たら指摘箇所を修正する。

- [ ] **Step 4: 全部の検証**

```bash
bun run test
bun run typecheck
bun run lint
```

期待値: 全て成功。

- [ ] **Step 5: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: Mトーナメント対応にあわせてCLAUDE.mdを更新"
```

---

## Task 10: PR作成

**Files:** なし（git/gh 操作のみ）

- [ ] **Step 1: ブランチをリモートにpush**

```bash
git push -u origin feat/add-m-tournament
```

- [ ] **Step 2: PRを作成**

```bash
gh pr create --title "feat: Mトーナメント対応を追加" --body "$(cat <<'EOF'
## 概要

Mリーグとは別大会である**Mトーナメント** (https://m-tournament.m-league.jp/)
の試合日程を取得して `docs/m-tournament-schedule.ics` として配信する機能を追加した。

## 設計

並列モジュール構成 (案A) を採用し、既存Mリーグコードには手を入れずに新規モジュールを追加した。
詳細は `docs/superpowers/specs/2026-05-25-m-tournament-design.md` を参照。

## 主な変更点

- `M_TOURNAMENT_CONFIG` (config-tournament.ts) を追加
- `TournamentMatch` 型を追加
- `tournament-html-parser` / `m-tournament-scraper` / `tournament-ical-generator` を追加
- `generateTournamentUid()` を calendar-utils に追加
- `fetcher.ts` を拡張し、両大会を順次取得するように
- 配信URL追加: https://suzuryo.github.io/m-league-ical/m-tournament-schedule.ics

## テスト

- 全モジュール100%カバレッジを維持
- 既存Mリーグテストは無変更で全部pass
- `bun run fetch` で実環境動作確認済み

## Test plan

- [ ] CIの lint / typecheck / test が全部 green
- [ ] mainマージ後、GitHub Pages デプロイで `m-tournament-schedule.ics` が公開される
- [ ] iCalをカレンダーアプリで購読し、Mトーナメントの試合が正しく表示される
EOF
)"
```

- [ ] **Step 3: PR URLを共有**

`gh pr create` が出力したPRのURLを記録。レビュー対応はこのPR上で行う。

---

## 自己レビュー結果

### 1. Spec coverage

設計書の各セクションがタスクでカバーされているか:

- [x] データ構造 (`TournamentMatch`): Task 2
- [x] 設定 (`config-tournament.ts`): Task 3
- [x] パーサー: Task 5
- [x] スクレイパー: Task 6
- [x] iCalジェネレーター + UID追加: Task 4 (UID) + Task 7 (generator)
- [x] エントリポイント統合: Task 8
- [x] テスト戦略 (100%カバレッジ): Task 9 Step 1
- [x] CLAUDE.md更新: Task 9 Step 2
- [x] 配信URL: Task 8 + Task 9 (CLAUDE.md記載)
- [x] 「実装フェーズで確定する事項」(実HTML観察): Task 1 + Task 3 Step 2 + Task 5 Step 1

### 2. Placeholder scan

`placeholder` という単語は Task 3 Step 1 の雛形コード内（`/placeholder/` 正規表現）にのみ存在し、これは「Task 3 Step 2 で実HTMLに合わせて確定する作業」の出発点として意図的に置いたもの。プランの不備ではない。

その他 TBD/TODO/「適切に」のような曖昧表現は無いことを確認。

### 3. Type consistency

- `TournamentMatch` フィールド名 (date, startTime, endTime, stage, table, players, url) は Task 2 で定義し、Task 4 / 5 / 7 で同一の名前を使用 → 一致
- `M_TOURNAMENT_CONFIG.regex.matchBlock` / `dateTime` / `stageTable` / `player` / `url` は Task 3 で定義し、Task 5 で同名で参照 → 一致
- `M_TOURNAMENT_CONFIG.selectors.matchClass` は Task 3 で定義し、Task 5 の `hasTournamentData` で参照 → 一致
- `generateTournamentUid` は Task 4 で定義し、Task 7 で同名で import → 一致
- `MTournamentScraper.fetch()` は Task 6 で定義し、Task 8 で同名で呼び出し → 一致

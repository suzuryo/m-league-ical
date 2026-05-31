<!-- markdownlint-disable MD013 -->
# Mトーナメント 2026公式データ取り込み + 未定カードのイベント化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 更新された Mトーナメント公式サイト (2026卓組) のデータで ical を生成し、出場者未定の試合も出場者なしでイベント化する。

**Architecture:** シーズン判定マーカーを実サイトの2026表記に修正し、パーサーの「出場者0人なら捨てる」挙動を撤廃。時刻を持たない予選セクションには「同日1番目=15:00 / 2番目=19:00 / 3番目以降=エラー」の位置ベース時刻ルールを適用。空players時は iCalendar の DESCRIPTION を省く。冗長になる手動 YAML は空にする。

**Tech Stack:** TypeScript (tsx), Vitest, Biome, pnpm。HTMLパースは正規表現ベース (`src/config-tournament.ts` に集約)。

**設計書:** `docs/superpowers/specs/2026-05-31-m-tournament-official-2026-data-design.md`

---

## ファイル構成

| ファイル | 変更 | 責務 |
| --- | --- | --- |
| `src/config-tournament.ts` | 修正 | `currentSeasonMarker` を `/2026トーナメント/` に、`firstMatchStartTime: '150000'` を追加 |
| `src/parsers/tournament-html-parser.ts` | 修正 | 空players許容 + 予選の位置ベース時刻ルール |
| `src/generators/tournament-ical-generator.ts` | 修正 | 空players時に DESCRIPTION を省略 |
| `src/__tests__/fixtures/m-tournament.html` | 上書き | 2026サイトの実HTML (確定16 + 未定19) |
| `src/__tests__/tournament-html-parser.test.ts` | 全面改訂 | 2026フィクスチャ + 合成HTMLで検証 |
| `src/__tests__/m-tournament-scraper.test.ts` | 修正 | 新マーカー前提に更新 |
| `src/__tests__/tournament-ical-generator.test.ts` | 追記 | 空playersテスト |
| `data/m-tournament-extra.yaml` | 空化 | 16エントリ削除 (コメント + `matches: []`) |
| `CLAUDE.md` | 修正 | フィクスチャ件数・テスト数・新挙動の記述更新 |

**検証済みの期待値 (2026フィクスチャ, year=2026):** 総35件 / players有16 (全て予選1st・4名) / players空19 (FINAL系7・予選2nd4・予選3rd8) / startTime=150000が17件・190000が18件。

---

## Task 1: フィクスチャ置換 + config + パーサー本体 + パーサー/scraperテスト

> マーカー変更・フィクスチャ置換・パーサー挙動変更は相互依存するため1コミットにまとめる。

**Files:**

- Overwrite: `src/__tests__/fixtures/m-tournament.html`
- Modify: `src/config-tournament.ts`
- Modify: `src/parsers/tournament-html-parser.ts`
- Test: `src/__tests__/tournament-html-parser.test.ts` (全面改訂)
- Test: `src/__tests__/m-tournament-scraper.test.ts`

- [ ] **Step 1: フィクスチャを2026サイトの実HTMLで上書き**

Run:

```bash
curl -s https://m-tournament.m-league.jp/ -o src/__tests__/fixtures/m-tournament.html
grep -c '2026トーナメント' src/__tests__/fixtures/m-tournament.html
```

Expected: `1` (マーカー文字列を1箇所含む)。サイズは約 195KB。
※ ブランチ作業時点で既に上書き済みの場合は再取得不要。差異があれば最新を採用。

- [ ] **Step 2: config を更新 (マーカー + firstMatchStartTime)**

`src/config-tournament.ts` の該当箇所を変更:

```ts
  // 現在のシーズン (year) のサイトかを判定するマーカー。
  // サイトのメインビジュアル alt="2026トーナメント" に一致する。
  // meta description は運営の更新漏れで「Mトーナメント2025」のままなので使わない。
  // year を更新するときは下記正規表現も合わせて更新する。
  currentSeasonMarker: /2026トーナメント/,

  calendar: {
    name: 'Mトーナメント 2026 スケジュール',
    timezone: 'Asia/Tokyo',
    defaultStartTime: '190000',
    // 予選セクションは時刻非掲載。同日の最初の試合に使う開始時刻。
    firstMatchStartTime: '150000',
    // 試合の長さ (分)。開始時刻 + これが終了時刻になる。
    matchDurationMinutes: 210,
```

- [ ] **Step 3: パーサーのテストを全面改訂 (RED)**

`src/__tests__/tournament-html-parser.test.ts` を以下の内容で置き換える:

```ts
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
        /Unexpected 3rd\+ qualifier match on 2026-08-01/,
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
```

- [ ] **Step 4: テストを実行して RED を確認**

Run: `pnpm vitest run src/__tests__/tournament-html-parser.test.ts`
Expected: FAIL (現行パーサーは players0人を捨てるため総数16・未定0となり、35件/19件/位置時刻/エラーの各テストが失敗)。

- [ ] **Step 5: パーサーを実装 (空players許容 + 位置ベース時刻)**

`src/parsers/tournament-html-parser.ts` の `parseSection` を以下に置き換え、`assignPositionalStartTimes` を追加する:

```ts
/**
 * 時刻情報を持たないセクション (予選) の開始時刻を位置ベースで割り当てる。
 * 同一日付の中でカード出現順に 1番目=firstMatchStartTime / 2番目=defaultStartTime。
 * 3番目以降は想定外データなのでエラーを投げる。終了時刻も再計算する。
 */
function assignPositionalStartTimes(matches: TournamentMatch[]): void {
  const countByDate = new Map<string, number>()
  for (const match of matches) {
    const index = countByDate.get(match.date) ?? 0
    countByDate.set(match.date, index + 1)

    let startTime: string
    if (index === 0) {
      startTime = M_TOURNAMENT_CONFIG.calendar.firstMatchStartTime
    } else if (index === 1) {
      startTime = M_TOURNAMENT_CONFIG.calendar.defaultStartTime
    } else {
      throw new Error(
        `Unexpected 3rd+ qualifier match on ${match.date} ` +
          `(stage=${match.stage}, table=${match.table})`,
      )
    }

    match.startTime = startTime
    match.endTime = addMinutesToTime(
      startTime,
      M_TOURNAMENT_CONFIG.calendar.matchDurationMinutes,
    )
  }
}

/**
 * Parse all matches contained in a single section.
 * 出場者未定 (players が空) のカードもイベント化する。必須は日付のみ。
 */
function parseSection(
  html: string,
  year: number,
  section: SectionConfig,
): TournamentMatch[] {
  const matches = parseMatchCards(html, section)
    .map((card): TournamentMatch | null => {
      const dt = parseDateTime(card, year, section)
      if (!dt) return null

      const players = parsePlayers(card, section)
      const st = parseStageAndTable(card, section)
      const url = parseUrl(card, section)

      return {
        date: dt.date,
        startTime: dt.startTime,
        endTime: addMinutesToTime(
          dt.startTime,
          M_TOURNAMENT_CONFIG.calendar.matchDurationMinutes,
        ),
        stage: st.stage,
        table: st.table,
        players,
        url,
      }
    })
    .filter((m): m is TournamentMatch => m !== null)

  if (!section.hasTimeInfo) {
    assignPositionalStartTimes(matches)
  }

  return matches
}
```

注意: 既存の `if (players.length === 0) return null` を削除すること (上記置換に含まれている)。`parsePlayers` / `parseDateTime` 等のヘルパーは変更不要。

- [ ] **Step 6: パーサーテストを実行して GREEN を確認**

Run: `pnpm vitest run src/__tests__/tournament-html-parser.test.ts`
Expected: PASS (全テスト緑)。

- [ ] **Step 7: scraper テストを新マーカー前提に更新**

`src/__tests__/m-tournament-scraper.test.ts` を修正する。新フィクスチャは生で `2026トーナメント` を含むため、`loadFixtureWithCurrentSeason` は不要。マーカー不在テストはマーカー文字列を除去して再現する。

冒頭のヘルパーを置換:

```ts
const FIXTURES_DIR = join(__dirname, './fixtures')

// フィクスチャは現シーズン (2026) の実HTML。生でマーカー (2026トーナメント) を含む。
function loadFixture(): string {
  return readFileSync(join(FIXTURES_DIR, 'm-tournament.html'), 'utf-8')
}

// マーカーを除去して「前シーズン表示中」を再現する。
function loadFixtureWithoutMarker(): string {
  return loadFixture().replace('2026トーナメント', '2025トーナメント')
}
```

`HTMLを取得してパースする` の本文を更新:

```ts
    it('HTMLを取得してパースする', async () => {
      const html = loadFixture()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html,
      }) as unknown as typeof fetch

      const matches = await scraper.fetch()

      expect(matches.length).toBe(35)
    })
```

`現在シーズンのマーカーが無いHTMLは空配列を返す` の本文を更新:

```ts
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
```

`fetchを呼び出すURLはconfigのbaseUrl` の `loadFixtureWithCurrentSeason()` を `loadFixture()` に置換する。

- [ ] **Step 8: 全テスト実行して GREEN を確認**

Run: `pnpm run test`
Expected: PASS (tournament-html-parser / m-tournament-scraper 含め全緑)。

- [ ] **Step 9: コミット**

```bash
git add src/__tests__/fixtures/m-tournament.html src/config-tournament.ts src/parsers/tournament-html-parser.ts src/__tests__/tournament-html-parser.test.ts src/__tests__/m-tournament-scraper.test.ts
git commit -m "feat: Mトーナメント公式サイト(2026)からデータ取得し未定カードもイベント化"
```

---

## Task 2: 空players時に DESCRIPTION を省略 (generator)

**Files:**

- Modify: `src/generators/tournament-ical-generator.ts`
- Test: `src/__tests__/tournament-ical-generator.test.ts`

- [ ] **Step 1: 空playersテストを追加 (RED)**

`src/__tests__/tournament-ical-generator.test.ts` の最後の `it` の後に追加:

```ts
    it('出場者が空のときDESCRIPTIONを出力しない', () => {
      const matches: TournamentMatch[] = [
        {
          date: '2026-07-27',
          startTime: '150000',
          endTime: '183000',
          stage: 'FINAL STAGE',
          table: 'A卓',
          players: [],
        },
      ]

      const ical = generateTournamentICalendar(matches)

      expect(ical).toContain('SUMMARY:[FINAL STAGE A卓]')
      expect(ical).not.toContain('DESCRIPTION:')
      expect(ical).toContain('BEGIN:VEVENT')
      expect(ical).toContain('END:VEVENT')
    })
```

- [ ] **Step 2: テストを実行して RED を確認**

Run: `pnpm vitest run src/__tests__/tournament-ical-generator.test.ts`
Expected: FAIL (現状は `DESCRIPTION:対戦選手:\n` が出力されるため `not.toContain('DESCRIPTION:')` が失敗)。

- [ ] **Step 3: generator を実装 (players空ならDESCRIPTION行を出さない)**

`src/generators/tournament-ical-generator.ts` の `generateEvent` 内、`playerList`/`description`/`eventLines` 周辺を以下に置き換える:

```ts
  const location = match.url || M_TOURNAMENT_CONFIG.calendar.defaultLocation

  const eventLines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;TZID=${M_TOURNAMENT_CONFIG.calendar.timezone}:${dtStart}`,
    `DTEND;TZID=${M_TOURNAMENT_CONFIG.calendar.timezone}:${dtEnd}`,
    `SUMMARY:${summary}`,
  ]

  if (match.players.length > 0) {
    const playerList = match.players
      .map(
        (player) =>
          `${M_TOURNAMENT_CONFIG.calendar.description.playerBullet}${player}`,
      )
      .join('\\n')
    const description = `${M_TOURNAMENT_CONFIG.calendar.description.prefix}\\n${playerList}`
    eventLines.push(`DESCRIPTION:${description}`)
  }

  eventLines.push(`LOCATION:${location}`)
  eventLines.push(...generateAlarm(summary))
  eventLines.push('END:VEVENT')

  return eventLines
```

注意: 元の `playerList` / `description` の宣言行 (旧 59-65 行) と旧 `eventLines` 配列・`eventLines.push` 群を削除し、上記に置き換える。`header` / `playersStr` / `summary` の組み立て部分は変更しない。

- [ ] **Step 4: テストを実行して GREEN を確認**

Run: `pnpm vitest run src/__tests__/tournament-ical-generator.test.ts`
Expected: PASS (空playersテスト含め全緑。既存の出場者ありテストの DESCRIPTION も維持)。

- [ ] **Step 5: コミット**

```bash
git add src/generators/tournament-ical-generator.ts src/__tests__/tournament-ical-generator.test.ts
git commit -m "feat: 出場者未定の試合はDESCRIPTIONを省いてiCalイベント化する"
```

---

## Task 3: 手動YAML補助データを空にする

**Files:**

- Modify: `data/m-tournament-extra.yaml`

- [ ] **Step 1: YAML の16エントリを削除し空の matches にする**

`data/m-tournament-extra.yaml` を以下の内容に置き換える (ヘッダ/スキーマのコメントは残す):

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
#
# 2026シーズンの予選1stは公式サイトに掲載済みのため、ここは空。
# 今後 X で先行発表された未掲載カードがあれば matches に追記する。

matches: []
```

- [ ] **Step 2: 全テストが緑のままか確認**

Run: `pnpm run test`
Expected: PASS (extra-parser / merger テストは sample フィクスチャ使用のため不変)。

- [ ] **Step 3: 実際に fetch して公式データのみで生成されることを確認**

Run: `pnpm run fetch`

Expected (M-Tournament 部分):

```text
Total: 35 M-Tournament matches (official: 35, extra: 0)
- public/m-tournament-schedule.ics generated
```

- [ ] **Step 4: 生成 ics の VEVENT 数と空players挙動を確認**

Run:

```bash
grep -c 'BEGIN:VEVENT' public/m-tournament-schedule.ics
grep -c 'SUMMARY:\[FINAL\]' public/m-tournament-schedule.ics
```

Expected: VEVENT は `35`。`SUMMARY:[FINAL]` が `1` 以上 (未定イベントが生成されている)。

- [ ] **Step 5: コミット**

```bash
git add data/m-tournament-extra.yaml public/m-tournament-schedule.ics
git commit -m "feat: 補助YAMLを空にし公式サイトデータでMトーナメントicalを生成する"
```

※ `public/m-tournament-schedule.ics` は配信成果物。fetch で再生成された差分も同コミットに含める。`public/m-league-schedule.ics` に差分が出た場合は別途確認 (本変更と無関係なら含めない)。

---

## Task 4: ドキュメント更新 + 最終検証

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: lint / typecheck / カバレッジを実行し実数を把握**

Run:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test:coverage
```

Expected: lint・typecheck エラーなし。カバレッジ 100% (parser の3番目エラー分岐・空players分岐・合成HTMLの各分岐が新テストで覆われている)。テスト総数を控えておく (CLAUDE.md 更新用)。

- [ ] **Step 2: CLAUDE.md を更新**

以下を実態に合わせて修正する:

- フィクスチャ説明:
  `m-tournament.html - Mトーナメントサイトの実 HTML (1ファイル、29試合分)`
  →
  `m-tournament.html - Mトーナメントサイトの実 HTML (2026シーズン、確定16+未定19=35試合分)`
- テスト総数 `全 108 tests` と各テストファイルの件数 (`tournament-html-parser.test.ts ... (17 tests)`、`tournament-ical-generator.test.ts ... (7 tests)`) を Step 1 で得た実数に更新する。
- `Mトーナメント` の iCal 仕様セクションに、未定カードの扱いを1行追記する:
  `出場者未定の試合 (FINAL系・予選2nd/3rd) は出場者なし (DESCRIPTION省略) でイベント生成する。`
- 予選の開始時刻の記述があれば「同日1番目=15:00 / 2番目=19:00 (3番目以降はエラー)」に更新する。
- シーズンマーカーの注記を「`currentSeasonMarker` は `/2026トーナメント/` (サイトのメインビジュアル alt)」に更新する。

- [ ] **Step 3: markdownlint を実行**

Run: `markdownlint-cli2 CLAUDE.md docs/superpowers/specs/2026-05-31-m-tournament-official-2026-data-design.md docs/superpowers/plans/2026-05-31-m-tournament-official-2026-data.md`
Expected: `0 error(s)`。エラーがあれば修正する。

- [ ] **Step 4: 最終フル検証**

Run: `pnpm run lint && pnpm run typecheck && pnpm run test`
Expected: 全て成功。

- [ ] **Step 5: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: Mトーナメント2026公式データ対応に合わせてCLAUDE.mdを更新"
```

---

## 完了条件

- `pnpm run fetch` が `official: 35 / extra: 0` を出力し、`public/m-tournament-schedule.ics` に35 VEVENT が生成される。
- 未定カード (FINAL系・予選2nd/3rd) が出場者なし (DESCRIPTION省略) でイベント化される。
- 予選は同日1番目=15:00 / 2番目=19:00。
- `pnpm run lint` / `pnpm run typecheck` / `pnpm run test` が全て成功し、カバレッジ100%。

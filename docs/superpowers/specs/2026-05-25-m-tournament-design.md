# Mトーナメント対応 設計書

## 概要

既存のMリーグスケジュール取得・iCal生成システムに、別大会である**Mトーナメント**（<https://m-tournament.m-league.jp/>）のスケジュールも取得・配信する機能を追加する。

両大会はデータ構造が大きく異なるため、共通化はせず**並列モジュール構成**（案A）で実装する。既存のMリーグ関連コードには手を入れない。

## 動機・背景

- Mリーグの試合日程カレンダーは既に `docs/m-league-schedule.ics` として配信中
- ユーザーから「Mトーナメントも別カレンダーとして購読したい」という要望
- Mトーナメントは年を跨がない短期大会で、サイトは毎年更新される想定（現時点では2025年版が表示中だが、2026年版への切り替わりを見越して実装する）

## アーキテクチャ方針

### 採用案: 並列モジュール構成 (案A)

```text
src/
├── config.ts                          # 既存 (Mリーグ用)
├── config-tournament.ts               # 新設 (Mトーナメント用)
├── types/
│   ├── schedule.d.ts                  # 既存
│   └── tournament-match.d.ts          # 新設
├── parsers/
│   ├── html-parser.ts                 # 既存
│   └── tournament-html-parser.ts      # 新設
├── scrapers/
│   ├── m-league-scraper.ts            # 既存
│   └── m-tournament-scraper.ts        # 新設
├── generators/
│   ├── ical-generator.ts              # 既存
│   └── tournament-ical-generator.ts   # 新設
├── utils/
│   ├── calendar-utils.ts              # 既存 (generateTournamentUid を追加)
│   └── file-utils.ts                  # 既存
└── fetcher.ts                         # 既存を拡張 (両大会を順次実行)
```

### 採用しなかった案

- **案B（共通抽象化レイヤー）**: 既存コードの大幅リファクタが必要で、現在2大会しか無いためYAGNI
- **案C（1つのconfigで両方を扱う）**: 月別ページ vs 単一ページ、チーム vs 選手といったデータモデル差を1構造で吸収するのは過剰抽象化

### 将来の拡張余地

3つ目の大会を追加することになった時点で、案Bへのリファクタを検討する。現時点ではYAGNIに従い行わない。

## データ構造

### `TournamentMatch` 型 (`src/types/tournament-match.d.ts`)

```typescript
export interface TournamentMatch {
  date: string          // "2026-07-28" (YYYY-MM-DD)
  startTime: string     // "190000" (HHMMSS)
  endTime: string       // "235959"
  stage: string         // "FINAL STAGE" / "予選1st" など
  table: string         // "A卓" / "B卓" など
  players: string[]     // ["小林剛", "伊達朱里紗", "佐々木寿人", "堀慎吾"]
  url?: string          // 視聴URL（あれば）
}
```

- `Schedule` 型とは別物として独立させる
- 選手数は4名固定とせず `string[]` で柔軟性を保つ

## 設定 (`src/config-tournament.ts`)

```typescript
export const M_TOURNAMENT_CONFIG = {
  baseUrl: 'https://m-tournament.m-league.jp/',
  year: 2026,  // 現在シーズンの年。次シーズンが始まったら更新する

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
    // 実HTMLを取得してから確定
  },

  regex: {
    // 日時パターン例: "7/28 (月) 19:00"
    dateTime: /(\d+)\/(\d+)\s*\([^)]*\)\s*(\d+):(\d+)/,
    // ステージ＋卓パターン例: "FINAL STAGE A卓"
    stageTable: /(FINAL\s+STAGE|予選\s*\d+st|[^\s]+)\s+([A-Z]卓)/,
    // 選手画像パターン
    playerImg: /<img[^>]*src="[^"]*profile\/[^"]*\/[^_]+_([^"]+)\.png"[^>]*>/g,
    // 視聴URL
    url: /<a[^>]+href="([^"]+)"[^>]*>視聴する<\/a>/,
  },
} as const
```

**重要な前提**: `selectors` と `regex` は調査時点の推定。実装フェーズで実HTMLを取得して必ず調整する。

**年について**: Mトーナメントは年を跨がない短期大会なので、`config-tournament.ts` で固定値として持つ。シーズン切り替え時はこの値を手動更新する運用とする。

## パーサー (`src/parsers/tournament-html-parser.ts`)

責務をMリーグ版と並列に揃える。

```typescript
export function parseTournamentMatches(html: string, year: number): TournamentMatch[]
export function hasTournamentData(html: string): boolean

function parseMatchCards(html: string): string[]
function parseDateTime(
  cardContent: string,
  year: number,
): { date, startTime } | null
function parseStageAndTable(cardContent: string): { stage, table } | null
function parsePlayers(cardContent: string): string[]
function parseUrl(cardContent: string): string | undefined
```

### 設計上の決定

- 1カード内に必須項目（日付・選手）が無ければ `null` で除外し、全体は失敗させない（Mリーグの `parseSchedules` と同じ哲学）
- `startTime` が取れない場合は `M_TOURNAMENT_CONFIG.calendar.defaultStartTime` にフォールバック
- 終了時刻はサイトに通常出ないので `defaultEndTime: '235959'` を常に使う

## スクレイパー (`src/scrapers/m-tournament-scraper.ts`)

Mリーグと異なり**単一ページ**で全試合が表示されるため、`fetchMonth` 相当のループは不要。

```typescript
export class MTournamentScraper {
  async fetch(): Promise<TournamentMatch[]> {
    const url = M_TOURNAMENT_CONFIG.baseUrl
    console.log(`Fetching tournament schedule from: ${url}`)

    try {
      const response = await fetch(url)
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

### Mリーグスクレイパーとの対比

| 観点 | MLeagueScraper | MTournamentScraper |
| --- | --- | --- |
| メインメソッド | `fetchAll()` + `fetchMonth()` | `fetch()` のみ |
| ページ数 | 9ヶ月分のループ | 単一ページ |
| エラー時 | 空配列を返す | 空配列を返す |
| 空ページ判定 | `hasScheduleData` | `hasTournamentData` |

## iCalジェネレーター (`src/generators/tournament-ical-generator.ts`)

```typescript
export function generateTournamentICalendar(matches: TournamentMatch[]): string

function generateTimezone(): string[]
function generateEvent(match: TournamentMatch): string[]
function generateAlarm(summary: string): string[]
```

### イベント出力仕様

| 項目 | 仕様 |
| --- | --- |
| `SUMMARY` | `[FINAL STAGE][A卓][小林剛][伊達朱里紗][佐々木寿人][堀慎吾]` |
| `DTSTART` | `match.startTime` を使用（試合ごとに異なる） |
| `DTEND` | `match.endTime` を使用 |
| `DESCRIPTION` | `対戦選手:\n・小林剛\n・伊達朱里紗\n・佐々木寿人\n・堀慎吾` |
| `LOCATION` | `match.url` または `defaultLocation` |
| `UID` | SHA-256(date + stage + table + players) の先頭12文字 |
| `PRODID` | `-//M-Tournament Schedule//JP` |
| `X-WR-CALNAME` | `Mトーナメント 2025-26 スケジュール` |
| `VALARM` | `TRIGGER:PT0M` (Mリーグと同じ) |

### UID生成

- 既存 `generateUid()` は `Schedule` 型を引数に取るので使えない
- `utils/calendar-utils.ts` に**新規関数** `generateTournamentUid()` を追加
  （引数は `TournamentMatch`）
- ハッシュ材料: `date + stage + table + players.join('')` で重複防止
- `formatDateTime()` は既存をそのまま流用（date文字列 + HHMMSS文字列のシグネチャ）

### コード重複について

`generateTimezone()` `generateAlarm()` や `BEGIN:VCALENDAR` ヘッダの形は既存ジェネレーターと似ているが、案A方針通り**共通化せず**並列に書く。3つ目の大会が出てきた時点で抽象化を検討。

## エントリポイント統合 (`src/fetcher.ts`)

両大会を**順次実行**し、それぞれ独立して成功/失敗する設計。

```typescript
async function fetchMLeague(): Promise<void> {
  console.log('=== M-League ===')
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

### fetcher.ts の設計上の決定

- **逐次実行**: ログが混ざらずデバッグしやすい。
  所要時間は数秒程度で並列化のメリットが小さい
- **片方が空でも処理継続**: Mリーグ取得失敗時もMトーナメントは継続。逆も同様
- **空ファイルは書かない**: 既存挙動を踏襲し、購読中のカレンダーを壊さない

### 配信URL

- 既存: `https://suzuryo.github.io/m-league-ical/m-league-schedule.ics`
- 新規: `https://suzuryo.github.io/m-league-ical/m-tournament-schedule.ics`

GitHub Actionsの既存ワークフローが `docs/` ディレクトリ全体をPagesにデプロイしている想定なので、新ファイルも自動配信される。

## テスト戦略

既存の100%カバレッジ方針を継承する。

### 新規テストファイル

```text
src/__tests__/
├── tournament-html-parser.test.ts      # 約15テスト
├── m-tournament-scraper.test.ts        # 約8テスト
├── tournament-ical-generator.test.ts   # 約8テスト
└── fixtures/
    └── m-tournament.html               # 本物のサイトから取得した固定HTML
```

### 既存テストへの追加

- `calendar-utils.test.ts`: `generateTournamentUid()` のテストを3〜5件追加

### 各テストファイルのカバー範囲

| ファイル | カバー内容 |
| --- | --- |
| `tournament-html-parser.test.ts` | 日時/ステージ・卓/選手/URLパース、空HTML、欠損 |
| `m-tournament-scraper.test.ts` | 正常系、HTTPエラー、ネットワークエラー、空ページ |
| `tournament-ical-generator.test.ts` | VCALENDAR/VEVENT、複数試合、空配列、URL有無 |
| `calendar-utils.test.ts` (追加分) | `generateTournamentUid` の決定性・重複回避 |

### フィクスチャ取得

実装時に下記コマンドで取得して固定する。Mリーグと同じ「実HTMLベース」アプローチ。

```bash
curl https://m-tournament.m-league.jp/ -o src/__tests__/fixtures/m-tournament.html
```

### カバレッジ目標

- 新規モジュールも既存と同じく **100%** を目指す
- `vitest.config.ts` のカバレッジ設定は既存のまま
- `fetcher.ts` はエントリポイントとして対象外（既存方針通り）

## 実装フェーズで確定する事項

設計時点では推定で進めているが、実装時に実HTMLを取得して確定する必要がある項目:

- HTML上のクラス名・タグ構造（`tournament-match` クラスの実在確認など）
- 日時表記の正確なパターン（複数バリエーションがあるか）
- 「FINAL STAGE」「予選1st」「予選2nd」以外のステージ表記の存在
- 選手画像のsrc/alt属性パターン
- 視聴URLボタンのHTML構造

これらを踏まえて `config-tournament.ts` の `selectors` と `regex` を調整する。

## CLAUDE.md の更新

新規モジュールの追加に伴い、プロジェクトCLAUDE.mdの以下を更新する:

- モジュール構成図にMトーナメント関連ファイルを追記
- データフロー説明にMトーナメントを追加
- iCal仕様にMトーナメント用の項目を追加
- テストインフラの記述を更新（テスト件数・カバー範囲）
- GitHub Pages URL に新ファイルを追加

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code)
when working with code in this repository.

## Commands

### Fetching and File Generation

```bash
# Run the fetcher to generate calendar files
pnpm run fetch

# Development mode (same as fetch)
pnpm run dev

# Run the fetcher (alias for fetch)
pnpm run start
```

### Testing

```bash
# Run all tests
pnpm run test

# Run tests with coverage report
pnpm run test:coverage

# Run tests in watch mode (interactive)
pnpm vitest

```

### Linting

```bash
# Run Biome (lint + format check)
pnpm run lint

# Auto-fix lint and format issues
pnpm run format

# Type checking
pnpm run typecheck
```

### Setup

```bash
# Install dependencies
pnpm install
```

## Architecture

This is a web fetcher for M-League
(Japanese professional mahjong league) schedules
that generates iCal calendar files for subscription.

### Module Structure

The codebase follows a modular architecture with clear separation of concerns:

```text
src/
├── types/
│   ├── schedule.d.ts                  # Mリーグ用型定義 (Schedule, Period)
│   └── tournament-match.d.ts          # TournamentMatch 型定義
├── config.ts                          # Mリーグ用設定 (periods, selectors, regex patterns)
├── config-tournament.ts               # Mトーナメント用設定
├── utils/
│   ├── calendar-utils.ts              # UID生成、datetimeフォーマット
│   ├── file-utils.ts                  # ファイル入出力
│   └── tournament-merger.ts           # 公式と補助のマージ
├── parsers/
│   ├── html-parser.ts                 # Mリーグ HTMLパース (regex-based)
│   ├── tournament-html-parser.ts      # Mトーナメント HTMLパース
│   └── tournament-extra-parser.ts     # 補助データYAMLパーサー
├── generators/
│   ├── ical-generator.ts              # Mリーグ iCalendar生成
│   └── tournament-ical-generator.ts   # Mトーナメント iCal生成
├── scrapers/
│   ├── m-league-scraper.ts            # MLeagueScraper クラス
│   └── m-tournament-scraper.ts        # MTournamentScraper クラス
└── fetcher.ts                         # Entry point (orchestrates modules)
```

トップレベルに補助データ用のディレクトリがある:

```text
data/
└── m-tournament-extra.yaml            # X発表カードの手動補助データ
```

### Data Flow

1. **Scraper** (`MLeagueScraper`) fetches HTML from M-League
   website for each month (2025/9 through 2026/5)
2. **Parser** (`html-parser.ts`) extracts schedule data using regex patterns
3. **Generator** (`ical-generator.ts`) converts schedules to iCalendar format
4. **File Utils** saves output to `public/m-league-schedule.ics` for GitHub Pages
5. Mトーナメントは `MTournamentScraper.fetch()` で
   <https://m-tournament.m-league.jp/> から HTML を取得
6. `parseTournamentMatches` が 2 つのセクション
   (`c-schedule__list` と `p-gamesSchedule2__list`) をパース
7. `parseExtraData('data/m-tournament-extra.yaml')` で
   補助データ (X 等で先行発表された対戦カード) を読み込む
8. `mergeMatches(official, extra)` で重複除去
   (キー: date+stage+table、公式優先)。
   ただし補助データに `override: true` のエントリがあれば、
   同キーの公式試合を上書きして補助データを優先する。
   結果は日付・時刻順にソートされて返る
9. `generateTournamentICalendar` で iCalendar 形式に変換し
   `public/m-tournament-schedule.ics` に保存

### Key Configuration (`src/config.ts`)

All configuration is centralized in `M_LEAGUE_CONFIG`:

- **Periods**: 2025/9 through 2026/5 (hardcoded array)
- **Selectors**: CSS class names for HTML parsing
- **Regex Patterns**: For extracting dates, teams, URLs from HTML
- **Calendar Settings**: Timezone, event times (19:00-24:00 JST), default location

### Mトーナメント Configuration (`src/config-tournament.ts`)

`M_TOURNAMENT_CONFIG` で Mトーナメント関連の設定を集約:

- **ファイル**: `src/config-tournament.ts`
- **`baseUrl`**: Mトーナメントサイトの URL (<https://m-tournament.m-league.jp/>)
- **`year`**: 現在シーズンの年 (手動更新が必要)
- **`sections.finalStage` と `sections.qualifier`** の 2 系統で
  異なる HTML 構造に対応

### Extra Data (`data/m-tournament-extra.yaml`)

`data/m-tournament-extra.yaml` は X (Twitter) 等で
先行発表された対戦カードを人間が手動で記録するファイル。
スキーマは
`docs/superpowers/specs/2026-05-26-m-tournament-extra-data-design.md`
を参照。公式サイトに同じ試合 (date+stage+table キー) が掲載されたら
自動的に公式情報で上書きされる。
ただしエントリに `override: true` を付けると、公式より補助データを優先する
(出場辞退などで公式の出場者枠が未定 (空欄) のまま掲載されたが、
X で正規メンバーが発表済みのケース用)。公式が正しい出場者を載せたら
そのエントリは削除する。

### iCal Format Specifications

Mリーグ:

- Event title format: `[Team1][Team2][Team3][Team4]`
- Time: 19:00-24:00 JST (Japan Standard Time)
- Location: Game URL or `https://abema.tv/now-on-air/mahjong`
- Calendar name: "Mリーグ 2025-26 スケジュール"
- UID: Deterministic hash based on date + team names (SHA-256, 12 chars)
- Includes alarm at event start time

Mトーナメント:

- Event title format: `[Stage Table] Player1・Player2・Player3・Player4`
  (stage/tableのどちらかが欠ける場合は[]内が片方のみ、両方欠ける場合は[]を省略)
- 開始時刻: 試合ごとに異なる
  (FINAL系は HTML から取得、予選系は位置ベース:
  同日1番目=15:00 / 2番目=19:00、3番目以降はエラー)
- 終了時刻: 開始時刻 + `matchDurationMinutes` (デフォルト 210 分 = 3時間30分)
- 出場者未定の試合 (FINAL系・予選2nd/3rd) は出場者なし (DESCRIPTION省略)
  でイベント生成する
- Calendar name: `Mトーナメント 2026 スケジュール`
  (年を跨がない大会なので年は単独。シーズン切替時に手動更新)
- UID prefix: `@m-tournament.m-league.jp`
- PRODID: `-//M-Tournament Schedule//JP`

### Build System

- **Package manager**: pnpm (version pinned via `mise.toml` and the
  `packageManager` field in `package.json`)
- **Runtime**: Uses tsx (`tsx src/fetcher.ts`) for native TypeScript
  execution on Node.js (no build step needed)
- **Supply-chain**: `pnpm-workspace.yaml` sets `minimumReleaseAge` (3 days)
  and blocks dependency build scripts by default (`allowBuilds`)

### GitHub Pages URL

GitHub Pages は `public/` ディレクトリのみを配信する
(`.github/workflows/github-pages.yml` の `path: 'public'`)。
ics 2 ファイルは `public/` 直下に出力されるため、公開 URL は
サイトルート直下のまま変わらない。
`docs/` は設計ドキュメント (`docs/superpowers/`) 用で**公開されない**。

iCalendar (RFC 5545) は改行を CRLF と規定しているため、
`.gitattributes` の `*.ics text eol=crlf` でチェックアウト・配信時に
CRLF を保持する (リポジトリ blob は LF 正規化)。

デプロイ後の公開 URL:

- Mリーグ: `https://suzuryo.github.io/m-league-ical/m-league-schedule.ics`
- Mトーナメント: `https://suzuryo.github.io/m-league-ical/m-tournament-schedule.ics`

### Testing Infrastructure

- **Framework**: Vitest (configured in `vitest.config.ts`)
- **Test Location**: All tests are in `src/__tests__/`
  directory following Vitest conventions
- **Fixtures**: Real downloaded HTML data from M-League
  website (173 total matches across 9 months)
  - Located in `src/__tests__/fixtures/`
  - Files: `2025-09.html` through `2026-05.html`
  - `m-tournament.html` - Mトーナメントサイトの実 HTML
    (2026シーズン、確定16+未定19=35試合分)
  - `m-tournament-extra-sample.yaml` - 補助データテスト用
- **Coverage**: 100% coverage on all modules (excludes entry point and type definitions)
- **Mocking**: Uses `vi.fn()` and `vi.spyOn()` for global `fetch` and `console.log`

Test files cover (全 123 tests):

- `calendar-utils.test.ts` - UID generation and datetime formatting (19 tests)
- `html-parser.test.ts` - Schedule parsing with real fixtures (16 tests)
- `ical-generator.test.ts` - iCalendar format generation (8 tests)
- `file-utils.test.ts` - File I/O operations (4 tests)
- `m-league-scraper.test.ts` - HTTP fetching and error handling (10 tests)
- `tournament-html-parser.test.ts` - Mトーナメント HTML パース (23 tests)
- `m-tournament-scraper.test.ts` - Mトーナメント HTTP fetch (6 tests)
- `tournament-ical-generator.test.ts` - Mトーナメント iCal 生成 (9 tests)
- `tournament-extra-parser.test.ts` - 補助データYAMLパース (18 tests)
- `tournament-merger.test.ts` - 公式と補助のマージ (10 tests)

## Important Notes

- CSS selectors and regex patterns are defined in
  `src/config.ts`. If the M-League website structure
  changes, update them there.
- Months without published schedules (e.g., April, May) return empty arrays gracefully.
- Each game involves exactly 4 teams competing simultaneously.
- The scraper uses native `fetch()` API (no external HTTP libraries).
- Error logs in test output (e.g., "Network error")
  are intentional - they test error handling behavior.
- `M_TOURNAMENT_CONFIG.year` は年を跨がない大会の年を表す。
  シーズン切り替え時は手動で更新する。
  併せて `M_TOURNAMENT_CONFIG.currentSeasonMarker` の正規表現も
  新しい年に合わせて更新する必要がある。現在は `/2026トーナメント/`
  (サイトのメインビジュアル alt に一致)。
  meta description は運営の更新漏れで前シーズン表記のままになることがあるため
  使用しない。
  サイトに `currentSeasonMarker` がマッチしない間は公式データの取得を
  スキップする（前シーズンの試合がカレンダーに混入するのを防ぐため）。
- Mトーナメントは 1 ページに FINAL STAGE / 予選 の 2 セクションがあり、
  それぞれ異なる HTML 構造を持つ
  (`c-schedule__list` と `p-gamesSchedule2__list`)。
- 視聴 URL は `<a href="">` ではなく
  `onclick="window.open('...')"` から抽出する。
- `data/m-tournament-extra.yaml` は X 等で先行発表された対戦カードを
  人間が手動で記録するファイル。公式に同じ試合が出てきたら
  自動的に公式情報で上書きされる。ファイルが無くても動作する。
  エントリに `override: true` を付けた場合のみ、公式より補助データを優先する
  (出場辞退で公式の出場者枠が空欄のまま掲載されたケースなどに使う)。

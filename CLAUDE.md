# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code)
when working with code in this repository.

## Commands

### Fetching and File Generation

```bash
# Run the fetcher to generate calendar files
bun run fetch

# Development mode (same as fetch)
bun run dev

# Run the fetcher (alias for fetch)
bun run start
```

### Testing

```bash
# Run all tests
bun run test

# Run tests with coverage report
bun run test:coverage

# Run tests in watch mode (interactive)
bunx vitest

```

### Linting

```bash
# Run Biome (lint + format check)
bun run lint

# Auto-fix lint and format issues
bun run format

# Type checking
bun run typecheck
```

### Setup

```bash
# Install dependencies
bun install
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
│   └── file-utils.ts                  # ファイル入出力
├── parsers/
│   ├── html-parser.ts                 # Mリーグ HTMLパース (regex-based)
│   └── tournament-html-parser.ts      # Mトーナメント HTMLパース
├── generators/
│   ├── ical-generator.ts              # Mリーグ iCalendar生成
│   └── tournament-ical-generator.ts   # Mトーナメント iCal生成
├── scrapers/
│   ├── m-league-scraper.ts            # MLeagueScraper クラス
│   └── m-tournament-scraper.ts        # MTournamentScraper クラス
└── fetcher.ts                         # Entry point (orchestrates modules)
```

### Data Flow

1. **Scraper** (`MLeagueScraper`) fetches HTML from M-League
   website for each month (2025/9 through 2026/5)
2. **Parser** (`html-parser.ts`) extracts schedule data using regex patterns
3. **Generator** (`ical-generator.ts`) converts schedules to iCalendar format
4. **File Utils** saves output to `docs/m-league-schedule.ics` for GitHub Pages
5. Mトーナメントは `MTournamentScraper.fetch()` で
   <https://m-tournament.m-league.jp/> から HTML を取得
6. `parseTournamentMatches` が 2 つのセクション
   (`c-schedule__list` と `p-gamesSchedule2__list`) をパース
7. `generateTournamentICalendar` で iCalendar 形式に変換し
   `docs/m-tournament-schedule.ics` に保存

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

### iCal Format Specifications

Mリーグ:

- Event title format: `[Team1][Team2][Team3][Team4]`
- Time: 19:00-24:00 JST (Japan Standard Time)
- Location: Game URL or `https://abema.tv/now-on-air/mahjong`
- Calendar name: "Mリーグ 2025-26 スケジュール"
- UID: Deterministic hash based on date + team names (SHA-256, 12 chars)
- Includes alarm at event start time

Mトーナメント:

- Event title format: `[Stage][Table][Player1][Player2][Player3][Player4]`
- Time: 試合ごとに異なる
  (FINAL系は HTML から取得、予選系はデフォルト 19:00)
- Calendar name: `Mトーナメント 2025-26 スケジュール`
- UID prefix: `@m-tournament.jp`
- PRODID: `-//M-Tournament Schedule//JP`

### Build System

- **Runtime**: Uses Bun for native TypeScript execution (no build step needed)

### GitHub Pages URL

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
  - `m-tournament.html` - Mトーナメントサイトの実 HTML (1ファイル、29試合分)
- **Coverage**: 100% coverage on all modules (excludes entry point and type definitions)
- **Mocking**: Uses `vi.fn()` and `vi.spyOn()` for global `fetch` and `console.log`

Test files cover (全 81 tests):

- `calendar-utils.test.ts` - UID generation and datetime formatting (14 tests)
- `html-parser.test.ts` - Schedule parsing with real fixtures (16 tests)
- `ical-generator.test.ts` - iCalendar format generation (8 tests)
- `file-utils.test.ts` - File I/O operations (4 tests)
- `m-league-scraper.test.ts` - HTTP fetching and error handling (10 tests)
- `tournament-html-parser.test.ts` - Mトーナメント HTML パース (17 tests)
- `m-tournament-scraper.test.ts` - Mトーナメント HTTP fetch (5 tests)
- `tournament-ical-generator.test.ts` - Mトーナメント iCal 生成 (7 tests)

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
- Mトーナメントは 1 ページに FINAL STAGE / 予選 の 2 セクションがあり、
  それぞれ異なる HTML 構造を持つ
  (`c-schedule__list` と `p-gamesSchedule2__list`)。
- 視聴 URL は `<a href="">` ではなく
  `onclick="window.open('...')"` から抽出する。

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
├── types/schedule.d.ts          # Type definitions (Schedule, Period)
├── config.ts                  # Configuration (periods, selectors, regex patterns)
├── utils/
│   ├── calendar-utils.ts      # UID generation, datetime formatting
│   └── file-utils.ts          # File I/O operations
├── parsers/
│   └── html-parser.ts         # HTML parsing logic (regex-based)
├── generators/
│   └── ical-generator.ts      # iCalendar format generation
├── scrapers/
│   └── m-league-scraper.ts    # MLeagueScraper class for fetching
└── fetcher.ts                 # Entry point (35 lines, orchestrates modules)
```

### Data Flow

1. **Scraper** (`MLeagueScraper`) fetches HTML from M-League
   website for each month (2025/9 through 2026/5)
2. **Parser** (`html-parser.ts`) extracts schedule data using regex patterns
3. **Generator** (`ical-generator.ts`) converts schedules to iCalendar format
4. **File Utils** saves output to `docs/m-league-schedule.ics` for GitHub Pages

### Key Configuration (`src/config.ts`)

All configuration is centralized in `M_LEAGUE_CONFIG`:

- **Periods**: 2025/9 through 2026/5 (hardcoded array)
- **Selectors**: CSS class names for HTML parsing
- **Regex Patterns**: For extracting dates, teams, URLs from HTML
- **Calendar Settings**: Timezone, event times (19:00-24:00 JST), default location

### iCal Format Specifications

- Event title format: `[Team1][Team2][Team3][Team4]`
- Time: 19:00-24:00 JST (Japan Standard Time)
- Location: Game URL or `https://abema.tv/now-on-air/mahjong`
- Calendar name: "Mリーグ 2025-26 スケジュール"
- UID: Deterministic hash based on date + team names (SHA-256, 12 chars)
- Includes alarm at event start time

### Build System

- **Runtime**: Uses Bun for native TypeScript execution (no build step needed)

### GitHub Pages URL

When deployed: `https://suzuryo.github.io/m-league-ical/m-league-schedule.ics`

### Testing Infrastructure

- **Framework**: Vitest (configured in `vitest.config.ts`)
- **Test Location**: All tests are in `src/__tests__/`
  directory following Vitest conventions
- **Fixtures**: Real downloaded HTML data from M-League
  website (173 total matches across 9 months)
  - Located in `src/__tests__/fixtures/`
  - Files: `2025-09.html` through `2026-05.html`
- **Coverage**: 100% coverage on all modules (excludes entry point and type definitions)
- **Mocking**: Uses `vi.fn()` and `vi.spyOn()` for global `fetch` and `console.log`

Test files cover:

- `calendar-utils.test.ts` - UID generation and datetime formatting (9 tests)
- `html-parser.test.ts` - Schedule parsing with real fixtures (16 tests)
- `ical-generator.test.ts` - iCalendar format generation (8 tests)
- `file-utils.test.ts` - File I/O operations (4 tests)
- `m-league-scraper.test.ts` - HTTP fetching and error handling (10 tests)

## Important Notes

- CSS selectors and regex patterns are defined in
  `src/config.ts`. If the M-League website structure
  changes, update them there.
- Months without published schedules (e.g., April, May) return empty arrays gracefully.
- Each game involves exactly 4 teams competing simultaneously.
- The scraper uses native `fetch()` API (no external HTTP libraries).
- Error logs in test output (e.g., "Network error")
  are intentional - they test error handling behavior.

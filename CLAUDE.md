# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Fetching and File Generation
```bash
# Run the fetcher to generate calendar files
npm run fetch

# Development mode (same as fetch)
npm run dev

# Build TypeScript and run compiled version
npm start

# Build TypeScript only
npm run build
```

### Setup
```bash
# Install dependencies
npm install
```

## Architecture

This is a web fetcher for M-League (Japanese professional mahjong league) schedules that generates calendar files for subscription.

### Core Components

1. **Fetcher (`src/fetcher.ts`)**
   - Fetches M-League official website for seasons 2025-2026 (September to May)
   - Fixed URLs: `https://m-league.jp/games/?mly={year}&mlm={month}#schedule`
   - Periods: 2025/9 through 2026/5 (hardcoded in `periods` array)
   - Uses native fetch API with regex parsing for HTML content

2. **Output Generation**
   - Creates both JSON and iCal (.ics) formats
   - Files are saved to both root directory and `docs/` folder
   - `docs/` folder is for GitHub Pages hosting

3. **iCal Format Specifications**
   - Event title format: `[Team1][Team2][Team3][Team4]`
   - Time: 19:00-24:00 JST (Japan Standard Time)
   - Location: url || ABEMA TV
   - Calendar name: "Mリーグ 2025-26 スケジュール"

### Key Selectors
- Schedule list items: `.p-gamesSchedule2__list`
- Date element: `.p-gamesSchedule2__data`
- Team logos: `.p-gamesSchedule2__logos img` (alt attribute contains team name)

### Output Files
- `docs/m-league-schedule.ics` - For GitHub Pages subscription URL
- `docs/m-league-schedule.json` - For GitHub Pages JSON access

### GitHub Pages URL
When deployed: `https://suzuryo.github.io/m-league-ical/m-league-schedule.ics`

## Important Notes

- The fetcher targets specific CSS selectors on the M-League website. If the website structure changes, update the selectors in `scrapeMLeagueScheduleForMonth()`.
- Months without published schedules (e.g., April, May) are handled gracefully with a 5-second timeout.
- Each game involves exactly 4 teams competing simultaneously.

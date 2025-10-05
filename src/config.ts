import type { Period } from './types/schedule'

export const M_LEAGUE_CONFIG = {
  baseUrl: 'https://m-league.jp/games/',

  periods: [
    { year: 2025, month: 9 },
    { year: 2025, month: 10 },
    { year: 2025, month: 11 },
    { year: 2025, month: 12 },
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
    { year: 2026, month: 3 },
    { year: 2026, month: 4 },
    { year: 2026, month: 5 },
  ] as Period[],

  calendar: {
    name: 'Mリーグ 2025-26 スケジュール',
    timezone: 'Asia/Tokyo',
    eventStartTime: '190000', // 19:00:00
    eventEndTime: '240000', // 24:00:00
    defaultLocation: 'https://abema.tv/now-on-air/mahjong',
  },

  selectors: {
    listClass: 'p-gamesSchedule2__list',
    dateClass: 'p-gamesSchedule2__data',
  },

  regex: {
    listItem:
      /<li class="p-gamesSchedule2__list[^"]*"[^>]*>([\s\S]*?)(?=<li class="p-gamesSchedule2__list|<\/ul>)/g,
    date: /<p class="p-gamesSchedule2__data">(\d+)<span[^>]*>\/[^<]*<\/span>(\d+)/,
    team: /<img[^>]*alt="([^"]+)"[^>]*>/g,
    url: /<a href="([^"]+)"/,
  },
} as const

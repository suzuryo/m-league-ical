export const M_TOURNAMENT_CONFIG = {
  baseUrl: 'https://m-tournament.m-league.jp/',
  year: 2026,

  // 現在のシーズン (year) のサイトかを判定するマーカー。
  // サイトが前年版を表示している間は試合データを取り込まない。
  // year を更新するときは下記正規表現も合わせて更新する。
  currentSeasonMarker: /Mトーナメント\s*2026/,

  calendar: {
    name: 'Mトーナメント 2026 スケジュール',
    timezone: 'Asia/Tokyo',
    defaultStartTime: '190000',
    // 試合の長さ (分)。開始時刻 + これが終了時刻になる。
    matchDurationMinutes: 210,
    // Fallback URL used as the event location when schedule.url is undefined.
    defaultLocation: 'https://abema.tv/now-on-air/mahjong',
    description: {
      prefix: '対戦選手:',
      playerBullet: '・',
    },
  },

  sections: {
    // FINAL STAGE (決勝): 7 matches with explicit time info.
    finalStage: {
      // Matches a single <li class="c-schedule__list ..."> element and captures its inner HTML.
      // Uses lookahead to stop at the next list item or the closing </ol> tag.
      matchBlock:
        /<li class="c-schedule__list[^"]*"[^>]*>([\s\S]*?)(?=<li class="c-schedule__list|<\/ol>)/g,
      // Captures stage name (FINAL / FINALSTAGE / SEMIFINAL) and optional table label (e.g. "D卓").
      // The wrapper element is <p> for most cards but occasionally <div>, so we accept both.
      // group1=stage, group2=table (optional, undefined for FINAL which has only 1 table)
      stageAndTable:
        /<(?:p|div) class="c-schedule__date">\s*(FINAL(?:STAGE)?|SEMIFINAL)(?:<br>\s*([A-Z]卓))?/,
      // Format: <span>M/D</span> (曜) <span>HH:MM</span>
      // Whitespace between the date span / day-of-week / time span varies across cards,
      // so allow \s* in both gaps.
      // group1=month, group2=day, group3=hour, group4=minute
      dateTime:
        /<span>(\d+)\/(\d+)<\/span>\s*\([^)]*\)\s*<span>(\d+):(\d+)<\/span>/,
      // Player names from <img alt="..."> tags inside the logos block.
      // Used with `g` flag to iterate over all 4 players in the block.
      player: /<img[^>]*alt="([^"]+)"[^>]*>/g,
      // Extracts the <ul class="c-schedule__logos"> block so player regex only sees logo images.
      logosBlock: /<ul class="c-schedule__logos">([\s\S]*?)<\/ul>/,
      // Game URL from onclick="window.open('URL');".
      // URL may contain trailing whitespace inside the quotes; parser should trim.
      url: /onclick="window\.open\('([^']+)'\)\s*;?\s*"/,
      hasTimeInfo: true,
    },
    // 予選 (SCHEDULE): 22 matches without time info (defaults to 19:00 JST).
    qualifier: {
      // Matches a single <li class="p-gamesSchedule2__list ..."> element and captures its inner HTML.
      // Each card contains nested <li> elements (the logos block uses <li><img></li> for each
      // player), so we cannot stop at the first </li>. Instead, stop at the next outer card
      // (`<li class="p-gamesSchedule2__list"`) or the closing </ul> of the surrounding list.
      // The intervening logos block's </ul> is OK to stop at as long as the URL <button> is still
      // inside; we use </ul></li> (or </ul> followed by tournament-link-buttons div) as the boundary.
      matchBlock:
        /<li class="p-gamesSchedule2__list[^"]*"[^>]*>([\s\S]*?<\/ul>[\s\S]*?)<\/li>/g,
      // Two consecutive <p class="p-gamesSchedule2__data"> elements.
      // group1=stage (e.g. 予選1st), group2=table (e.g. A卓)
      stageAndTable:
        /<p class="p-gamesSchedule2__data">([^<]+)<\/p>\s*<p class="p-gamesSchedule2__data">([^<]+)<\/p>/,
      // Format: <span style="...">M/D</span> (full-width parentheses, no time)
      // group1=month, group2=day
      dateTime: /<span[^>]*>(\d+)\/(\d+)<\/span>/,
      // Player names from <img alt="..."> tags inside the logos block.
      player: /<img[^>]*alt="([^"]+)"[^>]*>/g,
      // Extracts the <ul class="p-gamesSchedule2__logos"> block.
      logosBlock: /<ul class="p-gamesSchedule2__logos">([\s\S]*?)<\/ul>/,
      // Game URL from onclick="window.open('URL');".
      url: /onclick="window\.open\('([^']+)'\)\s*;?\s*"/,
      hasTimeInfo: false,
    },
  },
} as const

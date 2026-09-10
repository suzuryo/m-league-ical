# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other coding agents
when working with code in this repository. `AGENTS.md` is a symlink to this file,
so every agent reads the same content — edit only `CLAUDE.md`.

Mリーグ（日本のプロ麻雀リーグ）と Mトーナメントの日程を web から取得し、
購読用の iCal ファイルを生成する。利用者向けの説明と購読手順は `README.md`。

**ここには他が持っていない契約と落とし穴だけを置く。** 構成・設定値・テスト一覧は
コードを読めば分かるので書かない。

## 並行作業（worktree）

- **タスク専用の worktree が既にあればそれを使う**（ツールが自動作成・管理するものを
  含む。例: Codex アプリは `$CODEX_HOME/worktrees` に作る）
- 手動で作るなら `.claude/worktrees/<name>`（他の場所に作ると git status に出る）
- **同じ worktree を複数のエージェントで同時に編集しない**

## コマンド

`pnpm run fetch` が取得と生成の入口（`dev` / `start` は別名）。検証は
`pnpm run test` / `test:coverage`、`pnpm run lint`（Biome）、`pnpm run typecheck`、
`mise run lint:md`。一覧は `package.json` と `mise tasks`。

## データの流れ

1. `MLeagueScraper` が Mリーグ公式から月ごとの HTML を取得し、`html-parser.ts` が
   regex で日程を抽出、`ical-generator.ts` が iCalendar 化して
   `public/m-league-schedule.ics` へ保存する
2. `MTournamentScraper.fetch()` が Mトーナメント公式から HTML を取得し、
   `parseTournamentMatches` が **FINAL STAGE と予選の 2 セクション**
   （`c-schedule__list` と `p-gamesSchedule2__list`。HTML 構造が違う）をパースする
3. `parseExtraData('data/m-tournament-extra.yaml')` が補助データを読み、
   `mergeMatches(official, extra)` が date+stage+table をキーに重複除去する
   （**既定は公式優先**）。結果を日付・時刻順にソートして
   `public/m-tournament-schedule.ics` へ保存する

HTML の構造が変わったら直すのは `src/config.ts` の CSS セレクタと regex。
**視聴 URL は `<a href="">` ではなく `onclick="window.open('...')"` から抽出する。**

## 補助データと override

`data/m-tournament-extra.yaml` は X 等で先行発表された対戦カードを人間が手動で記録する
ファイル。**無くても動作する。** スキーマは
`docs/superpowers/specs/2026-05-26-m-tournament-extra-data-design.md`。

公式に同じ試合（date+stage+table）が出たら自動的に公式で上書きされる。
**エントリに `override: true` を付けたときだけ補助データが公式に優先する** —
出場辞退などで公式の出場者枠が空欄のまま掲載され、X では正規メンバーが発表済み、
というケース用。**公式が正しい出場者を載せたらそのエントリは削除する。**

### iCal Format Specifications

Mリーグ:

- Event title format: `[Team1][Team2][Team3][Team4]`
- Time: 19:00-24:00 JST (Japan Standard Time)
- Location: Game URL or `https://abema.tv/now-on-air/mahjong`
- Calendar name: "Mリーグ 2026-27 スケジュール"
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

## 配信

GitHub Pages は `public/` だけを配信する（`github-pages.yml` の `path: 'public'`）。
ics 2 ファイルは `public/` 直下なので公開 URL はサイトルート直下。`docs/` は
設計ドキュメント用で**公開されない**。

- Mリーグ: `https://suzuryo.github.io/m-league-ical/m-league-schedule.ics`
- Mトーナメント: `https://suzuryo.github.io/m-league-ical/m-tournament-schedule.ics`

**iCalendar (RFC 5545) は改行を CRLF と規定している。** `.gitattributes` の
`*.ics text eol=crlf` がチェックアウト・配信時に CRLF を保つ（リポジトリの blob は
LF 正規化）。この行を消さないこと。

## テスト

Vitest。テストは `src/__tests__/`、fixture は実際にダウンロードした HTML
（`src/__tests__/fixtures/2026-09.html` 〜、`m-tournament.html`）。エントリポイントと
型定義を除く全モジュールで coverage 100% を維持する。`fetch` と `console.log` は
`vi.fn()` / `vi.spyOn()` でモックする。

**テスト出力に出るエラーログ（"Network error" 等）は意図的**で、エラー処理の検証。

## シーズン切り替え（手動更新が必要）

- `M_TOURNAMENT_CONFIG.year` は年を跨がない大会の年。手動で更新する
- 併せて `M_TOURNAMENT_CONFIG.currentSeasonMarker` の正規表現も新しい年に合わせる。
  現在は `/2026トーナメント/`（サイトのメインビジュアルの alt に一致）。
  **meta description は運営の更新漏れで前シーズン表記のままになることがあるので使わない**
- サイトに `currentSeasonMarker` がマッチしない間は公式データの取得をスキップする
  （前シーズンの試合がカレンダーに混入するのを防ぐため）
- Mリーグ側の対象期間は `src/config.ts` の `periods` にハードコードしてある

## その他

- 日程が未公開の月（4月・5月など）は空配列を返す。エラーにしない
- 1 試合はちょうど 4 チーム
- HTTP は外部ライブラリを使わず native `fetch()`
- 依存は `pnpm-workspace.yaml` で `minimumReleaseAge`（3 日）を設け、
  build script を既定でブロックする（`allowBuilds`）。**この設定を緩めない**

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other coding agents
when working with code in this repository. `AGENTS.md` is a symlink to this file,
so every agent reads the same content — edit only `CLAUDE.md`.

Mリーグ（日本のプロ麻雀リーグ）と Mトーナメントの日程を web から取得し、
購読用の iCal ファイルを生成する。利用者向けの説明、購読手順、公開 URL は `README.md`。

**ここには他が持っていない契約と落とし穴だけを置く。** 構成・設定値・テスト一覧は
コードを読めば分かるので書かない。

## コマンド

`pnpm run fetch` が取得と生成の入口（`dev` / `start` は別名）。検証は
`pnpm run test` / `test:coverage`、`pnpm run lint`（Biome）、`pnpm run typecheck`。
一覧は `package.json` と `mise tasks`。

CI は ARC の self-hosted runner で動く。止まったときの手動実行は
`docs/runbooks/arc-ci.md`（`github-pages.yml` を dispatch すると本番配信になる）。

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

HTML の構造が変わったら直すのは CSS セレクタと regex（Mリーグは `src/config.ts`、
Mトーナメントは `src/config-tournament.ts`）。
**視聴 URL は `<a href="">` ではなく `onclick="window.open('...')"` から抽出する。**

## 補助データと override

`data/m-tournament-extra.yaml` は X 等で先行発表された対戦カードを人間が手動で記録する
ファイル。**無くても動作する。** スキーマは
`docs/superpowers/specs/2026-05-26-m-tournament-extra-data-design.md`。

公式に同じ試合（date+stage+table）が出たら自動的に公式で上書きされる。
**エントリに `override: true` を付けたときだけ補助データが公式に優先する** —
出場辞退などで公式の出場者枠が空欄のまま掲載され、X では正規メンバーが発表済み、
というケース用。**公式が正しい出場者を載せたらそのエントリは削除する。**

## iCal の契約

カレンダー名、PRODID、UID の prefix、既定の場所、試合時間などの値は
`src/config.ts` と `src/config-tournament.ts` にある。

- UID は決定的に生成する（Mリーグは日付 + チーム名の SHA-256 先頭 12 文字）。
  購読側が予定を同一視するキーなので、形式を変えると予定が重複する
- Mリーグ: タイトルは `[Team1][Team2][Team3][Team4]`、19:00-24:00 JST、開始時刻にアラーム
- Mトーナメント: タイトルは `[Stage Table] Player1・Player2・Player3・Player4`
  （stage / table の片方が欠けたら `[]` 内は片方だけ、両方欠けたら `[]` を省略）
- Mトーナメントの開始時刻: FINAL 系は HTML から取得する。予選は同じ日の中の位置で決める
  （1 番目 = 15:00、2 番目 = 19:00、3 番目以降はエラー）
- 出場者が未定の試合（FINAL 系、予選 2nd / 3rd）も、DESCRIPTION を省いてイベントを作る

## 配信

GitHub Pages は `public/` だけを配信する（`github-pages.yml` の `path: 'public'`）。
ics 2 ファイルは `public/` 直下なので公開 URL はサイトルート直下。`docs/` は
設計ドキュメント用で**公開されない**。

**iCalendar (RFC 5545) は改行を CRLF と規定している。** `.gitattributes` の
`*.ics text eol=crlf` がチェックアウト・配信時に CRLF を保つ（リポジトリの blob は
LF 正規化）。この行を消さないこと。

## テスト

Vitest。テストは `src/__tests__/`、fixture は実際にダウンロードした HTML
（`src/__tests__/fixtures/` の月別 HTML と `m-tournament.html`）。エントリポイントと
型定義を除く全モジュールで coverage 100% を維持する。`fetch` と `console.log` は
`vi.fn()` / `vi.spyOn()` でモックする。

**テスト出力に出るエラーログ（"Network error" 等）は意図的**で、エラー処理の検証。

## シーズン切り替え（手動更新が必要）

- Mリーグ側の対象期間は `src/config.ts` の `periods` にハードコードしてある
- `M_TOURNAMENT_CONFIG.year` は年を跨がない大会の年。手動で更新する
- 併せて `M_TOURNAMENT_CONFIG.currentSeasonMarker` の正規表現（`/<年>トーナメント/`。
  サイトのメインビジュアルの alt に一致）も新しい年に合わせる。
  **meta description は運営の更新漏れで前シーズン表記のままになることがあるので使わない**
- サイトに `currentSeasonMarker` がマッチしない間は公式データの取得をスキップする
  （前シーズンの試合がカレンダーに混入するのを防ぐため）
- 両方のカレンダー名（`calendar.name`）の年表記も更新する

## その他

- 日程が未公開の月（4月・5月など）は空配列を返す。エラーにしない
- 1 試合はちょうど 4 チーム
- HTTP は外部ライブラリを使わず native `fetch()`
- `pnpm-workspace.yaml` の `minimumReleaseAge`（公開からの待機期間）と `allowBuilds`
  （build script を既定でブロック）は緩めない。サプライチェーン対策で、値と理由はファイル内のコメント

# Mトーナメント 2026公式データ取り込み + 未定カードのイベント化 設計書

## 概要

Mトーナメント公式サイト (<https://m-tournament.m-league.jp/>) が **2026シーズンの
卓組データに更新された**ことを受け、手動 YAML 補助データ依存から脱し、公式サイトの
データで ical を生成する。あわせて、出場者がまだ決まっていない試合
(FINAL系・予選2nd・予選3rd) についても、**出場者なしでイベントだけ生成する**。

最終的なイベント数は **35件** (確定16 + 未定19)。

## 動機・背景

- 現状 `pnpm run fetch` は `official: 0 / extra: 16` で、公式データが一切取り込まれず
  手動 YAML の16件だけが使われている。
- 原因はシーズン判定マーカーの不一致:
  - `currentSeasonMarker: /Mトーナメント\s*2026/` はサイトのどこにもマッチしない。
  - サイトの `meta description` は運営の更新漏れで `『Mトーナメント2025』` のまま。
  - 本物の2026表記はメインビジュアルの `alt="2026トーナメント"` (語順が逆) と
    画像パス `/img/match/2026/`・`/img/profile/2026/`。
- サイトには確定16試合 (予選1st A〜P卓) に加え、出場者未定の枠
  (FINAL系7・予選2nd 4・予選3rd 8 = 19カード) が存在する。これらは現状
  「出場者0人」としてパーサーに捨てられている。スケジュール上は日付・卓・(一部)
  時刻が確定しているため、カレンダーに載せたい。

## スコープ

- シーズンマーカーを実サイトの2026表記に合わせて修正する。
- 出場者未定カードも (出場者なしで) イベント化する。
- 時刻情報を持たない予選セクションに「位置ベース開始時刻」ルールを導入する。
- 空 players 時の iCalendar 出力 (DESCRIPTION 省略) を整える。
- 冗長になる YAML 補助データの該当エントリを削除する。

スコープ外:

- `M_TOURNAMENT_CONFIG.year` の自動判定 (従来通りシーズン切替時に手動更新)。
- X からの自動取得・補助データの仕組み自体の廃止 (将来の先行発表用に維持)。
- UID 体系の刷新 (現状維持。後述「未解決ではない既知挙動」を参照)。

## 採用方針

### シーズンマーカー: `/2026トーナメント/`

- サイトのメインビジュアル `alt="2026トーナメント"` に一致する。
- 前シーズン表示中は `2025トーナメント` なので「2026が来るまで取り込まない」という
  既存のゲート意図をそのまま保てる。
- 代替案 (画像パス `/\/match\/2026\//` 等) は出現箇所が多く堅牢だが意図が読みにくい
  ため不採用。
- シーズン切替時は CLAUDE.md の記載通り `year` と本マーカーを手動で更新する。

### 未定カードのイベント化: 「日付があればイベント」に緩和

- `parseSection` の `if (players.length === 0) return null` を撤廃する。
- イベント成立の必須条件は **日付のみ**。players 空・stage/table 欠落は許容する。
- stage はFINAL系・予選系いずれも必ず取得できるため、タイトルは常に内容を持つ
  (`[FINAL]` `[SEMIFINAL A卓]` `[FINAL STAGE C卓]` `[予選2nd A卓]` など)。

### 予選の開始時刻: 位置ベースルール (`hasTimeInfo: false` セクション限定)

サイトは予選セクションに時刻を載せないため、パース後に**同一日付ごとにカード出現順で**
割り当てる:

- 1番目の試合 → **15:00** (`firstMatchStartTime`、config に新設)
- 2番目の試合 → **19:00** (`defaultStartTime`、既存)
- **3番目以降 → `throw new Error(...)`** (想定外データなので fail-loud)
- 1試合だけの日 → 「最初の試合」として 15:00
- 終了時刻は割当後の開始時刻 + `matchDurationMinutes` で再計算する。

根拠: X投稿で判明していた「同日2試合のうち先の卓が15:00開始」を、サイトデータでも
再現する。現データは全日付が2試合ずつだが、3試合目が出たら静かに誤った時刻を割り当てる
より明示的にエラーで気付ける方が安全。

FINAL系 (`hasTimeInfo: true`) はサイトが明示的に 15:00 / 19:00 を持つため対象外。
本ルールは適用しない。

### 空 players 時の iCalendar 出力

- SUMMARY: 既存ロジックで header のみになる (`[SEMIFINAL A卓]`)。変更不要。
- DESCRIPTION: players が空のとき **DESCRIPTION 行自体を出力しない**
  (`対戦選手:` の宙ぶらりんな行を避ける)。
- VALARM: header のみの SUMMARY を使う。変更不要。

### YAML 補助データの後片付け

- 公式16試合が merge (キー date+stage+table、公式優先) で YAML の同一16件を上書きし、
  15:00情報も位置ベースルールが再現するため、YAML の16エントリは冗長になる。
- `data/m-tournament-extra.yaml` の16エントリを**削除**し、ヘッダ/スキーマコメントと
  仕組みは将来のため残す。
- 結果 `pnpm run fetch` は `official: 35 / extra: 0` になる。

## アーキテクチャ

### 変更ファイル

```text
src/
├── config-tournament.ts             # マーカー修正 + firstMatchStartTime 追加
├── parsers/
│   └── tournament-html-parser.ts    # 空players許容 + 予選の位置ベース時刻
└── generators/
    └── tournament-ical-generator.ts # 空players時 DESCRIPTION 省略

data/
└── m-tournament-extra.yaml          # 16エントリ削除 (コメントは残す)
```

### データフロー (変更後)

```text
MTournamentScraper.fetch()
  → hasTournamentData(html) で c-schedule__list / p-gamesSchedule2__list を確認
  → currentSeasonMarker /2026トーナメント/ がマッチ → parse 続行
  → parseTournamentMatches:
      ・FINAL系 (hasTimeInfo:true): サイト明示の時刻、players は空でも可
      ・予選系 (hasTimeInfo:false): 同日カードを順に 15:00/19:00、3件目はError
      ・確定カード=players付き / 未定カード=players空 の両方を返す (計35件)
  → mergeMatches(official=35, extra=0) → 日付・時刻順ソート
  → generateTournamentICalendar → public/m-tournament-schedule.ics (35 VEVENT)
```

### 生成されるイベント内訳 (現データ)

| セクション | 件数 | players | 時刻ソース |
| --- | --- | --- | --- |
| 予選1st A〜P卓 | 16 | 4人 | 位置ルール (15:00/19:00) |
| 予選2nd A〜D卓 | 4 | なし | 位置ルール |
| 予選3rd A〜H卓 | 8 | なし | 位置ルール |
| FINAL系 | 7 | なし | サイト明示 (15:00/19:00) |

タイトル例:

- 予選1st: `[予選1st A卓] 松本吉弘・…`
- 予選2nd/3rd: `[予選2nd A卓]` (出場者なし)
- FINAL系: `[FINAL]` `[SEMIFINAL A卓]` `[FINAL STAGE C卓]`

## エラーハンドリング

- 同一日付の予選カードが3件以上 → `throw new Error` で fetch 全体を失敗させ、
  想定外のサイト構造変化に気付けるようにする。
- 日付が取れないカード → 従来通り `null` でスキップ (イベント化しない)。
- マーカー不一致 (前シーズン表示中) → 従来通り公式データをスキップし空配列を返す。

## 既知の挙動 (未解決ではない)

- **未定→確定時のUID変化**: UID は `date|stage|table|players` のハッシュ。未定枠は
  players 空で UID が安定するが、後日 players が確定すると UID が変わる。配信フィードでは
  「未定イベントが消えて確定イベントが出る」差し替えになり、重複は残らない。読み取り専用の
  公開カレンダーとしては許容する。in-place 更新が必要になった場合は UID を
  date+stage+table ベースに変える別案がある (本スコープ外)。

## テスト方針

- 既存 `src/__tests__/fixtures/m-tournament.html` フィクスチャは**残す**
  (FINAL系=出場者あり+時刻ありパスの担保)。「空players許容」への挙動変更に伴い、
  player0人カードがイベント化されるようになるため、既存テストの期待カウントを更新する。
- **2026サイトの実HTMLを新フィクスチャとして追加**し、以下を検証:
  - `currentSeasonMarker` が新HTMLに一致する。
  - 予選1stの位置ベース時刻 (A,C,E,G,I,K,M,O卓=15:00 / B,D,F,H,J,L,N,P卓=19:00)。
  - 未定カード (FINAL系・予選2nd・予選3rd) が players 空でイベント化される。
  - 確定カードが引き続き4人の players を持つ (player抽出のリグレッション検出)。
- 合成HTMLで**同日3試合のエラーパス**を検証する。
- generator に**空playersテスト**を追加 (DESCRIPTION 行なし・header のみ SUMMARY)。
- 100% カバレッジを維持する。

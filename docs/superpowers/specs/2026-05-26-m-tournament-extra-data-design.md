# Mトーナメント X補助データ統合 設計書

## 概要

Mトーナメント公式サイト (<https://m-tournament.m-league.jp/>) から取得した
試合データに加え、**X (Twitter) で先行発表される対戦カード**を手動で記録した
補助データ (YAML) を取り込み、同じ `docs/m-tournament-schedule.ics` に統合する。

## 動機・背景

- Mトーナメントの公式サイトは試合確定後に更新される傾向がある
- 一方、X (旧 Twitter) では試合カードが先行発表されるケースがある
- X からの自動取得は API 有料化・ログイン制限・規約問題で現実的でない
- 解決策: **人間が X を見て YAML に手動で転記**、fetcher が公式データとマージする

## スコープ

- 補助データ用 YAML ファイルの読み込み・パース・バリデーション
- 公式データと補助データの重複除去マージ
- バリデーションエラー時の graceful degradation

スコープ外:

- X からの自動取得
- YAML 編集用 UI

## 採用方針

### データ形式: YAML

理由:

- 人間が手で書きやすい
- コメントを書けるので「source の X 投稿 URL」などの注釈を残せる
- 表記揺れに比較的強い

### 重複時の優先: 公式サイト

- 公式サイトに同じ試合が掲載されたら、その時点で公式の情報で上書きされる
- 補助データは「公式に未掲載の試合の先取り」が主目的
- 結果として、X で書いた手動データは公式に追い付かれたら自動的に取って代わられる

### 出力先: 同じ `docs/m-tournament-schedule.ics`

- ユーザーは1つのカレンダーを購読していれば両方の情報を得られる
- 出力URLが増えず運用がシンプル

## アーキテクチャ

### ファイル構成

```text
data/
└── m-tournament-extra.yaml              # 補助データ本体 (gitで管理)

src/
├── parsers/
│   └── tournament-extra-parser.ts       # 新規: YAML読み込み + バリデーション
└── utils/
    └── tournament-merger.ts             # 新規: 重複除去マージ

src/__tests__/
├── tournament-extra-parser.test.ts      # 新規
├── tournament-merger.test.ts            # 新規
└── fixtures/
    └── m-tournament-extra-sample.yaml   # 新規: テスト用フィクスチャ

# 修正:
src/fetcher.ts                           # マージステップを追加
package.json                             # yaml パッケージを依存追加
CLAUDE.md                                # モジュール構成・データフローを更新
```

### データフロー

1. `MTournamentScraper.fetch()` で公式サイトをパース →
   `officialMatches: TournamentMatch[]`
2. `parseExtraData('data/m-tournament-extra.yaml')` で YAML をパース →
   `extraMatches: TournamentMatch[]`
3. `mergeMatches(officialMatches, extraMatches)` で重複を除去 →
   `merged: TournamentMatch[]`
4. `generateTournamentICalendar(merged)` で iCal 生成
5. `docs/m-tournament-schedule.ics` に保存

## データ仕様

### YAML スキーマ (`data/m-tournament-extra.yaml`)

```yaml
# X (Twitter) で発表された対戦カードの手動記録
# 同じ試合が公式サイトに掲載されたら自動的に公式情報に置き換わる
matches:
  - date: "2026-08-15"        # 必須: YYYY-MM-DD
    stage: "予選1st"          # 任意: 例 "予選1st" / "予選2nd" / "FINAL STAGE"
    table: "C卓"              # 任意: 例 "A卓"
    startTime: "190000"       # 任意: HHMMSS。無ければ 190000
    players:                  # 必須: 1人以上の文字列配列
      - 選手A
      - 選手B
      - 選手C
      - 選手D
    url: "https://abema.tv/.."  # 任意: 視聴URL
    source: "https://x.com/.."  # 任意: X投稿URL (人間のためのメモ、parserは利用しない)
```

- ファイルが存在しなくても fetcher は正常動作する
- `matches: []` (空配列) でも正常動作
- `source` は実行時には使われないが、後で見返すための注釈として残す

### バリデーションエラー時の挙動

- **個別エントリのバリデーション失敗**: そのエントリだけ捨ててログ出力、他のエントリは継続
- **YAMLパースエラー (構文エラー)**: ファイル全体を空扱い、ログ出力
- **ファイル不在**: 補助データなしとして扱う (ログ出力なし、これは正常状態)

### バリデーションルール

- `date` は `YYYY-MM-DD` 形式の文字列で存在チェック
- `players` は `string[]` で長さ1以上
- `stage` / `table` / `url` / `source` は存在すれば文字列
- `startTime` は存在すれば `HHMMSS` (6桁数字文字列)

## マージロジック

### 重複判定キー

`(date, stage, table)` の3つ組。

理由:

- 同じ日に同じステージの同じ卓は1試合のみ
- FINAL のように卓名が無い場合は `table=""` でマッチングする
- 補助データで卓名 (例: "C卓") を入れ、後で公式に同じ試合が出てきたら同じキーになって公式優先で上書きされる

### 実装

```typescript
function mergeMatches(
  official: TournamentMatch[],
  extra: TournamentMatch[],
): TournamentMatch[] {
  const keyOf = (m: TournamentMatch) => `${m.date}|${m.stage}|${m.table}`
  const officialKeys = new Set(official.map(keyOf))
  const filteredExtra = extra.filter((m) => !officialKeys.has(keyOf(m)))
  return [...official, ...filteredExtra]
}
```

### ソート

`generateTournamentICalendar` はソートを行わず受け取った順にイベント化するので、
マージ後の配列はユーザーに見える順序になる。

判断: **マージ後に日付順ソートする**。

- 公式と補助が混在しても日付順で見やすい
- 既存の Mリーグでもソートしておらず、サイト掲載順がそのまま出ているが、Mトーナメントは新規実装なのでこの機会にソート対応する

ソートキー: `date` (YYYY-MM-DD) + `startTime`。安定ソートで配列順を温存。

## API設計

### `tournament-extra-parser.ts`

```typescript
import type { TournamentMatch } from '../types/tournament-match'

/**
 * 補助データYAMLファイルを読み込んでTournamentMatchの配列を返す。
 * - ファイル不在: 空配列を返す (ログなし)
 * - YAML構文エラー: 空配列を返す + console.log
 * - 個別エントリのバリデーション失敗: そのエントリだけスキップ + console.log
 */
export function parseExtraData(filePath: string): TournamentMatch[]
```

### `tournament-merger.ts`

```typescript
import type { TournamentMatch } from '../types/tournament-match'

/**
 * 公式データと補助データをマージ。重複時は公式優先。
 * 結果は日付・時刻順にソート。
 */
export function mergeMatches(
  official: TournamentMatch[],
  extra: TournamentMatch[],
): TournamentMatch[]
```

### `fetcher.ts` の修正

`fetchMTournament()` 内で:

```typescript
const officialMatches = await scraper.fetch()
const extraMatches = parseExtraData('data/m-tournament-extra.yaml')
const merged = mergeMatches(officialMatches, extraMatches)

if (merged.length === 0) {
  console.log('No M-Tournament schedule data found')
  return
}

console.log(`\nTotal: ${merged.length} M-Tournament matches found`)
console.log(`  (official: ${officialMatches.length}, extra: ${merged.length - officialMatches.length})`)
const ical = generateTournamentICalendar(merged)
// ...
```

## 依存パッケージ

`yaml` パッケージを追加 (`bun add yaml`)。理由:

- TypeScript/Bun 環境で実績がある軽量YAMLパーサー
- 標準的でメンテナンスされている

## テスト戦略

### `tournament-extra-parser.test.ts`

- 正常なYAMLをパース
- 空ファイルをパース (空配列を返す)
- ファイル不在 (空配列を返す)
- YAML構文エラー (空配列 + ログ)
- date欠落エントリのスキップ
- players欠落エントリのスキップ
- players が空配列のエントリのスキップ
- 不正な date 形式のスキップ
- optional フィールドの省略
- source フィールドは無視されるが取り込み時にエラーにならない

### `tournament-merger.test.ts`

- 重複なし: そのまま結合
- 完全重複: 公式優先で extra は捨てる
- date/stage/table のいずれかが違えば重複ではない
- 空入力 (両方空)
- 片方だけ空
- 日付順でソートされている
- 同日内では startTime 順

### CLAUDE.md 更新

- Module Structure に追加ファイル
- Data Flow に補助データの統合ステップ追記
- Testing Infrastructure に新規テストファイル
- Important Notes に「補助データ追記の運用ガイド」

## 自動テストの100%カバレッジ目標

新規モジュールも既存と同じく Lines 100% を目指す。

## 既存コードへの影響

| ファイル | 変更 |
| --- | --- |
| `src/fetcher.ts` | `fetchMTournament` 内に2行追加（parser呼び出しとマージ） |
| `package.json` | dependency に `yaml` を追加 |

その他の Mリーグ関連コード・Mトーナメントの parser/scraper/generator は無変更。

## 実装フェーズで確定する事項

- yaml パッケージのバージョン (最新安定版を採用予定)
- バリデーションエラーログのフォーマット

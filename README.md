# m-league-ical

Mリーグ・Mトーナメントの試合スケジュールを取得し、カレンダーアプリで購読可能な iCal 形式で出力するツールです。

CI と Pages の実行先、手動 GitHub-hosted 実行は
[ARC CI の運用手順](docs/runbooks/arc-ci.md)を参照してください。

## プログラムの機能

- [Mリーグ公式サイトの日程ページ](https://m-league.jp/games/?mly=2026&mlm=9#schedule)から
  2026年9月〜2027年5月のスケジュールを自動取得し、
  `m-league-schedule.ics` を生成
- [Mトーナメント公式サイト](https://m-tournament.m-league.jp/)から
  対戦カードを自動取得し、`m-tournament-schedule.ics` を生成
  （公式サイトが当シーズンの試合カードを掲載するまでは取り込まない）
- Mトーナメントは公式掲載前に X (旧 Twitter) で先行発表される対戦カードを
  [`data/m-tournament-extra.yaml`](./data/m-tournament-extra.yaml) に
  手動で記録すれば、同じカレンダーに統合される
  （後で公式に同じ試合が掲載されたら自動的に上書き）
- iCal（.ics）形式でエクスポート
- カレンダーアプリ（iPhone、Google Calendar 等）で購読可能

## 取得済みデータの配布

GitHub Pages 上で iCal ファイルを配信しています。

### Mリーグ

```text
https://suzuryo.github.io/m-league-ical/m-league-schedule.ics
```

### Mトーナメント

```text
https://suzuryo.github.io/m-league-ical/m-tournament-schedule.ics
```

両方のカレンダーを別々に購読することも、片方だけ購読することもできます。

## カレンダー購読方法

下記の手順で、上記のいずれかの URL を入力してください。

### 📱 iPhone / iPad

1. 設定アプリを開く
2. 「カレンダー」→「アカウント」→「アカウントを追加」
3. 「その他」→「照会するカレンダーを追加」
4. URLを入力
5. 「次へ」をタップして購読

### 📅 Google Calendar

1. [Google Calendar](https://calendar.google.com)を開く
2. 左側の「他のカレンダー」の「+」をクリック
3. 「URLで追加」を選択
4. URLを入力
5. 「カレンダーを追加」をクリック

### 🍎 Mac Calendar

1. カレンダーアプリを開く
2. メニューバーから「ファイル」→「新規照会カレンダー...」
3. URLを入力
4. 「照会」をクリック

## ローカルの依存取得

通常の `pnpm install` / `pnpm add` は、固定値の `.npmrc` により匿名の Takumi Guard を経由します。
npm の registry 取得にも同じ設定を使います。キーは project config に保存しません。

mise の初回 tool 取得では、npm backend の metadata 取得より前に registry を渡します。
mise の shell activation 後や `mise exec` 内では `mise.toml` の同じ非秘密設定が適用されます。

```sh
NPM_CONFIG_REGISTRY=https://npm.flatt.tech/ PNPM_CONFIG_REGISTRY=https://npm.flatt.tech/ mise install
mise exec -- pnpm install --frozen-lockfile
```

任意のキー認証と安全な取得コマンドは
[共通 runbook](https://github.com/suzuryo/actions-runner-fleet/blob/main/docs/runbooks/takumi-guard.md#ローカルでの取得)
を参照してください。認証失敗時に匿名へ fallback しません。

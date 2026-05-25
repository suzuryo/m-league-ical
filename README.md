# m-league-ical

Mリーグ・Mトーナメントの試合スケジュールを取得し、カレンダーアプリで購読可能な iCal 形式で出力するツールです。

## プログラムの機能

- [Mリーグ公式サイトの日程ページ](https://m-league.jp/games/?mly=2025&mlm=9#schedule)から
  2025年9月〜2026年5月のスケジュールを自動取得し、
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

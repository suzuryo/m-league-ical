# m-league-ical

Mリーグ2025-26シーズンのスケジュールを取得し、カレンダーアプリで購読可能なiCal形式で出力するツールです。

## プログラムの機能

- [Mリーグ公式サイトの日程ページ](https://m-league.jp/games/?mly=2025&mlm=9#schedule)から2025年9月〜2026年5月のスケジュールを自動取得
- iCal（.ics）形式でエクスポート
- カレンダーアプリ（iPhone、Google Calendar等）で購読可能

## 取得済みデータの配布

取得済みデータのiCal形式ファイルは

```
https://suzuryo.github.io/m-league-ical/m-league-schedule.ics
```

のURLに置いてあります。

## カレンダー購読方法

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
4. URLを入力：
5. 「カレンダーを追加」をクリック

### 🍎 Mac Calendar

1. カレンダーアプリを開く
2. メニューバーから「ファイル」→「新規照会カレンダー...」
3. URLを入力
4. 「照会」をクリック

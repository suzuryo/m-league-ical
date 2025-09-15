# m-league-ical

Mリーグ2025-26シーズンのスケジュールを取得し、カレンダーアプリで購読可能なiCal形式で出力するツールです。

## 機能

- [Mリーグ公式サイトの日程ページ](https://m-league.jp/games/?mly=2025&mlm=9#schedule)から2025年9月〜2026年5月のスケジュールを自動取得
- iCal（.ics）形式でエクスポート
- JSON形式でもエクスポート
- カレンダーアプリ（iPhone、Google Calendar等）で購読可能

## カレンダー購読方法

### 📱 iPhone / iPad

1. 設定アプリを開く
2. 「カレンダー」→「アカウント」→「アカウントを追加」
3. 「その他」→「照会するカレンダーを追加」
4. 以下のURLを入力：
   ```
   https://suzuryo.github.io/m-league-ical/m-league-schedule.ics
   ```
5. 「次へ」をタップして購読

### 📅 Google Calendar

1. [Google Calendar](https://calendar.google.com)を開く
2. 左側の「他のカレンダー」の「+」をクリック
3. 「URLで追加」を選択
4. 以下のURLを入力：
   ```
   https://suzuryo.github.io/m-league-ical/m-league-schedule.ics
   ```
5. 「カレンダーを追加」をクリック

### 🍎 Mac Calendar

1. カレンダーアプリを開く
2. メニューバーから「ファイル」→「新規照会カレンダー...」
3. 以下のURLを入力：
   ```
   https://suzuryo.github.io/m-league-ical/m-league-schedule.ics
   ```
4. 「照会」をクリック

## 直接ダウンロード

カレンダーファイルを直接ダウンロードしたい場合：
- [iCalファイル (.ics)](https://suzuryo.github.io/m-league-ical/m-league-schedule.ics)

## 開発者向け

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/suzuryo/m-league-ical.git
cd m-league-ical

# 依存関係をインストール
npm install

# Playwrightのブラウザをインストール
npx playwright install chromium
```

### 使用方法

```bash
# スケジュールを取得してファイルを生成
npm run start
```

### 生成されるファイル

- `docs/m-league-schedule.ics` - GitHub Pages配信用（カレンダー購読用）

### スケジュールの形式

各試合のイベント名は以下の形式で表示されます：
```
[チーム1][チーム2][チーム3][チーム4]
```

- 開始時刻: 19:00（日本時間）
- 終了時刻: 24:00（日本時間）
- 場所: ABEMA TV

## 技術スタック

- TypeScript
- Playwright（Web自動化）
- date-fns（日付処理）

## ライセンス

MIT

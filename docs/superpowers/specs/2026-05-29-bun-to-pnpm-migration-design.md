# bun → pnpm + tsx 移行 設計書

## 概要

このリポジトリのツールチェーンを **bun から pnpm + tsx** に移行する。
bun はパッケージマネージャと TypeScript ランタイムの 2 役を担っているため、
それぞれを pnpm (パッケージ管理) と tsx (TS 直接実行) に置き換える。

## 動機・背景

- bun の利用をやめたい (利用者の方針)
- ソースコードは完全にランタイム非依存
  (`node:fs` / `node:path` / ネイティブ `fetch` / `process.*` のみ。
  `Bun.*` API や `import.meta.main` は不使用)
- テストは既に Vitest (`vitest --run`) で Node 上で動作しており、
  `bun test` には依存していない
- したがって **アプリケーションコードの変更はゼロ**、
  設定ファイルと CI の差し替えのみで移行できる

## スコープ

- パッケージマネージャを bun → pnpm に移行
- TS 実行ランタイムを bun → tsx に移行
- CI (GitHub Actions) を setup-bun → pnpm + setup-node に移行
- サプライチェーン対策 (`minimumReleaseAge`) の pnpm への移植
- ドキュメント (CLAUDE.md) の更新

スコープ外:

- アプリケーションコードの変更 (不要)
- テストフレームワークの変更 (Vitest を継続)
- README.md の変更 (bun への言及なし)
- `.gitignore` の変更 (bun 固有エントリなし)

## 採用方針

### パッケージマネージャ: pnpm

理由:

- 利用者はグローバル設定でも pnpm を使用している
- pnpm 9.15+ は `minimumReleaseAge` をネイティブ対応しており、
  bunfig.toml のサプライチェーン対策をそのまま移植できる
- Renovate は package.json + pnpm-lock.yaml を npm manager として
  自動検出するため、既存の Renovate 設定が継続動作する

### TS ランタイム: tsx

理由:

- ソースの relative import が拡張子なし
  (`./generators/ical-generator` 等) のため、
  Node ネイティブの `--experimental-strip-types` では
  import の書き換え (`.ts` 付与) が必要になる
- tsx は esbuild ベースの解決で拡張子なし import を
  そのまま扱えるため、コード変更が不要

### バージョン管理: mise + packageManager フィールド

- ローカルは mise.toml で node + pnpm のバージョンを固定
- package.json の `"packageManager"` フィールドで pnpm 版を明示し、
  CI の pnpm/action-setup がこれを参照する

## サプライチェーン対策の移植

bunfig.toml の現行設定:

```toml
[install]
minimumReleaseAge = 259200  # 259200 秒 = 3 日
```

pnpm の `minimumReleaseAge` は **分単位** のため、3 日 = **4320 分**。
`pnpm-workspace.yaml` に記述する:

```yaml
minimumReleaseAge: 4320
```

- pnpm 11 は `minimumReleaseAge` を明示設定すると strict モードが
  デフォルトで有効になり、設定が強制される
- Renovate 側の `minimumReleaseAge: '4 days'` は bun 時代と同様、
  pnpm の 3 日より長く設定することで PR 作成時点で
  `pnpm install` が確実に解決できるバッファとして維持する

## 変更ファイル一覧

| ファイル | 概要 |
| --- | --- |
| `bunfig.toml` | 削除 |
| `pnpm-workspace.yaml` | 新規作成 |
| `bun.lock` | 削除 |
| `pnpm-lock.yaml` | 新規生成 |
| `package.json` | scripts / devDeps を更新 |
| `tsconfig.json` | types を更新 |
| `mise.toml` | tools を更新 |
| `.github/workflows/ci.yml` | CI を pnpm 化 |
| `renovate.json5` | コメントを更新 |
| `CLAUDE.md` | コマンド例を更新 |

各ファイルの詳細:

- `pnpm-workspace.yaml`: 新規作成し `minimumReleaseAge: 4320` を記述
- `pnpm-lock.yaml`: `pnpm install` で新規生成
- `package.json`:
  - scripts (fetch / start / dev) を
    `bun run src/fetcher.ts` → `tsx src/fetcher.ts`
  - devDependencies から `@types/bun` を削除し
    `tsx` と `@types/node` を追加
  - `"packageManager": "pnpm@11.3.0"` を追加
- `tsconfig.json`: `"types": ["bun-types"]` → `["node"]`
- `mise.toml`: `bun = "1.3"` → `node = "24"` + `pnpm = "11"`
- `.github/workflows/ci.yml`:
  - `oven-sh/setup-bun` を
    `pnpm/action-setup` + `actions/setup-node` (cache: pnpm) に置換
  - `bun install --frozen-lockfile` → `pnpm install --frozen-lockfile`
  - `bun run X` → `pnpm run X`
  - 既存方針に合わせて新規 action は SHA ピン留め
- `renovate.json5`: コメント中の `bunfig.toml` 参照を
  `pnpm-workspace.yaml` に更新 (設定値は維持)
- `CLAUDE.md`: `bun run X` → `pnpm run X`、`bun install` → `pnpm install`、
  `bunx vitest` → `pnpm vitest`、bunfig.toml の記述を
  pnpm-workspace.yaml に修正

## エラーハンドリング / 注意点

- `tsconfig.json` から `bun-types` を外すと Node グローバル
  (`process` 等) の型が失われるため、`@types/node` を必ず追加する
- CI で `pnpm/action-setup` と `actions/setup-node` の順序に注意
  (pnpm を先に有効化してから setup-node の cache: pnpm を使う)
- 既存 CI は action を SHA ピン留めしている
  (renovate `helpers:pinGitHubActionDigests`) ため、
  新規追加する action も SHA ピン留めする

## 検証方針

移行後、以下が全て成功することを確認する:

1. `pnpm install` (lockfile 生成、frozen でない初回)
2. `pnpm run lint` (Biome)
3. `pnpm run typecheck` (tsc --noEmit)
4. `pnpm run test` (Vitest 108 tests)
5. `pnpm run fetch` (.ics ファイル生成)

CI は PR 上で lint / typecheck / test の 3 ジョブが green になることを確認する。

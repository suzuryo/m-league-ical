# Node.js/ESLint から Bun/Biome への移行設計

## 概要

m-league-ical プロジェクトのツールスタックを
Node.js + pnpm + tsx + esbuild + ESLint + Prettier から
Bun + Biome に移行する。

## 移行前後の比較

| 役割 | 移行前 | 移行後 |
| --- | --- | --- |
| ランタイム | Node.js 24 | Bun 1.3 |
| パッケージマネージャ | pnpm 10 | Bun (組み込み) |
| TypeScript 実行 | tsx | Bun (ネイティブ) |
| バンドラー | esbuild | 削除 (Bun 直接実行) |
| Lint + Format | ESLint + Prettier + sort | Biome |
| 型チェック | tsc --noEmit | tsc --noEmit |
| テスト | Vitest | Vitest |
| バージョン管理 | mise (node, pnpm) | mise (bun) |

## 段階的移行アプローチ

1つのブランチ内で段階的にコミットし、
最終的に1つのPRにまとめる。

### ステップ1: Biome 導入 (ESLint + Prettier 置き換え)

**追加:**

- `biome.json` を新規作成
  - フォーマッター: セミコロンなし、シングルクォート、
    2スペースインデント
  - import ソート: `organizeImports` を有効化
  - linter: recommended ルールを有効化
- `@biomejs/biome` を devDependencies に追加

**削除:**

- `eslint.config.mjs`
- devDependencies: `eslint`, `@eslint/js`,
  `typescript-eslint`, `eslint-config-prettier`,
  `eslint-plugin-prettier`, `eslint-plugin-simple-import-sort`,
  `prettier`

**変更:**

- package.json scripts:
  - `lint`: `eslint .` → `biome check .`
  - `format` (新規): `biome check --write .`

### ステップ2: pnpm/Node.js/tsx/esbuild → Bun 移行

**追加:**

- `bun.lock` (bun install で生成)
- `@types/bun` を devDependencies に追加

**削除:**

- `pnpm-lock.yaml`
- `dist/` ディレクトリ
- devDependencies: `tsx`, `esbuild`, `@types/node`

**変更:**

- `mise.toml`:
  `node = "24"` + `pnpm = "latest"` → `bun = "1.3"`
- `tsconfig.json`: `types` を `["bun-types"]` に変更
- package.json scripts:
  - `fetch`: `bun run src/fetcher.ts`
  - `dev`: 同上
  - `start`: `bun run src/fetcher.ts`
  - `build`: 削除
  - `typecheck`: `tsc --noEmit` (変更なし)
  - `test`: `vitest --run` (変更なし)
  - `test:coverage`: `vitest --run --coverage` (変更なし)

**ソースコード:**

- 変更なし。`process.exit(1)` は Bun 互換のため維持。

### ステップ3: GitHub Actions CI 移行

**ci.yml:**

- `pnpm/action-setup` + `actions/setup-node` →
  `oven-sh/setup-bun` に置き換え
- `matrix.node-version` を削除
- `bun install --frozen-lockfile`
- `bun run *` に統一
- `build` ジョブを削除
- `typecheck` ジョブを追加

**github-pages.yml:**

- 変更なし (静的ファイルデプロイのみ)

**dependabot.yml:**

- 変更なし (`package-ecosystem: npm` は Bun でも有効)

## 変更しないもの

- Vitest (テストランナー・設定ともに維持)
- `vitest.config.ts`
- テストコード (`src/__tests__/*.test.ts`)
- ソースコード本体 (`src/**/*.ts`)
- `src/fetcher.ts` の `process.exit(1)`
- GitHub Pages デプロイワークフロー
- dependabot 設定

# Bun/Biome 移行 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL:
> Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Node.js + pnpm + tsx + esbuild + ESLint + Prettier から
Bun + Biome に移行する

**Architecture:** 段階的に移行する。
まず Biome を導入して ESLint/Prettier を置き換え、
次に Bun に切り替え、最後に CI を更新する。

**Tech Stack:** Bun 1.3, Biome, Vitest, TypeScript

---

## Task 1: フィーチャーブランチを作成

**Files:**

- なし (git操作のみ)

- [ ] **Step 1: ブランチを作成**

```bash
git checkout -b refactor/bun-biome-migration
```

---

## Task 2: Biome を導入し ESLint + Prettier を削除

**Files:**

- Create: `biome.json`
- Delete: `eslint.config.mjs`
- Modify: `package.json`

- [ ] **Step 1: ESLint 関連パッケージを削除**

```bash
pnpm remove eslint @eslint/js typescript-eslint \
  eslint-config-prettier eslint-plugin-prettier \
  eslint-plugin-simple-import-sort prettier
```

- [ ] **Step 2: Biome をインストール**

```bash
pnpm add -D @biomejs/biome
```

- [ ] **Step 3: `biome.json` を作成**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "files": {
    "ignore": ["dist/", "node_modules/", "docs/", "coverage/"]
  }
}
```

注意: `$schema` の URL は `biome --version` で確認した
実際のバージョンに合わせること。

- [ ] **Step 4: `eslint.config.mjs` を削除**

```bash
rm eslint.config.mjs
```

- [ ] **Step 5: `package.json` の scripts を更新**

`lint` と `format` を以下に変更:

```json
{
  "scripts": {
    "lint": "biome check .",
    "format": "biome check --write ."
  }
}
```

他の scripts (`fetch`, `dev`, `start`, `build`,
`typecheck`, `test`, `test:coverage`) はそのまま維持。

- [ ] **Step 6: Biome でフォーマットを適用**

```bash
pnpm run format
```

既存コードに Biome のフォーマットルールを適用する。
差分が出る場合があるが、フォーマットの違いのみ。

- [ ] **Step 7: lint が通ることを確認**

```bash
pnpm run lint
```

Expected: エラーなし。
lint エラーが出た場合は修正する。

- [ ] **Step 8: テストが通ることを確認**

```bash
pnpm run test
```

Expected: 全テスト PASS (47 tests)

- [ ] **Step 9: コミット**

```bash
git add biome.json package.json pnpm-lock.yaml src/
git commit -m "refactor: ESLint+PrettierをBiomeに置き換え"
```

`eslint.config.mjs` の削除もステージングに含める:

```bash
git add eslint.config.mjs
git commit --amend --no-edit
```

注意: 削除ファイルは `git add` で自動的にステージされるが、
念のため明示的に追加する。正しくは最初の `git add` に含める:

```bash
git add biome.json package.json pnpm-lock.yaml src/ eslint.config.mjs
git commit -m "refactor: ESLint+PrettierをBiomeに置き換え"
```

---

## Task 3: pnpm/Node.js/tsx/esbuild → Bun に移行

**Files:**

- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `mise.toml`
- Modify: `.gitignore`
- Delete: `pnpm-lock.yaml`
- Create: `bun.lock` (自動生成)

- [ ] **Step 1: mise.toml を更新**

`mise.toml` を以下の内容に変更:

```toml
[tools]
bun = "1.3"
```

- [ ] **Step 2: Bun をインストール**

```bash
mise install
```

Expected: Bun 1.3.x がインストールされる

- [ ] **Step 3: 不要な devDependencies を削除**

```bash
pnpm remove tsx esbuild @types/node
```

- [ ] **Step 4: `@types/bun` をインストール**

`pnpm-lock.yaml` を削除し、Bun に切り替える:

```bash
rm pnpm-lock.yaml
bun add -D @types/bun
```

これにより `bun.lock` が生成される。

- [ ] **Step 5: `tsconfig.json` を更新**

`types` を `["bun-types"]` に変更:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "lib": ["ES2024", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "allowSyntheticDefaultImports": true,
    "verbatimModuleSyntax": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: `package.json` の scripts を更新**

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "fetch": "bun run src/fetcher.ts",
    "start": "bun run src/fetcher.ts",
    "dev": "bun run src/fetcher.ts",
    "lint": "biome check .",
    "format": "biome check --write .",
    "test": "vitest --run",
    "test:coverage": "vitest --run --coverage"
  }
}
```

変更点:

- `fetch`: `tsx src/fetcher.ts` → `bun run src/fetcher.ts`
- `dev`: 同上
- `start`: `pnpm run build && node dist/fetcher.js`
  → `bun run src/fetcher.ts`
- `build`: 削除

- [ ] **Step 7: `.gitignore` を更新**

`dist/` はビルドしなくなるが、
念のため `.gitignore` に残しておく。変更なし。

- [ ] **Step 8: 型チェックが通ることを確認**

```bash
bun run typecheck
```

Expected: エラーなし

- [ ] **Step 9: テストが通ることを確認**

```bash
bun run test
```

Expected: 全テスト PASS (47 tests)

- [ ] **Step 10: lint が通ることを確認**

```bash
bun run lint
```

Expected: エラーなし

- [ ] **Step 11: コミット**

```bash
git add package.json tsconfig.json mise.toml bun.lock .gitignore
git rm pnpm-lock.yaml
git commit -m "refactor: pnpm/Node.js/tsx/esbuildからBunに移行"
```

---

## Task 4: GitHub Actions CI を Bun に移行

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: `ci.yml` を更新**

```yaml
name: ci

on:
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: lint
        run: bun run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: typecheck
        run: bun run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: test
        run: bun run test
```

変更点:

- `pnpm/action-setup` + `actions/setup-node`
  → `oven-sh/setup-bun@v2`
- `matrix.node-version` を削除
- `pnpm install` → `bun install`
- `pnpm run *` → `bun run *`
- `build` ジョブを削除
- `typecheck` ジョブを新規追加

- [ ] **Step 2: コミット**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: GitHub Actions CIをBunに移行"
```

---

## Task 5: 不要ファイルの整理と最終確認

**Files:**

- 確認のみ

- [ ] **Step 1: 不要なファイルが残っていないか確認**

```bash
ls -la | grep -E "prettier|eslint"
```

Expected: 何も表示されない
(`.prettierrc` 等が残っていれば削除)

- [ ] **Step 2: 全テスト・lint・型チェックを実行**

```bash
bun run lint && bun run typecheck && bun run test
```

Expected: すべて PASS

- [ ] **Step 3: fetch が動作することを確認**

```bash
bun run fetch
```

Expected: M-League のスケジュールを取得し
`docs/m-league-schedule.ics` に出力される

---

## Task 6: CLAUDE.md を更新

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md のコマンド説明を更新**

Bun ベースのコマンドに書き換える:

- `npm run fetch` → `bun run fetch`
- `npm run dev` → `bun run dev`
- `npm start` → `bun run start`
- `npm test` → `bun run test`
- `npm run build` の記述を削除
- `npm install` → `bun install`
- `npm run lint` → `bun run lint`
- `npm run typecheck` → `bun run typecheck`
- `npx vitest` → `bunx vitest`
- esbuild に関する記述を削除
- tsx に関する記述を Bun に変更
- pnpm の記述を削除

Architecture セクションも更新:

- Build System の説明を Bun に変更
- 「Development: Uses tsx」→
  「Development: Uses Bun (native TypeScript execution)」
- 「Production: Uses esbuild」→ 削除

- [ ] **Step 2: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.mdをBun/Biome構成に更新"
```

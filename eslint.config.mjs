import eslint from '@eslint/js'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', '*.js', '*.mjs', '*.cjs'],
  },
  eslintPluginPrettierRecommended,
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'prettier/prettier': [
        'error',
        {
          semi: false,
          singleQuote: true,
        },
      ],
    },
  },
)

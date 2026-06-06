import js from '@eslint/js'
import ts from 'typescript-eslint'

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
]

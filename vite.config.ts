import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  base: './',
  build: {
    target: 'es2020',
  },
  test: {
    // 既定は node。UI テストはファイル先頭に `// @vitest-environment happy-dom` を付けて指定する。
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    passWithNoTests: true,
  },
});

// Validates: Requirements 15.1, 15.2, 11.6
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
let outDir = '';
let html = '';

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'machi-build-'));
  // VITE_SUPABASE_* を除いた環境でビルドする(.env ファイルが無い前提。あっても mode=smoke で読まれない)
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('VITE_')) delete env[k];
  execFileSync(
    process.execPath,
    [
      resolve(root, 'node_modules/vite/bin/vite.js'),
      'build',
      '--mode',
      'smoke',
      '--outDir',
      outDir,
      '--emptyOutDir',
      '--logLevel',
      'error',
    ],
    { cwd: root, env, stdio: 'pipe' },
  );
  html = readFileSync(join(outDir, 'index.html'), 'utf-8');
}, 110_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe('build smoke test', () => {
  it('index.html has no external script src or stylesheet link', () => {
    const doc = new Window().document;
    doc.write(html);
    expect(doc.querySelectorAll('script[src]').length).toBe(0);
    expect(doc.querySelectorAll('link[rel="stylesheet"]').length).toBe(0);
    expect(doc.querySelectorAll('script').length).toBeGreaterThan(0);
  });

  it('without VITE_SUPABASE_* the game starts and ranking is disabled', async () => {
    const win = new Window({ url: 'http://localhost/' });
    win.localStorage.setItem('machi.player', JSON.stringify({ name: 'テスト' }));
    win.document.write(html.replace(/<script[\s\S]*?<\/script>/g, ''));
    const code = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    win.eval(code);
    await new Promise((r) => setTimeout(r, 100));

    const labels = () => [...win.document.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels()).toContain('ゲーム開始');
    expect(labels()).not.toContain('ランキング');

    const start = [...win.document.querySelectorAll('button')].find((b) => b.textContent === 'ゲーム開始');
    start!.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(labels()).not.toContain('ゲーム開始');
    expect(win.document.querySelector('.start-screen')).toBeNull();
    await win.happyDOM.abort();
  });
});

// @vitest-environment happy-dom

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { renderLoginScreen } from '../src/ui/screens/login-screen';
import { openRankingScreen } from '../src/ui/screens/ranking-screen';
import { renderStartScreen } from '../src/ui/screens/start-screen';

// 制御文字を含まない名前(入力欄は改行等を正規化するため)。HTML 風の文字列を多めに生成する
const htmlLike = fc.oneof(
  fc.constantFrom(
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<b>bold</b>',
    '&lt;i&gt;&amp;',
    '"><svg/onload=1>',
    '<',
    '>',
    '&',
  ),
  fc.string({ minLength: 1, maxLength: 20 }),
);
const nameArb = fc
  .array(htmlLike, { minLength: 1, maxLength: 3 })
  .map((parts) => parts.join(''))
  // eslint-disable-next-line no-control-regex
  .filter((s) => !/[\u0000-\u001f\u007f-\u009f]/.test(s) && s.trim().length > 0);

const noop = (): void => {};

// Feature: mahjong-machi-quiz-game, Property 25: 名前はテキストとして表示される
describe('Property 25: 名前はテキストとして表示される', () => {
  it('ランキング行の名前はテキストとして表示され、要素は注入されない', async () => {
    // **Validates: Requirements 10.7, 13.7, 13.8**
    await fc.assert(
      fc.asyncProperty(fc.array(nameArb, { minLength: 1, maxLength: 5 }), nameArb, async (names, me) => {
        const entries = names.map((name, i) => ({
          rank: i + 1,
          name,
          totalScore: 100 - i,
          createdAt: '2024-01-02T03:04:05Z',
        }));
        const el = await openRankingScreen({
          client: { fetchRanking: async () => ({ status: 'ok' as const, entries }) },
          refresh: async () => true,
          playerName: me,
          onBack: noop,
        });
        expect(el).not.toBeNull();
        await new Promise((r) => setTimeout(r, 0));
        const cells = Array.from(el!.querySelectorAll('td.name'));
        expect(cells.length).toBe(names.length);
        cells.forEach((td, i) => {
          expect(td.textContent).toBe(names[i]);
          expect(td.children.length).toBe(0);
        });
        // 行・セルの構造は名前の内容に影響されない
        expect(el!.querySelectorAll('tbody tr').length).toBe(names.length);
        expect(el!.querySelectorAll('script, img, svg, b, i').length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('Start 画面の名前はテキストとして表示され、要素は注入されない', () => {
    // **Validates: Requirements 10.7, 13.7, 13.8**
    fc.assert(
      fc.property(nameArb, (name) => {
        const el = renderStartScreen({
          playerName: name,
          availability: 'enabled',
          onStart: noop,
          onExplanation: noop,
          onChangeName: noop,
          onRanking: noop,
        });
        const span = el.querySelector('.player-name')!;
        expect(span.textContent).toBe(name);
        expect(span.children.length).toBe(0);
        expect(el.querySelectorAll('script, img, svg, b, i').length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('Login 画面の入力欄の初期値は名前そのままで、要素は注入されない', () => {
    // **Validates: Requirements 10.7, 13.7, 13.8**
    fc.assert(
      fc.property(nameArb, (name) => {
        const el = renderLoginScreen({ initialName: name, persistent: true, onConfirm: noop });
        const input = el.querySelector('input#player-name') as HTMLInputElement;
        expect(input.value).toBe(name);
        expect(el.querySelectorAll('script, img, svg, b, i').length).toBe(0);
        expect(el.querySelectorAll('input').length).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});

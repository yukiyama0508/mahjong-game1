import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { validateName } from '../src/domain/name-validator';

const piece = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 6 }),
  fc.constantFrom('😀', '👨‍👩‍👧', '麻雀', 'あ', 'A', ' ', '\u3000', '\t', '\n', '\u0000', '\u001f', '\u007f', '\u009f'),
);
const nameArb = fc.array(piece, { maxLength: 30 }).map((a) => a.join(''));
// 長さの境界付近を狙う
const boundaryArb = fc
  .tuple(fc.integer({ min: 15, max: 25 }), fc.constantFrom('a', '😀', '麻'), fc.constantFrom('', ' ', '\u3000'))
  .map(([n, c, sp]) => sp + c.repeat(n) + sp);

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

// Feature: mahjong-machi-quiz-game, Property 23: 名前の検証
describe('Property 23: 名前の検証', () => {
  /** **Validates: Requirements 9.2, 13.2, 13.3** */
  it('trim後のコードポイント数1〜20かつ制御文字なしのときに限り成功し、理由が仕様どおり', () => {
    fc.assert(
      fc.property(fc.oneof(nameArb, boundaryArb), (s) => {
        const t = s.trim();
        const len = [...t].length;
        const r = validateName(s);
        if (len === 0) {
          expect(r).toEqual({ ok: false, error: 'empty' });
        } else if (CONTROL.test(t)) {
          expect(r).toEqual({ ok: false, error: 'control' });
        } else if (len > 20) {
          expect(r).toEqual({ ok: false, error: 'tooLong' });
        } else {
          expect(r).toEqual({ ok: true, value: t });
          // 冪等性
          expect(validateName(t)).toEqual(r);
        }
      }),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 9.2, 13.2** */
  it('全角スペース・空白だけの文字列は empty になる', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('\u3000', ' ', '\t'), { maxLength: 30 }).map((a) => a.join('')), (s) => {
        expect(validateName(s)).toEqual({ ok: false, error: 'empty' });
      }),
      { numRuns: 100 },
    );
  });
});

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { initialStreak, nextKind, onPresented, onJudged } from '../src/domain/streak-manager';

const corrects = fc.array(fc.boolean(), { minLength: 0, maxLength: 60 });

describe('Property 15: Streak は常に 0〜3 で、遷移規則に従う', () => {
  // Feature: mahjong-machi-quiz-game, Property 15: Streak は常に 0〜3 で、遷移規則に従う
  /** **Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6, 4.13** */
  it('範囲 0..3 と遷移規則を満たす', () => {
    fc.assert(
      fc.property(corrects, (seq) => {
        let s = initialStreak;
        for (const correct of seq) {
          const kind = nextKind(s);
          const before = s.streak;
          const presented = onPresented(s, kind);
          if (kind === 'chinitsu') expect(presented.streak).toBe(0);
          else expect(presented.streak).toBe(before);
          s = onJudged(presented, kind, correct);
          if (kind === 'chinitsu') expect(s.streak).toBe(0);
          else if (correct) expect(s.streak).toBe(Math.min(3, before + 1));
          else expect(s.streak).toBe(0);
          expect(Number.isInteger(s.streak)).toBe(true);
          expect(s.streak).toBeGreaterThanOrEqual(0);
          expect(s.streak).toBeLessThanOrEqual(3);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property 16: 出題種別の並び', () => {
  // Feature: mahjong-machi-quiz-game, Property 16: 出題種別の並び
  /** **Validates: Requirements 4.4, 4.7, 4.8** */
  it('通常問題3連続正解の直後だけが清一色問題になる', () => {
    fc.assert(
      fc.property(corrects, (seq) => {
        let s = initialStreak;
        let run = 0; // 開始または直前の清一色提示以降の、通常問題の連続正解数
        for (const correct of seq) {
          const kind = nextKind(s);
          expect(kind).toBe(run >= 3 ? 'chinitsu' : 'normal');
          s = onPresented(s, kind);
          if (kind === 'chinitsu') run = 0;
          s = onJudged(s, kind, correct);
          if (kind === 'normal') run = correct ? run + 1 : 0;
        }
      }),
      { numRuns: 200 },
    );
  });
});

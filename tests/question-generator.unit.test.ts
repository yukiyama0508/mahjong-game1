import { describe, expect, it } from 'vitest';
import { parseHand, serializeHand } from '../src/domain/hand-parser';
import {
  CHINITSU_FALLBACKS,
  generateQuestion,
  NORMAL_FALLBACKS,
  validateChinitsuQuestion,
  validateNormalQuestion,
} from '../src/domain/question-generator';
import type { Question } from '../src/domain/question-generator';
import type { Rng } from '../src/domain/rng';
import { createSeededRng } from '../src/domain/rng';
import { scoreQuestion } from '../src/domain/score-calculator';
import { calcWaits } from '../src/domain/wait-calculator';
import { classifyHand } from '../src/domain/wait-classifier';
import type { WaitType } from '../src/domain/wait-classifier';

const ORDER: readonly WaitType[] = ['ryanmen', 'kanchan', 'penchan', 'shabo', 'tanki', 'chiitoiTanki', 'multi'];

const firstThen = (first: number, seed: number): Rng => {
  const rest = createSeededRng(seed);
  let called = false;
  return {
    next: () => {
      if (!called) {
        called = true;
        return first;
      }
      return rest.next();
    },
  };
};

const build = (s: string, kind: 'normal' | 'chinitsu', targetType: WaitType | null): Question => {
  const r = parseHand(s);
  if (!r.ok) throw new Error(s);
  const hand = [...r.value].sort((a, b) => a - b);
  const w = calcWaits(hand);
  if (!w.ok) throw new Error(s);
  return { kind, targetType, hand, handKey: serializeHand(hand), waits: w.value, scoring: scoreQuestion(hand, w.value) };
};

describe('generateQuestion: target wait type selection (Req 3.4)', () => {
  ORDER.forEach((type, k) => {
    it(`rng near ${k}/7 selects ${type}`, () => {
      const q = generateQuestion('normal', firstThen((k + 0.5) / 7, 1234 + k), null);
      expect(q.kind).toBe('normal');
      expect(q.targetType).toBe(type);
      expect(validateNormalQuestion(q)).toBe(true);
    });
  });
});

describe('fallback hands (Req 3.9, 4.12)', () => {
  it('every normal fallback is valid and covers all 7 wait types', () => {
    const types = new Set<WaitType>();
    for (const s of NORMAL_FALLBACKS) {
      const r = parseHand(s);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const type = classifyHand(r.value).type as WaitType;
      types.add(type);
      expect(validateNormalQuestion(build(s, 'normal', type))).toBe(true);
    }
    expect([...types].sort()).toEqual([...ORDER].sort());
  });

  it('has 5+ chinitsu fallbacks, all valid', () => {
    expect(CHINITSU_FALLBACKS.length).toBeGreaterThanOrEqual(5);
    for (const s of CHINITSU_FALLBACKS) {
      expect(validateChinitsuQuestion(build(s, 'chinitsu', null))).toBe(true);
    }
  });
});

describe('generateQuestion falls back when candidates are always rejected', () => {
  // 定数 rng は同一牌を繰り返し引くため候補が常に不正(5枚目)になる
  const constant = (v: number): Rng => ({ next: () => v });

  it('chinitsu returns a fallback hand', () => {
    const q = generateQuestion('chinitsu', constant(0.99), null);
    const keys = CHINITSU_FALLBACKS.map((s) => build(s, 'chinitsu', null).handKey);
    expect(keys).toContain(q.handKey);
    expect(validateChinitsuQuestion(q)).toBe(true);
  });

  // chiitoiTanki は異なる6種を引くまでループするため定数 rng では終了しない。
  // 6種の対子 + 先頭牌をもう1枚(刻子+5対子 = ノーテン)を毎回作る周期7の rng を使う。
  const chiitoiRejecting = (): Rng => {
    const tiles = [0, 2, 4, 6, 8, 10, 0];
    let i = -1;
    return {
      next: () => {
        i += 1;
        if (i === 0) return (5 + 0.5) / 7; // chiitoiTanki を選ぶ
        return (tiles[(i - 1) % tiles.length] + 0.5) / 34;
      },
    };
  };

  ORDER.forEach((type, k) => {
    it(`normal (${type}) returns a fallback hand`, () => {
      const rng = type === 'chiitoiTanki' ? chiitoiRejecting() : constant((k + 0.5) / 7);
      const q = generateQuestion('normal', rng, null);
      const keys = NORMAL_FALLBACKS.map((s) => build(s, 'normal', null).handKey);
      expect(q.targetType).toBe(type);
      expect(keys).toContain(q.handKey);
      expect(validateNormalQuestion(q)).toBe(true);
    });
  });

  it('avoids the previous handKey when other fallbacks exist', () => {
    const prev = build(CHINITSU_FALLBACKS[0], 'chinitsu', null).handKey;
    const q = generateQuestion('chinitsu', constant(0.99), prev);
    expect(q.handKey).not.toBe(prev);
  });
});

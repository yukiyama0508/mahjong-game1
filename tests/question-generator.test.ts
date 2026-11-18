import { describe, expect, it } from 'vitest';
import { parseHand, serializeHand } from '../src/domain/hand-parser';
import {
  CHINITSU_FALLBACKS,
  NORMAL_FALLBACKS,
  generateQuestion,
  validateChinitsuQuestion,
  validateNormalQuestion,
} from '../src/domain/question-generator';
import type { Question, QuestionKind } from '../src/domain/question-generator';
import { createSeededRng } from '../src/domain/rng';
import { scoreQuestion } from '../src/domain/score-calculator';
import { calcWaits } from '../src/domain/wait-calculator';
import { classifyHand } from '../src/domain/wait-classifier';

const toQuestion = (s: string, kind: QuestionKind): Question => {
  const r = parseHand(s);
  if (!r.ok) throw new Error(s);
  const w = calcWaits(r.value);
  const waits = w.ok ? w.value : [];
  return {
    kind,
    targetType: kind === 'normal' ? classifyHand(r.value).type : null,
    hand: r.value,
    handKey: serializeHand(r.value),
    waits,
    scoring: scoreQuestion(r.value, waits),
  };
};

describe('fallbacks', () => {
  it.each(NORMAL_FALLBACKS)('normal fallback %s is valid', (s) => {
    expect(validateNormalQuestion(toQuestion(s, 'normal'))).toBe(true);
  });

  it('normal fallbacks cover all 7 wait types', () => {
    const types = new Set(NORMAL_FALLBACKS.map((s) => toQuestion(s, 'normal').targetType));
    expect(types.size).toBe(7);
  });

  it('has at least 5 chinitsu fallbacks', () => {
    expect(CHINITSU_FALLBACKS.length).toBeGreaterThanOrEqual(5);
  });

  it.each(CHINITSU_FALLBACKS)('chinitsu fallback %s is valid', (s) => {
    expect(validateChinitsuQuestion(toQuestion(s, 'chinitsu'))).toBe(true);
  });
});

describe('generateQuestion', () => {
  it('returns valid normal questions for many seeds and covers all wait types', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const q = generateQuestion('normal', createSeededRng(seed), null);
      expect(validateNormalQuestion(q)).toBe(true);
      seen.add(String(q.targetType));
    }
    expect(seen.size).toBe(7);
  });

  it('returns valid chinitsu questions for many seeds', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const q = generateQuestion('chinitsu', createSeededRng(seed), null);
      expect(validateChinitsuQuestion(q)).toBe(true);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateQuestion('normal', createSeededRng(42), null);
    const b = generateQuestion('normal', createSeededRng(42), null);
    expect(a.handKey).toBe(b.handKey);
  });

  it('does not repeat the previous handKey', () => {
    for (const kind of ['normal', 'chinitsu'] as const) {
      for (let seed = 1; seed <= 50; seed++) {
        const first = generateQuestion(kind, createSeededRng(seed), null);
        const second = generateQuestion(kind, createSeededRng(seed), first.handKey);
        expect(second.handKey).not.toBe(first.handKey);
      }
    }
  });
});

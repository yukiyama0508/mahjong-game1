import { describe, expect, it } from 'vitest';
import { initialStreak, nextKind, onJudged, onPresented } from '../src/domain/streak-manager';

describe('streak-manager', () => {
  it('starts at 0 with a normal question', () => {
    expect(initialStreak.streak).toBe(0);
    expect(nextKind(initialStreak)).toBe('normal');
  });

  it('increments on normal correct, capped at 3', () => {
    let s = initialStreak;
    for (let i = 1; i <= 5; i++) {
      s = onJudged(s, 'normal', true);
      expect(s.streak).toBe(Math.min(3, i));
    }
  });

  it('resets on normal incorrect', () => {
    expect(onJudged({ streak: 2 }, 'normal', false).streak).toBe(0);
  });

  it('chooses chinitsu at streak 3 only', () => {
    expect(nextKind({ streak: 2 })).toBe('normal');
    expect(nextKind({ streak: 3 })).toBe('chinitsu');
  });

  it('resets on chinitsu presented and keeps 0 after judging', () => {
    const p = onPresented({ streak: 3 }, 'chinitsu');
    expect(p.streak).toBe(0);
    expect(onJudged(p, 'chinitsu', true).streak).toBe(0);
    expect(onJudged(p, 'chinitsu', false).streak).toBe(0);
  });

  it('does not change streak when a normal question is presented', () => {
    expect(onPresented({ streak: 2 }, 'normal').streak).toBe(2);
  });
});

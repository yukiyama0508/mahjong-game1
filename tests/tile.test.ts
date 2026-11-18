import { describe, expect, it } from 'vitest';
import { numberOf, sortForDisplay, suitOf, tileLabel, toCounts } from '../src/domain/tile';

describe('tile', () => {
  it('suitOf / numberOf', () => {
    expect(suitOf(0)).toBe('m');
    expect(suitOf(9)).toBe('p');
    expect(suitOf(26)).toBe('s');
    expect(suitOf(33)).toBe('z');
    expect(numberOf(8)).toBe(9);
    expect(numberOf(27)).toBe(1);
    expect(numberOf(33)).toBe(7);
  });

  it('toCounts counts tiles', () => {
    const c = toCounts([0, 0, 0, 33]);
    expect(c).toHaveLength(34);
    expect(c[0]).toBe(3);
    expect(c[33]).toBe(1);
  });

  it('sortForDisplay orders m, p, s, honors', () => {
    expect(sortForDisplay([33, 27, 18, 9, 0])).toEqual([0, 9, 18, 27, 33]);
  });

  it('tileLabel', () => {
    expect(tileLabel(2)).toBe('3萬');
    expect(tileLabel(9)).toBe('1筒');
    expect(tileLabel(26)).toBe('9索');
    expect(tileLabel(27)).toBe('東');
    expect(tileLabel(32)).toBe('發');
    expect(tileLabel(33)).toBe('中');
  });
});

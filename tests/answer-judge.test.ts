import { describe, expect, it } from 'vitest';
import { judgeAnswer } from '../src/domain/answer-judge';

describe('judgeAnswer', () => {
  it('完全一致は正解', () => {
    expect(judgeAnswer(new Set([2, 5]), [5, 2])).toEqual({ correct: true, missing: [], extra: [] });
  });

  it('不足がある場合は missing に入る', () => {
    expect(judgeAnswer(new Set([2]), [2, 5])).toEqual({ correct: false, missing: [5], extra: [] });
  });

  it('余分がある場合は extra に入る', () => {
    expect(judgeAnswer(new Set([2, 5, 30]), [2, 5])).toEqual({ correct: false, missing: [], extra: [30] });
  });

  it('不足と余分が同時にある', () => {
    expect(judgeAnswer(new Set([1, 9]), [0, 1])).toEqual({ correct: false, missing: [0], extra: [9] });
  });

  it('未回答は全て missing', () => {
    expect(judgeAnswer(new Set(), [3, 6])).toEqual({ correct: false, missing: [3, 6], extra: [] });
  });
});

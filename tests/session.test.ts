import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../src/domain/rng';
import { endSession, SESSION_MS, startSession, submit, type SessionState } from '../src/domain/session';

const correctAnswer = (s: SessionState) => new Set(s.current!.waits);
const wrongAnswer = (s: SessionState) => {
  const waits = new Set(s.current!.waits);
  for (let t = 0; t < 34; t++) if (!waits.has(t)) return new Set([t]);
  throw new Error('unreachable');
};

describe('session', () => {
  it('startSession: 通常問題が提示され、合計0', () => {
    const s = startSession('sid', createSeededRng(1));
    expect(s.current?.kind).toBe('normal');
    expect(s.total).toBe(0);
    expect(s.answered).toEqual([]);
    expect(s.streak.streak).toBe(0);
    expect(s.ended).toBe(false);
    expect(s.currentSubmitted).toBe(false);
  });

  it('正解: 点数加算、記録追加、次の問題が提示される', () => {
    const rng = createSeededRng(2);
    const s0 = startSession('sid', rng);
    const q0 = s0.current!;
    const { state, outcome } = submit(s0, correctAnswer(s0), 1000, rng);
    expect(outcome.kind).toBe('judged');
    expect(state.total).toBe(q0.scoring.questionScore);
    expect(state.answered).toHaveLength(1);
    expect(state.answered[0].index).toBe(1);
    expect(state.answered[0].question).toBe(q0);
    expect(state.answered[0].result.correct).toBe(true);
    expect(state.streak.streak).toBe(1);
    expect(state.current).not.toBeNull();
    expect(state.current!.handKey).not.toBe(q0.handKey);
  });

  it('不正解: 0点、Streak は0に戻る', () => {
    const rng = createSeededRng(3);
    let s = startSession('sid', rng);
    s = submit(s, correctAnswer(s), 100, rng).state;
    const r = submit(s, wrongAnswer(s), 200, rng);
    expect(r.state.total).toBe(s.total);
    expect(r.state.answered[1].awarded).toBe(0);
    expect(r.state.streak.streak).toBe(0);
  });

  it('3連続正解の次は清一色問題で、提示時に Streak が0になる', () => {
    const rng = createSeededRng(4);
    let s = startSession('sid', rng);
    for (let i = 0; i < 3; i++) s = submit(s, correctAnswer(s), 100, rng).state;
    expect(s.current?.kind).toBe('chinitsu');
    expect(s.streak.streak).toBe(0);
  });

  it('空の回答は ignored で状態不変', () => {
    const rng = createSeededRng(5);
    const s = startSession('sid', rng);
    const r = submit(s, new Set(), 100, rng);
    expect(r.outcome).toEqual({ kind: 'ignored', reason: 'emptyAnswer' });
    expect(r.state).toBe(s);
  });

  it('30,000ms 以上の提出は ignored、29,999ms は受理', () => {
    const rng = createSeededRng(6);
    const s = startSession('sid', rng);
    const late = submit(s, correctAnswer(s), SESSION_MS, rng);
    expect(late.outcome).toEqual({ kind: 'ignored', reason: 'timeUp' });
    expect(late.state).toBe(s);
    expect(submit(s, correctAnswer(s), SESSION_MS - 1, rng).outcome.kind).toBe('judged');
  });

  it('同じ問題への2回目の提出は ignored', () => {
    const rng = createSeededRng(7);
    const s = { ...startSession('sid', rng), currentSubmitted: true };
    const r = submit(s, correctAnswer(s), 100, rng);
    expect(r.outcome).toEqual({ kind: 'ignored', reason: 'alreadySubmitted' });
    expect(r.state).toBe(s);
  });

  it('endSession: current を破棄し、total と answered は不変。以後の提出は ignored', () => {
    const rng = createSeededRng(8);
    let s = startSession('sid', rng);
    s = submit(s, correctAnswer(s), 100, rng).state;
    const e = endSession(s);
    expect(e.ended).toBe(true);
    expect(e.current).toBeNull();
    expect(e.total).toBe(s.total);
    expect(e.answered).toBe(s.answered);
    const r = submit(e, new Set([0]), 100, rng);
    expect(r.outcome).toEqual({ kind: 'ignored', reason: 'ended' });
    expect(r.state).toBe(e);
  });
});

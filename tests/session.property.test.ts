import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../src/domain/rng';
import { endSession, SESSION_MS, startSession, submit, type SessionState } from '../src/domain/session';
import type { TileId } from '../src/domain/tile';

type AnsKind = 'exact' | 'wrong' | 'random' | 'subset';

const ansKind = fc.constantFrom<AnsKind>('exact', 'wrong', 'random', 'subset');
const tileSet = fc.uniqueArray(fc.integer({ min: 0, max: 33 }), { minLength: 1, maxLength: 6 });
const validElapsed = fc.oneof(fc.integer({ min: 0, max: SESSION_MS - 1 }), fc.constantFrom(0, SESSION_MS - 1));
const lateElapsed = fc.oneof(fc.integer({ min: SESSION_MS, max: SESSION_MS * 2 }), fc.constant(SESSION_MS));

const makeAnswer = (s: SessionState, kind: AnsKind, tiles: number[]): Set<TileId> => {
  const waits = [...s.current!.waits];
  if (kind === 'exact') return new Set(waits);
  if (kind === 'wrong') {
    for (let t = 0; t < 34; t++) if (!waits.includes(t as TileId)) return new Set([t as TileId]);
  }
  if (kind === 'subset') return new Set(waits.slice(0, Math.max(1, waits.length - 1)));
  return new Set(tiles as TileId[]);
};

describe('session properties', () => {
  // Feature: mahjong-machi-quiz-game, Property 18: セッションの合計点と記録
  it('Property 18: セッションの合計点と記録', () => {
    // **Validates: Requirements 1.8, 7.2, 7.3, 7.9, 7.11, 8.2, 8.6**
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.array(fc.tuple(ansKind, tileSet, validElapsed), { maxLength: 15 }),
        (seed, ops) => {
          const rng = createSeededRng(seed);
          let s = startSession('sid', rng);
          const presented = [s.current!];
          for (const [kind, tiles, elapsed] of ops) {
            const answer = makeAnswer(s, kind, tiles);
            const r = submit(s, answer, elapsed, rng);
            expect(r.outcome.kind).toBe('judged');
            s = r.state;
            presented.push(s.current!);
          }
          // (a)
          expect(s.total).toBe(s.answered.reduce((a, e) => a + e.awarded, 0));
          // (b), (c)
          expect(s.answered).toHaveLength(ops.length);
          s.answered.forEach((e, i) => {
            expect(e.index).toBe(i + 1);
            expect(e.question).toBe(presented[i]);
            expect(e.awarded).toBe(e.result.correct ? e.question.scoring.questionScore : 0);
            expect(e.result.correct).toBe(
              e.answer.length === e.question.waits.length && e.answer.every((t) => e.question.waits.includes(t)),
            );
            expect(e.question.hand).toBeDefined();
            expect(e.question.waits.length).toBeGreaterThan(0);
            expect(e.answer.length).toBeGreaterThan(0);
            expect(e.question.scoring).toBeDefined();
          });
          // (d)
          const pending = s.current!;
          expect(s.answered.some((e) => e.question === pending)).toBe(false);
          const ended = endSession(s);
          expect(ended.total).toBe(s.total);
          expect(ended.answered).toEqual(s.answered);
          expect(ended.ended).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: mahjong-machi-quiz-game, Property 19: 遅延提出、重複提出、セッション外の操作は無視される
  it('Property 19: 遅延提出、重複提出、セッション外の操作は無視される', () => {
    // **Validates: Requirements 1.9, 5.9, 5.10, 5.11, 5.12**
    type Op = { type: 'valid' | 'late' | 'empty' | 'dup' | 'ended'; kind: AnsKind; tiles: number[]; elapsed: number; late: number };
    const op = fc.record<Op>({
      type: fc.constantFrom('valid', 'late', 'empty', 'dup', 'ended'),
      kind: ansKind,
      tiles: tileSet,
      elapsed: validElapsed,
      late: lateElapsed,
    });
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), fc.array(op, { maxLength: 20 }), (seed, ops) => {
        const rng = createSeededRng(seed);
        let s = startSession('sid', rng);
        let validCount = 0;
        for (const o of ops) {
          const before = structuredClone(s);
          const answer = makeAnswer(s, o.kind, o.tiles);
          if (o.type === 'valid') {
            const r = submit(s, answer, o.elapsed, rng);
            expect(r.outcome.kind).toBe('judged');
            validCount++;
            s = r.state;
            continue;
          }
          let target = s;
          let a: Set<TileId> = answer;
          let t = o.elapsed;
          if (o.type === 'late') t = o.late;
          if (o.type === 'empty') a = new Set();
          if (o.type === 'dup') target = { ...s, currentSubmitted: true };
          if (o.type === 'ended') target = { ...s, ended: true };
          const r = submit(target, a, t, rng);
          expect(r.outcome.kind).toBe('ignored');
          expect(r.state).toEqual(target);
          expect(s).toEqual(before);
        }
        expect(s.answered).toHaveLength(validCount);
        expect(s.answered.map((e) => e.index)).toEqual(s.answered.map((_, i) => i + 1));
        // 終了後の提出は無視される
        const ended = endSession(s);
        const r = submit(ended, new Set([0 as TileId]), 0, rng);
        expect(r.outcome.kind).toBe('ignored');
        expect(r.state).toEqual(ended);
      }),
      { numRuns: 100 },
    );
  });
});

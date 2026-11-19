import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { RegistrationController } from '../src/infra/registration';
import { NameStore } from '../src/infra/name-store';
import type { RankingClient, SubmitScoreResult } from '../src/infra/ranking-client';

type Outcome = 'ok' | 'validation' | 'error' | 'thrown';
type Event =
  | { kind: 'register'; session: number; outcome: Outcome }
  | { kind: 'retry'; outcome: Outcome };

const outcomeArb = fc.constantFrom<Outcome>('ok', 'validation', 'error', 'thrown');
const eventArb: fc.Arbitrary<Event> = fc.oneof(
  fc.record({
    kind: fc.constant('register' as const),
    session: fc.integer({ min: 0, max: 3 }),
    outcome: outcomeArb,
  }),
  fc.record({ kind: fc.constant('retry' as const), outcome: outcomeArb }),
);

interface Call {
  name: string;
  score: number;
  sessionId: string;
}

describe('RegistrationController properties', () => {
  // Feature: mahjong-machi-quiz-game, Property 27: セッションごとの登録は成功後に再送されない
  // **Validates: Requirements 9.10, 9.12, 9.14**
  it('does not resend after success and resends identical payloads on retry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(eventArb, { minLength: 1, maxLength: 25 }),
        fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 4, maxLength: 4 }),
        async (events, scores) => {
          let next: Outcome = 'error';
          const calls: Call[] = [];
          const succeeded = new Set<string>();
          const violations: string[] = [];
          const client: RankingClient = {
            checkConnection: async () => true,
            fetchRanking: async () => ({ status: 'error' }),
            submitScore: async (name, score, sessionId): Promise<SubmitScoreResult> => {
              // 成功済みの Session_Id には送信されない
              if (succeeded.has(sessionId)) violations.push(sessionId);
              calls.push({ name, score, sessionId });
              if (next === 'thrown') throw new Error('boom');
              if (next === 'ok') {
                succeeded.add(sessionId);
                return { status: 'ok', rank: 1 };
              }
              if (next === 'validation') return { status: 'validation', reason: 'bad' };
              return { status: 'error' };
            },
          };
          const store = new NameStore(null);
          store.save('taro');
          const ctrl = new RegistrationController(client, store);

          let lastRegistered: Call | null = null;
          for (const ev of events) {
            next = ev.outcome;
            const before = calls.length;
            if (ev.kind === 'register') {
              const sessionId = `session-${ev.session}`;
              const score = scores[ev.session];
              await ctrl.registerSession(score, sessionId);
              lastRegistered = { name: 'taro', score, sessionId };
              if (calls.length > before) {
                expect(calls[before]).toEqual(lastRegistered);
              }
            } else {
              const st = ctrl.status;
              await ctrl.retry();
              const sent = calls.length - before;
              if (st.kind === 'failed' && st.retryable && lastRegistered) {
                expect(sent).toBe(1);
                expect(calls[before]).toEqual(lastRegistered);
              } else {
                expect(sent).toBe(0);
              }
            }
          }

          // 成功後の再送なし = 各 Session_Id の成功は高々1回
          expect(violations).toEqual([]);
        },
      ),
      { numRuns: 200 },
    );
  });
});

import { judgeAnswer, type JudgeResult } from './answer-judge';
import { generateQuestion, type Question } from './question-generator';
import type { Rng } from './rng';
import { initialStreak, nextKind, onJudged, onPresented, type StreakState } from './streak-manager';
import type { TileId } from './tile';

/** セッションの制限時間(ミリ秒) */
export const SESSION_MS = 30_000;

export interface AnsweredQuestion {
  /** 提出順の通し番号(1始まり) */
  index: number;
  question: Question;
  answer: readonly TileId[];
  result: JudgeResult;
  awarded: number;
}

export interface SessionState {
  sessionId: string;
  streak: StreakState;
  total: number;
  answered: readonly AnsweredQuestion[];
  current: Question | null;
  currentSubmitted: boolean;
  ended: boolean;
}

export type SubmitOutcome =
  | { kind: 'ignored'; reason: 'ended' | 'timeUp' | 'alreadySubmitted' | 'emptyAnswer' }
  | { kind: 'judged'; entry: AnsweredQuestion };

/** 次の問題を生成し、提示時の Streak 更新まで行う */
const present = (streak: StreakState, rng: Rng, prevHandKey: string | null): { streak: StreakState; question: Question } => {
  const kind = nextKind(streak);
  const question = generateQuestion(kind, rng, prevHandKey);
  return { streak: onPresented(streak, question.kind), question };
};

export const startSession = (sessionId: string, rng: Rng): SessionState => {
  const { streak, question } = present(initialStreak, rng, null);
  return {
    sessionId,
    streak,
    total: 0,
    answered: [],
    current: question,
    currentSubmitted: false,
    ended: false,
  };
};

export const submit = (
  s: SessionState,
  answer: ReadonlySet<TileId>,
  elapsedMs: number,
  rng: Rng,
): { state: SessionState; outcome: SubmitOutcome } => {
  const ignored = (reason: 'ended' | 'timeUp' | 'alreadySubmitted' | 'emptyAnswer') => ({
    state: s,
    outcome: { kind: 'ignored', reason } as const,
  });
  if (s.ended) return ignored('ended');
  if (elapsedMs >= SESSION_MS) return ignored('timeUp');
  const question = s.current;
  if (s.currentSubmitted || question === null) return ignored('alreadySubmitted');
  if (answer.size === 0) return ignored('emptyAnswer');

  const result = judgeAnswer(answer, question.waits);
  const awarded = result.correct ? question.scoring.questionScore : 0;
  const entry: AnsweredQuestion = {
    index: s.answered.length + 1,
    question,
    answer: [...answer].sort((a, b) => a - b),
    result,
    awarded,
  };
  const judgedStreak = onJudged(s.streak, question.kind, result.correct);
  const next = present(judgedStreak, rng, question.handKey);
  return {
    state: {
      ...s,
      streak: next.streak,
      total: s.total + awarded,
      answered: [...s.answered, entry],
      current: next.question,
      currentSubmitted: false,
    },
    outcome: { kind: 'judged', entry },
  };
};

/** 未提出の current は破棄する。total と answered は変わらない */
export const endSession = (s: SessionState): SessionState => ({
  ...s,
  current: null,
  currentSubmitted: false,
  ended: true,
});

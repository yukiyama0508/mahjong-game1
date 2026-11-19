import type { QuestionKind } from './question-generator';

export interface StreakState {
  streak: number; // 0..3
}

export const MAX_STREAK = 3;

export const initialStreak: StreakState = { streak: 0 };

export const nextKind = (s: StreakState): QuestionKind => (s.streak >= MAX_STREAK ? 'chinitsu' : 'normal');

export const onPresented = (s: StreakState, kind: QuestionKind): StreakState =>
  kind === 'chinitsu' ? { streak: 0 } : s;

export const onJudged = (s: StreakState, kind: QuestionKind, correct: boolean): StreakState => {
  if (kind === 'chinitsu') return { streak: 0 };
  return correct ? { streak: Math.min(MAX_STREAK, s.streak + 1) } : { streak: 0 };
};

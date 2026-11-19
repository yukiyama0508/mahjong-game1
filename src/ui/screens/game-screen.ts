import type { Question } from '../../domain/question-generator';
import { sortForDisplay, TILE_KINDS, type TileId } from '../../domain/tile';
import { clearAnswer, toggleTile, type Answer } from '../answer-selection';
import { h, replaceChildren } from '../dom';
import { renderTile } from '../tile-view';

/** フィードバックの表示時間(ミリ秒) */
export const FEEDBACK_MS = 700;
export const EMPTY_ANSWER_MESSAGE = '1つ以上の牌を選んでください';

export interface GameScreenProps {
  question: Question;
  total: number;
  remainingSeconds: number;
  /** 提出ボタン。AppController が session.submit を呼び、結果を下記ハンドルに反映する */
  onSubmit: (answer: Answer) => void;
}

export interface GameScreenHandle {
  readonly element: HTMLElement;
  /** 秒数の要素だけを更新する(手牌とパレットは再描画しない) */
  setRemainingSeconds(seconds: number): void;
  /** 合計点の要素だけを更新する */
  setTotal(total: number): void;
  /** 次の問題を表示する。回答の選択は空に戻る。フィードバックは消さない */
  showQuestion(question: Question): void;
  /** ○/× と獲得点を700ms表示する。その間も入力は受け付ける */
  showFeedback(correct: boolean, awarded: number): void;
  /** 空回答のメッセージを表示する */
  showEmptyMessage(): void;
  /** 保留中のタイマーを解除する */
  dispose(): void;
}

const KIND_LABEL: Record<Question['kind'], string> = { normal: '通常問題', chinitsu: '清一色問題' };
const PALETTE_TILES: readonly TileId[] = Array.from({ length: TILE_KINDS }, (_, i) => i);
const TILE_SIZE = 40;

export function renderGameScreen(props: GameScreenProps): GameScreenHandle {
  let answer: Answer = clearAnswer();
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  const secondsEl = h('span', { class: 'game-seconds' }, String(props.remainingSeconds));
  const totalEl = h('span', { class: 'game-total' }, String(props.total));
  const kindEl = h('div', { class: 'game-kind' }, KIND_LABEL[props.question.kind]);
  const handEl = h('div', { class: 'game-hand' });
  const messageEl = h('div', { class: 'game-message', role: 'alert' });
  const feedbackEl = h('div', { class: 'game-feedback', 'aria-live': 'polite' });

  const paletteButtons = new Map<TileId, HTMLElement>();
  const paletteEl = h('div', { class: 'game-palette' });
  for (const t of PALETTE_TILES) {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'palette-tile',
        'data-tile': String(t),
        'aria-pressed': 'false',
        onpointerup: () => {
          answer = toggleTile(answer, t);
          messageEl.textContent = '';
          refreshSelection();
        },
      },
      renderTile(t, { size: TILE_SIZE }),
    );
    btn.style.width = `${TILE_SIZE}px`;
    btn.style.height = `${TILE_SIZE}px`;
    btn.style.padding = '0';
    paletteButtons.set(t, btn);
    paletteEl.appendChild(btn);
  }

  const refreshSelection = (): void => {
    for (const [t, btn] of paletteButtons) {
      const selected = answer.has(t);
      btn.setAttribute('aria-pressed', String(selected));
      btn.classList.toggle('selected', selected);
    }
  };

  const renderHand = (q: Question): void => {
    replaceChildren(handEl, ...sortForDisplay(q.hand).map((t) => renderTile(t, { size: TILE_SIZE })));
  };

  renderHand(props.question);

  const clearBtn = h(
    'button',
    {
      type: 'button',
      class: 'game-clear',
      onpointerup: () => {
        answer = clearAnswer(answer);
        messageEl.textContent = '';
        refreshSelection();
      },
    },
    'クリア',
  );
  const submitBtn = h(
    'button',
    { type: 'button', class: 'game-submit', onpointerup: () => props.onSubmit(answer) },
    '提出',
  );

  const element = h(
    'section',
    { class: 'screen game-screen' },
    h('div', { class: 'game-status' }, h('span', null, '残り '), secondsEl, h('span', null, ' 秒 / 合計 '), totalEl, h('span', null, ' 点')),
    kindEl,
    handEl,
    feedbackEl,
    paletteEl,
    messageEl,
    h('div', { class: 'game-actions' }, clearBtn, submitBtn),
  );

  const clearFeedback = (): void => {
    if (feedbackTimer !== null) clearTimeout(feedbackTimer);
    feedbackTimer = null;
    feedbackEl.textContent = '';
  };

  return {
    element,
    setRemainingSeconds(seconds) {
      secondsEl.textContent = String(seconds);
    },
    setTotal(total) {
      totalEl.textContent = String(total);
    },
    showQuestion(q) {
      answer = clearAnswer(answer);
      messageEl.textContent = '';
      kindEl.textContent = KIND_LABEL[q.kind];
      renderHand(q);
      refreshSelection();
    },
    showFeedback(correct, awarded) {
      clearFeedback();
      feedbackEl.className = `game-feedback ${correct ? 'correct' : 'wrong'}`;
      feedbackEl.textContent = correct ? `○ +${awarded}点` : `× +${awarded}点`;
      feedbackTimer = setTimeout(clearFeedback, FEEDBACK_MS);
    },
    showEmptyMessage() {
      messageEl.textContent = EMPTY_ANSWER_MESSAGE;
    },
    dispose() {
      clearFeedback();
    },
  };
}

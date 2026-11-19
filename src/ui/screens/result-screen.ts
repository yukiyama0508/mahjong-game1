import type { Availability } from '../../infra/availability';
import type { RegistrationStatus } from '../../infra/registration';
import type { AnsweredQuestion, SessionState } from '../../domain/session';
import type { YakuEntry, YakuId } from '../../domain/yaku';
import { tileLabel, type TileId } from '../../domain/tile';
import { h, type Child } from '../dom';
import { renderTile } from '../tile-view';

export interface ResultScreenProps {
  /** 終了済みセッション。表示内容はこの値だけで決まる(再描画しても変わらない) */
  session: SessionState;
  status: RegistrationStatus;
  /** 'enabled' のときだけランキングボタンを描画する */
  availability: Availability;
  onBack: () => void;
  onRanking: () => void;
  onRetry: () => void;
}

export const OFFLINE_MESSAGE = 'オフラインのためランキングには登録されません';
export const NO_ANSWER_MESSAGE = '回答した問題はありません';
export const NONE_LABEL = 'なし';

const YAKU_NAMES: Readonly<Record<YakuId, string>> = {
  riichi: 'リーチ',
  pinfu: '平和',
  tanyao: '断幺九',
  iipeikou: '一盃口',
  yakuhai: '役牌',
  chiitoitsu: '七対子',
  toitoi: '対々和',
  sanankou: '三暗刻',
  sanshokuDoujun: '三色同順',
  sanshokuDoukou: '三色同刻',
  ittsu: '一気通貫',
  chanta: '混全帯幺九',
  shousangen: '小三元',
  honroutou: '混老頭',
  honitsu: '混一色',
  junchan: '純全帯幺九',
  ryanpeikou: '二盃口',
  chinitsu: '清一色',
};

const yakuText = (y: YakuEntry): string => {
  const name = YAKU_NAMES[y.id] ?? y.id;
  return y.tile !== undefined ? `${name}(${tileLabel(y.tile)}) ${y.han}翻` : `${name} ${y.han}翻`;
};

const tiles = (ids: readonly TileId[], size = 28): HTMLElement =>
  h('span', { class: 'tile-row' }, ...ids.map((t) => renderTile(t, { size })));

/** 空のときは「なし」を明示する */
const tileSet = (ids: readonly TileId[]): HTMLElement =>
  ids.length === 0 ? h('span', { class: 'none' }, NONE_LABEL) : tiles(ids);

const labeled = (label: string, content: Child): HTMLElement =>
  h('p', { class: 'field' }, h('span', { class: 'label' }, `${label}: `), content);

const renderEntry = (e: AnsweredQuestion): HTMLElement => {
  const q = e.question;
  const { perWait, questionScore } = q.scoring;
  const differs = new Set(perWait.map((w) => w.points)).size > 1;
  const correct = e.result.correct;

  const detail = differs
    ? h(
        'ul',
        { class: 'per-wait' },
        ...perWait.map((w) =>
          h(
            'li',
            { class: w.points === questionScore ? 'best-wait' : undefined },
            tiles([w.winTile], 24),
            ` 役: ${w.yaku.map(yakuText).join('、')} / ${w.fu}符 ${w.han}翻 ${w.points}点`,
            w.points === questionScore ? ' (高目)' : null,
          ),
        ),
      )
    : (() => {
        const w = perWait[0];
        return w
          ? h(
              'p',
              { class: 'score-detail' },
              `役: ${w.yaku.map(yakuText).join('、')} / ${w.fu}符 ${w.han}翻`,
            )
          : null;
      })();

  return h(
    'li',
    { class: `review-entry ${correct ? 'correct' : 'incorrect'}`, 'data-index': e.index },
    h('h3', null, `第${e.index}問 ${correct ? '○ 正解' : '× 不正解'}`),
    labeled('手牌', tiles(q.hand)),
    labeled('待ち牌', tiles(q.waits)),
    labeled('回答', tileSet(e.answer)),
    detail,
    labeled('Question_Score', `${questionScore}点`),
    labeled(
      '獲得点',
      correct ? `${e.awarded}点` : `0点(正解なら ${questionScore}点)`,
    ),
    correct ? null : labeled('不足している牌', tileSet(e.result.missing)),
    correct ? null : labeled('余分な牌', tileSet(e.result.extra)),
  );
};

const renderStatus = (status: RegistrationStatus, onRetry: () => void): HTMLElement | null => {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'registering':
      return h('p', { class: 'registration registering' }, '登録中...');
    case 'done':
      return h(
        'p',
        { class: 'registration done' },
        status.rank !== null ? `登録が完了しました。順位: ${status.rank}位` : '登録が完了しました。',
      );
    case 'failed': {
      const msg = h('p', { class: 'registration failed' });
      msg.textContent = status.retryable ? `登録に失敗しました。${status.message}` : status.message;
      return status.retryable
        ? h(
            'div',
            { class: 'registration-failed' },
            msg,
            h('button', { type: 'button', onclick: () => onRetry() }, '再試行'),
          )
        : h('div', { class: 'registration-failed' }, msg);
    }
    case 'notApplicable':
      return h('p', { class: 'registration offline' }, OFFLINE_MESSAGE);
  }
};

export function renderResultScreen(props: ResultScreenProps): HTMLElement {
  const { session, status, availability } = props;
  const answered = session.answered;
  const correctCount = answered.filter((a) => a.result.correct).length;

  return h(
    'section',
    { class: 'screen result-screen' },
    h('h1', null, 'ゲーム終了'),
    h('p', { class: 'total-score' }, `合計点: ${session.total}点`),
    h('p', { class: 'answered-count' }, `回答数: ${answered.length}問`),
    h('p', { class: 'correct-count' }, `正解数: ${correctCount}問`),
    renderStatus(status, props.onRetry),
    answered.length === 0 ? h('p', { class: 'no-answer' }, NO_ANSWER_MESSAGE) : null,
    h('h2', null, '解説一覧'),
    h('ol', { class: 'review-list' }, ...answered.map(renderEntry)),
    h('button', { type: 'button', class: 'primary', onclick: () => props.onBack() }, 'スタートへ戻る'),
    availability === 'enabled'
      ? h('button', { type: 'button', onclick: () => props.onRanking() }, 'ランキング')
      : null,
  );
}

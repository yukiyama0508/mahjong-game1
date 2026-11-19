import { h } from '../dom';

export interface ExplanationScreenProps {
  onBack: () => void;
}

export function renderExplanationScreen(props: ExplanationScreenProps): HTMLElement {
  return h(
    'section',
    { class: 'screen explanation-screen' },
    h('h1', null, '遊び方'),
    h(
      'section',
      null,
      h('h2', null, '30秒タイムアタック'),
      h(
        'p',
        null,
        '30秒の間にできるだけ多くの問題に答えます。合計点は、正解した問題の点数の合計です。',
      ),
    ),
    h(
      'section',
      null,
      h('h2', null, '回答のしかた'),
      h('p', null, '待ち牌をすべて選んでから、提出ボタンを押します。'),
      h('p', null, '不正解のときは0点で、次の問題に進みます。'),
    ),
    h(
      'section',
      null,
      h('h2', null, '清一色問題'),
      h(
        'p',
        null,
        '3問連続で正解すると、次の問題が清一色問題になります。清一色問題が出た時点で、連続正解の数は0に戻ります。',
      ),
    ),
    h(
      'section',
      null,
      h('h2', null, '点数計算の前提'),
      h(
        'p',
        null,
        '子、ロン、門前、リーチ付き、ドラなし、東場南家として計算します。待ち牌ごとに点数が異なる場合は、いちばん高い点数(高目)を採用します。',
      ),
    ),
    h(
      'section',
      null,
      h('h2', null, '時間切れの問題'),
      h(
        'p',
        null,
        '制限時間までに提出しなかった問題は無効です。点数にも解説一覧にも含まれません。',
      ),
    ),
    h('button', { type: 'button', onclick: () => props.onBack() }, '戻る'),
  );
}

import type { Availability } from '../../infra/availability';
import { h } from '../dom';

export interface StartScreenProps {
  /** Player_Name(trim 済み)。textContent で表示する */
  playerName: string;
  /** 'enabled' のときだけランキングボタンを描画する */
  availability: Availability;
  onStart: () => void;
  onExplanation: () => void;
  onChangeName: () => void;
  onRanking: () => void;
}

export function renderStartScreen(props: StartScreenProps): HTMLElement {
  const nameEl = h('span', { class: 'player-name' });
  nameEl.textContent = props.playerName;

  return h(
    'section',
    { class: 'screen start-screen' },
    h('h1', null, '麻雀 待ち当てクイズ'),
    h('p', { class: 'current-player' }, 'プレイヤー: ', nameEl),
    h('button', { type: 'button', class: 'primary', onclick: () => props.onStart() }, 'ゲーム開始'),
    h('button', { type: 'button', onclick: () => props.onExplanation() }, '説明'),
    props.availability === 'enabled'
      ? h('button', { type: 'button', onclick: () => props.onRanking() }, 'ランキング')
      : null,
    h('button', { type: 'button', onclick: () => props.onChangeName() }, '名前変更'),
  );
}

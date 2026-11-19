import { h, replaceChildren } from '../dom';
import type { RankingClient, RankingEntry } from '../../infra/ranking-client';

export interface RankingScreenProps {
  client: Pick<RankingClient, 'fetchRanking'>;
  /** Connection_Check を実行する(AvailabilityTracker.refresh)。成功なら true。可用性の更新は呼び出し側 */
  refresh: () => Promise<boolean>;
  /** 現在の Player_Name(trim 済み) */
  playerName: string;
  /** 戻る(開いた元の画面へ戻す) */
  onBack: () => void;
}

export const EMPTY_MESSAGE = 'まだスコアが登録されていません';
export const ERROR_MESSAGE = 'ランキングを読み込めませんでした';

/** 行の名前が現在の Player_Name と(trim 後に)完全一致するとき真。同名の他プレイヤーの行も真になる。 */
export function isHighlighted(rowName: string, playerName: string): boolean {
  return rowName.trim() === playerName.trim();
}

/** 登録日を表示用に整形する。解釈できない場合は元の文字列。 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

function renderTable(entries: readonly RankingEntry[], playerName: string): HTMLElement {
  const rows = entries.map((e) =>
    h(
      'tr',
      { class: isHighlighted(e.name, playerName) ? 'ranking-row highlighted' : 'ranking-row' },
      h('td', { class: 'rank' }, String(e.rank)),
      h('td', { class: 'name' }, e.name),
      h('td', { class: 'score' }, String(e.totalScore)),
      h('td', { class: 'date' }, formatDate(e.createdAt)),
    ),
  );
  return h(
    'table',
    { class: 'ranking-table' },
    h(
      'thead',
      null,
      h('tr', null, h('th', null, '順位'), h('th', null, '名前'), h('th', null, '点数'), h('th', null, '登録日')),
    ),
    h('tbody', null, ...rows),
  );
}

function buildScreen(props: RankingScreenProps): HTMLElement {
  const body = h('div', { class: 'ranking-body' }, '読み込み中…');
  let loadId = 0;

  const load = async (): Promise<void> => {
    const id = ++loadId;
    replaceChildren(body, '読み込み中…');
    let result: Awaited<ReturnType<RankingClient['fetchRanking']>>;
    try {
      result = await props.client.fetchRanking();
    } catch {
      result = { status: 'error' };
    }
    if (id !== loadId) return;
    if (result.status === 'ok') {
      if (result.entries.length === 0) {
        replaceChildren(body, h('p', { class: 'ranking-empty' }, EMPTY_MESSAGE));
      } else {
        replaceChildren(body, renderTable(result.entries, props.playerName));
      }
    } else {
      replaceChildren(
        body,
        h('p', { class: 'ranking-error', role: 'alert' }, ERROR_MESSAGE),
        h('button', { type: 'button', class: 'retry-button', onclick: () => void load() }, '再試行'),
      );
    }
  };

  const screen = h(
    'section',
    { class: 'screen ranking-screen' },
    h('h2', null, 'ランキング'),
    body,
    h('button', { type: 'button', class: 'back-button', onclick: () => props.onBack() }, '戻る'),
  );
  void load();
  return screen;
}

/**
 * ランキング画面を開く。先に Connection_Check(props.refresh)を行い、失敗なら null を返す
 * (呼び出し側は現在の画面を維持し、エラー表示も再試行も出さない。要件 10.15)。
 * 成功なら画面要素を返し、fetchRanking の結果を非同期に描画する。
 */
export async function openRankingScreen(props: RankingScreenProps): Promise<HTMLElement | null> {
  let ok = false;
  try {
    ok = (await props.refresh()) === true;
  } catch {
    ok = false;
  }
  if (!ok) return null;
  return buildScreen(props);
}

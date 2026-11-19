// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeededRng } from '../src/domain/rng';
import type { Availability } from '../src/infra/availability';
import { NameStore, type KeyValueStorage } from '../src/infra/name-store';
import { AppController } from '../src/ui/app-controller';
import { renderLoginScreen } from '../src/ui/screens/login-screen';
import { renderResultScreen } from '../src/ui/screens/result-screen';
import { renderStartScreen } from '../src/ui/screens/start-screen';
import { renderExplanationScreen } from '../src/ui/screens/explanation-screen';
import { renderGameScreen } from '../src/ui/screens/game-screen';
import { startSession, endSession, submit } from '../src/domain/session';

const memStorage = (initial?: string): KeyValueStorage => {
  let v: string | null = initial ?? null;
  return { getItem: () => v, setItem: (_k, val) => void (v = val) };
};

const fire = (el: Element, type: string): void => {
  el.dispatchEvent(new Event(type, { bubbles: true }));
};

const buttonByText = (root: ParentNode, text: string): HTMLElement | undefined =>
  Array.from(root.querySelectorAll('button')).find((b) => b.textContent === text);

interface Harness {
  root: HTMLElement;
  controller: AppController;
  fetchRanking: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  clock: { t: number };
}

const setup = (opts: { stored?: string; availability?: Availability; refreshOk?: boolean } = {}): Harness => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const clock = { t: 0 };
  const fetchRanking = vi.fn(async () => ({ status: 'ok' as const, entries: [] }));
  const availability: Availability = opts.availability ?? 'offline';
  const refresh = vi.fn(async () => opts.refreshOk ?? availability === 'enabled');
  const controller = new AppController({
    root,
    clock: { now: () => clock.t },
    rng: createSeededRng(42),
    nameStore: new NameStore(memStorage(opts.stored)),
    rankingClient: { fetchRanking },
    availability: { current: availability, refresh },
    registration: {
      registerSession: async () => ({ kind: 'notApplicable', reason: 'offline' }),
      retry: async () => ({ kind: 'notApplicable', reason: 'offline' }),
    },
    newSessionId: () => 'sid',
  });
  return { root, controller, fetchRanking, refresh, clock };
};

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.useRealTimers();
});

describe('startup screen selection', () => {
  it('shows Login when no name is stored', () => {
    const h = setup();
    h.controller.start();
    expect(h.controller.state.screen).toBe('login');
    expect(h.root.querySelector('.login-screen')).not.toBeNull();
  });

  it('shows Start immediately when a name is stored (without waiting for connection check)', () => {
    const h = setup({ stored: JSON.stringify({ name: '太郎' }) });
    h.controller.start();
    expect(h.controller.state.screen).toBe('start');
    expect(h.root.querySelector('.start-screen')).not.toBeNull();
    expect(h.root.querySelector('.player-name')?.textContent).toBe('太郎');
  });
});

describe('Login screen', () => {
  const tryName = (value: string): { err: string; onConfirm: ReturnType<typeof vi.fn> } => {
    const onConfirm = vi.fn();
    const el = renderLoginScreen({ persistent: true, onConfirm });
    document.body.appendChild(el);
    (el.querySelector('input') as HTMLInputElement).value = value;
    fire(el.querySelector('form') as HTMLFormElement, 'submit');
    return { err: el.querySelector('#name-error')?.textContent ?? '', onConfirm };
  };

  it('shows an error for empty input', () => {
    const r = tryName('');
    expect(r.err).not.toBe('');
    expect(r.onConfirm).not.toHaveBeenCalled();
  });

  it('shows an error for 21 characters, accepts 20', () => {
    const r = tryName('あ'.repeat(21));
    expect(r.err).not.toBe('');
    expect(r.onConfirm).not.toHaveBeenCalled();
    const ok = tryName('あ'.repeat(20));
    expect(ok.err).toBe('');
    expect(ok.onConfirm).toHaveBeenCalledWith('あ'.repeat(20));
  });

  it('shows an error for control characters', () => {
    const r = tryName('a\u0007b');
    expect(r.err).not.toBe('');
    expect(r.onConfirm).not.toHaveBeenCalled();
  });

  it('shows a not-saved notice only when storage is not persistent', () => {
    const a = renderLoginScreen({ persistent: false, onConfirm: () => {} });
    expect(a.querySelector('.notice')).not.toBeNull();
    const b = renderLoginScreen({ persistent: true, onConfirm: () => {} });
    expect(b.querySelector('.notice')).toBeNull();
  });
});

describe('ranking button visibility', () => {
  it('Start: shown when enabled, hidden when offline', () => {
    const on = renderStartScreen({
      playerName: 'a', availability: 'enabled',
      onStart: () => {}, onExplanation: () => {}, onChangeName: () => {}, onRanking: () => {},
    });
    expect(buttonByText(on, 'ランキング')).toBeDefined();
    const off = renderStartScreen({
      playerName: 'a', availability: 'offline',
      onStart: () => {}, onExplanation: () => {}, onChangeName: () => {}, onRanking: () => {},
    });
    expect(buttonByText(off, 'ランキング')).toBeUndefined();
  });

  it('Result: shown when enabled, hidden when offline', () => {
    const session = endSession(startSession('s', createSeededRng(1)));
    const mk = (availability: Availability) =>
      renderResultScreen({
        session, status: { kind: 'idle' }, availability,
        onBack: () => {}, onRanking: () => {}, onRetry: () => {},
      });
    expect(buttonByText(mk('enabled'), 'ランキング')).toBeDefined();
    expect(buttonByText(mk('offline'), 'ランキング')).toBeUndefined();
  });

  it('offline Start screen shows no error or retry', () => {
    const h = setup({ stored: JSON.stringify({ name: 'a' }), availability: 'offline' });
    h.controller.start();
    const text = h.root.textContent ?? '';
    expect(text).not.toContain('エラー');
    expect(text).not.toContain('失敗');
    expect(buttonByText(h.root, '再試行')).toBeUndefined();
    expect(h.root.querySelector('[role="alert"]')).toBeNull();
  });

  it('offline Result screen shows the offline notice without retry', () => {
    const session = endSession(startSession('s', createSeededRng(1)));
    const el = renderResultScreen({
      session, status: { kind: 'notApplicable', reason: 'offline' }, availability: 'offline',
      onBack: () => {}, onRanking: () => {}, onRetry: () => {},
    });
    expect(el.textContent).toContain('オフライン');
    expect(buttonByText(el, '再試行')).toBeUndefined();
  });

  it('opening ranking while connection fails keeps the screen with no error or retry', async () => {
    const h = setup({ stored: JSON.stringify({ name: 'a' }), availability: 'enabled', refreshOk: false });
    h.controller.start();
    fire(buttonByText(h.root, 'ランキング') as HTMLElement, 'click');
    await vi.waitFor(() => expect(h.refresh).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(h.controller.state.screen).toBe('start');
    expect(h.root.querySelector('.ranking-error')).toBeNull();
    expect(buttonByText(h.root, '再試行')).toBeUndefined();
    expect(h.fetchRanking).not.toHaveBeenCalled();
  });
});

describe('Game screen', () => {
  it('has no explanation button', () => {
    const session = startSession('s', createSeededRng(1));
    const handle = renderGameScreen({
      question: session.current!, total: 0, remainingSeconds: 30, onSubmit: () => {},
    });
    expect(buttonByText(handle.element, '説明')).toBeUndefined();
    expect(handle.element.textContent).not.toContain('説明');
    handle.dispose();
  });
});

describe('Explanation screen', () => {
  it('mentions that unsubmitted questions are excluded and has a back button', () => {
    const onBack = vi.fn();
    const el = renderExplanationScreen({ onBack });
    expect(el.textContent).toContain('解説一覧にも含まれません');
    fire(buttonByText(el, '戻る') as HTMLElement, 'click');
    expect(onBack).toHaveBeenCalled();
  });
});

describe('Result screen review list', () => {
  const rng = createSeededRng(7);
  const s0 = startSession('s', rng);
  const q = s0.current!;
  const wrong = new Set([...Array(34).keys()].filter((t) => !q.waits.includes(t)).slice(0, 1));
  const { state: s1 } = submit(s0, wrong, 1000, rng);

  it('lists only submitted questions (not the pending one)', () => {
    expect(s1.current).not.toBeNull();
    const ended = endSession(s1);
    const el = renderResultScreen({
      session: ended, status: { kind: 'idle' }, availability: 'offline',
      onBack: () => {}, onRanking: () => {}, onRetry: () => {},
    });
    expect(el.querySelectorAll('.review-entry')).toHaveLength(1);
    expect(el.querySelector('.no-answer')).toBeNull();
  });

  it('shows hand, waits, answer, score, and missing/extra tiles for an incorrect entry', () => {
    const el = renderResultScreen({
      session: endSession(s1), status: { kind: 'idle' }, availability: 'offline',
      onBack: () => {}, onRanking: () => {}, onRetry: () => {},
    });
    const entry = el.querySelector('.review-entry') as HTMLElement;
    const text = entry.textContent ?? '';
    expect(entry.classList.contains('incorrect')).toBe(true);
    for (const label of ['第1問', '手牌', '待ち牌', '回答', 'Question_Score', '獲得点', '不足している牌', '余分な牌']) {
      expect(text).toContain(label);
    }
    expect(text).toContain('0点');
    expect(entry.querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(el.querySelector('.total-score')?.textContent).toContain('0点');
  });

  it('displays a 0-question result', () => {
    const ended = endSession(startSession('s', createSeededRng(3)));
    const el = renderResultScreen({
      session: ended, status: { kind: 'idle' }, availability: 'offline',
      onBack: () => {}, onRanking: () => {}, onRetry: () => {},
    });
    expect(el.querySelector('.total-score')?.textContent).toContain('0点');
    expect(el.querySelector('.answered-count')?.textContent).toContain('0');
    expect(el.querySelector('.no-answer')?.textContent).toContain('回答した問題はありません');
    expect(el.querySelectorAll('.review-entry')).toHaveLength(0);
  });
});

describe('end-to-end through AppController', () => {
  it('excludes the unsubmitted question from the result after time-up', async () => {
    vi.useFakeTimers();
    const h = setup({ stored: JSON.stringify({ name: 'a' }) });
    h.controller.start();
    fire(buttonByText(h.root, 'ゲーム開始') as HTMLElement, 'click');
    expect(h.controller.state.screen).toBe('game');
    expect(buttonByText(h.root, '説明')).toBeUndefined();

    // 1問だけ提出(誤答を選ぶ)
    fire(h.root.querySelector('.palette-tile[data-tile="0"]') as Element, 'pointerup');
    fire(h.root.querySelector('.game-submit') as Element, 'pointerup');

    h.clock.t = 30_000;
    vi.advanceTimersByTime(30_000);
    expect(h.controller.state.screen).toBe('result');
    expect(h.root.querySelectorAll('.review-entry')).toHaveLength(1);
  });

  it('shows a 0-question result when nothing was submitted', () => {
    vi.useFakeTimers();
    const h = setup({ stored: JSON.stringify({ name: 'a' }) });
    h.controller.start();
    fire(buttonByText(h.root, 'ゲーム開始') as HTMLElement, 'click');
    h.clock.t = 30_000;
    vi.advanceTimersByTime(30_000);
    expect(h.controller.state.screen).toBe('result');
    expect(h.root.querySelector('.no-answer')).not.toBeNull();
    expect(h.root.querySelectorAll('.review-entry')).toHaveLength(0);
  });

  it('login and name change never call the ranking client', () => {
    const h = setup({ availability: 'enabled' });
    h.controller.start();
    (h.root.querySelector('input') as HTMLInputElement).value = '花子';
    fire(h.root.querySelector('form') as HTMLFormElement, 'submit');
    expect(h.controller.state.screen).toBe('start');
    expect(h.controller.state.player).toBe('花子');

    fire(buttonByText(h.root, '名前変更') as HTMLElement, 'click');
    expect(h.controller.state.screen).toBe('login');
    expect((h.root.querySelector('input') as HTMLInputElement).value).toBe('花子');
    (h.root.querySelector('input') as HTMLInputElement).value = '次郎';
    fire(h.root.querySelector('form') as HTMLFormElement, 'submit');
    expect(h.controller.state.player).toBe('次郎');

    expect(h.fetchRanking).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalledWith(expect.anything());
  });
});


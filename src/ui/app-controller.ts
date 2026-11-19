import { endSession, SESSION_MS, startSession, submit, type SessionState } from '../domain/session';
import type { Rng } from '../domain/rng';
import type { Availability } from '../infra/availability';
import type { Clock } from '../infra/clock';
import type { NameStore } from '../infra/name-store';
import type { RankingClient } from '../infra/ranking-client';
import type { RegistrationStatus } from '../infra/registration';
import { Timer } from '../infra/timer';
import { replaceChildren } from './dom';
import { renderExplanationScreen } from './screens/explanation-screen';
import { renderGameScreen, type GameScreenHandle } from './screens/game-screen';
import { renderLoginScreen } from './screens/login-screen';
import { openRankingScreen } from './screens/ranking-screen';
import { renderResultScreen } from './screens/result-screen';
import { renderStartScreen } from './screens/start-screen';

export interface AppState {
  screen: 'login' | 'start' | 'explanation' | 'game' | 'result' | 'ranking';
  /** Player_Name(trim 済み)のみ */
  player: string | null;
  availability: Availability;
  /** ランキング画面の戻り先 */
  returnTo: 'start' | 'result';
  lastResult: { session: SessionState; status: RegistrationStatus } | null;
}

export interface AppControllerDeps {
  root: HTMLElement;
  clock: Clock;
  rng: Rng;
  nameStore: NameStore;
  rankingClient: Pick<RankingClient, 'fetchRanking'>;
  availability: { readonly current: Availability; refresh(): Promise<boolean> };
  registration: {
    registerSession(total: number, sessionId: string): Promise<RegistrationStatus>;
    retry(): Promise<RegistrationStatus>;
  };
  newSessionId?: () => string;
}

const defaultSessionId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export class AppController {
  private _state: AppState;
  private session: SessionState | null = null;
  private timer: Timer | null = null;
  private game: GameScreenHandle | null = null;
  /** 非同期のランキング画面オープンを無効化するための世代番号 */
  private navToken = 0;

  constructor(private readonly deps: AppControllerDeps) {
    this._state = {
      screen: 'login',
      player: null,
      availability: deps.availability.current,
      returnTo: 'start',
      lastResult: null,
    };
  }

  get state(): AppState {
    return this._state;
  }

  /** 起動。名前があれば接続確認を待たずに Start を表示する。 */
  start(): void {
    const name = this.deps.nameStore.load();
    this._state.player = name;
    if (name === null) {
      this.showLogin(false);
    } else {
      this.showStart();
    }
  }

  /** AvailabilityTracker の onChange から呼ぶ。 */
  onAvailabilityChange(a: Availability): void {
    this._state.availability = a;
    if (this._state.screen === 'start') this.renderStart();
    else if (this._state.screen === 'result') this.renderResult();
  }

  /** RegistrationController の onStatus から呼ぶ。 */
  onRegistrationStatus(status: RegistrationStatus): void {
    const last = this._state.lastResult;
    if (!last) return;
    this._state.lastResult = { session: last.session, status };
    if (this._state.screen === 'result') this.renderResult();
  }

  private mount(el: HTMLElement): void {
    replaceChildren(this.deps.root, el);
  }

  private leaveGame(): void {
    this.timer?.stop();
    this.timer = null;
    this.game?.dispose();
    this.game = null;
  }

  private refreshAvailability(): void {
    void this.deps.availability.refresh().then(() => {
      this._state.availability = this.deps.availability.current;
    });
  }

  private showLogin(changing: boolean): void {
    this.navToken++;
    this.leaveGame();
    this._state.screen = 'login';
    this.mount(
      renderLoginScreen({
        initialName: changing ? (this._state.player ?? undefined) : undefined,
        persistent: this.deps.nameStore.persistent,
        onConfirm: (name) => {
          this.deps.nameStore.save(name);
          this._state.player = name;
          this.showStart();
        },
        onBack: changing ? () => this.showStart() : undefined,
      }),
    );
  }

  private showStart(): void {
    this.navToken++;
    this.leaveGame();
    this._state.screen = 'start';
    this.renderStart();
    this.refreshAvailability();
  }

  private renderStart(): void {
    this._state.availability = this.deps.availability.current;
    this.mount(
      renderStartScreen({
        playerName: this._state.player ?? '',
        availability: this._state.availability,
        onStart: () => this.startGame(),
        onExplanation: () => this.showExplanation(),
        onChangeName: () => this.showLogin(true),
        onRanking: () => void this.openRanking('start'),
      }),
    );
  }

  private showExplanation(): void {
    this.navToken++;
    this._state.screen = 'explanation';
    this.mount(renderExplanationScreen({ onBack: () => this.showStart() }));
  }

  private startGame(): void {
    this.navToken++;
    this.leaveGame();
    this._state.lastResult = null;
    this._state.screen = 'game';
    const session = startSession((this.deps.newSessionId ?? defaultSessionId)(), this.deps.rng);
    this.session = session;
    const first = session.current;
    if (first === null) return;

    const game = renderGameScreen({
      question: first,
      total: 0,
      remainingSeconds: Math.ceil(SESSION_MS / 1000),
      onSubmit: (answer) => this.handleSubmit(answer),
    });
    this.game = game;
    this.mount(game.element);

    const timer = new Timer(
      this.deps.clock,
      SESSION_MS,
      (sec) => game.setRemainingSeconds(sec),
      () => this.finishGame(),
    );
    this.timer = timer;
    timer.start();
  }

  private handleSubmit(answer: ReadonlySet<number>): void {
    const s = this.session;
    const timer = this.timer;
    const game = this.game;
    if (!s || !timer || !game || this._state.screen !== 'game') return;
    const { state, outcome } = submit(s, answer, timer.elapsedMs(), this.deps.rng);
    if (outcome.kind === 'ignored') {
      if (outcome.reason === 'emptyAnswer') game.showEmptyMessage();
      return;
    }
    this.session = state;
    game.setTotal(state.total);
    game.showFeedback(outcome.entry.result.correct, outcome.entry.awarded);
    if (state.current) game.showQuestion(state.current);
  }

  private finishGame(): void {
    const s = this.session;
    if (!s || this._state.screen !== 'game') return;
    this.leaveGame();
    const ended = endSession(s);
    this.session = null;
    this._state.screen = 'result';
    this._state.lastResult = { session: ended, status: { kind: 'registering' } };
    this.renderResult();
    this.refreshAvailability();
    void this.register(() => this.deps.registration.registerSession(ended.total, ended.sessionId), ended);
  }

  private async register(run: () => Promise<RegistrationStatus>, forSession: SessionState): Promise<void> {
    let status: RegistrationStatus;
    try {
      status = await run();
    } catch {
      status = { kind: 'failed', message: '通信に失敗しました。もう一度お試しください。', retryable: true };
    }
    const last = this._state.lastResult;
    if (!last || last.session !== forSession) return; // 破棄済み
    this.onRegistrationStatus(status);
  }

  private renderResult(): void {
    const last = this._state.lastResult;
    if (!last) return;
    this._state.availability = this.deps.availability.current;
    this.mount(
      renderResultScreen({
        session: last.session,
        status: last.status,
        availability: this._state.availability,
        onBack: () => {
          this._state.lastResult = null; // セッションデータを破棄
          this.showStart();
        },
        onRanking: () => void this.openRanking('result'),
        onRetry: () => {
          const cur = this._state.lastResult;
          if (!cur) return;
          void this.register(() => this.deps.registration.retry(), cur.session);
        },
      }),
    );
  }

  private async openRanking(from: 'start' | 'result'): Promise<void> {
    const token = ++this.navToken;
    const player = this._state.player ?? '';
    const el = await openRankingScreen({
      client: this.deps.rankingClient,
      refresh: async () => {
        const ok = await this.deps.availability.refresh();
        this._state.availability = this.deps.availability.current;
        return ok;
      },
      playerName: player,
      onBack: () => {
        if (from === 'result' && this._state.lastResult) {
          this._state.screen = 'result';
          this.renderResult();
        } else {
          this.showStart();
        }
      },
    });
    if (token !== this.navToken) return;
    if (el === null) {
      // 接続できない: 現在の画面を維持し、可用性の表示だけ更新する
      if (from === 'start' && this._state.screen === 'start') this.renderStart();
      else if (from === 'result' && this._state.screen === 'result') this.renderResult();
      return;
    }
    this._state.returnTo = from;
    this._state.screen = 'ranking';
    this.mount(el);
  }
}

import type { NameStore } from './name-store';
import type { RankingClient } from './ranking-client';

export type RegistrationStatus =
  | { kind: 'idle' }
  | { kind: 'registering' }
  | { kind: 'done'; rank: number | null }
  | { kind: 'failed'; message: string; retryable: boolean } // 通信エラーは true、検証エラーは理由を表示
  | { kind: 'notApplicable'; reason: 'offline' };

export type RegistrationPlan = 'register' | 'skipOffline';

/** 接続成功なら register、失敗なら skipOffline(リクエストを送らない。要件 9.17)。 */
export const decideRegistration = (connected: boolean): RegistrationPlan =>
  connected ? 'register' : 'skipOffline';

export const COMMUNICATION_ERROR_MESSAGE = '通信に失敗しました。もう一度お試しください。';
export const NO_NAME_MESSAGE = 'プレイヤー名が設定されていないため登録できません。';

interface Pending {
  name: string;
  total: number;
  sessionId: string;
}

/**
 * ゲーム終了時のスコア自動登録。名前の重複は確認しない(要件 9.7, 13.5)。
 * `done` になった Session_Id には以後リクエストを送らない(要件 9.10)。
 */
export class RegistrationController {
  private _status: RegistrationStatus = { kind: 'idle' };
  private pending: Pending | null = null;
  private inFlight: Promise<RegistrationStatus> | null = null;
  private readonly succeeded = new Map<string, RegistrationStatus>();

  constructor(
    private readonly client: RankingClient,
    private readonly nameStore: NameStore,
    private readonly onStatus: (s: RegistrationStatus) => void = () => {},
  ) {}

  get status(): RegistrationStatus {
    return this._status;
  }

  private setStatus(s: RegistrationStatus): RegistrationStatus {
    this._status = s;
    try {
      this.onStatus(s);
    } catch {
      // 通知先の例外で登録処理を失敗させない
    }
    return s;
  }

  /** ゲーム終了時に呼ぶ。接続確認 → 成功時のみ送信。例外は投げない。 */
  registerSession(total: number, sessionId: string): Promise<RegistrationStatus> {
    if (this.inFlight) return this.inFlight;
    const done = this.succeeded.get(sessionId);
    if (done) return Promise.resolve(this.setStatus(done)); // 成功済みは再送しない(要件 9.10, 9.14)
    const run = this.doRegister(total, sessionId).finally(() => {
      this.inFlight = null;
    });
    this.inFlight = run;
    return run;
  }

  /** 同じ名前、点数、Session_Id で再送する(要件 9.12)。 */
  retry(): Promise<RegistrationStatus> {
    if (this.inFlight) return this.inFlight;
    if (this.pending === null || this._status.kind !== 'failed' || !this._status.retryable) {
      return Promise.resolve(this._status);
    }
    const run = this.submit(this.pending).finally(() => {
      this.inFlight = null;
    });
    this.inFlight = run;
    return run;
  }

  private async doRegister(total: number, sessionId: string): Promise<RegistrationStatus> {
    this.pending = null;
    this.setStatus({ kind: 'registering' });

    let connected = false;
    try {
      connected = (await this.client.checkConnection()) === true;
    } catch {
      connected = false;
    }
    if (decideRegistration(connected) === 'skipOffline') {
      return this.setStatus({ kind: 'notApplicable', reason: 'offline' });
    }

    const name = this.nameStore.load();
    if (name === null) {
      return this.setStatus({ kind: 'failed', message: NO_NAME_MESSAGE, retryable: false });
    }
    const pending: Pending = { name, total, sessionId };
    this.pending = pending;
    return this.submit(pending);
  }

  private async submit(p: Pending): Promise<RegistrationStatus> {
    this.setStatus({ kind: 'registering' });
    try {
      const res = await this.client.submitScore(p.name, p.total, p.sessionId);
      if (res.status === 'ok') {
        this.pending = null; // 成功した Session_Id は再送しない
        const done: RegistrationStatus = { kind: 'done', rank: res.rank };
        this.succeeded.set(p.sessionId, done);
        return this.setStatus(done);
      }
      if (res.status === 'validation') {
        return this.setStatus({ kind: 'failed', message: res.reason, retryable: false });
      }
    } catch {
      // 失敗として扱う
    }
    return this.setStatus({ kind: 'failed', message: COMMUNICATION_ERROR_MESSAGE, retryable: true });
  }
}

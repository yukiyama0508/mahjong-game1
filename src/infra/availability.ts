import type { RankingClient } from './ranking-client';

export type Availability = 'enabled' | 'offline';

/**
 * Ranking_Availability の保持。初期値と、確認が一度も完了していない間は 'offline'。
 * 結果は current の更新と onChange(値が変わったときのみ)の通知だけに使う。
 */
export class AvailabilityTracker {
  private _current: Availability = 'offline';
  private latestRequest = 0;

  constructor(
    private readonly client: RankingClient,
    private readonly onChange: (a: Availability) => void,
  ) {}

  get current(): Availability {
    return this._current;
  }

  /**
   * Connection_Check を実行し、結果で current を更新する。例外は投げない。
   * 並行して呼ばれた場合は最後に開始した呼び出しの結果のみを反映する。
   * 戻り値は、この呼び出し自身の確認結果(成功なら true)。
   */
  async refresh(): Promise<boolean> {
    const id = ++this.latestRequest;
    let ok = false;
    try {
      ok = (await this.client.checkConnection()) === true;
    } catch {
      ok = false;
    }
    if (id === this.latestRequest) {
      const next: Availability = ok ? 'enabled' : 'offline';
      if (next !== this._current) {
        this._current = next;
        try {
          this.onChange(next);
        } catch {
          // 通知先の例外で refresh を失敗させない
        }
      }
    }
    return ok;
  }
}

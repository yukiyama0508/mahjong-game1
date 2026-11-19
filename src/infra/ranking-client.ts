import { createSupabaseClient } from './supabase-client';

export type SubmitScoreResult =
  | { status: 'ok'; rank: number | null } // 重複 Session_Id も ok(要件 9.14)
  | { status: 'validation'; reason: string }
  | { status: 'error' }; // 通信エラー、5秒タイムアウト

export interface RankingEntry {
  rank: number;
  name: string;
  totalScore: number;
  createdAt: string;
}

export type FetchRankingResult =
  | { status: 'ok'; entries: RankingEntry[] }
  | { status: 'error' };

export interface RankingClient {
  checkConnection(): Promise<boolean>;
  submitScore(name: string, score: number, sessionId: string): Promise<SubmitScoreResult>;
  fetchRanking(): Promise<FetchRankingResult>;
}

export const REQUEST_TIMEOUT_MS = 5000;
export const RANKING_LIMIT = 100;

/** Supabase の応答(error は PostgREST のエラー形)。 */
export interface SupabaseResponse {
  data?: unknown;
  count?: number | null;
  error?: { code?: string; message?: string } | null;
}

/** supabase-js のクエリビルダーのうち、使用するメソッドだけの構造型。 */
export interface SupabaseQuery extends PromiseLike<SupabaseResponse> {
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): SupabaseQuery;
  insert(values: Record<string, unknown>): SupabaseQuery;
  gt(column: string, value: number): SupabaseQuery;
  order(column: string, options?: { ascending?: boolean }): SupabaseQuery;
  limit(count: number): SupabaseQuery;
  abortSignal(signal: AbortSignal): SupabaseQuery;
}

/** SupabaseClient の最小構造型。テストでは fake を注入する。 */
export interface SupabaseLike {
  from(table: string): SupabaseQuery;
}

class TimeoutError extends Error {}

/** 5秒の AbortController タイムアウト付きで要求を実行する。例外は投げず、失敗は null。 */
async function runWithTimeout(
  build: (signal: AbortSignal) => PromiseLike<SupabaseResponse>,
): Promise<SupabaseResponse | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError('timeout'));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    const res = await Promise.race([Promise.resolve(build(controller.signal)), timeout]);
    return res ?? null;
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function toRankingEntry(row: unknown): RankingEntry | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const rank = Number(r.rank);
  const totalScore = r.total_score;
  if (
    !Number.isFinite(rank) ||
    typeof r.name !== 'string' ||
    typeof totalScore !== 'number' ||
    typeof r.created_at !== 'string'
  ) {
    return null;
  }
  return { rank, name: r.name, totalScore, createdAt: r.created_at };
}

export class SupabaseRankingClient implements RankingClient {
  constructor(private readonly supabase: SupabaseLike) {}

  async checkConnection(): Promise<boolean> {
    const res = await runWithTimeout((signal) =>
      this.supabase
        .from('ranking_entries')
        .select('id', { head: true })
        .limit(1)
        .abortSignal(signal),
    );
    return res !== null && !res.error;
  }

  async submitScore(name: string, score: number, sessionId: string): Promise<SubmitScoreResult> {
    const res = await runWithTimeout((signal) =>
      this.supabase
        .from('ranking_entries')
        .insert({ name, total_score: score, session_id: sessionId })
        .abortSignal(signal),
    );
    if (res === null) return { status: 'error' };
    if (res.error) {
      const code = res.error.code;
      if (code === '23505') return { status: 'ok', rank: await this.fetchRank(score) };
      if (code === '23514') {
        return { status: 'validation', reason: res.error.message ?? 'validation error' };
      }
      return { status: 'error' };
    }
    return { status: 'ok', rank: await this.fetchRank(score) };
  }

  /** 順位 = 自分より高い点数の件数 + 1。失敗時は null(登録自体は成功扱い)。 */
  private async fetchRank(score: number): Promise<number | null> {
    const res = await runWithTimeout((signal) =>
      this.supabase
        .from('ranking_entries')
        .select('id', { count: 'exact', head: true })
        .gt('total_score', score)
        .abortSignal(signal),
    );
    if (res === null || res.error) return null;
    const count = res.count;
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return null;
    return count + 1;
  }

  async fetchRanking(): Promise<FetchRankingResult> {
    const res = await runWithTimeout((signal) =>
      this.supabase
        .from('ranking_view')
        .select('rank,name,total_score,created_at')
        .order('rank', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(RANKING_LIMIT)
        .abortSignal(signal),
    );
    if (res === null || res.error || !Array.isArray(res.data)) return { status: 'error' };
    const entries: RankingEntry[] = [];
    for (const row of res.data) {
      const entry = toRankingEntry(row);
      if (entry === null) return { status: 'error' };
      entries.push(entry);
    }
    return { status: 'ok', entries };
  }
}

/** 環境変数が未設定のときに使う。ランキング機能は無効で、ゲームは動く。 */
export class OfflineRankingClient implements RankingClient {
  async checkConnection(): Promise<boolean> {
    return false;
  }
  async submitScore(): Promise<SubmitScoreResult> {
    return { status: 'error' };
  }
  async fetchRanking(): Promise<FetchRankingResult> {
    return { status: 'error' };
  }
}

/** Supabase が使えればその実装、使えなければ OfflineRankingClient を返す。 */
export function createRankingClient(supabase: SupabaseLike | null = createSupabaseClient()): RankingClient {
  return supabase ? new SupabaseRankingClient(supabase) : new OfflineRankingClient();
}

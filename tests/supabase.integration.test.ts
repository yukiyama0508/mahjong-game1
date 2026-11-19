// Supabase 統合テスト(タスク 13.2)。
// ローカル Supabase に supabase/migrations/0001_init.sql を適用済みで、
// SUPABASE_TEST_URL と SUPABASE_TEST_ANON_KEY(未設定なら VITE_ の値)が使える場合のみ実行する。
// 利用できなければ自動的にスキップする。anon キーのみを使い、service_role は使わない。
// Validates: Requirements 9.5, 9.6, 9.7, 9.14, 9.15, 10.2, 10.4, 10.8, 10.9, 10.10, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { SupabaseRankingClient, RANKING_LIMIT, type SupabaseLike } from '../src/infra/ranking-client';

const url = process.env.SUPABASE_TEST_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';

async function probe(): Promise<SupabaseClient | null> {
  if (!url || !anonKey) return null;
  try {
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 3000);
    const res = await client
      .from('ranking_entries')
      .select('id', { head: true })
      .limit(1)
      .abortSignal(ac.signal);
    clearTimeout(timer);
    return res.error ? null : client;
  } catch {
    return null;
  }
}

const sb = await probe();
const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let seq = 0;
const sid = () => `it-${run}-${seq++}`;

describe.skipIf(sb === null)('Supabase 統合テスト(ローカル)', () => {
  const db = sb as SupabaseClient;
  const insert = (name: string, score: number, sessionId = sid()) =>
    db.from('ranking_entries').insert({ name, total_score: score, session_id: sessionId });

  it('接続確認用の head SELECT が成功する', async () => {
    const res = await db.from('ranking_entries').select('id', { head: true }).limit(1);
    expect(res.error).toBeNull();
  });

  describe('名前規則', () => {
    const rejected: [string, string][] = [
      ['前の半角スペース', ' abc'],
      ['後ろの半角スペース', 'abc '],
      ['前の全角スペース', '\u3000abc'],
      ['後ろの全角スペース', 'abc\u3000'],
      ['21文字', 'あ'.repeat(21)],
      ['制御文字(タブ)', 'a\tb'],
      ['制御文字(NUL以外 0x01)', 'a\u0001b'],
      ['制御文字(DEL)', 'a\u007fb'],
      ['空文字', ''],
    ];
    for (const [label, name] of rejected) {
      it(`拒否: ${label}`, async () => {
        const { error } = await insert(name, 10);
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23514');
      });
    }

    it('絵文字を含む20文字を受理する', async () => {
      const name = '🀄'.repeat(10) + 'あ'.repeat(10);
      expect([...name]).toHaveLength(20);
      const { error } = await insert(name, 10);
      expect(error).toBeNull();
    });

    it('20文字ちょうどを受理し、1文字も受理する', async () => {
      expect((await insert('a'.repeat(20), 10)).error).toBeNull();
      expect((await insert('a', 10)).error).toBeNull();
    });
  });

  describe('点数の範囲', () => {
    it('-1 と 1,000,001 を拒否する', async () => {
      expect((await insert('range', -1)).error?.code).toBe('23514');
      expect((await insert('range', 1_000_001)).error?.code).toBe('23514');
    });
    it('0 と 1,000,000 を受理する', async () => {
      expect((await insert('range', 0)).error).toBeNull();
      expect((await insert('range', 1_000_000)).error).toBeNull();
    });
  });

  describe('session_id と同名', () => {
    it('同じ session_id の2回目を拒否する(一意制約)', async () => {
      const id = sid();
      expect((await insert('dup', 5, id)).error).toBeNull();
      expect((await insert('dup', 5, id)).error?.code).toBe('23505');
    });

    it('同名の複数エントリを保存できる', async () => {
      const name = `same-${run}`;
      expect((await insert(name, 1)).error).toBeNull();
      expect((await insert(name, 2)).error).toBeNull();
      const { data, error } = await db.from('ranking_entries').select('id').eq('name', name);
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('並行する登録で欠落がない', async () => {
      const name = `conc-${run}`;
      const n = 30;
      const results = await Promise.all(
        Array.from({ length: n }, (_, i) => insert(name, 100 + i)),
      );
      for (const r of results) expect(r.error).toBeNull();
      const { data, error } = await db.from('ranking_entries').select('id').eq('name', name);
      expect(error).toBeNull();
      expect(data).toHaveLength(n);
    });
  });

  describe('anon の権限', () => {
    it('UPDATE が反映されない(拒否または0件)', async () => {
      const id = sid();
      await insert('upd', 7, id);
      const res = await db
        .from('ranking_entries')
        .update({ total_score: 999 })
        .eq('session_id', id)
        .select();
      expect(res.error !== null || (res.data ?? []).length === 0).toBe(true);
      const { data } = await db.from('ranking_entries').select('total_score').eq('session_id', id);
      expect(data?.[0]?.total_score).toBe(7);
    });

    it('DELETE が反映されない(拒否または0件)', async () => {
      const id = sid();
      await insert('del', 7, id);
      const res = await db.from('ranking_entries').delete().eq('session_id', id).select();
      expect(res.error !== null || (res.data ?? []).length === 0).toBe(true);
      const { data } = await db.from('ranking_entries').select('id').eq('session_id', id);
      expect(data).toHaveLength(1);
    });
  });

  describe('ランキング(101件以上の投入後)', () => {
    it('上位100件、点数降順、同点は先着順、同点は同順位', async () => {
      // 既存データがあっても上位に入るよう、高得点帯(999,000〜999,100)に 101 件投入する。
      const tag = `rank-${run}`;
      const scores: number[] = [];
      for (let i = 0; i < 101; i++) scores.push(999_000 + (i % 50)); // 同点を含む
      // 先着順を保証するため直列で投入する。
      for (const s of scores) {
        const { error } = await insert(tag, s);
        expect(error).toBeNull();
      }

      const client = new SupabaseRankingClient(db as unknown as SupabaseLike);
      const res = await client.fetchRanking();
      expect(res.status).toBe('ok');
      if (res.status !== 'ok') return;
      const e = res.entries;
      expect(e.length).toBeLessThanOrEqual(RANKING_LIMIT);
      expect(e.length).toBe(RANKING_LIMIT);

      for (let i = 1; i < e.length; i++) {
        expect(e[i - 1].totalScore).toBeGreaterThanOrEqual(e[i].totalScore);
        if (e[i - 1].totalScore === e[i].totalScore) {
          expect(e[i - 1].rank).toBe(e[i].rank); // 同点は同順位
          expect(e[i - 1].createdAt <= e[i].createdAt).toBe(true); // 同点は先着順
        } else {
          expect(e[i].rank).toBeGreaterThan(e[i - 1].rank);
        }
      }
      // 順位 = 1 + 自分より高い点数の件数
      const top = e[0];
      const { count } = await db
        .from('ranking_entries')
        .select('id', { count: 'exact', head: true })
        .gt('total_score', top.totalScore);
      expect(top.rank).toBe((count ?? 0) + 1);
    });

    it('submitScore が順位を返し、重複 session_id も ok になる', async () => {
      const client = new SupabaseRankingClient(db as unknown as SupabaseLike);
      const id = sid();
      const first = await client.submitScore('client', 1_000_000, id);
      expect(first.status).toBe('ok');
      const second = await client.submitScore('client', 1_000_000, id);
      expect(second.status).toBe('ok');
      expect((await client.submitScore(' bad', 1, sid())).status).toBe('validation');
    });
  });
});

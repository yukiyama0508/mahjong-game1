import { createClient } from '@supabase/supabase-js';
import type { SupabaseLike } from './ranking-client';

/**
 * Supabase クライアントを作る。anon key のみを使う(service_role は使わない)。
 * VITE_SUPABASE_URL または VITE_SUPABASE_ANON_KEY が未設定、または作成に失敗した場合は null。
 */
export function createSupabaseClient(
  url: string | undefined = import.meta.env.VITE_SUPABASE_URL as string | undefined,
  anonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
): SupabaseLike | null {
  if (!url || !anonKey || url.trim() === '' || anonKey.trim() === '') return null;
  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return client as unknown as SupabaseLike;
  } catch {
    return null;
  }
}

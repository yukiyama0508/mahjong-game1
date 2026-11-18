-- 麻雀 待ち当てクイズ: ランキング用スキーマ

-- 名前規則: trim済み、1〜20コードポイント、制御文字なし(要件 9.2, 13.2, 15.6)
create function public.is_valid_player_name(n text) returns boolean
language sql immutable as $$
  select n is not null
     and char_length(n) between 1 and 20
     and n !~ '^[\s\u3000]'
     and n !~ '[\s\u3000]$'
     and n !~ '[\u0001-\u001f\u007f-\u009f]'
$$;

-- 名前は一意ではない。同名の複数エントリを許容する(要件 9.7, 15.9)。
-- テーブルは ranking_entries のみ。players テーブルと外部キーは持たない。
create table public.ranking_entries (
  id           bigint generated always as identity primary key,
  name         text not null,
  total_score  integer not null,
  session_id   text not null,
  created_at   timestamptz not null default now(),
  constraint ranking_entries_name_rule    check (public.is_valid_player_name(name)),
  constraint ranking_entries_score_range  check (total_score between 0 and 1000000), -- 要件 9.5, 15.7
  constraint ranking_entries_session_rule check (char_length(session_id) between 1 and 64),
  constraint ranking_entries_session_unique unique (session_id)    -- 要件 9.14, 15.8
);

create index ranking_entries_order_idx
  on public.ranking_entries (total_score desc, created_at asc);

-- 順位 = 1 + 自分より高い点数の件数(同点は同順位)(要件 10.4)
create view public.ranking_view with (security_invoker = true) as
select rank() over (order by total_score desc) as rank,
       name, total_score, created_at
from public.ranking_entries;

-- RLS と権限 (anon は INSERT と SELECT のみ)(要件 10.2, 15.4, 15.5)
alter table public.ranking_entries enable row level security;

revoke all on public.ranking_entries, public.ranking_view from anon, authenticated;
grant select, insert on public.ranking_entries to anon;
grant select on public.ranking_view to anon;

-- 内容の検証は CHECK / UNIQUE 制約が担う
create policy ranking_entries_select on public.ranking_entries
  for select to anon using (true);
create policy ranking_entries_insert on public.ranking_entries
  for insert to anon with check (true);

-- UPDATE / DELETE のポリシーは作成せず、権限も付与しない(要件 15.5)。

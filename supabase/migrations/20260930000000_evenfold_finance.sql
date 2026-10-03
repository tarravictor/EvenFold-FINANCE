-- Apply to a dedicated EvenFold FINANCE Supabase project.
create table if not exists public.finance_state (
  owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  version bigint not null default 0 check (version >= 0),
  data jsonb not null default '{"entries":[],"bills":[],"goals":[],"groupSplits":[],"budgets":{}}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint finance_state_object check (jsonb_typeof(data) = 'object')
);
create index if not exists finance_state_updated_at_idx on public.finance_state (updated_at);
alter table public.finance_state enable row level security;
revoke all on public.finance_state from anon;
revoke truncate, references, trigger on public.finance_state from authenticated;
grant select, insert, update, delete on public.finance_state to authenticated;
create policy "read own finance" on public.finance_state for select to authenticated using ((select auth.uid()) = owner);
create policy "create own finance" on public.finance_state for insert to authenticated with check ((select auth.uid()) = owner);
create policy "update own finance" on public.finance_state for update to authenticated using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "delete own finance" on public.finance_state for delete to authenticated using ((select auth.uid()) = owner);

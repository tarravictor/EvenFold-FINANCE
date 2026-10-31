-- Friend circles: small groups that share an opt-in status snapshot, joined by invite code or link.
-- Apply to the same Supabase project as 20260930000000_evenfold_finance.sql.
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  status jsonb not null default '{}'::jsonb check (jsonb_typeof(status) = 'object' and char_length(status::text) <= 1500),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index if not exists circle_members_user_idx on public.circle_members (user_id);

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
revoke all on public.circles, public.circle_members from anon, authenticated;
grant select on public.circles to authenticated;
grant select, delete on public.circle_members to authenticated;
grant update (display_name, status, updated_at) on public.circle_members to authenticated;

-- Security definer so the policies below do not recurse into circle_members' own RLS.
create or replace function public.is_circle_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.circle_members where circle_id = cid and user_id = (select auth.uid()));
$$;
revoke all on function public.is_circle_member(uuid) from public, anon;
grant execute on function public.is_circle_member(uuid) to authenticated;

create policy "members read circle" on public.circles for select to authenticated using (public.is_circle_member(id));
create policy "members read members" on public.circle_members for select to authenticated using (public.is_circle_member(circle_id));
create policy "update own membership" on public.circle_members for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "leave circle" on public.circle_members for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.new_circle_code() returns text
language plpgsql volatile set search_path = '' as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result text; begin
  loop
    result := '';
    for i in 1..8 loop
      result := result || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.circles where code = result);
  end loop;
  return result;
end $$;
revoke all on function public.new_circle_code() from public, anon, authenticated;

create or replace function public.create_circle(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cid uuid; begin
  if uid is null then raise exception 'Sign in first.'; end if;
  if (select count(*) from public.circle_members where user_id = uid) >= 10 then raise exception 'You can be in up to 10 circles.'; end if;
  insert into public.circles (name, code, created_by) values (btrim(p_name), public.new_circle_code(), uid) returning id into cid;
  insert into public.circle_members (circle_id, user_id, display_name) values (cid, uid, btrim(p_display_name));
  return cid;
end $$;

create or replace function public.join_circle(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cid uuid; begin
  if uid is null then raise exception 'Sign in first.'; end if;
  select id into cid from public.circles where code = upper(btrim(p_code));
  if cid is null then raise exception 'That invite code is not valid.'; end if;
  if exists (select 1 from public.circle_members where circle_id = cid and user_id = uid) then return cid; end if;
  if (select count(*) from public.circle_members where user_id = uid) >= 10 then raise exception 'You can be in up to 10 circles.'; end if;
  if (select count(*) from public.circle_members where circle_id = cid) >= 20 then raise exception 'This circle is full (20 people).'; end if;
  insert into public.circle_members (circle_id, user_id, display_name) values (cid, uid, btrim(p_display_name));
  return cid;
end $$;

-- Creator only: invalidates the old code/link without removing anyone.
create or replace function public.rotate_circle_code(p_circle uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare fresh text; begin
  if not exists (select 1 from public.circles where id = p_circle and created_by = auth.uid()) then raise exception 'Only the creator can change the invite code.'; end if;
  fresh := public.new_circle_code();
  update public.circles set code = fresh where id = p_circle;
  return fresh;
end $$;

-- Leaving the last seat removes the circle.
create or replace function public.leave_circle(p_circle uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.circle_members where circle_id = p_circle and user_id = auth.uid();
  delete from public.circles c where c.id = p_circle and not exists (select 1 from public.circle_members m where m.circle_id = c.id);
end $$;

revoke all on function public.create_circle(text, text), public.join_circle(text, text), public.rotate_circle_code(uuid), public.leave_circle(uuid) from public, anon;
grant execute on function public.create_circle(text, text), public.join_circle(text, text), public.rotate_circle_code(uuid), public.leave_circle(uuid) to authenticated;

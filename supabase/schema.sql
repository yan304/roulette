-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

-- Everyone in the roulette. People who sign in with Google use their auth
-- user id as the row id; names an admin types in get a random id and
-- manual = true.
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  avatar_url text,
  manual boolean not null default false,
  created_at timestamptz not null default now()
);

-- Upgrade older installs, where every participant had to be a signed-in user.
alter table public.participants drop constraint if exists participants_id_fkey;
alter table public.participants alter column id set default gen_random_uuid();
alter table public.participants add column if not exists manual boolean not null default false;

-- History of spins. The winner's name is copied so history survives if they leave.
create table if not exists public.spins (
  id bigint generated always as identity primary key,
  winner_id uuid,
  winner_name text not null,
  winner_avatar_url text,
  spun_by uuid references auth.users (id) on delete set null,
  -- True when this spin only drew from people who hadn't won before.
  excluded_winners boolean not null default false,
  -- Winners picked together in one spin share a draw_id.
  draw_id uuid,
  created_at timestamptz not null default now()
);

alter table public.spins add column if not exists excluded_winners boolean not null default false;
alter table public.spins add column if not exists draw_id uuid;

alter table public.participants enable row level security;
alter table public.spins enable row level security;

-- Anyone can see the list of names and past winners.
drop policy if exists "participants are public" on public.participants;
create policy "participants are public" on public.participants
  for select using (true);

drop policy if exists "spins are public" on public.spins;
create policy "spins are public" on public.spins
  for select using (true);

-- Users can only add, edit or remove their own name.
drop policy if exists "users insert themselves" on public.participants;
create policy "users insert themselves" on public.participants
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "users update themselves" on public.participants;
create policy "users update themselves" on public.participants
  for update to authenticated using ((select auth.uid()) = id);

drop policy if exists "users delete themselves" on public.participants;
create policy "users delete themselves" on public.participants
  for delete to authenticated using ((select auth.uid()) = id);

-- Admins: the only accounts allowed to spin and remove names.
-- Grant access with:
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'admin@example.com';
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

drop policy if exists "admins can see themselves" on public.admins;
create policy "admins can see themselves" on public.admins
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Admins can add names by hand and remove anyone's name.
drop policy if exists "admins insert anyone" on public.participants;
create policy "admins insert anyone" on public.participants
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins delete anyone" on public.participants;
create policy "admins delete anyone" on public.participants
  for delete to authenticated using (public.is_admin());

-- No insert policy on spins: rows are only created through spin() below,
-- which only admins may call and which picks the winner on the server so the
-- result can't be tampered with.
-- Replaced by spin(exclude_winners, winner_count) below.
drop function if exists public.spin();
drop function if exists public.spin(boolean);

-- Picks winner_count different people at random in one go, optionally only
-- from people who have never won, and records them under one draw_id.
create or replace function public.spin(exclude_winners boolean default false, winner_count integer default 1)
returns setof public.spins
language plpgsql
security definer
set search_path = public
as $$
declare
  d uuid := gen_random_uuid();
  available integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can spin';
  end if;

  if winner_count < 1 or winner_count > 50 then
    raise exception 'Pick between 1 and 50 winners';
  end if;

  select count(*) into available
  from public.participants p
  where not exclude_winners
     or not exists (select 1 from public.spins x where x.winner_id = p.id);

  if available = 0 then
    if exclude_winners then
      raise exception 'Everyone has already won';
    end if;
    raise exception 'Nobody has joined the roulette yet';
  end if;

  if available < winner_count then
    raise exception 'Only % eligible, can''t pick %', available, winner_count;
  end if;

  return query
  with picked as (
    select p.id, p.name, p.avatar_url
    from public.participants p
    where not exclude_winners
       or not exists (select 1 from public.spins x where x.winner_id = p.id)
    order by random()
    limit winner_count
  ), inserted as (
    insert into public.spins (winner_id, winner_name, winner_avatar_url, spun_by, excluded_winners, draw_id)
    select id, name, avatar_url, auth.uid(), exclude_winners, d from picked
    returning *
  )
  select * from inserted order by id;
end;
$$;

revoke execute on function public.spin(boolean, integer) from public, anon;
grant execute on function public.spin(boolean, integer) to authenticated;

-- Admin-only: start over. Removes every name and all spin history.
create or replace function public.reset_roulette()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can reset the roulette';
  end if;

  delete from public.spins where true;
  delete from public.participants where true;
end;
$$;

revoke execute on function public.reset_roulette() from public, anon;
grant execute on function public.reset_roulette() to authenticated;

-- Live updates for every open browser.
do $$
begin
  alter publication supabase_realtime add table public.participants;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.spins;
exception when duplicate_object then null;
end $$;

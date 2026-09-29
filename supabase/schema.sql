-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

-- Everyone who signed in with Google and joined the roulette.
create table if not exists public.participants (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- History of spins. The winner's name is copied so history survives if they leave.
create table if not exists public.spins (
  id bigint generated always as identity primary key,
  winner_id uuid,
  winner_name text not null,
  winner_avatar_url text,
  spun_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

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

-- Admins can remove anyone's name.
drop policy if exists "admins delete anyone" on public.participants;
create policy "admins delete anyone" on public.participants
  for delete to authenticated using (public.is_admin());

-- No insert policy on spins: rows are only created through spin() below,
-- which only admins may call and which picks the winner on the server so the
-- result can't be tampered with.
create or replace function public.spin()
returns public.spins
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.participants;
  s public.spins;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can spin';
  end if;

  select * into w from public.participants order by random() limit 1;
  if not found then
    raise exception 'Nobody has joined the roulette yet';
  end if;

  insert into public.spins (winner_id, winner_name, winner_avatar_url, spun_by)
  values (w.id, w.name, w.avatar_url, auth.uid())
  returning * into s;

  return s;
end;
$$;

revoke execute on function public.spin() from public, anon;
grant execute on function public.spin() to authenticated;

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

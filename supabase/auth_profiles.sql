-- Supabase Auth + profiles setup.
-- Run this in the Supabase SQL Editor before using auth-backed accounts.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.labels (
  id text primary key,
  user_id text not null,
  name text not null,
  color text not null default '#4A90E2',
  is_visible boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.events (
  id text primary key,
  user_id text not null,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_all_day boolean not null default false,
  label_id text,
  recurrence_rule text,
  recurring_event_id text,
  original_start_time timestamptz,
  google_event_id text,
  device_event_id text,
  updated_at timestamptz not null default now(),
  foreign key (label_id, user_id)
    references public.labels(id, user_id)
    on delete set null (label_id)
);

create index if not exists labels_user_id_idx on public.labels(user_id);
create index if not exists labels_updated_at_idx on public.labels(updated_at);
create index if not exists events_user_id_idx on public.events(user_id);
create index if not exists events_updated_at_idx on public.events(updated_at);
create index if not exists events_start_time_idx on public.events(start_time);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.labels enable row level security;

drop policy if exists profiles_select_public_fields on public.profiles;
create policy profiles_select_public_fields
on public.profiles
for select
to authenticated
using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists events_owner_select on public.events;
create policy events_owner_select
on public.events
for select
to authenticated
using (auth.uid()::text = user_id);

drop policy if exists events_owner_insert on public.events;
create policy events_owner_insert
on public.events
for insert
to authenticated
with check (auth.uid()::text = user_id);

drop policy if exists events_owner_update on public.events;
create policy events_owner_update
on public.events
for update
to authenticated
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

drop policy if exists events_owner_delete on public.events;
create policy events_owner_delete
on public.events
for delete
to authenticated
using (auth.uid()::text = user_id);

drop policy if exists labels_owner_select on public.labels;
create policy labels_owner_select
on public.labels
for select
to authenticated
using (auth.uid()::text = user_id);

drop policy if exists labels_owner_insert on public.labels;
create policy labels_owner_insert
on public.labels
for insert
to authenticated
with check (auth.uid()::text = user_id);

drop policy if exists labels_owner_update on public.labels;
create policy labels_owner_update
on public.labels
for update
to authenticated
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

drop policy if exists labels_owner_delete on public.labels;
create policy labels_owner_delete
on public.labels
for delete
to authenticated
using (auth.uid()::text = user_id);

revoke select on public.profiles from anon, authenticated;
grant select (id, username, display_name, avatar_url) on public.profiles to authenticated;

create or replace view public.profiles_public
with (security_invoker = true) as
select id, username, display_name, avatar_url
from public.profiles
where username is not null;

grant select on public.profiles_public to authenticated;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'username', ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

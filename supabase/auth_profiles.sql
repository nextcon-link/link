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
  google_calendar_id text,
  google_access_role text,
  google_sync_enabled boolean not null default false,
  google_is_readonly boolean not null default false,
  sharing_mode text not null default 'none' check (sharing_mode in ('none', 'visible', 'invisible', 'blind')),
  deleted_at timestamptz,
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
  google_calendar_id text,
  google_etag text,
  google_updated_at timestamptz,
  device_event_id text,
  sharing_mode text not null default 'none' check (sharing_mode in ('none', 'visible', 'invisible', 'blind')),
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (label_id, user_id)
    references public.labels(id, user_id)
    on delete set null (label_id)
);

alter table public.labels add column if not exists google_calendar_id text;
alter table public.labels add column if not exists google_access_role text;
alter table public.labels add column if not exists google_sync_enabled boolean not null default false;
alter table public.labels add column if not exists google_is_readonly boolean not null default false;
alter table public.labels add column if not exists sharing_mode text not null default 'none';
alter table public.labels add column if not exists deleted_at timestamptz;
alter table public.events add column if not exists google_calendar_id text;
alter table public.events add column if not exists google_etag text;
alter table public.events add column if not exists google_updated_at timestamptz;
alter table public.events add column if not exists sharing_mode text not null default 'none';
alter table public.events add column if not exists deleted_at timestamptz;

do $$
begin
  alter table public.labels
    alter column sharing_mode set default 'none';
  alter table public.labels
    drop constraint if exists labels_sharing_mode_check;
  alter table public.labels
    add constraint labels_sharing_mode_check
    check (sharing_mode in ('none', 'visible', 'invisible', 'blind'));

  alter table public.events
    alter column sharing_mode set default 'none';
  alter table public.events
    drop constraint if exists events_sharing_mode_check;
  alter table public.events
    add constraint events_sharing_mode_check
    check (sharing_mode in ('none', 'visible', 'invisible', 'blind'));
end $$;

create table if not exists public.google_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_subject text,
  google_email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  is_connected boolean not null default true,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_calendar_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label_id text references public.labels(id) on delete set null,
  google_calendar_id text not null,
  google_calendar_summary text not null,
  google_access_role text,
  google_sync_token text,
  watch_channel_id text,
  watch_resource_id text,
  watch_expires_at timestamptz,
  watch_supported boolean not null default true,
  is_enabled boolean not null default true,
  is_readonly boolean not null default false,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_calendar_id)
);

alter table public.google_calendar_links add column if not exists watch_supported boolean not null default true;
alter table public.google_calendar_links add column if not exists last_sync_at timestamptz;
alter table public.google_calendar_links add column if not exists last_error text;
update public.google_calendar_links
set watch_supported = false
where is_readonly = true;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_low_id < user_high_id),
  unique (user_low_id, user_high_id)
);

alter table public.google_connections add column if not exists google_email text;

create table if not exists public.friend_share_settings (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  is_enabled boolean not null default false,
  weeks_ahead integer not null default 1 check (weeks_ahead between 1 and 52),
  selected_label_ids text[] not null default '{}',
  include_unlabeled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, friend_user_id),
  check (owner_user_id <> friend_user_id)
);

create index if not exists labels_user_id_idx on public.labels(user_id);
create index if not exists labels_updated_at_idx on public.labels(updated_at);
create index if not exists labels_deleted_at_idx on public.labels(deleted_at);
create index if not exists events_user_id_idx on public.events(user_id);
create index if not exists events_updated_at_idx on public.events(updated_at);
create index if not exists events_start_time_idx on public.events(start_time);
create index if not exists events_deleted_at_idx on public.events(deleted_at);
create unique index if not exists events_google_event_idx
  on public.events(user_id, google_calendar_id, google_event_id)
  where google_calendar_id is not null and google_event_id is not null;
create index if not exists google_calendar_links_user_id_idx on public.google_calendar_links(user_id);
create index if not exists google_calendar_links_watch_channel_idx on public.google_calendar_links(watch_channel_id);
create index if not exists friendships_user_low_id_idx on public.friendships(user_low_id);
create index if not exists friendships_user_high_id_idx on public.friendships(user_high_id);
create index if not exists friend_share_settings_friend_user_id_idx
  on public.friend_share_settings(friend_user_id);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.labels enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_share_settings enable row level security;
alter table public.google_connections enable row level security;
alter table public.google_calendar_links enable row level security;

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

drop policy if exists google_calendar_links_owner_select on public.google_calendar_links;
create policy google_calendar_links_owner_select
on public.google_calendar_links
for select
to authenticated
using (auth.uid() = user_id);

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

drop policy if exists friendships_owner_select on public.friendships;
create policy friendships_owner_select
on public.friendships
for select
to authenticated
using (auth.uid() = user_low_id or auth.uid() = user_high_id);

drop policy if exists friendships_owner_delete on public.friendships;
create policy friendships_owner_delete
on public.friendships
for delete
to authenticated
using (auth.uid() = user_low_id or auth.uid() = user_high_id);

drop policy if exists friend_share_settings_owner_select on public.friend_share_settings;
create policy friend_share_settings_owner_select
on public.friend_share_settings
for select
to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists friend_share_settings_owner_insert on public.friend_share_settings;
create policy friend_share_settings_owner_insert
on public.friend_share_settings
for insert
to authenticated
with check (auth.uid() = owner_user_id);

drop policy if exists friend_share_settings_owner_update on public.friend_share_settings;
create policy friend_share_settings_owner_update
on public.friend_share_settings
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists friend_share_settings_owner_delete on public.friend_share_settings;
create policy friend_share_settings_owner_delete
on public.friend_share_settings
for delete
to authenticated
using (auth.uid() = owner_user_id);

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

drop trigger if exists labels_set_updated_at on public.labels;
create trigger labels_set_updated_at
before insert or update on public.labels
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before insert or update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists friend_share_settings_set_updated_at on public.friend_share_settings;
create trigger friend_share_settings_set_updated_at
before insert or update on public.friend_share_settings
for each row execute function public.set_updated_at();

create or replace function public.clear_events_for_deleted_label()
returns trigger as $$
begin
  if new.deleted_at is not null and old.deleted_at is distinct from new.deleted_at then
    update public.events
    set label_id = null
    where user_id = new.user_id
      and label_id = new.id
      and deleted_at is null;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists labels_clear_events_on_soft_delete on public.labels;
create trigger labels_clear_events_on_soft_delete
after update of deleted_at on public.labels
for each row execute function public.clear_events_for_deleted_label();

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

create or replace function public.get_friends()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
) as $$
begin
  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case
      when f.user_low_id = auth.uid() then f.user_high_id
      else f.user_low_id
    end
  where auth.uid() = f.user_low_id
     or auth.uid() = f.user_high_id
  order by coalesce(p.display_name, p.username), p.username;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.add_friend_by_username(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
) as $$
declare
  target_user_id uuid;
  low_id uuid;
  high_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select profiles.id
  into target_user_id
  from public.profiles
  where profiles.username = nullif(trim(p_username), '')
  limit 1;

  if target_user_id is null then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'cannot_add_self' using errcode = 'P0001';
  end if;

  low_id := least(auth.uid(), target_user_id);
  high_id := greatest(auth.uid(), target_user_id);

  insert into public.friendships (user_low_id, user_high_id)
  values (low_id, high_id)
  on conflict (user_low_id, user_high_id) do nothing;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    f.created_at
  from public.friendships f
  join public.profiles p on p.id = target_user_id
  where f.user_low_id = low_id
    and f.user_high_id = high_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.remove_friend(p_friend_id uuid)
returns void as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from public.friendships
  where (user_low_id = least(auth.uid(), p_friend_id)
     and user_high_id = greatest(auth.uid(), p_friend_id));
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.get_friend_share_setting(p_friend_id uuid)
returns table (
  is_enabled boolean,
  weeks_ahead integer,
  selected_label_ids text[],
  include_unlabeled boolean
) as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.friendships f
    where f.user_low_id = least(auth.uid(), p_friend_id)
      and f.user_high_id = greatest(auth.uid(), p_friend_id)
  ) then
    raise exception 'not_friends' using errcode = 'P0001';
  end if;

  return query
  select
    coalesce(s.is_enabled, false),
    coalesce(s.weeks_ahead, 1),
    coalesce(s.selected_label_ids, '{}')::text[],
    coalesce(s.include_unlabeled, true)
  from (select 1) seed
  left join public.friend_share_settings s
    on s.owner_user_id = auth.uid()
   and s.friend_user_id = p_friend_id
  limit 1;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.upsert_friend_share_setting(
  p_friend_id uuid,
  p_is_enabled boolean,
  p_weeks_ahead integer,
  p_selected_label_ids text[],
  p_include_unlabeled boolean
)
returns table (
  is_enabled boolean,
  weeks_ahead integer,
  selected_label_ids text[],
  include_unlabeled boolean
) as $$
declare
  sanitized_label_ids text[];
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.friendships f
    where f.user_low_id = least(auth.uid(), p_friend_id)
      and f.user_high_id = greatest(auth.uid(), p_friend_id)
  ) then
    raise exception 'not_friends' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct label_id), '{}')::text[]
  into sanitized_label_ids
  from unnest(coalesce(p_selected_label_ids, '{}')::text[]) as requested(label_id)
  where exists (
    select 1
    from public.labels l
    where l.id = requested.label_id
      and l.user_id = auth.uid()::text
      and l.deleted_at is null
  );

  insert into public.friend_share_settings (
    owner_user_id,
    friend_user_id,
    is_enabled,
    weeks_ahead,
    selected_label_ids,
    include_unlabeled
  )
  values (
    auth.uid(),
    p_friend_id,
    coalesce(p_is_enabled, false),
    least(greatest(coalesce(p_weeks_ahead, 1), 1), 52),
    sanitized_label_ids,
    coalesce(p_include_unlabeled, true)
  )
  on conflict (owner_user_id, friend_user_id) do update
  set
    is_enabled = excluded.is_enabled,
    weeks_ahead = excluded.weeks_ahead,
    selected_label_ids = excluded.selected_label_ids,
    include_unlabeled = excluded.include_unlabeled;

  return query
  select
    s.is_enabled,
    s.weeks_ahead,
    s.selected_label_ids,
    s.include_unlabeled
  from public.friend_share_settings s
  where s.owner_user_id = auth.uid()
    and s.friend_user_id = p_friend_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.get_friend_shared_events(
  p_friend_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
returns table (
  id text,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  is_all_day boolean,
  recurrence_rule text,
  color text
) as $$
declare
  share_setting public.friend_share_settings%rowtype;
  seoul_today date;
  allowed_start timestamptz;
  allowed_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.friendships f
    where f.user_low_id = least(auth.uid(), p_friend_id)
      and f.user_high_id = greatest(auth.uid(), p_friend_id)
  ) then
    return;
  end if;

  select *
  into share_setting
  from public.friend_share_settings s
  where s.owner_user_id = p_friend_id
    and s.friend_user_id = auth.uid()
    and s.is_enabled = true
  limit 1;

  if share_setting.owner_user_id is null then
    return;
  end if;

  seoul_today := (now() at time zone 'Asia/Seoul')::date;
  allowed_start :=
    ((seoul_today - extract(dow from seoul_today)::integer)::timestamp
      at time zone 'Asia/Seoul');
  allowed_end := allowed_start + (share_setting.weeks_ahead * interval '7 days');

  if p_range_start >= allowed_end or p_range_end < allowed_start then
    return;
  end if;

  return query
  with visible_events as (
    select
      e.id,
      case
        when e.sharing_mode = 'visible' then e.title
        when e.sharing_mode = 'blind' then '블라인드'
        when e.sharing_mode = 'invisible' then null
        when coalesce(l.sharing_mode, 'none') = 'blind' then '블라인드'
        when coalesce(l.sharing_mode, 'none') = 'invisible' then null
        else e.title
      end as resolved_title,
      e.start_time,
      e.end_time,
      e.is_all_day,
      e.recurrence_rule,
      coalesce(l.color, '#6C8AE4') as color
    from public.events e
    left join public.labels l
      on l.id = e.label_id
     and l.user_id = e.user_id
     and l.deleted_at is null
    where e.user_id = p_friend_id::text
      and e.deleted_at is null
      and (
        (e.label_id is null and share_setting.include_unlabeled)
        or (e.label_id is not null and e.label_id = any(share_setting.selected_label_ids))
      )
      and (
        (
          e.start_time <= least(p_range_end, allowed_end)
          and e.end_time >= greatest(p_range_start, allowed_start)
        )
        or (
          e.recurrence_rule is not null
          and e.start_time <= least(p_range_end, allowed_end)
        )
      )
  )
  select
    visible_events.id,
    visible_events.resolved_title,
    visible_events.start_time,
    visible_events.end_time,
    visible_events.is_all_day,
    visible_events.recurrence_rule,
    visible_events.color
  from visible_events
  where visible_events.resolved_title is not null
  order by visible_events.start_time;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.get_friends() to authenticated;
grant execute on function public.add_friend_by_username(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.get_friend_share_setting(uuid) to authenticated;
grant execute on function public.upsert_friend_share_setting(uuid, boolean, integer, text[], boolean) to authenticated;
grant execute on function public.get_friend_shared_events(uuid, timestamptz, timestamptz) to authenticated;

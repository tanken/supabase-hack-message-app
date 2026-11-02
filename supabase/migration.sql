-- Applied to Supabase project "Supabase Hackathon" (mttopqljhujyhfxxtpdo)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(content) between 1 and 500),
  author_token uuid not null default gen_random_uuid(),
  likes_count integer not null default 0,
  share_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index messages_created_at_idx on public.messages (created_at desc);

alter table public.messages enable row level security;

create policy "anyone can read messages"
  on public.messages for select
  using (true);

create policy "anyone can insert a message"
  on public.messages for insert
  with check (true);

-- likes tracked per-browser via a client-generated uuid, to allow unlike / prevent double counting without auth
create table public.message_likes (
  message_id uuid not null references public.messages (id) on delete cascade,
  liker_token uuid not null,
  created_at timestamptz not null default now(),
  primary key (message_id, liker_token)
);

alter table public.message_likes enable row level security;

create policy "anyone can read likes"
  on public.message_likes for select
  using (true);

create policy "anyone can insert a like"
  on public.message_likes for insert
  with check (true);

create policy "anyone can remove their own like"
  on public.message_likes for delete
  using (true);

-- keep messages.likes_count in sync
create function public.sync_message_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.messages set likes_count = likes_count + 1 where id = new.message_id;
  elsif (tg_op = 'DELETE') then
    update public.messages set likes_count = greatest(likes_count - 1, 0) where id = old.message_id;
  end if;
  return null;
end;
$$;

create trigger message_likes_count_trigger
after insert or delete on public.message_likes
for each row execute function public.sync_message_likes_count();

-- random message, optionally excluding one the client already has
create function public.get_random_message(exclude_id uuid default null)
returns setof public.messages
language sql
stable
as $$
  select *
  from public.messages
  where (exclude_id is null or id <> exclude_id)
  order by random()
  limit 1;
$$;

-- atomic share counter bump
create function public.increment_share_count(target_id uuid)
returns public.messages
language sql
as $$
  update public.messages
  set share_count = share_count + 1
  where id = target_id
  returning *;
$$;

-- kindness tree stats (one round trip for the Tree view and home hero)
create or replace function public.get_kindness_stats()
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'messages', count(*),
    'likes', coalesce(sum(likes_count), 0),
    'shares', coalesce(sum(share_count), 0),
    'this_week', count(*) filter (where created_at > now() - interval '7 days'),
    'today', count(*) filter (where created_at > now() - interval '1 day')
  )
  from public.messages;
$$;

grant execute on function public.get_kindness_stats() to anon, authenticated;

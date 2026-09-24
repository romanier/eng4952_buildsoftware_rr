-- Run this once in Supabase: SQL Editor > New query > paste > Run

create table if not exists habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  created_at  timestamptz not null default now()
);

create table if not exists habit_logs (
  id        uuid primary key default gen_random_uuid(),
  habit_id  uuid not null references habits(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  log_date  date not null,
  unique (habit_id, log_date)
);

-- Row Level Security: each user can only see and change their own rows.
alter table habits      enable row level security;
alter table habit_logs  enable row level security;

create policy "habits: owner can do everything"
  on habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "logs: owner can do everything"
  on habit_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

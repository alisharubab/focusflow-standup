
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  job_title text,
  team_name text,
  avatar_url text,
  default_tone text not null default 'professional',
  standup_format text not null default 'ytb',
  name_in_standup boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own profile delete" on public.profiles for delete using (auth.uid() = id);

-- project_tags
create table public.project_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#5B4FE8',
  created_at timestamptz not null default now()
);
alter table public.project_tags enable row level security;
create policy "own tags all" on public.project_tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  tag_id uuid references public.project_tags(id) on delete set null,
  is_blocker boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notes enable row level security;
create policy "own notes all" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- standups
create table public.standups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  standup_date date not null default current_date,
  yesterday text,
  today text,
  blockers text,
  highlights text,
  tone text not null default 'professional',
  raw_note_ids uuid[],
  edited boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.standups enable row level security;
create policy "own standups all" on public.standups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger for profiles
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- auto-create profile + default tags on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));

  insert into public.project_tags (user_id, name, color) values
    (new.id, 'General', '#5B4FE8'),
    (new.id, 'Frontend', '#2A7A5A'),
    (new.id, 'Backend', '#8A5C00');
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

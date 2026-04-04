-- Momentum AI V2 foundation schema.
-- Safe rollout plan:
-- 1. Snapshot the current schema using ../legacy/2026-04-04-pre-v2.sql
-- 2. Rename current live tables to old_meetings / old_tasks
-- 3. Create these new workspace-scoped tables
-- 4. Backfill legacy data through a controlled script, not ad hoc SQL

create extension if not exists pgcrypto;

alter table if exists public.meetings rename to old_meetings;
alter table if exists public.tasks rename to old_tasks;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  plan text not null default 'hackathon',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  workspace_id uuid references public.workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);

create table if not exists public.extension_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  label text not null default 'Primary browser',
  token text not null unique,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  legacy_meeting_id uuid unique,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  source_platform text not null default 'google_meet',
  source_meeting_url text,
  source_meeting_code text,
  source_meeting_label text,
  ai_title text,
  summary_markdown text,
  summary_paragraph text,
  transcript_text text,
  audio_storage_path text,
  recording_started_at timestamptz,
  recording_stopped_at timestamptz,
  transcript_status text not null default 'uploaded',
  extraction_status text not null default 'pending',
  scoring_status text not null default 'pending',
  processing_status text not null default 'uploaded',
  processing_error text,
  overall_score integer,
  clarity_score integer,
  ownership_score integer,
  execution_score integer,
  score_rationale text,
  analysis_version text not null default 'v2',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  display_name text not null,
  matched_profile_id uuid references public.profiles(id) on delete set null,
  confidence numeric(4, 3),
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_transcript_segments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  speaker text,
  segment_index integer not null,
  started_at_seconds numeric(10, 2),
  ended_at_seconds numeric(10, 2),
  text text not null,
  created_at timestamptz not null default now(),
  unique (meeting_id, segment_index)
);

create table if not exists public.meeting_decisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  text text not null,
  confidence numeric(4, 3),
  source_snippet text,
  source_segment_id uuid references public.meeting_transcript_segments(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_tasks (
  id uuid primary key default gen_random_uuid(),
  legacy_task_id uuid unique,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  title text not null,
  owner_name text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  due_date date,
  due_date_label text,
  status text not null default 'pending',
  confidence numeric(4, 3),
  needs_review boolean not null default false,
  source_snippet text,
  source_segment_id uuid references public.meeting_transcript_segments(id) on delete set null,
  resolved_flag_state text not null default 'open',
  edited_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_checklist_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  task_id uuid references public.meeting_tasks(id) on delete set null,
  text text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_risk_flags (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  task_id uuid references public.meeting_tasks(id) on delete set null,
  type text not null,
  severity text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_processing_events (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  stage text not null,
  status text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_workspace_id_idx on public.profiles (workspace_id);
create index if not exists workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index if not exists meetings_workspace_id_idx on public.meetings (workspace_id, created_at desc);
create index if not exists meetings_legacy_meeting_id_idx on public.meetings (legacy_meeting_id);
create index if not exists meeting_tasks_meeting_id_idx on public.meeting_tasks (meeting_id);
create index if not exists meeting_tasks_legacy_task_id_idx on public.meeting_tasks (legacy_task_id);
create index if not exists meeting_tasks_status_idx on public.meeting_tasks (status);
create index if not exists meeting_risk_flags_meeting_id_idx on public.meeting_risk_flags (meeting_id);
create index if not exists meeting_transcript_segments_meeting_id_idx on public.meeting_transcript_segments (meeting_id, segment_index);

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.extension_connections enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.meeting_transcript_segments enable row level security;
alter table public.meeting_decisions enable row level security;
alter table public.meeting_tasks enable row level security;
alter table public.meeting_checklist_items enable row level security;
alter table public.meeting_risk_flags enable row level security;
alter table public.meeting_processing_events enable row level security;

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
as $$
  select workspace_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create policy "workspace members can read their workspace"
  on public.workspaces
  for select
  using (
    exists (
      select 1
      from public.workspace_members
      where workspace_members.workspace_id = workspaces.id
        and workspace_members.profile_id = auth.uid()
    )
  );

create policy "profiles can read peers in same workspace"
  on public.profiles
  for select
  using (
    profiles.workspace_id = public.current_workspace_id()
    or profiles.id = auth.uid()
  );

create policy "profiles can update self"
  on public.profiles
  for update
  using (profiles.id = auth.uid())
  with check (profiles.id = auth.uid());

create policy "workspace members can read membership"
  on public.workspace_members
  for select
  using (workspace_members.workspace_id = public.current_workspace_id());

create policy "workspace members can read extension connections"
  on public.extension_connections
  for select
  using (extension_connections.workspace_id = public.current_workspace_id());

create policy "workspace members can read meetings"
  on public.meetings
  for select
  using (meetings.workspace_id = public.current_workspace_id());

create policy "workspace members can read participants"
  on public.meeting_participants
  for select
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_participants.meeting_id
        and meetings.workspace_id = public.current_workspace_id()
    )
  );

create policy "workspace members can read transcript segments"
  on public.meeting_transcript_segments
  for select
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_transcript_segments.meeting_id
        and meetings.workspace_id = public.current_workspace_id()
    )
  );

create policy "workspace members can read decisions"
  on public.meeting_decisions
  for select
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_decisions.meeting_id
        and meetings.workspace_id = public.current_workspace_id()
    )
  );

create policy "workspace members can read tasks"
  on public.meeting_tasks
  for select
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_tasks.meeting_id
        and meetings.workspace_id = public.current_workspace_id()
    )
  );

create policy "workspace members can update tasks"
  on public.meeting_tasks
  for update
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_tasks.meeting_id
        and meetings.workspace_id = public.current_workspace_id()
    )
  )
  with check (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_tasks.meeting_id
        and meetings.workspace_id = public.current_workspace_id()
    )
  );

create policy "workspace members can read checklist"
  on public.meeting_checklist_items
  for select
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_checklist_items.meeting_id
        and meetings.workspace_id = public.current_workspace_id()
    )
  );

create policy "workspace members can read risk flags"
  on public.meeting_risk_flags
  for select
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_risk_flags.meeting_id
        and meetings.workspace_id = public.current_workspace_id()
    )
  );

create policy "workspace members can read processing events"
  on public.meeting_processing_events
  for select
  using (
    exists (
      select 1
      from public.meetings
      where meetings.id = meeting_processing_events.meeting_id
        and meetings.workspace_id = public.current_workspace_id()
    )
  );

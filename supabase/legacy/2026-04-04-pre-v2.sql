-- Legacy snapshot captured on April 4, 2026 before the V2 schema rollout.
-- This documents the currently working hackathon schema so we can preserve it
-- while introducing a cleaner workspace-scoped model.

create extension if not exists pgcrypto;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null,
  title text null,
  summary text null,
  transcript text null,
  clarity integer null,
  actionability integer null,
  audio_url text null,
  status text null
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  title text null,
  assignee text null,
  deadline text null,
  status text null
);

create index if not exists meetings_created_at_idx on public.meetings (created_at desc);
create index if not exists tasks_meeting_id_idx on public.tasks (meeting_id);
create index if not exists tasks_status_idx on public.tasks (status);

-- Motion Transfer (IA): tabela para acompanhar as gerações via fal.ai (fal-ai/wan-motion).
-- Run this migration in Supabase SQL Editor.

create table if not exists public.motion_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text,
  character_image_path text,
  character_image_url text,
  reference_video_path text,
  reference_video_url text,
  prompt text,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  result_path text,
  result_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists motion_transfers_user_id_idx on public.motion_transfers(user_id);

alter table public.motion_transfers enable row level security;

create policy "motion_transfers_owner" on public.motion_transfers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

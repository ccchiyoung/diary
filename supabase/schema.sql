-- 감정 다이어리 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 한 번 실행하세요.

-- 1) 기록 테이블 ---------------------------------------------------------------
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  text text default '',
  color text default '#343A40',
  width integer default 0,
  height integer default 0,
  doodle_path text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.entries enable row level security;

-- 본인 데이터만 접근 가능
drop policy if exists "entries_select_own" on public.entries;
create policy "entries_select_own" on public.entries
  for select using (auth.uid() = user_id);

drop policy if exists "entries_insert_own" on public.entries;
create policy "entries_insert_own" on public.entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "entries_update_own" on public.entries;
create policy "entries_update_own" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "entries_delete_own" on public.entries;
create policy "entries_delete_own" on public.entries
  for delete using (auth.uid() = user_id);

-- 2) 두들 이미지 스토리지 버킷 (비공개) ---------------------------------------
insert into storage.buckets (id, name, public)
values ('doodles', 'doodles', false)
on conflict (id) do nothing;

-- 경로 규칙: {user_id}/{date}.png — 본인 폴더만 접근 가능
drop policy if exists "doodles_select_own" on storage.objects;
create policy "doodles_select_own" on storage.objects
  for select using (
    bucket_id = 'doodles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "doodles_insert_own" on storage.objects;
create policy "doodles_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'doodles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "doodles_update_own" on storage.objects;
create policy "doodles_update_own" on storage.objects
  for update using (
    bucket_id = 'doodles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "doodles_delete_own" on storage.objects;
create policy "doodles_delete_own" on storage.objects
  for delete using (
    bucket_id = 'doodles'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Supabase SQL Editor에서 실행: 대/중/소 분류 마스터 (단일 행 id=1)
create table if not exists public.category_settings (
  id smallint primary key default 1,
  payload jsonb not null default '{"1":[],"2":[],"3":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint category_settings_singleton check (id = 1)
);

comment on table public.category_settings is '필터 대/중/소분류 마스터: payload 키 "1","2","3" 에 {name,active}[]';

-- 기본 행 채우기: 같은 폴더의 category_settings_seed.sql 실행 (또는 앱에서 한 번 저장)

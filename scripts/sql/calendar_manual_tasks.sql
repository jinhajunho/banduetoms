-- 대시보드 캘린더 «캘린더 등록» 수동 일정 (프로젝트와 별도)
-- Supabase SQL Editor에서 실행 후 RLS는 서비스 롤 API만 사용하므로 선택 사항입니다.

create table if not exists public.calendar_manual_tasks (
    id text primary key,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create index if not exists calendar_manual_tasks_updated_at_idx
    on public.calendar_manual_tasks (updated_at desc);

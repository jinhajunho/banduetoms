-- (선택·레거시) 예전 방식: 클라이언트가 JWT로 storage.from().upload() 할 때만 필요.
-- 현재 앱은 큰 파일도 서명 URL(uploadToSignedUrl) 경로를 쓰므로 이 SQL 없이 동작하는 것이 정상입니다.
--
-- Supabase Dashboard → SQL Editor 에서 1회 실행.
-- 버킷 이름을 바꿨다면 bucket_id 조건과 VITE_SUPABASE_EXPENSE_RECEIPTS_BUCKET / 서버 env 를 동일하게 맞추세요.

begin;

drop policy if exists "bps_auth_insert_contractors" on storage.objects;
drop policy if exists "bps_auth_update_contractors" on storage.objects;

create policy "bps_auth_insert_contractors"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and name like 'contractors/%'
);

create policy "bps_auth_update_contractors"
on storage.objects for update to authenticated
using (
  bucket_id = 'expense-receipts'
  and name like 'contractors/%'
);

commit;

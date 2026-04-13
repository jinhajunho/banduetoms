-- 업체 첨부: 클라이언트에서 Supabase Storage로 직접 업로드할 때 필요한 RLS 정책
-- (Vercel 서버리스 본문 한도 ~4.5MB 를 피하기 위함)
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

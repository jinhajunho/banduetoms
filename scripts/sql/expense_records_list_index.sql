-- Supabase → SQL Editor에서 한 번 실행.
-- api/expense.js list: .order('updated_at', { ascending: false }) 에 맞춘 인덱스.

CREATE INDEX IF NOT EXISTS idx_expense_records_updated_at_desc
  ON public.expense_records (updated_at DESC);

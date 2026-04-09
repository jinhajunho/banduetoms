-- Supabase → SQL Editor에서 한 번 실행.
-- api/estimate.js list: .order('updated_at', { ascending: false }) 에 맞춘 인덱스.
-- 행이 수천 걉 넘어가면 TTFB·정렬 비용 완화에 도움이 됩니다.

CREATE INDEX IF NOT EXISTS idx_estimate_records_updated_at_desc
  ON public.estimate_records (updated_at DESC);

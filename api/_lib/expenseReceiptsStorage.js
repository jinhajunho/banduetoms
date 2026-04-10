/**
 * 경비 영수증 — Supabase Storage 버킷 연동
 * 버킷은 대시보드에서 생성(권장 이름: expense-receipts, 비공개).
 * 환경변수 SUPABASE_EXPENSE_RECEIPTS_BUCKET 으로 버킷명 오버라이드 가능.
 */

export function getExpenseReceiptsBucket() {
    const b = process.env.SUPABASE_EXPENSE_RECEIPTS_BUCKET;
    return b && String(b).trim() ? String(b).trim() : 'expense-receipts';
}

export function sanitizeExpenseReceiptFileName(name) {
    const raw = String(name || 'file').replace(/[/\\]/g, '_');
    const base = raw.split(/[/\\]/).pop() || 'file';
    const cleaned = base.replace(/[^\w.\-가-힣()+\s]/g, '_').replace(/\s+/g, '_');
    const limited = cleaned.length > 120 ? cleaned.slice(-120) : cleaned;
    return limited || 'file';
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin */
export async function removeExpenseReceiptObjectsFromPayload(supabaseAdmin, payload) {
    const bucket = getExpenseReceiptsBucket();
    const receipts = payload && Array.isArray(payload.receipts) ? payload.receipts : [];
    const paths = [];
    receipts.forEach(function (r) {
        const p = r && typeof r.storagePath === 'string' ? r.storagePath.trim() : '';
        if (p && /^expenses\/\d+\//.test(p)) paths.push(p);
    });
    if (!paths.length) return;
    const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
    if (error) throw new Error(error.message);
}

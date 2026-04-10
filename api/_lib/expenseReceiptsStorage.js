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

/** 업로드·서명 허용 경로(앱 전용 prefix) */
export function isAllowedStorageObjectPath(path) {
    const p = String(path || '').trim();
    if (!p || p.indexOf('..') !== -1) return false;
    return (
        /^expenses\/\d+\//.test(p) ||
        /^contractors\/\d+\/(license|bank)\//.test(p) ||
        /^estimates\/[^/]+\/[^/]+\//.test(p)
    );
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin */
export async function removeStorageObjectsByPaths(supabaseAdmin, paths) {
    const bucket = getExpenseReceiptsBucket();
    const list = (paths || []).filter(function (p) {
        return typeof p === 'string' && isAllowedStorageObjectPath(p);
    });
    if (!list.length) return;
    const { error } = await supabaseAdmin.storage.from(bucket).remove(list);
    if (error) throw new Error(error.message);
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin */
export async function removeExpenseReceiptObjectsFromPayload(supabaseAdmin, payload) {
    const receipts = payload && Array.isArray(payload.receipts) ? payload.receipts : [];
    const paths = [];
    receipts.forEach(function (r) {
        const p = r && typeof r.storagePath === 'string' ? r.storagePath.trim() : '';
        if (p && /^expenses\/\d+\//.test(p)) paths.push(p);
    });
    return removeStorageObjectsByPaths(supabaseAdmin, paths);
}

export function collectStoragePathsFromContractorPayload(payload) {
    const paths = [];
    if (!payload || typeof payload !== 'object') return paths;
    ['licenseStoragePath', 'bankStoragePath'].forEach(function (k) {
        const p = typeof payload[k] === 'string' ? payload[k].trim() : '';
        if (p && isAllowedStorageObjectPath(p)) paths.push(p);
    });
    ['licenseFiles', 'bankFiles'].forEach(function (k) {
        const arr = Array.isArray(payload[k]) ? payload[k] : [];
        arr.forEach(function (row) {
            const p = row && typeof row.storagePath === 'string' ? row.storagePath.trim() : '';
            if (p && isAllowedStorageObjectPath(p)) paths.push(p);
        });
    });
    return paths;
}

function walkFinanceRowsForAttachmentPaths(rows, out) {
    if (!Array.isArray(rows)) return;
    rows.forEach(function (row) {
        if (!Array.isArray(row)) return;
        const m = row[9];
        if (m && typeof m === 'object' && !Array.isArray(m) && Array.isArray(m.attachments)) {
            m.attachments.forEach(function (a) {
                const p = a && typeof a.storagePath === 'string' ? a.storagePath.trim() : '';
                if (p && isAllowedStorageObjectPath(p)) out.push(p);
            });
        }
    });
}

export function collectStoragePathsFromEstimatePayload(payload) {
    const paths = [];
    if (!payload || typeof payload !== 'object') return paths;
    walkFinanceRowsForAttachmentPaths(payload.salesRows, paths);
    walkFinanceRowsForAttachmentPaths(payload.purchaseRows, paths);
    return paths;
}

export function sanitizeEstimateCodeForStorage(code) {
    let s = String(code || '').trim();
    if (!s) return 'unknown';
    s = s.replace(/[^a-zA-Z0-9._-가-힣]/g, '_').replace(/_+/g, '_');
    return s.slice(0, 96) || 'unknown';
}

export function sanitizeEstimateRowKeyForStorage(key) {
    let s = String(key || '').trim();
    if (!s) return 'row';
    s = s.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
    return s.slice(0, 120) || 'row';
}

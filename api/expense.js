export const runtime = 'nodejs';

import { requireActiveUser } from './_lib/activeAuth.js';
import {
    getExpenseReceiptsBucket,
    isAllowedStorageObjectPath,
    removeExpenseReceiptObjectsFromPayload,
} from './_lib/expenseReceiptsStorage.js';

function parseSignedUrlSeconds() {
    const raw = process.env.EXPENSE_RECEIPT_SIGNED_URL_SECONDS;
    if (raw && /^\d+$/.test(String(raw).trim())) {
        const n = parseInt(String(raw).trim(), 10);
        if (n >= 60 && n <= 86400) return n;
    }
    return 3600;
}

/** action:get 전용 — DB에는 넣지 않고 응답에만 ephemeral signedUrl 부착 (클라이언트가 /api/storage 왕복 생략) */
async function attachSignedUrlsToExpensePayload(supabaseAdmin, payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const receipts = Array.isArray(payload.receipts) ? payload.receipts : [];
    if (receipts.length === 0) return payload;
    const bucket = getExpenseReceiptsBucket();
    const sec = parseSignedUrlSeconds();
    const nextReceipts = [];
    for (let i = 0; i < receipts.length; i++) {
        const r = receipts[i];
        if (!r || typeof r !== 'object') {
            nextReceipts.push(r);
            continue;
        }
        const o = { ...r };
        const p = typeof o.storagePath === 'string' ? o.storagePath.trim() : '';
        if (p && isAllowedStorageObjectPath(p)) {
            const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(p, sec);
            if (!error && data && data.signedUrl) {
                o.signedUrl = data.signedUrl;
            }
        }
        nextReceipts.push(o);
    }
    return { ...payload, receipts: nextReceipts };
}

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

/** 목록 응답 크기 축소: 긴 data URL은 제거(상세/수정 시 action:get으로 전체 로드) */
function liteExpensePayloadForList(p) {
    if (!p || typeof p !== 'object') return p;
    const o = { ...p };
    if (o.receipts && Array.isArray(o.receipts)) {
        o.receipts = o.receipts.map(function (r) {
            if (!r || typeof r !== 'object') return r;
            const next = { ...r };
            const du = next.dataUrl != null ? String(next.dataUrl) : '';
            if (du.length > 500) {
                delete next.dataUrl;
            }
            return next;
        });
    }
    return o;
}

export default {
    async fetch(request) {
        try {
            if (request.method !== 'POST') {
                return jsonResponse(405, { ok: false, error: 'Method Not Allowed' });
            }

            const auth = await requireActiveUser(request);
            if (auth.error) return auth.error;
            const { supabaseAdmin } = auth;

            const body = await request.json().catch(() => ({}));
            const action = body && body.action;

            if (action === 'list') {
                const { data, error } = await supabaseAdmin
                    .from('expense_records')
                    .select('id, payload')
                    .order('updated_at', { ascending: false });

                if (error) return jsonResponse(500, { ok: false, error: error.message });
                const items = (data || []).map(function (r) {
                    if (!r || typeof r.payload !== 'object' || r.payload === null) return null;
                    const p = { ...r.payload };
                    if (p.id === undefined || p.id === null) p.id = Number(r.id);
                    return liteExpensePayloadForList(p);
                }).filter(Boolean);

                return jsonResponse(200, { ok: true, items });
            }

            if (action === 'get') {
                const id = body && body.id != null ? Number(body.id) : NaN;
                if (!Number.isFinite(id)) {
                    return jsonResponse(400, { ok: false, error: 'id is required' });
                }
                const { data: row, error } = await supabaseAdmin
                    .from('expense_records')
                    .select('id, payload')
                    .eq('id', id)
                    .maybeSingle();
                if (error) return jsonResponse(500, { ok: false, error: error.message });
                if (!row || typeof row.payload !== 'object' || row.payload === null) {
                    return jsonResponse(404, { ok: false, error: 'not found' });
                }
                let p = { ...row.payload };
                if (p.id === undefined || p.id === null) p.id = Number(row.id);
                p = await attachSignedUrlsToExpensePayload(supabaseAdmin, p);
                return jsonResponse(200, { ok: true, item: p });
            }

            if (action === 'upsert') {
                const item = body && typeof body.item === 'object' ? body.item : null;
                const id = item && item.id != null ? Number(item.id) : NaN;
                if (!item || !Number.isFinite(id)) {
                    return jsonResponse(400, { ok: false, error: 'item.id is required' });
                }

                let payload = { ...item, id };
                if (payload.receipts && Array.isArray(payload.receipts)) {
                    payload.receipts = payload.receipts.map(function (r) {
                        if (!r || typeof r !== 'object') return r;
                        const x = { ...r };
                        delete x.signedUrl;
                        return x;
                    });
                }

                const { error } = await supabaseAdmin.from('expense_records').upsert(
                    {
                        id,
                        payload,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'id' }
                );

                if (error) return jsonResponse(500, { ok: false, error: error.message });
                return jsonResponse(200, { ok: true });
            }

            if (action === 'delete') {
                const id = body && body.id != null ? Number(body.id) : NaN;
                if (!Number.isFinite(id)) {
                    return jsonResponse(400, { ok: false, error: 'id is required' });
                }

                const { data: row, error: selErr } = await supabaseAdmin
                    .from('expense_records')
                    .select('payload')
                    .eq('id', id)
                    .maybeSingle();
                if (selErr) return jsonResponse(500, { ok: false, error: selErr.message });
                if (row && row.payload && typeof row.payload === 'object') {
                    try {
                        await removeExpenseReceiptObjectsFromPayload(supabaseAdmin, row.payload);
                    } catch (_e) {
                        /* Storage 정리 실패해도 DB 삭제는 진행 */
                    }
                }

                const { error } = await supabaseAdmin.from('expense_records').delete().eq('id', id);
                if (error) return jsonResponse(500, { ok: false, error: error.message });

                return jsonResponse(200, { ok: true });
            }

            return jsonResponse(400, { ok: false, error: 'action must be list, get, upsert, or delete' });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

export const runtime = 'nodejs';

import { requireActiveUser } from './_lib/activeAuth.js';
import { getExpenseReceiptsBucket, isAllowedStorageObjectPath } from './_lib/expenseReceiptsStorage.js';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

function parseSignedUrlSeconds() {
    const raw = process.env.EXPENSE_RECEIPT_SIGNED_URL_SECONDS;
    if (raw && /^\d+$/.test(String(raw).trim())) {
        const n = parseInt(String(raw).trim(), 10);
        if (n >= 60 && n <= 86400) return n;
    }
    return 3600;
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
            const path = body && typeof body.path === 'string' ? body.path.trim() : '';
            if (!path || !isAllowedStorageObjectPath(path)) {
                return jsonResponse(400, { ok: false, error: 'invalid path' });
            }

            const bucket = getExpenseReceiptsBucket();
            const sec = parseSignedUrlSeconds();
            const { data, error } = await supabaseAdmin.storage
                .from(bucket)
                .createSignedUrl(path, sec);

            if (error || !data || !data.signedUrl) {
                return jsonResponse(500, {
                    ok: false,
                    error: error?.message || 'signed URL 생성 실패',
                });
            }

            return jsonResponse(200, { ok: true, url: data.signedUrl, expiresIn: sec });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

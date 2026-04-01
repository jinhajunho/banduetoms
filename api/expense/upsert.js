export const runtime = 'nodejs';

import { requireActiveUser } from '../_lib/activeAuth.js';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
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
            const item = body && typeof body.item === 'object' ? body.item : null;
            const id = item && item.id != null ? Number(item.id) : NaN;
            if (!item || !Number.isFinite(id)) {
                return jsonResponse(400, { ok: false, error: 'item.id is required' });
            }

            const payload = { ...item, id };

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
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

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
            const code = String(item && item.code ? item.code : '').trim();
            if (!item || !code) {
                return jsonResponse(400, { ok: false, error: 'item.code is required' });
            }

            const { error } = await supabaseAdmin
                .from('estimate_records')
                .upsert({
                    code,
                    payload: item,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'code' });

            if (error) return jsonResponse(500, { ok: false, error: error.message });
            return jsonResponse(200, { ok: true });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};


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
            const id = body && body.id != null ? Number(body.id) : NaN;
            if (!Number.isFinite(id)) {
                return jsonResponse(400, { ok: false, error: 'id is required' });
            }

            const { error } = await supabaseAdmin.from('sga_records').delete().eq('id', id);
            if (error) return jsonResponse(500, { ok: false, error: error.message });

            return jsonResponse(200, { ok: true });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

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

            const { data, error } = await supabaseAdmin
                .from('estimate_records')
                .select('code, payload')
                .order('updated_at', { ascending: false });

            if (error) return jsonResponse(500, { ok: false, error: error.message });
            const items = (data || []).map(function (r) {
                return r && typeof r.payload === 'object' ? r.payload : null;
            }).filter(Boolean);

            return jsonResponse(200, { ok: true, items });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};


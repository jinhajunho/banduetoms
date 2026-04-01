export const runtime = 'nodejs';

import { requireActiveUser } from './_lib/activeAuth.js';

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
            const action = body && body.action;

            if (action === 'list') {
                const { data, error } = await supabaseAdmin
                    .from('estimate_records')
                    .select('code, payload')
                    .order('updated_at', { ascending: false });

                if (error) return jsonResponse(500, { ok: false, error: error.message });
                const items = (data || []).map(function (r) {
                    return r && typeof r.payload === 'object' ? r.payload : null;
                }).filter(Boolean);

                return jsonResponse(200, { ok: true, items });
            }

            if (action === 'upsert') {
                const item = body && typeof body.item === 'object' ? body.item : null;
                const code = String(item && item.code ? item.code : '').trim();
                if (!item || !code) {
                    return jsonResponse(400, { ok: false, error: 'item.code is required' });
                }

                const { error } = await supabaseAdmin
                    .from('estimate_records')
                    .upsert(
                        {
                            code,
                            payload: item,
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: 'code' }
                    );

                if (error) return jsonResponse(500, { ok: false, error: error.message });
                return jsonResponse(200, { ok: true });
            }

            if (action === 'delete') {
                const code = String(body && body.code ? body.code : '').trim();
                if (!code) return jsonResponse(400, { ok: false, error: 'code is required' });

                const { error } = await supabaseAdmin.from('estimate_records').delete().eq('code', code);
                if (error) return jsonResponse(500, { ok: false, error: error.message });

                return jsonResponse(200, { ok: true });
            }

            return jsonResponse(400, { ok: false, error: 'action must be list, upsert, or delete' });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

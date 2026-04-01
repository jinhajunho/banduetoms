export const runtime = 'nodejs';

import { requireActiveUser } from './_lib/activeAuth.js';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

/** 단일 행(id=1)에 대/중/소 분류 마스터 JSON 저장 */
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
                    .from('category_settings')
                    .select('payload')
                    .eq('id', 1)
                    .maybeSingle();

                if (error) return jsonResponse(500, { ok: false, error: error.message });
                const payload =
                    data && data.payload && typeof data.payload === 'object' && data.payload !== null
                        ? data.payload
                        : { '1': [], '2': [], '3': [] };
                return jsonResponse(200, { ok: true, payload });
            }

            if (action === 'upsert') {
                const payload = body && body.payload && typeof body.payload === 'object' ? body.payload : null;
                if (!payload) {
                    return jsonResponse(400, { ok: false, error: 'payload is required' });
                }

                const { error } = await supabaseAdmin.from('category_settings').upsert(
                    {
                        id: 1,
                        payload,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'id' }
                );

                if (error) return jsonResponse(500, { ok: false, error: error.message });
                return jsonResponse(200, { ok: true });
            }

            return jsonResponse(400, { ok: false, error: 'action must be list or upsert' });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

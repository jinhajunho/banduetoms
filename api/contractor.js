export const runtime = 'nodejs';

import { requireActiveUser } from './_lib/activeAuth.js';
import {
    collectStoragePathsFromContractorPayload,
    removeStorageObjectsByPaths,
} from './_lib/expenseReceiptsStorage.js';

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
                    .from('contractor_records')
                    .select('id, payload')
                    .order('updated_at', { ascending: false });

                if (error) return jsonResponse(500, { ok: false, error: error.message });
                const items = (data || []).map(function (r) {
                    if (!r || typeof r.payload !== 'object' || r.payload === null) return null;
                    const p = { ...r.payload };
                    if (p.id === undefined || p.id === null) p.id = Number(r.id);
                    return p;
                }).filter(Boolean);

                return jsonResponse(200, { ok: true, items });
            }

            if (action === 'upsert') {
                const item = body && typeof body.item === 'object' ? body.item : null;
                const id = item && item.id != null ? Number(item.id) : NaN;
                if (!item || !Number.isFinite(id)) {
                    return jsonResponse(400, { ok: false, error: 'item.id is required' });
                }

                const payload = { ...item, id };

                const { error } = await supabaseAdmin.from('contractor_records').upsert(
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
                    .from('contractor_records')
                    .select('payload')
                    .eq('id', id)
                    .maybeSingle();
                if (selErr) return jsonResponse(500, { ok: false, error: selErr.message });
                const paths = collectStoragePathsFromContractorPayload(row && row.payload);
                if (paths.length) {
                    try {
                        await removeStorageObjectsByPaths(supabaseAdmin, paths);
                    } catch (e) {
                        return jsonResponse(500, { ok: false, error: e?.message || String(e) });
                    }
                }

                const { error } = await supabaseAdmin.from('contractor_records').delete().eq('id', id);
                if (error) return jsonResponse(500, { ok: false, error: error.message });

                return jsonResponse(200, { ok: true });
            }

            return jsonResponse(400, { ok: false, error: 'action must be list, upsert, or delete' });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

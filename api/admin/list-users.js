export const runtime = 'nodejs';

import { requireAdmin } from '../_lib/adminAuth.js';

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

            const admin = await requireAdmin(request);
            if (admin.error) return admin.error;

            const { supabaseAdmin } = admin;
            const { data, error } = await supabaseAdmin
                .from('user_profiles')
                .select('*')
                .order('display_user_id', { ascending: true });

            if (error) return jsonResponse(500, { ok: false, error: error.message });

            const users = (data || []).map(function (r) {
                return {
                    userId: String(r.display_user_id || '').trim(),
                    name: String(r.name || r.display_user_id || '').trim(),
                    type: r.type === 'external' ? 'external' : 'internal',
                    role: String(r.role || '').trim(),
                    contractorName: String(r.contractor_name || '').trim(),
                    active: r.active !== false,
                    extraAllowedPages: Array.isArray(r.extra_allowed_pages) ? r.extra_allowed_pages : [],
                };
            });

            return jsonResponse(200, { ok: true, users });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};


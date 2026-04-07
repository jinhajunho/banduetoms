export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

function requireEnv(name) {
    const v = process.env[name] || (name === 'SUPABASE_URL' ? process.env.VITE_SUPABASE_URL : undefined);
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

export default {
    async fetch(request) {
        try {
            if (request.method !== 'GET') {
                return jsonResponse(405, { ok: false, error: 'Method Not Allowed' });
            }

            const SUPABASE_URL = requireEnv('SUPABASE_URL');
            const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
            const url = new URL(request.url);
            const displayUserId = String(url.searchParams.get('displayUserId') || '').trim();
            if (!displayUserId) {
                return jsonResponse(400, { ok: false, error: 'displayUserId is required' });
            }

            const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                auth: { persistSession: false },
            });

            const { data, error } = await supabaseAdmin
                .from('user_profiles')
                .select('active, password_reset_required')
                .eq('display_user_id', displayUserId)
                .maybeSingle();

            if (error) return jsonResponse(500, { ok: false, error: error.message });
            if (!data) return jsonResponse(404, { ok: false, error: 'User profile not found' });

            return jsonResponse(200, {
                ok: true,
                active: !!data.active,
                password_reset_required: !!data.password_reset_required,
            });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

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

function createAdminClient() {
    const SUPABASE_URL = requireEnv('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export default {
    async fetch(request) {
        try {
            const supabaseAdmin = createAdminClient();

            // GET /api/auth?displayUserId=...
            if (request.method === 'GET') {
                const url = new URL(request.url);
                const displayUserId = String(url.searchParams.get('displayUserId') || '').trim();
                if (!displayUserId) {
                    return jsonResponse(400, { ok: false, error: 'displayUserId is required' });
                }
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
            }

            // POST /api/auth { displayUserId, password }
            if (request.method === 'POST') {
                const { displayUserId, password } = await request.json().catch(() => ({}));
                if (!displayUserId || typeof displayUserId !== 'string') {
                    return jsonResponse(400, { ok: false, error: 'displayUserId is required' });
                }
                if (!password || typeof password !== 'string' || password.length < 6) {
                    return jsonResponse(400, { ok: false, error: 'password must be at least 6 chars' });
                }
                const { data: profile, error: profileErr } = await supabaseAdmin
                    .from('user_profiles')
                    .select('auth_user_id, active, password_reset_required')
                    .eq('display_user_id', displayUserId)
                    .maybeSingle();

                if (profileErr) return jsonResponse(500, { ok: false, error: profileErr.message });
                if (!profile) return jsonResponse(404, { ok: false, error: 'User profile not found' });
                if (!profile.active) return jsonResponse(403, { ok: false, error: 'User is inactive' });
                if (!profile.password_reset_required) {
                    return jsonResponse(409, {
                        ok: false,
                        error: 'Password reset is not required for this user',
                    });
                }

                const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
                    profile.auth_user_id,
                    { password }
                );
                if (authUpdateErr) return jsonResponse(500, { ok: false, error: authUpdateErr.message });

                const { error: profileUpdateErr } = await supabaseAdmin
                    .from('user_profiles')
                    .update({ password_reset_required: false })
                    .eq('display_user_id', displayUserId);
                if (profileUpdateErr) return jsonResponse(500, { ok: false, error: profileUpdateErr.message });

                return jsonResponse(200, { ok: true });
            }

            return jsonResponse(405, { ok: false, error: 'Method Not Allowed' });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};


import { createClient } from '@supabase/supabase-js';

const ALLOWED = new Set(['super', 'manager', '슈퍼관리자', '관리자']);

export function isAllowedAdminRole(role) {
    return ALLOWED.has(String(role || '').trim());
}

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

function requireEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

export function getBearerToken(request) {
    const header = request.headers.get('authorization') || '';
    const m = header.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
}

/**
 * @returns {Promise<{ supabaseAdmin: import('@supabase/supabase-js').SupabaseClient, authUserId: string } | { error: Response }>}
 */
export async function requireAdmin(request) {
    try {
        const accessToken = getBearerToken(request);
        if (!accessToken) {
            return { error: jsonResponse(401, { ok: false, error: 'Missing Bearer token' }) };
        }

        const SUPABASE_URL = requireEnv('SUPABASE_URL');
        const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');
        const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

        const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false },
        });

        const { data: authData, error: authErr } = await supabaseAnon.auth.getUser(accessToken);
        if (authErr || !authData?.user) {
            return { error: jsonResponse(401, { ok: false, error: authErr?.message || 'Invalid token' }) };
        }

        const authUserId = authData.user.id;
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        const { data: meProfile, error: meErr } = await supabaseAdmin
            .from('user_profiles')
            .select('role, active')
            .eq('auth_user_id', authUserId)
            .maybeSingle();

        if (meErr) return { error: jsonResponse(500, { ok: false, error: meErr.message }) };
        if (!meProfile?.active) return { error: jsonResponse(403, { ok: false, error: 'Not allowed' }) };
        if (!isAllowedAdminRole(meProfile.role)) {
            return { error: jsonResponse(403, { ok: false, error: 'Not allowed' }) };
        }

        return { supabaseAdmin, authUserId };
    } catch (e) {
        return { error: jsonResponse(500, { ok: false, error: e?.message || String(e) }) };
    }
}

import { createClient } from '@supabase/supabase-js';
import { getBearerToken } from './adminAuth.js';

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

export async function requireActiveUser(request) {
    try {
        const accessToken = getBearerToken(request);
        if (!accessToken) return { error: jsonResponse(401, { ok: false, error: 'Missing Bearer token' }) };

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

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        const { data: profile, error: pErr } = await supabaseAdmin
            .from('user_profiles')
            .select('active')
            .eq('auth_user_id', authData.user.id)
            .maybeSingle();
        if (pErr) return { error: jsonResponse(500, { ok: false, error: pErr.message }) };
        if (!profile?.active) return { error: jsonResponse(403, { ok: false, error: 'Not allowed' }) };

        return { supabaseAdmin, authUserId: authData.user.id };
    } catch (e) {
        return { error: jsonResponse(500, { ok: false, error: e?.message || String(e) }) };
    }
}


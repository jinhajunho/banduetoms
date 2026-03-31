export const runtime = 'nodejs';

import crypto from 'crypto';
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
            const { displayUserId } = await request.json().catch(() => ({}));
            if (!displayUserId || typeof displayUserId !== 'string') {
                return jsonResponse(400, { ok: false, error: 'displayUserId is required' });
            }

            const { data: targetProfile, error: targetErr } = await supabaseAdmin
                .from('user_profiles')
                .select('auth_user_id, active')
                .eq('display_user_id', displayUserId.trim())
                .maybeSingle();

            if (targetErr) return jsonResponse(500, { ok: false, error: targetErr.message });
            if (!targetProfile) return jsonResponse(404, { ok: false, error: 'User profile not found' });
            if (!targetProfile.active) {
                return jsonResponse(403, { ok: false, error: 'User is inactive' });
            }

            const tempPassword = crypto.randomBytes(16).toString('base64url');

            const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
                targetProfile.auth_user_id,
                { password: tempPassword }
            );
            if (authUpdateErr) return jsonResponse(500, { ok: false, error: authUpdateErr.message });

            const { error: profileUpdateErr } = await supabaseAdmin
                .from('user_profiles')
                .update({ password_reset_required: true })
                .eq('display_user_id', displayUserId.trim());

            if (profileUpdateErr) {
                return jsonResponse(500, { ok: false, error: profileUpdateErr.message });
            }

            return jsonResponse(200, { ok: true });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

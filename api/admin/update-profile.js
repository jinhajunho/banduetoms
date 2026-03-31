export const runtime = 'nodejs';

import { requireAdmin } from '../_lib/adminAuth.js';
const VIRTUAL_DOMAIN = 'bps-virtual.local';

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
            const body = await request.json().catch(() => ({}));
            const originalDisplayUserId = String(body.originalDisplayUserId || body.displayUserId || '')
                .trim()
                .toLowerCase();
            const nextDisplayUserId = String(body.displayUserId || '').trim().toLowerCase();
            if (!originalDisplayUserId || !nextDisplayUserId) {
                return jsonResponse(400, { ok: false, error: 'displayUserId is required' });
            }

            const { data: target, error: findErr } = await supabaseAdmin
                .from('user_profiles')
                .select('display_user_id, auth_user_id, type')
                .eq('display_user_id', originalDisplayUserId)
                .maybeSingle();
            if (findErr) return jsonResponse(500, { ok: false, error: findErr.message });
            if (!target) {
                return jsonResponse(404, { ok: false, error: 'User profile not found' });
            }

            const patch = {};
            if (Object.prototype.hasOwnProperty.call(body, 'active')) {
                patch.active = !!body.active;
            }
            if (Object.prototype.hasOwnProperty.call(body, 'type')) {
                patch.type = body.type === 'external' ? 'external' : 'internal';
            }
            if (Object.prototype.hasOwnProperty.call(body, 'role')) {
                patch.role = String(body.role || '').trim();
            }
            if (Object.prototype.hasOwnProperty.call(body, 'name')) {
                patch.name = String(body.name || '').trim();
            }
            if (Object.prototype.hasOwnProperty.call(body, 'extraAllowedPages')) {
                patch.extra_allowed_pages = Array.isArray(body.extraAllowedPages) ? body.extraAllowedPages : [];
            }
            if (nextDisplayUserId !== originalDisplayUserId) {
                const { data: dup, error: dupErr } = await supabaseAdmin
                    .from('user_profiles')
                    .select('display_user_id')
                    .eq('display_user_id', nextDisplayUserId)
                    .maybeSingle();
                if (dupErr) return jsonResponse(500, { ok: false, error: dupErr.message });
                if (dup) return jsonResponse(409, { ok: false, error: '이미 존재하는 아이디입니다.' });
                patch.display_user_id = nextDisplayUserId;
                patch.auth_email = `${nextDisplayUserId}@${VIRTUAL_DOMAIN}`;
            }

            let effType = target.type === 'external' ? 'external' : 'internal';
            if (Object.prototype.hasOwnProperty.call(body, 'type')) {
                effType = body.type === 'external' ? 'external' : 'internal';
            }

            if (Object.prototype.hasOwnProperty.call(body, 'contractorName')) {
                const c = String(body.contractorName || '').trim();
                patch.contractor_name = effType === 'external' ? c || '' : '';
            } else if (Object.prototype.hasOwnProperty.call(body, 'type') && effType === 'internal') {
                patch.contractor_name = '';
            }

            if (Object.keys(patch).length === 0) {
                return jsonResponse(400, { ok: false, error: 'No fields to update' });
            }

            const { error: upErr } = await supabaseAdmin
                .from('user_profiles')
                .update(patch)
                .eq('display_user_id', originalDisplayUserId);

            if (upErr) return jsonResponse(500, { ok: false, error: upErr.message });

            if (nextDisplayUserId !== originalDisplayUserId) {
                const { error: auErr } = await supabaseAdmin.auth.admin.updateUserById(
                    target.auth_user_id,
                    { email: `${nextDisplayUserId}@${VIRTUAL_DOMAIN}` }
                );
                if (auErr) return jsonResponse(500, { ok: false, error: auErr.message });
            }
            return jsonResponse(200, { ok: true });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

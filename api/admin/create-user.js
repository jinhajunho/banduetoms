export const runtime = 'nodejs';

import crypto from 'crypto';
import { requireAdmin } from '../_lib/adminAuth.js';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

const VIRTUAL_DOMAIN = 'bps-virtual.local';

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
            const displayUserId = String(body.displayUserId || '').trim().toLowerCase();
            const type = body.type === 'external' ? 'external' : 'internal';
            const role = String(body.role || '').trim();
            const contractorName = String(body.contractorName || '').trim();
            const extraAllowedPages = Array.isArray(body.extraAllowedPages) ? body.extraAllowedPages : [];

            if (!displayUserId) {
                return jsonResponse(400, { ok: false, error: 'displayUserId is required' });
            }
            if (!role) {
                return jsonResponse(400, { ok: false, error: 'role is required' });
            }

            const email = `${displayUserId}@${VIRTUAL_DOMAIN}`;

            const { data: existing, error: exErr } = await supabaseAdmin
                .from('user_profiles')
                .select('display_user_id')
                .eq('display_user_id', displayUserId)
                .maybeSingle();
            if (exErr) return jsonResponse(500, { ok: false, error: exErr.message });
            if (existing) {
                return jsonResponse(409, { ok: false, error: '이미 존재하는 아이디입니다.' });
            }

            const tempPassword = crypto.randomBytes(16).toString('base64url');
            const { data: created, error: cuErr } = await supabaseAdmin.auth.admin.createUser({
                email,
                password: tempPassword,
                email_confirm: true,
            });

            if (cuErr) {
                const dup =
                    /already|registered|exists/i.test(String(cuErr.message || ''));
                if (dup) {
                    return jsonResponse(409, { ok: false, error: '이미 존재하는 아이디입니다.' });
                }
                return jsonResponse(500, { ok: false, error: cuErr.message });
            }
            const authUserId = created?.user?.id;
            if (!authUserId) {
                return jsonResponse(500, { ok: false, error: 'Auth user creation failed' });
            }

            const row = {
                auth_user_id: authUserId,
                auth_email: email,
                display_user_id: displayUserId,
                type,
                role,
                contractor_name: type === 'external' ? contractorName || '' : '',
                active: true,
                extra_allowed_pages: extraAllowedPages,
                password_reset_required: true,
            };

            const { error: insErr } = await supabaseAdmin.from('user_profiles').insert(row);
            if (insErr) {
                try {
                    await supabaseAdmin.auth.admin.deleteUser(authUserId);
                } catch (e) {
                    /* ignore rollback failure */
                }
                return jsonResponse(500, { ok: false, error: insErr.message });
            }

            return jsonResponse(200, { ok: true, displayUserId });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

export const runtime = 'nodejs';

import crypto from 'crypto';
import { requireAdmin } from './_lib/adminAuth.js';

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
            const action = String(body && body.action ? body.action : '').trim();

            if (action === 'list-users') {
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
            }

            if (action === 'create-user') {
                const displayUserId = String(body.displayUserId || '').trim().toLowerCase();
                const name = String(body.name || '').trim();
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
                    const dup = /already|registered|exists/i.test(String(cuErr.message || ''));
                    if (dup) return jsonResponse(409, { ok: false, error: '이미 존재하는 아이디입니다.' });
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
                    name: name || displayUserId,
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
                    } catch (_e) {
                        /* ignore rollback failure */
                    }
                    return jsonResponse(500, { ok: false, error: insErr.message });
                }
                return jsonResponse(200, { ok: true, displayUserId });
            }

            if (action === 'update-profile') {
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
                if (!target) return jsonResponse(404, { ok: false, error: 'User profile not found' });

                const patch = {};
                if (Object.prototype.hasOwnProperty.call(body, 'active')) patch.active = !!body.active;
                if (Object.prototype.hasOwnProperty.call(body, 'type')) {
                    patch.type = body.type === 'external' ? 'external' : 'internal';
                }
                if (Object.prototype.hasOwnProperty.call(body, 'role')) patch.role = String(body.role || '').trim();
                if (Object.prototype.hasOwnProperty.call(body, 'name')) patch.name = String(body.name || '').trim();
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
                    const { error: auErr } = await supabaseAdmin.auth.admin.updateUserById(target.auth_user_id, {
                        email: `${nextDisplayUserId}@${VIRTUAL_DOMAIN}`,
                    });
                    if (auErr) return jsonResponse(500, { ok: false, error: auErr.message });
                }

                return jsonResponse(200, { ok: true });
            }

            if (action === 'reset-password') {
                const displayUserId = String(body.displayUserId || '').trim();
                if (!displayUserId) {
                    return jsonResponse(400, { ok: false, error: 'displayUserId is required' });
                }

                const { data: targetProfile, error: targetErr } = await supabaseAdmin
                    .from('user_profiles')
                    .select('auth_user_id, active')
                    .eq('display_user_id', displayUserId)
                    .maybeSingle();
                if (targetErr) return jsonResponse(500, { ok: false, error: targetErr.message });
                if (!targetProfile) return jsonResponse(404, { ok: false, error: 'User profile not found' });
                if (!targetProfile.active) return jsonResponse(403, { ok: false, error: 'User is inactive' });

                const tempPassword = crypto.randomBytes(16).toString('base64url');
                const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
                    targetProfile.auth_user_id,
                    { password: tempPassword }
                );
                if (authUpdateErr) return jsonResponse(500, { ok: false, error: authUpdateErr.message });

                const { error: profileUpdateErr } = await supabaseAdmin
                    .from('user_profiles')
                    .update({ password_reset_required: true })
                    .eq('display_user_id', displayUserId);
                if (profileUpdateErr) return jsonResponse(500, { ok: false, error: profileUpdateErr.message });

                return jsonResponse(200, { ok: true });
            }

            if (action === 'delete-user') {
                const displayUserId = String(body.displayUserId || '').trim().toLowerCase();
                if (!displayUserId) {
                    return jsonResponse(400, { ok: false, error: 'displayUserId is required' });
                }
                const { data: target, error: targetErr } = await supabaseAdmin
                    .from('user_profiles')
                    .select('auth_user_id, display_user_id')
                    .eq('display_user_id', displayUserId)
                    .maybeSingle();
                if (targetErr) return jsonResponse(500, { ok: false, error: targetErr.message });
                if (!target) return jsonResponse(404, { ok: false, error: 'User profile not found' });
                if (String(target.auth_user_id || '') === String(admin.authUserId || '')) {
                    return jsonResponse(403, { ok: false, error: '현재 로그인한 계정은 삭제할 수 없습니다.' });
                }

                const { error: delProfileErr } = await supabaseAdmin
                    .from('user_profiles')
                    .delete()
                    .eq('display_user_id', displayUserId);
                if (delProfileErr) return jsonResponse(500, { ok: false, error: delProfileErr.message });

                const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(target.auth_user_id);
                if (delAuthErr) {
                    // 프로필은 이미 삭제되어 서비스 접근은 막히므로 경고만 내려줍니다.
                    return jsonResponse(200, { ok: true, warning: delAuthErr.message });
                }

                return jsonResponse(200, { ok: true });
            }

            return jsonResponse(400, {
                ok: false,
                error: 'action must be list-users, create-user, update-profile, reset-password, or delete-user',
            });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};


export const runtime = 'nodejs';

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function isAllowedRole(role) {
  // 실제 role 값(예: super/manager/accounting/...)은 user_profiles 설계에 맞춰 조정하세요.
  return role === 'super' || role === 'manager';
}

export default {
  async fetch(request) {
    try {
      if (request.method !== 'POST') {
        return jsonResponse(405, { ok: false, error: 'Method Not Allowed' });
      }

      const SUPABASE_URL = requireEnv('SUPABASE_URL');
      const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');
      const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

      const { displayUserId } = await request.json().catch(() => ({}));
      if (!displayUserId || typeof displayUserId !== 'string') {
        return jsonResponse(400, { ok: false, error: 'displayUserId is required' });
      }

      const accessToken = getBearerToken(request);
      if (!accessToken) return jsonResponse(401, { ok: false, error: 'Missing Bearer token' });

      // 1) JWT 검증(anon key로 사용자 확인)
      const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      });

      const { data: authData, error: authErr } = await supabaseAnon.auth.getUser(accessToken);
      if (authErr || !authData?.user) {
        return jsonResponse(401, { ok: false, error: authErr?.message || 'Invalid token' });
      }

      const authUserId = authData.user.id;

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      // 2) 요청자 역할 확인
      const { data: meProfile, error: meErr } = await supabaseAdmin
        .from('user_profiles')
        .select('role, active')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (meErr) return jsonResponse(500, { ok: false, error: meErr.message });
      if (!meProfile?.active) return jsonResponse(403, { ok: false, error: 'Not allowed' });
      if (!isAllowedRole(meProfile.role)) {
        return jsonResponse(403, { ok: false, error: 'Not allowed' });
      }

      // 3) 대상 사용자 찾기
      const { data: targetProfile, error: targetErr } = await supabaseAdmin
        .from('user_profiles')
        .select('auth_user_id, active')
        .eq('display_user_id', displayUserId)
        .maybeSingle();

      if (targetErr) return jsonResponse(500, { ok: false, error: targetErr.message });
      if (!targetProfile) return jsonResponse(404, { ok: false, error: 'User profile not found' });
      if (!targetProfile.active) {
        return jsonResponse(403, { ok: false, error: 'User is inactive' });
      }

      // 4) password_reset_required 플래그 켜고, 기존 비번은 무효화되도록 임시 비번으로 교체
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

      if (profileUpdateErr) {
        return jsonResponse(500, { ok: false, error: profileUpdateErr.message });
      }

      return jsonResponse(200, { ok: true });
    } catch (e) {
      return jsonResponse(500, { ok: false, error: e?.message || String(e) });
    }
  },
};


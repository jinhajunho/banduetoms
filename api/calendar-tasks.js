/**
 * 대시보드 캘린더 수동 일정 (프로젝트와 별도)
 * Supabase 테이블: calendar_manual_tasks (scripts/sql/calendar_manual_tasks.sql)
 */
export const runtime = 'nodejs';

import { requireActiveUser } from './_lib/activeAuth.js';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

const STATUS_SET = new Set(['견적', '진행', '완료', '보류']);

function normalizeYmd(v) {
    const s = String(v || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

function validateTaskPayload(p) {
    if (!p || typeof p !== 'object') return { ok: false, error: 'payload is required' };
    const status = String(p.status || '').trim();
    if (!STATUS_SET.has(status)) return { ok: false, error: 'status must be 견적, 진행, 완료, 보류' };
    const title = String(p.title || '').trim();
    if (!title) return { ok: false, error: '작업제목은 필수입니다.' };
    const bodyText = String(p.body != null ? p.body : '');
    const assignee = String(p.assignee != null ? p.assignee : '').trim();
    const startDate = normalizeYmd(p.startDate);
    const endDate = normalizeYmd(p.endDate);
    if (!startDate) return { ok: false, error: '진행일은 필수입니다.' };
    if (!endDate) return { ok: false, error: '완료일은 필수입니다.' };
    if (endDate < startDate) return { ok: false, error: '완료일은 진행일 이후여야 합니다.' };
    return {
        ok: true,
        payload: {
            status,
            title,
            body: bodyText,
            assignee,
            startDate,
            endDate,
        },
    };
}

export default {
    async fetch(request) {
        try {
            if (request.method !== 'POST') {
                return jsonResponse(405, { ok: false, error: 'Method Not Allowed' });
            }

            const auth = await requireActiveUser(request);
            if (auth.error) return auth.error;
            const { supabaseAdmin } = auth;

            const body = await request.json().catch(() => ({}));
            const action = body && body.action;

            if (action === 'list') {
                const { data, error } = await supabaseAdmin
                    .from('calendar_manual_tasks')
                    .select('id, payload, updated_at')
                    .order('updated_at', { ascending: false });
                if (error) return jsonResponse(500, { ok: false, error: error.message });
                const items = (data || []).map(function (r) {
                    return {
                        id: r.id,
                        ...(typeof r.payload === 'object' && r.payload ? r.payload : {}),
                    };
                });
                return jsonResponse(200, { ok: true, items });
            }

            if (action === 'upsert') {
                const raw = body && typeof body.task === 'object' ? body.task : null;
                const vid = raw && raw.id != null ? String(raw.id).trim() : '';
                const v = validateTaskPayload(raw);
                if (!v.ok) return jsonResponse(400, { ok: false, error: v.error });
                const id =
                    vid ||
                    'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
                const row = {
                    id,
                    payload: v.payload,
                    updated_at: new Date().toISOString(),
                };
                const { error } = await supabaseAdmin.from('calendar_manual_tasks').upsert(row, {
                    onConflict: 'id',
                });
                if (error) return jsonResponse(500, { ok: false, error: error.message });
                return jsonResponse(200, { ok: true, id });
            }

            if (action === 'delete') {
                const id = String(body && body.id != null ? body.id : '').trim();
                if (!id) return jsonResponse(400, { ok: false, error: 'id is required' });
                const { error } = await supabaseAdmin.from('calendar_manual_tasks').delete().eq('id', id);
                if (error) return jsonResponse(500, { ok: false, error: error.message });
                return jsonResponse(200, { ok: true });
            }

            return jsonResponse(400, { ok: false, error: 'action must be list, upsert, or delete' });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

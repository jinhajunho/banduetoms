export const runtime = 'nodejs';

import { requireActiveUser } from './_lib/activeAuth.js';
import {
    getExpenseReceiptsBucket,
    sanitizeExpenseReceiptFileName,
} from './_lib/expenseReceiptsStorage.js';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

function parseMaxUploadBytes() {
    const raw = process.env.EXPENSE_RECEIPT_UPLOAD_MAX_BYTES;
    if (raw && /^\d+$/.test(String(raw).trim())) {
        const n = parseInt(String(raw).trim(), 10);
        if (n > 0) return n;
    }
    return 15 * 1024 * 1024;
}

const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
]);

export default {
    async fetch(request) {
        try {
            if (request.method !== 'POST') {
                return jsonResponse(405, { ok: false, error: 'Method Not Allowed' });
            }

            const auth = await requireActiveUser(request);
            if (auth.error) return auth.error;
            const { supabaseAdmin } = auth;

            const ct = request.headers.get('content-type') || '';
            if (!ct.toLowerCase().includes('multipart/form-data')) {
                return jsonResponse(400, { ok: false, error: 'multipart/form-data required' });
            }

            const maxBytes = parseMaxUploadBytes();
            const form = await request.formData();
            const contractorIdRaw = form.get('contractorId');
            const slotRaw = form.get('slot');
            const file = form.get('file');

            const contractorId = contractorIdRaw != null ? Number(contractorIdRaw) : NaN;
            if (!Number.isFinite(contractorId) || contractorId < 1) {
                return jsonResponse(400, { ok: false, error: 'contractorId is required' });
            }
            const slot = String(slotRaw || '').trim().toLowerCase();
            if (slot !== 'license' && slot !== 'bank') {
                return jsonResponse(400, { ok: false, error: 'slot must be license or bank' });
            }
            if (!file || typeof file.arrayBuffer !== 'function') {
                return jsonResponse(400, { ok: false, error: 'file is required' });
            }

            const mime = (file.type && String(file.type).trim()) || 'application/octet-stream';
            if (!ALLOWED_MIME.has(mime)) {
                return jsonResponse(400, {
                    ok: false,
                    error: '지원 형식: JPG, PNG, GIF, WEBP, PDF',
                });
            }

            const buf = Buffer.from(await file.arrayBuffer());
            if (buf.length > maxBytes) {
                return jsonResponse(400, {
                    ok: false,
                    error: '파일이 너무 큽니다. 이미지·PDF 용량을 줄여 주세요.',
                });
            }

            const safeName = sanitizeExpenseReceiptFileName(file.name);
            const objectPath =
                'contractors/' +
                contractorId +
                '/' +
                slot +
                '/' +
                Date.now() +
                '_' +
                safeName;
            const bucket = getExpenseReceiptsBucket();

            const { error } = await supabaseAdmin.storage.from(bucket).upload(objectPath, buf, {
                contentType: mime,
                upsert: true,
            });
            if (error) {
                return jsonResponse(500, {
                    ok: false,
                    error: error.message || 'Storage 업로드 실패',
                });
            }

            return jsonResponse(200, {
                ok: true,
                path: objectPath,
                name: file.name ? String(file.name) : safeName,
                mimeType: mime,
            });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

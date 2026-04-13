/**
 * Vercel Hobby: 함수 개수 한도(12) 대응 — Storage 서명·업로드를 단일 엔드포인트로 통합.
 *
 * POST + Content-Type: application/json  → { path } / { paths } 서명 URL, { deletePath } 삭제,
 *   { action: 'contractorSignedUpload', ... } 업체 대용량용 서명 업로드 토큰
 * POST + multipart/form-data:
 *   - expenseId + file          → 경비 영수증
 *   - contractorId + slot + file → 업체 첨부
 *   - estimateCode + rowKey + file → 견적 재무 행 첨부
 */
export const runtime = 'nodejs';

import { requireActiveUser } from './_lib/activeAuth.js';
import {
    getExpenseReceiptsBucket,
    isAllowedStorageObjectPath,
    sanitizeExpenseReceiptFileName,
    sanitizeEstimateCodeForStorage,
    sanitizeEstimateRowKeyForStorage,
} from './_lib/expenseReceiptsStorage.js';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

function parseSignedUrlSeconds() {
    const raw = process.env.EXPENSE_RECEIPT_SIGNED_URL_SECONDS;
    if (raw && /^\d+$/.test(String(raw).trim())) {
        const n = parseInt(String(raw).trim(), 10);
        if (n >= 60 && n <= 86400) return n;
    }
    return 3600;
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

/** 브라우저/OS별로 선언 MIME이 달라질 수 있어 정규화 */
const MIME_CANON = {
    'image/jpg': 'image/jpeg',
    'image/pjpeg': 'image/jpeg',
    'image/x-citrix-jpeg': 'image/jpeg',
    'image/x-png': 'image/png',
};

function normalizeFileMimeType(fileType) {
    const raw = fileType && String(fileType).trim();
    if (!raw) return 'application/octet-stream';
    const lower = raw.toLowerCase();
    return MIME_CANON[lower] || lower;
}

/** 선언된 타입이 없거나 octet-stream일 때 버퍼 앞부분으로 판별 */
function sniffMimeFromBuffer(buf) {
    if (!buf || buf.length < 4) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
    if (buf.length >= 12) {
        const head = buf.toString('ascii', 0, 4);
        const webp = buf.toString('ascii', 8, 12);
        if (head === 'RIFF' && webp === 'WEBP') return 'image/webp';
    }
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf';
    return null;
}

function resolveAllowedMime(file, buf) {
    const declared = normalizeFileMimeType(file.type);
    if (ALLOWED_MIME.has(declared)) return declared;
    const sniffed = sniffMimeFromBuffer(buf);
    if (sniffed && ALLOWED_MIME.has(sniffed)) return sniffed;
    return null;
}

async function handleSignJson(request, supabaseAdmin) {
    const body = await request.json().catch(() => ({}));
    const bucket = getExpenseReceiptsBucket();

    const delPath = body && typeof body.deletePath === 'string' ? body.deletePath.trim() : '';
    if (delPath) {
        if (!isAllowedStorageObjectPath(delPath)) {
            return jsonResponse(400, { ok: false, error: 'invalid path' });
        }
        const { error } = await supabaseAdmin.storage.from(bucket).remove([delPath]);
        if (error) {
            return jsonResponse(500, { ok: false, error: error.message || 'Storage 삭제 실패' });
        }
        return jsonResponse(200, { ok: true });
    }

    const sec = parseSignedUrlSeconds();

    const pathsRaw = body && Array.isArray(body.paths) ? body.paths : null;
    if (pathsRaw && pathsRaw.length > 0) {
        const MAX = 40;
        const normalized = pathsRaw
            .slice(0, MAX)
            .map((p) => (typeof p === 'string' ? p.trim() : ''))
            .filter(Boolean);
        if (normalized.length === 0) {
            return jsonResponse(400, { ok: false, error: 'invalid paths' });
        }
        for (const p of normalized) {
            if (!isAllowedStorageObjectPath(p)) {
                return jsonResponse(400, { ok: false, error: 'invalid path in paths' });
            }
        }
        const results = [];
        for (const path of normalized) {
            const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, sec);
            if (error || !data || !data.signedUrl) {
                return jsonResponse(500, {
                    ok: false,
                    error: error?.message || 'signed URL 생성 실패',
                    path,
                });
            }
            results.push({ path, url: data.signedUrl });
        }
        return jsonResponse(200, { ok: true, results, expiresIn: sec });
    }

    /** 큰 업체 첨부: 서비스 롤로 서명 업로드 토큰만 발급 — 본문은 클라이언트→Supabase 직접 (RLS 불필요) */
    if (body && body.action === 'contractorSignedUpload') {
        const contractorId = body.contractorId != null ? Number(body.contractorId) : NaN;
        const slot = String(body.slot || '')
            .trim()
            .toLowerCase();
        const fileName = body.fileName != null ? String(body.fileName) : '';
        const contentTypeNorm = normalizeFileMimeType(body.contentType);
        const fileSize = body.fileSize != null ? Number(body.fileSize) : NaN;

        if (!Number.isFinite(contractorId) || contractorId < 1) {
            return jsonResponse(400, { ok: false, error: 'contractorId is required' });
        }
        if (slot !== 'license' && slot !== 'bank') {
            return jsonResponse(400, { ok: false, error: 'slot must be license or bank' });
        }
        if (!ALLOWED_MIME.has(contentTypeNorm)) {
            return jsonResponse(400, { ok: false, error: '지원 형식: JPG, PNG, GIF, WEBP, PDF' });
        }
        const maxBytes = parseMaxUploadBytes();
        if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > maxBytes) {
            return jsonResponse(400, { ok: false, error: 'fileSize is invalid or too large' });
        }

        const safeName = sanitizeExpenseReceiptFileName(fileName);
        const objectPath = 'contractors/' + contractorId + '/' + slot + '/' + Date.now() + '_' + safeName;
        if (!isAllowedStorageObjectPath(objectPath)) {
            return jsonResponse(400, { ok: false, error: 'invalid path' });
        }

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUploadUrl(objectPath, { upsert: true });
        if (error || !data) {
            return jsonResponse(500, {
                ok: false,
                error: error?.message || 'signed upload URL 생성 실패',
            });
        }
        const token = data.token != null ? String(data.token) : '';
        if (!token) {
            return jsonResponse(500, { ok: false, error: 'signed upload token missing' });
        }
        return jsonResponse(200, {
            ok: true,
            bucket,
            path: objectPath,
            token,
        });
    }

    const path = body && typeof body.path === 'string' ? body.path.trim() : '';
    if (!path || !isAllowedStorageObjectPath(path)) {
        return jsonResponse(400, { ok: false, error: 'invalid path' });
    }

    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, sec);

    if (error || !data || !data.signedUrl) {
        return jsonResponse(500, {
            ok: false,
            error: error?.message || 'signed URL 생성 실패',
        });
    }

    return jsonResponse(200, { ok: true, url: data.signedUrl, expiresIn: sec });
}

async function handleExpenseReceiptUpload(form, supabaseAdmin) {
    const expenseIdRaw = form.get('expenseId');
    const file = form.get('file');
    const expenseId = expenseIdRaw != null ? Number(expenseIdRaw) : NaN;
    if (!Number.isFinite(expenseId) || expenseId < 1) {
        return jsonResponse(400, { ok: false, error: 'expenseId is required' });
    }
    if (!file || typeof file.arrayBuffer !== 'function') {
        return jsonResponse(400, { ok: false, error: 'file is required' });
    }

    const maxBytes = parseMaxUploadBytes();
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > maxBytes) {
        return jsonResponse(400, { ok: false, error: '파일이 너무 큽니다. 이미지·PDF 용량을 줄여 주세요.' });
    }

    const mime = resolveAllowedMime(file, buf);
    if (!mime) {
        return jsonResponse(400, { ok: false, error: '지원 형식: JPG, PNG, GIF, WEBP, PDF' });
    }

    const safeName = sanitizeExpenseReceiptFileName(file.name);
    const objectPath = 'expenses/' + expenseId + '/' + Date.now() + '_' + safeName;
    const bucket = getExpenseReceiptsBucket();

    const { error } = await supabaseAdmin.storage.from(bucket).upload(objectPath, buf, {
        contentType: mime,
        upsert: false,
    });
    if (error) {
        return jsonResponse(500, {
            ok: false,
            error:
                error.message ||
                'Storage 업로드 실패(버킷·권한·정책을 확인해 주세요: ' + bucket + ')',
        });
    }

    return jsonResponse(200, {
        ok: true,
        path: objectPath,
        name: file.name ? String(file.name) : safeName,
        mimeType: mime,
    });
}

async function handleContractorUpload(form, supabaseAdmin) {
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

    const maxBytes = parseMaxUploadBytes();
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > maxBytes) {
        return jsonResponse(400, { ok: false, error: '파일이 너무 큽니다. 이미지·PDF 용량을 줄여 주세요.' });
    }

    const mime = resolveAllowedMime(file, buf);
    if (!mime) {
        return jsonResponse(400, { ok: false, error: '지원 형식: JPG, PNG, GIF, WEBP, PDF' });
    }

    const safeName = sanitizeExpenseReceiptFileName(file.name);
    const objectPath =
        'contractors/' + contractorId + '/' + slot + '/' + Date.now() + '_' + safeName;
    const bucket = getExpenseReceiptsBucket();

    const { error } = await supabaseAdmin.storage.from(bucket).upload(objectPath, buf, {
        contentType: mime,
        upsert: true,
    });
    if (error) {
        return jsonResponse(500, { ok: false, error: error.message || 'Storage 업로드 실패' });
    }

    return jsonResponse(200, {
        ok: true,
        path: objectPath,
        name: file.name ? String(file.name) : safeName,
        mimeType: mime,
    });
}

async function handleEstimateFinanceUpload(form, supabaseAdmin) {
    const estimateCode = form.get('estimateCode');
    const rowKey = form.get('rowKey');
    const file = form.get('file');

    const codeSafe = sanitizeEstimateCodeForStorage(estimateCode);
    const rowSafe = sanitizeEstimateRowKeyForStorage(rowKey);
    if (!rowSafe) {
        return jsonResponse(400, { ok: false, error: 'rowKey is required' });
    }
    if (!file || typeof file.arrayBuffer !== 'function') {
        return jsonResponse(400, { ok: false, error: 'file is required' });
    }

    const maxBytes = parseMaxUploadBytes();
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > maxBytes) {
        return jsonResponse(400, { ok: false, error: '파일이 너무 큽니다. 이미지·PDF 용량을 줄여 주세요.' });
    }

    const mime = resolveAllowedMime(file, buf);
    if (!mime) {
        return jsonResponse(400, { ok: false, error: '지원 형식: JPG, PNG, GIF, WEBP, PDF' });
    }

    const safeName = sanitizeExpenseReceiptFileName(file.name);
    const objectPath = 'estimates/' + codeSafe + '/' + rowSafe + '/' + Date.now() + '_' + safeName;
    const bucket = getExpenseReceiptsBucket();

    const { error } = await supabaseAdmin.storage.from(bucket).upload(objectPath, buf, {
        contentType: mime,
        upsert: false,
    });
    if (error) {
        return jsonResponse(500, { ok: false, error: error.message || 'Storage 업로드 실패' });
    }

    return jsonResponse(200, {
        ok: true,
        path: objectPath,
        name: file.name ? String(file.name) : safeName,
        mimeType: mime,
    });
}

async function handleMultipart(request, supabaseAdmin) {
    const form = await request.formData();
    // 업체 첨부를 먼저 분기 (페이지에 견적용 필드가 섞여 있어도 오인 방지)
    if (form.has('contractorId') && form.has('slot')) {
        return handleContractorUpload(form, supabaseAdmin);
    }
    if (form.has('estimateCode') && form.has('rowKey')) {
        return handleEstimateFinanceUpload(form, supabaseAdmin);
    }
    if (form.has('expenseId')) {
        return handleExpenseReceiptUpload(form, supabaseAdmin);
    }
    return jsonResponse(400, {
        ok: false,
        error: 'multipart: expenseId, 또는 contractorId+slot, 또는 estimateCode+rowKey 가 필요합니다.',
    });
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

            const ct = (request.headers.get('content-type') || '').toLowerCase();
            if (ct.includes('application/json')) {
                return await handleSignJson(request, supabaseAdmin);
            }
            if (ct.includes('multipart/form-data')) {
                return await handleMultipart(request, supabaseAdmin);
            }
            return jsonResponse(400, {
                ok: false,
                error: 'Content-Type: application/json(서명) 또는 multipart/form-data(업로드)',
            });
        } catch (e) {
            return jsonResponse(500, { ok: false, error: e?.message || String(e) });
        }
    },
};

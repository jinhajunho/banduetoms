import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = fs.readFileSync(path.join(root, '.env.local'), 'utf-8');

function valueForKey(envKey) {
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (k !== envKey) continue;
    let v = t.slice(i + 1).trim();
    const q = v[0];
    if ((q === '"' && v.endsWith('"')) || (q === "'" && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  }
  return '';
}

function decodeJwtPayload(jwt, label) {
  const part = jwt.split('.')[1];
  if (!part) return { ok: false, error: `${label}: JWT 형식이 아닙니다.` };
  try {
    const b = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b.length % 4)) % 4);
    const json = JSON.parse(Buffer.from(b + pad, 'base64').toString('utf-8'));
    return { ok: true, json };
  } catch (e) {
    return {
      ok: false,
      error: `${label}: JWT payload 디코딩 실패(키가 잘리거나 잘못 붙여넣은 경우가 많습니다). Supabase 대시보드에서 anon public 키를 다시 복사하세요.`,
    };
  }
}

const url = valueForKey('VITE_SUPABASE_URL');
const expect = url.replace(/^https?:\/\//, '').replace(/\.supabase\.co\/?$/, '');

const anonJwt = valueForKey('VITE_SUPABASE_ANON_KEY');
const serviceJwt = valueForKey('SUPABASE_SERVICE_ROLE_KEY');

const a = decodeJwtPayload(anonJwt, 'VITE_SUPABASE_ANON_KEY');
const s = decodeJwtPayload(serviceJwt, 'SUPABASE_SERVICE_ROLE_KEY');

console.log('VITE_SUPABASE_URL 프로젝트 ref(기대):', expect || '(없음)');

if (!a.ok) {
  console.error(a.error);
  process.exit(1);
}
if (!s.ok) {
  console.error(s.error);
  process.exit(1);
}

console.log('anon JWT ref   :', a.json.ref);
console.log('service JWT ref:', s.json.ref);

if (a.json.ref !== s.json.ref) {
  console.error('anon 키와 service role 키의 프로젝트(ref)가 다릅니다. 둘 다 같은 Supabase 프로젝트에서 복사했는지 확인하세요.');
  process.exit(1);
}

if (expect && a.json.ref !== expect) {
  console.error(`anon JWT ref가 URL과 불일치합니다. 기대: ${expect}, 실제: ${a.json.ref}`);
  process.exit(1);
}

console.log('OK: anon / service / URL 프로젝트가 일치합니다.');
process.exit(0);

/**
 * index.html 최소 진입: 세션이 없으면 무거운 번들(index-bootstrap, supabase-js) 로드 전에 login.html로 보냅니다.
 * refresh_token이 있으면 access 만료 여부와 관계없이 앱을 로드해 클라이언트가 갱신합니다.
 */
function defaultStorageKeyFromUrl(url) {
    try {
        const hostname = new URL(url).hostname;
        const projectRef = hostname.split('.')[0];
        return 'sb-' + projectRef + '-auth-token';
    } catch {
        return null;
    }
}

function readStoredSessionJson(url) {
    const primary = defaultStorageKeyFromUrl(url);
    if (primary) {
        const raw = localStorage.getItem(primary);
        if (raw) return raw;
    }
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.indexOf('sb-') !== 0 || !k.endsWith('-auth-token')) continue;
        const raw = localStorage.getItem(k);
        if (raw) return raw;
    }
    return null;
}

function looksLikeRecoverableSession(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        if (!data || typeof data !== 'object') return false;
        const rt = data.refresh_token;
        if (rt && String(rt).length > 8) return true;
        if (!data.access_token) return false;
        const expSec = data.expires_at;
        if (typeof expSec === 'number') {
            return expSec * 1000 > Date.now() - 120000;
        }
        return true;
    } catch {
        return false;
    }
}

function isIndexLikePath() {
    const p = (window.location.pathname || '').toLowerCase();
    return p === '/' || p.endsWith('/index.html') || p === '' || p.endsWith('/');
}

async function main() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anon) {
        await import('./index-bootstrap.js');
        return;
    }

    if (!isIndexLikePath()) {
        await import('./index-bootstrap.js');
        return;
    }

    const raw = readStoredSessionJson(url);
    if (!raw || !looksLikeRecoverableSession(raw)) {
        localStorage.removeItem('bps_auth_userId');
        try {
            delete window.__bpsProfileBootstrap;
        } catch (e) {
            /* ignore */
        }
        const next = (window.location.hash || '').slice(1) || 'dashboard';
        window.location.replace('login.html?next=' + encodeURIComponent(next));
        return;
    }

    await import('./index-bootstrap.js');
}

await main();

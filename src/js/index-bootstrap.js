/**
 * index.html 진입점: VITE_SUPABASE_* 필수. 세션·프로필이 있으면 app.js 로드, 없으면 login.html로 보냅니다.
 * app.js는 로드 시점에 #page-estimate 내부 필터 DOM에 바인딩하므로, public/partials/page-estimate.html 주입을 먼저 수행합니다.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isIndexLikePath() {
    const p = (window.location.pathname || '').toLowerCase();
    return p === '/' || p.endsWith('/index.html') || p === '' || p.endsWith('/');
}

function mapDbRoleToUi(role) {
    const s = String(role || '').trim();
    if (/[\uAC00-\uD7A3]/.test(s)) return s;
    const map = {
        super: '슈퍼관리자',
        manager: '관리자',
        accounting: '회계팀',
        staff: '직원',
        contractor: '도급사',
    };
    return map[s] || s || '직원';
}

async function loadAppWithEstimatePartial() {
    const { ensureEstimatePartialMounted } = await import('./estimate-partial-loader.js');
    await ensureEstimatePartialMounted();
    await import('./app.js');
}

async function main() {
    if (!supabaseUrl || !supabaseAnon) {
        window.location.replace('login.html?needConfig=1');
        return;
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            storage: localStorage,
        },
    });
    window.__bpsSupabase = supabase;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData && sessionData.session;

    if (!session) {
        localStorage.removeItem('bps_auth_userId');
        try {
            delete window.__bpsProfileBootstrap;
        } catch (e) {
            /* ignore */
        }
        if (isIndexLikePath()) {
            const next = (window.location.hash || '').slice(1) || 'dashboard';
            window.location.replace('login.html?next=' + encodeURIComponent(next));
            return;
        }
        await loadAppWithEstimatePartial();
        window.dispatchEvent(new Event('DOMContentLoaded'));
        return;
    }

    const email = String(session.user.email || '');
    const displayId = email.includes('@') ? email.split('@')[0].trim() : '';
    if (displayId) {
        localStorage.setItem('bps_auth_userId', displayId);
    }

    const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

    if (profileErr || !profile || profile.active === false) {
        await supabase.auth.signOut();
        localStorage.removeItem('bps_auth_userId');
        try {
            delete window.__bpsProfileBootstrap;
        } catch (e) {
            /* ignore */
        }
        if (isIndexLikePath()) {
            const next = (window.location.hash || '').slice(1) || 'dashboard';
            window.location.replace('login.html?next=' + encodeURIComponent(next));
            return;
        }
        await loadAppWithEstimatePartial();
        window.dispatchEvent(new Event('DOMContentLoaded'));
        return;
    }

    const uid = String(profile.display_user_id || displayId || '').trim();
    window.__bpsProfileBootstrap = {
        userId: uid,
        name: String(profile.name || uid).trim(),
        type: profile.type === 'external' ? 'external' : 'internal',
        role: mapDbRoleToUi(profile.role),
        contractorName: String(profile.contractor_name || '').trim(),
        extraAllowedPages: Array.isArray(profile.extra_allowed_pages)
            ? profile.extra_allowed_pages
            : [],
    };

    await loadAppWithEstimatePartial();
    window.dispatchEvent(new Event('DOMContentLoaded'));
}

await main();

/**
 * index.html 진입점: VITE_SUPABASE_* 필수. 세션·프로필이 있으면 app.js 로드, 없으면 login.html로 보냅니다.
 * app.js 로드 전: 페이지 shell partials + 프로젝트 상세 중앙 모달(body). 경비/판관비 CSV·각 등록 패널은 index 유지. 경영실적 UI는 page-performance.html에 통합.
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

/** app.js getBaseAllowedPages / mergeAllowedPages 와 동기(부팅 시 메뉴 플래시 방지) */
const BPS_PAGE_ACCESS_ORDER = ['dashboard', 'estimate', 'performance', 'weekly', 'unpaid', 'contractors', 'expenses', 'sga', 'users'];

function bpsNormalizeAccountType(type) {
    return type === 'external' ? 'external' : 'internal';
}

function bpsGetBaseAllowedPages(type, role) {
    const normalizedType = bpsNormalizeAccountType(type);
    const roleName = String(role || '');
    if (normalizedType === 'external') return ['dashboard', 'estimate'];
    if (roleName === '슈퍼관리자') {
        return ['dashboard', 'estimate', 'performance', 'weekly', 'unpaid', 'contractors', 'expenses', 'sga', 'users'];
    }
    if (roleName === '관리자') {
        return ['dashboard', 'estimate', 'performance', 'weekly', 'unpaid', 'contractors', 'expenses', 'sga'];
    }
    if (roleName === '회계팀') {
        return ['dashboard', 'estimate', 'performance', 'unpaid', 'expenses', 'sga'];
    }
    if (roleName === '직원') return ['dashboard', 'estimate', 'weekly'];
    return ['dashboard', 'estimate'];
}

function bpsMergeAllowedPages(basePages, extraPages) {
    const set = new Set([
        ...(basePages || []),
        ...((extraPages || []).filter(function (p) {
            return BPS_PAGE_ACCESS_ORDER.includes(p);
        })),
    ]);
    return BPS_PAGE_ACCESS_ORDER.filter(function (p) {
        return set.has(p);
    });
}

/** 프로필 수신 직후(app.js 전): 네비 표시를 권한에 맞춤 후 메뉴 영역 표시 */
function bpsApplyShellNavFromProfileBootstrap(bp) {
    if (!bp) return;
    const base = bpsGetBaseAllowedPages(bp.type, bp.role);
    const allowed = bpsMergeAllowedPages(base, bp.extraAllowedPages || []);
    document.querySelectorAll('.nav-item[data-page]').forEach(function (el) {
        const p = el.getAttribute('data-page') || '';
        el.style.display = allowed.includes(p) ? '' : 'none';
    });
    document.documentElement.classList.add('bps-shell-nav-ready');
}

async function loadAppWithShellPartials() {
    const [
        estimateMod,
        performanceMod,
        weeklyMod,
        unpaidMod,
        contractorMod,
        expenseMod,
        sgaMod,
        usersMod,
        projectMod,
        dashboardMod,
    ] = await Promise.all([
        import('./estimate-partial-loader.js'),
        import('./performance-partial-loader.js'),
        import('./weekly-partial-loader.js'),
        import('./unpaid-partial-loader.js'),
        import('./contractor-partial-loader.js'),
        import('./expense-partial-loader.js'),
        import('./sga-partial-loader.js'),
        import('./users-partial-loader.js'),
        import('./project-detail-modal-loader.js'),
        import('./dashboard-partial-loader.js'),
    ]);
    const appPromise = import('./app.js');
    await Promise.all([
        estimateMod.ensureEstimatePartialMounted(),
        performanceMod.ensurePerformancePartialMounted(),
        weeklyMod.ensureWeeklyPartialMounted(),
        unpaidMod.ensureUnpaidPartialMounted(),
        contractorMod.ensureContractorPagePartialMounted(),
        expenseMod.ensureExpensePagePartialMounted(),
        sgaMod.ensureSgaPagePartialMounted(),
        usersMod.ensureUsersPagePartialMounted(),
        projectMod.ensureProjectDetailModalMounted(),
        dashboardMod.ensureDashboardPartialMounted(),
        appPromise,
    ]);
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
            storage: sessionStorage,
        },
    });
    window.__bpsSupabase = supabase;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData && sessionData.session;

    if (!session) {
        sessionStorage.removeItem('bps_auth_userId');
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
        document.documentElement.classList.add('bps-shell-nav-ready');
        await loadAppWithShellPartials();
        window.dispatchEvent(new Event('DOMContentLoaded'));
        return;
    }

    const email = String(session.user.email || '');
    const displayId = email.includes('@') ? email.split('@')[0].trim() : '';
    if (displayId) {
        sessionStorage.setItem('bps_auth_userId', displayId);
    }

    const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

    if (profileErr || !profile || profile.active === false) {
        await supabase.auth.signOut();
        sessionStorage.removeItem('bps_auth_userId');
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
        document.documentElement.classList.add('bps-shell-nav-ready');
        await loadAppWithShellPartials();
        window.dispatchEvent(new Event('DOMContentLoaded'));
        return;
    }

    const uid = String(profile.display_user_id || profile.displayUserId || displayId || '').trim();
    const typeNorm = profile.type === 'external' ? 'external' : 'internal';
    /* 외부 계정은 이 제품에서 도급사 전용. role 누락·staff 등이 섞여도 표시·권한 기준은 도급사로 통일 */
    const roleUi = typeNorm === 'external' ? '도급사' : mapDbRoleToUi(profile.role);
    window.__bpsProfileBootstrap = {
        userId: uid,
        name: String(profile.name || uid).trim(),
        type: typeNorm,
        role: roleUi,
        contractorName: String(profile.contractor_name || profile.contractorName || '').trim(),
        extraAllowedPages: Array.isArray(profile.extra_allowed_pages)
            ? profile.extra_allowed_pages
            : Array.isArray(profile.extraAllowedPages)
              ? profile.extraAllowedPages
              : [],
    };

    bpsApplyShellNavFromProfileBootstrap(window.__bpsProfileBootstrap);

    await loadAppWithShellPartials();
    window.dispatchEvent(new Event('DOMContentLoaded'));
}

await main();

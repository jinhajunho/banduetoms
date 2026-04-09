import { createClient } from '@supabase/supabase-js';
import { ensureLoginPanelMounted } from './login-panel-loader.js';

const VIRTUAL_DOMAIN = 'bps-virtual.local';
const AUTH_USER_KEY = 'bps_auth_userId';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

function virtualEmail(userId) {
    return String(userId || '')
        .trim()
        .toLowerCase()
        .concat('@', VIRTUAL_DOMAIN);
}

async function fetchProfileStatus(displayUserId) {
    const uid = String(displayUserId || '').trim();
    if (!uid) return { ok: false, error: 'empty' };
    const u =
        window.location.origin +
        '/api/auth/profile-status?displayUserId=' +
        encodeURIComponent(uid);
    const r = await fetch(u);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: j.error || r.statusText };
    return j;
}

async function postSetPassword(displayUserId, password) {
    const r = await fetch(window.location.origin + '/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayUserId, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
        throw new Error(j.error || '비밀번호 설정에 실패했습니다.');
    }
}

function supabaseAuthErrorToMessage(err) {
    if (!err) return '로그인에 실패했습니다.';
    const msg = String(err.message || '');
    if (/invalid login credentials/i.test(msg) || msg.includes('Invalid login')) {
        return '아이디 또는 비밀번호가 올바르지 않습니다.';
    }
    return msg || '로그인에 실패했습니다.';
}

async function run() {
    try {
        await ensureLoginPanelMounted();
    } catch (e) {
        console.error(e);
    }

    const loginForm = document.getElementById('loginForm');
    const loginUserInput = document.getElementById('loginUserId');
    const loginPassword = document.getElementById('loginPassword');
    const loginConfirmWrap = document.getElementById('loginConfirmWrap');
    const loginPasswordConfirm = document.getElementById('loginPasswordConfirm');
    const loginErrorEl = document.getElementById('loginError');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');

    if (!loginForm || !loginUserInput || !loginPassword) return;

    const params = new URLSearchParams(window.location.search);
    const nextPage = params.get('next') || 'dashboard';

    try {
        const pf = document.createElement('link');
        pf.rel = 'prefetch';
        pf.as = 'document';
        pf.href = new URL('index.html', window.location.href).href;
        document.head.appendChild(pf);
    } catch (_pref) {
        /* ignore */
    }

    function setLoginError(message) {
        if (!loginErrorEl) return;
        if (message) {
            loginErrorEl.textContent = message;
            loginErrorEl.style.display = 'block';
        } else {
            loginErrorEl.textContent = '';
            loginErrorEl.style.display = 'none';
        }
    }

    function disableForm(msg) {
        setLoginError(msg);
        if (loginSubmitBtn) loginSubmitBtn.disabled = true;
        loginUserInput.disabled = true;
        loginPassword.disabled = true;
        if (loginPasswordConfirm) loginPasswordConfirm.disabled = true;
    }

    if (!supabaseUrl || !supabaseAnon) {
        disableForm(
            'VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다. .env를 구성한 뒤 개발 서버를 다시 실행해 주세요.'
        );
        return;
    }

    if (params.get('needConfig') === '1') {
        setLoginError(
            'Supabase 환경 변수가 없어 메인 화면을 열 수 없습니다. Vite/Vercel 등 배포 설정에 VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY를 넣은 뒤 다시 접속해 주세요.'
        );
    }

    let remoteRequiresSet = false;
    let remoteActive = true;

    async function syncModeUI() {
        try {
            const uid = String(loginUserInput.value || '').trim();
            if (!uid) {
                if (loginConfirmWrap) loginConfirmWrap.style.display = 'none';
                if (loginSubmitBtn) loginSubmitBtn.textContent = '로그인';
                setLoginError('');
                return;
            }

            const st = await fetchProfileStatus(uid);
            if (st && st.ok) {
                remoteActive = !!st.active;
                remoteRequiresSet = !!st.password_reset_required;
                if (!remoteActive) {
                    if (loginConfirmWrap) loginConfirmWrap.style.display = 'none';
                    if (loginSubmitBtn) loginSubmitBtn.textContent = '로그인';
                    setLoginError('비활성 계정입니다. 관리자에게 문의하세요.');
                    return;
                }
                if (loginConfirmWrap) {
                    loginConfirmWrap.style.display = remoteRequiresSet ? 'flex' : 'none';
                }
                if (loginSubmitBtn) {
                    loginSubmitBtn.textContent = remoteRequiresSet ? '비밀번호 설정 후 로그인' : '로그인';
                }
                setLoginError('');
                return;
            }
            remoteActive = true;
            remoteRequiresSet = false;
            if (loginConfirmWrap) loginConfirmWrap.style.display = 'none';
            if (loginSubmitBtn) loginSubmitBtn.textContent = '로그인';
            if (st && st.status === 404) {
                setLoginError('계정을 찾을 수 없습니다.');
                return;
            }
            if (st && !st.ok) {
                setLoginError('프로필을 확인할 수 없습니다. 잠시 후 다시 시도하세요.');
                return;
            }
            setLoginError('');
        } catch (e) {
            setLoginError('네트워크 오류가 발생했습니다.');
        }
    }

    const storedAuthUserId = String(sessionStorage.getItem(AUTH_USER_KEY) || '').trim();
    if (storedAuthUserId) loginUserInput.value = storedAuthUserId;

    const supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            storage: sessionStorage,
        },
    });
    window.__bpsSupabase = supabase;

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData && sessionData.session) {
        window.location.href = 'index.html#' + nextPage;
        return;
    }

    loginUserInput.addEventListener('input', function () {
        syncModeUI();
    });
    // 프로필 API 대기로 폼 표시가 늦어지지 않도록 비동기 실행(제출 시에는 submit 안에서 다시 확인)
    syncModeUI();

    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const uid = String(loginUserInput.value || '').trim();
        const pw = String(loginPassword.value || '').trim();

        if (!uid) return setLoginError('아이디를 입력하세요.');
        if (!pw) return setLoginError('비밀번호를 입력하세요.');

        var prevBtnText = loginSubmitBtn ? loginSubmitBtn.textContent : '';
        if (loginSubmitBtn) {
            loginSubmitBtn.disabled = true;
            loginSubmitBtn.textContent = '로그인 중…';
        }

        try {
            await syncModeUI();
            if (!remoteActive) {
                if (loginSubmitBtn) {
                    loginSubmitBtn.disabled = false;
                    loginSubmitBtn.textContent = prevBtnText;
                }
                return setLoginError('비활성 계정입니다. 관리자에게 문의하세요.');
            }
            if (remoteRequiresSet) {
                const pw2 = String(
                    loginPasswordConfirm && loginPasswordConfirm.value ? loginPasswordConfirm.value : ''
                ).trim();
                if (pw.length < 6) {
                    if (loginSubmitBtn) {
                        loginSubmitBtn.disabled = false;
                        loginSubmitBtn.textContent = prevBtnText;
                    }
                    return setLoginError('비밀번호는 6자 이상으로 입력하세요.');
                }
                if (pw !== pw2) {
                    if (loginSubmitBtn) {
                        loginSubmitBtn.disabled = false;
                        loginSubmitBtn.textContent = prevBtnText;
                    }
                    return setLoginError('비밀번호 확인이 일치하지 않습니다.');
                }
                await postSetPassword(uid, pw);
            }
            const { error } = await supabase.auth.signInWithPassword({
                email: virtualEmail(uid),
                password: pw,
            });
            if (error) {
                if (loginSubmitBtn) {
                    loginSubmitBtn.disabled = false;
                    loginSubmitBtn.textContent = prevBtnText;
                }
                return setLoginError(supabaseAuthErrorToMessage(error));
            }
            sessionStorage.setItem(AUTH_USER_KEY, uid);
            setLoginError('');
            window.location.href = 'index.html#' + nextPage;
        } catch (err) {
            if (loginSubmitBtn) {
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.textContent = prevBtnText;
            }
            setLoginError(err && err.message ? String(err.message) : '처리에 실패했습니다.');
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
} else {
    run();
}

import { createClient } from '@supabase/supabase-js';

const VIRTUAL_DOMAIN = 'bps-virtual.local';
const AUTH_USER_KEY = 'bps_auth_userId';
const PASSWORDS_KEY = 'bps_user_passwords';
const RESET_REQUIRED_KEY = 'bps_password_reset_required';
const USER_ACCOUNTS_KEY = 'bps_user_accounts';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useRemoteAuth = !!(supabaseUrl && supabaseAnon);

function safeParseJson(val, fallback) {
    try {
        if (val === null || val === undefined) return fallback;
        const parsed = JSON.parse(val);
        return parsed != null ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
}

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

const defUserAccounts = [
    {
        name: '방준호',
        userId: 'junho',
        type: 'internal',
        role: '슈퍼관리자',
        contractorName: '',
        active: true,
        extraAllowedPages: [],
    },
];

function loadUserAccounts() {
    const stored = safeParseJson(localStorage.getItem(USER_ACCOUNTS_KEY), null);
    return Array.isArray(stored) && stored.length ? stored : defUserAccounts;
}

function run() {
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

    const userAccounts = loadUserAccounts();
    const userPasswords = safeParseJson(localStorage.getItem(PASSWORDS_KEY), {});
    const resetRequired = safeParseJson(localStorage.getItem(RESET_REQUIRED_KEY), {});

    let supabase = null;

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

    /** 원격 프로필 기준 또는 로컬 레거시 기준 */
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

        if (useRemoteAuth) {
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
            return;
        }

        const targetUser = userAccounts.find(function (u) {
            return u && u.userId === uid && u.active !== false;
        });
        if (!targetUser) {
            if (loginConfirmWrap) loginConfirmWrap.style.display = 'none';
            if (loginSubmitBtn) loginSubmitBtn.textContent = '로그인';
            setLoginError('');
            return;
        }

        const requiresSetLegacy = !!resetRequired[uid] || !userPasswords[uid];
        if (loginConfirmWrap) {
            loginConfirmWrap.style.display = requiresSetLegacy ? 'flex' : 'none';
        }
        if (loginSubmitBtn) {
            loginSubmitBtn.textContent = requiresSetLegacy ? '비밀번호 설정 후 로그인' : '로그인';
        }
        setLoginError('');
        } catch (e) {
            if (useRemoteAuth) {
                setLoginError('네트워크 오류가 발생했습니다.');
            }
        }
    }

    const storedAuthUserId = String(localStorage.getItem(AUTH_USER_KEY) || '').trim();
    if (storedAuthUserId) loginUserInput.value = storedAuthUserId;

    const boot = async () => {
        if (useRemoteAuth) {
            supabase = createClient(supabaseUrl, supabaseAnon, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    storage: localStorage,
                },
            });
            window.__bpsSupabase = supabase;
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData && sessionData.session) {
                window.location.href = 'index.html#' + nextPage;
                return;
            }
        } else if (
            storedAuthUserId &&
            userAccounts.some(function (u) {
                return u && u.userId === storedAuthUserId && u.active !== false;
            }) &&
            !resetRequired[storedAuthUserId] &&
            userPasswords[storedAuthUserId]
        ) {
            window.location.href = 'index.html#' + nextPage;
            return;
        }

        loginUserInput.addEventListener('input', function () {
            syncModeUI();
        });
        await syncModeUI();

        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const uid = String(loginUserInput.value || '').trim();
            const pw = String(loginPassword.value || '').trim();

            if (!uid) return setLoginError('아이디를 입력하세요.');
            if (!pw) return setLoginError('비밀번호를 입력하세요.');

            if (useRemoteAuth) {
                try {
                    await syncModeUI();
                    if (!remoteActive) {
                        return setLoginError('비활성 계정입니다. 관리자에게 문의하세요.');
                    }
                    if (remoteRequiresSet) {
                        const pw2 = String(
                            loginPasswordConfirm && loginPasswordConfirm.value
                                ? loginPasswordConfirm.value
                                : ''
                        ).trim();
                        if (pw.length < 6) return setLoginError('비밀번호는 6자 이상으로 입력하세요.');
                        if (pw !== pw2) return setLoginError('비밀번호 확인이 일치하지 않습니다.');
                        await postSetPassword(uid, pw);
                    }
                    const { error } = await supabase.auth.signInWithPassword({
                        email: virtualEmail(uid),
                        password: pw,
                    });
                    if (error) return setLoginError(supabaseAuthErrorToMessage(error));
                    localStorage.setItem(AUTH_USER_KEY, uid);
                    setLoginError('');
                    window.location.href = 'index.html#' + nextPage;
                } catch (err) {
                    setLoginError(err && err.message ? String(err.message) : '처리에 실패했습니다.');
                }
                return;
            }

            const targetUser = userAccounts.find(function (u) {
                return u && u.userId === uid && u.active !== false;
            });
            if (!targetUser) return setLoginError('계정을 찾을 수 없습니다.');

            const requiresSet = !!resetRequired[uid] || !userPasswords[uid];

            if (requiresSet) {
                const pw2 = String(
                    loginPasswordConfirm && loginPasswordConfirm.value ? loginPasswordConfirm.value : ''
                ).trim();
                if (pw.length < 6) return setLoginError('비밀번호는 6자 이상으로 입력하세요.');
                if (pw !== pw2) return setLoginError('비밀번호 확인이 일치하지 않습니다.');
                userPasswords[uid] = pw;
                delete resetRequired[uid];

                try {
                    localStorage.setItem(PASSWORDS_KEY, JSON.stringify(userPasswords));
                    localStorage.setItem(RESET_REQUIRED_KEY, JSON.stringify(resetRequired));
                } catch (err) {
                    /* ignore */
                }
            } else {
                if (String(userPasswords[uid] || '') !== pw)
                    return setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
            }

            localStorage.setItem(AUTH_USER_KEY, uid);
            setLoginError('');
            window.location.href = 'index.html#' + nextPage;
        });
    };

    boot();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
} else {
    run();
}

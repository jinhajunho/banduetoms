// 로그인 페이지 전용 로직 (index.html 인증 오버레이 분리)
(function () {
    'use strict';

    const AUTH_USER_KEY = 'bps_auth_userId';
    const PASSWORDS_KEY = 'bps_user_passwords';
    const RESET_REQUIRED_KEY = 'bps_password_reset_required';
    const USER_ACCOUNTS_KEY = 'bps_user_accounts';

    function safeParseJson(val, fallback) {
        try {
            if (val === null || val === undefined) return fallback;
            const parsed = JSON.parse(val);
            return parsed != null ? parsed : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function escapeHtmlAttr(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    const defUserAccounts = [
        {
            name: '방준호',
            userId: 'junho',
            type: 'internal',
            role: '슈퍼관리자',
            contractorName: '',
            active: true,
            extraAllowedPages: []
        }
    ];

    const userAccounts = (function loadUserAccounts() {
        const stored = safeParseJson(localStorage.getItem(USER_ACCOUNTS_KEY), null);
        return Array.isArray(stored) && stored.length ? stored : defUserAccounts;
    })();

    const userPasswords = safeParseJson(localStorage.getItem(PASSWORDS_KEY), {});
    const resetRequired = safeParseJson(localStorage.getItem(RESET_REQUIRED_KEY), {});

    const loginForm = document.getElementById('loginForm');
    const loginUserSelect = document.getElementById('loginUserId');
    const loginPassword = document.getElementById('loginPassword');
    const loginConfirmWrap = document.getElementById('loginConfirmWrap');
    const loginPasswordConfirm = document.getElementById('loginPasswordConfirm');
    const loginErrorEl = document.getElementById('loginError');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');

    if (!loginForm || !loginUserSelect || !loginPassword) return;

    const params = new URLSearchParams(window.location.search);
    const nextPage = params.get('next') || 'dashboard';

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

    function syncModeUI() {
        const uid = String(loginUserSelect.value || '').trim();
        if (!uid) return;

        const targetUser = userAccounts.find(function (u) {
            return u && u.userId === uid && u.active !== false;
        });
        if (!targetUser) {
            if (loginConfirmWrap) loginConfirmWrap.style.display = 'none';
            if (loginSubmitBtn) loginSubmitBtn.textContent = '로그인';
            setLoginError('');
            return;
        }

        const requiresSet = !!resetRequired[uid] || !userPasswords[uid];
        if (loginConfirmWrap) loginConfirmWrap.style.display = requiresSet ? 'flex' : 'none';
        if (loginSubmitBtn) loginSubmitBtn.textContent = requiresSet ? '비밀번호 설정 후 로그인' : '로그인';
        setLoginError('');
    }

    const storedAuthUserId = String(localStorage.getItem(AUTH_USER_KEY) || '').trim();
    if (storedAuthUserId) loginUserSelect.value = storedAuthUserId;

    // 이미 로그인된 상태면(비밀번호 세팅 필요 없으면) 바로 이동
    if (
        storedAuthUserId &&
        userAccounts.some(function (u) { return u && u.userId === storedAuthUserId && u.active !== false; }) &&
        !resetRequired[storedAuthUserId] &&
        userPasswords[storedAuthUserId]
    ) {
        window.location.href = 'index.html#' + nextPage;
        return;
    }

    loginUserSelect.addEventListener('input', syncModeUI);
    syncModeUI();

    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const uid = String(loginUserSelect.value || '').trim();
        const pw = String(loginPassword.value || '').trim();

        if (!uid) return setLoginError('아이디를 입력하세요.');
        if (!pw) return setLoginError('비밀번호를 입력하세요.');

        const targetUser = userAccounts.find(function (u) {
            return u && u.userId === uid && u.active !== false;
        });
        if (!targetUser) return setLoginError('계정을 찾을 수 없습니다.');

        const requiresSet = !!resetRequired[uid] || !userPasswords[uid];

        if (requiresSet) {
            const pw2 = String(loginPasswordConfirm && loginPasswordConfirm.value ? loginPasswordConfirm.value : '').trim();
            if (pw.length < 6) return setLoginError('비밀번호는 6자 이상으로 입력하세요.');
            if (pw !== pw2) return setLoginError('비밀번호 확인이 일치하지 않습니다.');
            userPasswords[uid] = pw;
            delete resetRequired[uid];

            try {
                localStorage.setItem(PASSWORDS_KEY, JSON.stringify(userPasswords));
                localStorage.setItem(RESET_REQUIRED_KEY, JSON.stringify(resetRequired));
            } catch (err) {
                // 저장 실패 시에도 로그인 시도는 유지
            }
        } else {
            if (String(userPasswords[uid] || '') !== pw) return setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
        }

        localStorage.setItem(AUTH_USER_KEY, uid);
        setLoginError('');
        window.location.href = 'index.html#' + nextPage;
    });
})();


        /** Chart.js 전역 테마: 다크모드와 동기화 (Modern & Deep Dark 팔레트) */
        (function initChartThemeSync() {
            function applyGlobalChartTheme() {
                if (typeof Chart === 'undefined') return;
                var dark = document.body.classList.contains('dark-mode');
                var text = dark ? '#e0e0e0' : '#111827';
                var muted = dark ? '#a0a0a0' : '#6b7280';
                var grid = dark ? '#333333' : 'rgba(0, 0, 0, 0.08)';
                Chart.defaults.color = text;
                Chart.defaults.borderColor = grid;
                if (Chart.defaults.plugins && Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels) {
                    Chart.defaults.plugins.legend.labels.color = text;
                }
                var tt = Chart.defaults.plugins.tooltip;
                if (tt) {
                    tt.backgroundColor = dark ? '#1e1e1e' : '#ffffff';
                    tt.titleColor = text;
                    tt.bodyColor = text;
                    if (tt.borderColor !== undefined) tt.borderColor = dark ? '#333333' : '#e5e7eb';
                }
                ['linear', 'category', 'time', 'logarithmic'].forEach(function (key) {
                    if (Chart.defaults.scales && Chart.defaults.scales[key]) {
                        var sc = Chart.defaults.scales[key];
                        if (sc.grid) sc.grid.color = grid;
                        if (sc.ticks) sc.ticks.color = muted;
                    }
                });
            }
            document.addEventListener('DOMContentLoaded', function () {
                applyGlobalChartTheme();
                if (typeof MutationObserver !== 'undefined') {
                    new MutationObserver(applyGlobalChartTheme).observe(document.body, {
                        attributes: true,
                        attributeFilter: ['class']
                    });
                }
            });
        })();

        // 페이지 전환 함수
        function showPage(pageName) {
            const allowed = getAllowedPagesForCurrentUser();
            if (Array.isArray(allowed) && allowed.length && !allowed.includes(pageName)) {
                pageName = allowed[0];
            }
            // 모든 페이지 숨기기
            document.querySelectorAll('.page-section').forEach(section => {
                section.classList.remove('active');
                section.style.display = 'none';
            });

            // 선택한 페이지만 표시
            const targetPage = document.getElementById(`page-${pageName}`);
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.classList.remove('main-content--estimate-layout');
            }
            if (targetPage) {
                targetPage.classList.add('active');
                targetPage.style.display = 'block';
            }

            if (pageName === 'dashboard') renderDashboard();
            if (pageName === 'performance') renderPerformanceData();
            if (pageName === 'weekly') renderWeeklyReport();
            if (pageName === 'expenses') {
                fillExpenseMonthFilter();
                renderExpenseTable();
                if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                    syncExpensesFromServer();
                }
            }
            if (pageName === 'sga') {
                fillSgaMonthFilter();
                renderSgaTable();
                if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                    syncSgaFromServer();
                }
            }
            if (pageName === 'contractors') {
                renderContractorTable();
                if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                    syncContractorsFromServer();
                }
            }
            if (pageName === 'users') {
                renderUsersTable();
                renderCategoryMasterTables();
                switchAdminSettingsTab('account');
                if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                    syncUserAccountsFromServer().then(function () {
                        renderUsersTable();
                    });
                }
            }
            if (pageName === 'unpaid') renderUnpaidData();

            // 메뉴 active 상태 변경
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            const activeMenuItem = document.querySelector(`.nav-item[data-page="${pageName}"]`);
            if (activeMenuItem) {
                activeMenuItem.classList.add('active');
            }

            // URL 해시 업데이트
            window.location.hash = pageName;
        }

        // 페이지 로드 시 URL 해시 확인
        window.addEventListener('DOMContentLoaded', function() {
            // ========================================
            // 로컬 로그인(데모용) 오버레이
            // ========================================
            const AUTH_USER_KEY = 'bps_auth_userId';
            const PASSWORDS_KEY = 'bps_user_passwords';
            const RESET_REQUIRED_KEY = 'bps_password_reset_required';

            function safeParseJson(val, fallback) {
                try {
                    if (val === null || val === undefined) return fallback;
                    const parsed = JSON.parse(val);
                    return parsed != null ? parsed : fallback;
                } catch (e) {
                    return fallback;
                }
            }

            const loginOverlay = document.getElementById('loginOverlay');
            const mainContentEl = document.querySelector('.main-content');
            const loginForm = document.getElementById('loginForm');
            const loginUserSelect = document.getElementById('loginUserId');
            const loginPassword = document.getElementById('loginPassword');
            const loginConfirmWrap = document.getElementById('loginConfirmWrap');
            const loginPasswordConfirm = document.getElementById('loginPasswordConfirm');
            const loginErrorEl = document.getElementById('loginError');
            const loginSubmitBtn = document.getElementById('loginSubmitBtn');

            let userPasswords = safeParseJson(localStorage.getItem(PASSWORDS_KEY), {});
            let resetRequired = safeParseJson(localStorage.getItem(RESET_REQUIRED_KEY), {});

            function setLoginError(message) {
                if (!loginErrorEl) return;
                loginErrorEl.textContent = message || '';
                loginErrorEl.style.display = message ? 'block' : 'none';
            }

            function syncLoginModeUI() {
                if (!loginUserSelect || !loginPassword) return;
                const uid = String(loginUserSelect.value || '').trim();
                if (!uid) return;
                const requiresSet = !!resetRequired[uid] || !userPasswords[uid];
                if (loginConfirmWrap) loginConfirmWrap.style.display = requiresSet ? 'flex' : 'none';
                if (loginSubmitBtn) loginSubmitBtn.textContent = requiresSet ? '비밀번호 설정 후 로그인' : '로그인';
                setLoginError('');
                // set 모드에서만 확인값이 필요하므로, 입력 실수 방지용으로 확인칸 값은 유지하되 검증 시에만 체크.
            }

            function setCurrentUserFromUserAccount(targetUser) {
                if (!targetUser) return;
                currentUserAccessProfile.userId = targetUser.userId || '';
                currentUserAccessProfile.name = targetUser.name || '';
                currentUserAccessProfile.type = targetUser.type || 'internal';
                currentUserAccessProfile.role = targetUser.role || '';
                currentUserAccessProfile.contractorName = targetUser.contractorName || '';
                currentUserAccessProfile.extraAllowedPages = Array.from((targetUser.extraAllowedPages || []));
            }

            let isAuthed = false;
            try {
                if (
                    window.__bpsProfileBootstrap &&
                    typeof window.__bpsProfileBootstrap === 'object' &&
                    window.__bpsProfileBootstrap.userId
                ) {
                    var bp = window.__bpsProfileBootstrap;
                    currentUserAccessProfile.userId = String(bp.userId || '').trim();
                    currentUserAccessProfile.name = String(bp.name || '').trim();
                    currentUserAccessProfile.type = bp.type === 'external' ? 'external' : 'internal';
                    currentUserAccessProfile.role = String(bp.role || '').trim();
                    currentUserAccessProfile.contractorName = String(bp.contractorName || '').trim();
                    currentUserAccessProfile.extraAllowedPages = Array.from(bp.extraAllowedPages || []);
                    isAuthed = true;
                }
            } catch (eBoot) {
                /* ignore */
            }

            const storedAuthUserId = String(localStorage.getItem(AUTH_USER_KEY) || '').trim();
            if (!isAuthed && storedAuthUserId && Array.isArray(userAccounts)) {
                const targetUser = userAccounts.find(function (u) {
                    return u && u.userId === storedAuthUserId && u.active !== false;
                });
                if (targetUser) {
                    setCurrentUserFromUserAccount(targetUser);
                    isAuthed = true;
                }
            }

            // 로그인 페이지 분리: 인증 안 된 상태면 index.html에서 바로 login.html로 보냅니다.
            const isIndexPage = (window.location.pathname || '').toLowerCase().endsWith('index.html');
            if (!isAuthed && isIndexPage && loginOverlay) {
                const next = (window.location.hash || '').slice(1) || 'dashboard';
                window.location.href = 'login.html?next=' + encodeURIComponent(next);
                return;
            }

            // 로그인 UI 초기화
            if (loginOverlay && loginForm && loginUserSelect && Array.isArray(userAccounts)) {
                const isSelectEl = loginUserSelect && String(loginUserSelect.tagName || '').toUpperCase() === 'SELECT';

                if (isSelectEl) {
                    const activeUsers = userAccounts.filter(function (u) { return u && u.active !== false; });
                    loginUserSelect.innerHTML = activeUsers.map(function (u) {
                        const uid = escapeHtmlAttr(u.userId || '');
                        const nm = escapeHtmlAttr(u.name || '');
                        return '<option value="' + uid + '">' + nm + ' (@' + uid + ')</option>';
                    }).join('');
                }

                // 아이디가 미리 저장된 상태면 그 사용자로 모드 동기화
                if (storedAuthUserId) loginUserSelect.value = storedAuthUserId;

                const eventName = isSelectEl ? 'change' : 'input';
                loginUserSelect.addEventListener(eventName, function () {
                    syncLoginModeUI();
                });

                // 제출 핸들러
                loginForm.addEventListener('submit', function (e) {
                    e.preventDefault();
                    if (!loginUserSelect) return;
                    const uid = String(loginUserSelect.value || '').trim();
                    const pw = String(loginPassword && loginPassword.value ? loginPassword.value : '').trim();

                    if (!uid) {
                        setLoginError('아이디를 선택하세요.');
                        return;
                    }
                    if (!pw) {
                        setLoginError('비밀번호를 입력하세요.');
                        return;
                    }

                    const targetUser = userAccounts.find(function (u) { return u && u.userId === uid && u.active !== false; });
                    if (!targetUser) {
                        setLoginError('계정을 찾을 수 없습니다.');
                        return;
                    }

                    const requiresSet = !!resetRequired[uid] || !userPasswords[uid];
                    if (requiresSet) {
                        const pw2 = String(loginPasswordConfirm && loginPasswordConfirm.value ? loginPasswordConfirm.value : '').trim();
                        if (pw.length < 6) {
                            setLoginError('비밀번호는 6자 이상으로 입력하세요.');
                            return;
                        }
                        if (pw !== pw2) {
                            setLoginError('비밀번호 확인이 일치하지 않습니다.');
                            return;
                        }
                        userPasswords[uid] = pw;
                        delete resetRequired[uid];
                        localStorage.setItem(PASSWORDS_KEY, JSON.stringify(userPasswords));
                        localStorage.setItem(RESET_REQUIRED_KEY, JSON.stringify(resetRequired));
                    } else {
                        if (String(userPasswords[uid] || '') !== pw) {
                            setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
                            return;
                        }
                    }

                    localStorage.setItem(AUTH_USER_KEY, uid);
                    setCurrentUserFromUserAccount(targetUser);
                    setLoginError('');

                    // 로그인 성공: 오버레이 닫기 + 페이지 리렌더
                    if (loginOverlay) loginOverlay.classList.remove('active');
                    if (mainContentEl) mainContentEl.style.display = '';

                    applyRoleBasedNavigation();
                    const hash = window.location.hash.slice(1);
                    const nextPage = (hash && document.getElementById(`page-${hash}`)) ? hash : 'dashboard';
                    showPage(nextPage);
                });

                // 처음 모드 동기화
                syncLoginModeUI();
            }

            // 로그인 상태에 따라 오버레이 표기
            if (loginOverlay) {
                if (!isAuthed) {
                    loginOverlay.classList.add('active');
                    if (mainContentEl) mainContentEl.style.display = 'none';
                } else {
                    loginOverlay.classList.remove('active');
                    if (mainContentEl) mainContentEl.style.display = '';
                }
            }

            applyRoleBasedNavigation();
            const hash = window.location.hash.slice(1); // #을 제거
            if (hash && document.getElementById(`page-${hash}`)) {
                showPage(hash);
            } else {
                showPage('dashboard'); // 기본 페이지: 대시보드
            }
            if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                syncExpensesFromServer();
                syncSgaFromServer();
                syncContractorsFromServer();
                Promise.all([syncEstimatesFromServer(), syncCategoryMastersFromServer()]).then(function () {
                    syncCategoryMastersFromEstimates();
                    renderCategoryMasterTables();
                    if (typeof refreshCategoryFilterOptionsAll === 'function') {
                        refreshCategoryFilterOptionsAll();
                    }
                });
            }

            // 경영실적관리 기간 UI(월 선택/기간 선택) 초기화
            initPerformanceMonthPicker();
            initPerformanceDatePicker();
            updatePerformanceMonthButtonLabel();
            updatePerformanceRangeButtons();

            // 바깥 클릭 시 팝오버/날짜패널 닫기
            document.addEventListener('click', function (e) {
                if (e.target.closest && (
                    e.target.closest('#performanceFilterMonthWrap') ||
                    e.target.closest('#performanceMonthAnchor') ||
                    e.target.closest('#performanceRangeWrap') ||
                    e.target.closest('#performanceRangeAnchor') ||
                    e.target.closest('#performanceDatePickerPanel') ||
                    e.target.closest('#performanceDateFromBtn') ||
                    e.target.closest('#performanceDateToBtn')
                )) return;
                const w = document.getElementById('performanceFilterMonthWrap');
                const rw = document.getElementById('performanceRangeWrap');
                const dp = document.getElementById('performanceDatePickerPanel');
                if (w) w.style.display = 'none';
                if (rw) rw.style.display = 'none';
                if (dp) dp.style.display = 'none';
            });

            // 로그아웃
            const logoutBtn = document.querySelector('.logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', function () {
                    var after = function () {
                        localStorage.removeItem(AUTH_USER_KEY);
                        window.location.href = 'login.html';
                    };
                    if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                        window.__bpsSupabase.auth.signOut().then(after).catch(after);
                    } else {
                        after();
                    }
                });
            }
        });

        // 브라우저 뒤로가기/앞으로가기 지원
        window.addEventListener('hashchange', function() {
            const hash = window.location.hash.slice(1);
            if (hash && document.getElementById(`page-${hash}`)) {
                showPage(hash);
            }
        });

        // 대시보드 캘린더 (dashboard.html과 동일)
        let dashboardCalendarYear = new Date().getFullYear();
        let dashboardCalendarMonth = new Date().getMonth();
        let dashboardCalendarFilter = 'all';

        function getDashboardEvents() {
            return estimates.map(e => ({
                id: e.code,
                code: e.code || '',
                building: e.building || '',
                project: e.project || '',
                manager: e.manager || '',
                status: e.status || '견적',
                startDate: e.startDate || '',
                endDate: e.endDate || '',
                date: e.date || '',
                amount: e.revenue || 0
            }));
        }

        function normalizeYmd(value) {
            return value ? String(value).trim().slice(0, 10) : '';
        }

        function isDateInRange(dateStr, startDate, endDate) {
            const target = normalizeYmd(dateStr);
            const start = normalizeYmd(startDate);
            const end = normalizeYmd(endDate);
            if (!target) return false;
            if (start && end) {
                const from = start <= end ? start : end;
                const to = start <= end ? end : start;
                return target >= from && target <= to;
            }
            if (start) return target === start;
            if (end) return target === end;
            return false;
        }

        function getDashboardEventsForDate(dateStr) {
            return getDashboardEvents().reduce((acc, event) => {
                const isStartDate = !!event.startDate && normalizeYmd(event.startDate) === normalizeYmd(dateStr);
                const isEndDate = !!event.endDate && normalizeYmd(event.endDate) === normalizeYmd(dateStr);
                const isInPeriod = isDateInRange(dateStr, event.startDate, event.endDate);
                const hasCalendarAnchor = !!(event.startDate || event.endDate);
                let shouldShow = false;

                if (!hasCalendarAnchor) {
                    shouldShow = false;
                } else if (dashboardCalendarFilter === '진행') {
                    shouldShow = (isInPeriod || isStartDate) && event.status !== '완료';
                } else if (dashboardCalendarFilter === '완료') {
                    shouldShow = (isInPeriod || isEndDate) && event.status === '완료';
                } else {
                    shouldShow = isInPeriod || isStartDate || isEndDate;
                }

                if (shouldShow) {
                    acc.push(event);
                }
                return acc;
            }, []);
        }

        function renderDashboardCalendar() {
            const grid = document.getElementById('dashboardCalendarGrid');
            const titleEl = document.getElementById('dashboardCalendarTitle');
            if (!grid || !titleEl) return;

            grid.innerHTML = '';
            const firstDay = new Date(dashboardCalendarYear, dashboardCalendarMonth, 1);
            const lastDay = new Date(dashboardCalendarYear, dashboardCalendarMonth + 1, 0);
            const prevLastDay = new Date(dashboardCalendarYear, dashboardCalendarMonth, 0);
            const firstDayOfWeek = firstDay.getDay();
            const lastDate = lastDay.getDate();
            const prevLastDate = prevLastDay.getDate();

            titleEl.textContent = dashboardCalendarYear + '년 ' + (dashboardCalendarMonth + 1) + '월';

            const today = new Date();
            const isCurrentMonth = today.getFullYear() === dashboardCalendarYear && today.getMonth() === dashboardCalendarMonth;

            for (let i = firstDayOfWeek - 1; i >= 0; i--) {
                const day = prevLastDate - i;
                const dayDiv = document.createElement('div');
                dayDiv.className = 'calendar-day other-month';
                dayDiv.innerHTML = '<div class="day-number">' + day + '</div>';
                grid.appendChild(dayDiv);
            }

            for (let day = 1; day <= lastDate; day++) {
                const dateStr = dashboardCalendarYear + '-' + String(dashboardCalendarMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                const dayOfWeek = new Date(dashboardCalendarYear, dashboardCalendarMonth, day).getDay();
                const dayDiv = document.createElement('div');
                dayDiv.className = 'calendar-day';
                if (dayOfWeek === 0) dayDiv.classList.add('sunday');
                if (dayOfWeek === 6) dayDiv.classList.add('saturday');
                if (isCurrentMonth && day === today.getDate()) dayDiv.classList.add('today');

                dayDiv.innerHTML = '<div class="day-number">' + day + '</div>';
                const eventsContainer = document.createElement('div');
                eventsContainer.className = 'calendar-day-events';
                const dayEvents = getDashboardEventsForDate(dateStr);
                dayEvents.forEach(event => {
                    const eventBar = document.createElement('div');
                    eventBar.className = 'event-bar ' + (event.status === '완료' ? 'completed' : 'progress');
                    const eventTitle = (event.building ? event.building + ' - ' : '') + event.project;
                    eventBar.innerHTML = '<span class="event-title">' + eventTitle + '</span>';
                    eventBar.onclick = () => showDashboardEventModal(event);
                    eventsContainer.appendChild(eventBar);
                });
                dayDiv.appendChild(eventsContainer);
                if (dayEvents.length > 4) {
                    const moreBtn = document.createElement('button');
                    moreBtn.type = 'button';
                    moreBtn.className = 'calendar-more-btn';
                    moreBtn.textContent = '+' + (dayEvents.length - 4) + '개 더보기';
                    moreBtn.onclick = () => showDashboardDayEventsModal(dateStr, dayEvents);
                    dayDiv.appendChild(moreBtn);
                }
                grid.appendChild(dayDiv);
            }

            const remainingDays = 42 - (firstDayOfWeek + lastDate);
            for (let day = 1; day <= remainingDays; day++) {
                const dayDiv = document.createElement('div');
                dayDiv.className = 'calendar-day other-month';
                dayDiv.innerHTML = '<div class="day-number">' + day + '</div>';
                grid.appendChild(dayDiv);
            }
        }

        function dashboardChangeMonth(delta) {
            dashboardCalendarMonth += delta;
            if (dashboardCalendarMonth < 0) {
                dashboardCalendarMonth = 11;
                dashboardCalendarYear--;
            } else if (dashboardCalendarMonth > 11) {
                dashboardCalendarMonth = 0;
                dashboardCalendarYear++;
            }
            renderDashboardCalendar();
        }

        function showDashboardEventModal(event) {
            const modal = document.getElementById('dashboardEventModal');
            const body = document.getElementById('dashboardEventModalBody');
            if (!modal || !body) return;
            const statusClass = event.status === '완료' ? 'completed' : 'progress';
            const codeDisplay = (event.code || event.id || '').toString() || '-';
            body.innerHTML = '<div class="modal-info"><div class="info-label">코드</div><div class="info-value" style="font-family: ui-monospace, monospace; font-weight: 600;">' + codeDisplay + '</div></div>' +
                '<div class="modal-info"><div class="info-label">건물명</div><div class="info-value">' + (event.building || '-') + '</div></div>' +
                '<div class="modal-info"><div class="info-label">프로젝트명</div><div class="info-value">' + (event.project || '-') + '</div></div>' +
                '<div class="modal-info"><div class="info-label">담당자</div><div class="info-value">' + (event.manager || '-') + '</div></div>' +
                (event.startDate ? '<div class="modal-info"><div class="info-label">진행일</div><div class="info-value">' + event.startDate + '</div></div>' : '') +
                (event.endDate ? '<div class="modal-info"><div class="info-label">완료일</div><div class="info-value">' + event.endDate + '</div></div>' : '') +
                '<div class="modal-info"><div class="info-label">상태</div><div class="info-value"><span class="status-badge ' + statusClass + '">' + event.status + '</span></div></div>' +
                '<div class="modal-info"><div class="info-label">매출금액</div><div class="info-value">' + (event.amount || 0).toLocaleString() + '원</div></div>' +
                '<div class="dashboard-event-modal-actions">' +
                    '<button type="button" class="btn btn-primary dashboard-event-goto-project-btn"><i class="fas fa-external-link-alt"></i> 프로젝트 관리에서 보기</button>' +
                '</div>';
            modal.classList.add('active');
            const gotoBtn = body.querySelector('.dashboard-event-goto-project-btn');
            const rawCode = (event.code || event.id || '').toString().trim();
            if (gotoBtn) {
                if (!rawCode || rawCode === '-') {
                    gotoBtn.disabled = true;
                    gotoBtn.style.opacity = '0.55';
                    gotoBtn.style.cursor = 'not-allowed';
                    gotoBtn.title = '코드가 없어 이동할 수 없습니다';
                } else {
                    gotoBtn.onclick = function() {
                        goToProjectFromCalendar(rawCode);
                    };
                }
            }
        }

        /** 캘린더 일정 상세 → 프로젝트 관리 목록·상세 패널 */
        function goToProjectFromCalendar(code) {
            var codeStr = String(code || '').trim();
            if (!codeStr) return;
            if (!estimates.some(function(e) { return e.code === codeStr; })) {
                alert('해당 코드의 프로젝트를 찾을 수 없습니다.');
                return;
            }
            closeDashboardEventModal();
            closeDashboardDayEventsModal();
            showPage('estimate');
            renderTable();
            function afterPaint() {
                var tbody = document.getElementById('tableBody');
                var esc = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(codeStr) : codeStr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                var row = tbody ? tbody.querySelector('tr[data-code="' + esc + '"]') : null;
                if (row) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    row.classList.add('table-row-flash-highlight');
                    window.setTimeout(function() {
                        row.classList.remove('table-row-flash-highlight');
                    }, 2000);
                }
                openPanel(codeStr);
            }
            window.requestAnimationFrame(function() {
                window.requestAnimationFrame(afterPaint);
            });
        }

        function closeDashboardEventModal() {
            const modal = document.getElementById('dashboardEventModal');
            if (modal) modal.classList.remove('active');
        }

        function showDashboardDayEventsModal(dateStr, events) {
            const modal = document.getElementById('dashboardDayEventsModal');
            const title = document.getElementById('dashboardDayEventsTitle');
            const body = document.getElementById('dashboardDayEventsBody');
            if (!modal || !title || !body) return;

            title.textContent = dateStr + ' 일정';
            body.innerHTML = '';

            events.forEach(event => {
                const row = document.createElement('button');
                row.type = 'button';
                const st = event.status || '-';
                let statusRowClass = 'day-events-item';
                if (st === '완료') statusRowClass += ' day-events-item--complete';
                else if (st === '진행') statusRowClass += ' day-events-item--progress';
                row.className = statusRowClass;
                const eventTitle = (event.building ? event.building + ' - ' : '') + event.project;
                row.innerHTML =
                    '<div class="day-events-item-main">' +
                        '<span class="day-events-item-title">' + eventTitle + '</span>' +
                    '</div>' +
                    '<div class="day-events-item-meta">상태: <span class="day-events-status-text">' + st + '</span></div>';
                row.onclick = () => {
                    closeDashboardDayEventsModal();
                    showDashboardEventModal(event);
                };
                body.appendChild(row);
            });

            modal.classList.add('active');
        }

        function closeDashboardDayEventsModal() {
            const modal = document.getElementById('dashboardDayEventsModal');
            if (modal) modal.classList.remove('active');
        }

        function toggleDashboardTheme() {
            document.body.classList.toggle('dark-mode');
            const btn = document.getElementById('dashboardThemeBtn');
            if (btn) {
                if (document.body.classList.contains('dark-mode')) {
                    btn.innerHTML = '<i class="fas fa-sun"></i> 라이트모드';
                } else {
                    btn.innerHTML = '<i class="fas fa-moon"></i> 다크모드';
                }
            }
        }

        // 대시보드 렌더링
        function renderDashboard() {
            const now = new Date();
            const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            const monthEstimates = estimates.filter(e => e.date && e.date.slice(0, 7) === thisMonth);
            const monthRevenue = monthEstimates.reduce((sum, e) => sum + (e.revenue || 0), 0);
            const progressCount = estimates.filter(e => e.status === '진행').length;
            const completeCount = estimates.filter(e => e.status === '완료').length;
            const estimateCount = estimates.filter(e => e.status === '견적').length;

            const elRevenue = document.getElementById('dashboardMonthRevenue');
            const elProgress = document.getElementById('dashboardProgressCount');
            const elComplete = document.getElementById('dashboardCompleteCount');
            const elEst = document.getElementById('dashboardEstimateCount');
            if (elRevenue) elRevenue.textContent = monthRevenue.toLocaleString() + '원';
            if (elProgress) elProgress.textContent = progressCount + '건';
            if (elComplete) elComplete.textContent = completeCount + '건';
            if (elEst) elEst.textContent = estimateCount + '건';

            renderDashboardCalendar();

            document.querySelectorAll('#page-dashboard .filter-btn').forEach(btn => {
                btn.onclick = function() {
                    document.querySelectorAll('#page-dashboard .filter-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    dashboardCalendarFilter = this.getAttribute('data-filter') || 'all';
                    renderDashboardCalendar();
                };
            });
        }

        (function initDashboardModal() {
            document.addEventListener('DOMContentLoaded', function() {
                const modal = document.getElementById('dashboardEventModal');
                if (modal) {
                    modal.addEventListener('click', function(e) {
                        if (e.target === modal) closeDashboardEventModal();
                    });
                }
                const dayModal = document.getElementById('dashboardDayEventsModal');
                if (dayModal) {
                    dayModal.addEventListener('click', function(e) {
                        if (e.target === dayModal) closeDashboardDayEventsModal();
                    });
                }
            });
        })();

        const estimates = [];

        function applyEstimateDefaultsAndSeed(list) {
            (list || []).forEach(function(e) {
                if (e.startDate || e.endDate) return;
                var d = e.date ? String(e.date).trim().slice(0, 10) : '';
                if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return;
                e.startDate = d;
                e.endDate = d;
            });

            (list || []).forEach(function (e, i) {
                if (e.category3 === undefined) e.category3 = '지원';
                if (!e.code || String(e.code).trim() === '') {
                    e.code = '26' + String(100000 + i);
                }
                if (e.businessIncomeGross === undefined) e.businessIncomeGross = 0;
                if (e.businessIncomeTransferDate === undefined) e.businessIncomeTransferDate = '';
                if (e.businessIncomePaidStatus === undefined) e.businessIncomePaidStatus = '미지급';
                if (e.salesDates === undefined) e.salesDates = [];
                seedEstimateAggregates(e);
            });
        }

        applyEstimateDefaultsAndSeed(estimates);

        // 경비 (`POST /api/expense` + body.action → `expense_records`).
        let expenses = [];

        // 판관비 (`POST /api/sga` + body.action → `sga_records`)
        let sgaExpenses = [];

        function computeBizTaxFromGross(grossNum) {
            const gross = Math.max(0, Math.round(Number(grossNum) || 0));
            const tax3 = Math.round(gross * 0.03);
            const taxLocal = Math.round(gross * 0.003);
            const taxTotal = tax3 + taxLocal;
            const net = Math.max(0, gross - taxTotal);
            return { gross, tax3, taxLocal, taxTotal, net };
        }

        function seedEstimateAggregates(e) {
            if (e.aggregateSalesGross == null) e.aggregateSalesGross = e.revenue || 0;
            if (e.aggregatePurchaseGross == null) e.aggregatePurchaseGross = e.purchase || 0;
            if (e.aggregatePaymentGross == null) {
                if (e.paidStatus === '전액') e.aggregatePaymentGross = e.revenue || 0;
                else if (e.paidStatus === '부분') e.aggregatePaymentGross = Math.round((e.revenue || 0) * 0.5);
                else e.aggregatePaymentGross = 0;
            }
            if (e.aggregateTransferGross == null) {
                const p = e.purchase || 0;
                e.aggregateTransferGross = p > 0 ? Math.round(p * 0.6) : 0;
            }
        }

        function bpsUtf8ByteLength(str) {
            if (typeof str !== 'string') return 0;
            if (typeof TextEncoder !== 'undefined') {
                return new TextEncoder().encode(str).length;
            }
            return unescape(encodeURIComponent(str)).length;
        }

        function bpsAuthedPost(path, payload) {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.reject(new Error('NO_SUPABASE'));
            }
            return window.__bpsSupabase.auth.getSession().then(function (res) {
                if (res.error || !res.data || !res.data.session) {
                    return Promise.reject(new Error('로그인이 필요합니다.'));
                }
                return fetch(window.location.origin + path, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + res.data.session.access_token,
                    },
                    body: JSON.stringify(payload || {}),
                }).then(function (r) {
                    return r.text().then(function (text) {
                        var j = null;
                        try {
                            j = text && text.length ? JSON.parse(text) : {};
                        } catch (e) {
                            j = {
                                ok: false,
                                error:
                                    '서버 응답이 JSON이 아닙니다 (HTTP ' +
                                    r.status +
                                    '). /api 경로·최신 배포·로그인 세션을 확인해 주세요.',
                                _rawSnippet: text ? String(text).replace(/\s+/g, ' ').slice(0, 180) : '',
                            };
                        }
                        if (!r.ok && j && !j.error && typeof j.message === 'string') {
                            j = { ...j, error: j.message };
                        }
                        return { ok: r.ok, status: r.status, body: j };
                    });
                });
            });
        }

        function bpsEstimateApi(path, payload) {
            return bpsAuthedPost(path, payload);
        }

        function syncEstimatesFromServer() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) return Promise.resolve(false);
            return bpsEstimateApi('/api/estimate', { action: 'list' }).then(function (r) {
                if (!r.ok || !r.body || !Array.isArray(r.body.items)) return false;
                const list = r.body.items.map(function (x) { return { ...x }; });
                applyEstimateDefaultsAndSeed(list);
                estimates.splice(0, estimates.length, ...list);
                renderTable();
                return true;
            }).catch(function () {
                return false;
            });
        }

        function upsertEstimateToServer(item) {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.resolve({ ok: true });
            }
            return bpsEstimateApi('/api/estimate', { action: 'upsert', item: item })
                .then(function (r) {
                    if (!r.ok) {
                        return { ok: false, error: (r.body && r.body.error) || '견적 서버 저장 실패' };
                    }
                    return { ok: true };
                })
                .catch(function (e) {
                    return { ok: false, error: (e && e.message) || '견적 서버 저장 실패' };
                });
        }

        function deleteEstimateFromServer(code) {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.resolve({ ok: true });
            }
            return bpsEstimateApi('/api/estimate', { action: 'delete', code: String(code || '').trim() })
                .then(function (r) {
                    if (!r.ok) {
                        return { ok: false, error: (r.body && r.body.error) || '견적 서버 삭제 실패' };
                    }
                    return { ok: true };
                })
                .catch(function (e) {
                    return { ok: false, error: (e && e.message) || '견적 서버 삭제 실패' };
                });
        }

        function syncExpensesFromServer() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) return Promise.resolve(false);
            return bpsAuthedPost('/api/expense', { action: 'list' }).then(function (r) {
                if (!r.ok || !r.body || r.body.ok !== true || !Array.isArray(r.body.items)) {
                    return false;
                }
                const list = r.body.items.map(function (x) {
                    return { ...x };
                });
                expenses.splice(0, expenses.length, ...list);
                fillExpenseMonthFilter();
                renderExpenseTable();
                return true;
            }).catch(function () {
                return false;
            });
        }

        function upsertExpenseToServer(item) {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.resolve({
                    ok: false,
                    error:
                        '로그인(Supabase) 정보가 없어 서버에 저장할 수 없습니다. 페이지를 새로고침한 뒤 다시 로그인해 주세요.',
                });
            }
            var id = item && item.id != null ? Number(item.id) : NaN;
            if (!item || !Number.isFinite(id)) {
                return Promise.resolve({ ok: false, error: '저장할 경비 데이터가 올바르지 않습니다.' });
            }
            var payloadWrapper = { action: 'upsert', item: item };
            var maxBytes = 4 * 1024 * 1024 - 80 * 1024;
            if (bpsUtf8ByteLength(JSON.stringify(payloadWrapper)) > maxBytes) {
                return Promise.resolve({
                    ok: false,
                    error:
                        '영수증·첨부 파일(data URL) 때문에 요청 크기가 너무 큽니다. 사진·PDF를 빼거나 장당 용량을 줄인 뒤 다시 저장해 주세요.',
                });
            }
            return bpsAuthedPost('/api/expense', payloadWrapper)
                .then(function (r) {
                    if (!r.ok || !r.body || r.body.ok !== true) {
                        var msg = (r.body && r.body.error) || '경비 서버 저장 실패';
                        if (r.body && r.body._rawSnippet) {
                            msg += ' — ' + r.body._rawSnippet;
                        } else if (r.status) {
                            msg += ' (HTTP ' + r.status + ')';
                        }
                        return { ok: false, error: msg };
                    }
                    return { ok: true };
                })
                .catch(function (e) {
                    return { ok: false, error: (e && e.message) || '경비 서버 저장 실패' };
                });
        }

        function deleteExpenseFromServer(id) {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.resolve({
                    ok: false,
                    error: '로그인(Supabase) 정보가 없어 서버에서 삭제할 수 없습니다.',
                });
            }
            var nid = Number(id);
            if (!Number.isFinite(nid)) {
                return Promise.resolve({ ok: false, error: '삭제할 항목이 올바르지 않습니다.' });
            }
            return bpsAuthedPost('/api/expense', { action: 'delete', id: nid })
                .then(function (r) {
                    if (!r.ok || !r.body || r.body.ok !== true) {
                        return { ok: false, error: (r.body && r.body.error) || '경비 서버 삭제 실패' };
                    }
                    return { ok: true };
                })
                .catch(function (e) {
                    return { ok: false, error: (e && e.message) || '경비 서버 삭제 실패' };
                });
        }

        function syncSgaFromServer() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) return Promise.resolve(false);
            return bpsAuthedPost('/api/sga', { action: 'list' }).then(function (r) {
                if (!r.ok || !r.body || r.body.ok !== true || !Array.isArray(r.body.items)) {
                    return false;
                }
                const list = r.body.items.map(function (x) {
                    return { ...x };
                });
                sgaExpenses.splice(0, sgaExpenses.length, ...list);
                fillSgaMonthFilter();
                renderSgaTable();
                renderPerformanceData();
                return true;
            }).catch(function () {
                return false;
            });
        }

        function upsertSgaToServer(item) {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.resolve({
                    ok: false,
                    error:
                        '로그인(Supabase) 정보가 없어 서버에 저장할 수 없습니다. 페이지를 새로고침한 뒤 다시 로그인해 주세요.',
                });
            }
            var id = item && item.id != null ? Number(item.id) : NaN;
            if (!item || !Number.isFinite(id)) {
                return Promise.resolve({ ok: false, error: '저장할 판관비 데이터가 올바르지 않습니다.' });
            }
            return bpsAuthedPost('/api/sga', { action: 'upsert', item: item })
                .then(function (r) {
                    if (!r.ok || !r.body || r.body.ok !== true) {
                        var msg = (r.body && r.body.error) || '판관비 서버 저장 실패';
                        if (r.body && r.body._rawSnippet) {
                            msg += ' — ' + r.body._rawSnippet;
                        } else if (r.status) {
                            msg += ' (HTTP ' + r.status + ')';
                        }
                        return { ok: false, error: msg };
                    }
                    return { ok: true };
                })
                .catch(function (e) {
                    return { ok: false, error: (e && e.message) || '판관비 서버 저장 실패' };
                });
        }

        function deleteSgaFromServer(id) {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.resolve({
                    ok: false,
                    error: '로그인(Supabase) 정보가 없어 서버에서 삭제할 수 없습니다.',
                });
            }
            var nid = Number(id);
            if (!Number.isFinite(nid)) {
                return Promise.resolve({ ok: false, error: '삭제할 항목이 올바르지 않습니다.' });
            }
            return bpsAuthedPost('/api/sga', { action: 'delete', id: nid })
                .then(function (r) {
                    if (!r.ok || !r.body || r.body.ok !== true) {
                        return { ok: false, error: (r.body && r.body.error) || '판관비 서버 삭제 실패' };
                    }
                    return { ok: true };
                })
                .catch(function (e) {
                    return { ok: false, error: (e && e.message) || '판관비 서버 삭제 실패' };
                });
        }

        function syncContractorsFromServer() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) return Promise.resolve(false);
            return bpsAuthedPost('/api/contractor', { action: 'list' }).then(function (r) {
                if (!r.ok || !r.body || r.body.ok !== true || !Array.isArray(r.body.items)) {
                    return false;
                }
                const list = r.body.items.map(function (x) {
                    return { ...x };
                });
                contractors.splice(0, contractors.length, ...list);
                renderContractorTable();
                return true;
            }).catch(function () {
                return false;
            });
        }

        function upsertContractorToServer(item) {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.resolve({
                    ok: false,
                    error:
                        '로그인(Supabase) 정보가 없어 서버에 저장할 수 없습니다. 페이지를 새로고침한 뒤 다시 로그인해 주세요.',
                });
            }
            var id = item && item.id != null ? Number(item.id) : NaN;
            if (!item || !Number.isFinite(id)) {
                return Promise.resolve({ ok: false, error: '저장할 업체 데이터가 올바르지 않습니다.' });
            }
            var payloadWrapper = { action: 'upsert', item: item };
            var maxBytes = 4 * 1024 * 1024 - 80 * 1024;
            if (bpsUtf8ByteLength(JSON.stringify(payloadWrapper)) > maxBytes) {
                return Promise.resolve({
                    ok: false,
                    error:
                        '첨부 파일(data URL) 때문에 요청 크기가 너무 큽니다. 이미지·PDF 용량을 줄이거나 해상도를 낮춘 뒤 다시 저장해 주세요.',
                });
            }
            return bpsAuthedPost('/api/contractor', payloadWrapper)
                .then(function (r) {
                    if (!r.ok || !r.body || r.body.ok !== true) {
                        var msg = (r.body && r.body.error) || '업체 서버 저장 실패';
                        if (r.body && r.body._rawSnippet) {
                            msg += ' — ' + r.body._rawSnippet;
                        } else if (r.status) {
                            msg += ' (HTTP ' + r.status + ')';
                        }
                        return { ok: false, error: msg };
                    }
                    return { ok: true };
                })
                .catch(function (e) {
                    return { ok: false, error: (e && e.message) || '업체 서버 저장 실패' };
                });
        }

        function deleteContractorFromServer(id) {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.resolve({
                    ok: false,
                    error: '로그인(Supabase) 정보가 없어 서버에서 삭제할 수 없습니다.',
                });
            }
            var nid = Number(id);
            if (!Number.isFinite(nid)) {
                return Promise.resolve({ ok: false, error: '삭제할 항목이 올바르지 않습니다.' });
            }
            return bpsAuthedPost('/api/contractor', { action: 'delete', id: nid })
                .then(function (r) {
                    if (!r.ok || !r.body || r.body.ok !== true) {
                        return { ok: false, error: (r.body && r.body.error) || '업체 서버 삭제 실패' };
                    }
                    return { ok: true };
                })
                .catch(function (e) {
                    return { ok: false, error: (e && e.message) || '업체 서버 삭제 실패' };
                });
        }

        async function deleteCurrentEstimate() {
            if (!currentEditItem || !currentEditItem.code) return;
            const code = String(currentEditItem.code).trim();
            const ok = confirm('견적 ' + code + ' 을(를) 삭제하시겠습니까?');
            if (!ok) return;

            const remote = await deleteEstimateFromServer(code);
            if (!remote.ok) {
                alert(remote.error || '견적 서버 삭제 실패');
                return;
            }

            const idx = estimates.findIndex(function (e) { return String(e.code || '') === code; });
            if (idx !== -1) estimates.splice(idx, 1);
            closePanel(true);
            renderTable();
            showToast('견적이 삭제되었습니다.');
        }

        function readBusinessIncomeFormIntoItem(target) {
            if (!target || (target.type !== '세금계산서' && target.type !== '사업소득')) return;
            const d = document.getElementById('biz_transfer_date');
            const g = document.getElementById('biz_gross');
            const paid = document.querySelector('input[name="biz_paid"]:checked');
            const grossSrc = (g && g.value !== '' && g.value != null) ? g.value : target.businessIncomeGross;
            const comp = computeBizTaxFromGross(grossSrc);
            if (d) target.businessIncomeTransferDate = d.value || '';
            target.businessIncomeGross = comp.gross;
            target.businessIncomeNetPay = comp.net;
            if (paid) target.businessIncomePaidStatus = paid.value === '지급' ? '지급' : '미지급';
        }

        function syncBusinessIncomeDerived() {
            const g = document.getElementById('biz_gross');
            if (!g) return;
            const comp = computeBizTaxFromGross(g.value);
            function setVal(id, v) {
                const el = document.getElementById(id);
                if (el) el.value = v;
            }
            setVal('biz_tax3', comp.tax3);
            setVal('biz_tax_local', comp.taxLocal);
            setVal('biz_tax_total', comp.taxTotal);
            setVal('biz_net', comp.net);
            markPanelDirtyIfChanged();
        }

        function projectSalesPurchaseChipClass(isPurchaseSide, item, purchaseAmount) {
            if (item.type !== '세금계산서') return 'table-amount-chip--na';
            if (isPurchaseSide && purchaseAmount <= 0) return 'table-amount-chip--na';
            return item.taxIssued ? 'table-amount-chip--issued' : 'table-amount-chip--not-issued';
        }

        function tableAmountDash() {
            return '<span class="table-amount-dash">-</span>';
        }

        function tableCashflowChip(amount, doneGreen) {
            const a = Math.round(Number(amount) || 0);
            if (a <= 0) return tableAmountDash();
            const cls = doneGreen ? 'table-amount-chip--issued' : 'table-amount-chip--not-issued';
            return '<span class="table-amount-chip ' + cls + '">' + a.toLocaleString() + '원</span>';
        }

        function renderCashflowTripleCell(item) {
            const salesGross = item.aggregateSalesGross != null ? item.aggregateSalesGross : (item.revenue || 0);
            const purchaseGross = item.aggregatePurchaseGross != null ? item.aggregatePurchaseGross : (item.purchase || 0);
            const pay = item.aggregatePaymentGross != null ? item.aggregatePaymentGross : 0;
            const transfer = item.aggregateTransferGross != null ? item.aggregateTransferGross : 0;
            const biz = computeBizTaxFromGross(item.businessIncomeGross);
            // 필터와 칩 색상 판정을 완전히 동일하게 맞추기 위해 "정확히 동일" 기준으로 완료 판정합니다.
            const payDone = salesGross <= 0 ? true : pay === salesGross;
            const xferDone = purchaseGross <= 0 ? true : transfer === purchaseGross;
            const payHtml = pay <= 0 ? tableAmountDash() : tableCashflowChip(pay, payDone);
            const xferHtml = transfer <= 0 ? tableAmountDash() : tableCashflowChip(transfer, xferDone);
            let netHtml;
            if (biz.gross <= 0) netHtml = tableAmountDash();
            else if (item.businessIncomePaidStatus === '지급') netHtml = '<span class="table-amount-chip table-amount-chip--issued">' + biz.net.toLocaleString() + '원</span>';
            else netHtml = '<span class="table-amount-chip table-amount-chip--not-issued">' + biz.net.toLocaleString() + '원</span>';
            return '<div class="table-amount-pair table-cashflow-triple">' + payHtml + '<span class="table-amount-slash">/</span>' + xferHtml + '<span class="table-amount-slash">/</span>' + netHtml + '</div>';
        }

        /** 대/중/소분류 마스터 { name, active } — 관리자설정 > 필터값 탭에서 관리 */
        let category1Master = [
            { name: 'B2B', active: true },
            { name: 'B2C', active: true },
            { name: '컨텍터스', active: true }
        ];
        let category2Master = [
            { name: '코오롱', active: true },
            { name: '저스트코', active: true },
            { name: '다락', active: true },
            { name: '관리건물', active: true }
        ];
        let category3Master = [
            { name: '강남', active: true },
            { name: '강서', active: true },
            { name: '파견', active: true },
            { name: '지원', active: true },
            { name: '공사', active: true }
        ];

        function syncCategoryMastersFromEstimates() {
            estimates.forEach(function (e) {
                var c1 = (e.category1 || '').trim();
                if (c1 && !category1Master.some(function (m) { return m.name === c1; })) category1Master.push({ name: c1, active: true });
                var c2 = (e.category2 || '').trim();
                if (c2 && !category2Master.some(function (m) { return m.name === c2; })) category2Master.push({ name: c2, active: true });
                var c3 = (e.category3 || '').trim();
                if (c3 && !category3Master.some(function (m) { return m.name === c3; })) category3Master.push({ name: c3, active: true });
            });
        }

        function applyCategorySettingsPayload(p) {
            if (!p || typeof p !== 'object') return;
            ['1', '2', '3'].forEach(function (k) {
                var arr = p[k];
                if (!Array.isArray(arr) || arr.length === 0) return;
                var target = getMasterArray(k);
                target.length = 0;
                arr.forEach(function (item) {
                    if (item && item.name) {
                        target.push({ name: String(item.name), active: item.active !== false });
                    }
                });
            });
        }

        function syncCategoryMastersFromServer() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) return Promise.resolve(false);
            return bpsAuthedPost('/api/category', { action: 'list' }).then(function (r) {
                if (!r.ok || !r.body || r.body.ok !== true || !r.body.payload) {
                    return false;
                }
                applyCategorySettingsPayload(r.body.payload);
                return true;
            }).catch(function () {
                return false;
            });
        }

        function upsertCategoryMastersToServer() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.resolve({
                    ok: false,
                    error: '로그인(Supabase) 정보가 없어 분류 마스터를 저장할 수 없습니다.',
                });
            }
            var payload = {
                '1': category1Master.map(function (m) {
                    return { name: m.name, active: m.active !== false };
                }),
                '2': category2Master.map(function (m) {
                    return { name: m.name, active: m.active !== false };
                }),
                '3': category3Master.map(function (m) {
                    return { name: m.name, active: m.active !== false };
                }),
            };
            return bpsAuthedPost('/api/category', { action: 'upsert', payload: payload })
                .then(function (r) {
                    if (!r.ok || !r.body || r.body.ok !== true) {
                        return { ok: false, error: (r.body && r.body.error) || '분류 마스터 서버 저장 실패' };
                    }
                    return { ok: true };
                })
                .catch(function (e) {
                    return { ok: false, error: (e && e.message) || '분류 마스터 서버 저장 실패' };
                });
        }

        syncCategoryMastersFromEstimates();

        var currentUserAccessProfile = {
            userId: 'junho',
            name: '방준호',
            type: 'internal',
            role: '슈퍼관리자',
            contractorName: '',
            extraAllowedPages: []
        };

        function escapeHtmlAttr(s) {
            return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        }

        function getMasterArray(key) {
            if (key === '1') return category1Master;
            if (key === '2') return category2Master;
            return category3Master;
        }

        function getFieldForMasterKey(key) {
            if (key === '1') return 'category1';
            if (key === '2') return 'category2';
            return 'category3';
        }

        /**
         * @param {{name:string,active:boolean}[]} masterArr
         * @param {string} selectedValue
         * @param {{allowEmpty?:boolean}} opt
         */
        function getMasterSelectOptionsHtml(masterArr, selectedValue, opt) {
            opt = opt || {};
            var allowEmpty = opt.allowEmpty === true;
            var sel = (selectedValue || '').trim();
            var activeNames = masterArr.filter(function (m) { return m.active; }).map(function (m) { return m.name; });
            activeNames.sort(function (a, b) { return a.localeCompare(b, 'ko'); });
            var hasActiveSel = sel && masterArr.some(function (m) { return m.name === sel && m.active; });
            var html = '';
            if (allowEmpty) {
                html += '<option value=""' + (!sel ? ' selected' : '') + '>선택</option>';
            }
            if (sel && !hasActiveSel) {
                html += '<option value="' + escapeHtmlAttr(sel) + '" selected>' + escapeHtmlAttr(sel) + ' (비활성)</option>';
            }
            activeNames.forEach(function (n) {
                html += '<option value="' + escapeHtmlAttr(n) + '"' + (n === sel ? ' selected' : '') + '>' + escapeHtmlAttr(n) + '</option>';
            });
            return html;
        }

        function getCategory1SelectOptionsHtml(selectedValue) {
            return getMasterSelectOptionsHtml(category1Master, selectedValue, {});
        }

        function getCategory2SelectOptionsHtml(selectedValue) {
            return getMasterSelectOptionsHtml(category2Master, selectedValue, {});
        }

        function getCategory3SelectOptionsHtml(selectedValue) {
            return getMasterSelectOptionsHtml(category3Master, selectedValue, { allowEmpty: true });
        }

        function renderOneMasterTable(key) {
            var masterArr = getMasterArray(key);
            var tbodyId = key === '1' ? 'category1MasterTableBody' : key === '2' ? 'category2MasterTableBody' : 'category3MasterTableBody';
            var tbody = document.getElementById(tbodyId);
            if (!tbody) return;
            var field = getFieldForMasterKey(key);
            var sorted = masterArr.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
            tbody.innerHTML = sorted.map(function (m) {
                var used = estimates.some(function (e) { return (e[field] || '').trim() === m.name; });
                var stateLabel = m.active ? '활성' : '비활성';
                var nameJsArg = '\'' + String(m.name).replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\'';
                return '<tr><td style="font-weight: 500;">' + escapeHtmlAttr(m.name) + '</td>' +
                    '<td style="text-align:center;">' +
                    '<button type="button" class="master-state-switch' + (m.active ? ' is-active' : '') + '" onclick="toggleMasterActive(\'' + key + '\',' + nameJsArg + ')" title="' + (m.active ? '비활성으로 전환' : '활성으로 전환') + '">' +
                    '<span class="master-state-switch-track"><span class="master-state-switch-thumb"></span></span>' +
                    '<span class="master-state-switch-label">' + stateLabel + '</span>' +
                    '</button>' +
                    '</td>' +
                    '<td style="text-align:center;white-space:nowrap;">' +
                    '<button type="button" class="master-delete-icon-btn" title="' + (used ? '사용 중 항목은 삭제할 수 없습니다.' : '삭제') + '" ' +
                    (used ? 'disabled' : 'onclick="removeMasterItem(\'' + key + '\',' + nameJsArg + ')"') + '>' +
                    '<i class="fas fa-trash"></i></button></td></tr>';
            }).join('');
        }

        function renderCategoryMasterTables() {
            renderOneMasterTable('1');
            renderOneMasterTable('2');
            renderOneMasterTable('3');
        }

        function addMasterItem(key) {
            var inputId = key === '1' ? 'category1MasterInput' : key === '2' ? 'category2MasterInput' : 'category3MasterInput';
            var input = document.getElementById(inputId);
            if (!input) return;
            var name = input.value.trim();
            if (!name) {
                alert('이름을 입력하세요.');
                return;
            }
            var arr = getMasterArray(key);
            if (arr.some(function (m) { return m.name === name; })) {
                alert('이미 등록된 항목입니다.');
                return;
            }
            arr.push({ name: name, active: true });
            input.value = '';
            renderOneMasterTable(key);
            refreshCategoryFilterOptionsAll();
            if (document.getElementById('panelBody') && currentEditItem) {
                renderPanelContent(currentEditItem);
            }
            upsertCategoryMastersToServer().then(function (remote) {
                if (!remote.ok) alert(remote.error || '분류 마스터 서버 저장 실패');
            });
        }

        function toggleMasterActive(key, name) {
            var arr = getMasterArray(key);
            var m = arr.find(function (x) { return x.name === name; });
            if (!m) return;
            m.active = !m.active;
            renderOneMasterTable(key);
            refreshCategoryFilterOptionsAll();
            if (document.getElementById('panelBody') && currentEditItem) {
                renderPanelContent(currentEditItem);
            }
            upsertCategoryMastersToServer().then(function (remote) {
                if (!remote.ok) alert(remote.error || '분류 마스터 서버 저장 실패');
            });
        }

        function removeMasterItem(key, name) {
            var field = getFieldForMasterKey(key);
            var used = estimates.some(function (e) { return (e[field] || '').trim() === name; });
            if (used) {
                alert('프로젝트에서 사용 중인 항목은 삭제할 수 없습니다.');
                return;
            }
            if (!confirm('「' + name + '」을(를) 삭제하시겠습니까?\n삭제 후에는 복구되지 않습니다.')) return;
            var arr = getMasterArray(key);
            var idx = arr.findIndex(function (x) { return x.name === name; });
            if (idx !== -1) arr.splice(idx, 1);
            renderOneMasterTable(key);
            refreshCategoryFilterOptionsAll();
            if (document.getElementById('panelBody') && currentEditItem) {
                renderPanelContent(currentEditItem);
            }
            upsertCategoryMastersToServer().then(function (remote) {
                if (!remote.ok) alert(remote.error || '분류 마스터 서버 저장 실패');
            });
        }

        function refreshCategory1FilterOptions() {
            var sel = document.getElementById('filterCategory1');
            if (!sel) return;
            var prev = sel.value;
            var names = category1Master.filter(function (m) { return m.active; }).map(function (m) { return m.name; });
            names.sort(function (a, b) { return a.localeCompare(b, 'ko'); });
            sel.innerHTML = '';
            var optAll = document.createElement('option');
            optAll.value = '';
            optAll.textContent = '전체';
            sel.appendChild(optAll);
            names.forEach(function (v) {
                var o = document.createElement('option');
                o.value = v;
                o.textContent = v;
                sel.appendChild(o);
            });
            if (prev && Array.prototype.some.call(sel.options, function (opt) { return opt.value === prev; })) sel.value = prev;
            else sel.value = '';
        }

        // 중분류 필터: 마스터 활성 목록
        function refreshCategory2FilterOptions() {
            var sel = document.getElementById('filterCategory2');
            if (!sel) return;
            var prev = sel.value;
            var names = category2Master.filter(function (m) { return m.active; }).map(function (m) { return m.name; });
            names.sort(function (a, b) { return a.localeCompare(b, 'ko'); });
            sel.innerHTML = '';
            var optAll = document.createElement('option');
            optAll.value = '';
            optAll.textContent = '전체';
            sel.appendChild(optAll);
            names.forEach(function (v) {
                var o = document.createElement('option');
                o.value = v;
                o.textContent = v;
                sel.appendChild(o);
            });
            if (prev && Array.prototype.some.call(sel.options, function (opt) { return opt.value === prev; })) sel.value = prev;
            else sel.value = '';
        }

        function refreshCategory3FilterOptions() {
            var sel = document.getElementById('filterCategory3');
            if (!sel) return;
            var prev = sel.value;
            var names = category3Master.filter(function (m) { return m.active; }).map(function (m) { return m.name; });
            names.sort(function (a, b) { return a.localeCompare(b, 'ko'); });
            sel.innerHTML = '';
            var optAll = document.createElement('option');
            optAll.value = '';
            optAll.textContent = '전체';
            sel.appendChild(optAll);
            names.forEach(function (v) {
                var o = document.createElement('option');
                o.value = v;
                o.textContent = v;
                sel.appendChild(o);
            });
            if (prev && Array.prototype.some.call(sel.options, function (opt) { return opt.value === prev; })) sel.value = prev;
            else sel.value = '';
        }

        function refreshCategoryFilterOptionsAll() {
            refreshCategory1FilterOptions();
            refreshCategory2FilterOptions();
            refreshCategory3FilterOptions();
        }

        let currentStatus = 'all';
        let estimateListPage = 1;
        const ESTIMATE_PAGE_SIZE = 10;

        // 컬러 바 색상 결정 (수금상태 기준)
        function getColorBarClass(item) {
            if (item.paidStatus === '전액') return 'paid';
            if (item.paidStatus === '미수') return 'unpaid';
            if (item.paidStatus === '부분') return 'partial';
            return 'na';
        }

        // 컬러 바 툴팁 생성
        function getColorBarTooltip(item) {
            const statusText = {
                '전액': '수금 완료',
                '미수': '미수금 있음',
                '부분': '일부 수금',
                '해당없음': '수금 해당없음'
            }[item.paidStatus] || '정보없음';

            return `<div class="tooltip-line">💰 수금상태: ${statusText}</div>`;
        }

        function pad2(n) {
            return String(n).padStart(2, '0');
        }

        function lastDayOfMonth(y, m) {
            return new Date(y, m, 0).getDate();
        }

        function getEstimateFilterDateRange() {
            const preset = document.getElementById('filterDatePreset') ? document.getElementById('filterDatePreset').value : 'all';
            if (preset === 'all') return null;
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            if (preset === 'thisMonth') {
                const ld = lastDayOfMonth(y, m);
                return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(ld)}` };
            }
            if (preset === 'lastMonth') {
                const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const y2 = d.getFullYear();
                const m2 = d.getMonth() + 1;
                const ld = lastDayOfMonth(y2, m2);
                return { from: `${y2}-${pad2(m2)}-01`, to: `${y2}-${pad2(m2)}-${pad2(ld)}` };
            }
            if (preset === 'byMonth') {
                const mv = document.getElementById('filterByMonth') ? document.getElementById('filterByMonth').value : '';
                if (!mv) return null;
                const parts = mv.split('-').map(Number);
                const yy = parts[0];
                const mm = parts[1];
                const ld = lastDayOfMonth(yy, mm);
                return { from: `${mv}-01`, to: `${mv}-${pad2(ld)}` };
            }
            if (preset === 'range') {
                const a = document.getElementById('filterDateFrom') ? document.getElementById('filterDateFrom').value : '';
                const b = document.getElementById('filterDateTo') ? document.getElementById('filterDateTo').value : '';
                if (!a || !b) return null;
                return a <= b ? { from: a, to: b } : { from: b, to: a };
            }
            return null;
        }

        function itemMatchesEstimateDateFilter(item) {
            const basisEl = document.getElementById('filterDateBasis');
            const basis = basisEl ? basisEl.value : 'date';
            const range = getEstimateFilterDateRange();

            if (basis === 'start') {
                const d = item.startDate ? String(item.startDate).trim().slice(0, 10) : '';
                if (!d) return false;
                if (!range) return true;
                return d >= range.from && d <= range.to;
            }
            if (basis === 'end') {
                const d = item.endDate ? String(item.endDate).trim().slice(0, 10) : '';
                if (!d) return false;
                if (!range) return true;
                return d >= range.from && d <= range.to;
            }
            if (basis === 'sales') {
                const raw = (item.salesDates && item.salesDates.length) ? item.salesDates : (item.date ? [item.date] : []);
                const dates = raw.map(function (x) { return String(x).trim().slice(0, 10); }).filter(Boolean);
                if (!range) return true;
                if (!dates.length) return false;
                return dates.some(function (d) { return d >= range.from && d <= range.to; });
            }
            const d = item.date ? String(item.date).trim().slice(0, 10) : '';
            if (!range) return true;
            if (!d) return false;
            return d >= range.from && d <= range.to;
        }

        /** 필터 기준(등록일·매출일자·진행일·완료일)에 맞춰 정렬 키. 매출일자는 가장 늦은 일자 기준. 날짜 없음은 맨 아래로 */
        function getEstimateSortKey(item) {
            const basisEl = document.getElementById('filterDateBasis');
            const basis = basisEl ? basisEl.value : 'date';
            const empty = '0000-01-01';
            if (basis === 'start') {
                const d = item.startDate ? String(item.startDate).trim().slice(0, 10) : '';
                return d || empty;
            }
            if (basis === 'end') {
                const d = item.endDate ? String(item.endDate).trim().slice(0, 10) : '';
                return d || empty;
            }
            if (basis === 'sales') {
                const raw = (item.salesDates && item.salesDates.length) ? item.salesDates : (item.date ? [item.date] : []);
                const dates = raw.map(function (x) { return String(x).trim().slice(0, 10); }).filter(Boolean);
                if (!dates.length) return empty;
                return dates.reduce(function (max, d) { return d > max ? d : max; }, dates[0]);
            }
            const d = item.date ? String(item.date).trim().slice(0, 10) : '';
            return d || empty;
        }

        function hideEstimateFilterPopoverPanels() {
            const m = document.getElementById('estimateFilterMonthWrap');
            const cr = document.getElementById('estimateFilterCustomRange');
            const tbtn = document.getElementById('toggleEstimateCustomRange');
            const dp = document.getElementById('estimateDatePickerPanel');
            if (m) m.style.display = 'none';
            if (cr) cr.style.display = 'none';
            if (tbtn) tbtn.setAttribute('aria-expanded', 'false');
            if (dp) dp.style.display = 'none';
        }

        function updateEstimateByMonthPresetButtonLabel() {
            const btn = document.querySelector('.estimate-filter-preset[data-preset="byMonth"]');
            const inp = document.getElementById('filterByMonth');
            if (!btn) return;
            const v = inp && inp.value ? inp.value.trim() : '';
            if (/^\d{4}-\d{2}$/.test(v)) {
                const p = v.split('-');
                btn.textContent = parseInt(p[0], 10) + '년 ' + parseInt(p[1], 10) + '월';
            } else {
                btn.textContent = '월 선택';
            }
        }

        function updateEstimateCustomRangeButtonLabel() {
            const btn = document.getElementById('toggleEstimateCustomRange');
            const from = document.getElementById('filterDateFrom');
            const to = document.getElementById('filterDateTo');
            if (!btn) return;
            const a = from && from.value ? from.value.trim() : '';
            const b = to && to.value ? to.value.trim() : '';
            if (a && b) btn.textContent = a + ' ~ ' + b;
            else btn.textContent = '기간 직접';
        }

        var customMonthPickerOnOpen = function () {};

        function initCustomMonthPicker() {
            var cmpY;
            var cmpM;
            var cmpYearPage0;

            function pad2(n) {
                return String(n).padStart(2, '0');
            }

            function readHidden() {
                const el = document.getElementById('filterByMonth');
                if (!el || !el.value) return null;
                const p = el.value.split('-');
                const y = parseInt(p[0], 10);
                const m = parseInt(p[1], 10);
                if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return null;
                return { y: y, m: m };
            }

            function writeHidden() {
                const el = document.getElementById('filterByMonth');
                if (el) el.value = cmpY + '-' + pad2(cmpM);
                updateEstimateByMonthPresetButtonLabel();
            }

            function syncFromHiddenOrToday() {
                const r = readHidden();
                const t = new Date();
                if (r) {
                    cmpY = r.y;
                    cmpM = r.m;
                } else {
                    cmpY = t.getFullYear();
                    cmpM = t.getMonth() + 1;
                }
                cmpYearPage0 = Math.floor(cmpY / 12) * 12;
            }

            function showMonthShell() {
                const mv = document.getElementById('cmpMonthView');
                const yv = document.getElementById('cmpYearView');
                if (mv) mv.hidden = false;
                if (yv) yv.hidden = true;
            }

            function showYearShell() {
                const yv = document.getElementById('cmpYearView');
                if (yv) yv.hidden = false;
            }

            function updateYearLabelBtn() {
                const b = document.getElementById('cmpYearOpenGrid');
                if (b) b.textContent = cmpY + '년';
            }

            function renderMonthGrid() {
                const g = document.getElementById('cmpMonthGrid');
                if (!g) return;
                g.innerHTML = '';
                const now = new Date();
                for (var mo = 1; mo <= 12; mo++) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'cmp-month-cell';
                    btn.setAttribute('data-m', String(mo));
                    btn.setAttribute('role', 'option');
                    btn.textContent = String(mo);
                    if (mo === cmpM) btn.classList.add('is-selected');
                    if (mo === now.getMonth() + 1 && cmpY === now.getFullYear()) btn.classList.add('is-today');
                    btn.addEventListener('click', function (ev) {
                        cmpM = parseInt(ev.currentTarget.getAttribute('data-m'), 10);
                        writeHidden();
                        renderMonthGrid();
                        renderTable();
                    });
                    g.appendChild(btn);
                }
            }

            function renderYearGrid() {
                const g = document.getElementById('cmpYearGrid');
                const lbl = document.getElementById('cmpYearPageLabel');
                if (!g) return;
                g.innerHTML = '';
                if (lbl) lbl.textContent = cmpYearPage0 + '–' + (cmpYearPage0 + 11);
                for (var i = 0; i < 12; i++) {
                    const y = cmpYearPage0 + i;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'cmp-year-cell';
                    btn.textContent = String(y);
                    if (y === cmpY) btn.classList.add('is-selected');
                    btn.addEventListener('click', function (ev) {
                        cmpY = parseInt(ev.currentTarget.textContent, 10);
                        cmpYearPage0 = Math.floor(cmpY / 12) * 12;
                        updateYearLabelBtn();
                        renderMonthGrid();
                        showMonthShell();
                        writeHidden();
                        renderTable();
                    });
                    g.appendChild(btn);
                }
            }

            customMonthPickerOnOpen = function () {
                syncFromHiddenOrToday();
                showMonthShell();
                updateYearLabelBtn();
                renderMonthGrid();
            };

            const yPrev = document.getElementById('cmpYearPrev');
            if (yPrev) yPrev.addEventListener('click', function () {
                cmpY--;
                cmpYearPage0 = Math.floor(cmpY / 12) * 12;
                updateYearLabelBtn();
                renderMonthGrid();
                writeHidden();
                renderTable();
            });
            const yNext = document.getElementById('cmpYearNext');
            if (yNext) yNext.addEventListener('click', function () {
                cmpY++;
                cmpYearPage0 = Math.floor(cmpY / 12) * 12;
                updateYearLabelBtn();
                renderMonthGrid();
                writeHidden();
                renderTable();
            });
            const yOpen = document.getElementById('cmpYearOpenGrid');
            if (yOpen) yOpen.addEventListener('click', function () {
                cmpYearPage0 = Math.floor(cmpY / 12) * 12;
                showYearShell();
                renderYearGrid();
            });
            const yPagePrev = document.getElementById('cmpYearPagePrev');
            if (yPagePrev) yPagePrev.addEventListener('click', function () {
                cmpYearPage0 -= 12;
                renderYearGrid();
            });
            const yPageNext = document.getElementById('cmpYearPageNext');
            if (yPageNext) yPageNext.addEventListener('click', function () {
                cmpYearPage0 += 12;
                renderYearGrid();
            });
            const backM = document.getElementById('cmpBackToMonths');
            if (backM) backM.addEventListener('click', function () {
                showMonthShell();
                updateYearLabelBtn();
                renderMonthGrid();
            });
            const clr = document.getElementById('cmpMonthClear');
            if (clr) clr.addEventListener('click', function () {
                const el = document.getElementById('filterByMonth');
                if (el) el.value = '';
                updateEstimateByMonthPresetButtonLabel();
                renderTable();
            });
            const thisM = document.getElementById('cmpMonthThis');
            if (thisM) thisM.addEventListener('click', function () {
                const t = new Date();
                cmpY = t.getFullYear();
                cmpM = t.getMonth() + 1;
                cmpYearPage0 = Math.floor(cmpY / 12) * 12;
                writeHidden();
                updateYearLabelBtn();
                renderMonthGrid();
                renderTable();
            });
            updateEstimateByMonthPresetButtonLabel();
        }

        function setEstimateDatePreset(preset) {
            const hidden = document.getElementById('filterDatePreset');
            if (hidden) hidden.value = preset;
            const dp = document.getElementById('estimateDatePickerPanel');
            if (dp) dp.style.display = 'none';
            const mb = document.getElementById('filterByMonth');
            const df = document.getElementById('filterDateFrom');
            const dt = document.getElementById('filterDateTo');
            if (preset === 'range') {
                if (mb) mb.value = '';
            } else if (preset === 'byMonth') {
                if (df) df.value = '';
                if (dt) dt.value = '';
            } else if (preset === 'all') {
                if (mb) mb.value = '';
                if (df) df.value = '';
                if (dt) dt.value = '';
            }
            updateEstimateByMonthPresetButtonLabel();
            updateEstimateCustomRangeButtonLabel();
            document.querySelectorAll('.estimate-filter-preset').forEach(function (btn) {
                if (preset === 'range') {
                    btn.classList.remove('active');
                } else {
                    btn.classList.toggle('active', btn.dataset.preset === preset);
                }
            });
            const monthWrap = document.getElementById('estimateFilterMonthWrap');
            if (monthWrap) {
                monthWrap.style.display = preset === 'byMonth' ? 'flex' : 'none';
                if (preset === 'byMonth') customMonthPickerOnOpen();
            }
            const cr = document.getElementById('estimateFilterCustomRange');
            const tbtnEl = document.getElementById('toggleEstimateCustomRange');
            if (preset === 'range') {
                if (cr) cr.style.display = 'flex';
                if (tbtnEl) tbtnEl.setAttribute('aria-expanded', 'true');
            } else {
                if (cr) cr.style.display = 'none';
                if (tbtnEl) tbtnEl.setAttribute('aria-expanded', 'false');
            }

            // 기간 직접 버튼도 "active"처럼 보이게(전체/월 선택과 동일한 파란 스타일)
            // 스타일은 CSS에서 aria-expanded 상태로 제어합니다.
        }

        function toggleEstimateCustomRange(ev) {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            const cr = document.getElementById('estimateFilterCustomRange');
            const tbtn = document.getElementById('toggleEstimateCustomRange');
            const hidden = document.getElementById('filterDatePreset');
            if (!cr || !hidden) return;
            const currentPreset = hidden.value;
            const panelOpen = window.getComputedStyle(cr).display !== 'none';
            if (currentPreset === 'range' && panelOpen) {
                setEstimateDatePreset('all');
                renderTable();
                return;
            }
            if (currentPreset === 'range' && !panelOpen) {
                cr.style.display = 'flex';
                if (tbtn) tbtn.setAttribute('aria-expanded', 'true');
                return;
            }
            setEstimateDatePreset('range');
            renderTable();
        }

        function toggleEstimateAdvancedFilters() {
            const adv = document.getElementById('estimateAdvancedFilters');
            const tbtn = document.getElementById('toggleEstimateAdvancedFilters');
            if (!adv || !tbtn) return;
            const hidden = adv.hasAttribute('hidden');
            if (hidden) adv.removeAttribute('hidden');
            else adv.setAttribute('hidden', '');
            tbtn.setAttribute('aria-expanded', hidden ? 'true' : 'false');
        }

        function initCustomDatePicker() {
            const panel = document.getElementById('estimateDatePickerPanel');
            const fromHidden = document.getElementById('filterDateFrom');
            const toHidden = document.getElementById('filterDateTo');
            const fromBtn = document.getElementById('filterDateFromBtn');
            const toBtn = document.getElementById('filterDateToBtn');
            if (!panel || !fromHidden || !toHidden || !fromBtn || !toBtn) return;

            var state = {
                active: null, // 'from' | 'to'
                y: 0,
                m: 1,
                d: 1,
                yearPage0: 0,
                view: 'month' // 'month' | 'year'
            };

            function pad2(n) { return String(n).padStart(2, '0'); }
            function formatYMD(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
            function parseYMD(v) {
                if (!v || typeof v !== 'string') return null;
                const s = v.trim();
                if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
                const parts = s.split('-').map(Number);
                if (parts.length !== 3) return null;
                return { y: parts[0], m: parts[1], d: parts[2] };
            }

            function getActiveHidden() {
                return state.active === 'from' ? fromHidden : toHidden;
            }

            function getActiveBtn() {
                return state.active === 'from' ? fromBtn : toBtn;
            }

            function updateDisplayButtons() {
                const vFrom = fromHidden.value ? fromHidden.value : '';
                const vTo = toHidden.value ? toHidden.value : '';
                fromBtn.textContent = vFrom ? vFrom : '날짜 선택';
                toBtn.textContent = vTo ? vTo : '날짜 선택';
            }

            function positionPanel(anchorEl) {
                const r = anchorEl.getBoundingClientRect();
                // 성능실적관리 기간 패널은 "버튼 아래" 기준으로 배치하기 위해
                // fixed 대신 absolute로 배치(스크롤 보정 포함)
                panel.style.position = 'absolute';
                panel.style.top = (r.bottom + 8 + window.scrollY) + 'px';
                const w = panel.offsetWidth || 320;
                const margin = 8;
                const leftCandidate = r.left + window.scrollX;
                const maxLeft = window.scrollX + window.innerWidth - w - margin;
                const left = Math.min(Math.max(leftCandidate, margin + window.scrollX), maxLeft);
                panel.style.left = left + 'px';
            }

            function syncStateFromActive() {
                const parsed = parseYMD(getActiveHidden().value);
                const t = new Date();
                if (parsed) {
                    state.y = parsed.y;
                    state.m = parsed.m;
                    state.d = parsed.d;
                } else {
                    state.y = t.getFullYear();
                    state.m = t.getMonth() + 1;
                    state.d = t.getDate();
                }
                state.yearPage0 = Math.floor(state.y / 12) * 12;
            }

            function renderMonthView() {
                panel.innerHTML = '';
                updateDisplayButtons();

                const now = new Date();
                const todayY = now.getFullYear();
                const todayM = now.getMonth() + 1;
                const todayD = now.getDate();

                const first = new Date(state.y, state.m - 1, 1);
                const startDow = first.getDay(); // 0..6 (일..토)
                const daysInMonth = new Date(state.y, state.m, 0).getDate();
                const daysInPrev = new Date(state.y, state.m - 2, 0).getDate();

                var cells = [];
                for (var idx = 0; idx < 42; idx++) {
                    const offset = idx - startDow + 1;
                    var y = state.y, m = state.m, d = 0;
                    var out = false;
                    if (offset < 1) {
                        out = true;
                        y = state.y;
                        m = state.m - 1;
                        if (m < 1) { m = 12; y -= 1; }
                        d = daysInPrev + offset;
                    } else if (offset > daysInMonth) {
                        out = true;
                        y = state.y;
                        m = state.m + 1;
                        if (m > 12) { m = 1; y += 1; }
                        d = offset - daysInMonth;
                    } else {
                        d = offset;
                    }
                    const ymd = formatYMD(y, m, d);
                    const isSelected = (y === state.y && m === state.m && d === state.d);
                    const isToday = (y === todayY && m === todayM && d === todayD);
                    cells.push({ y, m, d, ymd, out, isSelected, isToday });
                }

                var weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                var daysHtml = cells.map(function (c) {
                    var cls = 'estimate-date-picker-day-btn';
                    if (c.out) cls += ' is-out';
                    if (c.isSelected) cls += ' is-selected';
                    if (c.isToday) cls += ' is-today';
                    return '<button type="button" class="' + cls + '" data-ymd="' + c.ymd + '">' + c.d + '</button>';
                }).join('');

                var viewHtml = '\
<div class="estimate-date-picker-shell" id="estimateDatePickerShell">\
  <div class="estimate-date-picker-header">\
    <div class="estimate-date-picker-year-nav">\
      <button type="button" class="estimate-date-picker-icon-btn" id="cmpDateYearPrev" aria-label="이전 연도">‹</button>\
      <button type="button" class="estimate-date-picker-year-label-btn" id="cmpDateYearLabel" aria-label="연도 선택">\
        ' + state.y + '년\
      </button>\
      <button type="button" class="estimate-date-picker-icon-btn" id="cmpDateYearNext" aria-label="다음 연도">›</button>\
    </div>\
    <div class="estimate-date-picker-month-nav">\
      <button type="button" class="estimate-date-picker-icon-btn" id="cmpDateMonthPrev" aria-label="이전 달">‹</button>\
      <span class="estimate-date-picker-month-label">' + state.m + '월</span>\
      <button type="button" class="estimate-date-picker-icon-btn" id="cmpDateMonthNext" aria-label="다음 달">›</button>\
    </div>\
  </div>\
  <div class="estimate-date-picker-weekdays">\
    ' + weekdays.map(function (w) { return '<div class="estimate-date-picker-weekday">' + w + '</div>'; }).join('') + '\
  </div>\
  <div class="estimate-date-picker-days">' + daysHtml + '</div>\
  <div class="estimate-date-picker-footer">\
    <button type="button" class="estimate-date-picker-text-btn" id="cmpDateClear">지우기</button>\
    <button type="button" class="estimate-date-picker-text-btn" id="cmpDateToday">오늘</button>\
  </div>\
</div>';

                panel.innerHTML = viewHtml;
            }

            function renderYearView() {
                panel.innerHTML = '';
                updateDisplayButtons();

                var grid = '';
                var pageLabel = state.yearPage0 + '–' + (state.yearPage0 + 11);
                for (var i = 0; i < 12; i++) {
                    var y = state.yearPage0 + i;
                    var cls = 'estimate-date-picker-year-cell';
                    if (y === state.y) cls += ' is-selected';
                    grid += '<button type="button" class="' + cls + '" data-year="' + y + '">' + y + '</button>';
                }

                var viewHtml = '\
<div class="estimate-date-picker-shell" id="estimateDatePickerShell">\
  <div class="estimate-date-picker-header">\
    <div class="estimate-date-picker-year-nav">\
      <button type="button" class="estimate-date-picker-icon-btn" id="cmpDateYearPagePrev" aria-label="연도 구간 이전">‹</button>\
      <span class="estimate-date-picker-month-label">' + pageLabel + '</span>\
      <button type="button" class="estimate-date-picker-icon-btn" id="cmpDateYearPageNext" aria-label="연도 구간 다음">›</button>\
    </div>\
  </div>\
  <div class="estimate-date-picker-year-grid">' + grid + '</div>\
  <div class="estimate-date-picker-footer">\
    <button type="button" class="estimate-date-picker-text-btn" id="cmpDateBackToMonths">닫기</button>\
    <button type="button" class="estimate-date-picker-text-btn" id="cmpDateToday">오늘</button>\
  </div>\
</div>';

                panel.innerHTML = viewHtml;
            }

            function render() {
                if (state.view === 'year') renderYearView();
                else renderMonthView();
            }

            function open(which, anchorEl) {
                state.active = which;
                syncStateFromActive();
                state.view = 'month';
                render();
                positionPanel(anchorEl);
                panel.style.display = 'block';
            }

            function hide() {
                panel.style.display = 'none';
            }

            function writeSelectedDate(ymd) {
                const hidden = getActiveHidden();
                hidden.value = ymd;
                const parsed = parseYMD(ymd);
                if (parsed) {
                    state.y = parsed.y;
                    state.m = parsed.m;
                    state.d = parsed.d;
                }
                updateDisplayButtons();
                updateEstimateCustomRangeButtonLabel();
                hide();
                const rangeWrap = document.getElementById('estimateFilterCustomRange');
                const rangeBtn = document.getElementById('toggleEstimateCustomRange');
                if (fromHidden.value && toHidden.value) {
                    if (rangeWrap) rangeWrap.style.display = 'none';
                    if (rangeBtn) rangeBtn.setAttribute('aria-expanded', 'false');
                }
                renderTable();
            }

            if (!panel.dataset.hasDatePickerListeners) {
                panel.dataset.hasDatePickerListeners = '1';
                panel.addEventListener('mousedown', function (e) {
                    e.stopPropagation();
                });
                panel.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const btn = e.target && e.target.closest ? e.target.closest('button') : null;
                    if (!btn) return;
                    if (btn.id === 'cmpDateYearPrev') {
                        state.y -= 1;
                        state.yearPage0 = Math.floor(state.y / 12) * 12;
                        render();
                        return;
                    }
                    if (btn.id === 'cmpDateYearNext') {
                        state.y += 1;
                        state.yearPage0 = Math.floor(state.y / 12) * 12;
                        render();
                        return;
                    }
                    if (btn.id === 'cmpDateYearLabel') {
                        state.yearPage0 = Math.floor(state.y / 12) * 12;
                        state.view = 'year';
                        render();
                        return;
                    }
                    if (btn.id === 'cmpDateMonthPrev') {
                        state.m -= 1;
                        if (state.m < 1) { state.m = 12; state.y -= 1; }
                        state.yearPage0 = Math.floor(state.y / 12) * 12;
                        render();
                        return;
                    }
                    if (btn.id === 'cmpDateMonthNext') {
                        state.m += 1;
                        if (state.m > 12) { state.m = 1; state.y += 1; }
                        state.yearPage0 = Math.floor(state.y / 12) * 12;
                        render();
                        return;
                    }
                    if (btn.id === 'cmpDateYearPagePrev') {
                        state.yearPage0 -= 12;
                        renderYearView();
                        return;
                    }
                    if (btn.id === 'cmpDateYearPageNext') {
                        state.yearPage0 += 12;
                        renderYearView();
                        return;
                    }
                    if (btn.id === 'cmpDateBackToMonths') {
                        state.view = 'month';
                        render();
                        return;
                    }
                    if (btn.id === 'cmpDateClear') {
                        const hidden = getActiveHidden();
                        hidden.value = '';
                        updateDisplayButtons();
                        updateEstimateCustomRangeButtonLabel();
                        hide();
                        renderTable();
                        return;
                    }
                    if (btn.id === 'cmpDateToday') {
                        const t0 = new Date();
                        const ymd = formatYMD(t0.getFullYear(), t0.getMonth() + 1, t0.getDate());
                        writeSelectedDate(ymd);
                        return;
                    }
                    if (btn.classList.contains('estimate-date-picker-day-btn')) {
                        const ymd = btn.getAttribute('data-ymd');
                        if (ymd) writeSelectedDate(ymd);
                        return;
                    }
                    if (btn.classList.contains('estimate-date-picker-year-cell')) {
                        const y = parseInt(btn.getAttribute('data-year'), 10);
                        if (!isNaN(y)) {
                            state.y = y;
                            state.yearPage0 = Math.floor(state.y / 12) * 12;
                            state.view = 'month';
                            render();
                        }
                        return;
                    }
                });
            }

            fromBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                open('from', e.currentTarget);
            });
            toBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                open('to', e.currentTarget);
            });
            updateDisplayButtons();
            updateEstimateCustomRangeButtonLabel();
        }

        function initEstimateListFilters() {
            document.querySelectorAll('.estimate-filter-preset').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const p = btn.dataset.preset;
                    if (!p) return;
                    const hidden = document.getElementById('filterDatePreset');
                    const current = hidden ? hidden.value : 'all';
                    const monthPanel = document.getElementById('estimateFilterMonthWrap');

                    if (p === 'byMonth') {
                        const panelOpen = monthPanel && window.getComputedStyle(monthPanel).display !== 'none';
                        if (current === 'byMonth' && panelOpen) {
                            const mbOff = document.getElementById('filterByMonth');
                            if (mbOff) mbOff.value = '';
                            updateEstimateByMonthPresetButtonLabel();
                            setEstimateDatePreset('all');
                            renderTable();
                            return;
                        }
                        if (current === 'byMonth' && !panelOpen) {
                            if (monthPanel) monthPanel.style.display = 'flex';
                            customMonthPickerOnOpen();
                            return;
                        }
                        setEstimateDatePreset('byMonth');
                        renderTable();
                        return;
                    }

                    setEstimateDatePreset(p);
                    renderTable();
                });
            });
            document.addEventListener('click', function (e) {
                if (e.target.closest('.estimate-filter-popover-anchor')) return;
                if (e.target.closest('#estimateDatePickerPanel')) return;
                hideEstimateFilterPopoverPanels();
            });
            initCustomMonthPicker();
            initCustomDatePicker();
            updateEstimateByMonthPresetButtonLabel();
            updateEstimateCustomRangeButtonLabel();
            const basis = document.getElementById('filterDateBasis');
            if (basis) basis.addEventListener('change', renderTable);
            const df = document.getElementById('filterDateFrom');
            const dt = document.getElementById('filterDateTo');
            if (df) df.addEventListener('change', renderTable);
            if (dt) dt.addEventListener('change', renderTable);
            const tcr = document.getElementById('toggleEstimateCustomRange');
            if (tcr) tcr.addEventListener('click', toggleEstimateCustomRange);

            // 필터 초기화
            const resetBtn = document.getElementById('filterResetBtn');
            if (resetBtn) {
                resetBtn.addEventListener('click', function () {
                    // 상태 탭
                    currentStatus = 'all';
                    document.querySelectorAll('.tab').forEach(function (t) {
                        t.classList.toggle('active', t.dataset.status === 'all');
                    });

                    // 기간
                    setEstimateDatePreset('all');

                    // 날짜 기준
                    const basis = document.getElementById('filterDateBasis');
                    if (basis) basis.value = 'date';

                    // 분류/세금/입금/검색
                    const c1 = document.getElementById('filterCategory1');
                    const c2 = document.getElementById('filterCategory2');
                    const c3 = document.getElementById('filterCategory3');
                    if (c1) c1.value = '';
                    if (c2) c2.value = '';
                    if (c3) c3.value = '';

                    const tax = document.getElementById('filterTax');
                    if (tax) tax.value = '';

                    const cf = document.getElementById('filterCashflow');
                    if (cf) cf.value = '';

                    const fs = document.getElementById('filterSearch');
                    if (fs) fs.value = '';

                    renderTable();
                });
            }

            const searchBtn = document.getElementById('filterSearchBtn');
            if (searchBtn) searchBtn.addEventListener('click', renderTable);
            const fs = document.getElementById('filterSearch');
            if (fs) {
                fs.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        renderTable();
                    }
                });
            }
        }

        function goEstimatePage(p) {
            if (p < 1) return;
            estimateListPage = p;
            renderTable({ preservePage: true });
        }

        function estimatePaginationNumberButtonsHtml(totalPages) {
            const cur = estimateListPage;
            const n = totalPages;

            function btn(page, isActive) {
                if (isActive) {
                    return '<button type="button" class="btn btn-sm estimate-page-num estimate-page-num--active" aria-current="page">' + page + '</button>';
                }
                return '<button type="button" class="btn btn-secondary btn-sm estimate-page-num" onclick="goEstimatePage(' + page + ')">' + page + '</button>';
            }

            if (n <= 20) {
                let h = '';
                for (let i = 1; i <= n; i++) h += btn(i, i === cur);
                return h;
            }

            const set = new Set();
            set.add(1);
            set.add(n);
            for (let j = Math.max(2, cur - 2); j <= Math.min(n - 1, cur + 2); j++) set.add(j);
            if (cur <= 5) {
                for (let k = 2; k <= Math.min(6, n - 1); k++) set.add(k);
            }
            if (cur >= n - 4) {
                for (let k = Math.max(2, n - 5); k <= n - 1; k++) set.add(k);
            }

            const sorted = Array.from(set).sort(function (a, b) { return a - b; });
            let html = '';
            for (let x = 0; x < sorted.length; x++) {
                if (x > 0 && sorted[x] - sorted[x - 1] > 1) {
                    html += '<span class="estimate-page-ellipsis" aria-hidden="true">…</span>';
                }
                html += btn(sorted[x], sorted[x] === cur);
            }
            return html;
        }

        function updateEstimatePaginationUI(totalItems, totalPages) {
            const wrap = document.getElementById('estimateTablePagination');
            const info = document.getElementById('estimatePaginationInfo');
            const ctrl = document.getElementById('estimatePaginationControls');
            if (!wrap || !info || !ctrl) return;
            if (totalItems === 0) {
                wrap.style.display = 'none';
                return;
            }
            wrap.style.display = '';
            const start = (estimateListPage - 1) * ESTIMATE_PAGE_SIZE + 1;
            const end = Math.min(estimateListPage * ESTIMATE_PAGE_SIZE, totalItems);
            info.textContent = start + '–' + end + ' / ' + totalItems + '건';
            ctrl.innerHTML = estimatePaginationNumberButtonsHtml(totalPages);
        }

        // 테이블 렌더링
        function renderTable(options) {
            var preservePage = options && options.preservePage === true;
            if (!preservePage) estimateListPage = 1;
            refreshCategoryFilterOptionsAll();
            const tbody = document.getElementById('tableBody');
            const canSeeMonetary = canCurrentUserSeeEstimateMonetary();
            const filterCategory1 = document.getElementById('filterCategory1').value;
            const filterCategory2 = document.getElementById('filterCategory2').value;
            const filterCategory3 = document.getElementById('filterCategory3').value;
            const filterTax = document.getElementById('filterTax').value;
            const filterCashflow = document.getElementById('filterCashflow')?.value || '';
            const filterSearch = document.getElementById('filterSearch').value.toLowerCase();

            let filtered = estimates.filter(item => {
                if (!canCurrentUserAccessEstimateItem(item)) return false;
                if (currentStatus !== 'all' && item.status !== currentStatus) return false;
                if (!itemMatchesEstimateDateFilter(item)) return false;
                if (filterCategory1 && item.category1 !== filterCategory1) return false;
                if (filterCategory2 && item.category2 !== filterCategory2) return false;
                if (filterCategory3 && (item.category3 || '') !== filterCategory3) return false;
                
                // 세금계산서 필터
                if (filterTax) {
                    if (filterTax === '발행완료' && !item.taxIssued) return false;
                    if (filterTax === '미발행' && (item.taxIssued || item.type !== '세금계산서')) return false;
                }

                // 입금상태 필터 (수금/이체/차인지급 모두 완료여부로 판단)
                if (filterCashflow) {
                    const salesGross = item.aggregateSalesGross != null ? item.aggregateSalesGross : (item.revenue || 0);
                    const purchaseGross = item.aggregatePurchaseGross != null ? item.aggregatePurchaseGross : (item.purchase || 0);
                    const pay = item.aggregatePaymentGross != null ? item.aggregatePaymentGross : 0;
                    const transfer = item.aggregateTransferGross != null ? item.aggregateTransferGross : 0;
                    const biz = computeBizTaxFromGross(item.businessIncomeGross);

                    // renderCashflowTripleCell()과 동일하게 "정확히 동일(===)" 기준으로 완료 판정
                    const payDone = salesGross <= 0 ? true : pay === salesGross;
                    const xferDone = purchaseGross <= 0 ? true : transfer === purchaseGross;
                    const netDone = biz.gross <= 0 ? true : item.businessIncomePaidStatus === '지급';

                    const cashflowAllDone = payDone && xferDone && netDone;

                    if (filterCashflow === '입금완료' && !cashflowAllDone) return false;
                    if (filterCashflow === '미입금' && cashflowAllDone) return false;
                }
                
                if (filterSearch) {
                    const searchText = `${item.code || ''} ${item.building} ${item.project} ${item.manager} ${item.contractor || ''} ${item.category3 || ''}`.toLowerCase();
                    if (!searchText.includes(filterSearch)) return false;
                }
                return true;
            });

            filtered.sort(function (a, b) {
                const ka = getEstimateSortKey(a);
                const kb = getEstimateSortKey(b);
                return kb.localeCompare(ka);
            });

            var totalItems = filtered.length;
            var totalPages = Math.max(1, Math.ceil(totalItems / ESTIMATE_PAGE_SIZE));
            if (estimateListPage > totalPages) estimateListPage = totalPages;
            if (estimateListPage < 1) estimateListPage = 1;
            var sliceStart = (estimateListPage - 1) * ESTIMATE_PAGE_SIZE;
            var pageRows = filtered.slice(sliceStart, sliceStart + ESTIMATE_PAGE_SIZE);

            tbody.innerHTML = pageRows.map(item => {
                const statusBadgeClass = {
                    '견적': 'badge-estimate',
                    '진행': 'badge-progress',
                    '완료': 'badge-complete',
                    '보류': 'badge-hold'
                }[item.status];

                const purchaseAmount = Number(item.purchase || 0);
                const salesAmountChipClass = projectSalesPurchaseChipClass(false, item, purchaseAmount);
                const purchaseAmountChipClass = projectSalesPurchaseChipClass(true, item, purchaseAmount);
                const revenueCellHtml = canSeeMonetary
                    ? `<span class="table-amount-chip ${salesAmountChipClass}">${item.revenue.toLocaleString()}원</span>`
                    : `<span class="table-amount-dash">-</span>`;
                const cashflowCellHtml = canSeeMonetary ? renderCashflowTripleCell(item) : '<span class="table-amount-dash">-</span>';
                const codeJs = JSON.stringify(String(item.code != null ? item.code : ''));
                const statusCellHtml = canSeeMonetary
                    ? `<button type="button" class="badge ${statusBadgeClass} status-popover-trigger" onclick="openStatusPopover(event, ${codeJs})">${item.status}</button>`
                    : `<span class="badge ${statusBadgeClass}">${item.status}</span>`;

                return `
                    <tr class="table-row-clickable" data-code="${escapeHtmlAttr(String(item.code != null ? item.code : ''))}">
                        <td onclick="event.stopPropagation()">
                            ${statusCellHtml}
                        </td>
                        <td>${item.category1}</td>
                        <td>${item.category2}</td>
                        <td>${item.category3 || '-'}</td>
                        <td>${item.building}</td>
                        <td>${item.project}</td>
                        <td>
                            <div class="table-amount-pair">
                                ${revenueCellHtml}
                                <span class="table-amount-slash">/</span>
                                <span class="table-amount-chip ${purchaseAmountChipClass}">${purchaseAmount.toLocaleString()}원</span>
                            </div>
                        </td>
                        <td>${cashflowCellHtml}</td>
                        <td>${item.contractor || '-'}</td>
                    </tr>
                `;
            }).join('');

            updateEstimatePaginationUI(totalItems, totalPages);

            // 요약 업데이트
            const totalCount = filtered.length;
            const totalAmount = canSeeMonetary ? filtered.reduce((sum, item) => sum + item.revenue, 0) : 0;
            const elTotalCount = document.getElementById('totalCount');
            if (elTotalCount) elTotalCount.textContent = `${totalCount}건`;
            const elTotalAmount = document.getElementById('totalAmount');
            if (elTotalAmount) elTotalAmount.textContent = canSeeMonetary ? `${totalAmount.toLocaleString()}원` : '-';
        }

        // 탭 클릭 (프로젝트 관리 상태 탭만 — 다른 페이지 .tab 과 분리)
        document.querySelectorAll('#page-estimate .tabs-left .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#page-estimate .tabs-left .tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentStatus = tab.dataset.status;
                renderTable();
            });
        });

        // 프로젝트 목록 행 클릭 → 상세 슬라이드 (인라인 onclick 대신 위임: ESM/CSP 환경에서 안정적)
        document.addEventListener('click', function (e) {
            const tb = document.getElementById('tableBody');
            if (!tb) return;
            const tr = e.target && e.target.closest && e.target.closest('tr.table-row-clickable[data-code]');
            if (!tr || !tb.contains(tr)) return;
            if (e.target.closest('.status-popover-trigger') || e.target.closest('.status-popover-root')) return;
            const code = tr.getAttribute('data-code');
            if (code != null && code !== '') openPanel(code);
        });

        // 경비 목록 행 클릭 → 상세 슬라이드 (window.openExpenseDetailPanel 불필요)
        document.addEventListener('click', function (e) {
            const tb = document.getElementById('expenseTableBody');
            if (!tb || !e.target || !tb.contains(e.target)) return;
            const fileEl = e.target.closest('.expense-row-file-link');
            if (fileEl && tb.contains(fileEl)) {
                e.preventDefault();
                var fid = parseInt(fileEl.getAttribute('data-expense-id'), 10);
                if (Number.isFinite(fid)) viewExpenseImage(fid, 0);
                return;
            }
            const tr = e.target.closest('tr.table-row-clickable[data-expense-id]');
            if (!tr || !tb.contains(tr)) return;
            var eid = parseInt(tr.getAttribute('data-expense-id'), 10);
            if (Number.isFinite(eid)) openExpenseDetailPanel(eid);
        });

        // 필터 변경
        document.getElementById('filterCategory1').addEventListener('change', renderTable);
        document.getElementById('filterCategory2').addEventListener('change', renderTable);
        document.getElementById('filterCategory3').addEventListener('change', renderTable);
        document.getElementById('filterTax').addEventListener('change', renderTable);
        const fc = document.getElementById('filterCashflow');
        if (fc) fc.addEventListener('change', renderTable);
        document.getElementById('filterSearch').addEventListener('input', renderTable);

        initEstimateListFilters();

        // 초기 렌더링
        renderTable();
        renderCategoryMasterTables();

        // ========================================
        // 업체정보관리 JavaScript
        // ========================================
        
        // 업체 데이터
        let contractors = [];

        let contractorEditingId = null;

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function findContractorByName(name) {
            const key = String(name || '').trim();
            if (!key) return null;
            return contractors.find(function(c) { return String(c.name || '').trim() === key; }) || null;
        }

        function validateContractorSelectionById(inputId) {
            const input = document.getElementById(inputId);
            if (!input) return { ok: true, value: '' };
            const value = String(input.value || '').trim();
            if (!value) {
                alert('도급사를 선택해주세요.');
                input.focus();
                return { ok: false, value: '' };
            }
            if (!findContractorByName(value)) {
                alert('도급사는 업체정보관리에 등록된 업체만 선택할 수 있습니다.');
                input.focus();
                return { ok: false, value: '' };
            }
            return { ok: true, value: value };
        }

        function getContractorSelectOptionsHtml(selectedName) {
            const selected = String(selectedName || '').trim();
            const names = contractors.map(function(c) { return String(c.name || '').trim(); }).filter(Boolean);
            const hasSelected = selected && names.includes(selected);
            let html = '<option value="">도급사 선택</option>';
            names.forEach(function(name) {
                html += '<option value="' + escapeHtml(name) + '" ' + (name === selected ? 'selected' : '') + '>' + escapeHtml(name) + '</option>';
            });
            if (selected && !hasSelected) {
                html += '<option value="' + escapeHtml(selected) + '" selected>' + escapeHtml(selected) + ' (미등록)</option>';
            }
            return html;
        }

        function getContractorDatalistOptionsHtml() {
            return contractors
                .map(function(c) { return String(c.name || '').trim(); })
                .filter(Boolean)
                .map(function(name) { return '<option value="' + escapeHtml(name) + '"></option>'; })
                .join('');
        }

        function getContractorDocsHtml(contractorName) {
            const contractor = findContractorByName(contractorName);
            if (!contractor) return '<span style="color: var(--gray-500);">업체정보관리에서 도급사를 선택하면 첨부서류를 볼 수 있습니다.</span>';
            const licenseHtml = contractor.hasLicense
                ? '<span class="file-link" onclick="viewContractorImage(\'license\', ' + contractor.id + ')" style="color: var(--primary); cursor: pointer;"><i class="fas fa-image"></i> 사업자등록증</span>'
                : '<span style="color: var(--gray-500);">사업자등록증 없음</span>';
            const bankHtml = contractor.hasBankAccount
                ? '<span class="file-link" onclick="viewContractorImage(\'bank\', ' + contractor.id + ')" style="color: var(--primary); cursor: pointer;"><i class="fas fa-image"></i> 통장사본</span>'
                : '<span style="color: var(--gray-500);">통장사본 없음</span>';
            return licenseHtml + '<span style="color: var(--gray-400); margin: 0 8px;">|</span>' + bankHtml;
        }

        function openContractorPanel() {
            document.getElementById('contractorPanelTitle').textContent = contractorEditingId ? '업체 수정' : '업체 등록';
            var delBtn = document.getElementById('contractorPanelDeleteBtn');
            if (delBtn) {
                if (contractorEditingId) {
                    delBtn.style.display = '';
                    delBtn.setAttribute('aria-hidden', 'false');
                    var eid = contractorEditingId;
                    delBtn.onclick = function () {
                        deleteContractor(eid);
                    };
                } else {
                    delBtn.style.display = 'none';
                    delBtn.setAttribute('aria-hidden', 'true');
                    delBtn.onclick = null;
                }
            }
            document.getElementById('contractorPanelOverlay').classList.add('active');
            document.getElementById('contractorSlidePanel').classList.add('active');
        }

        function closeContractorPanel() {
            document.getElementById('contractorPanelOverlay').classList.remove('active');
            document.getElementById('contractorSlidePanel').classList.remove('active');
            var delBtn = document.getElementById('contractorPanelDeleteBtn');
            if (delBtn) {
                delBtn.style.display = 'none';
                delBtn.setAttribute('aria-hidden', 'true');
                delBtn.onclick = null;
            }
            resetContractorForm();
        }

        // 파일명 업데이트
        function updateContractorFileName(inputId) {
            const input = document.getElementById(inputId);
            const nameSpan = document.getElementById(inputId + 'Name');
            
            if (input.files.length > 0) {
                nameSpan.textContent = input.files[0].name;
            } else {
                nameSpan.textContent = '선택한 파일 없음';
            }
        }

        // 테이블 렌더링
        function renderContractorTable() {
            const tbody = document.getElementById('contractorTableBody');
            
            if (contractors.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 40px; color: var(--gray-500);">
                            등록된 업체가 없습니다
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = contractors.map((item, index) => `
                <tr class="table-row-clickable" data-contractor-id="${item.id}" onclick="openContractorDetailPanel(${item.id})">
                    <td>${index + 1}</td>
                    <td style="font-weight: 600;">${item.name}</td>
                    <td>${item.phone || '-'}</td>
                    <td>${item.hasLicense ? `<span class="file-link" onclick="event.stopPropagation(); viewContractorImage('license', ${item.id})" style="color: var(--success); cursor: pointer;"><i class="fas fa-check-circle"></i> 있음</span>` : '<span style="color: var(--gray-400);">없음</span>'}</td>
                    <td>${item.hasBankAccount ? `<span class="file-link" onclick="event.stopPropagation(); viewContractorImage('bank', ${item.id})" style="color: var(--success); cursor: pointer;"><i class="fas fa-check-circle"></i> 있음</span>` : '<span style="color: var(--gray-400);">없음</span>'}</td>
                </tr>
            `).join('');
        }

        function downloadContractorCSV() {
            let csv = '\uFEFF';
            csv += '번호,업체명,전화번호,사업자등록증,통장사본\n';
            contractors.forEach(function (item, index) {
                csv += [
                    index + 1,
                    csvEscape(item.name || ''),
                    csvEscape(item.phone || ''),
                    csvEscape(item.hasLicense ? '있음' : '없음'),
                    csvEscape(item.hasBankAccount ? '있음' : '없음')
                ].join(',') + '\n';
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '업체정보_' + new Date().toISOString().slice(0, 10) + '.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function openContractorDetailPanel(id) {
            const contractor = contractors.find(c => c.id === id);
            if (!contractor) return;
            const body = document.getElementById('contractorDetailBody');
            const editBtn = document.getElementById('contractorDetailEditBtn');
            if (!body) return;
            body.innerHTML = `
                <div class="panel-form-row"><span class="detail-label">업체명</span><span class="detail-value">${(contractor.name || '').replace(/</g, '&lt;')}</span></div>
                <div class="panel-form-row"><span class="detail-label">전화번호</span><span class="detail-value">${(contractor.phone || '-').replace(/</g, '&lt;')}</span></div>
                <div class="panel-form-row"><span class="detail-label">사업자등록증</span><span class="detail-value">${contractor.hasLicense ? `<span class="file-link" onclick="event.stopPropagation(); viewContractorImage('license', ${contractor.id})" style="color: var(--primary); cursor: pointer;"><i class="fas fa-image"></i> 보기</span>` : '없음'}</span></div>
                <div class="panel-form-row"><span class="detail-label">통장사본</span><span class="detail-value">${contractor.hasBankAccount ? `<span class="file-link" onclick="event.stopPropagation(); viewContractorImage('bank', ${contractor.id})" style="color: var(--primary); cursor: pointer;"><i class="fas fa-image"></i> 보기</span>` : '없음'}</span></div>
            `;
            if (editBtn) editBtn.onclick = function() { closeContractorDetailPanel(); editContractor(id); };
            document.getElementById('contractorDetailOverlay').classList.add('active');
            document.getElementById('contractorDetailSlidePanel').classList.add('active');
        }

        function closeContractorDetailPanel() {
            document.getElementById('contractorDetailOverlay').classList.remove('active');
            document.getElementById('contractorDetailSlidePanel').classList.remove('active');
        }

        // 저장 (첨부는 FileReader로 data URL 보관 — 보기/다운로드에 사용)
        function saveContractor() {
            const name = document.getElementById('contractorName').value.trim();
            const phone = document.getElementById('contractorPhone').value.trim();
            const licenseInput = document.getElementById('businessLicense');
            const bankInput = document.getElementById('bankAccount');
            const licenseFile = licenseInput && licenseInput.files[0];
            const bankFile = bankInput && bankInput.files[0];

            if (!name) {
                alert('업체명은 필수 입력 항목입니다.');
                return;
            }

            function readFile(file) {
                return new Promise(function(resolve) {
                    if (!file) {
                        resolve(null);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = function() {
                        resolve({
                            dataUrl: reader.result,
                            name: file.name || '첨부',
                            type: file.type || 'application/octet-stream'
                        });
                    };
                    reader.onerror = function() {
                        resolve(null);
                    };
                    reader.readAsDataURL(file);
                });
            }

            Promise.all([readFile(licenseFile), readFile(bankFile)]).then(function(results) {
                const licenseNew = results[0];
                const bankNew = results[1];

                function finish() {
                    closeContractorPanel();
                    renderContractorTable();
                }

                if (contractorEditingId) {
                    const index = contractors.findIndex(function(c) {
                        return c.id === contractorEditingId;
                    });
                    if (index === -1) return;
                    const prev = contractors[index];
                    const next = {
                        id: prev.id,
                        name: name,
                        phone: phone,
                        date: prev.date,
                        hasLicense: prev.hasLicense,
                        hasBankAccount: prev.hasBankAccount,
                        licenseDataUrl: prev.licenseDataUrl,
                        licenseFileName: prev.licenseFileName,
                        licenseMimeType: prev.licenseMimeType,
                        bankDataUrl: prev.bankDataUrl,
                        bankFileName: prev.bankFileName,
                        bankMimeType: prev.bankMimeType
                    };
                    if (licenseNew) {
                        next.hasLicense = true;
                        next.licenseDataUrl = licenseNew.dataUrl;
                        next.licenseFileName = licenseNew.name;
                        next.licenseMimeType = licenseNew.type;
                    }
                    if (bankNew) {
                        next.hasBankAccount = true;
                        next.bankDataUrl = bankNew.dataUrl;
                        next.bankFileName = bankNew.name;
                        next.bankMimeType = bankNew.type;
                    }
                    upsertContractorToServer(next).then(function (remote) {
                        if (!remote.ok) {
                            alert(remote.error || '업체 서버 저장 실패');
                            return;
                        }
                        contractors[index] = next;
                        alert('업체 정보가 수정되었습니다.');
                        contractorEditingId = null;
                        finish();
                    });
                    return;
                }
                const newContractor = {
                    id: contractors.length > 0 ? Math.max.apply(null, contractors.map(function(c) {
                        return c.id;
                    })) + 1 : 1,
                    name: name,
                    phone: phone,
                    date: new Date().toISOString().slice(0, 10),
                    hasLicense: !!licenseNew,
                    hasBankAccount: !!bankNew
                };
                if (licenseNew) {
                    newContractor.licenseDataUrl = licenseNew.dataUrl;
                    newContractor.licenseFileName = licenseNew.name;
                    newContractor.licenseMimeType = licenseNew.type;
                }
                if (bankNew) {
                    newContractor.bankDataUrl = bankNew.dataUrl;
                    newContractor.bankFileName = bankNew.name;
                    newContractor.bankMimeType = bankNew.type;
                }
                upsertContractorToServer(newContractor).then(function (remote) {
                    if (!remote.ok) {
                        alert(remote.error || '업체 서버 저장 실패');
                        return;
                    }
                    contractors.push(newContractor);
                    alert('업체가 등록되었습니다.');
                    finish();
                });
            });
        }

        // 수정
        function editContractor(id) {
            const contractor = contractors.find(c => c.id === id);
            if (!contractor) return;

            contractorEditingId = id;
            document.getElementById('contractorName').value = contractor.name;
            document.getElementById('contractorPhone').value = contractor.phone || '';
            document.getElementById('businessLicense').value = '';
            document.getElementById('bankAccount').value = '';
            const licName = document.getElementById('businessLicenseName');
            const bankName = document.getElementById('bankAccountName');
            if (licName) {
                licName.textContent = contractor.licenseFileName
                    ? contractor.licenseFileName + ' (다른 파일 선택 시 교체)'
                    : (contractor.hasLicense ? '등록된 파일 있음 · 새 파일 선택 시 교체' : '선택한 파일 없음');
            }
            if (bankName) {
                bankName.textContent = contractor.bankFileName
                    ? contractor.bankFileName + ' (다른 파일 선택 시 교체)'
                    : (contractor.hasBankAccount ? '등록된 파일 있음 · 새 파일 선택 시 교체' : '선택한 파일 없음');
            }

            openContractorPanel();
        }

        function deleteContractor(id) {
            const contractor = contractors.find(c => c.id === id);
            if (!contractor) return;

            if (!confirm(`${contractor.name} 업체를 삭제하시겠습니까?`)) return;
            deleteContractorFromServer(id).then(function (remote) {
                if (!remote.ok) {
                    alert(remote.error || '업체 서버 삭제 실패');
                    return;
                }
                contractors = contractors.filter(c => c.id !== id);
                renderContractorTable();
                closeContractorPanel();
                alert('삭제되었습니다.');
            });
        }

        // 폼 초기화
        function resetContractorForm() {
            contractorEditingId = null;
            document.getElementById('contractorName').value = '';
            document.getElementById('contractorPhone').value = '';
            document.getElementById('businessLicense').value = '';
            document.getElementById('bankAccount').value = '';
            document.getElementById('businessLicenseName').textContent = '선택한 파일 없음';
            document.getElementById('bankAccountName').textContent = '선택한 파일 없음';
        }

        // 업체/경비 공통 첨부파일 목록 모달
        function openAttachmentListModal(files, titleText) {
            if (!files || !files.length) {
                alert('파일을 찾을 수 없습니다.');
                return;
            }
            window.currentAttachmentFiles = files;
            const modal = document.createElement('div');
            modal.className = 'file-list-modal active';
            modal.innerHTML = `
                <div class="file-list-modal-content">
                    <div class="file-list-modal-header">
                        <div class="file-list-modal-title">
                            <i class="fas fa-file-invoice"></i> ${titleText} (${files.length}개)
                        </div>
                        <button onclick="this.closest('.file-list-modal').remove()" style="width: 32px; height: 32px; border: none; border-radius: 6px; background: var(--gray-100); color: var(--gray-600); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="file-list-modal-body">
                        ${files.map((file, index) => `
                            <div class="file-list-item">
                                <div class="file-list-item-icon">
                                    <i class="fas ${file.type === 'application/pdf' ? 'fa-file-pdf' : 'fa-image'}"></i>
                                </div>
                                <div class="file-list-item-info">
                                    <div class="file-list-item-name">${file.name}</div>
                                    <div class="file-list-item-meta">업로드: ${file.date || '-'}</div>
                                </div>
                                <div class="file-list-item-actions">
                                    <button class="btn-file-view" onclick="viewCurrentAttachmentFile(${index})">
                                        <i class="fas fa-eye"></i> 보기
                                    </button>
                                    <button class="btn-file-download" onclick="downloadCurrentAttachmentFile(${index})">
                                        <i class="fas fa-download"></i> 다운로드
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
            document.body.appendChild(modal);
        }

        function viewCurrentAttachmentFile(index) {
            const files = window.currentAttachmentFiles || [];
            const file = files[index];
            if (!file) return;
            viewFileModal(file.name, file.data, file.type || 'image/png');
        }

        function downloadCurrentAttachmentFile(index) {
            const files = window.currentAttachmentFiles || [];
            const file = files[index];
            if (!file || !file.data) return;
            const link = document.createElement('a');
            link.href = file.data;
            link.download = file.name || ('첨부파일_' + (index + 1));
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function viewContractorImage(type, id) {
            const contractor = contractors.find(c => c.id === id);
            if (!contractor) return;

            const imageType = type === 'license' ? '사업자등록증' : '통장사본';
            if (type === 'license') {
                if (!contractor.hasLicense) return;
                if (contractor.licenseDataUrl) {
                    openAttachmentListModal([{
                        name: contractor.licenseFileName || ((contractor.name || '업체') + '_' + imageType),
                        type: contractor.licenseMimeType || 'image/png',
                        data: contractor.licenseDataUrl,
                        date: contractor.date || new Date().toISOString().slice(0, 10)
                    }], '첨부파일');
                    return;
                }
                alert('저장된 사업자등록증 파일이 없습니다.');
                return;
            }
            if (!contractor.hasBankAccount) return;
            if (contractor.bankDataUrl) {
                openAttachmentListModal([{
                    name: contractor.bankFileName || ((contractor.name || '업체') + '_' + imageType),
                    type: contractor.bankMimeType || 'image/png',
                    data: contractor.bankDataUrl,
                    date: contractor.date || new Date().toISOString().slice(0, 10)
                }], '첨부파일');
                return;
            }
            alert('저장된 통장사본 파일이 없습니다.');
        }

        function downloadContractorImage(type, id) {
            const contractor = contractors.find(c => c.id === id);
            if (!contractor) return;
            const imageType = type === 'license' ? '사업자등록증' : '통장사본';
            if (type === 'license' && contractor.licenseDataUrl) {
                const fileName = contractor.licenseFileName || ((contractor.name || '업체') + '_' + imageType);
                const a = document.createElement('a');
                a.href = contractor.licenseDataUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                return;
            }
            if (type === 'bank' && contractor.bankDataUrl) {
                const fileName = contractor.bankFileName || ((contractor.name || '업체') + '_' + imageType);
                const a = document.createElement('a');
                a.href = contractor.bankDataUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                return;
            }
            alert('다운로드할 파일이 없습니다. (' + imageType + ')');
        }

        // 업체정보 페이지 표시 시 테이블 렌더링
        window.addEventListener('hashchange', function() {
            if (window.location.hash === '#contractors') {
                renderContractorTable();
                if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                    syncContractorsFromServer();
                }
            } else if (window.location.hash === '#expenses') {
                fillExpenseMonthFilter();
                renderExpenseTable();
                if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                    syncExpensesFromServer();
                }
            } else if (window.location.hash === '#sga') {
                fillSgaMonthFilter();
                renderSgaTable();
                if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                    syncSgaFromServer();
                }
            }
        });

        // ========================================
        // 경비지출관리 JavaScript
        // ========================================
        
        let expenseEditingId = null;
        let sgaEditingId = null;

        function renderSgaTable() {
            const tbody = document.getElementById('sgaTableBody');
            if (!tbody) return;
            const month = getSgaMonthFilter();
            const filtered = month ? sgaExpenses.filter(function(item) {
                return item.date && item.date.slice(0, 7) === month;
            }) : sgaExpenses.slice();
            filtered.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

            if (!filtered.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--gray-500);">' +
                    (month ? '해당 월에 등록된 판관비 내역이 없습니다' : '등록된 판관비 내역이 없습니다') + '</td></tr>';
                return;
            }

            tbody.innerHTML = filtered.map(function(item, idx) {
                return '<tr class="table-row-clickable" data-sga-id="' + item.id + '" onclick="openSgaDetailPanel(' + item.id + ')">' +
                    '<td>' + (idx + 1) + '</td>' +
                    '<td>' + (item.date || '-') + '</td>' +
                    '<td>' + (item.category || '-') + '</td>' +
                    '<td class="text-right">' + (item.amount || 0).toLocaleString() + '원</td>' +
                    '<td class="sga-memo-cell"><span class="sga-memo-text">' + (item.memo || '-') + '</span></td>' +
                '</tr>';
            }).join('');
        }

        function openSgaDetailPanel(id) {
            const item = sgaExpenses.find(function(row) { return row.id === id; });
            if (!item) return;
            const body = document.getElementById('sgaDetailBody');
            const editBtn = document.getElementById('sgaDetailEditBtn');
            if (!body) return;
            body.innerHTML =
                '<div class="panel-form-row"><span class="detail-label">지출일자</span><span class="detail-value">' + (item.date || '-') + '</span></div>' +
                '<div class="panel-form-row"><span class="detail-label">계정과목</span><span class="detail-value">' + (item.category || '-') + '</span></div>' +
                '<div class="panel-form-row"><span class="detail-label">금액(vat별도)</span><span class="detail-value">' + (item.amount || 0).toLocaleString() + '원</span></div>' +
                '<div class="panel-form-row"><span class="detail-label">메모</span><span class="detail-value">' + (item.memo || '-') + '</span></div>';
            if (editBtn) {
                editBtn.onclick = function() {
                    closeSgaDetailPanel();
                    editSgaExpense(id);
                };
            }
            const overlay = document.getElementById('sgaDetailOverlay');
            const panel = document.getElementById('sgaDetailSlidePanel');
            if (overlay) overlay.classList.add('active');
            if (panel) panel.classList.add('active');
        }

        function closeSgaDetailPanel() {
            const overlay = document.getElementById('sgaDetailOverlay');
            const panel = document.getElementById('sgaDetailSlidePanel');
            if (overlay) overlay.classList.remove('active');
            if (panel) panel.classList.remove('active');
        }

        function openSgaPanel() {
            const title = document.getElementById('sgaPanelTitle');
            if (title) title.textContent = sgaEditingId ? '판관비 수정' : '판관비 등록';
            if (!sgaEditingId) {
                const dateInput = document.getElementById('sgaDate');
                if (dateInput) dateInput.valueAsDate = new Date();
            }
            var delBtn = document.getElementById('sgaPanelDeleteBtn');
            if (delBtn) {
                if (sgaEditingId) {
                    delBtn.style.display = '';
                    delBtn.setAttribute('aria-hidden', 'false');
                    var eid = sgaEditingId;
                    delBtn.onclick = function () {
                        deleteSgaExpense(eid);
                    };
                } else {
                    delBtn.style.display = 'none';
                    delBtn.setAttribute('aria-hidden', 'true');
                    delBtn.onclick = null;
                }
            }
            const overlay = document.getElementById('sgaPanelOverlay');
            const panel = document.getElementById('sgaSlidePanel');
            if (overlay) overlay.classList.add('active');
            if (panel) panel.classList.add('active');
        }

        function closeSgaPanel() {
            const overlay = document.getElementById('sgaPanelOverlay');
            const panel = document.getElementById('sgaSlidePanel');
            if (overlay) overlay.classList.remove('active');
            if (panel) panel.classList.remove('active');
            var delBtn = document.getElementById('sgaPanelDeleteBtn');
            if (delBtn) {
                delBtn.style.display = 'none';
                delBtn.setAttribute('aria-hidden', 'true');
                delBtn.onclick = null;
            }
            resetSgaForm();
        }

        function resetSgaForm() {
            sgaEditingId = null;
            const dateEl = document.getElementById('sgaDate');
            const categoryEl = document.getElementById('sgaCategory');
            const amountEl = document.getElementById('sgaAmount');
            const memoEl = document.getElementById('sgaMemo');
            if (dateEl) dateEl.value = '';
            if (categoryEl) categoryEl.value = '';
            if (amountEl) amountEl.value = '';
            if (memoEl) memoEl.value = '';
        }

        function saveSgaExpense() {
            const dateEl = document.getElementById('sgaDate');
            const categoryEl = document.getElementById('sgaCategory');
            const amountEl = document.getElementById('sgaAmount');
            const memoEl = document.getElementById('sgaMemo');
            const date = dateEl ? dateEl.value : '';
            const category = categoryEl ? categoryEl.value.trim() : '';
            const amount = amountEl ? (parseInt(amountEl.value, 10) || 0) : 0;
            const memo = memoEl ? memoEl.value.trim() : '';

            if (!date || !category || amount <= 0) {
                alert('지출일자, 계정과목, 금액(vat별도)은 필수입니다.');
                return;
            }

            function afterSave() {
                closeSgaPanel();
                fillSgaMonthFilter();
                renderSgaTable();
                renderPerformanceData();
            }

            if (sgaEditingId) {
                const idx = sgaExpenses.findIndex(function (item) {
                    return item.id === sgaEditingId;
                });
                if (idx === -1) return;
                const updated = {
                    ...sgaExpenses[idx],
                    date: date,
                    category: category,
                    amount: amount,
                    memo: memo,
                };
                upsertSgaToServer(updated).then(function (remote) {
                    if (!remote.ok) {
                        alert(remote.error || '판관비 서버 저장 실패');
                        return;
                    }
                    sgaExpenses[idx] = updated;
                    sgaEditingId = null;
                    afterSave();
                    alert('판관비 내역이 수정되었습니다.');
                });
                return;
            }

            var maxId = 0;
            sgaExpenses.forEach(function (e) {
                var n = Number(e && e.id);
                if (Number.isFinite(n) && n > maxId) maxId = n;
            });
            const newItem = {
                id: maxId + 1,
                date: date,
                category: category,
                amount: amount,
                memo: memo,
            };
            upsertSgaToServer(newItem).then(function (remote) {
                if (!remote.ok) {
                    alert(remote.error || '판관비 서버 저장 실패');
                    return;
                }
                sgaExpenses.unshift(newItem);
                afterSave();
                alert('판관비가 등록되었습니다.');
            });
        }

        function editSgaExpense(id) {
            const item = sgaExpenses.find(function(row) { return row.id === id; });
            if (!item) return;
            sgaEditingId = id;
            const dateEl = document.getElementById('sgaDate');
            const categoryEl = document.getElementById('sgaCategory');
            const amountEl = document.getElementById('sgaAmount');
            const memoEl = document.getElementById('sgaMemo');
            if (dateEl) dateEl.value = item.date || '';
            if (categoryEl) categoryEl.value = item.category || '';
            if (amountEl) amountEl.value = item.amount || 0;
            if (memoEl) memoEl.value = item.memo || '';
            openSgaPanel();
        }

        function deleteSgaExpense(id, skipConfirm) {
            const item = sgaExpenses.find(function (row) {
                return row.id === id;
            });
            if (!item) return;
            if (!skipConfirm && !confirm('해당 판관비를 삭제하시겠습니까?')) return;
            deleteSgaFromServer(id).then(function (remote) {
                if (!remote.ok) {
                    alert(remote.error || '판관비 서버 삭제 실패');
                    return;
                }
                sgaExpenses = sgaExpenses.filter(function (row) {
                    return row.id !== id;
                });
                fillSgaMonthFilter();
                renderSgaTable();
                renderPerformanceData();
                closeSgaPanel();
                alert('삭제되었습니다.');
            });
        }

        // 경비 영수증 목록 (복수). receipts: [{ dataUrl, name }]. 구버전 호환: hasReceipt/receiptDataUrl -> receipts
        function getExpenseReceipts(expense) {
            if (!expense) return [];
            if (expense.receipts && Array.isArray(expense.receipts)) return expense.receipts;
            if (expense.receiptDataUrl) return [{ dataUrl: expense.receiptDataUrl, name: '영수증' }];
            if (expense.hasReceipt) return [{ dataUrl: '', name: '영수증' }];
            return [];
        }

        // 경비 월별 필터 (사용일시 기준): 선택한 YYYY-MM, ''이면 전체
        function getExpenseMonthFilter() {
            const sel = document.getElementById('expenseMonthFilter');
            return sel ? sel.value : '';
        }

        function getFilteredExpensesByMonth() {
            const month = getExpenseMonthFilter();
            if (!month) return expenses;
            return expenses.filter(e => e.date && e.date.slice(0, 7) === month);
        }

        // 월 선택 옵션 채우기 (사용일시 기준 존재하는 년월 + 현재 년월)
        function fillExpenseMonthFilter() {
            const sel = document.getElementById('expenseMonthFilter');
            if (!sel) return;
            const months = new Set();
            const now = new Date();
            months.add(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
            expenses.forEach(e => {
                if (e.date) months.add(e.date.slice(0, 7));
            });
            const sorted = Array.from(months).sort().reverse();
            const current = sel.value || (now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
            sel.innerHTML = '<option value="">전체</option>' + sorted.map(m => {
                const [y, mo] = m.split('-');
                const label = y + '년 ' + parseInt(mo, 10) + '월';
                return `<option value="${m}"${m === current ? ' selected' : ''}>${label}</option>`;
            }).join('');
        }

        function onExpenseMonthChange() {
            renderExpenseTable();
        }

        function getSgaMonthFilter() {
            const sel = document.getElementById('sgaMonthFilter');
            return sel ? sel.value : '';
        }

        function fillSgaMonthFilter() {
            const sel = document.getElementById('sgaMonthFilter');
            if (!sel) return;
            const months = new Set();
            const now = new Date();
            months.add(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
            sgaExpenses.forEach(function(e) {
                if (e.date) months.add(String(e.date).slice(0, 7));
            });
            const sorted = Array.from(months).sort().reverse();
            const current = sel.value || (now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
            sel.innerHTML = '<option value="">전체</option>' + sorted.map(function(m) {
                const parts = m.split('-');
                return '<option value="' + m + '"' + (m === current ? ' selected' : '') + '>' + parts[0] + '년 ' + parseInt(parts[1], 10) + '월</option>';
            }).join('');
        }

        function onSgaMonthChange() {
            renderSgaTable();
        }

        // 오늘 날짜 설정
        function setExpenseTodayDate() {
            document.getElementById('expenseUsageDate').valueAsDate = new Date();
        }

        // 슬라이드 패널 열기
        function openExpensePanel() {
            document.getElementById('expensePanelTitle').textContent = expenseEditingId ? '경비 수정' : '경비 등록';
            if (!expenseEditingId) {
                setExpenseTodayDate();
            }
            var delBtn = document.getElementById('expensePanelDeleteBtn');
            if (delBtn) {
                if (expenseEditingId) {
                    delBtn.style.display = '';
                    delBtn.setAttribute('aria-hidden', 'false');
                    var eid = expenseEditingId;
                    delBtn.onclick = function () {
                        deleteExpense(eid);
                    };
                } else {
                    delBtn.style.display = 'none';
                    delBtn.setAttribute('aria-hidden', 'true');
                    delBtn.onclick = null;
                }
            }
            document.getElementById('expensePanelOverlay').classList.add('active');
            document.getElementById('expenseSlidePanel').classList.add('active');
        }

        // 슬라이드 패널 닫기
        function closeExpensePanel() {
            document.getElementById('expensePanelOverlay').classList.remove('active');
            document.getElementById('expenseSlidePanel').classList.remove('active');
            var delBtn = document.getElementById('expensePanelDeleteBtn');
            if (delBtn) {
                delBtn.style.display = 'none';
                delBtn.setAttribute('aria-hidden', 'true');
                delBtn.onclick = null;
            }
            resetExpenseForm();
        }

        // 파일명 업데이트 (복수 표시)
        function updateExpenseFileName() {
            const input = document.getElementById('expenseReceipt');
            const nameSpan = document.getElementById('expenseReceiptName');
            if (!input || !nameSpan) return;
            const n = input.files.length;
            if (n === 0) {
                nameSpan.textContent = '선택한 파일 없음';
            } else if (n === 1) {
                nameSpan.textContent = input.files[0].name;
            } else {
                nameSpan.textContent = '선택한 파일 ' + n + '개';
            }
        }

        // 테이블 렌더링 (월별 필터 적용, 사용일시 기준)
        function renderExpenseTable() {
            const tbody = document.getElementById('expenseTableBody');
            const filtered = getFilteredExpensesByMonth();
            
            if (filtered.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: var(--gray-500);">
                            ${getExpenseMonthFilter() ? '해당 월에 등록된 경비 내역이 없습니다' : '등록된 경비 내역이 없습니다'}
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = filtered.map((item, index) => {
                const n = getExpenseReceipts(item).length;
                return `
                <tr class="table-row-clickable" data-expense-id="${item.id}">
                    <td>${index + 1}</td>
                    <td><span class="badge ${item.type === '계좌이체' ? 'badge-transfer' : 'badge-card'}">${item.type}</span></td>
                    <td>${item.date}</td>
                    <td>${item.building || '-'}</td>
                    <td>${item.purpose || '-'}</td>
                    <td class="text-right">${item.amount.toLocaleString()}원</td>
                    <td><span class="file-link expense-row-file-link" data-expense-id="${item.id}" style="color: var(--success); cursor: pointer;"><i class="fas fa-image"></i> 보기 (${n})</span></td>
                </tr>
            `;
            }).join('');
        }

        // 저장 (영수증 복수: data URL 배열로 저장)
        function saveExpense() {
            const type = document.querySelector('input[name="expensePaymentType"]:checked').value;
            const date = document.getElementById('expenseUsageDate').value;
            const building = document.getElementById('expenseBuilding').value.trim();
            const purpose = document.getElementById('expensePurpose').value.trim();
            const amount = parseInt(document.getElementById('expenseAmount').value) || 0;
            const fileInput = document.getElementById('expenseReceipt');
            const files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];

            if (!date) {
                alert('사용일시는 필수 입력 항목입니다.');
                return;
            }
            if (amount <= 0) {
                alert('결제 금액을 입력해주세요.');
                return;
            }

            function runAfterSave(receiptsArray) {
                async function finishSave() {
                    if (expenseEditingId) {
                        const index = expenses.findIndex(e => e.id === expenseEditingId);
                        if (index === -1) return;
                        const existing = getExpenseReceipts(expenses[index]);
                        const merged = receiptsArray.length ? [...existing, ...receiptsArray] : existing;
                        const updated = {
                            ...expenses[index],
                            type,
                            date,
                            building,
                            purpose,
                            amount,
                            receipts: merged,
                        };
                        const remote = await upsertExpenseToServer(updated);
                        if (!remote.ok) {
                            alert(remote.error || '경비 서버 저장 실패');
                            return;
                        }
                        expenses[index] = updated;
                        alert('경비 내역이 수정되었습니다.');
                        expenseEditingId = null;
                    } else {
                        var maxId = 0;
                        expenses.forEach(function (e) {
                            var n = Number(e && e.id);
                            if (Number.isFinite(n) && n > maxId) maxId = n;
                        });
                        const newExpense = {
                            id: maxId + 1,
                            type,
                            date,
                            building,
                            purpose,
                            amount,
                            receipts: receiptsArray || [],
                        };
                        const remote = await upsertExpenseToServer(newExpense);
                        if (!remote.ok) {
                            alert(remote.error || '경비 서버 저장 실패');
                            return;
                        }
                        expenses.unshift(newExpense);
                        alert('경비가 등록되었습니다.');
                    }
                    closeExpensePanel();
                    fillExpenseMonthFilter();
                    renderExpenseTable();
                }
                finishSave().catch(function (e) {
                    alert((e && e.message) || '경비 저장 중 오류가 발생했습니다.');
                });
            }

            if (files.length === 0) {
                runAfterSave([]);
                return;
            }
            let read = 0;
            const results = [];
            files.forEach((file, i) => {
                const reader = new FileReader();
                reader.onload = function() {
                    results[i] = { dataUrl: reader.result, name: file.name || '영수증' };
                    read++;
                    if (read === files.length) runAfterSave(results);
                };
                reader.readAsDataURL(file);
            });
        }

        // 수정
        function editExpense(id) {
            const expense = expenses.find(e => e.id === id);
            if (!expense) return;

            expenseEditingId = id;
            
            // 라디오 버튼 설정
            if (expense.type === '계좌이체') {
                document.getElementById('expenseTypeTransfer').checked = true;
            } else {
                document.getElementById('expenseTypeCard').checked = true;
            }
            
            document.getElementById('expenseUsageDate').value = expense.date;
            document.getElementById('expenseBuilding').value = expense.building;
            document.getElementById('expensePurpose').value = expense.purpose;
            document.getElementById('expenseAmount').value = expense.amount;
            
            openExpensePanel();
        }

        // 삭제
        function deleteExpense(id) {
            if (!confirm('이 경비 내역을 삭제하시겠습니까?')) return;
            deleteExpenseFromServer(id).then(function (remote) {
                if (!remote.ok) {
                    alert(remote.error || '경비 서버 삭제 실패');
                    return;
                }
                expenses = expenses.filter(e => e.id !== id);
                renderExpenseTable();
                closeExpensePanel();
                alert('삭제되었습니다.');
            });
        }

        // 폼 초기화
        function resetExpenseForm() {
            expenseEditingId = null;
            document.getElementById('expenseTypeCard').checked = true;
            document.getElementById('expenseBuilding').value = '';
            document.getElementById('expensePurpose').value = '';
            document.getElementById('expenseAmount').value = '';
            document.getElementById('expenseReceipt').value = '';
            document.getElementById('expenseReceiptName').textContent = '선택한 파일 없음';
        }

        // 경비 상세 슬라이드 패널
        function openExpenseDetailPanel(id) {
            const expense = expenses.find(e => e.id === id);
            if (!expense) return;
            const body = document.getElementById('expenseDetailBody');
            const editBtn = document.getElementById('expenseDetailEditBtn');
            if (!body) return;
            body.innerHTML = `
                <div class="panel-form-row"><span class="detail-label">구분</span><span class="detail-value">${expense.type}</span></div>
                <div class="panel-form-row"><span class="detail-label">사용일시</span><span class="detail-value">${expense.date}</span></div>
                <div class="panel-form-row"><span class="detail-label">사용건물</span><span class="detail-value">${expense.building || '-'}</span></div>
                <div class="panel-form-row"><span class="detail-label">사용목적</span><span class="detail-value">${expense.purpose || '-'}</span></div>
                <div class="panel-form-row"><span class="detail-label">결제금액</span><span class="detail-value">${expense.amount.toLocaleString()}원</span></div>
                <div class="panel-form-row">
                    <span class="detail-label">사진</span>
                    <span class="detail-value expense-detail-photo-cell"></span>
                </div>
            `;
            (function () {
                const photoCell = body.querySelector('.expense-detail-photo-cell');
                if (!photoCell) return;
                const n = getExpenseReceipts(expense).length;
                if (!n) {
                    photoCell.textContent = '보기 (0)';
                    return;
                }
                const span = document.createElement('span');
                span.className = 'file-link';
                span.style.cssText = 'color: var(--primary); cursor: pointer;';
                span.innerHTML = '<i class="fas fa-image"></i> 보기 (' + n + ')';
                span.addEventListener('click', function () {
                    viewExpenseImage(id, 0);
                });
                photoCell.appendChild(span);
            })();
            if (editBtn) { editBtn.onclick = function() { closeExpenseDetailPanel(); editExpense(id); }; }
            document.getElementById('expenseDetailOverlay').classList.add('active');
            document.getElementById('expenseDetailSlidePanel').classList.add('active');
        }

        function closeExpenseDetailPanel() {
            document.getElementById('expenseDetailOverlay').classList.remove('active');
            document.getElementById('expenseDetailSlidePanel').classList.remove('active');
        }

        // 경비 첨부파일 보기 (프로젝트관리 첨부파일 목록 모달과 동일 패턴)
        function viewExpenseImage(id, index) {
            const expense = expenses.find(e => e.id === id);
            if (!expense) return;
            const receipts = getExpenseReceipts(expense);
            if (receipts.length === 0) return;
            const files = receipts.map(function(item, idx) {
                const dataUrl = item && (item.dataUrl || item);
                const src = typeof dataUrl === 'string' ? dataUrl : (dataUrl && dataUrl.dataUrl);
                if (!src) return null;
                const isPdf = src.indexOf('data:application/pdf') === 0;
                const defaultName = '영수증_' + (idx + 1) + (isPdf ? '.pdf' : '.png');
                return {
                    name: ((item && item.name) ? String(item.name) : defaultName).replace(/[\\/:*?"<>|]/g, '_'),
                    type: isPdf ? 'application/pdf' : 'image/png',
                    data: src,
                    date: expense.date || new Date().toISOString().slice(0, 10)
                };
            }).filter(Boolean);
            if (files.length === 0) {
                alert('저장된 영수증 이미지가 없습니다.');
                return;
            }
            openAttachmentListModal(files, '첨부파일');
        }

        // CSV 다운로드
        function csvEscape(value) {
            const s = String(value == null ? '' : value);
            if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
            return s;
        }

        function downloadEstimateCSV() {
            let csv = '\uFEFF';
            csv += '코드,상태,대분류,중분류,소분류,건물명,공사명,담당자,도급사,매출액,매입액,등록일\n';
            estimates.forEach(function (item) {
                csv += [
                    csvEscape(item.code || ''),
                    csvEscape(item.status || ''),
                    csvEscape(item.category1 || ''),
                    csvEscape(item.category2 || ''),
                    csvEscape(item.category3 || ''),
                    csvEscape(item.building || ''),
                    csvEscape(item.project || ''),
                    csvEscape(item.manager || ''),
                    csvEscape(item.contractor || ''),
                    csvEscape(Number(item.revenue || 0)),
                    csvEscape(Number(item.purchase || 0)),
                    csvEscape(item.date || '')
                ].join(',') + '\n';
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '프로젝트관리_' + new Date().toISOString().slice(0, 10) + '.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function downloadExpenseCSV() {
            const filtered = getFilteredExpensesByMonth();
            let csv = '\uFEFF'; // UTF-8 BOM
            csv += '번호,구분,사용일시,사용건물,사용목적,결제금액,사진\n';
            
            filtered.forEach((item, index) => {
                const n = getExpenseReceipts(item).length;
                csv += `${index + 1},${item.type},${item.date},${item.building || ''},${item.purpose || ''},${item.amount},${n ? n + '개' : '없음'}\n`;
            });

            const monthSuffix = getExpenseMonthFilter() ? '_' + getExpenseMonthFilter() : '';
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `경비지출내역${monthSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function downloadSgaCSV() {
            const month = getSgaMonthFilter();
            const filtered = month
                ? sgaExpenses.filter(function(item) { return item.date && String(item.date).slice(0, 7) === month; })
                : sgaExpenses.slice();
            let csv = '\uFEFF';
            csv += '번호,지출일자,계정과목,금액(vat별도),메모\n';
            filtered.forEach(function(item, index) {
                csv += [index + 1, item.date || '', item.category || '', item.amount || 0, item.memo || ''].join(',') + '\n';
            });
            const monthSuffix = month ? '_' + month : '';
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '판관비내역' + monthSuffix + '_' + new Date().toISOString().slice(0, 10) + '.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // ========================================
        // 경영실적관리 JavaScript
        // ========================================
        
        /** 'all' | 'month' | 'range' — 표·KPI 필터 기준 */
        let performancePeriodMode = 'month';
        /** 'include' | 'exclude' — 판관비 포함 여부 */
        let performanceSgaMode = 'exclude';
        // 기간별 팝오버는 시작/종료 둘 다 선택되면 자동으로 닫히도록 제어
        let performanceRangePopoverForcedClosed = false;
        var performanceMonthPickerOnOpen = function () {};

        function switchPerformanceSgaMode(mode) {
            performanceSgaMode = mode === 'exclude' ? 'exclude' : 'include';
            const toggleEl = document.getElementById('performanceSgaToggle');
            if (toggleEl) toggleEl.checked = performanceSgaMode === 'include';
            const stateEl = document.getElementById('performanceSgaToggleState');
            if (stateEl) stateEl.textContent = performanceSgaMode === 'include' ? 'ON' : 'OFF';
            renderPerformanceData();
        }

        function sgaItemMatchesPerformancePeriod(item) {
            const d = item && item.date ? String(item.date).trim().slice(0, 10) : '';
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
            if (performancePeriodMode === 'all') return true;
            if (performancePeriodMode === 'month') {
                const inp = document.getElementById('performanceFilterMonth');
                const ym = inp && inp.value ? inp.value.trim() : '';
                return /^\d{4}-\d{2}$/.test(ym) ? d.slice(0, 7) === ym : true;
            }
            if (performancePeriodMode === 'range') {
                const fromEl = document.getElementById('performanceDateFrom');
                const toEl = document.getElementById('performanceDateTo');
                const a = fromEl && fromEl.value ? fromEl.value.trim().slice(0, 10) : '';
                const b = toEl && toEl.value ? toEl.value.trim().slice(0, 10) : '';
                if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return true;
                const from = a <= b ? a : b;
                const to = a <= b ? b : a;
                return d >= from && d <= to;
            }
            return true;
        }

        function updatePerformanceMonthButtonLabel() {
            const btn = document.querySelector('#page-performance .performance-mode-btn[data-mode="month"]');
            const inp = document.getElementById('performanceFilterMonth');
            if (!btn) return;
            const v = inp && inp.value ? inp.value.trim() : '';
            if (/^\d{4}-\d{2}$/.test(v)) {
                const p = v.split('-');
                btn.textContent = parseInt(p[0], 10) + '년 ' + parseInt(p[1], 10) + '월';
            } else {
                btn.textContent = '월 선택';
            }
        }

        function initPerformanceMonthPicker() {
            var cmpY;
            var cmpM;
            var cmpYearPage0;

            function pad2(n) { return String(n).padStart(2, '0'); }
            function readHidden() {
                const el = document.getElementById('performanceFilterMonth');
                if (!el || !el.value) return null;
                const p = el.value.split('-');
                const y = parseInt(p[0], 10);
                const m = parseInt(p[1], 10);
                if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return null;
                return { y: y, m: m };
            }
            function writeHidden() {
                const el = document.getElementById('performanceFilterMonth');
                if (el) el.value = cmpY + '-' + pad2(cmpM);
                updatePerformanceMonthButtonLabel();
            }
            function syncFromHiddenOrToday() {
                const r = readHidden();
                const t = new Date();
                if (r) { cmpY = r.y; cmpM = r.m; }
                else { cmpY = t.getFullYear(); cmpM = t.getMonth() + 1; }
                cmpYearPage0 = Math.floor(cmpY / 12) * 12;
            }
            function showMonthShell() {
                const mv = document.getElementById('perfCmpMonthView');
                const yv = document.getElementById('perfCmpYearView');
                if (mv) mv.hidden = false;
                if (yv) yv.hidden = true;
            }
            function showYearShell() {
                const yv = document.getElementById('perfCmpYearView');
                if (yv) yv.hidden = false;
            }
            function updateYearLabelBtn() {
                const b = document.getElementById('perfCmpYearOpenGrid');
                if (b) b.textContent = cmpY + '년';
            }
            function renderMonthGrid() {
                const g = document.getElementById('perfCmpMonthGrid');
                if (!g) return;
                g.innerHTML = '';
                const now = new Date();
                for (var mo = 1; mo <= 12; mo++) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'cmp-month-cell';
                    btn.setAttribute('data-m', String(mo));
                    btn.setAttribute('role', 'option');
                    btn.textContent = String(mo);
                    if (mo === cmpM) btn.classList.add('is-selected');
                    if (mo === now.getMonth() + 1 && cmpY === now.getFullYear()) btn.classList.add('is-today');
                    btn.addEventListener('click', function (ev) {
                        cmpM = parseInt(ev.currentTarget.getAttribute('data-m'), 10);
                        writeHidden();
                        renderMonthGrid();
                        renderPerformanceData();
                    });
                    g.appendChild(btn);
                }
            }
            function renderYearGrid() {
                const g = document.getElementById('perfCmpYearGrid');
                const lbl = document.getElementById('perfCmpYearPageLabel');
                if (!g) return;
                g.innerHTML = '';
                if (lbl) lbl.textContent = cmpYearPage0 + '–' + (cmpYearPage0 + 11);
                for (var i = 0; i < 12; i++) {
                    const y = cmpYearPage0 + i;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'cmp-year-cell';
                    btn.textContent = String(y);
                    if (y === cmpY) btn.classList.add('is-selected');
                    btn.addEventListener('click', function (ev) {
                        cmpY = parseInt(ev.currentTarget.textContent, 10);
                        cmpYearPage0 = Math.floor(cmpY / 12) * 12;
                        updateYearLabelBtn();
                        renderMonthGrid();
                        showMonthShell();
                        writeHidden();
                        renderPerformanceData();
                    });
                    g.appendChild(btn);
                }
            }

            performanceMonthPickerOnOpen = function () {
                syncFromHiddenOrToday();
                showMonthShell();
                updateYearLabelBtn();
                renderMonthGrid();
            };

            const yPrev = document.getElementById('perfCmpYearPrev');
            if (yPrev) yPrev.addEventListener('click', function () {
                cmpY--;
                cmpYearPage0 = Math.floor(cmpY / 12) * 12;
                updateYearLabelBtn();
                renderMonthGrid();
                writeHidden();
                renderPerformanceData();
            });
            const yNext = document.getElementById('perfCmpYearNext');
            if (yNext) yNext.addEventListener('click', function () {
                cmpY++;
                cmpYearPage0 = Math.floor(cmpY / 12) * 12;
                updateYearLabelBtn();
                renderMonthGrid();
                writeHidden();
                renderPerformanceData();
            });
            const yOpen = document.getElementById('perfCmpYearOpenGrid');
            if (yOpen) yOpen.addEventListener('click', function () {
                cmpYearPage0 = Math.floor(cmpY / 12) * 12;
                showYearShell();
                renderYearGrid();
            });
            const yPagePrev = document.getElementById('perfCmpYearPagePrev');
            if (yPagePrev) yPagePrev.addEventListener('click', function () {
                cmpYearPage0 -= 12;
                renderYearGrid();
            });
            const yPageNext = document.getElementById('perfCmpYearPageNext');
            if (yPageNext) yPageNext.addEventListener('click', function () {
                cmpYearPage0 += 12;
                renderYearGrid();
            });
            const backM = document.getElementById('perfCmpBackToMonths');
            if (backM) backM.addEventListener('click', function () {
                showMonthShell();
                updateYearLabelBtn();
                renderMonthGrid();
            });
            const clr = document.getElementById('perfCmpMonthClear');
            if (clr) clr.addEventListener('click', function () {
                const el = document.getElementById('performanceFilterMonth');
                if (el) el.value = '';
                updatePerformanceMonthButtonLabel();
                renderPerformanceData();
            });
            const thisM = document.getElementById('perfCmpMonthThis');
            if (thisM) thisM.addEventListener('click', function () {
                const t = new Date();
                cmpY = t.getFullYear();
                cmpM = t.getMonth() + 1;
                cmpYearPage0 = Math.floor(cmpY / 12) * 12;
                writeHidden();
                updateYearLabelBtn();
                renderMonthGrid();
                renderPerformanceData();
            });
            updatePerformanceMonthButtonLabel();
        }

        function updatePerformanceRangeButtons() {
            const fromHidden = document.getElementById('performanceDateFrom');
            const toHidden = document.getElementById('performanceDateTo');
            const fromBtn = document.getElementById('performanceDateFromBtn');
            const toBtn = document.getElementById('performanceDateToBtn');
            const rangeModeBtn = document.querySelector('#page-performance .performance-mode-btn[data-mode="range"]');
            const fromVal = (fromHidden && fromHidden.value) ? fromHidden.value.trim() : '';
            const toVal = (toHidden && toHidden.value) ? toHidden.value.trim() : '';
            if (fromBtn) fromBtn.textContent = (fromHidden && fromHidden.value) ? fromHidden.value : '시작 날짜';
            if (toBtn) toBtn.textContent = (toHidden && toHidden.value) ? toHidden.value : '종료 날짜';
            if (rangeModeBtn) {
                if (fromVal && toVal) rangeModeBtn.textContent = fromVal + ' ~ ' + toVal;
                else rangeModeBtn.textContent = '기간별';
            }
        }

        function initPerformanceDatePicker() {
            const panel = document.getElementById('performanceDatePickerPanel');
            const fromHidden = document.getElementById('performanceDateFrom');
            const toHidden = document.getElementById('performanceDateTo');
            const fromBtn = document.getElementById('performanceDateFromBtn');
            const toBtn = document.getElementById('performanceDateToBtn');
            if (!panel || !fromHidden || !toHidden || !fromBtn || !toBtn) return;

            var state = { active: null, y: 0, m: 1, d: 1, yearPage0: 0, view: 'month' };
            function pad2(n) { return String(n).padStart(2, '0'); }
            function formatYMD(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
            function parseYMD(v) {
                if (!v || typeof v !== 'string') return null;
                const s = v.trim();
                if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
                const parts = s.split('-').map(Number);
                if (parts.length !== 3) return null;
                return { y: parts[0], m: parts[1], d: parts[2] };
            }
            function getActiveHidden() { return state.active === 'from' ? fromHidden : toHidden; }
            function updateDisplayButtons() { updatePerformanceRangeButtons(); }
            function positionPanel(anchorEl) {
                const r = anchorEl.getBoundingClientRect();
                // 프로젝트관리와 동일하게 viewport 기준으로 배치
                panel.style.position = 'fixed';
                panel.style.top = (r.bottom + 8) + 'px';
                const w = panel.offsetWidth || 320;
                const margin = 8;
                const maxLeft = window.innerWidth - w - margin;
                const left = Math.min(Math.max(r.left, margin), maxLeft);
                panel.style.left = left + 'px';
            }
            function syncStateFromActive() {
                const parsed = parseYMD(getActiveHidden().value);
                const t = new Date();
                if (parsed) { state.y = parsed.y; state.m = parsed.m; state.d = parsed.d; }
                else { state.y = t.getFullYear(); state.m = t.getMonth() + 1; state.d = t.getDate(); }
                state.yearPage0 = Math.floor(state.y / 12) * 12;
            }
            function renderMonthView() {
                panel.innerHTML = '';
                updateDisplayButtons();
                const now = new Date();
                const todayY = now.getFullYear();
                const todayM = now.getMonth() + 1;
                const todayD = now.getDate();
                const first = new Date(state.y, state.m - 1, 1);
                const startDow = first.getDay();
                const daysInMonth = new Date(state.y, state.m, 0).getDate();
                const daysInPrev = new Date(state.y, state.m - 2, 0).getDate();

                var cells = [];
                for (var idx = 0; idx < 42; idx++) {
                    const offset = idx - startDow + 1;
                    var y = state.y, m = state.m, d = 0;
                    var out = false;
                    if (offset < 1) {
                        out = true; y = state.y; m = state.m - 1; if (m < 1) { m = 12; y -= 1; } d = daysInPrev + offset;
                    } else if (offset > daysInMonth) {
                        out = true; y = state.y; m = state.m + 1; if (m > 12) { m = 1; y += 1; } d = offset - daysInMonth;
                    } else { d = offset; }
                    const ymd = formatYMD(y, m, d);
                    const isSelected = (y === state.y && m === state.m && d === state.d);
                    const isToday = (y === todayY && m === todayM && d === todayD);
                    cells.push({ y, m, d, ymd, out, isSelected, isToday });
                }

                var weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                var daysHtml = cells.map(function (c) {
                    var cls = 'estimate-date-picker-day-btn';
                    if (c.out) cls += ' is-out';
                    if (c.isSelected) cls += ' is-selected';
                    if (c.isToday) cls += ' is-today';
                    return '<button type="button" class="' + cls + '" data-ymd="' + c.ymd + '">' + c.d + '</button>';
                }).join('');

                var viewHtml = '\
<div class="estimate-date-picker-shell">\
  <div class="estimate-date-picker-header">\
    <div class="estimate-date-picker-year-nav">\
      <button type="button" class="estimate-date-picker-icon-btn" id="perfDateYearPrev" aria-label="이전 연도">‹</button>\
      <button type="button" class="estimate-date-picker-year-label-btn" id="perfDateYearLabel" aria-label="연도 선택">\
        ' + state.y + '년\
      </button>\
      <button type="button" class="estimate-date-picker-icon-btn" id="perfDateYearNext" aria-label="다음 연도">›</button>\
    </div>\
    <div class="estimate-date-picker-month-nav">\
      <button type="button" class="estimate-date-picker-icon-btn" id="perfDateMonthPrev" aria-label="이전 달">‹</button>\
      <span class="estimate-date-picker-month-label">' + state.m + '월</span>\
      <button type="button" class="estimate-date-picker-icon-btn" id="perfDateMonthNext" aria-label="다음 달">›</button>\
    </div>\
  </div>\
  <div class="estimate-date-picker-weekdays">\
    ' + weekdays.map(function (w) { return '<div class="estimate-date-picker-weekday">' + w + '</div>'; }).join('') + '\
  </div>\
  <div class="estimate-date-picker-days">' + daysHtml + '</div>\
  <div class="estimate-date-picker-footer">\
    <button type="button" class="estimate-date-picker-text-btn" id="perfDateClear">지우기</button>\
    <button type="button" class="estimate-date-picker-text-btn" id="perfDateToday">오늘</button>\
  </div>\
</div>';
                panel.innerHTML = viewHtml;
            }
            function renderYearView() {
                panel.innerHTML = '';
                updateDisplayButtons();
                var grid = '';
                var pageLabel = state.yearPage0 + '–' + (state.yearPage0 + 11);
                for (var i = 0; i < 12; i++) {
                    var y = state.yearPage0 + i;
                    var cls = 'estimate-date-picker-year-cell';
                    if (y === state.y) cls += ' is-selected';
                    grid += '<button type="button" class="' + cls + '" data-year="' + y + '">' + y + '</button>';
                }
                var viewHtml = '\
<div class="estimate-date-picker-shell">\
  <div class="estimate-date-picker-header">\
    <div class="estimate-date-picker-year-nav">\
      <button type="button" class="estimate-date-picker-icon-btn" id="perfDateYearPagePrev" aria-label="연도 구간 이전">‹</button>\
      <span class="estimate-date-picker-month-label">' + pageLabel + '</span>\
      <button type="button" class="estimate-date-picker-icon-btn" id="perfDateYearPageNext" aria-label="연도 구간 다음">›</button>\
    </div>\
  </div>\
  <div class="estimate-date-picker-year-grid">' + grid + '</div>\
  <div class="estimate-date-picker-footer">\
    <button type="button" class="estimate-date-picker-text-btn" id="perfDateBackToMonths">닫기</button>\
    <button type="button" class="estimate-date-picker-text-btn" id="perfDateToday">오늘</button>\
  </div>\
</div>';
                panel.innerHTML = viewHtml;
            }
            function render() { if (state.view === 'year') renderYearView(); else renderMonthView(); }
            function open(which, anchorEl) {
                state.active = which;
                syncStateFromActive();
                state.view = 'month';
                render();
                positionPanel(anchorEl);
                panel.style.display = 'block';
            }
            function hide() { panel.style.display = 'none'; }
            function writeSelectedDate(ymd) {
                const hidden = getActiveHidden();
                hidden.value = ymd;
                const parsed = parseYMD(ymd);
                if (parsed) { state.y = parsed.y; state.m = parsed.m; state.d = parsed.d; }
                updateDisplayButtons();
                hide();
                // 프로젝트관리 UX처럼: 시작/종료 둘 다 선택되면 기간별 팝오버도 자동 닫기
                if (performancePeriodMode === 'range' && fromHidden.value && toHidden.value) {
                    performanceRangePopoverForcedClosed = true;
                    const rangeWrap = document.getElementById('performanceRangeWrap');
                    if (rangeWrap) rangeWrap.style.display = 'none';
                }
                renderPerformanceData();
            }

            if (!panel.dataset.hasPerformanceDatePickerListeners) {
                panel.dataset.hasPerformanceDatePickerListeners = '1';
                panel.addEventListener('mousedown', function (e) { e.stopPropagation(); });
                panel.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const btn = e.target && e.target.closest ? e.target.closest('button') : null;
                    if (!btn) return;
                    if (btn.id === 'perfDateYearPrev') { state.y -= 1; state.yearPage0 = Math.floor(state.y / 12) * 12; render(); return; }
                    if (btn.id === 'perfDateYearNext') { state.y += 1; state.yearPage0 = Math.floor(state.y / 12) * 12; render(); return; }
                    if (btn.id === 'perfDateYearLabel') { state.yearPage0 = Math.floor(state.y / 12) * 12; state.view = 'year'; render(); return; }
                    if (btn.id === 'perfDateMonthPrev') { state.m -= 1; if (state.m < 1) { state.m = 12; state.y -= 1; } state.yearPage0 = Math.floor(state.y / 12) * 12; render(); return; }
                    if (btn.id === 'perfDateMonthNext') { state.m += 1; if (state.m > 12) { state.m = 1; state.y += 1; } state.yearPage0 = Math.floor(state.y / 12) * 12; render(); return; }
                    if (btn.id === 'perfDateClear') {
                        getActiveHidden().value = '';
                        performanceRangePopoverForcedClosed = false;
                        updateDisplayButtons();
                        hide();
                        renderPerformanceData();
                        return;
                    }
                    if (btn.id === 'perfDateToday') { const t = new Date(); const ymd = formatYMD(t.getFullYear(), t.getMonth() + 1, t.getDate()); writeSelectedDate(ymd); return; }
                    if (btn.id === 'perfDateYearPagePrev') { state.yearPage0 -= 12; render(); return; }
                    if (btn.id === 'perfDateYearPageNext') { state.yearPage0 += 12; render(); return; }
                    if (btn.id === 'perfDateBackToMonths') { state.view = 'month'; render(); return; }
                    if (btn.classList && btn.classList.contains('estimate-date-picker-year-cell')) {
                        const y = parseInt(btn.getAttribute('data-year'), 10);
                        if (!isNaN(y)) { state.y = y; state.yearPage0 = Math.floor(state.y / 12) * 12; state.view = 'month'; render(); }
                        return;
                    }
                    if (btn.classList && btn.classList.contains('estimate-date-picker-day-btn')) {
                        const ymd = btn.getAttribute('data-ymd');
                        if (ymd) writeSelectedDate(ymd);
                        return;
                    }
                });
            }

            fromBtn.addEventListener('click', function (e) { e.stopPropagation(); open('from', e.currentTarget); });
            toBtn.addEventListener('click', function (e) { e.stopPropagation(); open('to', e.currentTarget); });
            updateDisplayButtons();

            // 외부(기간 모드 전환 등)에서 "레이아웃 확정 후" 열 수 있도록 훅 제공
            window.openPerformanceDatePicker = function (which) {
                if (which === 'to') open('to', toBtn);
                else open('from', fromBtn);
            };
        }

        function getPerformanceSalesDateList(item) {
            const raw = (item.salesDates && item.salesDates.length) ? item.salesDates : (item.date ? [item.date] : []);
            return raw.map(function (x) { return String(x).trim().slice(0, 10); }).filter(function (d) {
                return /^\d{4}-\d{2}-\d{2}/.test(d);
            });
        }

        /** 월별 집계 버킷: 매출발행일 중 가장 이른 날의 연-월 */
        function getPerformanceItemMonthKey(item) {
            const dates = getPerformanceSalesDateList(item);
            if (!dates.length) return '';
            const minD = dates.reduce(function (a, b) { return a < b ? a : b; });
            return minD.slice(0, 7);
        }

        function itemMatchesPerformancePeriod(item) {
            const dates = getPerformanceSalesDateList(item);
            if (performancePeriodMode === 'all') return dates.length > 0;
            const allDates = dates;

            if (performancePeriodMode === 'month') {
                const inp = document.getElementById('performanceFilterMonth');
                const m = inp && inp.value ? inp.value.trim() : '';
                if (!/^\d{4}-\d{2}$/.test(m)) return true;
                if (!allDates.length) return false;
                return allDates.some(function (d) { return d.slice(0, 7) === m; });
            }
            if (performancePeriodMode === 'range') {
                const fromEl = document.getElementById('performanceDateFrom');
                const toEl = document.getElementById('performanceDateTo');
                let from = fromEl && fromEl.value ? fromEl.value : '';
                let to = toEl && toEl.value ? toEl.value : '';
                if (!from || !to) return true;
                if (from > to) { const t = from; from = to; to = t; }
                if (!allDates.length) return false;
                return allDates.some(function (d) { return d >= from && d <= to; });
            }
            return true;
        }

        function getLatestPerformanceMonthFromData() {
            let maxM = '';
            estimates.forEach(function (item) {
                const dates = getPerformanceSalesDateList(item);
                dates.forEach(function (d) {
                    if (/^\d{4}-\d{2}/.test(d)) {
                        const m = d.slice(0, 7);
                        if (!maxM || m > maxM) maxM = m;
                    }
                });
            });
            return maxM;
        }

        function applyPerformancePeriodControlsUI() {
            const monthlyPanel = document.getElementById('perf-panel-monthly');
            if (monthlyPanel) monthlyPanel.style.display = '';

            document.querySelectorAll('#page-performance .performance-mode-btn').forEach(btn => {
                btn.classList.toggle('active', (btn.dataset.mode || '') === performancePeriodMode);
            });

            const monthWrap = document.getElementById('performanceFilterMonthWrap');
            const rangeWrap = document.getElementById('performanceRangeWrap');
            const isMonth = performancePeriodMode === 'month';
            const isRange = performancePeriodMode === 'range';
            if (rangeWrap) rangeWrap.style.display = isRange
                ? (performanceRangePopoverForcedClosed ? 'none' : 'flex')
                : 'none';

            if (!isMonth) {
                if (monthWrap) monthWrap.style.display = 'none';
            }
            if (!isRange) {
                const dp = document.getElementById('performanceDatePickerPanel');
                if (dp) dp.style.display = 'none';
            }
        }

        function switchPerformancePeriodMode(mode) {
            // 모드 전환 시 다른 모드 값은 초기화
            const monthInp = document.getElementById('performanceFilterMonth');
            const fromEl = document.getElementById('performanceDateFrom');
            const toEl = document.getElementById('performanceDateTo');

            if (mode === 'all') {
                performanceRangePopoverForcedClosed = false;
                if (monthInp) monthInp.value = '';
                if (fromEl) fromEl.value = '';
                if (toEl) toEl.value = '';
            } else if (mode === 'month') {
                performanceRangePopoverForcedClosed = false;
                if (fromEl) fromEl.value = '';
                if (toEl) toEl.value = '';
            } else if (mode === 'range') {
                performanceRangePopoverForcedClosed = false;
                if (monthInp) monthInp.value = '';
            }

            updatePerformanceMonthButtonLabel();
            updatePerformanceRangeButtons();

            performancePeriodMode = mode === 'all' ? 'all' : mode === 'range' ? 'range' : 'month';
            applyPerformancePeriodControlsUI();
            if (performancePeriodMode === 'month') {
                const inp = document.getElementById('performanceFilterMonth');
                if (inp && !inp.value) {
                    const def = getLatestPerformanceMonthFromData();
                    if (def) inp.value = def;
                }
            }
            renderPerformanceData();

            // 프로젝트관리 UX처럼: 월별/기간별 클릭 시 패널 자동 오픈
            window.setTimeout(function () {
                const monthWrap = document.getElementById('performanceFilterMonthWrap');
                const dp = document.getElementById('performanceDatePickerPanel');

                if (performancePeriodMode === 'month') {
                    if (dp) dp.style.display = 'none';
                    if (monthWrap) monthWrap.style.display = 'block';
                    performanceMonthPickerOnOpen();
                    return;
                }

                if (performancePeriodMode === 'range') {
                    // 프로젝트관리처럼: 기간별 전환 시 달력은 자동으로 열지 않음
                    if (monthWrap) monthWrap.style.display = 'none';
                    if (dp) dp.style.display = 'none';
                    return;
                }

                // all
                if (monthWrap) monthWrap.style.display = 'none';
                if (dp) dp.style.display = 'none';
            }, 0);
        }

        function switchPerformanceRightTab(tabName) {
            // tabName: 'monthly' | 'category'
            const activeBtnDataTab = tabName === 'monthly' ? 'perf-right-monthly' : 'perf-right-category';

            document.querySelectorAll('#page-performance .performance-right-tabs .tab').forEach(btn => {
                btn.classList.toggle('active', (btn.dataset.tab || '') === activeBtnDataTab);
            });

            document.querySelectorAll('#page-performance #perf-panel-monthly .tab-panel').forEach(p => p.classList.remove('active'));
            const activePanelId = tabName === 'monthly' ? 'perf-right-panel-monthly' : 'perf-right-panel-category';
            const activePanel = document.getElementById(activePanelId);
            if (activePanel) activePanel.classList.add('active');
        }

        function getItemPurchaseTotal(item) {
            const purchase = Number(item.purchase || 0);
            const bizGross = Number(item.businessIncomeGross || 0);
            const itemType = item.type || '';

            // 사업소득은 businessIncomeGross를 매입으로 보되,
            // (초기 시드 데이터처럼) businessIncomeGross가 비어있으면 purchase 값을 fallback으로 사용
            if (itemType === '사업소득') {
                return bizGross > 0 ? bizGross : purchase;
            }

            // 세금계산서(또는 기타)는 purchase에 bizGross가 있으면 추가 반영
            return purchase + (bizGross > 0 ? bizGross : 0);
        }

        function isPerformanceAvgUnitExcluded(item) {
            return (item.category3 || '').trim() === '공사';
        }

        function getPerformanceAvgUnitTotals(items) {
            let unitRevSum = 0;
            let unitCount = 0;
            items.forEach(function (item) {
                if (isPerformanceAvgUnitExcluded(item)) return;
                unitRevSum += (item.revenue || 0);
                unitCount++;
            });
            const avgRounded = unitCount > 0 ? Math.round(unitRevSum / unitCount) : 0;
            return { unitRevSum: unitRevSum, unitCount: unitCount, avgRounded: avgRounded };
        }

        function formatPerformanceAvgUnitTd(unitCount, avgRounded) {
            if (!unitCount || unitCount <= 0) {
                return '<td class="text-right"><span style="color: var(--gray-500);">-</span></td>';
            }
            return `<td class="text-right">${avgRounded.toLocaleString()}원</td>`;
        }

        function renderPerformanceData() {
            applyPerformancePeriodControlsUI();
            if (performancePeriodMode === 'month') {
                const inp = document.getElementById('performanceFilterMonth');
                if (inp && !inp.value) {
                    const def = getLatestPerformanceMonthFromData();
                    if (def) inp.value = def;
                }
            }

            const data = estimates.filter(itemMatchesPerformancePeriod);
            const sgaData = sgaExpenses.filter(sgaItemMatchesPerformancePeriod);
            const includeSga = performanceSgaMode === 'include';
            const totalSga = sgaData.reduce(function(sum, item) { return sum + (Number(item.amount) || 0); }, 0);

            const avgTotalsAll = getPerformanceAvgUnitTotals(data);

            // KPI 카드 업데이트
            const totalRevenue = data.reduce((sum, item) => sum + (item.revenue || 0), 0);
            const totalPurchase = data.reduce((sum, item) => sum + getItemPurchaseTotal(item), 0);
            const totalProfit = totalRevenue - totalPurchase - (includeSga ? totalSga : 0);
            const margin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;

            document.getElementById('kpiRevenue').textContent = totalRevenue.toLocaleString() + '원';
            document.getElementById('kpiProfit').textContent = totalProfit.toLocaleString() + '원';
            document.getElementById('kpiMargin').textContent = margin.toFixed(1) + '%';
            document.getElementById('kpiAverage').textContent = avgTotalsAll.unitCount > 0
                ? avgTotalsAll.avgRounded.toLocaleString() + '원'
                : '-';
            const kpiSga = document.getElementById('kpiSga');
            const kpiSgaCard = document.getElementById('kpiSgaCard');
            const kpiGrid = document.getElementById('performanceKpiGrid');
            if (kpiSga) kpiSga.textContent = totalSga.toLocaleString() + '원';
            if (kpiSgaCard) kpiSgaCard.style.display = includeSga ? '' : 'none';
            if (kpiGrid) {
                kpiGrid.classList.toggle('kpi-grid--include-sga', includeSga);
                kpiGrid.classList.toggle('kpi-grid--exclude-sga', !includeSga);
            }
            const kpiProfitLabel = document.getElementById('kpiProfitLabel');
            const kpiMarginLabel = document.getElementById('kpiMarginLabel');
            if (kpiProfitLabel) kpiProfitLabel.textContent = includeSga ? '순수익(판관비 포함)' : '순수익';
            if (kpiMarginLabel) kpiMarginLabel.textContent = includeSga ? '수익률(판관비 포함)' : '수익률';
            const sgaHeader = document.getElementById('performanceSgaHeader');
            if (sgaHeader) sgaHeader.style.display = includeSga ? '' : 'none';

            // 월별 테이블 (매출발행일 기준 월 버킷)
            const byMonth = {};
            data.forEach(item => {
                const month = getPerformanceItemMonthKey(item);
                if (!month) return;
                if (!byMonth[month]) {
                    byMonth[month] = { month, count: 0, revenue: 0, purchase: 0, sga: 0, unitRevSum: 0, unitCount: 0 };
                }
                byMonth[month].count++;
                byMonth[month].revenue += (item.revenue || 0);
                byMonth[month].purchase += getItemPurchaseTotal(item);
                if (!isPerformanceAvgUnitExcluded(item)) {
                    byMonth[month].unitRevSum += (item.revenue || 0);
                    byMonth[month].unitCount++;
                }
            });
            sgaData.forEach(function(item) {
                const month = item.date && String(item.date).trim().slice(0, 7);
                if (!month) return;
                if (!byMonth[month]) {
                    byMonth[month] = { month: month, count: 0, revenue: 0, purchase: 0, sga: 0, unitRevSum: 0, unitCount: 0 };
                }
                byMonth[month].sga += (Number(item.amount) || 0);
            });

            const monthlyData = Object.values(byMonth).map(stats => ({
                ...stats,
                profit: stats.revenue - stats.purchase - (includeSga ? stats.sga : 0),
                margin: stats.revenue > 0 ? ((stats.revenue - stats.purchase - (includeSga ? stats.sga : 0)) / stats.revenue * 100) : 0,
                avgUnitRounded: stats.unitCount > 0 ? Math.round(stats.unitRevSum / stats.unitCount) : 0
            })).sort((a, b) => b.month.localeCompare(a.month));

            const monthlyBody = document.getElementById('performanceMonthlyTableBody');
            const perfMonthlyTable = document.querySelector('#perf-right-panel-monthly table');
            if (perfMonthlyTable) perfMonthlyTable.classList.toggle('perf-monthly--sga', includeSga);
            if (monthlyBody) {
                if (monthlyData.length === 0) {
                    monthlyBody.innerHTML = '<tr><td colspan="' + (includeSga ? 8 : 7) + '" style="text-align: center; padding: 40px; color: var(--gray-500);">데이터가 없습니다</td></tr>';
                } else {
                    const totals = monthlyData.reduce((sum, item) => ({
                        count: sum.count + item.count,
                        revenue: sum.revenue + item.revenue,
                        purchase: sum.purchase + item.purchase,
                        sga: sum.sga + (item.sga || 0),
                        profit: sum.profit + item.profit
                    }), { count: 0, revenue: 0, purchase: 0, sga: 0, profit: 0 });

                    const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue * 100) : 0;

                    monthlyBody.innerHTML = monthlyData.map(item => `
                        <tr>
                            <td>${item.month.substring(5)}월</td>
                            <td class="text-right">${item.count}건</td>
                            <td class="text-right">${item.revenue.toLocaleString()}원</td>
                            <td class="text-right">${item.purchase.toLocaleString()}원</td>
                            ${includeSga ? `<td class="text-right">${(item.sga || 0).toLocaleString()}원</td>` : ''}
                            <td class="text-right">${item.profit.toLocaleString()}원</td>
                            <td class="text-right">${item.margin.toFixed(1)}%</td>
                            ${formatPerformanceAvgUnitTd(item.unitCount, item.avgUnitRounded)}
                        </tr>
                    `).join('') + `
                        <tr class="total-row">
                            <td>합계</td>
                            <td class="text-right">${totals.count}건</td>
                            <td class="text-right">${totals.revenue.toLocaleString()}원</td>
                            <td class="text-right">${totals.purchase.toLocaleString()}원</td>
                            ${includeSga ? `<td class="text-right">${(totals.sga || 0).toLocaleString()}원</td>` : ''}
                            <td class="text-right">${totals.profit.toLocaleString()}원</td>
                            <td class="text-right">${totalMargin.toFixed(1)}%</td>
                            ${formatPerformanceAvgUnitTd(avgTotalsAll.unitCount, avgTotalsAll.avgRounded)}
                        </tr>
                    `;
                }
            }

            // 전체기간 분류별(대분류/중분류)
            const categoryOverallByKey = {};
            data.forEach(item => {
                const c1 = (item.category1 || '').trim() || '-';
                const c2 = (item.category2 || '').trim() || '-';
                const key = c1 + '||' + c2;
                if (!categoryOverallByKey[key]) {
                    categoryOverallByKey[key] = {
                        category1: c1,
                        category2: c2,
                        count: 0,
                        revenue: 0,
                        purchase: 0,
                        unitRevSum: 0,
                        unitCount: 0
                    };
                }
                const row = categoryOverallByKey[key];
                row.count++;
                row.revenue += (item.revenue || 0);
                row.purchase += getItemPurchaseTotal(item);
                if (!isPerformanceAvgUnitExcluded(item)) {
                    row.unitRevSum += (item.revenue || 0);
                    row.unitCount++;
                }
            });
            const sgaShareFactorOverall = includeSga && totalRevenue > 0 ? totalSga / totalRevenue : 0;

            const categoryOverallArr = Object.values(categoryOverallByKey).map(s => ({
                ...s,
                profit: s.revenue - s.purchase - Math.round(s.revenue * sgaShareFactorOverall),
                margin: s.revenue > 0 ? ((s.revenue - s.purchase - Math.round(s.revenue * sgaShareFactorOverall)) / s.revenue * 100) : 0,
                avgUnitRounded: s.unitCount > 0 ? Math.round(s.unitRevSum / s.unitCount) : 0
            })).sort((a, b) => {
                if (a.category1 !== b.category1) return a.category1.localeCompare(b.category1);
                return a.category2.localeCompare(b.category2);
            });

            function performanceMarginPct(revenue, purchase) {
                const rev = Number(revenue) || 0;
                return rev > 0 ? ((rev - purchase) / rev * 100) : 0;
            }

            function buildCategoryOverallRowsWithSubtotals(rows) {
                let html = '';
                let i = 0;
                while (i < rows.length) {
                    const c1 = rows[i].category1;
                    let subCount = 0;
                    let subRev = 0;
                    let subPur = 0;
                    let subUnitRevSum = 0;
                    let subUnitCount = 0;
                    while (i < rows.length && rows[i].category1 === c1) {
                        const row = rows[i];
                        html += `
                        <tr>
                            <td>${row.category1}</td>
                            <td>${row.category2}</td>
                            <td class="text-right">${row.count}건</td>
                            <td class="text-right">${row.revenue.toLocaleString()}원</td>
                            <td class="text-right">${row.purchase.toLocaleString()}원</td>
                            <td class="text-right">${row.profit.toLocaleString()}원</td>
                            <td class="text-right">${row.margin.toFixed(1)}%</td>
                            ${formatPerformanceAvgUnitTd(row.unitCount, row.avgUnitRounded)}
                        </tr>`;
                        subCount += row.count;
                        subRev += row.revenue;
                        subPur += row.purchase;
                        subUnitRevSum += row.unitRevSum || 0;
                        subUnitCount += row.unitCount || 0;
                        i++;
                    }
                    const subAllocatedSga = includeSga ? Math.round(subRev * sgaShareFactorOverall) : 0;
                    const subProfit = subRev - subPur - subAllocatedSga;
                    const subMargin = subRev > 0 ? ((subProfit / subRev) * 100) : 0;
                    const subAvgRounded = subUnitCount > 0 ? Math.round(subUnitRevSum / subUnitCount) : 0;
                    html += `
                        <tr class="total-row">
                            <td colspan="2"><strong>${c1} 소계</strong></td>
                            <td class="text-right">${subCount}건</td>
                            <td class="text-right">${subRev.toLocaleString()}원</td>
                            <td class="text-right">${subPur.toLocaleString()}원</td>
                            <td class="text-right">${subProfit.toLocaleString()}원</td>
                            <td class="text-right">${subMargin.toFixed(1)}%</td>
                            ${formatPerformanceAvgUnitTd(subUnitCount, subAvgRounded)}
                        </tr>`;
                }
                return html;
            }

            const categoryOverallBody = document.getElementById('performanceCategoryOverallTableBody');
            if (categoryOverallBody) {
                if (categoryOverallArr.length === 0) {
                    categoryOverallBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--gray-500);">데이터가 없습니다</td></tr>';
                } else {
                    categoryOverallBody.innerHTML = buildCategoryOverallRowsWithSubtotals(categoryOverallArr);
                }
            }

            // 월별 분류별(대분류/중분류, 매출발행일 기준 월)
            const categoryMonthlyByKey = {};
            const monthlySgaMap = {};
            sgaData.forEach(function(item) {
                const month = item.date && String(item.date).trim().slice(0, 7);
                if (!month) return;
                monthlySgaMap[month] = (monthlySgaMap[month] || 0) + (Number(item.amount) || 0);
            });
            data.forEach(item => {
                const month = getPerformanceItemMonthKey(item);
                if (!month) return;
                const c1 = (item.category1 || '').trim() || '-';
                const c2 = (item.category2 || '').trim() || '-';
                const key = month + '||' + c1 + '||' + c2;
                if (!categoryMonthlyByKey[key]) {
                    categoryMonthlyByKey[key] = {
                        month: month,
                        category1: c1,
                        category2: c2,
                        count: 0,
                        revenue: 0,
                        purchase: 0,
                        unitRevSum: 0,
                        unitCount: 0
                    };
                }
                const row = categoryMonthlyByKey[key];
                row.count++;
                row.revenue += (item.revenue || 0);
                row.purchase += getItemPurchaseTotal(item);
                if (!isPerformanceAvgUnitExcluded(item)) {
                    row.unitRevSum += (item.revenue || 0);
                    row.unitCount++;
                }
            });

            const categoryMonthlyArr = Object.values(categoryMonthlyByKey).map(s => ({
                ...s,
                profit: (function() {
                    if (!includeSga) return s.revenue - s.purchase;
                    const monthRowsRevenue = Object.values(categoryMonthlyByKey)
                        .filter(function(r) { return r.month === s.month; })
                        .reduce(function(sum, r) { return sum + (r.revenue || 0); }, 0);
                    const monthSga = monthlySgaMap[s.month] || 0;
                    const allocated = monthRowsRevenue > 0 ? Math.round((s.revenue / monthRowsRevenue) * monthSga) : 0;
                    return s.revenue - s.purchase - allocated;
                })(),
                margin: (function() {
                    if (s.revenue <= 0) return 0;
                    const monthRowsRevenue = Object.values(categoryMonthlyByKey)
                        .filter(function(r) { return r.month === s.month; })
                        .reduce(function(sum, r) { return sum + (r.revenue || 0); }, 0);
                    const monthSga = includeSga ? (monthlySgaMap[s.month] || 0) : 0;
                    const allocated = includeSga && monthRowsRevenue > 0 ? Math.round((s.revenue / monthRowsRevenue) * monthSga) : 0;
                    return ((s.revenue - s.purchase - allocated) / s.revenue * 100);
                })(),
                avgUnitRounded: s.unitCount > 0 ? Math.round(s.unitRevSum / s.unitCount) : 0
            })).sort((a, b) => {
                if (b.month !== a.month) return b.month.localeCompare(a.month);
                if (a.category1 !== b.category1) return a.category1.localeCompare(b.category1);
                return a.category2.localeCompare(b.category2);
            });

            function buildCategoryMonthlyRowsWithSubtotals(rows) {
                let html = '';
                let subKey = '';
                let subCount = 0;
                let subRev = 0;
                let subPur = 0;
                let subUnitRevSum = 0;
                let subUnitCount = 0;
                let subMonthLabel = '';
                let subMonthKey = '';
                let subC1 = '';

                function flushSubtotalIfNeeded() {
                    if (!subKey) return;
                    const monthSga = includeSga ? (monthlySgaMap[subMonthKey] || 0) : 0;
                    const subProfit = subRev - subPur - monthSga;
                    const subMargin = subRev > 0 ? ((subProfit / subRev) * 100) : 0;
                    const subAvgRounded = subUnitCount > 0 ? Math.round(subUnitRevSum / subUnitCount) : 0;
                    html += `
                        <tr class="total-row">
                            <td>${subMonthLabel}</td>
                            <td colspan="2"><strong>${subC1} 소계</strong></td>
                            <td class="text-right">${subCount}건</td>
                            <td class="text-right">${subRev.toLocaleString()}원</td>
                            <td class="text-right">${subPur.toLocaleString()}원</td>
                            <td class="text-right">${subProfit.toLocaleString()}원</td>
                            <td class="text-right">${subMargin.toFixed(1)}%</td>
                            ${formatPerformanceAvgUnitTd(subUnitCount, subAvgRounded)}
                        </tr>`;
                    subKey = '';
                    subCount = 0;
                    subRev = 0;
                    subPur = 0;
                    subUnitRevSum = 0;
                    subUnitCount = 0;
                }

                rows.forEach(row => {
                    const key = row.month + '||' + row.category1;
                    if (subKey && key !== subKey) flushSubtotalIfNeeded();
                    if (!subKey || key !== subKey) {
                        subKey = key;
                        subMonthKey = row.month;
                        subMonthLabel = row.month.substring(5) + '월';
                        subC1 = row.category1;
                    }
                    html += `
                        <tr>
                            <td>${row.month.substring(5)}월</td>
                            <td>${row.category1}</td>
                            <td>${row.category2}</td>
                            <td class="text-right">${row.count}건</td>
                            <td class="text-right">${row.revenue.toLocaleString()}원</td>
                            <td class="text-right">${row.purchase.toLocaleString()}원</td>
                            <td class="text-right">${row.profit.toLocaleString()}원</td>
                            <td class="text-right">${row.margin.toFixed(1)}%</td>
                            ${formatPerformanceAvgUnitTd(row.unitCount, row.avgUnitRounded)}
                        </tr>`;
                    subCount += row.count;
                    subRev += row.revenue;
                    subPur += row.purchase;
                    subUnitRevSum += row.unitRevSum || 0;
                    subUnitCount += row.unitCount || 0;
                });
                flushSubtotalIfNeeded();
                return html;
            }

            const categoryMonthlyBody = document.getElementById('performanceCategoryMonthlyTableBody');
            if (categoryMonthlyBody) {
                if (categoryMonthlyArr.length === 0) {
                    categoryMonthlyBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--gray-500);">데이터가 없습니다</td></tr>';
                } else {
                    categoryMonthlyBody.innerHTML = buildCategoryMonthlyRowsWithSubtotals(categoryMonthlyArr);
                }
            }
        }

        // ========================================
        // 주간보고 JavaScript
        // ========================================

        
        function renderWeeklyReport() {
            const today = new Date();
            const todayDow = today.getDay(); // 0:Sun ... 6:Sat
            const diffToMonday = todayDow === 0 ? 6 : (todayDow - 1);

            const thisWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday);
            thisWeekStart.setHours(0, 0, 0, 0);
            const thisWeekEnd = new Date(thisWeekStart);
            thisWeekEnd.setDate(thisWeekStart.getDate() + 6);

            const prevWeekStart = new Date(thisWeekStart);
            prevWeekStart.setDate(thisWeekStart.getDate() - 7);
            const prevWeekEnd = new Date(prevWeekStart);
            prevWeekEnd.setDate(prevWeekStart.getDate() + 6);

            function ymd(d) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return y + '-' + m + '-' + day;
            }
            function md(d) {
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return m + '/' + day;
            }
            function getDoneDate(item) {
                const d = item && item.endDate ? String(item.endDate).trim().slice(0, 10) : '';
                return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
            }
            function buildCompletedListHtml(items) {
                if (!items.length) {
                    return '<li style="text-align: center; padding: 40px; color: var(--gray-500);"><i class="fas fa-inbox" style="font-size: 48px; opacity: 0.3; margin-bottom: 12px;"></i><p>완료된 건이 없습니다</p></li>';
                }
                return items.map(function (item) {
                    const doneLabel = getDoneDate(item) || '완료일 미기재';
                    return `
                    <li style="padding: 16px; border-bottom: 1px solid var(--gray-100); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; margin-bottom: 4px;">${item.building} - ${item.project}</div>
                            <div style="font-size: 13px; color: var(--gray-600);">${doneLabel} | ${item.contractor}</div>
                        </div>
                        <div style="font-weight: 700; color: var(--primary);">${item.revenue.toLocaleString()}원</div>
                    </li>
                `;
                }).join('');
            }

            const thisStart = ymd(thisWeekStart);
            const thisEnd = ymd(thisWeekEnd);
            const prevStart = ymd(prevWeekStart);
            const prevEnd = ymd(prevWeekEnd);
            const weeklyInfo = document.getElementById('weeklyWeekInfo');
            if (weeklyInfo) weeklyInfo.textContent = `금주(${md(thisWeekStart)}~${md(thisWeekEnd)})`;

            const completedAll = estimates.filter(function (e) { return e.status === '완료'; });
            const prevCompleted = completedAll.filter(function (e) {
                const d = getDoneDate(e);
                return d && d >= prevStart && d <= prevEnd;
            });
            const thisCompletedByDate = completedAll.filter(function (e) {
                const d = getDoneDate(e);
                return d && d >= thisStart && d <= thisEnd;
            });
            const undatedCompleted = completedAll.filter(function (e) { return !getDoneDate(e); });
            const thisCompleted = thisCompletedByDate.concat(undatedCompleted);

            const prevCountEl = document.getElementById('weeklyPrevCompleteCount');
            if (prevCountEl) prevCountEl.textContent = prevCompleted.length;
            const prevListEl = document.getElementById('weeklyPrevCompleteList');
            if (prevListEl) prevListEl.innerHTML = buildCompletedListHtml(prevCompleted);

            const thisCountEl = document.getElementById('weeklyCompleteCount');
            if (thisCountEl) thisCountEl.textContent = thisCompleted.length;
            const thisListEl = document.getElementById('weeklyCompleteList');
            if (thisListEl) thisListEl.innerHTML = buildCompletedListHtml(thisCompleted);
        }

        function downloadWeeklyCSV() {
            alert('CSV 다운로드 기능은 개발 중입니다.');
        }

        function copyWeeklyToClipboard() {
            alert('보고서 복사 기능은 개발 중입니다.');
        }

        // ========================================
        // 미수금 JavaScript
        // ========================================

        /** 매출 내역(salesDates)에서 유효한 YYYY-MM-DD만 모아, 표시·정렬용으로 가장 늦은(최신) 매출일자 */
        function getUnpaidSalesDisplayDate(item) {
            const raw = (item.salesDates && item.salesDates.length) ? item.salesDates : [];
            const dates = raw.map(function (x) {
                return String(x).trim().slice(0, 10);
            }).filter(function (d) {
                return /^\d{4}-\d{2}-\d{2}/.test(d);
            });
            if (!dates.length) return '';
            return dates.reduce(function (max, d) {
                return d > max ? d : max;
            }, dates[0]);
        }

        function renderUnpaidData() {
            const unpaidItems = estimates.filter(function (e) {
                const cat = String(e.category1 || '').trim();
                if (cat !== 'B2C') return false;
                if (e.paidStatus !== '미수' && e.paidStatus !== '부분') return false;
                return !!getUnpaidSalesDisplayDate(e);
            }).slice();
            unpaidItems.sort(function (a, b) {
                const aSales = getUnpaidSalesDisplayDate(a);
                const bSales = getUnpaidSalesDisplayDate(b);
                if (aSales === bSales) return 0;
                return aSales < bSales ? 1 : -1;
            });

            const vatExclusive = (amount) => Math.round((Number(amount) || 0) / 1.1);
            const fullUnpaidNet = unpaidItems
                .filter(e => e.paidStatus === '미수')
                .reduce((sum, item) => sum + vatExclusive(item.revenue), 0);
            const partialUnpaidNet = unpaidItems
                .filter(e => e.paidStatus === '부분')
                .reduce((sum, item) => sum + Math.round(vatExclusive(item.revenue) * 0.5), 0); // 가정: 50% 미수
            const totalUnpaidNet = fullUnpaidNet + partialUnpaidNet;

            const countEl = document.getElementById('unpaidCount');
            if (countEl) countEl.textContent = unpaidItems.length.toLocaleString() + '건';
            const totalEl = document.getElementById('totalUnpaid');
            if (totalEl) totalEl.textContent = totalUnpaidNet.toLocaleString() + '원';

            // 테이블
            const tbody = document.getElementById('unpaidTableBody');
            if (unpaidItems.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--gray-500);">미수금 내역이 없습니다</td></tr>';
            } else {
                tbody.innerHTML = unpaidItems.map((item, idx) => {
                    const salesDate = getUnpaidSalesDisplayDate(item);
                    const revenueNet = vatExclusive(item.revenue);
                    return `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>${salesDate}</td>
                            <td>${item.building}</td>
                            <td>${item.project}</td>
                            <td class="text-right">${revenueNet.toLocaleString()}원</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        function downloadUnpaidCSV() {
            alert('CSV 다운로드 기능은 개발 중입니다.');
        }

        // ========================================
        // 관리자설정 JavaScript
        // ========================================
        const ROLE_OPTIONS_BY_TYPE = {
            internal: ['슈퍼관리자', '관리자', '직원', '회계팀'],
            external: ['도급사']
        };
        const PAGE_ACCESS_ORDER = ['dashboard', 'estimate', 'performance', 'weekly', 'unpaid', 'contractors', 'expenses', 'sga', 'users'];
        const PAGE_ACCESS_LABELS = {
            dashboard: '대시보드',
            estimate: '프로젝트 관리',
            performance: '경영실적관리',
            weekly: '주간보고',
            unpaid: '미수금',
            contractors: '업체정보관리',
            expenses: '경비지출관리',
            sga: '판관비관리',
            users: '관리자설정'
        };
        const USER_ACCOUNTS_KEY = 'bps_user_accounts';

        function safeLoadUserAccounts() {
            try {
                const raw = localStorage.getItem(USER_ACCOUNTS_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : null;
            } catch (e) {
                return null;
            }
        }

        function persistUserAccounts() {
            try {
                localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(userAccounts));
            } catch (e) {
                // 저장 실패 시에도 UX 유지
            }
        }

        let userAccounts = safeLoadUserAccounts() || [
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
        let currentManagingAccountUserId = '';
        let currentManagingExtraAllowedPages = [];
        let isCreatingAccount = false;

        function normalizeAccountType(type) {
            return type === 'external' ? 'external' : 'internal';
        }

        function getRoleOptionsByType(type) {
            return ROLE_OPTIONS_BY_TYPE[normalizeAccountType(type)] || ROLE_OPTIONS_BY_TYPE.internal;
        }

        function getBaseAllowedPages(type, role) {
            const normalizedType = normalizeAccountType(type);
            const roleName = String(role || '');
            if (normalizedType === 'external') return ['dashboard', 'estimate'];
            if (roleName === '슈퍼관리자') return ['dashboard', 'estimate', 'performance', 'weekly', 'unpaid', 'contractors', 'expenses', 'sga', 'users'];
            if (roleName === '관리자') return ['dashboard', 'estimate', 'performance', 'weekly', 'unpaid', 'contractors', 'expenses', 'sga'];
            if (roleName === '회계팀') return ['dashboard', 'estimate', 'performance', 'unpaid', 'expenses', 'sga'];
            if (roleName === '직원') return ['dashboard', 'estimate', 'weekly'];
            return ['dashboard', 'estimate'];
        }

        function mergeAllowedPages(basePages, extraPages) {
            const set = new Set([...(basePages || []), ...((extraPages || []).filter(function (p) { return PAGE_ACCESS_ORDER.includes(p); }))]);
            return PAGE_ACCESS_ORDER.filter(function (p) { return set.has(p); });
        }

        function getAllowedPagesForCurrentUser() {
            const base = getBaseAllowedPages(currentUserAccessProfile.type, currentUserAccessProfile.role);
            return mergeAllowedPages(base, currentUserAccessProfile.extraAllowedPages || []);
        }

        function applyRoleBasedNavigation() {
            const allowed = getAllowedPagesForCurrentUser();
            const navItems = document.querySelectorAll('.nav-item[data-page]');
            navItems.forEach(function (item) {
                const page = item.dataset.page || '';
                item.style.display = allowed.includes(page) ? '' : 'none';
            });
            const currentHash = window.location.hash.slice(1);
            if (currentHash && !allowed.includes(currentHash)) {
                const fallback = allowed[0] || 'dashboard';
                showPage(fallback);
            }
        }

        function isCurrentUserExternalContractor() {
            return normalizeAccountType(currentUserAccessProfile.type) === 'external' && currentUserAccessProfile.role === '도급사';
        }

        function canCurrentUserSeeEstimateMonetary() {
            return !isCurrentUserExternalContractor();
        }

        function canCurrentUserAccessEstimateItem(item) {
            if (!isCurrentUserExternalContractor()) return true;
            const myUserId = String(currentUserAccessProfile.userId || '').trim();
            const myName = String(currentUserAccessProfile.name || '').trim();
            const myContractor = String(currentUserAccessProfile.contractorName || '').trim();
            const createdBy = String(item.createdBy || '').trim();
            const manager = String(item.manager || '').trim();
            const contractor = String(item.contractor || '').trim();
            const ownCreated = (!!myUserId && createdBy === myUserId) || (!!myName && manager === myName);
            const sameContractor = !!myContractor && contractor === myContractor;
            return ownCreated || sameContractor;
        }

        function renderUserRoleOptions(selectEl, type, selectedRole) {
            if (!selectEl) return;
            const roles = getRoleOptionsByType(type);
            const fallbackRole = roles[0] || '';
            const roleValue = roles.includes(selectedRole) ? selectedRole : fallbackRole;
            selectEl.innerHTML = roles.map(function (r) {
                return '<option value="' + escapeHtmlAttr(r) + '"' + (r === roleValue ? ' selected' : '') + '>' + escapeHtmlAttr(r) + '</option>';
            }).join('');
        }

        function renderUserManagePageAccess() {
            const typeInput = document.querySelector('input[name="userManageType"]:checked');
            const roleSelect = document.getElementById('userManageRole');
            const wrap = document.getElementById('userManagePageAccess');
            const preview = document.getElementById('userManagePageAccessPreview');
            if (!roleSelect || !wrap) return;
            const type = typeInput ? normalizeAccountType(typeInput.value) : 'internal';
            const role = roleSelect.value;
            const baseAllowed = getBaseAllowedPages(type, role);
            wrap.innerHTML = PAGE_ACCESS_ORDER.map(function (pageKey) {
                const isBase = baseAllowed.includes(pageKey);
                const isChecked = isBase || currentManagingExtraAllowedPages.includes(pageKey);
                const badgeHtml = isBase
                    ? '<span class="user-access-badge user-access-badge--base">기본</span>'
                    : '<span class="user-access-badge user-access-badge--extra">추가</span>';
                return '<label class="user-access-row">' +
                    '<span class="user-access-row-label">' + escapeHtmlAttr(PAGE_ACCESS_LABELS[pageKey] || pageKey) + badgeHtml + '</span>' +
                    '<span class="user-access-toggle' + (isChecked ? ' is-active' : '') + (isBase ? ' is-disabled' : '') + '">' +
                    '<input type="checkbox" class="user-access-toggle-input" ' + (isChecked ? 'checked ' : '') + (isBase ? 'disabled ' : '') + 'onchange="toggleUserExtraPageAccess(\'' + pageKey + '\', this.checked)">' +
                    '<span class="user-access-toggle-track"><span class="user-access-toggle-thumb"></span></span>' +
                    '</span>' +
                    '</label>';
            }).join('');
            if (preview) {
                const effective = mergeAllowedPages(baseAllowed, currentManagingExtraAllowedPages);
                preview.textContent = '최종 허용: ' + effective.map(function (p) { return PAGE_ACCESS_LABELS[p] || p; }).join(', ');
            }
        }

        function toggleUserExtraPageAccess(pageKey, checked) {
            if (!PAGE_ACCESS_ORDER.includes(pageKey)) return;
            const typeInput = document.querySelector('input[name="userManageType"]:checked');
            const roleSelect = document.getElementById('userManageRole');
            const type = typeInput ? normalizeAccountType(typeInput.value) : 'internal';
            const role = roleSelect ? roleSelect.value : '';
            const baseAllowed = getBaseAllowedPages(type, role);
            if (baseAllowed.includes(pageKey)) return;
            if (checked) {
                if (!currentManagingExtraAllowedPages.includes(pageKey)) currentManagingExtraAllowedPages.push(pageKey);
            } else {
                currentManagingExtraAllowedPages = currentManagingExtraAllowedPages.filter(function (p) { return p !== pageKey; });
            }
            renderUserManagePageAccess();
        }

        function updateUserManagePanelByType() {
            const typeInput = document.querySelector('input[name="userManageType"]:checked');
            const roleSelect = document.getElementById('userManageRole');
            const contractorRow = document.getElementById('userManageContractorRow');
            const type = typeInput ? typeInput.value : 'internal';
            const prevRole = roleSelect ? roleSelect.value : '';
            renderUserRoleOptions(roleSelect, type, prevRole);
            if (contractorRow) contractorRow.style.display = normalizeAccountType(type) === 'external' ? '' : 'none';
            renderUserManagePageAccess();
        }

        function switchAdminSettingsTab(tabName) {
            const isAccount = tabName === 'account';
            const tabAccount = document.getElementById('adminSettingsTabAccount');
            const tabFilterValues = document.getElementById('adminSettingsTabFilterValues');
            const btnAccount = document.getElementById('adminTabBtnAccount');
            const btnFilterValues = document.getElementById('adminTabBtnFilterValues');
            const addAccountBtn = document.getElementById('adminAddAccountBtn');

            if (tabAccount) tabAccount.classList.toggle('active', isAccount);
            if (tabFilterValues) tabFilterValues.classList.toggle('active', !isAccount);
            if (btnAccount) btnAccount.classList.toggle('active', isAccount);
            if (btnFilterValues) btnFilterValues.classList.toggle('active', !isAccount);
            if (addAccountBtn) addAccountBtn.style.display = isAccount ? '' : 'none';
        }

        function getRoleBadgeHtml(role) {
            const r = String(role || '').trim();
            const roleClass = {
                '슈퍼관리자': 'user-role-badge--super',
                '관리자': 'user-role-badge--manager',
                '회계팀': 'user-role-badge--accounting',
                '직원': 'user-role-badge--staff',
                '도급사': 'user-role-badge--contractor'
            }[r] || 'user-role-badge--default';
            return '<span class="badge user-role-badge ' + roleClass + '">' + escapeHtmlAttr(role || '-') + '</span>';
        }

        function renderUsersTable() {
            const tbody = document.getElementById('usersTableBody');
            if (!tbody) return;
            tbody.innerHTML = userAccounts.map(function (u) {
                const isActive = u.active !== false;
                return '<tr>' +
                    '<td style="font-weight: 600;">' + escapeHtmlAttr(u.name || '-') + '</td>' +
                    '<td>' + escapeHtmlAttr(u.userId || '-') + '</td>' +
                    '<td>' + getRoleBadgeHtml(u.role || '-') + '</td>' +
                    '<td style="text-align: center;">' +
                    '<button type="button" class="master-state-switch' + (isActive ? ' is-active' : '') + '" onclick="toggleAccountStatus(\'' + escapeHtmlAttr(u.userId) + '\', this)" title="' + (isActive ? '비활성으로 전환' : '활성으로 전환') + '">' +
                    '<span class="master-state-switch-track"><span class="master-state-switch-thumb"></span></span>' +
                    '<span class="master-state-switch-label">' + (isActive ? '활성' : '비활성') + '</span>' +
                    '</button>' +
                    '</td>' +
                    '<td style="text-align: center;">' +
                    '<button type="button" class="btn btn-secondary btn-sm" onclick="openUserManagePanelById(\'' + escapeHtmlAttr(u.userId) + '\')">관리</button>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        }

        function openUserManagePanelById(userId) {
            const user = userAccounts.find(function (u) { return u.userId === userId; });
            if (!user) return;
            isCreatingAccount = false;
            openUserManagePanel(user.name, user.userId, user.role, user.type, user.contractorName);
        }

        function openAddUserModal() {
            isCreatingAccount = true;
            openUserManagePanel('', '', '직원', 'internal', '');
        }

        function bpsAdminApi(path, payload) {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.reject(new Error('NO_SUPABASE'));
            }
            return window.__bpsSupabase.auth.getSession().then(function (res) {
                if (res.error || !res.data || !res.data.session) {
                    return Promise.reject(new Error('로그인이 필요합니다.'));
                }
                return fetch(window.location.origin + path, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + res.data.session.access_token,
                    },
                    body: JSON.stringify(payload),
                }).then(function (r) {
                    return r.json().then(function (j) {
                        return { ok: r.ok, status: r.status, body: j };
                    });
                });
            });
        }

        function syncUserAccountsFromServer() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                return Promise.resolve(false);
            }
            return bpsAdminApi('/api/admin/list-users', {}).then(function (r) {
                if (!r.ok || !r.body || !Array.isArray(r.body.users)) return false;
                const localNameMap = {};
                userAccounts.forEach(function (u) {
                    const uid = String(u && u.userId ? u.userId : '').trim().toLowerCase();
                    if (!uid) return;
                    localNameMap[uid] = String(u.name || '').trim();
                });
                userAccounts = r.body.users.map(function (u) {
                    const uid = String(u.userId || '').trim().toLowerCase();
                    const serverName = String(u.name || '').trim();
                    const preservedName = serverName || localNameMap[uid] || uid;
                    return {
                        name: preservedName,
                        userId: uid,
                        type: u.type === 'external' ? 'external' : 'internal',
                        role: String(u.role || '').trim(),
                        contractorName: String(u.contractorName || '').trim(),
                        active: u.active !== false,
                        extraAllowedPages: Array.isArray(u.extraAllowedPages) ? u.extraAllowedPages : []
                    };
                });
                persistUserAccounts();
                return true;
            }).catch(function () {
                return false;
            });
        }

        function toggleAccountStatus(userId, btn) {
            const user = userAccounts.find(function (u) { return u.userId === userId; });
            if (!user || !btn) return;
            const nextActive = !(user.active !== false);

            function applyToggleUI() {
                user.active = nextActive;
                const label = btn.querySelector('.master-state-switch-label');
                btn.classList.toggle('is-active', nextActive);
                btn.title = nextActive ? '비활성으로 전환' : '활성으로 전환';
                if (label) label.textContent = nextActive ? '활성' : '비활성';
                if (currentUserAccessProfile.userId === userId) {
                    applyRoleBasedNavigation();
                }
                persistUserAccounts();
            }

            if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                bpsAdminApi('/api/admin/update-profile', {
                    displayUserId: String(userId || '').trim().toLowerCase(),
                    active: nextActive,
                })
                    .then(function (r) {
                        if (!r.ok) {
                            showToast((r.body && r.body.error) || '상태 변경에 실패했습니다.');
                            return;
                        }
                        applyToggleUI();
                    })
                    .catch(function (e) {
                        showToast((e && e.message) || '상태 변경에 실패했습니다.');
                    });
                return;
            }

            applyToggleUI();
        }

        function ensureUserManageHeaderSaveButton() {
            const panelActions = document.getElementById('panelActions');
            if (!panelActions) return null;
            let btn = document.getElementById('btnUserManageSave');
            if (!btn) {
                btn = document.createElement('button');
                btn.id = 'btnUserManageSave';
                btn.className = 'btn btn-primary btn-sm';
                btn.innerHTML = '<i class="fas fa-save"></i> 저장';
                btn.onclick = saveUserManagePanel;
                panelActions.appendChild(btn);
            }
            return btn;
        }

        function setUserManageHeaderActions(show) {
            const panelActions = document.getElementById('panelActions');
            const btnSave = document.getElementById('btnSave');
            const btnCancel = document.getElementById('btnCancel');
            const userSave = ensureUserManageHeaderSaveButton();
            if (!panelActions) return;
            if (show) {
                panelActions.style.display = 'flex';
                if (btnSave) btnSave.style.display = 'none';
                if (btnCancel) btnCancel.style.display = 'none';
                if (userSave) userSave.style.display = '';
            } else {
                if (userSave) userSave.style.display = 'none';
            }
        }

        function switchUserManageTab(tabName) {
            const isBasic = tabName === 'basic';
            const btnBasic = document.getElementById('userManageTabBtnBasic');
            const btnAccess = document.getElementById('userManageTabBtnAccess');
            const panelBasic = document.getElementById('userManageTabBasic');
            const panelAccess = document.getElementById('userManageTabAccess');
            if (btnBasic) btnBasic.classList.toggle('active', isBasic);
            if (btnAccess) btnAccess.classList.toggle('active', !isBasic);
            if (panelBasic) panelBasic.classList.toggle('active', isBasic);
            if (panelAccess) panelAccess.classList.toggle('active', !isBasic);
        }

        function openUserManagePanel(name, userId, role, type, contractorName) {
            const panelTitle = document.getElementById('panelTitle');
            const panelBody = document.getElementById('panelBody');
            const panelBottomSaveBar = document.getElementById('panelBottomSaveBar');
            const overlay = document.getElementById('panelOverlay');
            const panel = document.getElementById('slidePanel');
            if (!panelBody || !overlay || !panel) return;

            currentEditItem = null;
            isEditMode = false;
            isNewEstimate = false;
            panelBaselineSnapshot = '';
            isPanelDirty = false;

            if (panelTitle) panelTitle.textContent = isCreatingAccount ? '계정 추가' : '계정 관리';
            setUserManageHeaderActions(true);
            if (panelBottomSaveBar) panelBottomSaveBar.style.display = 'none';
            panel.classList.remove('project-detail-modal');

            currentManagingAccountUserId = userId || '';
            if (!isCreatingAccount) {
                const targetUser = userAccounts.find(function (u) { return u.userId === currentManagingAccountUserId; });
                currentManagingExtraAllowedPages = Array.from((targetUser && targetUser.extraAllowedPages) || []);
            } else {
                currentManagingExtraAllowedPages = [];
            }
            const typeValue = normalizeAccountType(type);
            const roleValue = role || '';
            const contractorValue = contractorName || '';
            const contractorOptionsHtml = contractors.map(function (c) {
                const nm = String(c.name || '').trim();
                return '<option value="' + escapeHtmlAttr(nm) + '"' + (nm === contractorValue ? ' selected' : '') + '>' + escapeHtmlAttr(nm) + '</option>';
            }).join('');
            panelBody.className = 'panel-body view-mode';
            panelBody.innerHTML = `
                <div class="user-manage-panel">
                    <div class="user-manage-tabs">
                        <button type="button" id="userManageTabBtnBasic" class="user-manage-tab active" onclick="switchUserManageTab('basic')">기본정보</button>
                        <button type="button" id="userManageTabBtnAccess" class="user-manage-tab" onclick="switchUserManageTab('access')">탭권한</button>
                    </div>

                    <div id="userManageTabBasic" class="tab-panel active">
                        <div class="user-manage-card">
                            <div class="user-manage-card-title">기본정보</div>
                            <div class="user-manage-card-desc">비밀번호는 로그인 페이지에서 본인이 직접 설정/입력합니다.</div>
                            <div class="panel-form-row">
                                <label class="panel-form-label">이름</label>
                                <input type="text" class="form-input" id="userManageName" value="${escapeHtmlAttr(name || '')}">
                            </div>
                            <div class="panel-form-row">
                                <label class="panel-form-label">아이디</label>
                                <input type="text" class="form-input" id="userManageUserId" value="${escapeHtmlAttr(userId || '')}">
                            </div>
                        </div>

                        <div class="user-manage-card">
                            <div class="user-manage-card-title">권한설정</div>
                            <div class="panel-form-row">
                                <label class="panel-form-label">유형</label>
                                <div class="user-manage-radio-group">
                                    <label class="user-manage-radio">
                                        <input type="radio" name="userManageType" value="internal" ${typeValue === 'internal' ? 'checked' : ''} onchange="updateUserManagePanelByType()">
                                        <span>내부</span>
                                    </label>
                                    <label class="user-manage-radio">
                                        <input type="radio" name="userManageType" value="external" ${typeValue === 'external' ? 'checked' : ''} onchange="updateUserManagePanelByType()">
                                        <span>외부</span>
                                    </label>
                                </div>
                            </div>
                            <div class="panel-form-row">
                                <label class="panel-form-label" for="userManageRole">역할</label>
                                <select id="userManageRole" class="form-select"></select>
                            </div>
                            <div class="panel-form-row" id="userManageContractorRow" style="${typeValue === 'external' ? '' : 'display:none;'}">
                                <label class="panel-form-label" for="userManageContractor">도급사명</label>
                                <select id="userManageContractor" class="form-select">
                                    <option value="">선택</option>
                                    ${contractorOptionsHtml}
                                </select>
                            </div>
                            ${isCreatingAccount ? '' : `
                            <div class="panel-form-row">
                                <label class="panel-form-label">비밀번호</label>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="resetUserPassword('${escapeHtmlAttr(userId || '')}')">비밀번호 초기화</button>
                            </div>
                            `}
                        </div>
                    </div>

                    <div id="userManageTabAccess" class="tab-panel">
                        <div class="user-manage-card">
                            <div class="user-manage-card-title">탭 권한</div>
                            <div class="user-manage-card-desc">역할 기본 권한은 고정되고, 추가 권한만 ON/OFF 할 수 있습니다.</div>
                            <div id="userManagePageAccess" class="user-access-list"></div>
                            <div id="userManagePageAccessPreview" class="user-access-preview"></div>
                        </div>
                    </div>
                </div>
            `;
            const roleSelect = document.getElementById('userManageRole');
            renderUserRoleOptions(roleSelect, typeValue, roleValue);
            if (roleSelect) roleSelect.addEventListener('change', renderUserManagePageAccess);
            renderUserManagePageAccess();
            switchUserManageTab('basic');

            overlay.classList.add('active');
            panel.classList.add('active');
        }

        function saveUserManagePanel() {
            const nameInput = document.getElementById('userManageName');
            const userIdInput = document.getElementById('userManageUserId');
            const typeInput = document.querySelector('input[name="userManageType"]:checked');
            const roleSelect = document.getElementById('userManageRole');
            const contractorSelect = document.getElementById('userManageContractor');
            const accountName = String(nameInput ? nameInput.value : '').trim();
            const accountUserId = String(userIdInput ? userIdInput.value : '').trim();
            const accountUserIdNorm = accountUserId.toLowerCase();
            const type = typeInput ? normalizeAccountType(typeInput.value) : 'internal';
            const role = roleSelect ? roleSelect.value : '';
            const contractorName = type === 'external' ? String(contractorSelect ? contractorSelect.value : '').trim() : '';
            const baseAllowed = getBaseAllowedPages(type, role);
            const cleanedExtra = (currentManagingExtraAllowedPages || []).filter(function (p) {
                return PAGE_ACCESS_ORDER.includes(p) && !baseAllowed.includes(p);
            });
            if (!accountName || !accountUserId) {
                alert('이름과 아이디는 필수입니다.');
                return;
            }
            if (type === 'external' && role === '도급사' && !contractorName) {
                alert('외부 도급사 계정은 도급사명을 선택해야 합니다.');
                return;
            }

            function applyLocalSaveAndClose() {
                if (isCreatingAccount) {
                    userAccounts.push({
                        name: accountName,
                        userId: accountUserIdNorm,
                        type: type,
                        role: role,
                        contractorName: contractorName,
                        active: true,
                        extraAllowedPages: cleanedExtra
                    });
                } else {
                    const targetUser = userAccounts.find(function (u) { return u.userId === currentManagingAccountUserId; });
                    if (targetUser) {
                        targetUser.name = accountName;
                        targetUser.userId = accountUserIdNorm;
                        targetUser.type = type;
                        targetUser.role = role;
                        targetUser.contractorName = contractorName;
                        targetUser.extraAllowedPages = cleanedExtra;
                    }
                }
                if ((currentManagingAccountUserId && currentManagingAccountUserId === currentUserAccessProfile.userId) || (isCreatingAccount && accountUserIdNorm === currentUserAccessProfile.userId)) {
                    currentUserAccessProfile.name = accountName;
                    currentUserAccessProfile.type = type;
                    currentUserAccessProfile.role = role;
                    currentUserAccessProfile.contractorName = contractorName;
                    currentUserAccessProfile.extraAllowedPages = cleanedExtra;
                    applyRoleBasedNavigation();
                }
                renderUsersTable();
                renderTable();
                persistUserAccounts();
                showToast('계정 설정이 저장되었습니다.');
                isCreatingAccount = false;
                closePanel(true);

                if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                    syncUserAccountsFromServer().then(function () {
                        renderUsersTable();
                    });
                }
            }

            if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                if (isCreatingAccount) {
                    const duplicated = userAccounts.some(function (u) {
                        return String(u.userId || '').toLowerCase() === accountUserIdNorm;
                    });
                    if (duplicated) {
                        alert('이미 존재하는 아이디입니다.');
                        return;
                    }
                } else {
                    const duplicatedOnEdit = userAccounts.some(function (u) {
                        const uid = String(u.userId || '').toLowerCase();
                        return uid === accountUserIdNorm && uid !== String(currentManagingAccountUserId || '').toLowerCase();
                    });
                    if (duplicatedOnEdit) {
                        alert('이미 존재하는 아이디입니다.');
                        return;
                    }
                }
                (function () {
                    var creating = isCreatingAccount;
                    var payloadCreate = {
                        name: accountName,
                        displayUserId: accountUserIdNorm,
                        type: type,
                        role: role,
                        contractorName: contractorName,
                        extraAllowedPages: cleanedExtra,
                    };
                    var payloadUpdate = {
                        name: accountName,
                        originalDisplayUserId: String(currentManagingAccountUserId || '').trim().toLowerCase(),
                        displayUserId: accountUserIdNorm,
                        type: type,
                        role: role,
                        contractorName: contractorName,
                        extraAllowedPages: cleanedExtra,
                    };
                    var req = creating
                        ? bpsAdminApi('/api/admin/create-user', payloadCreate)
                        : bpsAdminApi('/api/admin/update-profile', payloadUpdate);
                    req.then(function (r) {
                        if (!r.ok) {
                            var errMsg = (r.body && r.body.error) ? r.body.error : '저장에 실패했습니다.';
                            if (r.status === 409 && creating) {
                                alert('이미 존재하는 아이디입니다.');
                            } else {
                                alert(errMsg);
                            }
                            return;
                        }
                        applyLocalSaveAndClose();
                    }).catch(function (e) {
                        showToast((e && e.message) || '저장에 실패했습니다.');
                    });
                })();
                return;
            }

            if (isCreatingAccount) {
                const duplicated = userAccounts.some(function (u) { return String(u.userId || '').toLowerCase() === accountUserIdNorm; });
                if (duplicated) {
                    alert('이미 존재하는 아이디입니다.');
                    return;
                }
                userAccounts.push({
                    name: accountName,
                    userId: accountUserIdNorm,
                    type: type,
                    role: role,
                    contractorName: contractorName,
                    active: true,
                    extraAllowedPages: cleanedExtra
                });
            } else {
                const targetUser = userAccounts.find(function (u) { return u.userId === currentManagingAccountUserId; });
                if (targetUser) {
                    targetUser.name = accountName;
                    targetUser.userId = accountUserIdNorm;
                    targetUser.type = type;
                    targetUser.role = role;
                    targetUser.contractorName = contractorName;
                    targetUser.extraAllowedPages = cleanedExtra;
                }
            }
            if ((currentManagingAccountUserId && currentManagingAccountUserId === currentUserAccessProfile.userId) || (isCreatingAccount && accountUserIdNorm === currentUserAccessProfile.userId)) {
                currentUserAccessProfile.name = accountName;
                currentUserAccessProfile.userId = accountUserIdNorm;
                currentUserAccessProfile.type = type;
                currentUserAccessProfile.role = role;
                currentUserAccessProfile.contractorName = contractorName;
                currentUserAccessProfile.extraAllowedPages = cleanedExtra;
                applyRoleBasedNavigation();
            }
            renderUsersTable();
            renderTable();
            persistUserAccounts();
            showToast('계정 설정이 저장되었습니다.');
            isCreatingAccount = false;
            closePanel(true);
        }

        function resetUserPassword(userId) {
            const uid = String(userId || '').trim();
            if (!uid) return;
            const ok = confirm('「' + uid + '」 계정의 비밀번호를 초기화하시겠습니까?\n초기화 후 비밀번호는 로그인 페이지에서 다시 설정해야 합니다.');
            if (!ok) return;

            if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                (async function () {
                    try {
                        const { data: sessionData, error: sessionErr } = await window.__bpsSupabase.auth.getSession();
                        if (sessionErr || !sessionData || !sessionData.session) {
                            showToast('로그인이 필요합니다.');
                            return;
                        }
                        var token = sessionData.session.access_token;
                        var res = await fetch(window.location.origin + '/api/admin/reset-password', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: 'Bearer ' + token,
                            },
                            body: JSON.stringify({ displayUserId: uid.toLowerCase() }),
                        });
                        var j = await res.json().catch(function () {
                            return {};
                        });
                        if (!res.ok) {
                            showToast(j.error || '비밀번호 초기화에 실패했습니다.');
                            return;
                        }
                        var AUTH_USER_KEY = 'bps_auth_userId';
                        var authUser = String(localStorage.getItem(AUTH_USER_KEY) || '').trim();
                        if (authUser.toLowerCase() === uid.toLowerCase()) {
                            await window.__bpsSupabase.auth.signOut();
                            localStorage.removeItem(AUTH_USER_KEY);
                            window.location.href = 'login.html';
                            return;
                        }
                        showToast('비밀번호가 초기화되었습니다. 로그인 페이지에서 새 비밀번호를 설정하세요.');
                    } catch (e) {
                        showToast((e && e.message) || '비밀번호 초기화에 실패했습니다.');
                    }
                })();
                return;
            }

            // Supabase 미사용(로컬 데모) 시: 로컬 저장소만 갱신
            const PASSWORDS_KEY = 'bps_user_passwords';
            const RESET_REQUIRED_KEY = 'bps_password_reset_required';
            const AUTH_USER_KEY = 'bps_auth_userId';
            try {
                const passwordsRaw = localStorage.getItem(PASSWORDS_KEY);
                const resetRaw = localStorage.getItem(RESET_REQUIRED_KEY);
                const passwords = passwordsRaw ? JSON.parse(passwordsRaw) : {};
                const resetRequired = resetRaw ? JSON.parse(resetRaw) : {};
                if (passwords && Object.prototype.hasOwnProperty.call(passwords, uid)) delete passwords[uid];
                if (resetRequired) resetRequired[uid] = true;
                localStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords || {}));
                localStorage.setItem(RESET_REQUIRED_KEY, JSON.stringify(resetRequired || {}));
            } catch (e) {
                /* ignore */
            }

            try {
                const authUser = String(localStorage.getItem(AUTH_USER_KEY) || '').trim();
                if (authUser && authUser === uid) {
                    localStorage.removeItem(AUTH_USER_KEY);
                    location.reload();
                }
            } catch (e) {
                /* ignore */
            }
            showToast('비밀번호가 초기화되었습니다. 로그인 페이지에서 새 비밀번호를 설정하세요.');
        }

        // 페이지 전환 시 자동 렌더링
        window.addEventListener('hashchange', function() {
            const hash = window.location.hash.slice(1);
            if (hash === 'performance') {
                renderPerformanceData();
            } else if (hash === 'weekly') {
                renderWeeklyReport();
            } else if (hash === 'unpaid') {
                renderUnpaidData();
            }
        });

        let currentEditItem = null;
        let isEditMode = false;
        let isNewEstimate = false;
        let itemRows = [];
        let currentStep = 1; // 신규 견적 등록 단계 (1: 기본정보~도급사, 2: 매출정보, 3: 매입정보)
        let basicInfoEditMode = false;
        let businessInfoEditMode = false;
        let activePanelTabId = 'basic';
        let panelBaselineSnapshot = '';
        let isPanelDirty = false;
        let isSavingChanges = false;

        function getPanelSnapshot() {
            const panelBody = document.getElementById('panelBody');
            if (!panelBody) return '';
            const values = Array.from(panelBody.querySelectorAll('input, select, textarea')).map((el) => {
                const key = el.id || el.name || el.className || el.tagName;
                if (el.type === 'checkbox' || el.type === 'radio') return `${key}:${el.checked ? '1' : '0'}`;
                if (el.type === 'file') return `${key}:file`;
                return `${key}:${el.value || ''}`;
            });
            const rows = Array.from(panelBody.querySelectorAll('tr[data-row-values], tr[data-row-file-id]')).map((row) =>
                `${row.getAttribute('data-row-values') || ''}|${row.getAttribute('data-row-file-id') || ''}`
            );
            return JSON.stringify({ values, rows });
        }

        function resetPanelDirtyState() {
            isPanelDirty = false;
            panelBaselineSnapshot = getPanelSnapshot();
        }

        function markPanelDirtyIfChanged() {
            if (!(isEditMode || isNewEstimate)) return;
            if (!panelBaselineSnapshot) {
                panelBaselineSnapshot = getPanelSnapshot();
            }
            isPanelDirty = getPanelSnapshot() !== panelBaselineSnapshot;
        }

        function setSaveLoading(loading) {
            isSavingChanges = !!loading;
            const saveButtons = [document.getElementById('btnBottomSave'), document.getElementById('btnSave')];
            saveButtons.forEach((btn) => {
                if (!btn) return;
                btn.disabled = !!loading;
                btn.style.opacity = loading ? '0.7' : '1';
                btn.style.cursor = loading ? 'not-allowed' : 'pointer';
                btn.innerHTML = loading ? '<i class="fas fa-spinner fa-spin"></i> 저장 중...' : '<i class="fas fa-save"></i> 저장';
            });
        }

        function showToast(message) {
            let toast = document.getElementById('appToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'appToast';
                toast.className = 'app-toast';
                document.body.appendChild(toast);
            }
            toast.textContent = message;
            toast.classList.add('show');
            clearTimeout(showToast._timer);
            showToast._timer = setTimeout(() => toast.classList.remove('show'), 1800);
        }

        document.addEventListener('input', (event) => {
            if (!event.target || !event.target.closest || !event.target.closest('#panelBody')) return;
            markPanelDirtyIfChanged();
        });
        document.addEventListener('change', (event) => {
            if (!event.target || !event.target.closest || !event.target.closest('#panelBody')) return;
            markPanelDirtyIfChanged();
        });

        // 신규 견적 등록
        function openNewEstimate() {
            isNewEstimate = true;
            isEditMode = false;
            basicInfoEditMode = true;
            
            // 새 프로젝트 코드: 연도 뒤 2자리 + 타임스탬프 뒤 6자리 (예: 2027년 → 27xxxxxx)
            const yy = String(new Date().getFullYear()).slice(-2);
            const newCode = yy + String(Date.now()).slice(-6);
            const today = new Date().toISOString().slice(0, 10);
            
            currentEditItem = {
                code: newCode,
                date: today,
                status: '견적',
                startDate: '',
                endDate: '',
                category1: 'B2B',
                category2: '코오롱',
                category3: '지원',
                building: '',
                project: '',
                manager: currentUserAccessProfile.name || '방준호',
                createdBy: currentUserAccessProfile.userId || '',
                type: '세금계산서',
                contractor: '',
                revenue: 0,
                paidStatus: '미수',
                purchase: 0,
                taxIssued: false,
                hasSales: false,
                hasPurchase: false,
                businessIncomeTransferDate: '',
                businessIncomeGross: 0,
                businessIncomeNetPay: 0,
                businessIncomePaidStatus: '미지급',
                aggregateSalesGross: 0,
                aggregatePaymentGross: 0,
                aggregatePurchaseGross: 0,
                aggregateTransferGross: 0,
                salesDates: []
            };

            itemRows = [{
                name: '',
                quantity: 1,
                price: 0,
                amount: 0
            }];

            renderPanelContent(currentEditItem);

            document.getElementById('slidePanel').classList.add('project-detail-modal');
            document.getElementById('panelOverlay').classList.add('active');
            document.getElementById('slidePanel').classList.add('active');
        }

        // 신규 견적서 패널 렌더링 (탭: 기본정보, 매출정보, 매입정보)
        function renderNewEstimatePanel() {
            document.getElementById('panelTitle').textContent =
                currentEditItem && currentEditItem.code ? '프로젝트 등록 · ' + currentEditItem.code : '프로젝트 등록';
            const panelBody = document.getElementById('panelBody');
            panelBody.className = 'panel-body edit-mode';
            const isExternalContractorView = isCurrentUserExternalContractor();
            const showSalesTab = !isExternalContractorView;

            const d = currentEditItem && currentEditItem.date ? currentEditItem.date : new Date().toISOString().slice(0, 10);
            const paid = (currentEditItem && currentEditItem.paidStatus) || '미수';
            const tax = currentEditItem && currentEditItem.taxIssued;

            const tabBarHtml = `
                <div class="new-estimate-tabs">
                    <button type="button" class="new-estimate-tab active" data-tab="1" onclick="switchNewEstimateTab(1)">
                        <i class="fas fa-info-circle"></i>
                        <span>기본정보</span>
                    </button>
                    ${showSalesTab ? `
                    <button type="button" class="new-estimate-tab" data-tab="2" onclick="switchNewEstimateTab(2)">
                        <i class="fas fa-won-sign"></i>
                        <span>매출정보</span>
                    </button>
                    ` : ''}
                    <button type="button" class="new-estimate-tab" data-tab="${showSalesTab ? '3' : '2'}" onclick="switchNewEstimateTab(${showSalesTab ? '3' : '2'})">
                        <i class="fas fa-file-invoice"></i>
                        <span>매입정보</span>
                    </button>
                </div>
            `;

            const tab1Html = `
                <div id="newEstimateTab1" class="new-estimate-tab-pane active">
                    <div class="panel-section">
                        <div class="panel-section-title">기본정보</div>
                        <div class="detail-list">
                            <div class="detail-list-row">
                                <span class="detail-list-label">프로젝트 코드</span>
                                <span class="detail-list-value" style="font-family: ui-monospace, monospace; font-weight: 600;">${(currentEditItem && currentEditItem.code) || '-'}</span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">등록일</span>
                                <span class="detail-list-value"><input type="date" class="form-input form-input-inline" id="new_date" value="${d}"></span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">진행상태</span>
                                <span class="detail-list-value">
                                    <select class="form-select form-select-inline form-select-status" id="new_status">
                                        <option value="견적" selected>견적</option>
                                        <option value="진행">진행</option>
                                        <option value="완료">완료</option>
                                        <option value="보류">보류</option>
                                    </select>
                                </span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">대분류</span>
                                <span class="detail-list-value">
                                    <select class="form-select form-select-inline" id="new_category1">
                                        ${getCategory1SelectOptionsHtml((currentEditItem && currentEditItem.category1) || 'B2B')}
                                    </select>
                                </span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">중분류</span>
                                <span class="detail-list-value">
                                    <select class="form-select form-input-inline" id="new_category2">
                                        ${getCategory2SelectOptionsHtml((currentEditItem && currentEditItem.category2) || '코오롱')}
                                    </select>
                                </span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">소분류</span>
                                <span class="detail-list-value">
                                    <select class="form-select form-input-inline" id="new_category3">
                                        ${getCategory3SelectOptionsHtml((currentEditItem && currentEditItem.category3) || '지원')}
                                    </select>
                                </span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">건물명</span>
                                <span class="detail-list-value"><input type="text" class="form-input form-input-inline" id="new_building" value="${(currentEditItem && currentEditItem.building) || ''}" placeholder="예: 서울파이낸스센터"></span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">공사명</span>
                                <span class="detail-list-value"><input type="text" class="form-input form-input-inline" id="new_project" value="${(currentEditItem && currentEditItem.project) || ''}" placeholder="예: 8층 팬트리 수전 수리"></span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">담당자</span>
                                <span class="detail-list-value">
                                    <select class="form-select form-select-inline" id="new_manager">
                                        <option value="방준호" selected>방준호</option>
                                    </select>
                                </span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">구분</span>
                                <span class="detail-list-value">
                                    <select class="form-select form-select-inline" id="new_type">
                                        <option value="세금계산서" selected>세금계산서</option>
                                        <option value="사업소득">사업소득</option>
                                        <option value="자체인력">자체인력</option>
                                    </select>
                                </span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">도급사</span>
                                <span class="detail-list-value">
                                    <input type="text" class="form-input form-input-inline" id="new_contractor" list="contractorListNew" value="${escapeHtml((currentEditItem && currentEditItem.contractor) || '')}" placeholder="도급사 검색/선택">
                                    <datalist id="contractorListNew">
                                        ${getContractorDatalistOptionsHtml()}
                                    </datalist>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const tab2Html = showSalesTab ? `
                <div id="newEstimateTab2" class="new-estimate-tab-pane">
                    <div class="panel-section">
                        <div class="panel-section-title">매출정보</div>
                        <div class="detail-list">
                            <div class="detail-list-row">
                                <span class="detail-list-label">매출금액</span>
                                <span class="detail-list-value"><input type="number" class="form-input form-input-inline" id="new_revenue" value="${(currentEditItem && currentEditItem.revenue) || 0}" placeholder="0" min="0"></span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">수금상태</span>
                                <span class="detail-list-value">
                                    <select class="form-select form-select-inline" id="new_paidStatus">
                                        <option value="미수" ${paid === '미수' ? 'selected' : ''}>미수</option>
                                        <option value="전액" ${paid === '전액' ? 'selected' : ''}>전액</option>
                                        <option value="부분" ${paid === '부분' ? 'selected' : ''}>부분</option>
                                        <option value="해당없음" ${paid === '해당없음' ? 'selected' : ''}>해당없음</option>
                                    </select>
                                </span>
                            </div>
                            <div class="detail-list-row">
                                <span class="detail-list-label">세금계산서 발행</span>
                                <span class="detail-list-value">
                                    <select class="form-select form-select-inline" id="new_taxIssued">
                                        <option value="false" ${!tax ? 'selected' : ''}>미발행</option>
                                        <option value="true" ${tax ? 'selected' : ''}>발행완료</option>
                                    </select>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ` : '';

            const tab3Html = `
                <div id="newEstimateTab${showSalesTab ? '3' : '2'}" class="new-estimate-tab-pane">
                    <div class="panel-section">
                        <div class="panel-section-title">매입정보</div>
                        <div class="detail-list">
                            <div class="detail-list-row">
                                <span class="detail-list-label">매입금액</span>
                                <span class="detail-list-value"><input type="number" class="form-input form-input-inline" id="new_purchase" value="${(currentEditItem && currentEditItem.purchase) || 0}" placeholder="0" min="0"></span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const footerHtml = `
                <div class="new-estimate-step-footer">
                    <span></span>
                    <div class="step-footer-right">
                        <button type="button" class="btn btn-primary" onclick="saveNewEstimateFromSteps()"><i class="fas fa-check"></i> 등록</button>
                    </div>
                </div>
            `;

            panelBody.innerHTML = tabBarHtml + tab1Html + tab2Html + tab3Html + footerHtml;

            // 초기 탭 활성화
            if (!showSalesTab && currentStep === 3) currentStep = 2;
            switchNewEstimateTab(currentStep);

            document.getElementById('btnEdit').style.display = 'none';
            document.getElementById('btnSave').style.display = 'none';
            document.getElementById('btnCancel').style.display = 'none';
            const bottomSaveBarEl = document.getElementById('panelBottomSaveBar');
            if (bottomSaveBarEl) bottomSaveBarEl.style.display = 'none';
        }

        function switchNewEstimateTab(tabNum) {
            currentStep = tabNum;
            document.querySelectorAll('.new-estimate-tab').forEach((btn, i) => {
                btn.classList.toggle('active', i + 1 === tabNum);
            });
            document.querySelectorAll('.new-estimate-tab-pane').forEach((pane, i) => {
                pane.classList.toggle('active', i + 1 === tabNum);
            });
        }

        function saveNewEstimateFromSteps() {
            const building = document.getElementById('new_building').value.trim();
            const project = document.getElementById('new_project').value.trim();
            const contractorCheck = validateContractorSelectionById('new_contractor');
            if (!building || !project) {
                alert('건물명과 공사명은 필수 입력 항목입니다.');
                const tab1 = document.getElementById('newEstimateTab1');
                if (tab1) { switchNewEstimateTab(1); }
                return;
            }
            if (!contractorCheck.ok) return;
            if (!currentEditItem) return;
            currentEditItem.date = document.getElementById('new_date').value;
            currentEditItem.status = document.getElementById('new_status').value;
            currentEditItem.category1 = document.getElementById('new_category1').value;
            currentEditItem.category2 = document.getElementById('new_category2').value.trim();
            const newCat3 = document.getElementById('new_category3');
            currentEditItem.category3 = newCat3 ? newCat3.value.trim() : '';
            currentEditItem.building = building;
            currentEditItem.project = project;
            currentEditItem.manager = document.getElementById('new_manager').value;
            currentEditItem.type = document.getElementById('new_type').value;
            currentEditItem.contractor = contractorCheck.value;
            const newRevenueInput = document.getElementById('new_revenue');
            const newPaidStatus = document.getElementById('new_paidStatus');
            const newTaxIssued = document.getElementById('new_taxIssued');
            currentEditItem.revenue = newRevenueInput ? (parseInt(newRevenueInput.value, 10) || 0) : 0;
            currentEditItem.paidStatus = newPaidStatus ? newPaidStatus.value : '해당없음';
            currentEditItem.taxIssued = newTaxIssued ? (newTaxIssued.value === 'true') : false;
            currentEditItem.purchase = parseInt(document.getElementById('new_purchase').value, 10) || 0;
            saveChanges();
        }

        // 품목 행 렌더링
        function renderItemRows() {
            const tbody = document.getElementById('itemsTableBody');
            tbody.innerHTML = itemRows.map((row, index) => `
                <tr>
                    <td><input type="text" value="${row.name}" onchange="updateItemRow(${index}, 'name', this.value)" placeholder="품목명 입력"></td>
                    <td><input type="number" value="${row.quantity}" onchange="updateItemRow(${index}, 'quantity', this.value)" min="1"></td>
                    <td><input type="number" value="${row.price}" onchange="updateItemRow(${index}, 'price', this.value)" min="0"></td>
                    <td style="text-align: right; font-weight: 600;">${row.amount.toLocaleString()}원</td>
                    <td style="text-align: center;">
                        ${itemRows.length > 1 ? `<button class="btn-remove-item" onclick="removeItemRow(${index})"><i class="fas fa-times"></i></button>` : ''}
                    </td>
                </tr>
            `).join('');

            updateTotals();
        }

        // 품목 행 추가
        function addItemRow() {
            itemRows.push({
                name: '',
                quantity: 1,
                price: 0,
                amount: 0
            });
            renderItemRows();
        }

        // 품목 행 제거
        function removeItemRow(index) {
            if (itemRows.length > 1) {
                itemRows.splice(index, 1);
                renderItemRows();
            }
        }

        // 품목 행 업데이트
        function updateItemRow(index, field, value) {
            itemRows[index][field] = field === 'name' ? value : parseFloat(value) || 0;
            itemRows[index].amount = itemRows[index].quantity * itemRows[index].price;
            renderItemRows();
        }

        // 합계 업데이트
        function updateTotals() {
            const supply = itemRows.reduce((sum, row) => sum + row.amount, 0);
            const vat = Math.round(supply * 0.1);
            const total = supply + vat;

            document.getElementById('totalSupply').textContent = supply.toLocaleString() + '원';
            document.getElementById('totalVAT').textContent = vat.toLocaleString() + '원';
            document.getElementById('totalAmount').textContent = total.toLocaleString() + '원';
        }

        // 매입 섹션 토글
        function togglePurchaseSection() {
            const type = document.getElementById('new_type').value;
            const purchaseSection = document.getElementById('purchaseSection');
            purchaseSection.style.display = type === '세금계산서' ? 'block' : 'none';
        }

        // 프로젝트 상세 열기 (가운데 모달로 표시)
        function openPanel(code) {
            const c = String(code == null ? '' : code).trim();
            const item = estimates.find(function (e) {
                return String(e && e.code != null ? e.code : '').trim() === c;
            });
            if (!item) return;

            currentEditItem = {...item};
            isEditMode = false;
            basicInfoEditMode = false;
            businessInfoEditMode = false;
            activePanelTabId = 'basic';

            renderPanelContent(item);

            document.getElementById('slidePanel').classList.add('project-detail-modal');
            document.getElementById('panelOverlay').classList.add('active');
            document.getElementById('slidePanel').classList.add('active');
        }

        // 패널 내용 렌더링
        function renderPanelContent(item) {
            const isExternalContractorView = isCurrentUserExternalContractor();
            const canViewSalesTab = !isExternalContractorView;
            const canViewPurchaseTab = item.type === '세금계산서';
            const canViewBusinessTab = !isExternalContractorView && (item.type === '세금계산서' || item.type === '사업소득');
            const canViewProfitTab = !isExternalContractorView && (item.type === '세금계산서' || item.type === '사업소득');
            const allowedTabs = ['basic'];
            if (canViewSalesTab) allowedTabs.push('sales');
            if (canViewPurchaseTab) allowedTabs.push('purchase');
            if (canViewBusinessTab) allowedTabs.push('business');
            if (canViewProfitTab) allowedTabs.push('profit');
            if (!allowedTabs.includes(activePanelTabId)) {
                activePanelTabId = canViewPurchaseTab ? 'purchase' : 'basic';
            }
            const codeLabel = item && item.code ? ` · ${item.code}` : '';
            const bizVals = computeBizTaxFromGross(item.businessIncomeGross);
            const profitNetTotals = getProfitNetTotalsByCode(item.code, item.revenue, item.purchase, item.businessIncomeGross);
            document.getElementById('panelTitle').textContent = isNewEstimate
                ? ('프로젝트 등록' + (item && item.code ? ` · ${item.code}` : ''))
                : (isEditMode ? '프로젝트 수정' + codeLabel : '프로젝트 상세' + codeLabel);
            
            const panelBody = document.getElementById('panelBody');
            panelBody.className = isEditMode ? 'panel-body edit-mode' : 'panel-body view-mode';

            panelBody.innerHTML = `
                <!-- 탭 메뉴 (신규 견적 등록과 동일 디자인) -->
                <div class="new-estimate-tabs">
                    <button type="button" class="new-estimate-tab panel-tab ${activePanelTabId === 'basic' ? 'active' : ''}" data-tab="basic" onclick="switchPanelTab(event, 'basic')">
                        <i class="fas fa-info-circle"></i>
                        <span>기본정보</span>
                    </button>
                    ${canViewSalesTab ? `
                    <button type="button" class="new-estimate-tab panel-tab ${activePanelTabId === 'sales' ? 'active' : ''}" data-tab="sales" onclick="switchPanelTab(event, 'sales')">
                        <i class="fas fa-won-sign"></i>
                        <span>매출정보</span>
                    </button>
                    ` : ''}
                    ${canViewPurchaseTab ? `
                    <button type="button" class="new-estimate-tab panel-tab ${activePanelTabId === 'purchase' ? 'active' : ''}" data-tab="purchase" onclick="switchPanelTab(event, 'purchase')">
                        <i class="fas fa-file-invoice"></i>
                        <span>매입정보</span>
                    </button>
                    ` : ''}
                    ${canViewBusinessTab ? `
                    <button type="button" class="new-estimate-tab panel-tab ${activePanelTabId === 'business' ? 'active' : ''}" data-tab="business" onclick="switchPanelTab(event, 'business')">
                        <i class="fas fa-briefcase"></i>
                        <span>사업소득</span>
                    </button>
                    ` : ''}
                    ${canViewProfitTab ? `
                    <button type="button" class="new-estimate-tab panel-tab ${activePanelTabId === 'profit' ? 'active' : ''}" data-tab="profit" onclick="switchPanelTab(event, 'profit')">
                        <i class="fas fa-chart-line"></i>
                        <span>수익분석</span>
                    </button>
                    ` : ''}
                </div>

                <!-- 기본정보 탭 -->
                <div class="new-estimate-tab-pane panel-tab-content ${activePanelTabId === 'basic' ? 'active' : ''} ${basicInfoEditMode ? 'basic-info-editing' : ''}" id="tab-basic">
                    <div class="panel-section">
                        <div class="panel-section-title panel-section-title--actions">
                            <span>기본정보</span>
                            <span class="basic-info-title-actions" style="${isNewEstimate ? 'display:none;' : ''}">
                                <button type="button" class="btn-basic-info-edit" onclick="startBasicInfoEdit()" style="${basicInfoEditMode ? 'display:none;' : ''}">수정</button>
                                <button type="button" class="btn-basic-info-save" onclick="saveBasicInfoEdit()" style="${basicInfoEditMode ? '' : 'display:none;'}">저장</button>
                                <button type="button" class="btn-basic-info-cancel" onclick="cancelBasicInfoEdit()" style="${basicInfoEditMode ? '' : 'display:none;'}">취소</button>
                                <button type="button" class="btn-basic-info-delete" onclick="deleteCurrentEstimate()" style="${basicInfoEditMode ? 'display:none;' : ''}">삭제</button>
                            </span>
                        </div>
                        <div class="basic-info-grid">
                            <div class="basic-info-card">
                                <div class="basic-info-card-title">
                                    <i class="fas fa-calendar-alt"></i> 일정/상태
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">프로젝트 코드</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value" style="font-family: ui-monospace, monospace; font-weight: 600;">${item.code || '-'}</span>
                                    </div>
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">등록일</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.date}</span>
                                        <input type="date" class="form-input form-input-inline edit-input" id="edit_date" value="${item.date}" style="display: none;">
                                    </div>
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">진행상태</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value"><span class="badge ${getBadgeClass(item.status)}">${item.status}</span></span>
                                        <select class="form-select form-select-inline edit-input" id="edit_status" style="display: none;">
                                            <option value="견적" ${item.status === '견적' ? 'selected' : ''}>견적</option>
                                            <option value="진행" ${item.status === '진행' ? 'selected' : ''}>진행</option>
                                            <option value="완료" ${item.status === '완료' ? 'selected' : ''}>완료</option>
                                            <option value="보류" ${item.status === '보류' ? 'selected' : ''}>보류</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">진행일</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.startDate || ''}</span>
                                        <input type="date" class="form-input form-input-inline edit-input" id="edit_startDate" value="${item.startDate || ''}" style="display: none;">
                                    </div>
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">완료일</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.endDate || ''}</span>
                                        <input type="date" class="form-input form-input-inline edit-input" id="edit_endDate" value="${item.endDate || ''}" style="display: none;">
                                    </div>
                                </div>
                            </div>

                            <div class="basic-info-card">
                                <div class="basic-info-card-title">
                                    <i class="fas fa-tags"></i> 분류
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">대분류</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.category1}</span>
                                        <select class="form-select form-select-inline edit-input" id="edit_category1" style="display: none;">
                                            ${getCategory1SelectOptionsHtml(item.category1)}
                                        </select>
                                    </div>
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">중분류</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.category2}</span>
                                        <select class="form-select form-select-inline edit-input" id="edit_category2" style="display: none;">
                                            ${getCategory2SelectOptionsHtml(item.category2)}
                                        </select>
                                    </div>
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">소분류</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.category3 || '-'}</span>
                                        <select class="form-select form-select-inline edit-input" id="edit_category3" style="display: none;">
                                            ${getCategory3SelectOptionsHtml(item.category3 || '')}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="basic-info-card">
                                <div class="basic-info-card-title">
                                    <i class="fas fa-user-tie"></i> 담당/계약
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">담당자</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.manager}</span>
                                        <select class="form-select form-select-inline edit-input" id="edit_manager" style="display: none;">
                                            <option value="방준호" ${item.manager === '방준호' ? 'selected' : ''}>방준호</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">구분</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.type}</span>
                                        <select class="form-select form-select-inline edit-input" id="edit_type" style="display: none;">
                                            <option value="세금계산서" ${item.type === '세금계산서' ? 'selected' : ''}>세금계산서</option>
                                            <option value="사업소득" ${item.type === '사업소득' ? 'selected' : ''}>사업소득</option>
                                            <option value="자체인력" ${item.type === '자체인력' ? 'selected' : ''}>자체인력</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">도급사</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.contractor || '-'}</span>
                                        <span class="edit-input" style="display: none; width: 100%;">
                                            <input type="text" class="form-input form-input-inline" id="edit_contractor" list="contractorListEdit" value="${escapeHtml(item.contractor || '')}" placeholder="도급사 검색/선택">
                                            <datalist id="contractorListEdit">
                                                ${getContractorDatalistOptionsHtml()}
                                            </datalist>
                                        </span>
                                    </div>
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">첨부서류</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${getContractorDocsHtml(item.contractor || '')}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="basic-info-card basic-info-card--wide">
                                <div class="basic-info-card-title">
                                    <i class="fas fa-building"></i> 프로젝트
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">건물명</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.building}</span>
                                        <input type="text" class="form-input form-input-inline edit-input" id="edit_building" value="${item.building}" style="display: none;">
                                    </div>
                                </div>
                                <div class="basic-info-row">
                                    <div class="basic-info-label">공사명</div>
                                    <div class="basic-info-value">
                                        <span class="detail-list-value">${item.project}</span>
                                        <input type="text" class="form-input form-input-inline edit-input" id="edit_project" value="${item.project}" style="display: none;">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- 견적서 보기/수정 버튼 제거 -->
                    </div>
                </div>

                ${canViewSalesTab ? `
                <!-- 매출정보 탭 -->
                <div class="new-estimate-tab-pane panel-tab-content ${activePanelTabId === 'sales' ? 'active' : ''}" id="tab-sales">
                    <div class="panel-section">
                        <!-- 매출 내역 (상호명별) -->
                        <div class="payment-list">
                            <div class="payment-list-header">
                                <div class="payment-list-title">
                                    <i class="fas fa-store"></i> 매출 내역 (상호명별)
                                </div>
                                <button class="btn-add-payment" onclick="addSalesRow('${item.code}')">
                                    <i class="fas fa-plus"></i> 매출 추가
                                </button>
                            </div>
                            <div class="payment-table-wrap">
                            <table class="payment-table">
                                <thead>
                                    <tr>
                                        <th style="width: 100px;">매출일자</th>
                                        <th style="width: 120px;">상호명</th>
                                        <th style="width: 92px;">매출금액(vat별도)</th>
                                        <th style="width: 88px;">부가세(vat)</th>
                                        <th style="width: 100px;">매출금액(vat포함)</th>
                                        <th style="width: 88px;">세금계산서</th>
                                        <th style="width: 88px;">첨부파일</th>
                                        <th style="width: 120px;">메모</th>
                                    </tr>
                                </thead>
                                <tbody id="salesList-${item.code}">
                                    <!-- 매출 내역이 여기에 동적으로 추가됩니다 -->
                                </tbody>
                            </table>
                            </div>
                            <div class="payment-summary">
                                <span class="payment-summary-label">총 매출액(vat포함)</span>
                                <span class="payment-summary-value" id="salesSummary-${item.code}">${item.revenue.toLocaleString()}원</span>
                            </div>
                        </div>

                        <!-- 수금 내역 (날짜별) -->
                        <div class="payment-list" style="margin-top: 32px;">
                            <div class="payment-list-header">
                                <div class="payment-list-title">
                                    <i class="fas fa-money-check-alt"></i> 수금 내역 (날짜별)
                                </div>
                                <button class="btn-add-payment" onclick="addPaymentRow('sales', '${item.code}')">
                                    <i class="fas fa-plus"></i> 수금 추가
                                </button>
                            </div>
                            <div class="payment-table-wrap">
                            <table class="payment-table">
                                <thead>
                                    <tr>
                                        <th style="width: 100px;">수금일자</th>
                                        <th>상호명</th>
                                        <th style="width: 100px;">수금금액(vat별도)</th>
                                        <th style="width: 88px;">부가세(vat)</th>
                                        <th style="width: 100px;">수금금액(vat포함)</th>
                                        <th>메모</th>
                                    </tr>
                                </thead>
                                <tbody id="salesPayments-${item.code}">
                                    <tr data-row-type="payment" data-saved="true" onclick="onFinanceRowClick(event, this, 'payment')">
                                        <td>2026-03-10</td>
                                        <td>-</td>
                                        <td style="font-weight: 600;">${Math.round((item.revenue * 0.4) / 1.1).toLocaleString()}원</td>
                                        <td style="font-weight: 600;">${Math.round((item.revenue * 0.4) - Math.round((item.revenue * 0.4) / 1.1)).toLocaleString()}원</td>
                                        <td style="font-weight: 600;">${(item.revenue * 0.4).toLocaleString()}원</td>
                                        <td>1차 수금</td>
                                    </tr>
                                </tbody>
                            </table>
                            </div>
                            <div class="payment-summary">
                                <span class="payment-summary-label">총 수금액(vat포함)</span>
                                <span class="payment-summary-value" id="paymentSummary-${item.code}">${(item.revenue * 0.4).toLocaleString()}원 / ${item.revenue.toLocaleString()}원</span>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- 매입정보 탭 -->
                ${canViewPurchaseTab ? `
                <div class="new-estimate-tab-pane panel-tab-content ${activePanelTabId === 'purchase' ? 'active' : ''}" id="tab-purchase" data-tab-pane="purchase">
                    <div class="panel-section">
                        <!-- 매입 내역 (업체별) -->
                        <div class="payment-list">
                            <div class="payment-list-header">
                                <div class="payment-list-title">
                                    <i class="fas fa-building"></i> 매입 내역 (업체별)
                                </div>
                                <button class="btn-add-payment" onclick="addPurchaseRow('${item.code}')">
                                    <i class="fas fa-plus"></i> 매입 추가
                                </button>
                            </div>
                            <div class="payment-table-wrap">
                            <table class="payment-table">
                                <thead>
                                    <tr>
                                        <th style="width: 100px;">매입일자</th>
                                        <th style="width: 120px;">상호명</th>
                                        <th style="width: 100px;">매입금액(vat별도)</th>
                                        <th style="width: 88px;">부가세(vat)</th>
                                        <th style="width: 100px;">매입금액(vat포함)</th>
                                        <th style="width: 88px;">세금계산서</th>
                                        <th style="width: 88px;">첨부파일</th>
                                        <th style="width: 120px;">메모</th>
                                    </tr>
                                </thead>
                                <tbody id="purchaseList-${item.code}">
                                    <tr data-row-type="purchase" data-saved="true" onclick="onFinanceRowClick(event, this, 'purchase')">
                                        <td>2026-03-10</td>
                                        <td>영진인프라</td>
                                        <td style="font-weight: 600;">${Math.round((item.purchase * 0.6) / 1.1).toLocaleString()}원</td>
                                        <td style="font-weight: 600;">${Math.round((item.purchase * 0.6) - Math.round((item.purchase * 0.6) / 1.1)).toLocaleString()}원</td>
                                        <td style="font-weight: 600;">${(item.purchase * 0.6).toLocaleString()}원</td>
                                        <td><span class="badge badge-issued">발행</span></td>
                                        <td>-</td>
                                        <td>바닥공사</td>
                                    </tr>
                                    <tr data-row-type="purchase" data-saved="true" onclick="onFinanceRowClick(event, this, 'purchase')">
                                        <td>2026-03-10</td>
                                        <td>강서집수리</td>
                                        <td style="font-weight: 600;">${Math.round((item.purchase * 0.4) / 1.1).toLocaleString()}원</td>
                                        <td style="font-weight: 600;">${Math.round((item.purchase * 0.4) - Math.round((item.purchase * 0.4) / 1.1)).toLocaleString()}원</td>
                                        <td style="font-weight: 600;">${(item.purchase * 0.4).toLocaleString()}원</td>
                                        <td><span class="badge badge-not-issued">미발행</span></td>
                                        <td>-</td>
                                        <td>전기설비</td>
                                    </tr>
                                </tbody>
                            </table>
                            </div>
                            <div class="payment-summary">
                                <span class="payment-summary-label">총 매입액(vat포함)</span>
                                <span class="payment-summary-value" id="purchaseSummary-${item.code}">${item.purchase.toLocaleString()}원</span>
                            </div>
                        </div>

                        <!-- 이체 내역 (날짜별) -->
                        <div class="payment-list" style="margin-top: 32px;">
                            <div class="payment-list-header">
                                <div class="payment-list-title">
                                    <i class="fas fa-exchange-alt"></i> 이체 내역 (날짜별)
                                </div>
                                <button class="btn-add-payment" onclick="addTransferRow('${item.code}')">
                                    <i class="fas fa-plus"></i> 이체 추가
                                </button>
                            </div>
                            <div class="payment-table-wrap">
                            <table class="payment-table">
                                <thead>
                                    <tr>
                                        <th style="width: 100px;">이체일자</th>
                                        <th style="width: 160px;">상호명</th>
                                        <th style="width: 100px;">이체금액(vat별도)</th>
                                        <th style="width: 88px;">부가세(vat)</th>
                                        <th style="width: 100px;">이체금액(vat포함)</th>
                                        <th style="width: 180px;">메모</th>
                                    </tr>
                                </thead>
                                <tbody id="transferList-${item.code}">
                                    <tr data-row-type="transfer" data-saved="true" onclick="onFinanceRowClick(event, this, 'transfer')">
                                        <td>2026-03-10</td>
                                        <td>영진인프라</td>
                                        <td style="font-weight: 600;">${Math.round((item.purchase * 0.6) / 1.1).toLocaleString()}원</td>
                                        <td style="font-weight: 600;">${Math.round((item.purchase * 0.6) - Math.round((item.purchase * 0.6) / 1.1)).toLocaleString()}원</td>
                                        <td style="font-weight: 600;">${(item.purchase * 0.6).toLocaleString()}원</td>
                                        <td>영진인프라</td>
                                    </tr>
                                </tbody>
                            </table>
                            </div>
                            <div class="payment-summary">
                                <span class="payment-summary-label">총 이체액(vat포함)</span>
                                <span class="payment-summary-value" id="transferSummary-${item.code}">${(item.purchase * 0.6).toLocaleString()}원 / ${item.purchase.toLocaleString()}원</span>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${canViewBusinessTab ? `
                <div class="new-estimate-tab-pane panel-tab-content ${activePanelTabId === 'business' ? 'active' : ''}" id="tab-business" data-tab-pane="business">
                    <div class="panel-section">
                        <div class="panel-section-title panel-section-title--actions">
                            <span style="display:flex;align-items:center;gap:8px;">
                                <i class="fas fa-briefcase" style="color:var(--primary);"></i> 사업소득
                            </span>
                            <span class="basic-info-title-actions" style="${isNewEstimate ? 'display:none;' : ''}">
                                <button type="button" class="btn-basic-info-edit" onclick="startBusinessIncomeEdit()" style="${businessInfoEditMode ? 'display:none;' : ''}">수정</button>
                                <button type="button" class="btn-basic-info-save" onclick="saveBusinessIncomeEdit()" style="${businessInfoEditMode ? '' : 'display:none;'}">저장</button>
                                <button type="button" class="btn-basic-info-cancel" onclick="cancelBusinessIncomeEdit()" style="${businessInfoEditMode ? '' : 'display:none;'}">취소</button>
                            </span>
                        </div>
                        <div class="detail-grid" style="max-width:520px;">
                            <div class="detail-row">
                                <div class="detail-label">이체일</div>
                                <div class="detail-value">
                                    <input type="date" class="form-input" id="biz_transfer_date" value="${item.businessIncomeTransferDate || ''}" ${(!businessInfoEditMode && !isEditMode && !isNewEstimate) ? 'disabled' : ''}>
                                </div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">사업소득금액</div>
                                <div class="detail-value">
                                    <input type="number" class="form-input" id="biz_gross" placeholder="세전 금액" min="0" step="1" value="${bizVals.gross}" oninput="syncBusinessIncomeDerived();" ${(!businessInfoEditMode && !isEditMode && !isNewEstimate) ? 'disabled' : ''}>
                                </div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">사업소득세 (3%)</div>
                                <div class="detail-value">
                                    <input type="number" class="form-input" id="biz_tax3" readonly value="${bizVals.tax3}" style="background:var(--gray-50);">
                                </div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">지방소득세 (0.3%)</div>
                                <div class="detail-value">
                                    <input type="number" class="form-input" id="biz_tax_local" readonly value="${bizVals.taxLocal}" style="background:var(--gray-50);">
                                </div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">세금합계 (3.3%)</div>
                                <div class="detail-value">
                                    <input type="number" class="form-input" id="biz_tax_total" readonly value="${bizVals.taxTotal}" style="background:var(--gray-50);">
                                </div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">차인지급액</div>
                                <div class="detail-value">
                                    <input type="number" class="form-input" id="biz_net" readonly value="${bizVals.net}" style="background:var(--gray-50);">
                                </div>
                            </div>
                            <div class="detail-row" style="align-items:start;">
                                <div class="detail-label" style="padding-top:8px;">지급 여부</div>
                                <div class="detail-value" style="padding-top:8px; display:flex; gap:20px; align-items:center;">
                                    <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                                        <input type="radio" name="biz_paid" value="지급" ${item.businessIncomePaidStatus === '지급' ? 'checked' : ''} ${(!businessInfoEditMode && !isEditMode && !isNewEstimate) ? 'disabled' : ''} onchange="markPanelDirtyIfChanged()">
                                        <span>지급</span>
                                    </label>
                                    <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                                        <input type="radio" name="biz_paid" value="미지급" ${item.businessIncomePaidStatus !== '지급' ? 'checked' : ''} ${(!businessInfoEditMode && !isEditMode && !isNewEstimate) ? 'disabled' : ''} onchange="markPanelDirtyIfChanged()">
                                        <span>미지급</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${canViewProfitTab ? `
                <div class="new-estimate-tab-pane panel-tab-content ${activePanelTabId === 'profit' ? 'active' : ''}" id="tab-profit" data-tab-pane="profit">
                    <div class="panel-section">
                        <div class="detail-grid">
                            <div class="detail-row">
                                <div class="detail-label">매출금액(vat별도)</div>
                                <div class="detail-value large" id="profitRevenueNet-${item.code}" style="color: var(--primary);">${profitNetTotals.salesNet.toLocaleString()}원</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">매입금액(vat별도)</div>
                                <div class="detail-value large" id="profitPurchaseNet-${item.code}" style="color: var(--danger);">${profitNetTotals.purchaseNet.toLocaleString()}원</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">사업소득(세전)</div>
                                <div class="detail-value large" id="profitBizGross-${item.code}" style="color: var(--gray-700);">${profitNetTotals.businessGross.toLocaleString()}원</div>
                            </div>
                            <div class="detail-row" style="padding-top: 16px; border-top: 2px solid var(--gray-200);">
                                <div class="detail-label">순이익(vat별도)</div>
                                <div class="detail-value large" id="profitNet-${item.code}" style="color: var(--success); font-size: 24px; font-weight: 700;">${profitNetTotals.profitNet.toLocaleString()}원</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">수익률</div>
                                <div class="detail-value large" id="profitMargin-${item.code}" style="color: var(--success);">${profitNetTotals.salesNet > 0 ? (profitNetTotals.profitNet / profitNetTotals.salesNet * 100).toFixed(1) : 0}%</div>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}
            `;

            // 버튼 표시/숨김
            // 상단 "수정" 버튼은 UI에서 제거됨 (index.html). 안전하게 숨김 처리만 유지.
            if (document.getElementById('btnEdit')) document.getElementById('btnEdit').style.display = 'none';
            document.getElementById('btnSave').style.display = 'none';
            document.getElementById('btnCancel').style.display = 'none';
            const bottomSaveBarEl = document.getElementById('panelBottomSaveBar');
            if (bottomSaveBarEl) bottomSaveBarEl.style.display = (isEditMode || isNewEstimate) ? 'flex' : 'none';
            if (isEditMode || isNewEstimate) {
                resetPanelDirtyState();
            }
            if (item && item.code) recalcFinanceSummaries(item.code);
        }

        // 행 ⋮ 메뉴 — 인라인 액션 방식 (드롭다운 없음, 겹침 방지)
        function paymentRowMenuHtml() {
            return '<span class="payment-action-inline">' +
                '<button type="button" class="payment-row-menu-trigger" onclick="event.stopPropagation(); togglePaymentRowInline(this)" title="메뉴"><i class="fas fa-ellipsis-v"></i></button>' +
                '<span class="payment-action-buttons">' +
                '<button type="button" class="payment-inline-btn" onclick="event.stopPropagation(); editRow(this); closePaymentRowInlines();">수정</button>' +
                '<button type="button" class="payment-inline-btn payment-inline-btn-danger" onclick="event.stopPropagation(); deleteRow(this); closePaymentRowInlines();">삭제</button>' +
                '</span></span>';
        }

        function togglePaymentRowInline(trigger) {
            const wrap = trigger.closest('.payment-action-inline');
            if (!wrap) return;
            const isExpanded = wrap.classList.contains('payment-action-inline--expanded');
            closePaymentRowInlines();
            if (!isExpanded) {
                wrap.classList.add('payment-action-inline--expanded');
            }
        }

        function closePaymentRowInlines() {
            document.querySelectorAll('.payment-action-inline--expanded').forEach(w => w.classList.remove('payment-action-inline--expanded'));
        }

        document.addEventListener('click', closePaymentRowInlines);

        let financeModalState = null;

        function onFinanceRowClick(event, row, type) {
            if (!row) return;
            if ((row.getAttribute('data-row-type') || '') === 'unpaid') return;
            const t = event && event.target;
            if (t && t.closest && t.closest('.file-link')) return;
            const tbody = row.closest('tbody');
            if (!tbody) return;
            const code = tbody.id
                .replace('salesList-', '')
                .replace('salesPayments-', '')
                .replace('purchaseList-', '')
                .replace('transferList-', '');
            openFinanceRowModal(type, code, row);
        }

        function getFinanceModalRoot() {
            let root = document.getElementById('financeRowModalRoot');
            if (root) return root;
            root = document.createElement('div');
            root.id = 'financeRowModalRoot';
            document.body.appendChild(root);
            return root;
        }

        function getRowValuesForModal(type, row) {
            if (!row) {
                if (type === 'sales' || type === 'purchase') {
                    return [new Date().toISOString().slice(0, 10), '', '', '', '', '미발행', '-', '', null];
                }
                return [new Date().toISOString().slice(0, 10), '', '', '', '', '', null];
            }
            let values = [];
            if (row.dataset.rowValues) {
                values = JSON.parse(row.dataset.rowValues);
            } else {
                values = Array.from(row.cells).map(function (c) { return (c.textContent || '').replace(/원/g, '').trim(); });
                values.push(null);
            }
            if (type === 'sales' || type === 'purchase') { migrateSalesRowValuesIfOld(values); normalizeSalesVatIncluded(values); }
            if (type === 'payment') { migratePaymentRowValuesIfOld(values); normalizePaymentVatValues(values); }
            if (type === 'transfer') { migratePaymentRowValuesIfOld(values); normalizePaymentVatValues(values); }
            return values;
        }

        function renderFinanceRow(row, type, values, rowFileId) {
            function won(v) {
                const n = parseFloat(String(v || '').replace(/,/g, ''), 10);
                return (!isNaN(n) && n !== 0) ? n.toLocaleString() + '원' : (v ? String(v) + '원' : '');
            }
            if (type === 'sales' || type === 'purchase') {
                const fileCell = (rowFileId && window.savedRowFiles && window.savedRowFiles[rowFileId] && window.savedRowFiles[rowFileId].length > 0)
                    ? '<span class="file-link" onclick="event.stopPropagation(); viewSavedRowFiles(\'' + rowFileId + '\')" style="color: var(--primary); cursor: pointer;"><i class="fas fa-eye"></i> (' + window.savedRowFiles[rowFileId].length + ')</span>'
                    : '-';
                const taxbillText = (values[5] || '');
                const taxbillHtml = taxbillText === '발행'
                    ? '<span class="badge badge-issued">발행</span>'
                    : (taxbillText === '미발행'
                        ? '<span class="badge badge-not-issued">미발행</span>'
                        : taxbillText);
                row.innerHTML =
                    '<td>' + (values[0] || '') + '</td>' +
                    '<td>' + (values[1] || '') + '</td>' +
                    '<td style="font-weight:600;">' + won(values[2]) + '</td>' +
                    '<td style="font-weight:600;">' + won(values[3]) + '</td>' +
                    '<td style="font-weight:600;">' + won(values[4]) + '</td>' +
                    '<td>' + taxbillHtml + '</td>' +
                    '<td>' + fileCell + '</td>' +
                    '<td>' + (values[7] || '') + '</td>';
                row.setAttribute('onclick', "onFinanceRowClick(event, this, '" + type + "')");
                if (rowFileId) row.dataset.rowFileId = rowFileId;
                else row.removeAttribute('data-row-file-id');
            } else {
                row.innerHTML =
                    '<td>' + (values[0] || '') + '</td>' +
                    '<td>' + (values[1] || '') + '</td>' +
                    '<td style="font-weight:600;">' + won(values[2]) + '</td>' +
                    '<td style="font-weight:600;">' + won(values[3]) + '</td>' +
                    '<td style="font-weight:600;">' + won(values[4]) + '</td>' +
                    '<td>' + (values[5] || '') + '</td>';
                row.setAttribute('onclick', "onFinanceRowClick(event, this, '" + type + "')");
            }
            row.setAttribute('data-row-type', type);
            row.setAttribute('data-saved', 'true');
            row.dataset.rowValues = JSON.stringify(values);
            row.classList.add('finance-row-clickable');
        }

        function openFinanceRowModal(type, code, row) {
            const values = getRowValuesForModal(type, row);
            const root = getFinanceModalRoot();
            const isEdit = !!row;
            const fileCount = (row && row.dataset.rowFileId && window.savedRowFiles && window.savedRowFiles[row.dataset.rowFileId]) ? window.savedRowFiles[row.dataset.rowFileId].length : 0;
            const modalFileId = 'modal-file-' + Date.now();
            financeModalState = { type: type, code: code, row: row, modalFileId: modalFileId, rowFileId: row ? (row.dataset.rowFileId || '') : '' };

            root.innerHTML = `
                <div style="position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:2000;display:flex;align-items:center;justify-content:center;">
                    <div style="width:min(760px,92vw);background:#fff;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 16px 40px rgba(0,0,0,.2);">
                        <div style="padding:14px 16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                            <span style="font-weight:700;">${type === 'sales' ? '매출 내역' : (type === 'purchase' ? '매입 내역' : (type === 'payment' ? '수금 내역' : '이체 내역'))} ${isEdit ? '수정' : '추가'}</span>
                            ${(type === 'payment' || type === 'transfer')
                                ? '<button type="button" class="btn btn-secondary" onclick="applySameFromSourceToFinanceModal()">동일</button>'
                                : ''}
                        </div>
                        <div style="padding:14px 16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
                            <input id="fm_date" type="date" value="${values[0] || ''}" class="form-input">
                            <input id="fm_name" type="text" value="${(values[1] || '').replace(/"/g, '&quot;')}" placeholder="상호명" class="form-input">
                            <input id="fm_net" type="number" value="${String(values[2] || '').replace(/,/g, '')}" placeholder="vat별도" class="form-input">
                            <input id="fm_tax" type="number" value="${String(values[3] || '').replace(/,/g, '')}" placeholder="부가세" class="form-input" readonly>
                            <input id="fm_gross" type="number" value="${String(values[4] || '').replace(/,/g, '')}" placeholder="vat포함" class="form-input">
                            ${type === 'sales' || type === 'purchase'
                                ? '<select id="fm_taxbill" class="form-select"><option value="미발행"' + (values[5] === '미발행' ? ' selected' : '') + '>미발행</option><option value="발행"' + (values[5] === '발행' ? ' selected' : '') + '>발행</option></select>'
                                : '<span></span>'}
                            <input id="fm_memo" type="text" value="${String((type === 'sales' || type === 'purchase') ? (values[7] || '') : (values[5] || '')).replace(/"/g, '&quot;')}" placeholder="메모" class="form-input" style="grid-column:1 / -1;">
                            ${type === 'sales' || type === 'purchase'
                                ? '<div style="grid-column:1 / -1;display:flex;align-items:center;gap:8px;"><input type="file" id="' + modalFileId + '" class="file-input-hidden" accept="image/*,application/pdf" multiple onchange="handleMultiFileSelect(this, \'' + modalFileId + '\')"><button type="button" class="btn-file-upload" onclick="document.getElementById(\'' + modalFileId + '\').click()">업로드</button><button type="button" class="btn-file-view" onclick="showFileList(\'' + modalFileId + '\')">첨부 보기' + (fileCount > 0 ? ' (' + fileCount + ')' : '') + '</button></div>'
                                : ''}
                        </div>
                        <div style="padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:8px;">
                            <button type="button" class="btn btn-primary" onclick="confirmDeleteFinanceRow()" ${isEdit ? 'style="background: var(--danger); border-color: var(--danger);"' : 'style="visibility:hidden"'}>삭제</button>
                            <div style="display:flex;gap:8px;">
                                <button type="button" class="btn btn-secondary" onclick="closeFinanceRowModal()">취소</button>
                                <button type="button" class="btn btn-primary" onclick="saveFinanceRowModal()">저장</button>
                            </div>
                        </div>
                    </div>
                </div>`;

            const net = document.getElementById('fm_net');
            const gross = document.getElementById('fm_gross');
            if (net) net.addEventListener('input', function () {
                const n = parseFloat(net.value || '0', 10) || 0;
                document.getElementById('fm_tax').value = n ? String(Math.round(n * 0.1)) : '';
                gross.value = n ? String(Math.round(n * 1.1)) : '';
            });
            if (gross) gross.addEventListener('input', function () {
                const g = parseFloat(gross.value || '0', 10) || 0;
                const p = splitNetTaxFromGross(g);
                document.getElementById('fm_net').value = p.net ? String(p.net) : '';
                document.getElementById('fm_tax').value = p.tax ? String(p.tax) : '';
            });
            if ((type === 'sales' || type === 'purchase') && row && row.dataset.rowFileId && window.savedRowFiles && window.savedRowFiles[row.dataset.rowFileId]) {
                if (!window.uploadedFiles) window.uploadedFiles = {};
                window.uploadedFiles[modalFileId] = JSON.parse(JSON.stringify(window.savedRowFiles[row.dataset.rowFileId]));
            }
        }

        function closeFinanceRowModal() {
            const root = document.getElementById('financeRowModalRoot');
            if (root) root.innerHTML = '';
            financeModalState = null;
        }

        function saveFinanceRowModal() {
            if (!financeModalState) return;
            const type = financeModalState.type;
            const code = financeModalState.code;
            const row = financeModalState.row;
            const date = document.getElementById('fm_date').value;
            const name = document.getElementById('fm_name').value.trim();
            const net = parseFloat(document.getElementById('fm_net').value || '0', 10) || 0;
            const gross = parseFloat(document.getElementById('fm_gross').value || '0', 10) || 0;
            const memo = document.getElementById('fm_memo').value.trim();
            if (!date || !name || !gross) { alert('수금일자/상호명/금액은 필수입니다.'); return; }
            const parts = splitNetTaxFromGross(gross || Math.round(net * 1.1));
            let values;
            if (type === 'sales' || type === 'purchase') {
                const taxbill = document.getElementById('fm_taxbill').value;
                values = [date, name, parts.net.toLocaleString(), parts.tax.toLocaleString(), parts.gross.toLocaleString(), taxbill, '-', memo, null];
            } else {
                values = [date, name, parts.net.toLocaleString(), parts.tax.toLocaleString(), parts.gross.toLocaleString(), memo, null];
            }
            let targetRow = row;
            if (!targetRow) {
                const tbody = document.getElementById(
                    type === 'sales' ? ('salesList-' + code)
                    : type === 'payment' ? ('salesPayments-' + code)
                    : type === 'purchase' ? ('purchaseList-' + code)
                    : ('transferList-' + code)
                );
                if (!tbody) return;
                targetRow = tbody.insertRow();
            }
            let rowFileId = financeModalState.rowFileId || '';
            if (type === 'sales' || type === 'purchase') {
                const fid = financeModalState.modalFileId;
                if (window.uploadedFiles && window.uploadedFiles[fid] && window.uploadedFiles[fid].length > 0) {
                    if (!rowFileId) rowFileId = 'rowfile-' + Date.now() + '-' + Math.random().toString(36).slice(2);
                    if (!window.savedRowFiles) window.savedRowFiles = {};
                    window.savedRowFiles[rowFileId] = JSON.parse(JSON.stringify(window.uploadedFiles[fid]));
                }
            }
            renderFinanceRow(targetRow, type, values, rowFileId);
            recalcFinanceSummaries(code);
            markPanelDirtyIfChanged();
            closeFinanceRowModal();
        }

        function confirmDeleteFinanceRow() {
            if (!financeModalState || !financeModalState.row) return;
            if (!confirm('이 항목을 삭제하시겠습니까?')) return;
            const code = financeModalState.code;
            financeModalState.row.remove();
            recalcFinanceSummaries(code);
            markPanelDirtyIfChanged();
            closeFinanceRowModal();
        }

        function parseWonTextToNumber(v) {
            const n = parseFloat(String(v || '').replace(/원/g, '').replace(/,/g, '').trim(), 10);
            return isNaN(n) ? 0 : n;
        }

        function getRowNetFromValues(row, fallbackCellIndex) {
            if (row && row.dataset && row.dataset.rowValues) {
                const values = JSON.parse(row.dataset.rowValues);
                return parseWonTextToNumber(values[2]);
            }
            return parseWonTextToNumber(row && row.cells && row.cells[fallbackCellIndex] ? row.cells[fallbackCellIndex].textContent : 0);
        }

        function getRowGrossFromValues(row, fallbackCellIndex) {
            if (row && row.dataset && row.dataset.rowValues) {
                const values = JSON.parse(row.dataset.rowValues);
                return parseWonTextToNumber(values[4]);
            }
            return parseWonTextToNumber(row && row.cells && row.cells[fallbackCellIndex] ? row.cells[fallbackCellIndex].textContent : 0);
        }

        function getProfitNetTotalsByCode(code, fallbackRevenueGross, fallbackPurchaseGross, businessIncomeGross) {
            const salesBody = document.getElementById('salesList-' + code);
            const purchaseBody = document.getElementById('purchaseList-' + code);
            let salesNet = 0;
            let purchaseNet = 0;
            if (salesBody) {
                Array.from(salesBody.rows).forEach(function (r) {
                    if ((r.getAttribute('data-row-type') || 'sales') !== 'sales') return;
                    salesNet += getRowNetFromValues(r, 2);
                });
            }
            if (purchaseBody) {
                Array.from(purchaseBody.rows).forEach(function (r) {
                    if ((r.getAttribute('data-row-type') || 'purchase') !== 'purchase') return;
                    purchaseNet += getRowNetFromValues(r, 2);
                });
            }
            if (!salesNet && fallbackRevenueGross) salesNet = Math.round((fallbackRevenueGross || 0) / 1.1);
            if (!purchaseNet && fallbackPurchaseGross) purchaseNet = Math.round((fallbackPurchaseGross || 0) / 1.1);
            const bizGross = Math.round(Number(businessIncomeGross) || 0);
            const profitNet = salesNet - purchaseNet - bizGross;
            return { salesNet: salesNet, purchaseNet: purchaseNet, businessGross: bizGross, profitNet: profitNet };
        }

        function updateProfitAnalysisSummary(code, salesNet, purchaseNet, businessIncomeGross) {
            const revenueEl = document.getElementById('profitRevenueNet-' + code);
            const purchaseEl = document.getElementById('profitPurchaseNet-' + code);
            const bizEl = document.getElementById('profitBizGross-' + code);
            const profitEl = document.getElementById('profitNet-' + code);
            const marginEl = document.getElementById('profitMargin-' + code);
            if (!revenueEl || !purchaseEl || !profitEl || !marginEl) return;
            const bizGross = Math.round(Number(businessIncomeGross) || 0);
            const profit = salesNet - purchaseNet - bizGross;
            const margin = salesNet > 0 ? (profit / salesNet * 100) : 0;
            revenueEl.textContent = salesNet.toLocaleString() + '원';
            purchaseEl.textContent = purchaseNet.toLocaleString() + '원';
            if (bizEl) bizEl.textContent = bizGross.toLocaleString() + '원';
            profitEl.textContent = profit.toLocaleString() + '원';
            marginEl.textContent = margin.toFixed(1) + '%';
        }

        function recalcFinanceSummaries(code) {
            const salesBody = document.getElementById('salesList-' + code);
            const payBody = document.getElementById('salesPayments-' + code);
            const purchaseBody = document.getElementById('purchaseList-' + code);
            const transferBody = document.getElementById('transferList-' + code);

            let salesTotal = 0, paymentDone = 0, purchaseTotal = 0, transferDone = 0;
            let salesNet = 0, purchaseNet = 0;
            const salesDates = [];
            if (salesBody) Array.from(salesBody.rows).forEach(function (r) {
                if ((r.getAttribute('data-row-type') || 'sales') !== 'sales') return;
                salesTotal += getRowGrossFromValues(r, 4);
                salesNet += getRowNetFromValues(r, 2);
                let dt = '';
                if (r.dataset && r.dataset.rowValues) {
                    const v = JSON.parse(r.dataset.rowValues);
                    dt = (v[0] || '').trim();
                } else if (r.cells && r.cells[0]) {
                    dt = (r.cells[0].textContent || '').trim();
                }
                if (dt && /^\d{4}-\d{2}-\d{2}/.test(dt)) salesDates.push(dt.slice(0, 10));
            });
            if (payBody) Array.from(payBody.rows).forEach(function (r) {
                if ((r.getAttribute('data-row-type') || '') !== 'payment') return;
                paymentDone += getRowGrossFromValues(r, 4);
            });
            if (purchaseBody) Array.from(purchaseBody.rows).forEach(function (r) {
                if ((r.getAttribute('data-row-type') || 'purchase') !== 'purchase') return;
                purchaseTotal += getRowGrossFromValues(r, 4);
                purchaseNet += getRowNetFromValues(r, 2);
            });
            if (transferBody) Array.from(transferBody.rows).forEach(function (r) {
                if ((r.getAttribute('data-row-type') || '') !== 'transfer') return;
                transferDone += getRowGrossFromValues(r, 4);
            });

            const estRow = estimates.find(function (e) { return e.code === code; });
            const salesRowCnt = salesBody ? salesBody.rows.length : 0;
            const purchaseRowCnt = purchaseBody ? purchaseBody.rows.length : 0;
            if (!salesTotal && !salesRowCnt && estRow && estRow.revenue) salesTotal = estRow.revenue;
            if (!purchaseTotal && !purchaseRowCnt && estRow && estRow.purchase) purchaseTotal = estRow.purchase;

            const salesSummary = document.getElementById('salesSummary-' + code);
            const paymentSummary = document.getElementById('paymentSummary-' + code);
            const purchaseSummary = document.getElementById('purchaseSummary-' + code);
            const transferSummary = document.getElementById('transferSummary-' + code);
            if (salesSummary) salesSummary.textContent = salesTotal.toLocaleString() + '원';
            if (paymentSummary) paymentSummary.textContent = paymentDone.toLocaleString() + '원 / ' + salesTotal.toLocaleString() + '원';
            if (purchaseSummary) purchaseSummary.textContent = purchaseTotal.toLocaleString() + '원';
            if (transferSummary) transferSummary.textContent = transferDone.toLocaleString() + '원 / ' + purchaseTotal.toLocaleString() + '원';

            if (estRow) {
                estRow.aggregateSalesGross = salesTotal;
                estRow.aggregatePaymentGross = paymentDone;
                estRow.aggregatePurchaseGross = purchaseTotal;
                estRow.aggregateTransferGross = transferDone;
                estRow.salesDates = salesDates;
            }
            if (currentEditItem && currentEditItem.code === code) {
                currentEditItem.aggregateSalesGross = salesTotal;
                currentEditItem.aggregatePaymentGross = paymentDone;
                currentEditItem.aggregatePurchaseGross = purchaseTotal;
                currentEditItem.aggregateTransferGross = transferDone;
                currentEditItem.salesDates = salesDates;
            }
            let bizGrossForProfit = estRow ? (estRow.businessIncomeGross || 0) : 0;
            const bizInput = document.getElementById('biz_gross');
            if (bizInput && currentEditItem && currentEditItem.code === code && (currentEditItem.type === '세금계산서' || currentEditItem.type === '사업소득')) {
                bizGrossForProfit = computeBizTaxFromGross(bizInput.value).gross;
            }
            updateProfitAnalysisSummary(code, salesNet, purchaseNet, bizGrossForProfit);
        }

        function applySameFromSourceToFinanceModal() {
            if (!financeModalState || (financeModalState.type !== 'payment' && financeModalState.type !== 'transfer')) return;
            const sourceType = financeModalState.type === 'payment' ? 'sales' : 'purchase';
            const tbody = document.getElementById((sourceType === 'sales' ? 'salesList-' : 'purchaseList-') + financeModalState.code);
            if (!tbody || !tbody.rows || tbody.rows.length === 0) {
                alert('가져올 내역이 없습니다.');
                return;
            }
            const sourceRows = Array.from(tbody.rows).filter(function (r) {
                return (r.getAttribute('data-row-type') || sourceType) === sourceType;
            });
            if (!sourceRows.length) {
                alert('가져올 내역이 없습니다.');
                return;
            }
            openSamePickerModal(sourceRows, sourceType === 'sales' ? '매출 내역 선택' : '매입 내역 선택');
        }

        function openSamePickerModal(rows, titleText) {
            const optionsHtml = rows.map(function (row, idx) {
                let values = [];
                if (row.dataset && row.dataset.rowValues) {
                    values = JSON.parse(row.dataset.rowValues);
                } else {
                    values = Array.from(row.cells).map(function (c) { return (c.textContent || '').replace(/원/g, '').trim(); });
                }
                migrateSalesRowValuesIfOld(values);
                normalizeSalesVatIncluded(values);
                const label = (values[0] || '-') + ' | ' + (values[1] || '-') + ' | ' +
                    (values[2] || '0') + ' / ' + (values[3] || '0') + ' / ' + (values[4] || '0');
                row.dataset.samePickValues = JSON.stringify(values);
                return '<label style="display:flex;gap:8px;align-items:flex-start;padding:8px 4px;border-bottom:1px solid #f1f5f9;cursor:pointer;">' +
                    '<input type="radio" name="same_sales_pick" value="' + idx + '" style="margin-top:2px;">' +
                    '<span style="font-size:13px;color:#334155;line-height:1.4;">' + label + '</span></label>';
            }).join('');
            const root = document.getElementById('financeRowModalRoot');
            if (!root) return;
            const picker = document.createElement('div');
            picker.id = 'sameSalesPickerModal';
            picker.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.28);z-index:2100;display:flex;align-items:center;justify-content:center;';
            picker.innerHTML = '<div style="width:min(640px,92vw);max-height:70vh;overflow:auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 16px 40px rgba(0,0,0,.2);">' +
                '<div style="padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:700;">' + titleText + '</div>' +
                '<div style="padding:8px 14px;">' + optionsHtml + '</div>' +
                '<div style="padding:12px 14px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px;">' +
                '<button type="button" class="btn btn-secondary" onclick="closeSalesSamePickerModal()">취소</button>' +
                '<button type="button" class="btn btn-primary" onclick="applySelectedSalesSame()">적용</button>' +
                '</div></div>';
            root.appendChild(picker);
        }

        function closeSalesSamePickerModal() {
            const el = document.getElementById('sameSalesPickerModal');
            if (el) el.remove();
        }

        function applySelectedSalesSame() {
            const picked = document.querySelector('input[name="same_sales_pick"]:checked');
            if (!picked) {
                alert('내역을 선택하세요.');
                return;
            }
            const sourceType = financeModalState.type === 'payment' ? 'sales' : 'purchase';
            const tbody = document.getElementById((sourceType === 'sales' ? 'salesList-' : 'purchaseList-') + financeModalState.code);
            if (!tbody) return;
            const rows = Array.from(tbody.rows).filter(function (r) {
                return (r.getAttribute('data-row-type') || sourceType) === sourceType;
            });
            const idx = parseInt(picked.value, 10);
            if (isNaN(idx) || idx < 0 || idx >= rows.length) return;
            const srcRow = rows[idx];
            const values = srcRow.dataset.samePickValues ? JSON.parse(srcRow.dataset.samePickValues) : [];
            const nameEl = document.getElementById('fm_name');
            const netEl = document.getElementById('fm_net');
            const taxEl = document.getElementById('fm_tax');
            const grossEl = document.getElementById('fm_gross');
            if (nameEl) nameEl.value = values[1] || '';
            if (netEl) netEl.value = String(values[2] || '').replace(/,/g, '');
            if (taxEl) taxEl.value = String(values[3] || '').replace(/,/g, '');
            if (grossEl) grossEl.value = String(values[4] || '').replace(/,/g, '');
            closeSalesSamePickerModal();
        }

        // date input: 날짜 칸(셀/입력) 어디를 눌러도 캘린더 열기 (브라우저 지원 시 showPicker 사용)
        function openDatePickerFromEvent(e) {
            const td = e.target && e.target.closest ? e.target.closest('td') : null;
            if (!td) return;
            const dateInput = td.querySelector('input[type="date"]');
            if (!dateInput) return;
            // 같은 셀 안의 다른 컨트롤을 누른 게 아니라면 date picker를 강제로 오픈
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
            dateInput.focus({ preventScroll: true });
            if (typeof dateInput.showPicker === 'function') {
                try { dateInput.showPicker(); } catch (_) {}
            }
        }
        // td 클릭
        document.addEventListener('click', openDatePickerFromEvent);
        // input 자체 클릭/포커스도 보강 (아이콘이 아니라 입력 영역 클릭 시도 포함)
        document.addEventListener('focusin', function(e) {
            if (e.target && e.target.matches && e.target.matches('input[type="date"]')) {
                if (typeof e.target.showPicker === 'function') {
                    try { e.target.showPicker(); } catch (_) {}
                }
            }
        });

        // 패널 탭 전환 (견적서 상세: new-estimate-tab / new-estimate-tab-pane 동일 적용)
        function switchPanelTab(event, tabId) {
            document.querySelectorAll('.panel-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.new-estimate-tab').forEach(tab => tab.classList.remove('active'));
            const ev = event != null ? event : window.event;
            const cur = ev && ev.currentTarget;
            if (cur && cur.classList) cur.classList.add('active');

            // 패널 재렌더링 시 활성 탭 유지
            activePanelTabId = tabId;

            document.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.new-estimate-tab-pane').forEach(c => c.classList.remove('active'));
            const target = document.getElementById('tab-' + tabId);
            if (target) target.classList.add('active');
        }

        function addPaymentRow(type, code) {
            openFinanceRowModal('payment', code, null);
        }

        /** vat별도 입력 시 부가세(10%)·vat포함 자동 (부가세 = 별도×0.1, 포함 = 별도×1.1) */
        function syncSalesVatGrossFromNet(netInput) {
            const tr = netInput.closest('tr');
            const taxInp = tr && tr.querySelector('input.row-input-sales-vat-tax');
            const grossInp = tr && tr.querySelector('input.row-input-sales-vat-gross');
            const raw = String(netInput.value || '').replace(/,/g, '').trim();
            const net = parseFloat(raw, 10);
            if (!isNaN(net) && net !== 0) {
                const tax = Math.round(net * 0.1);
                const gross = Math.round(net * 1.1);
                if (taxInp) taxInp.value = String(tax);
                if (grossInp) grossInp.value = String(gross);
            } else {
                if (taxInp) taxInp.value = '';
                if (grossInp) grossInp.value = '';
            }
        }

        function syncSalesVatFromGross(grossInput) {
            const tr = grossInput.closest('tr');
            const netInp = tr && tr.querySelector('input.row-input-sales-net');
            const taxInp = tr && tr.querySelector('input.row-input-sales-vat-tax');
            const gross = parseFloat(String(grossInput.value || '').replace(/,/g, '').trim(), 10);
            if (!isNaN(gross) && gross !== 0) {
                const parts = splitNetTaxFromGross(gross);
                if (netInp) netInp.value = String(parts.net);
                if (taxInp) taxInp.value = String(parts.tax);
                grossInput.value = String(parts.gross);
            } else {
                if (netInp) netInp.value = '';
                if (taxInp) taxInp.value = '';
            }
        }

        /** 구 형식 [일,상호,별도,포함,세금,첨부,메모,null] → 부가세 열 삽입 */
        function migrateSalesRowValuesIfOld(values) {
            if (!values || values.length === 0) return;
            if (values.length > 0 && values.length < 7) values.unshift('');
            if (values.length === 8 && values[7] === null && (values[4] === '미발행' || values[4] === '발행')) {
                const netNum = parseFloat(String(values[2]).replace(/,/g, ''), 10) || 0;
                const vatStr = netNum > 0 ? Math.round(netNum * 0.1).toLocaleString() : '';
                values.splice(3, 0, vatStr);
            }
        }

        /** vat별도 기준으로 부가세·vat포함 재계산 */
        function normalizeSalesVatIncluded(values) {
            if (!values || values.length < 5) return;
            const grossNum = parseFloat(String(values[4]).replace(/,/g, ''), 10);
            if (!isNaN(grossNum) && grossNum > 0) {
                const parts = splitNetTaxFromGross(grossNum);
                values[2] = parts.net.toLocaleString();
                values[3] = parts.tax.toLocaleString();
                values[4] = parts.gross.toLocaleString();
                return;
            }
            const netNum = parseFloat(String(values[2]).replace(/,/g, ''), 10) || 0;
            values[3] = netNum > 0 ? Math.round(netNum * 0.1).toLocaleString() : '';
            values[4] = netNum > 0 ? Math.round(netNum * 1.1).toLocaleString() : '';
        }

        /** vat포함 입력 기준으로 vat별도/부가세 분해 */
        function splitNetTaxFromGross(grossNumber) {
            const gross = parseFloat(grossNumber, 10) || 0;
            if (!gross) return { net: 0, tax: 0, gross: 0 };
            const net = Math.round(gross / 1.1);
            const tax = Math.round(gross - net);
            return { net: net, tax: tax, gross: Math.round(gross) };
        }

        function syncPaymentVatFromNet(netInput) {
            const tr = netInput.closest('tr');
            const taxInp = tr && tr.querySelector('input.row-input-payment-vat-tax');
            const grossInp = tr && tr.querySelector('input.row-input-payment-gross');
            const net = parseFloat(String(netInput.value || '').replace(/,/g, '').trim(), 10);
            if (!isNaN(net) && net !== 0) {
                const tax = Math.round(net * 0.1);
                const gross = Math.round(net * 1.1);
                if (taxInp) taxInp.value = String(tax);
                if (grossInp) grossInp.value = String(gross);
            } else {
                if (taxInp) taxInp.value = '';
                if (grossInp) grossInp.value = '';
            }
        }

        function syncPaymentVatFromGross(grossInput) {
            const tr = grossInput.closest('tr');
            const netInp = tr && tr.querySelector('input.row-input-payment-net');
            const taxInp = tr && tr.querySelector('input.row-input-payment-vat-tax');
            const gross = parseFloat(String(grossInput.value || '').replace(/,/g, '').trim(), 10);
            if (!isNaN(gross) && gross !== 0) {
                const parts = splitNetTaxFromGross(gross);
                if (netInp) netInp.value = String(parts.net);
                if (taxInp) taxInp.value = String(parts.tax);
                grossInput.value = String(parts.gross);
            } else {
                if (netInp) netInp.value = '';
                if (taxInp) taxInp.value = '';
            }
        }

        /** 구 형식 [일,상호,금액,메모,null] -> [일,상호,별도,부가세,포함,메모,null] */
        function migratePaymentRowValuesIfOld(values) {
            if (!values || values.length === 0) return;
            if (values.length === 5 && values[4] === null) {
                const gross = parseFloat(String(values[2] || '').replace(/,/g, ''), 10) || 0;
                const parts = splitNetTaxFromGross(gross);
                values.splice(2, 1, parts.net ? parts.net.toLocaleString() : '', parts.tax ? parts.tax.toLocaleString() : '', parts.gross ? parts.gross.toLocaleString() : '');
            }
        }

        function normalizePaymentVatValues(values) {
            if (!values || values.length < 5) return;
            const gross = parseFloat(String(values[4] || '').replace(/,/g, ''), 10);
            if (!isNaN(gross) && gross > 0) {
                const parts = splitNetTaxFromGross(gross);
                values[2] = parts.net.toLocaleString();
                values[3] = parts.tax.toLocaleString();
                values[4] = parts.gross.toLocaleString();
                return;
            }
            const net = parseFloat(String(values[2] || '').replace(/,/g, ''), 10) || 0;
            values[3] = net > 0 ? Math.round(net * 0.1).toLocaleString() : '';
            values[4] = net > 0 ? Math.round(net * 1.1).toLocaleString() : '';
        }

        // 매출 내역 추가 (상호명별)
        function addSalesRow(code) {
            openFinanceRowModal('sales', code, null);
        }

        function addPurchaseRow(code) {
            openFinanceRowModal('purchase', code, null);
        }

        function addTransferRow(code) {
            openFinanceRowModal('transfer', code, null);
        }

        // 새로 추가한 행 취소 (행 삭제)
        function cancelNewRow(btn) {
            btn.closest('tr').remove();
        }

        // 행 저장
        function saveRow(btn) {
            const row = btn.closest('tr');
            const inputs = row.querySelectorAll('.row-input');
            
            // 필수 입력 검증
            let hasEmptyField = false;
            inputs.forEach(input => {
                if (input.tagName === 'INPUT' && input.type !== 'file' && input.type !== 'date' && !input.value.trim()) {
                    hasEmptyField = true;
                    input.style.borderColor = 'var(--danger)';
                } else {
                    input.style.borderColor = '';
                }
            });
            
            if (hasEmptyField) {
                alert('모든 필드를 입력해주세요.');
                return;
            }
            
            // 저장 확인
            if (!confirm('입력한 내용을 저장하시겠습니까?')) {
                return;
            }

            // 값 수집 (input/select만)
            const values = [];
            var fileRowId = '';
            row.querySelectorAll('td').forEach((td, i) => {
                const input = td.querySelector('.row-input');
                const select = td.querySelector('select');
                const taxOnly = td.querySelector('input.row-input-sales-vat-tax');
                const grossOnly = td.querySelector('input.row-input-sales-vat-gross');
                const paymentTaxOnly = td.querySelector('input.row-input-payment-vat-tax');
                if (select) {
                    values.push(select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : '');
                } else if (input) {
                    values.push(input.type === 'number' ? (input.value ? Number(input.value).toLocaleString() : '') : (input.value || ''));
                } else if (taxOnly) {
                    values.push(taxOnly.value ? Number(String(taxOnly.value).replace(/,/g, '')).toLocaleString() : '');
                } else if (paymentTaxOnly) {
                    values.push(paymentTaxOnly.value ? Number(String(paymentTaxOnly.value).replace(/,/g, '')).toLocaleString() : '');
                } else if (grossOnly) {
                    values.push(grossOnly.value ? Number(String(grossOnly.value).replace(/,/g, '')).toLocaleString() : '');
                } else if (td.querySelector('input[type="file"]')) {
                    const fileInput = td.querySelector('input[type="file"]');
                    fileRowId = fileInput.id || '';
                    var fileCount = 0;
                    if (window.uploadedFiles && fileRowId && window.uploadedFiles[fileRowId] && window.uploadedFiles[fileRowId].length > 0) {
                        fileCount = window.uploadedFiles[fileRowId].length;
                    }
                    values.push(fileCount > 0 ? fileCount : '-');
                } else if (td.classList.contains('payment-action-cell')) {
                    values.push(null); // 액션 셀
                }
            });

            var tid = (row.closest('tbody') && row.closest('tbody').id) || '';
            var type = row.getAttribute('data-row-type') || (tid.indexOf('salesList') === 0 ? 'sales' : tid.indexOf('purchaseList') === 0 ? 'purchase' : tid.indexOf('salesPayments') === 0 ? 'payment' : tid.indexOf('transferList') === 0 ? 'transfer' : 'sales');
            if (!row.getAttribute('data-row-type')) row.setAttribute('data-row-type', type);

            // 첨부파일 데이터 행에 저장 (보기 클릭 시 미리보기용)
            var rowFileId = row.dataset.rowFileId;
            if (fileRowId && window.uploadedFiles && window.uploadedFiles[fileRowId] && window.uploadedFiles[fileRowId].length > 0) {
                if (!rowFileId) rowFileId = 'rowfile-' + Date.now() + '-' + Math.random().toString(36).slice(2);
                row.dataset.rowFileId = rowFileId;
                if (!window.savedRowFiles) window.savedRowFiles = {};
                window.savedRowFiles[rowFileId] = JSON.parse(JSON.stringify(window.uploadedFiles[fileRowId]));
            } else {
                if (row.dataset.rowFileId) {
                    if (window.savedRowFiles && window.savedRowFiles[row.dataset.rowFileId]) delete window.savedRowFiles[row.dataset.rowFileId];
                    row.removeAttribute('data-row-file-id');
                }
                rowFileId = null;
            }

            row.setAttribute('data-saved', 'true');
            row.dataset.rowValues = JSON.stringify(values);

            // 텍스트만 보이게 (입력 칸 제거) — 첨부파일은 보기(n) 클릭 가능
            const actionHtml = '<td class="payment-action-cell">' + paymentRowMenuHtml(true) + '</td>';
            var fileCellHtml = '-';
            if (rowFileId && window.savedRowFiles && window.savedRowFiles[rowFileId] && window.savedRowFiles[rowFileId].length > 0) {
                var n = window.savedRowFiles[rowFileId].length;
                fileCellHtml = '<span class="file-link" onclick="event.stopPropagation(); viewSavedRowFiles(\'' + rowFileId + '\')" style="color: var(--primary); cursor: pointer;"><i class="fas fa-eye"></i> (' + n + ')</span>';
            }

            if (type === 'sales') {
                migrateSalesRowValuesIfOld(values);
                normalizeSalesVatIncluded(values);
                row.innerHTML =
                    '<td>' + (values[0] || '') + '</td>' +                 // 매출일자
                    '<td>' + (values[1] || '') + '</td>' +                 // 상호명
                    '<td style="font-weight:600;">' + (values[2] || '') + '</td>' + // vat별도
                    '<td style="font-weight:600;">' + (values[3] || '') + '</td>' + // 부가세
                    '<td style="font-weight:600;">' + (values[4] || '') + '</td>' + // vat포함
                    '<td>' + (values[5] || '') + '</td>' +                 // 세금계산서
                    '<td>' + fileCellHtml + '</td>' +                      // 첨부파일
                    '<td>' + (values[7] || '') + '</td>' +                 // 메모
                    actionHtml;
            } else if (type === 'purchase') {
                // 구 데이터 호환: 날짜 컬럼이 없던 값 배열이면 앞에 빈 값 추가
                if (values.length > 0 && values.length < 6) values.unshift('');
                row.innerHTML =
                    '<td>' + (values[0] || '') + '</td>' +                      // 매입일자
                    '<td>' + (values[1] || '') + '</td>' +                      // 업체명
                    '<td style="font-weight:600;">' + (values[2] || '') + '</td>' + // 매입금액
                    '<td>' + (values[3] || '') + '</td>' +                      // 세금계산서
                    '<td>' + fileCellHtml + '</td>' +                           // 첨부파일
                    '<td>' + (values[5] || '') + '</td>' +                      // 메모
                    actionHtml;
            } else {
                // transfer
                row.innerHTML =
                    '<td>' + (values[0] || '') + '</td>' +                      // 날짜
                    '<td>' + (values[1] || '') + '</td>' +                      // 상호명/업체명
                    '<td style="font-weight:600;">' + (values[2] || '') + '</td>' + // 금액
                    '<td>' + (values[3] || '') + '</td>' +                      // 메모
                    actionHtml;
            }
            if (type === 'payment') {
                migratePaymentRowValuesIfOld(values);
                normalizePaymentVatValues(values);
                row.innerHTML =
                    '<td>' + (values[0] || '') + '</td>' +                      // 수금일자
                    '<td>' + (values[1] || '') + '</td>' +                      // 상호명
                    '<td style="font-weight:600;">' + (values[2] || '') + '</td>' + // vat별도
                    '<td style="font-weight:600;">' + (values[3] || '') + '</td>' + // 부가세
                    '<td style="font-weight:600;">' + (values[4] || '') + '</td>' + // vat포함
                    '<td>' + (values[5] || '') + '</td>' +                      // 메모
                    actionHtml;
            }

            console.log('저장된 데이터:', { row: row, values: values, timestamp: new Date().toISOString() });
            alert('저장되었습니다.');
        }

        // 행 수정 (저장된 행이면 텍스트 → 입력 칸으로 전환)
        function editRow(btn) {
            const row = btn.closest('tr');
            const tbodyId = (row.closest('tbody') && row.closest('tbody').id) || '';
            const code = tbodyId.replace('salesList-', '').replace('purchaseList-', '').replace('salesPayments-', '').replace('transferList-', '');

            if (row.getAttribute('data-saved') === 'true' && row.dataset.rowValues) {
                var values = JSON.parse(row.dataset.rowValues);
                var type = row.getAttribute('data-row-type') || 'sales';
                var rowId = type + '-' + Date.now();
                var rowFileId = row.dataset.rowFileId;
                var fileCellContent = '';
                if (rowFileId && window.savedRowFiles && window.savedRowFiles[rowFileId] && window.savedRowFiles[rowFileId].length > 0) {
                    if (!window.uploadedFiles) window.uploadedFiles = {};
                    window.uploadedFiles[rowId] = JSON.parse(JSON.stringify(window.savedRowFiles[rowFileId]));
                    var fc = window.uploadedFiles[rowId].length;
                    fileCellContent = '<input type="file" id="' + rowId + '" class="file-input-hidden" accept="image/*,application/pdf" multiple onchange="handleMultiFileSelect(this, \'' + rowId + '\')"><button class="btn-file-view" onclick="showFileList(\'' + rowId + '\')" title="첨부파일 보기"><i class="fas fa-eye"></i> (' + fc + ')</button><button class="btn-file-upload" onclick="document.getElementById(\'' + rowId + '\').click()" title="파일 추가" style="margin-left:4px;"><i class="fas fa-plus"></i></button>';
                } else {
                    fileCellContent = '<input type="file" id="' + rowId + '" class="file-input-hidden" accept="image/*,application/pdf" multiple onchange="handleMultiFileSelect(this, \'' + rowId + '\')"><button type="button" class="btn-file-upload" onclick="document.getElementById(\'' + rowId + '\').click()"><i class="fas fa-upload"></i> 업로드</button>';
                }
                if (type === 'sales') {
                    migrateSalesRowValuesIfOld(values);
                    var netStr = String(values[2] || '').replace(/,/g, '');
                    var netNum = parseFloat(netStr, 10) || 0;
                    var vatStr = String(values[3] || '').replace(/,/g, '');
                    var grossStr = String(values[4] || '').replace(/,/g, '');
                    if (!vatStr && netNum > 0) vatStr = String(Math.round(netNum * 0.1));
                    if (!grossStr && netNum > 0) grossStr = String(Math.round(netNum * 1.1));
                    var taxVal = (values[5] === '미발행' || values[5] === '발행') ? values[5] : '미발행';
                    var memoVal = (values[7] != null ? values[7] : values[6]) || '';
                    row.innerHTML =
                        '<td><input type="date" class="row-input" value="' + (values[0] || new Date().toISOString().slice(0, 10)) + '"></td>' +
                        '<td><input type="text" class="row-input" value="' + (values[1] || '').replace(/"/g, '&quot;') + '" placeholder="상호명"></td>' +
                        '<td><input type="number" class="row-input row-input-sales-net" value="' + netStr + '" placeholder="vat별도"></td>' +
                        '<td><input type="number" readonly class="row-input-sales-vat-tax" tabindex="-1" value="' + String(vatStr).replace(/"/g, '&quot;') + '" placeholder="부가세" title="vat별도 × 10% 자동"></td>' +
                        '<td><input type="number" class="row-input row-input-sales-vat-gross" value="' + String(grossStr).replace(/"/g, '&quot;') + '" placeholder="vat포함" title="vat포함 입력 시 vat별도/부가세 자동 역산"></td>' +
                        '<td><select class="row-input"><option value="미발행"' + (taxVal === '미발행' ? ' selected' : '') + '>미발행</option><option value="발행"' + (taxVal === '발행' ? ' selected' : '') + '>발행</option></select></td>' +
                        '<td>' + fileCellContent + '</td>' +
                        '<td><input type="text" class="row-input" value="' + String(memoVal).replace(/"/g, '&quot;') + '" placeholder="메모"></td>' +
                        '<td class="payment-action-cell"><button class="btn-save-row" onclick="saveEditedRow(this)" title="저장"><i class="fas fa-save"></i></button><button class="btn-cancel-row" onclick="cancelEditRow(this)" title="취소"><i class="fas fa-times"></i></button></td>';
                    var netInp = row.querySelector('.row-input-sales-net');
                    var grossInp = row.querySelector('.row-input-sales-vat-gross');
                    if (netInp) {
                        netInp.addEventListener('input', function () { syncSalesVatGrossFromNet(this); });
                        netInp.addEventListener('change', function () { syncSalesVatGrossFromNet(this); });
                    }
                    if (grossInp) {
                        grossInp.addEventListener('input', function () { syncSalesVatFromGross(this); });
                        grossInp.addEventListener('change', function () { syncSalesVatFromGross(this); });
                    }
                } else if (type === 'purchase') {
                    // 구 데이터 호환: 날짜 컬럼이 없던 값 배열이면 앞에 빈 값 추가
                    if (values.length > 0 && values.length < 6) values.unshift('');
                    row.innerHTML =
                        '<td><input type="date" class="row-input" value="' + (values[0] || new Date().toISOString().slice(0, 10)) + '"></td>' +
                        '<td><input type="text" class="row-input" value="' + (values[1] || '').replace(/"/g, '&quot;') + '" placeholder="업체명"></td>' +
                        '<td><input type="number" class="row-input" value="' + (String(values[2] || '').replace(/,/g, '')) + '" placeholder="금액"></td>' +
                        '<td><select class="row-input"><option value="미발행"' + (values[3] === '미발행' ? ' selected' : '') + '>미발행</option><option value="발행"' + (values[3] === '발행' ? ' selected' : '') + '>발행</option></select></td>' +
                        '<td>' + fileCellContent + '</td>' +
                        '<td><input type="text" class="row-input" value="' + (values[5] || '').replace(/"/g, '&quot;') + '" placeholder="메모"></td>' +
                        '<td class="payment-action-cell"><button class="btn-save-row" onclick="saveEditedRow(this)" title="저장"><i class="fas fa-save"></i></button><button class="btn-cancel-row" onclick="cancelEditRow(this)" title="취소"><i class="fas fa-times"></i></button></td>';
                } else if (type === 'payment') {
                    migratePaymentRowValuesIfOld(values);
                    var payNetStr = String(values[2] || '').replace(/,/g, '');
                    var payTaxStr = String(values[3] || '').replace(/,/g, '');
                    var payGrossStr = String(values[4] || '').replace(/,/g, '');
                    var payMemoVal = (values[5] || '');
                    row.innerHTML =
                        '<td><input type="date" class="row-input" value="' + (values[0] || new Date().toISOString().slice(0, 10)) + '"></td>' +
                        '<td><input type="text" class="row-input" value="' + (values[1] || '').replace(/"/g, '&quot;') + '" placeholder="상호명"></td>' +
                        '<td><input type="number" class="row-input row-input-payment-net" value="' + payNetStr + '" placeholder="vat별도"></td>' +
                        '<td><input type="number" readonly class="row-input-payment-vat-tax" tabindex="-1" value="' + payTaxStr + '" placeholder="부가세"></td>' +
                        '<td><input type="number" class="row-input row-input-payment-gross" value="' + payGrossStr + '" placeholder="vat포함"></td>' +
                        '<td><input type="text" class="row-input" value="' + String(payMemoVal).replace(/"/g, '&quot;') + '" placeholder="메모"></td>' +
                        '<td class="payment-action-cell"><button class="btn-save-row" onclick="saveEditedRow(this)" title="저장"><i class="fas fa-save"></i></button><button class="btn-cancel-row" onclick="cancelEditRow(this)" title="취소"><i class="fas fa-times"></i></button></td>';
                    var payNetInp = row.querySelector('.row-input-payment-net');
                    var payGrossInp = row.querySelector('.row-input-payment-gross');
                    if (payNetInp) {
                        payNetInp.addEventListener('input', function () { syncPaymentVatFromNet(this); });
                        payNetInp.addEventListener('change', function () { syncPaymentVatFromNet(this); });
                    }
                    if (payGrossInp) {
                        payGrossInp.addEventListener('input', function () { syncPaymentVatFromGross(this); });
                        payGrossInp.addEventListener('change', function () { syncPaymentVatFromGross(this); });
                    }
                } else {
                    // transfer
                    row.innerHTML =
                        '<td><input type="date" class="row-input" value="' + (values[0] || new Date().toISOString().slice(0, 10)) + '"></td>' +
                        '<td><input type="text" class="row-input" value="' + (values[1] || '').replace(/"/g, '&quot;') + '" placeholder="상호명"></td>' +
                        '<td><input type="number" class="row-input" style="text-align:right;" value="' + (String(values[2] || '').replace(/,/g, '')) + '" placeholder="금액"></td>' +
                        '<td><input type="text" class="row-input" value="' + (values[3] || '').replace(/"/g, '&quot;') + '" placeholder="메모"></td>' +
                        '<td class="payment-action-cell"><button class="btn-save-row" onclick="saveEditedRow(this)" title="저장"><i class="fas fa-save"></i></button><button class="btn-cancel-row" onclick="cancelEditRow(this)" title="취소"><i class="fas fa-times"></i></button></td>';
                }
                row.setAttribute('data-saved', 'false');
                var inputs = row.querySelectorAll('.row-input');
                var orig = []; inputs.forEach(function(inp) { orig.push(inp.value); });
                row.setAttribute('data-original', JSON.stringify(orig));
                return;
            }

            var inputs = row.querySelectorAll('.row-input');
            inputs.forEach(function(input) {
                input.style.background = 'var(--gray-50)';
                input.style.borderColor = 'var(--gray-300)';
                input.readOnly = false;
                if (input.tagName === 'SELECT') {
                    input.disabled = false;
                    input.style.pointerEvents = 'auto';
                }
            });
            row.setAttribute('data-saved', 'false');
            var originalData = [];
            inputs.forEach(function(input) { originalData.push(input.value); });
            row.setAttribute('data-original', JSON.stringify(originalData));
            var actionCell = row.querySelector('.payment-action-cell');
            if (actionCell) {
                actionCell.innerHTML = '<button class="btn-save-row" onclick="saveEditedRow(this)" title="저장"><i class="fas fa-save"></i></button><button class="btn-cancel-row" onclick="cancelEditRow(this)" title="취소"><i class="fas fa-times"></i></button>';
            }
        }

        // 수정 저장
        function saveEditedRow(btn) {
            const row = btn.closest('tr');
            const inputs = row.querySelectorAll('.row-input');
            
            // 필수 입력 검증
            let hasEmptyField = false;
            inputs.forEach(input => {
                if (input.tagName === 'INPUT' && input.type !== 'file' && input.type !== 'date' && !input.value.trim()) {
                    hasEmptyField = true;
                    input.style.borderColor = 'var(--danger)';
                } else {
                    input.style.borderColor = '';
                }
            });
            
            if (hasEmptyField) {
                alert('모든 필드를 입력해주세요.');
                return;
            }
            
            // 저장 확인
            if (!confirm('수정한 내용을 저장하시겠습니까?')) {
                return;
            }
            
            // 입력 필드를 읽기 전용으로 변경
            inputs.forEach(input => {
                input.style.background = 'white';
                input.style.borderColor = 'var(--gray-200)';
                input.readOnly = true;
                if (input.tagName === 'SELECT') {
                    input.disabled = true;
                    input.style.pointerEvents = 'none';
                    input.style.opacity = '1';
                }
            });
            
            row.setAttribute('data-saved', 'true');
            row.removeAttribute('data-original');

            var values = [];
            var fileRowId = '';
            row.querySelectorAll('td').forEach(function(td) {
                var input = td.querySelector('.row-input');
                var select = td.querySelector('select');
                var taxOnly = td.querySelector('input.row-input-sales-vat-tax');
                var grossOnly = td.querySelector('input.row-input-sales-vat-gross');
                var paymentTaxOnly = td.querySelector('input.row-input-payment-vat-tax');
                if (select) values.push(select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : '');
                else if (input) values.push(input.type === 'number' ? (input.value ? Number(input.value).toLocaleString() : '') : (input.value || ''));
                else if (taxOnly) values.push(taxOnly.value ? Number(String(taxOnly.value).replace(/,/g, '')).toLocaleString() : '');
                else if (paymentTaxOnly) values.push(paymentTaxOnly.value ? Number(String(paymentTaxOnly.value).replace(/,/g, '')).toLocaleString() : '');
                else if (grossOnly) values.push(grossOnly.value ? Number(String(grossOnly.value).replace(/,/g, '')).toLocaleString() : '');
                else if (td.querySelector('input[type="file"]')) {
                    var fi = td.querySelector('input[type="file"]');
                    fileRowId = fi.id || '';
                    var fc = (window.uploadedFiles && fileRowId && window.uploadedFiles[fileRowId]) ? window.uploadedFiles[fileRowId].length : 0;
                    values.push(fc > 0 ? fc : '-');
                } else if (td.classList.contains('payment-action-cell')) values.push(null);
            });
            row.dataset.rowValues = JSON.stringify(values);
            var type = row.getAttribute('data-row-type') || 'sales';
            var rowFileId = row.dataset.rowFileId;
            if (fileRowId && window.uploadedFiles && window.uploadedFiles[fileRowId] && window.uploadedFiles[fileRowId].length > 0) {
                if (!rowFileId) rowFileId = 'rowfile-' + Date.now() + '-' + Math.random().toString(36).slice(2);
                row.dataset.rowFileId = rowFileId;
                if (!window.savedRowFiles) window.savedRowFiles = {};
                window.savedRowFiles[rowFileId] = JSON.parse(JSON.stringify(window.uploadedFiles[fileRowId]));
            } else if (row.dataset.rowFileId) {
                if (window.savedRowFiles && window.savedRowFiles[row.dataset.rowFileId]) delete window.savedRowFiles[row.dataset.rowFileId];
                row.removeAttribute('data-row-file-id');
                rowFileId = null;
            }
            var actionHtml = '<td class="payment-action-cell">' + paymentRowMenuHtml(true) + '</td>';
            var fileCellHtml = '-';
            if (rowFileId && window.savedRowFiles && window.savedRowFiles[rowFileId] && window.savedRowFiles[rowFileId].length > 0) {
                fileCellHtml = '<span class="file-link" onclick="event.stopPropagation(); viewSavedRowFiles(\'' + rowFileId + '\')" style="color: var(--primary); cursor: pointer;"><i class="fas fa-eye"></i> (' + window.savedRowFiles[rowFileId].length + ')</span>';
            }
            if (type === 'sales') {
                migrateSalesRowValuesIfOld(values);
                normalizeSalesVatIncluded(values);
                row.innerHTML =
                    '<td>' + (values[0] || '') + '</td>' +                 // 매출일자
                    '<td>' + (values[1] || '') + '</td>' +                 // 상호명
                    '<td style="font-weight:600;">' + (values[2] || '') + '</td>' + // vat별도
                    '<td style="font-weight:600;">' + (values[3] || '') + '</td>' + // 부가세
                    '<td style="font-weight:600;">' + (values[4] || '') + '</td>' + // vat포함
                    '<td>' + (values[5] || '') + '</td>' +                 // 세금계산서
                    '<td>' + fileCellHtml + '</td>' +                      // 첨부파일
                    '<td>' + (values[7] || '') + '</td>' +                 // 메모
                    actionHtml;
            } else if (type === 'purchase') {
                row.innerHTML = '<td>' + (values[0] || '') + '</td><td style="font-weight:600;">' + (values[1] || '') + '</td><td>' + (values[2] || '') + '</td><td>' + (values[3] || '') + '</td><td>' + fileCellHtml + '</td><td>' + (values[5] || '') + '</td>' + actionHtml;
            } else if (type === 'payment') {
                migratePaymentRowValuesIfOld(values);
                normalizePaymentVatValues(values);
                row.innerHTML =
                    '<td>' + (values[0] || '') + '</td>' +
                    '<td>' + (values[1] || '') + '</td>' +
                    '<td style="font-weight:600;">' + (values[2] || '') + '</td>' +
                    '<td style="font-weight:600;">' + (values[3] || '') + '</td>' +
                    '<td style="font-weight:600;">' + (values[4] || '') + '</td>' +
                    '<td>' + (values[5] || '') + '</td>' +
                    actionHtml;
            } else {
                row.innerHTML = '<td>' + (values[0] || '') + '</td><td>' + (values[1] || '') + '</td><td style="font-weight:600;">' + (values[2] || '') + '</td><td>' + (values[3] || '') + '</td>' + actionHtml;
            }
            console.log('수정 저장된 데이터:', { row: row, values: values });
            alert('수정 내용이 저장되었습니다.');
        }

        // 수정 취소 (텍스트만 보이는 저장 상태로 복원)
        function cancelEditRow(btn) {
            var row = btn.closest('tr');
            var values = JSON.parse(row.dataset.rowValues || '[]');
            var type = row.getAttribute('data-row-type') || 'sales';
            row.setAttribute('data-saved', 'true');
            row.removeAttribute('data-original');
            var actionHtml = '<td class="payment-action-cell">' + paymentRowMenuHtml(true) + '</td>';
            var fileCellHtml = '-';
            var rowFileId = row.dataset.rowFileId;
            if (rowFileId && window.savedRowFiles && window.savedRowFiles[rowFileId] && window.savedRowFiles[rowFileId].length > 0) {
                fileCellHtml = '<span class="file-link" onclick="event.stopPropagation(); viewSavedRowFiles(\'' + rowFileId + '\')" style="color: var(--primary); cursor: pointer;"><i class="fas fa-eye"></i> (' + window.savedRowFiles[rowFileId].length + ')</span>';
            }
            if (type === 'sales') {
                migrateSalesRowValuesIfOld(values);
                normalizeSalesVatIncluded(values);
                row.innerHTML =
                    '<td>' + (values[0] || '') + '</td>' +                 // 매출일자
                    '<td>' + (values[1] || '') + '</td>' +                 // 상호명
                    '<td style="font-weight:600;">' + (values[2] || '') + '</td>' + // vat별도
                    '<td style="font-weight:600;">' + (values[3] || '') + '</td>' + // 부가세
                    '<td style="font-weight:600;">' + (values[4] || '') + '</td>' + // vat포함
                    '<td>' + (values[5] || '') + '</td>' +                 // 세금계산서
                    '<td>' + fileCellHtml + '</td>' +                      // 첨부파일
                    '<td>' + (values[7] || '') + '</td>' +                 // 메모
                    actionHtml;
            } else if (type === 'payment') {
                migratePaymentRowValuesIfOld(values);
                normalizePaymentVatValues(values);
                row.innerHTML =
                    '<td>' + (values[0] || '') + '</td>' +                 // 수금일자
                    '<td>' + (values[1] || '') + '</td>' +                 // 상호명
                    '<td style="font-weight:600;">' + (values[2] || '') + '</td>' + // vat별도
                    '<td style="font-weight:600;">' + (values[3] || '') + '</td>' + // 부가세
                    '<td style="font-weight:600;">' + (values[4] || '') + '</td>' + // vat포함
                    '<td>' + (values[5] || '') + '</td>' +                 // 메모
                    actionHtml;
            } else if (type === 'purchase') {
                row.innerHTML = '<td>' + (values[0] || '') + '</td><td style="font-weight:600;">' + (values[1] || '') + '</td><td>' + (values[2] || '') + '</td><td>' + (values[3] || '') + '</td><td>' + fileCellHtml + '</td><td>' + (values[5] || '') + '</td>' + actionHtml;
            } else {
                row.innerHTML = '<td>' + (values[0] || '') + '</td><td>' + (values[1] || '') + '</td><td style="font-weight:600;">' + (values[2] || '') + '</td><td>' + (values[3] || '') + '</td>' + actionHtml;
            }
        }

        // 행 삭제
        function deleteRow(btn) {
            const row = btn.closest('tr');
            if (row && ((row.getAttribute('data-row-type') || '') === 'unpaid' || ((row.cells && row.cells[0] ? row.cells[0].textContent : '') || '').trim() === '미수금')) {
                alert('미수금 행은 삭제할 수 없습니다.');
                return;
            }
            if (confirm('이 항목을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) {
                row.remove();
                alert('삭제되었습니다.');
            }
        }

        // 행 삭제 (구 버전 - 호환성 유지)
        function removePaymentRow(btn) {
            deleteRow(btn);
        }

        // 다중 파일 선택 처리 (기존 파일 있으면 추가, 없으면 새로)
        function handleMultiFileSelect(input, rowId) {
            if (input.files && input.files.length > 0) {
                if (!window.uploadedFiles) window.uploadedFiles = {};
                const existing = window.uploadedFiles[rowId] || [];
                const newFiles = Array.from(input.files);
                const results = [...existing];
                let completed = 0;
                const total = newFiles.length;
                if (total === 0) return;
                newFiles.forEach((file, idx) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        results.push({ name: file.name, data: e.target.result, type: file.type, date: new Date().toISOString().slice(0, 10) });
                        completed++;
                        if (completed === total) {
                            window.uploadedFiles[rowId] = results;
                            const td = input.parentElement;
                            const count = results.length;
                            td.innerHTML = `
                                <input type="file" id="${rowId}" class="file-input-hidden" accept="image/*,application/pdf" multiple onchange="handleMultiFileSelect(this, '${rowId}')">
                                <button class="btn-file-view" onclick="showFileList('${rowId}')" title="첨부파일 보기">
                                    <i class="fas fa-eye"></i> (${count})
                                </button>
                                <button class="btn-file-upload" onclick="document.getElementById('${rowId}').click()" title="파일 추가" style="margin-left:4px;">
                                    <i class="fas fa-plus"></i>
                                </button>
                            `;
                        }
                    };
                    reader.readAsDataURL(file);
                });
            }
        }

        // 파일 목록 모달 표시
        function showFileList(rowId) {
            if (!window.uploadedFiles || !window.uploadedFiles[rowId] || window.uploadedFiles[rowId].length === 0) {
                alert('파일을 찾을 수 없습니다.');
                return;
            }
            
            const files = window.uploadedFiles[rowId];
            
            const modal = document.createElement('div');
            modal.className = 'file-list-modal active';
            modal.innerHTML = `
                <div class="file-list-modal-content">
                    <div class="file-list-modal-header">
                        <div class="file-list-modal-title">
                            <i class="fas fa-file-invoice"></i> 세금계산서 파일 목록 (${files.length}개)
                        </div>
                        <button onclick="this.closest('.file-list-modal').remove()" style="width: 32px; height: 32px; border: none; border-radius: 6px; background: var(--gray-100); color: var(--gray-600); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="file-list-modal-body">
                        ${files.map((file, index) => `
                            <div class="file-list-item">
                                <div class="file-list-item-icon">
                                    <i class="fas ${file.type === 'application/pdf' ? 'fa-file-pdf' : 'fa-image'}"></i>
                                </div>
                                <div class="file-list-item-info">
                                    <div class="file-list-item-name">${file.name}</div>
                                    <div class="file-list-item-meta">업로드: ${file.date}</div>
                                </div>
                                <div class="file-list-item-actions">
                                    <button class="btn-file-view" onclick="viewFileFromList('${rowId}', ${index})">
                                        <i class="fas fa-eye"></i> 보기
                                    </button>
                                    <button class="btn-file-download" onclick="downloadFileFromList('${rowId}', ${index})">
                                        <i class="fas fa-download"></i> 다운로드
                                    </button>
                                    <button class="btn-remove-payment" onclick="removeFileFromList('${rowId}', ${index})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="file-list-modal-footer">
                        <span style="font-size: 13px; color: var(--gray-600);">
                            <i class="fas fa-info-circle"></i> 분할 발행된 세금계산서를 각각 업로드하세요
                        </span>
                        <button class="btn-file-upload" onclick="addMoreFiles('${rowId}')">
                            <i class="fas fa-plus"></i> 파일 추가
                        </button>
                    </div>
                </div>
            `;
            
            modal.onclick = function(e) {
                if (e.target === modal) {
                    modal.remove();
                }
            };
            
            document.body.appendChild(modal);
        }

        // 목록에서 파일 보기
        function viewFileFromList(rowId, index) {
            if (window.uploadedFiles && window.uploadedFiles[rowId] && window.uploadedFiles[rowId][index]) {
                const file = window.uploadedFiles[rowId][index];
                viewFileModal(file.name, file.data, file.type);
            }
        }

        // 저장된 행의 첨부파일 보기 (클릭 시 미리보기 모달)
        function viewSavedRowFiles(rowFileId) {
            if (!window.savedRowFiles || !window.savedRowFiles[rowFileId] || window.savedRowFiles[rowFileId].length === 0) {
                alert('파일을 찾을 수 없습니다.');
                return;
            }
            const files = window.savedRowFiles[rowFileId];
            const modal = document.createElement('div');
            modal.className = 'file-list-modal active';
            modal.innerHTML = `
                <div class="file-list-modal-content">
                    <div class="file-list-modal-header">
                        <div class="file-list-modal-title">
                            <i class="fas fa-file-invoice"></i> 첨부파일 (${files.length}개)
                        </div>
                        <button onclick="this.closest('.file-list-modal').remove()" style="width: 32px; height: 32px; border: none; border-radius: 6px; background: var(--gray-100); color: var(--gray-600); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="file-list-modal-body">
                        ${files.map((file, index) => `
                            <div class="file-list-item">
                                <div class="file-list-item-icon">
                                    <i class="fas ${file.type === 'application/pdf' ? 'fa-file-pdf' : 'fa-image'}"></i>
                                </div>
                                <div class="file-list-item-info">
                                    <div class="file-list-item-name">${file.name}</div>
                                    <div class="file-list-item-meta">업로드: ${file.date || '-'}</div>
                                </div>
                                <div class="file-list-item-actions">
                                    <button class="btn-file-view" onclick="viewSavedFileByIndex('${rowFileId}', ${index})">
                                        <i class="fas fa-eye"></i> 보기
                                    </button>
                                    <button class="btn-file-download" onclick="downloadSavedFileByIndex('${rowFileId}', ${index})">
                                        <i class="fas fa-download"></i> 다운로드
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
            document.body.appendChild(modal);
        }

        function viewSavedFileByIndex(rowFileId, index) {
            if (window.savedRowFiles && window.savedRowFiles[rowFileId] && window.savedRowFiles[rowFileId][index]) {
                const file = window.savedRowFiles[rowFileId][index];
                viewFileModal(file.name, file.data, file.type);
            }
        }

        function downloadSavedFileByIndex(rowFileId, index) {
            if (!window.savedRowFiles || !window.savedRowFiles[rowFileId] || !window.savedRowFiles[rowFileId][index]) return;
            const file = window.savedRowFiles[rowFileId][index];
            const byteString = atob(file.data.split(',')[1]);
            const mimeString = file.data.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: mimeString });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // 목록에서 파일 다운로드
        function downloadFileFromList(rowId, index) {
            if (window.uploadedFiles && window.uploadedFiles[rowId] && window.uploadedFiles[rowId][index]) {
                const file = window.uploadedFiles[rowId][index];
                
                // Base64 데이터를 Blob으로 변환
                const byteString = atob(file.data.split(',')[1]);
                const mimeString = file.data.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                
                const blob = new Blob([ab], { type: mimeString });
                
                // 다운로드 링크 생성
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                // 알림 표시
                const btn = event.target.closest('button');
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> 완료';
                btn.style.background = 'var(--success)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--success)';
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.style.background = '';
                    btn.style.color = '';
                    btn.style.borderColor = '';
                }, 1500);
            }
        }

        // 목록에서 파일 삭제
        function removeFileFromList(rowId, index) {
            if (confirm('이 파일을 삭제하시겠습니까?')) {
                window.uploadedFiles[rowId].splice(index, 1);
                
                // 모달 닫고 다시 열기
                document.querySelector('.file-list-modal').remove();
                
                // 파일이 남아있으면 목록 다시 표시, 없으면 업로드 버튼으로 변경
                if (window.uploadedFiles[rowId].length > 0) {
                    showFileList(rowId);
                    
                    // 테이블의 버튼도 업데이트
                    const fileInput = document.getElementById(rowId);
                    if (fileInput) {
                        const td = fileInput.parentElement;
                        const fileCount = window.uploadedFiles[rowId].length;
                        td.innerHTML = `
                            <input type="file" id="${rowId}" class="file-input-hidden" accept="image/*,application/pdf" multiple onchange="handleMultiFileSelect(this, '${rowId}')">
                            <button class="btn-file-view" onclick="showFileList('${rowId}')" title="첨부파일 보기">
                                <i class="fas fa-eye"></i> (${fileCount})
                            </button>
                            <button class="btn-file-upload" onclick="document.getElementById('${rowId}').click()" title="파일 추가" style="margin-left:4px;"><i class="fas fa-plus"></i></button>
                        `;
                    }
                } else {
                    const fileInput = document.getElementById(rowId);
                    if (fileInput) {
                        const td = fileInput.parentElement;
                        td.innerHTML = `
                            <input type="file" id="${rowId}" class="file-input-hidden" accept="image/*,application/pdf" multiple onchange="handleMultiFileSelect(this, '${rowId}')">
                            <button class="btn-file-upload" onclick="document.getElementById('${rowId}').click()">
                                <i class="fas fa-upload"></i> 업로드
                            </button>
                        `;
                    }
                }
            }
        }

        // 파일 추가
        function addMoreFiles(rowId) {
            document.getElementById(rowId).click();
            document.querySelector('.file-list-modal').remove();
        }

        // 파일 선택 처리 (단일 - 이전 버전 호환용). 데이터 저장 후 DOM 갱신(보기 클릭 시 파일 없음 방지)
        function handleFileSelect(input, rowId) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                const td = input.parentElement;
                const reader = new FileReader();
                reader.onload = function(e) {
                    if (!window.uploadedFiles) window.uploadedFiles = {};
                    window.uploadedFiles[rowId] = {
                        name: file.name,
                        data: e.target.result,
                        type: file.type
                    };
                    td.innerHTML =
                        '<input type="file" id="' + rowId + '" class="file-input-hidden" accept="image/*,application/pdf" onchange="handleFileSelect(this, \'' + rowId + '\')">' +
                        '<button class="btn-file-view" onclick="viewUploadedFile(\'' + rowId + '\')">' +
                        '<i class="fas fa-eye"></i> 보기</button>';
                };
                reader.readAsDataURL(file);
            }
        }

        // 업로드된 파일 보기
        function viewUploadedFile(rowId) {
            if (window.uploadedFiles && window.uploadedFiles[rowId]) {
                const file = window.uploadedFiles[rowId];
                viewFileModal(file.name, file.data, file.type);
            } else {
                alert('파일을 찾을 수 없습니다.');
            }
        }

        function viewTaxFile(type, name) {
            const fileName = `${type === 'sales' ? '매출' : '매입'}_세금계산서_${name}.pdf`;
            alert('저장된 세금계산서 파일이 없습니다.\n(' + fileName + ')');
        }

        // 파일 미리보기 모달
        function viewFileModal(fileName, fileData, fileType) {
            const modal = document.createElement('div');
            modal.className = 'image-modal active';
            const ft = fileType || '';
            const fd = typeof fileData === 'string' ? fileData : '';
            const isPdf = ft === 'application/pdf' || fd.indexOf('data:application/pdf') === 0;
            const isImage = (ft.indexOf('image/') === 0) || fd.indexOf('data:image') === 0 || fd.indexOf('placeholder') !== -1;

            let content = '';
            if (isImage && !isPdf) {
                content = '<img src="' + fd.replace(/"/g, '&quot;') + '" alt="' + String(fileName || '').replace(/"/g, '&quot;') + '" style="max-width: 100%; max-height: 70vh; border-radius: 8px;">';
            } else if (isPdf) {
                content = '<iframe src="' + fd.replace(/"/g, '&quot;') + '" style="width: 800px; height: 70vh; border: none; border-radius: 8px;"></iframe>';
            } else {
                content = `<div style="padding: 40px; text-align: center;">
                    <i class="fas fa-file" style="font-size: 48px; color: var(--gray-400);"></i>
                    <p style="margin-top: 20px; color: var(--gray-600);">미리보기를 지원하지 않는 파일 형식입니다.</p>
                </div>`;
            }
            
            modal.innerHTML = `
                <div class="image-modal-content" style="max-width: 90vw; max-height: 90vh;">
                    <div class="image-modal-header" style="padding: 16px 20px; background: white; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 16px; font-weight: 600; color: var(--gray-900);">
                            <i class="fas fa-file-invoice"></i> ${fileName}
                        </div>
                        <button onclick="this.closest('.image-modal').remove()" style="width: 32px; height: 32px; border: none; border-radius: 6px; background: var(--gray-100); color: var(--gray-600); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div style="padding: 20px; background: var(--gray-50); display: flex; align-items: center; justify-content: center; overflow: auto;">
                        ${content}
                    </div>
                </div>
            `;
            
            modal.onclick = function(e) {
                if (e.target === modal) {
                    modal.remove();
                }
            };
            
            document.body.appendChild(modal);
        }

        // 편집 모드 토글
        function toggleEditMode() {
            isEditMode = true;
            renderPanelContent(currentEditItem);
        }

        // 기본정보 탭만 수정 시작
        function startBasicInfoEdit() {
            basicInfoEditMode = true;
            renderPanelContent(currentEditItem);
        }

        // 기본정보 탭 수정 취소
        function cancelBasicInfoEdit() {
            basicInfoEditMode = false;
            renderPanelContent(currentEditItem);
        }

        // 기본정보 탭만 저장
        async function saveBasicInfoEdit() {
            if (!currentEditItem) return;

            const editDateEl = document.getElementById('edit_date');
            if (editDateEl) currentEditItem.date = editDateEl.value;

            const editStatusEl = document.getElementById('edit_status');
            if (editStatusEl) currentEditItem.status = editStatusEl.value;
            const editStartDateEl = document.getElementById('edit_startDate');
            if (editStartDateEl) currentEditItem.startDate = editStartDateEl.value;
            const editEndDateEl = document.getElementById('edit_endDate');
            if (editEndDateEl) currentEditItem.endDate = editEndDateEl.value;

            const editCategory1El = document.getElementById('edit_category1');
            if (editCategory1El) currentEditItem.category1 = editCategory1El.value;

            const editCategory2El = document.getElementById('edit_category2');
            if (editCategory2El) currentEditItem.category2 = editCategory2El.value;

            const editCategory3El = document.getElementById('edit_category3');
            if (editCategory3El) currentEditItem.category3 = editCategory3El.value.trim();

            const editBuildingEl = document.getElementById('edit_building');
            if (editBuildingEl) currentEditItem.building = editBuildingEl.value;

            const editProjectEl = document.getElementById('edit_project');
            if (editProjectEl) currentEditItem.project = editProjectEl.value;

            const editManagerEl = document.getElementById('edit_manager');
            if (editManagerEl) currentEditItem.manager = editManagerEl.value;

            const editTypeEl = document.getElementById('edit_type');
            if (editTypeEl) currentEditItem.type = editTypeEl.value;

            const contractorCheck = validateContractorSelectionById('edit_contractor');
            if (!contractorCheck.ok) return;
            currentEditItem.contractor = contractorCheck.value;

            readBusinessIncomeFormIntoItem(currentEditItem);

            const index = estimates.findIndex(e => e.code === currentEditItem.code);
            if (index !== -1) {
                estimates[index] = { ...estimates[index], ...currentEditItem };
                const remote = await upsertEstimateToServer(estimates[index]);
                if (!remote.ok) {
                    alert(remote.error || '견적 서버 저장 실패');
                    return;
                }
            }

            basicInfoEditMode = false;
            renderPanelContent(currentEditItem);
            renderTable();
            showToast('기본정보가 저장되었습니다.');
        }

        // 사업소득 탭만 수정 시작
        function startBusinessIncomeEdit() {
            businessInfoEditMode = true;
            activePanelTabId = 'business';
            renderPanelContent(currentEditItem);
        }

        // 사업소득 탭 수정 취소
        function cancelBusinessIncomeEdit() {
            businessInfoEditMode = false;
            // 저장 전이면 currentEditItem은 유지되지만,
            // disabled 상태로 다시 렌더링해 원래 값 기반 UI로 복구합니다.
            renderPanelContent(currentEditItem);
        }

        // 사업소득 탭만 저장
        async function saveBusinessIncomeEdit() {
            if (!currentEditItem) return;

            // 입력 값 읽어서 derived 값(세금/실수령/지급여부 등)까지 currentEditItem에 반영
            readBusinessIncomeFormIntoItem(currentEditItem);

            const index = estimates.findIndex(e => e.code === currentEditItem.code);
            if (index !== -1) {
                estimates[index] = { ...estimates[index], ...currentEditItem };
                const remote = await upsertEstimateToServer(estimates[index]);
                if (!remote.ok) {
                    alert(remote.error || '견적 서버 저장 실패');
                    return;
                }
            }

            businessInfoEditMode = false;
            renderPanelContent(currentEditItem);
            renderTable();
            showToast('사업소득이 저장되었습니다.');
        }

        // 수정 취소
        function cancelEdit() {
            if (isNewEstimate) {
                closePanel();
                return;
            }
            isEditMode = false;
            const originalItem = estimates.find(e => e.code === currentEditItem.code);
            if (originalItem) {
                currentEditItem = {...originalItem};
                renderPanelContent(currentEditItem);
            }
        }

        // 저장
        async function saveChanges() {
            if (isSavingChanges) return;
            setSaveLoading(true);
            if (isNewEstimate) {
                const editDateEl = document.getElementById('edit_date');
                if (editDateEl) currentEditItem.date = editDateEl.value;
                const editStatusEl = document.getElementById('edit_status');
                if (editStatusEl) currentEditItem.status = editStatusEl.value;
                const editStartDateEl = document.getElementById('edit_startDate');
                if (editStartDateEl) currentEditItem.startDate = editStartDateEl.value;
                const editEndDateEl = document.getElementById('edit_endDate');
                if (editEndDateEl) currentEditItem.endDate = editEndDateEl.value;
                const editCategory1El = document.getElementById('edit_category1');
                if (editCategory1El) currentEditItem.category1 = editCategory1El.value;
                const editCategory2El = document.getElementById('edit_category2');
                if (editCategory2El) currentEditItem.category2 = editCategory2El.value;
                const editCategory3El = document.getElementById('edit_category3');
                if (editCategory3El) currentEditItem.category3 = editCategory3El.value.trim();
                const editBuildingEl = document.getElementById('edit_building');
                if (editBuildingEl) currentEditItem.building = editBuildingEl.value;
                const editProjectEl = document.getElementById('edit_project');
                if (editProjectEl) currentEditItem.project = editProjectEl.value;
                const editManagerEl = document.getElementById('edit_manager');
                if (editManagerEl) currentEditItem.manager = editManagerEl.value;
                const editTypeEl = document.getElementById('edit_type');
                if (editTypeEl) currentEditItem.type = editTypeEl.value;
                const contractorCheck = validateContractorSelectionById('edit_contractor');
                if (!contractorCheck.ok) {
                    setSaveLoading(false);
                    return;
                }
                currentEditItem.contractor = contractorCheck.value;

                // 신규 견적 저장 (3단계에서 채운 currentEditItem 기준)
                if (!currentEditItem || !currentEditItem.building || !currentEditItem.project) {
                    alert('건물명과 공사명은 필수 입력 항목입니다.');
                    setSaveLoading(false);
                    return;
                }

                readBusinessIncomeFormIntoItem(currentEditItem);

                const newEstimate = {
                    code: currentEditItem.code,
                    date: currentEditItem.date,
                    status: currentEditItem.status,
                    startDate: currentEditItem.startDate || '',
                    endDate: currentEditItem.endDate || '',
                    category1: currentEditItem.category1,
                    category2: currentEditItem.category2,
                    category3: currentEditItem.category3 || '',
                    building: currentEditItem.building,
                    project: currentEditItem.project,
                    manager: currentEditItem.manager,
                    type: currentEditItem.type,
                    contractor: currentEditItem.contractor,
                    revenue: currentEditItem.revenue || 0,
                    paidStatus: currentEditItem.paidStatus,
                    purchase: (currentEditItem.type === '세금계산서' || currentEditItem.type === '사업소득') ? (currentEditItem.purchase || 0) : 0,
                    taxIssued: !!currentEditItem.taxIssued,
                    hasSales: false,
                    hasPurchase: false,
                    businessIncomeTransferDate: currentEditItem.businessIncomeTransferDate || '',
                    businessIncomeGross: currentEditItem.businessIncomeGross || 0,
                    businessIncomeNetPay: currentEditItem.businessIncomeNetPay || 0,
                    businessIncomePaidStatus: currentEditItem.businessIncomePaidStatus || '미지급',
                    aggregateSalesGross: currentEditItem.aggregateSalesGross,
                    aggregatePaymentGross: currentEditItem.aggregatePaymentGross,
                    aggregatePurchaseGross: currentEditItem.aggregatePurchaseGross,
                    aggregateTransferGross: currentEditItem.aggregateTransferGross
                };
                seedEstimateAggregates(newEstimate);

                const remoteNew = await upsertEstimateToServer(newEstimate);
                if (!remoteNew.ok) {
                    alert(remoteNew.error || '견적 서버 저장 실패');
                    setSaveLoading(false);
                    return;
                }
                estimates.unshift(newEstimate);
                isPanelDirty = false;
                showToast('견적서가 등록되었습니다.');
                closePanel(true);
                renderTable();
                setSaveLoading(false);

            } else {
                // 기존 견적 수정
                const editDateEl = document.getElementById('edit_date');
                if (editDateEl) currentEditItem.date = editDateEl.value;
                currentEditItem.status = document.getElementById('edit_status').value;
                const editStartDateEl = document.getElementById('edit_startDate');
                if (editStartDateEl) currentEditItem.startDate = editStartDateEl.value;
                const editEndDateEl = document.getElementById('edit_endDate');
                if (editEndDateEl) currentEditItem.endDate = editEndDateEl.value;
                currentEditItem.category1 = document.getElementById('edit_category1').value;
                currentEditItem.category2 = document.getElementById('edit_category2').value;
                const ec3 = document.getElementById('edit_category3');
                currentEditItem.category3 = ec3 ? ec3.value.trim() : '';
                currentEditItem.building = document.getElementById('edit_building').value;
                currentEditItem.project = document.getElementById('edit_project').value;
                currentEditItem.manager = document.getElementById('edit_manager').value;
                currentEditItem.type = document.getElementById('edit_type').value;
                const contractorCheck = validateContractorSelectionById('edit_contractor');
                if (!contractorCheck.ok) {
                    setSaveLoading(false);
                    return;
                }
                currentEditItem.contractor = contractorCheck.value;
                currentEditItem.revenue = parseInt(document.getElementById('edit_revenue').value) || 0;
                currentEditItem.paidStatus = document.getElementById('edit_paidStatus').value;
                currentEditItem.taxIssued = document.getElementById('edit_taxIssued').value === 'true';
                
                if (currentEditItem.type === '세금계산서') {
                    currentEditItem.purchase = parseInt(document.getElementById('edit_purchase').value) || 0;
                }
                readBusinessIncomeFormIntoItem(currentEditItem);

                // 원본 데이터 업데이트
                const index = estimates.findIndex(e => e.code === currentEditItem.code);
                if (index !== -1) {
                    const updated = { ...currentEditItem };
                    const remoteEdit = await upsertEstimateToServer(updated);
                    if (!remoteEdit.ok) {
                        alert(remoteEdit.error || '견적 서버 저장 실패');
                        setSaveLoading(false);
                        return;
                    }
                    estimates[index] = updated;
                }

                // 읽기 모드로 전환
                isEditMode = false;
                renderPanelContent(currentEditItem);

                // 테이블 다시 렌더링
                renderTable();

                isPanelDirty = false;
                showToast('저장되었습니다.');
                setSaveLoading(false);
            }
        }

        // 슬라이드 패널 / 프로젝트 상세 모달 닫기
        function closePanel(forceClose = false) {
            if (!forceClose && (isEditMode || isNewEstimate) && isPanelDirty) {
                const okToClose = confirm('변경사항이 있습니다.\n저장하지 않고 닫으시겠습니까?\n\n확인: 저장하지 않고 닫기\n취소: 계속 편집');
                if (!okToClose) return;
            }
            setUserManageHeaderActions(false);
            document.getElementById('panelOverlay').classList.remove('active');
            document.getElementById('slidePanel').classList.remove('active');
            document.getElementById('slidePanel').classList.remove('project-detail-modal');
            const bottomSaveBarEl = document.getElementById('panelBottomSaveBar');
            if (bottomSaveBarEl) bottomSaveBarEl.style.display = 'none';
            setSaveLoading(false);
            isPanelDirty = false;
            panelBaselineSnapshot = '';

            isEditMode = false;
            isNewEstimate = false;
            basicInfoEditMode = false;
            currentEditItem = null;
            itemRows = [];
            currentStep = 1;
            isCreatingAccount = false;
        }

        // 견적서 편집기 열기 (단계별 UI)
        function openEstimateEditor(code) {
            const estimate = estimates.find(e => e.code === code);
            if (!estimate) return;
            
            currentEditItem = {...estimate};
            isEditMode = true;
            isNewEstimate = false;
            currentStep = 1;

            itemRows = [{
                name: '',
                quantity: 1,
                unit: '',
                price: 0,
                amount: 0
            }];

            renderEstimateEditor();
            
            document.getElementById('panelOverlay').classList.add('active');
            document.getElementById('slidePanel').classList.add('active');
        }

        // 견적서 편집기 렌더링
        function renderEstimateEditor() {
            document.getElementById('panelTitle').textContent = '프로젝트 보기/수정';
            
            const panelBody = document.getElementById('panelBody');
            panelBody.className = 'panel-body edit-mode';
            
            panelBody.innerHTML = `
                <!-- 단계 네비게이션 -->
                <div class="step-navigation">
                    <div class="step-item ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}">
                        <div class="step-number">${currentStep > 1 ? '✓' : '1'}</div>
                        <div class="step-info">
                            <div class="step-title">기본 정보</div>
                            <div class="step-desc">날짜, 건물명, 공사명</div>
                        </div>
                    </div>
                    <div class="step-item ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}">
                        <div class="step-number">${currentStep > 2 ? '✓' : '2'}</div>
                        <div class="step-info">
                            <div class="step-title">견적서 작성</div>
                            <div class="step-desc">품목, 수량, 단가</div>
                        </div>
                    </div>
                    <div class="step-item ${currentStep === 3 ? 'active' : ''}">
                        <div class="step-number">3</div>
                        <div class="step-info">
                            <div class="step-title">미리보기</div>
                            <div class="step-desc">확인 및 저장</div>
                        </div>
                    </div>
                </div>
                
                ${renderStepContent()}
            `;
            
            // 버튼 숨김
            document.getElementById('btnEdit').style.display = 'none';
            document.getElementById('btnSave').style.display = 'none';
            document.getElementById('btnCancel').style.display = 'none';
            const bottomSaveBarEl = document.getElementById('panelBottomSaveBar');
            if (bottomSaveBarEl) bottomSaveBarEl.style.display = 'none';
        }

        // 단계별 컨텐츠 렌더링
        function renderStepContent() {
            if (currentStep === 1) {
                return renderStep1_BasicInfo();
            } else if (currentStep === 2) {
                return renderStep2_Items();
            } else if (currentStep === 3) {
                return renderStep3_Preview();
            }
        }

        // 1단계: 기본 정보
        function renderStep1_BasicInfo() {
            return `
                <div class="step-content active">
                    <div class="panel-section">
                        <div class="detail-grid">
                            <div class="detail-row form-row">
                                <label class="form-label">등록일</label>
                                <input type="date" class="form-input" id="step_date" value="${currentEditItem.date}">
                            </div>
                            <div class="detail-row form-row">
                                <label class="form-label">건물명 *</label>
                                <input type="text" class="form-input" id="step_building" value="${currentEditItem.building}" placeholder="예: 서울파이낸스센터">
                            </div>
                            <div class="detail-row form-row">
                                <label class="form-label">공사명 *</label>
                                <input type="text" class="form-input" id="step_project" value="${currentEditItem.project}" placeholder="예: 8층 팬트리 수전 수리">
                            </div>
                            <div class="detail-row form-row">
                                <label class="form-label">담당자</label>
                                <select class="form-select" id="step_manager">
                                    <option value="방준호" ${currentEditItem.manager === '방준호' ? 'selected' : ''}>방준호</option>
                                </select>
                            </div>
                            <div class="detail-row form-row">
                                <label class="form-label">구분</label>
                                <select class="form-select" id="step_type">
                                    <option value="세금계산서" ${currentEditItem.type === '세금계산서' ? 'selected' : ''}>세금계산서</option>
                                    <option value="사업소득" ${currentEditItem.type === '사업소득' ? 'selected' : ''}>사업소득</option>
                                    <option value="자체인력" ${currentEditItem.type === '자체인력' ? 'selected' : ''}>자체인력</option>
                                </select>
                            </div>
                            <div class="detail-row form-row">
                                <label class="form-label">도급사</label>
                                <input type="text" class="form-input" id="step_contractor" value="${currentEditItem.contractor || ''}" placeholder="예: 영진인프라">
                            </div>
                        </div>
                    </div>
                    
                    <div class="step-buttons">
                        <button class="btn-step btn-step-prev" onclick="closePanel()" style="visibility: hidden;">
                            <i class="fas fa-arrow-left"></i> 이전
                        </button>
                        <button class="btn-step btn-step-next" onclick="goToStep(2)">
                            다음: 견적서 작성 <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        // 2단계: 견적서 작성
        function renderStep2_Items() {
            const supply = itemRows.reduce((sum, row) => sum + row.amount, 0);
            const vat = Math.round(supply * 0.1);
            const total = supply + vat;
            
            return `
                <div class="step-content active">
                    <div class="panel-section">
                        <div class="panel-section-title">품목 내역</div>
                        <table class="items-input-table">
                            <thead>
                                <tr>
                                    <th style="width: 30%;">품목명</th>
                                    <th style="width: 10%;">수량</th>
                                    <th style="width: 10%;">단위</th>
                                    <th style="width: 20%;">단가</th>
                                    <th style="width: 20%;">금액</th>
                                    <th style="width: 10%;"></th>
                                </tr>
                            </thead>
                            <tbody id="itemsTableBody">
                                ${itemRows.map((row, index) => `
                                    <tr>
                                        <td><input type="text" value="${row.name}" onchange="updateItemRowStep(${index}, 'name', this.value)" placeholder="품목명 입력"></td>
                                        <td><input type="number" value="${row.quantity}" onchange="updateItemRowStep(${index}, 'quantity', this.value)" min="1"></td>
                                        <td><input type="text" value="${row.unit}" onchange="updateItemRowStep(${index}, 'unit', this.value)" placeholder="단위"></td>
                                        <td><input type="number" value="${row.price}" onchange="updateItemRowStep(${index}, 'price', this.value)" min="0" ></td>
                                        <td style="text-align: right; font-weight: 600; padding: 8px;">${row.amount.toLocaleString()}원</td>
                                        <td style="text-align: center;">
                                            <button class="btn-remove-item" onclick="removeItemRowStep(${index})">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="4" style="text-align: right; font-weight: 700; background: var(--gray-50);">공급가액</td>
                                    <td style="font-weight: 700; background: var(--gray-50); text-align: right;">${supply.toLocaleString()}원</td>
                                    <td style="background: var(--gray-50);"></td>
                                </tr>
                                <tr>
                                    <td colspan="4" style="text-align: right; font-weight: 700; background: var(--gray-50);">부가세 (10%)</td>
                                    <td style="font-weight: 700; background: var(--gray-50); text-align: right;">${vat.toLocaleString()}원</td>
                                    <td style="background: var(--gray-50);"></td>
                                </tr>
                                <tr>
                                    <td colspan="4" style="text-align: right; font-weight: 700; background: var(--primary); color: white;">총 금액</td>
                                    <td style="font-weight: 700; background: var(--primary); color: white; text-align: right;">${total.toLocaleString()}원</td>
                                    <td style="background: var(--primary);"></td>
                                </tr>
                            </tfoot>
                        </table>
                        <button class="btn-add-item" onclick="addItemRowInStep()">
                            <i class="fas fa-plus"></i> 품목 추가
                        </button>
                    </div>
                    
                    <div class="step-buttons">
                        <button class="btn-step btn-step-prev" onclick="goToStep(1)">
                            <i class="fas fa-arrow-left"></i> 이전
                        </button>
                        <button class="btn-step btn-step-next" onclick="goToStep(3)">
                            다음: 미리보기 <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        // 3단계: 미리보기
        function renderStep3_Preview() {
            const supply = itemRows.reduce((sum, row) => sum + row.amount, 0);
            const vat = Math.round(supply * 0.1);
            const total = supply + vat;
            
            const building = document.getElementById('step_building')?.value || currentEditItem.building;
            const project = document.getElementById('step_project')?.value || currentEditItem.project;
            const date = document.getElementById('step_date')?.value || currentEditItem.date;
            
            return `
                <div class="step-content active">
                    <div class="estimate-preview">
                        <div class="estimate-header">
                            <h1 class="estimate-title">견 적 서</h1>
                            <p class="estimate-subtitle">Estimate</p>
                        </div>
                        
                        <div class="estimate-info">
                            <div class="estimate-info-item">
                                <span class="estimate-info-label">작성일:</span>
                                <span class="estimate-info-value">${date}</span>
                            </div>
                            <div class="estimate-info-item">
                                <span class="estimate-info-label">공사장소:</span>
                                <span class="estimate-info-value">${building}</span>
                            </div>
                            <div class="estimate-info-item">
                                <span class="estimate-info-label">공사명:</span>
                                <span class="estimate-info-value">${project}</span>
                            </div>
                            <div class="estimate-info-item">
                                <span class="estimate-info-label">담당자:</span>
                                <span class="estimate-info-value">${currentEditItem.manager}</span>
                            </div>
                        </div>
                        
                        <table class="estimate-table">
                            <thead>
                                <tr>
                                    <th style="width: 40%;">품목</th>
                                    <th style="width: 10%;">수량</th>
                                    <th style="width: 10%;">단위</th>
                                    <th style="width: 20%;">단가</th>
                                    <th style="width: 20%;">금액</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemRows.map(row => `
                                    <tr>
                                        <td>${row.name}</td>
                                        <td style="text-align: center;">${row.quantity}</td>
                                        <td style="text-align: center;">${row.unit}</td>
                                        <td >${row.price.toLocaleString()}원</td>
                                        <td >${row.amount.toLocaleString()}원</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div class="estimate-total">
                            <div class="estimate-total-item">
                                <span class="estimate-total-label">공급가액</span>
                                <span>${supply.toLocaleString()}원</span>
                            </div>
                            <div class="estimate-total-item">
                                <span class="estimate-total-label">부가세 (10%)</span>
                                <span>${vat.toLocaleString()}원</span>
                            </div>
                            <div class="estimate-total-item main">
                                <span class="estimate-total-label">총 금액</span>
                                <span>${total.toLocaleString()}원</span>
                            </div>
                        </div>
                        
                        <div class="estimate-footer">
                            <p><strong>반듯한시공</strong></p>
                            <p>상기 금액으로 견적합니다.</p>
                        </div>
                    </div>
                    
                    <div class="step-buttons">
                        <button class="btn-step btn-step-prev" onclick="goToStep(2)">
                            <i class="fas fa-arrow-left"></i> 이전
                        </button>
                        <div style="display: flex; gap: 12px;">
                            <button class="btn-step btn-step-next" onclick="window.print()">
                                <i class="fas fa-print"></i> 인쇄/PDF
                            </button>
                            <button class="btn-step btn-step-complete" onclick="saveEstimateFromEditor()">
                                <i class="fas fa-save"></i> 저장
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        // 단계 이동
        function goToStep(step) {
            // 1단계에서 2단계로 갈 때 유효성 검사
            if (currentStep === 1 && step === 2) {
                const building = document.getElementById('step_building').value.trim();
                const project = document.getElementById('step_project').value.trim();
                
                if (!building || !project) {
                    alert('건물명과 공사명은 필수 입력 항목입니다.');
                    return;
                }
                
                // 데이터 저장
                currentEditItem.date = document.getElementById('step_date').value;
                currentEditItem.building = building;
                currentEditItem.project = project;
                currentEditItem.manager = document.getElementById('step_manager').value;
                currentEditItem.type = document.getElementById('step_type').value;
                currentEditItem.contractor = document.getElementById('step_contractor').value;
            }
            
            currentStep = step;
            renderEstimateEditor();
        }

        // 품목 행 업데이트
        function updateItemRowStep(index, field, value) {
            itemRows[index][field] = field === 'name' || field === 'unit' ? value : parseFloat(value) || 0;
            
            // 금액 자동 계산
            if (field === 'quantity' || field === 'price') {
                itemRows[index].amount = itemRows[index].quantity * itemRows[index].price;
            }
            
            renderEstimateEditor();
        }

        // 품목 추가
        function addItemRowInStep() {
            itemRows.push({
                name: '',
                quantity: 1,
                unit: '',
                price: 0,
                amount: 0
            });
            renderEstimateEditor();
        }

        // 품목 삭제
        function removeItemRowStep(index) {
            if (itemRows.length === 1) {
                alert('최소 1개의 품목이 필요합니다.');
                return;
            }
            itemRows.splice(index, 1);
            renderEstimateEditor();
        }

        // 견적서 저장
        function saveEstimateFromEditor() {
            if (!confirm('견적서를 저장하시겠습니까?')) {
                return;
            }
            
            const supply = itemRows.reduce((sum, row) => sum + row.amount, 0);
            const total = supply + Math.round(supply * 0.1);
            
            currentEditItem.revenue = total;
            
            // 기존 견적 업데이트 또는 새 견적 추가
            const existingIndex = estimates.findIndex(e => e.code === currentEditItem.code);
            if (existingIndex >= 0) {
                estimates[existingIndex] = {...currentEditItem};
            } else {
                estimates.unshift(currentEditItem);
            }
            
            renderTable();
            closePanel();
            
            alert('견적서가 저장되었습니다.');
        }

        // 뱃지 클래스 가져오기
        function getBadgeClass(status) {
            const classes = {
                '견적': 'badge-estimate',
                '진행': 'badge-progress',
                '완료': 'badge-complete',
                '보류': 'badge-hold'
            };
            return classes[status] || '';
        }

        // 상태 팝오버
        function getStatusPopoverRoot() {
            let root = document.getElementById('statusPopoverRoot');
            if (!root) {
                root = document.createElement('div');
                root.id = 'statusPopoverRoot';
                root.className = 'status-popover-root';
                document.body.appendChild(root);
            }
            return root;
        }

        function openStatusPopover(event, code) {
            const ev = event != null ? event : window.event;
            if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
            const trigger = ev && ev.currentTarget;
            if (!trigger) return;
            const c = String(code == null ? '' : code).trim();
            const item = estimates.find(function (e) {
                return String(e && e.code != null ? e.code : '').trim() === c;
            });
            if (!item) return;
            const root = getStatusPopoverRoot();
            const currentCode = root.getAttribute('data-code');
            if (root.classList.contains('active') && currentCode === c) {
                closeStatusPopover();
                return;
            }

            const esc = function (s) {
                return JSON.stringify(String(s == null ? '' : s));
            };
            root.setAttribute('data-code', c);
            root.innerHTML = `
                <button type="button" class="status-popover-item estimate ${item.status === '견적' ? 'selected' : ''}" onclick="changeStatus(${esc(c)}, ${esc('견적')})"><span class="status-color"></span>견적</button>
                <button type="button" class="status-popover-item progress ${item.status === '진행' ? 'selected' : ''}" onclick="changeStatus(${esc(c)}, ${esc('진행')})"><span class="status-color"></span>진행</button>
                <button type="button" class="status-popover-item complete ${item.status === '완료' ? 'selected' : ''}" onclick="changeStatus(${esc(c)}, ${esc('완료')})"><span class="status-color"></span>완료</button>
                <button type="button" class="status-popover-item hold ${item.status === '보류' ? 'selected' : ''}" onclick="changeStatus(${esc(c)}, ${esc('보류')})"><span class="status-color"></span>보류</button>
            `;
            root.classList.add('active');

            const triggerRect = trigger.getBoundingClientRect();
            const popoverRect = root.getBoundingClientRect();
            const vw = window.innerWidth || document.documentElement.clientWidth || 0;
            const vh = window.innerHeight || document.documentElement.clientHeight || 0;
            const popW = popoverRect.width || 136;
            const popH = popoverRect.height || 180;

            let left = triggerRect.left;
            left = Math.max(8, Math.min(left, vw - popW - 8));

            let top = triggerRect.bottom + 6;
            if (top + popH > vh - 8) {
                top = Math.max(8, triggerRect.top - popH - 6);
            }

            root.style.left = `${left}px`;
            root.style.top = `${top}px`;
        }

        function closeStatusPopover() {
            const root = document.getElementById('statusPopoverRoot');
            if (!root) return;
            root.classList.remove('active');
            root.removeAttribute('data-code');
            root.innerHTML = '';
        }

        // 상태 변경
        function changeStatus(code, newStatus) {
            const c = String(code == null ? '' : code).trim();
            const item = estimates.find(function (e) {
                return String(e && e.code != null ? e.code : '').trim() === c;
            });
            if (item) {
                item.status = newStatus;
                renderTable();
                closeStatusPopover();
            }
        }

        // 테이블 행 클릭으로 패널 열기
        function openPanelFromRow(event, code) {
            const ev = event != null ? event : window.event;
            const t = ev && ev.target;
            if (t && typeof t.closest === 'function') {
                if (t.closest('.status-popover-trigger') || t.closest('.status-popover-root')) {
                    return;
                }
            }
            openPanel(code);
        }

        // 외부 클릭 시 팝오버 닫기
        document.addEventListener('click', (event) => {
            if (event.target.closest('.status-popover-trigger') || event.target.closest('.status-popover-root')) return;
            closeStatusPopover();
        });

        // 사이드바 토글
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('collapsed');
            
            // 로컬 스토리지에 상태 저장
            const isCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', isCollapsed);
        }

        // 페이지 로드 시 사이드바 상태 복원
        document.addEventListener('DOMContentLoaded', () => {
            const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            if (isCollapsed) {
                document.getElementById('sidebar').classList.add('collapsed');
            }
        });

        // ============================================================
        // Vite(ESM) 번들링 대응: index.html의 인라인 onclick에서 호출되는
        // 함수들은 window 전역에 노출되어야 합니다.
        // ============================================================
        try {
            const expose = {
                // 네비/레이아웃
                toggleSidebar,
                showPage,
                toggleDashboardTheme,

                // 대시보드
                dashboardChangeMonth,
                closeDashboardEventModal,
                closeDashboardDayEventsModal,

                // 견적/프로젝트
                downloadEstimateCSV,
                openNewEstimate,
                closePanel,
                openPanel,
                openPanelFromRow,
                saveChanges,
                cancelEdit,
                openEstimateEditor,
                saveNewEstimateFromSteps,
                switchNewEstimateTab,
                switchPanelTab,
                removeItemRow,
                removeItemRowStep,
                addSalesRow,
                addPaymentRow,
                addPurchaseRow,
                addTransferRow,
                onFinanceRowClick,
                togglePaymentRowInline,
                deleteRow,
                goEstimatePage,
                openStatusPopover,
                showFileList,
                handleMultiFileSelect,
                viewSavedRowFiles,
                viewCurrentAttachmentFile,
                downloadCurrentAttachmentFile,
                applySameFromSourceToFinanceModal,
                closeFinanceRowModal,
                saveFinanceRowModal,
                confirmDeleteFinanceRow,
                closeSalesSamePickerModal,
                applySelectedSalesSame,
                startBasicInfoEdit,
                cancelBasicInfoEdit,
                saveBasicInfoEdit,
                startBusinessIncomeEdit,
                cancelBusinessIncomeEdit,
                saveBusinessIncomeEdit,
                deleteCurrentEstimate,
                editRow,
                saveEditedRow,
                cancelEditRow,
                closePaymentRowInlines,

                // 경영실적
                switchPerformancePeriodMode,
                switchPerformanceRightTab,
                switchPerformanceSgaMode,

                // 주간/미수금
                downloadWeeklyCSV,
                downloadUnpaidCSV,

                // 업체
                downloadContractorCSV,
                openContractorPanel,
                closeContractorPanel,
                saveContractor,
                closeContractorDetailPanel,
                openContractorDetailPanel,
                viewContractorImage,
                updateContractorFileName,

                // 경비
                downloadExpenseCSV,
                openExpensePanel,
                closeExpensePanel,
                saveExpense,
                closeExpenseDetailPanel,
                openExpenseDetailPanel,
                viewExpenseImage,
                onExpenseMonthChange,
                editExpense,
                deleteExpense,
                updateExpenseFileName,

                // 판관비
                downloadSgaCSV,
                openSgaPanel,
                closeSgaPanel,
                saveSgaExpense,
                closeSgaDetailPanel,
                openSgaDetailPanel,
                onSgaMonthChange,

                // 관리자설정
                switchAdminSettingsTab,
                openAddUserModal,
                openUserManagePanelById,
                switchUserManageTab,
                updateUserManagePanelByType,
                addMasterItem,
                toggleMasterActive,
                removeMasterItem,
                toggleAccountStatus,
                resetUserPassword,
                syncUserAccountsFromServer,
            };

            Object.keys(expose).forEach(function (k) {
                const v = expose[k];
                if (typeof v === 'function') window[k] = v;
            });
        } catch (e) {
            console.error('bps window expose 실패 — 인라인 onclick이 동작하지 않을 수 있습니다.', e);
        }
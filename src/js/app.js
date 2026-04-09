import { createDashboard } from './dashboard-module.js';
import { bindEstimateListInteractions, goEstimateListPage, initEstimateListFiltersModule, renderEstimateTable } from './estimate-table-module.js';
import { updateGenericListPagination } from './list-pagination.js';
import { createRenderPanelContent } from './estimate-panel-content.js';
import { saveEstimateChanges } from './estimate-save-module.js';
import { createFinanceRecalc } from './estimate-finance-recalc.js';
import { createEstimateFinanceModal } from './estimate-finance-modal.js';
import { createProjectRegister } from './estimate-project-register.js';

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

        let renderDashboard = function () {};
        let toggleDashboardTheme = function () {};
        let dashboardChangeMonth = function () {};
        let closeDashboardEventModal = function () {};
        let closeDashboardDayEventsModal = function () {};

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
        window.addEventListener('DOMContentLoaded', async function() {
            const AUTH_USER_KEY = 'bps_auth_userId';

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

            const pathLower = (window.location.pathname || '').toLowerCase();
            const isMainAppEntry =
                pathLower === '/' ||
                pathLower.endsWith('/index.html') ||
                pathLower === '' ||
                pathLower.endsWith('/');

            if (!isAuthed && isMainAppEntry) {
                const next = (window.location.hash || '').slice(1) || 'dashboard';
                window.location.href = 'login.html?next=' + encodeURIComponent(next);
                return;
            }

            if (!isAuthed) {
                window.location.href = 'login.html?next=dashboard';
                return;
            }

            // ========================================
            // 대시보드 본문 — public/partials/page-dashboard.html (로그인 통과 후·showPage 전)
            // ========================================
            try {
                const { ensureDashboardPartialMounted } = await import('./dashboard-partial-loader.js');
                await ensureDashboardPartialMounted();
            } catch (e) {
                console.error(e);
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

        const estimates = [];

        /** 매출 내역 행(values[0])에서 유효한 YYYY-MM-DD만 추출(경영실적·미수 등과 동일 규칙) */
        function deriveSalesDatesFromSalesRows(salesRows) {
            const out = [];
            if (!Array.isArray(salesRows)) return out;
            salesRows.forEach(function (r) {
                const dt = r && r[0] != null ? String(r[0]).trim() : '';
                if (dt && /^\d{4}-\d{2}-\d{2}/.test(dt)) out.push(dt.slice(0, 10));
            });
            return out;
        }

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
                if (!Array.isArray(e.salesRows)) e.salesRows = [];
                if (!Array.isArray(e.paymentRows)) e.paymentRows = [];
                if (!Array.isArray(e.purchaseRows)) e.purchaseRows = [];
                if (!Array.isArray(e.transferRows)) e.transferRows = [];
                if (e.businessIncomeGross === undefined) e.businessIncomeGross = 0;
                if (e.businessIncomeTransferDate === undefined) e.businessIncomeTransferDate = '';
                if (e.businessIncomePaidStatus === undefined) e.businessIncomePaidStatus = '미지급';
                if (e.salesRows.length > 0) {
                    e.salesDates = deriveSalesDatesFromSalesRows(e.salesRows);
                } else if (!Array.isArray(e.salesDates)) {
                    e.salesDates = [];
                }
                seedEstimateAggregates(e);
                e.purchaseTaxIssued = derivePurchaseTaxIssuedFromRows(e.purchaseRows);
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

        function estimateCodeKey(code) {
            return String(code == null ? '' : code).trim();
        }
        function findEstimateIndexByCode(code) {
            const k = estimateCodeKey(code);
            return estimates.findIndex(function (e) {
                return estimateCodeKey(e && e.code) === k;
            });
        }
        function findEstimateByCode(code) {
            const ix = findEstimateIndexByCode(code);
            return ix === -1 ? null : estimates[ix];
        }

        function derivePaidStatusFromAmounts(salesGross, paymentGross) {
            const s = Math.round(Number(salesGross) || 0);
            const p = Math.round(Number(paymentGross) || 0);
            if (s <= 0) return '미수';
            if (p <= 0) return '미수';
            if (p >= s) return '전액';
            return '부분';
        }

        function derivePurchaseTaxIssuedFromRows(purchaseRows) {
            if (!Array.isArray(purchaseRows) || purchaseRows.length === 0) return false;
            return purchaseRows.some(function (r) {
                return String(r && r[5] ? r[5] : '').trim() === '발행';
            });
        }

        function buildFinanceRowsFromSummary(item) {
            if (!item) return;
            applyEstimateDefaultsAndSeed([item]);
            seedEstimateAggregates(item);

            const d =
                (item.salesDates && item.salesDates.length ? item.salesDates[item.salesDates.length - 1] : '') ||
                (item.date ? String(item.date).slice(0, 10) : new Date().toISOString().slice(0, 10));
            const name = String(item.contractor || item.project || '-');

            const revenueGross = Number(item.revenue) || 0;
            const purchaseGross = Number(item.purchase) || 0;
            const paidGross = Number(item.aggregatePaymentGross) || 0;
            const transferGross = Number(item.aggregateTransferGross) || 0;

            // 매출 1행
            if (revenueGross > 0 && (!item.salesRows || item.salesRows.length === 0)) {
                const p = splitNetTaxFromGross(revenueGross);
                item.salesRows = [
                    [d, name, p.net, p.tax, p.gross, item.taxIssued ? '발행' : '미발행', '-', 'CSV 자동', null],
                ];
            }

            // 수금 1행 (미수도 0원 행으로 남김: CSV 입력을 “표로도” 보이게)
            if (
                revenueGross > 0 &&
                (!item.paymentRows || item.paymentRows.length === 0) &&
                (item.paidStatus === '미수' || item.paidStatus === '부분' || item.paidStatus === '전액')
            ) {
                const pp = splitNetTaxFromGross(paidGross);
                const memo =
                    item.paidStatus === '전액'
                        ? '전액 수금(CSV)'
                        : item.paidStatus === '부분'
                          ? '부분 수금(CSV)'
                          : '미수(CSV)';
                item.paymentRows = [[d, name, pp.net, pp.tax, pp.gross, memo, null]];
            }

            // 매입 1행
            if (purchaseGross > 0 && (!item.purchaseRows || item.purchaseRows.length === 0)) {
                const p2 = splitNetTaxFromGross(purchaseGross);
                item.purchaseRows = [[d, name, p2.net, p2.tax, p2.gross, '미발행', '-', 'CSV 자동', null]];
            }

            // 이체 1행 (매입이 있으면 기본 이체도 표에 보여줌)
            if (purchaseGross > 0 && (!item.transferRows || item.transferRows.length === 0)) {
                const tp = splitNetTaxFromGross(transferGross);
                item.transferRows = [[d, name, tp.net, tp.tax, tp.gross, '이체(CSV)', null]];
            }
            if (item.salesRows && item.salesRows.length > 0) {
                item.salesDates = deriveSalesDatesFromSalesRows(item.salesRows);
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

        /** 금융 행(매출/수금/매입/이체) 편집 후 `estimates` 스냅샷을 Supabase에 반영 */
        function persistEstimateToServerByCode(code) {
            const ix = findEstimateIndexByCode(code);
            if (ix === -1) return Promise.resolve({ ok: false, error: '항목을 찾을 수 없습니다.' });
            return upsertEstimateToServer(estimates[ix]);
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
            // 매출 칩: 매출 행 기준 taxIssued(세금계산서 발행 여부)
            if (!isPurchaseSide) {
                return item.taxIssued ? 'table-amount-chip--issued' : 'table-amount-chip--not-issued';
            }
            // 매입 칩: 매입 행(values[5]) 발행/미발행만 반영 (매출 taxIssued와 무관)
            if (item.type !== '세금계산서') return 'table-amount-chip--na';
            if (purchaseAmount <= 0) return 'table-amount-chip--na';
            const pIssued = item.purchaseTaxIssued === true
                ? true
                : (item.purchaseTaxIssued === false ? false : derivePurchaseTaxIssuedFromRows(item.purchaseRows || []));
            return pIssued ? 'table-amount-chip--issued' : 'table-amount-chip--not-issued';
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

        /** 대/중/소분류 마스터 — 기본 목록은 DB(category_settings) 시드 또는 서버 동기화로 채움 */
        let category1Master = [];
        let category2Master = [];
        let category3Master = [];

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
                if (!Array.isArray(arr)) return;
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
            var sorted = masterArr.slice().sort(function (a, b) {
                return a.name.localeCompare(b.name, 'ko');
            });
            tbody.innerHTML = sorted.map(function (m) {
                var used = estimates.some(function (e) {
                    return (e[field] || '').trim() === m.name;
                });
                var stateLabel = m.active ? '활성' : '비활성';
                var nameJsArg = '\'' + String(m.name).replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\'';
                return (
                    '<tr><td style="font-weight: 500;">' +
                    escapeHtmlAttr(m.name) +
                    '</td>' +
                    '<td style="text-align:center;">' +
                    '<button type="button" class="master-state-switch' +
                    (m.active ? ' is-active' : '') +
                    '" onclick="toggleMasterActive(\'' +
                    key +
                    '\',' +
                    nameJsArg +
                    ')" title="' +
                    (m.active ? '비활성으로 전환' : '활성으로 전환') +
                    '">' +
                    '<span class="master-state-switch-track"><span class="master-state-switch-thumb"></span></span>' +
                    '<span class="master-state-switch-label">' +
                    stateLabel +
                    '</span>' +
                    '</button>' +
                    '</td>' +
                    '<td style="text-align:center;white-space:nowrap;">' +
                    '<button type="button" class="master-delete-icon-btn" title="' +
                    (used ? '사용 중 항목은 삭제할 수 없습니다.' : '삭제') +
                    '" ' +
                    (used ? 'disabled' : 'onclick="removeMasterItem(\'' + key + '\',' + nameJsArg + ')"') +
                    '>' +
                    '<i class="fas fa-trash"></i></button></td></tr>'
                );
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
            if (document.getElementById('sharedPanelBody') && currentEditItem) {
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
            if (document.getElementById('sharedPanelBody') && currentEditItem) {
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
            if (document.getElementById('sharedPanelBody') && currentEditItem) {
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
        let contractorListPage = 1;
        let expenseListPage = 1;
        let sgaListPage = 1;

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
            return initEstimateListFiltersModule({
                renderTable: renderTable,
                setCurrentStatus: function (status) { currentStatus = status; },
                setEstimateDatePreset: setEstimateDatePreset,
                hideEstimateFilterPopoverPanels: hideEstimateFilterPopoverPanels,
                initCustomMonthPicker: initCustomMonthPicker,
                initCustomDatePicker: initCustomDatePicker,
                updateEstimateByMonthPresetButtonLabel: updateEstimateByMonthPresetButtonLabel,
                updateEstimateCustomRangeButtonLabel: updateEstimateCustomRangeButtonLabel,
                toggleEstimateCustomRange: toggleEstimateCustomRange,
                customMonthPickerOnOpen: customMonthPickerOnOpen,
            });
        }

        function goEstimatePage(p) {
            return goEstimateListPage({
                setEstimateListPage: function (page) { estimateListPage = page; },
                renderTable: renderTable,
            }, p);
        }

        function updateEstimatePaginationUI(totalItems, totalPages, currentPage) {
            updateGenericListPagination(
                'estimateTablePagination',
                'estimatePaginationInfo',
                'estimatePaginationControls',
                totalItems,
                totalPages,
                currentPage,
                ESTIMATE_PAGE_SIZE,
                'goEstimatePage'
            );
        }

        function goContractorPage(p) {
            if (p < 1) return;
            contractorListPage = p;
            renderContractorTable({ preservePage: true });
        }

        function goExpenseListPage(p) {
            if (p < 1) return;
            expenseListPage = p;
            renderExpenseTable({ preservePage: true });
        }

        function goSgaListPage(p) {
            if (p < 1) return;
            sgaListPage = p;
            renderSgaTable({ preservePage: true });
        }

        // 테이블 렌더링
        function renderTable(options) {
            return renderEstimateTable({
                getEstimates: function () { return estimates; },
                getCurrentStatus: function () { return currentStatus; },
                getEstimateListPage: function () { return estimateListPage; },
                setEstimateListPage: function (page) { estimateListPage = page; },
                ESTIMATE_PAGE_SIZE: ESTIMATE_PAGE_SIZE,
                refreshCategoryFilterOptionsAll: refreshCategoryFilterOptionsAll,
                canCurrentUserSeeEstimateMonetary: canCurrentUserSeeEstimateMonetary,
                canCurrentUserAccessEstimateItem: canCurrentUserAccessEstimateItem,
                itemMatchesEstimateDateFilter: itemMatchesEstimateDateFilter,
                computeBizTaxFromGross: computeBizTaxFromGross,
                getEstimateSortKey: getEstimateSortKey,
                projectSalesPurchaseChipClass: projectSalesPurchaseChipClass,
                renderCashflowTripleCell: renderCashflowTripleCell,
                escapeHtmlAttr: escapeHtmlAttr,
                updateEstimatePaginationUI: updateEstimatePaginationUI,
            }, options);
        }

        bindEstimateListInteractions({
            setCurrentStatus: function (status) { currentStatus = status; },
            renderTable: renderTable,
            openPanel: openPanel,
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
        function renderContractorTable(options) {
            const preservePage = options && options.preservePage === true;
            if (!preservePage) contractorListPage = 1;
            const tbody = document.getElementById('contractorTableBody');
            const totalItems = contractors.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / ESTIMATE_PAGE_SIZE));
            if (contractorListPage > totalPages) contractorListPage = totalPages;
            if (contractorListPage < 1) contractorListPage = 1;
            const sliceStart = (contractorListPage - 1) * ESTIMATE_PAGE_SIZE;
            const pageRows = contractors.slice(sliceStart, sliceStart + ESTIMATE_PAGE_SIZE);

            if (contractors.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 40px; color: var(--gray-500);">
                            등록된 업체가 없습니다
                        </td>
                    </tr>
                `;
                updateGenericListPagination(
                    'contractorTablePagination',
                    'contractorPaginationInfo',
                    'contractorPaginationControls',
                    0,
                    1,
                    1,
                    ESTIMATE_PAGE_SIZE,
                    'goContractorPage'
                );
                return;
            }

            tbody.innerHTML = pageRows.map((item, index) => {
                const rowNum = sliceStart + index + 1;
                return `
                <tr class="table-row-clickable" data-contractor-id="${item.id}" onclick="openContractorDetailPanel(${item.id})">
                    <td>${rowNum}</td>
                    <td style="font-weight: 600;">${item.name}</td>
                    <td>${item.phone || '-'}</td>
                    <td>${item.hasLicense ? `<span class="file-link" onclick="event.stopPropagation(); viewContractorImage('license', ${item.id})" style="color: var(--success); cursor: pointer;"><i class="fas fa-check-circle"></i> 있음</span>` : '<span style="color: var(--gray-400);">없음</span>'}</td>
                    <td>${item.hasBankAccount ? `<span class="file-link" onclick="event.stopPropagation(); viewContractorImage('bank', ${item.id})" style="color: var(--success); cursor: pointer;"><i class="fas fa-check-circle"></i> 있음</span>` : '<span style="color: var(--gray-400);">없음</span>'}</td>
                </tr>
            `;
            }).join('');
            updateGenericListPagination(
                'contractorTablePagination',
                'contractorPaginationInfo',
                'contractorPaginationControls',
                totalItems,
                totalPages,
                contractorListPage,
                ESTIMATE_PAGE_SIZE,
                'goContractorPage'
            );
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

        /** 일괄 업로드(추가 예정)용 UTF-8 BOM CSV 양식 — 헤더 + 예시 한 행 */
        function downloadContractorImportTemplate() {
            let csv = '\uFEFF';
            csv +=
                'id,name,phone,date,hasLicense,hasBankAccount\n' +
                ',예시건설,02-1234-5678,2026-01-01,false,false\n';
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '업체정보_업로드양식.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        var CONTRACTOR_IMPORT_MAX_ROWS = 500;
        var CONTRACTOR_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

        function parseContractorCsvTextToRows(text) {
            text = String(text || '').replace(/^\uFEFF/, '');
            var rows = [];
            var row = [];
            var cell = '';
            var inQ = false;
            for (var i = 0; i < text.length; i++) {
                var c = text[i];
                if (inQ) {
                    if (c === '"') {
                        if (text[i + 1] === '"') {
                            cell += '"';
                            i++;
                            continue;
                        }
                        inQ = false;
                        continue;
                    }
                    cell += c;
                    continue;
                }
                if (c === '"') {
                    inQ = true;
                    continue;
                }
                if (c === ',') {
                    row.push(cell);
                    cell = '';
                    continue;
                }
                if (c === '\r') {
                    if (text[i + 1] === '\n') i++;
                    row.push(cell);
                    rows.push(row);
                    row = [];
                    cell = '';
                    continue;
                }
                if (c === '\n') {
                    row.push(cell);
                    rows.push(row);
                    row = [];
                    cell = '';
                    continue;
                }
                cell += c;
            }
            row.push(cell);
            if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
                rows.push(row);
            }
            return rows.filter(function (r) {
                return r.some(function (cl) {
                    return String(cl).trim() !== '';
                });
            });
        }

        function normalizeContractorImportHeaderKey(h) {
            var s = String(h || '')
                .trim()
                .toLowerCase()
                .replace(/\s/g, '');
            var map = {
                id: 'id',
                name: 'name',
                업체명: 'name',
                phone: 'phone',
                전화번호: 'phone',
                date: 'date',
                등록일: 'date',
                haslicense: 'hasLicense',
                사업자등록증: 'hasLicense',
                hasbankaccount: 'hasBankAccount',
                통장사본: 'hasBankAccount'
            };
            return map[s] || s;
        }

        function parseContractorImportBool(raw) {
            var t = String(raw == null ? '' : raw)
                .trim()
                .toLowerCase();
            if (!t) return false;
            if (t === 'true' || t === '1' || t === 'yes' || t === 'y' || t === '있음') return true;
            if (t === 'false' || t === '0' || t === 'no' || t === 'n' || t === '없음') return false;
            return null;
        }

        function buildContractorItemForImport(rowMap, prev, explicitId) {
            var name = String(rowMap.name == null ? '' : rowMap.name).trim();
            var phone = String(rowMap.phone == null ? '' : rowMap.phone).trim();
            var dateRaw = String(rowMap.date == null ? '' : rowMap.date).trim();
            var dateStr = dateRaw;
            if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return { error: '날짜는 YYYY-MM-DD 형식이어야 합니다.' };
            }
            if (!dateStr) {
                dateStr =
                    (prev && prev.date) ||
                    new Date().toISOString().slice(0, 10);
            }
            var hasL = parseContractorImportBool(
                rowMap.hasLicense != null && rowMap.hasLicense !== '' ? rowMap.hasLicense : ''
            );
            if (hasL === null)
                return { error: 'hasLicense 값을 해석할 수 없습니다 (true/false, 있음/없음).' };
            var hasB = parseContractorImportBool(
                rowMap.hasBankAccount != null && rowMap.hasBankAccount !== '' ? rowMap.hasBankAccount : ''
            );
            if (hasB === null)
                return { error: 'hasBankAccount 값을 해석할 수 없습니다.' };

            var o = {
                id: explicitId,
                name: name,
                phone: phone,
                date: dateStr,
                hasLicense: hasL,
                hasBankAccount: hasB
            };
            if (prev) {
                if (hasL && prev.licenseDataUrl) {
                    o.licenseDataUrl = prev.licenseDataUrl;
                    o.licenseFileName = prev.licenseFileName;
                    o.licenseMimeType = prev.licenseMimeType;
                }
                if (hasB && prev.bankDataUrl) {
                    o.bankDataUrl = prev.bankDataUrl;
                    o.bankFileName = prev.bankFileName;
                    o.bankMimeType = prev.bankMimeType;
                }
            }
            return { item: o };
        }

        function openContractorCsvImportPicker() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                alert(
                    '세션을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 로그인해 주세요.'
                );
                return;
            }
            var inp = document.getElementById('contractorCsvImportInput');
            if (!inp) return;
            inp.value = '';
            inp.click();
        }

        function onContractorCsvImportFileChange(ev) {
            var input = ev && ev.target;
            var file = input && input.files && input.files[0];
            if (!file) return;
            if (file.size > CONTRACTOR_IMPORT_MAX_BYTES) {
                alert('파일이 너무 큽니다. (최대 약 2MB)');
                input.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                var text = String(reader.result || '');
                var res = parseAndValidateContractorImportCsv(text);
                input.value = '';
                if (!res.ok) {
                    alert(res.error || 'CSV를 읽을 수 없습니다.');
                    return;
                }
                openContractorImportModalWithResult(res);
            };
            reader.onerror = function () {
                alert('파일을 읽지 못했습니다.');
                input.value = '';
            };
            reader.readAsText(file, 'UTF-8');
        }

        function parseAndValidateContractorImportCsv(text) {
            var rows = parseContractorCsvTextToRows(text);
            if (!rows.length) {
                return { ok: false, error: '데이터 행이 없습니다.' };
            }
            var headerCells = rows[0].map(function (h) {
                return normalizeContractorImportHeaderKey(h);
            });
            var idx = {};
            for (var hi = 0; hi < headerCells.length; hi++) {
                var key = headerCells[hi];
                if (key && idx[key] === undefined) idx[key] = hi;
            }
            if (idx.name === undefined) {
                return { ok: false, error: 'CSV에 name(업체명) 열이 필요합니다.' };
            }

            var dataRows = rows.slice(1);
            if (dataRows.length > CONTRACTOR_IMPORT_MAX_ROWS) {
                return {
                    ok: false,
                    error: '한 번에 최대 ' + CONTRACTOR_IMPORT_MAX_ROWS + '행까지만 업로드할 수 있습니다.'
                };
            }

            var usedExplicitIds = {};
            var previews = [];
            var pendingItems = [];
            var maxExisting =
                contractors.length > 0
                    ? Math.max.apply(
                          null,
                          contractors.map(function (c) {
                              return Number(c.id) || 0;
                          })
                      )
                    : 0;
            var autoCursor = maxExisting;

            for (var ri = 0; ri < dataRows.length; ri++) {
                var line = ri + 2;
                var cells = dataRows[ri];
                var rowMap = {};
                Object.keys(idx).forEach(function (k) {
                    rowMap[k] = cells[idx[k]] != null ? cells[idx[k]] : '';
                });
                var name = String(rowMap.name == null ? '' : rowMap.name).trim();
                if (!name) {
                    previews.push({
                        line: line,
                        name: '',
                        idDisp: '',
                        err: '업체명(name)이 비었습니다.'
                    });
                    continue;
                }

                var idCell = String(rowMap.id != null ? rowMap.id : '').trim();
                var explicitId = null;
                if (idCell !== '') {
                    explicitId = Number(idCell);
                    if (!Number.isFinite(explicitId)) {
                        previews.push({
                            line: line,
                            name: name,
                            idDisp: idCell,
                            err: 'id는 숫자여야 합니다.'
                        });
                        continue;
                    }
                    if (usedExplicitIds[explicitId]) {
                        previews.push({
                            line: line,
                            name: name,
                            idDisp: String(explicitId),
                            err: 'CSV 안에서 id가 중복되었습니다.'
                        });
                        continue;
                    }
                    usedExplicitIds[explicitId] = true;
                } else {
                    do {
                        autoCursor++;
                    } while (usedExplicitIds[autoCursor]);
                    explicitId = autoCursor;
                    usedExplicitIds[explicitId] = true;
                }

                var prev = contractors.find(function (c) {
                    return Number(c.id) === explicitId;
                });
                var built = buildContractorItemForImport(rowMap, prev, explicitId);
                if (built.error) {
                    previews.push({
                        line: line,
                        name: name,
                        idDisp: String(explicitId),
                        err: built.error
                    });
                    continue;
                }
                previews.push({
                    line: line,
                    name: name,
                    idDisp: String(explicitId),
                    err: '',
                    mode: prev ? '수정' : '신규'
                });
                pendingItems.push(built.item);
            }

            var errs = previews.filter(function (p) {
                return p.err;
            });
            if (errs.length) {
                return { ok: true, previews: previews, pendingItems: null, hasErrors: true };
            }
            if (!pendingItems.length) {
                return { ok: false, error: '반영할 유효 행이 없습니다.' };
            }
            return { ok: true, previews: previews, pendingItems: pendingItems, hasErrors: false };
        }

        function openContractorImportModalWithResult(res) {
            var body = document.getElementById('contractorImportModalBody');
            var modal = document.getElementById('contractorImportModal');
            if (!body || !modal) return;

            window.__contractorImportPending = res.hasErrors ? null : res.pendingItems;

            var summary =
                '<div class="contractor-import-modal-summary">' +
                (res.hasErrors
                    ? '<strong>오류가 있는 행을 수정한 뒤 다시 업로드해 주세요.</strong> (저장 버튼은 비활성화)'
                    : '<strong>' +
                      res.pendingItems.length +
                      '건</strong>을 서버에 반영합니다. 기존 id는 수정, 빈 id는 신규 번호가 부여됩니다.') +
                '</div>';

            var table =
                '<div class="table-section"><table><thead><tr><th>CSV행</th><th>id</th><th>업체명</th><th>구분</th><th>결과</th></tr></thead><tbody>';
            for (var pi = 0; pi < res.previews.length; pi++) {
                var p = res.previews[pi];
                table +=
                    '<tr><td>' +
                    p.line +
                    '</td><td>' +
                    escapeHtml(p.idDisp) +
                    '</td><td>' +
                    escapeHtml(p.name) +
                    '</td><td>' +
                    escapeHtml(p.mode || '-') +
                    '</td><td class="' +
                    (p.err ? 'contractor-import-row-err' : '') +
                    '">' +
                    escapeHtml(p.err || 'OK') +
                    '</td></tr>';
            }
            table += '</tbody></table></div>';

            var actions =
                '<div class="contractor-import-modal-actions">' +
                '<button type="button" class="btn btn-secondary" onclick="closeContractorImportModal()">닫기</button>' +
                '<button type="button" class="btn btn-primary" id="contractorImportConfirmBtn" onclick="confirmContractorImport()" ' +
                (res.hasErrors ? 'disabled' : '') +
                '>서버에 반영</button></div>';

            body.innerHTML = summary + table + actions;
            modal.classList.add('active');
        }

        function closeContractorImportModal() {
            var modal = document.getElementById('contractorImportModal');
            if (modal) modal.classList.remove('active');
            window.__contractorImportPending = null;
        }

        function confirmContractorImport() {
            var pending = window.__contractorImportPending;
            if (!pending || !pending.length) return;
            var i = 0;
            function step() {
                if (i >= pending.length) {
                    syncContractorsFromServer().then(function () {
                        alert(pending.length + '건 반영했습니다.');
                        closeContractorImportModal();
                    });
                    return;
                }
                var item = pending[i];
                upsertContractorToServer(item).then(function (r) {
                    if (!r.ok) {
                        alert(
                            '저장 실패 (목록 ' +
                                (i + 1) +
                                '번째 / id ' +
                                item.id +
                                '): ' +
                                (r.error || '')
                        );
                        syncContractorsFromServer();
                        closeContractorImportModal();
                        return;
                    }
                    i++;
                    step();
                });
            }
            step();
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

        function renderSgaTable(options) {
            const preservePage = options && options.preservePage === true;
            if (!preservePage) sgaListPage = 1;
            const tbody = document.getElementById('sgaTableBody');
            if (!tbody) return;
            const month = getSgaMonthFilter();
            const filtered = month ? sgaExpenses.filter(function(item) {
                return item.date && item.date.slice(0, 7) === month;
            }) : sgaExpenses.slice();
            filtered.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / ESTIMATE_PAGE_SIZE));
            if (sgaListPage > totalPages) sgaListPage = totalPages;
            if (sgaListPage < 1) sgaListPage = 1;
            const sliceStart = (sgaListPage - 1) * ESTIMATE_PAGE_SIZE;
            const pageRows = filtered.slice(sliceStart, sliceStart + ESTIMATE_PAGE_SIZE);

            if (!filtered.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--gray-500);">' +
                    (month ? '해당 월에 등록된 판관비 내역이 없습니다' : '등록된 판관비 내역이 없습니다') + '</td></tr>';
                updateGenericListPagination(
                    'sgaTablePagination',
                    'sgaPaginationInfo',
                    'sgaPaginationControls',
                    0,
                    1,
                    1,
                    ESTIMATE_PAGE_SIZE,
                    'goSgaListPage'
                );
                return;
            }

            tbody.innerHTML = pageRows.map(function(item, idx) {
                var rowNum = sliceStart + idx + 1;
                return '<tr class="table-row-clickable" data-sga-id="' + item.id + '" onclick="openSgaDetailPanel(' + item.id + ')">' +
                    '<td>' + rowNum + '</td>' +
                    '<td>' + (item.date || '-') + '</td>' +
                    '<td>' + (item.category || '-') + '</td>' +
                    '<td class="text-right">' + (item.amount || 0).toLocaleString() + '원</td>' +
                    '<td class="sga-memo-cell"><span class="sga-memo-text">' + (item.memo || '-') + '</span></td>' +
                '</tr>';
            }).join('');
            updateGenericListPagination(
                'sgaTablePagination',
                'sgaPaginationInfo',
                'sgaPaginationControls',
                totalItems,
                totalPages,
                sgaListPage,
                ESTIMATE_PAGE_SIZE,
                'goSgaListPage'
            );
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
            const defaultMonth =
                now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            months.add(defaultMonth);
            expenses.forEach(e => {
                if (e.date) months.add(e.date.slice(0, 7));
            });
            const sorted = Array.from(months).sort().reverse();
            const previous = sel.value;
            let current;
            if (previous === '') {
                current = '';
            } else if (previous && sorted.includes(previous)) {
                current = previous;
            } else {
                current = defaultMonth;
            }
            sel.innerHTML = '<option value="">전체</option>' + sorted.map(m => {
                const [y, mo] = m.split('-');
                const label = y + '년 ' + parseInt(mo, 10) + '월';
                return `<option value="${m}"${m === current ? ' selected' : ''}>${label}</option>`;
            }).join('');
        }

        function onExpenseMonthChange() {
            expenseListPage = 1;
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
            const defaultMonth =
                now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            months.add(defaultMonth);
            sgaExpenses.forEach(function(e) {
                if (e.date) months.add(String(e.date).slice(0, 7));
            });
            const sorted = Array.from(months).sort().reverse();
            const previous = sel.value;
            let current;
            if (previous === '') {
                current = '';
            } else if (previous && sorted.includes(previous)) {
                current = previous;
            } else {
                current = defaultMonth;
            }
            sel.innerHTML = '<option value="">전체</option>' + sorted.map(function(m) {
                const parts = m.split('-');
                return '<option value="' + m + '"' + (m === current ? ' selected' : '') + '>' + parts[0] + '년 ' + parseInt(parts[1], 10) + '월</option>';
            }).join('');
        }

        function onSgaMonthChange() {
            sgaListPage = 1;
            renderSgaTable();
        }

        // 오늘 날짜 설정
        function setExpenseTodayDate() {
            document.getElementById('expenseUsageDate').valueAsDate = new Date();
        }

        // 경비 등록·수정 중앙 모달 열기
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

        // 경비 등록·수정 중앙 모달 닫기
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
        function renderExpenseTable(options) {
            const preservePage = options && options.preservePage === true;
            if (!preservePage) expenseListPage = 1;
            const tbody = document.getElementById('expenseTableBody');
            const filtered = getFilteredExpensesByMonth();
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / ESTIMATE_PAGE_SIZE));
            if (expenseListPage > totalPages) expenseListPage = totalPages;
            if (expenseListPage < 1) expenseListPage = 1;
            const sliceStart = (expenseListPage - 1) * ESTIMATE_PAGE_SIZE;
            const pageRows = filtered.slice(sliceStart, sliceStart + ESTIMATE_PAGE_SIZE);

            if (filtered.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: var(--gray-500);">
                            ${getExpenseMonthFilter() ? '해당 월에 등록된 경비 내역이 없습니다' : '등록된 경비 내역이 없습니다'}
                        </td>
                    </tr>
                `;
                updateGenericListPagination(
                    'expenseTablePagination',
                    'expensePaginationInfo',
                    'expensePaginationControls',
                    0,
                    1,
                    1,
                    ESTIMATE_PAGE_SIZE,
                    'goExpenseListPage'
                );
                return;
            }

            tbody.innerHTML = pageRows.map((item, index) => {
                const n = getExpenseReceipts(item).length;
                const rowNum = sliceStart + index + 1;
                return `
                <tr class="table-row-clickable" data-expense-id="${item.id}">
                    <td>${rowNum}</td>
                    <td><span class="badge ${item.type === '계좌이체' ? 'badge-transfer' : 'badge-card'}">${item.type}</span></td>
                    <td>${item.date}</td>
                    <td>${item.building || '-'}</td>
                    <td>${item.purpose || '-'}</td>
                    <td class="text-right">${item.amount.toLocaleString()}원</td>
                    <td><span class="file-link expense-row-file-link" data-expense-id="${item.id}" style="color: var(--success); cursor: pointer;"><i class="fas fa-image"></i> 보기 (${n})</span></td>
                </tr>
            `;
            }).join('');
            updateGenericListPagination(
                'expenseTablePagination',
                'expensePaginationInfo',
                'expensePaginationControls',
                totalItems,
                totalPages,
                expenseListPage,
                ESTIMATE_PAGE_SIZE,
                'goExpenseListPage'
            );
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
            csv +=
                '코드,상태,대분류,중분류,소분류,건물명,공사명,담당자,도급사,과세유형,매출액,수금상태,세금계산서발행,매입액,등록일,시작일,완료일,사업소득총액,사업소득이체일,사업소득지급상태\n';
            estimates.forEach(function (item) {
                const taxIssuedDisp = item.taxIssued ? '발행완료' : '미발행';
                csv +=
                    [
                        csvEscape(item.code || ''),
                        csvEscape(item.status || ''),
                        csvEscape(item.category1 || ''),
                        csvEscape(item.category2 || ''),
                        csvEscape(item.category3 || ''),
                        csvEscape(item.building || ''),
                        csvEscape(item.project || ''),
                        csvEscape(item.manager || ''),
                        csvEscape(item.contractor || ''),
                        csvEscape(item.type || '세금계산서'),
                        csvEscape(Number(item.revenue || 0)),
                        csvEscape(item.paidStatus || '미수'),
                        csvEscape(taxIssuedDisp),
                        csvEscape(Number(item.purchase || 0)),
                        csvEscape(item.date || ''),
                        csvEscape(item.startDate || ''),
                        csvEscape(item.endDate || ''),
                        csvEscape(Number(item.businessIncomeGross || 0)),
                        csvEscape(item.businessIncomeTransferDate || ''),
                        csvEscape(item.businessIncomePaidStatus || '미지급'),
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

        function downloadEstimateImportTemplate() {
            let csv = '\uFEFF';
            csv +=
                '코드,상태,대분류,중분류,소분류,건물명,공사명,담당자,도급사,과세유형,매출액,수금상태,세금계산서발행,매입액,등록일,시작일,완료일,사업소득총액,사업소득이체일,사업소득지급상태,매출행들,수금행들,매입행들,이체행들\n' +
                csvEscape(
                    '※ 한 프로젝트를 한 행에 입력합니다. 매출행들/수금행들/매입행들/이체행들 형식: 일자|상호명|vat포함|메모 를 ; 로 여러 건 연결. 고급 형식: 일자|상호명|vat별도|부가세|vat포함|메모. 날짜는 YYYY-MM-DD.'
                ) +
                '\n' +
                ',견적,B2B,코오롱,지원,코오롱 예시타워,외벽 보수 공사,홍길동,(주)예시건설,세금계산서,12000000,미수,미발행,8000000,2026-01-15,2026-04-06,2026-04-07,0,,미지급,' +
                csvEscape('2026-04-06|(주)예시건설|12000000|1차 매출') + ',' +
                csvEscape('2026-04-10|(주)예시건설|6000000|1차 수금;2026-04-20|(주)예시건설|6000000|2차 수금') + ',' +
                csvEscape('2026-04-08|영진인프라|4800000|자재') + ',' +
                csvEscape('2026-04-15|영진인프라|2880000|1차 이체') +
                '\n';
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '프로젝트관리_업로드양식.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        var ESTIMATE_IMPORT_MAX_ROWS = 500;
        var ESTIMATE_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

        function normalizeEstimateImportHeaderKey(h) {
            var s = String(h || '')
                .trim()
                .toLowerCase()
                .replace(/\s/g, '');
            var map = {
                kind: 'kind',
                구분: 'kind',
                code: 'code',
                코드: 'code',
                status: 'status',
                상태: 'status',
                category1: 'category1',
                대분류: 'category1',
                category2: 'category2',
                중분류: 'category2',
                category3: 'category3',
                소분류: 'category3',
                building: 'building',
                건물명: 'building',
                project: 'project',
                공사명: 'project',
                manager: 'manager',
                담당자: 'manager',
                contractor: 'contractor',
                도급사: 'contractor',
                revenue: 'revenue',
                매출액: 'revenue',
                purchase: 'purchase',
                매입액: 'purchase',
                date: 'date',
                등록일: 'date',
                startdate: 'startDate',
                시작일: 'startDate',
                enddate: 'endDate',
                완료일: 'endDate',
                type: 'type',
                과세유형: 'type',
                매출유형: 'type',
                paidstatus: 'paidStatus',
                수금상태: 'paidStatus',
                taxissued: 'taxIssued',
                세금계산서발행: 'taxIssued',
                businessincomegross: 'businessIncomeGross',
                사업소득총액: 'businessIncomeGross',
                소득총액: 'businessIncomeGross',
                businessincometransferdate: 'businessIncomeTransferDate',
                사업소득이체일: 'businessIncomeTransferDate',
                이체일: 'businessIncomeTransferDate',
                businessincomepaidstatus: 'businessIncomePaidStatus',
                사업소득지급상태: 'businessIncomePaidStatus',
                소득지급: 'businessIncomePaidStatus',
                rowdate: 'rowDate',
                일자: 'rowDate',
                rowname: 'rowName',
                상호명: 'rowName',
                vat별도: 'rowNet',
                rownet: 'rowNet',
                부가세: 'rowTax',
                rowtax: 'rowTax',
                vat포함: 'rowGross',
                rowgross: 'rowGross',
                memo: 'rowMemo',
                메모: 'rowMemo',
                salesrows: 'salesRows',
                매출행들: 'salesRows',
                paymentrows: 'paymentRows',
                수금행들: 'paymentRows',
                purchaserows: 'purchaseRows',
                매입행들: 'purchaseRows',
                transferrows: 'transferRows',
                이체행들: 'transferRows',
            };
            return map[s] || s;
        }

        function parseEstimateImportNumber(raw) {
            var s = String(raw == null ? '' : raw).trim().replace(/,/g, '');
            if (s === '') return null;
            var n = Number(s);
            if (!Number.isFinite(n)) return NaN;
            return n;
        }

        function parseEstimateImportOptionalYmd(raw, label) {
            var d = String(raw != null ? raw : '').trim();
            if (!d) return { ok: true, value: null };
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                return { ok: false, err: label + '은 YYYY-MM-DD 형식이거나 비워야 합니다.' };
            }
            return { ok: true, value: d };
        }

        function parseEstimateImportTaxIssuedCell(raw) {
            if (raw == null) return { ok: true, value: null };
            var s = String(raw).trim();
            if (s === '') return { ok: true, value: null };
            var lower = s.toLowerCase();
            if (
                lower === 'true' ||
                lower === '1' ||
                lower === 'y' ||
                lower === 'yes' ||
                lower === 'o' ||
                s === '발행완료' ||
                s === '발행'
            ) {
                return { ok: true, value: true };
            }
            if (lower === 'false' || lower === '0' || lower === 'n' || lower === 'no' || lower === 'x' || s === '미발행') {
                return { ok: true, value: false };
            }
            return {
                ok: false,
                err: '세금계산서발행은 미발행·발행완료 또는 true/false로 입력하세요.',
            };
        }

        function generateEstimateImportCode(line) {
            var yy = String(new Date().getFullYear()).slice(-2);
            return yy + String(Date.now()).slice(-5) + String(10000 + (line % 10000)).slice(-4);
        }

        function defaultEstimateShellForImport(explicitCode, line) {
            var today = new Date().toISOString().slice(0, 10);
            var code = String(explicitCode || '').trim() || generateEstimateImportCode(line);
            return {
                code: code,
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
                salesDates: [],
                purchaseTaxIssued: false,
            };
        }

        function applyEstimateCsvRowToItem(item, rowMap) {
            if (rowMap.status != null && String(rowMap.status).trim() !== '') {
                item.status = String(rowMap.status).trim();
            }
            if (rowMap.category1 != null && String(rowMap.category1).trim() !== '') {
                item.category1 = String(rowMap.category1).trim();
            }
            if (rowMap.category2 != null && String(rowMap.category2).trim() !== '') {
                item.category2 = String(rowMap.category2).trim();
            }
            if (rowMap.category3 != null && String(rowMap.category3).trim() !== '') {
                item.category3 = String(rowMap.category3).trim();
            }
            if (rowMap.building != null && String(rowMap.building).trim() !== '') {
                item.building = String(rowMap.building).trim();
            }
            if (rowMap.project != null && String(rowMap.project).trim() !== '') {
                item.project = String(rowMap.project).trim();
            }
            if (rowMap.manager != null && String(rowMap.manager).trim() !== '') {
                item.manager = String(rowMap.manager).trim();
            }
            if (rowMap.contractor != null && String(rowMap.contractor).trim() !== '') {
                item.contractor = String(rowMap.contractor).trim();
            }
            var rev = parseEstimateImportNumber(rowMap.revenue);
            if (rev !== null) {
                if (Number.isNaN(rev)) return '매출액(revenue)은 숫자여야 합니다.';
                item.revenue = Math.round(rev);
            }
            var pur = parseEstimateImportNumber(rowMap.purchase);
            if (pur !== null) {
                if (Number.isNaN(pur)) return '매입액(purchase)은 숫자여야 합니다.';
                item.purchase = Math.round(pur);
            }
            var d = String(rowMap.date != null ? rowMap.date : '').trim();
            if (d) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '등록일(date)은 YYYY-MM-DD 형식이어야 합니다.';
                item.date = d;
            }

            if (rowMap.type != null && String(rowMap.type).trim() !== '') {
                var t = String(rowMap.type).trim();
                if (!/^(세금계산서|사업소득|자체인력)$/.test(t)) {
                    return '과세유형(type)은 세금계산서, 사업소득, 자체인력 중 하나여야 합니다.';
                }
                item.type = t;
            }
            if (rowMap.paidStatus != null && String(rowMap.paidStatus).trim() !== '') {
                var ps = String(rowMap.paidStatus).trim();
                if (!/^(미수|전액|부분|해당없음)$/.test(ps)) {
                    return '수금상태(paidStatus)는 미수, 전액, 부분, 해당없음 중 하나여야 합니다.';
                }
                item.paidStatus = ps;
            }
            var taxParsed = parseEstimateImportTaxIssuedCell(rowMap.taxIssued);
            if (!taxParsed.ok) return taxParsed.err;
            if (taxParsed.value !== null) item.taxIssued = taxParsed.value;

            var sd = parseEstimateImportOptionalYmd(rowMap.startDate, '시작일(startDate)');
            if (!sd.ok) return sd.err;
            if (sd.value) item.startDate = sd.value;

            var ed = parseEstimateImportOptionalYmd(rowMap.endDate, '완료일(endDate)');
            if (!ed.ok) return ed.err;
            if (ed.value) item.endDate = ed.value;

            var big = parseEstimateImportNumber(rowMap.businessIncomeGross);
            if (big !== null) {
                if (Number.isNaN(big)) return '사업소득총액은 숫자여야 합니다.';
                item.businessIncomeGross = Math.round(big);
                var _biz = computeBizTaxFromGross(item.businessIncomeGross);
                item.businessIncomeNetPay = _biz.net;
            }
            var bit = String(rowMap.businessIncomeTransferDate != null ? rowMap.businessIncomeTransferDate : '').trim();
            if (bit) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(bit)) {
                    return '사업소득이체일은 YYYY-MM-DD 형식이어야 합니다.';
                }
                item.businessIncomeTransferDate = bit;
            }
            if (rowMap.businessIncomePaidStatus != null && String(rowMap.businessIncomePaidStatus).trim() !== '') {
                var bip = String(rowMap.businessIncomePaidStatus).trim();
                if (!/^(미지급|지급)$/.test(bip)) {
                    return '사업소득지급상태는 미지급 또는 지급이어야 합니다.';
                }
                item.businessIncomePaidStatus = bip;
            }

            return null;
        }

        function openEstimateCsvImportPicker() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                alert('세션을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 로그인해 주세요.');
                return;
            }
            var inp = document.getElementById('estimateCsvImportInput');
            if (!inp) return;
            inp.value = '';
            inp.click();
        }

        function onEstimateCsvImportFileChange(ev) {
            var input = ev && ev.target;
            var file = input && input.files && input.files[0];
            if (!file) return;
            if (file.size > ESTIMATE_IMPORT_MAX_BYTES) {
                alert('파일이 너무 큽니다. (최대 약 2MB)');
                input.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                var text = String(reader.result || '');
                var res = parseAndValidateEstimateImportCsv(text);
                input.value = '';
                if (!res.ok) {
                    alert(res.error || 'CSV를 읽을 수 없습니다.');
                    return;
                }
                openEstimateImportModalWithResult(res);
            };
            reader.onerror = function () {
                alert('파일을 읽지 못했습니다.');
                input.value = '';
            };
            reader.readAsText(file, 'UTF-8');
        }

        function parseAndValidateEstimateImportCsv(text) {
            var rows = parseContractorCsvTextToRows(text);
            if (!rows.length) {
                return { ok: false, error: '데이터 행이 없습니다.' };
            }
            var headerCells = rows[0].map(function (h) {
                return normalizeEstimateImportHeaderKey(h);
            });
            var idx = {};
            for (var hi = 0; hi < headerCells.length; hi++) {
                var key = headerCells[hi];
                if (key && idx[key] === undefined) idx[key] = hi;
            }
            const hasKind = idx.kind !== undefined;
            if (!hasKind) {
                if (idx.code === undefined && idx.building === undefined && idx.project === undefined) {
                    return { ok: false, error: 'CSV에 코드·건물명·공사명 중 하나의 열이 필요합니다.' };
                }
            } else {
                if (idx.code === undefined) {
                    return { ok: false, error: '구분이 있는 양식은 code(코드) 열이 필요합니다.' };
                }
            }

            var dataRows = rows.slice(1);
            if (dataRows.length > ESTIMATE_IMPORT_MAX_ROWS) {
                return {
                    ok: false,
                    error: '한 번에 최대 ' + ESTIMATE_IMPORT_MAX_ROWS + '행까지만 업로드할 수 있습니다.',
                };
            }

            var previews = [];
            var pendingItems = [];
            var usedCodes = {};
            var itemByCode = {};

            function getOrCreateByCode(code, line) {
                const c = String(code || '').trim();
                if (!c) return null;
                if (itemByCode[c]) return itemByCode[c];
                const existing = estimates.find(function (e) { return String(e.code || '').trim() === c; });
                const base = existing ? JSON.parse(JSON.stringify(existing)) : defaultEstimateShellForImport(c, line);
                applyEstimateDefaultsAndSeed([base]);
                itemByCode[c] = base;
                return base;
            }

            function parseFinanceRowAmounts(rowMap) {
                const gross = parseEstimateImportNumber(rowMap.rowGross);
                if (gross !== null) {
                    if (Number.isNaN(gross)) return { ok: false, err: 'vat포함(rowGross)은 숫자여야 합니다.' };
                    const parts = splitNetTaxFromGross(Math.round(gross));
                    return { ok: true, net: parts.net, tax: parts.tax, gross: parts.gross };
                }
                const net = parseEstimateImportNumber(rowMap.rowNet);
                if (net === null) return { ok: true, net: 0, tax: 0, gross: 0 };
                if (Number.isNaN(net)) return { ok: false, err: 'vat별도(rowNet)은 숫자여야 합니다.' };
                const n = Math.round(net);
                const t = Math.round(n * 0.1);
                return { ok: true, net: n, tax: t, gross: n + t };
            }

            function parsePackedRows(raw, fallbackDate, fallbackName, defaultMemo) {
                const s = String(raw == null ? '' : raw).trim();
                if (!s) return { ok: true, rows: [] };
                const chunks = s
                    .split(';')
                    .map(function (x) { return String(x).trim(); })
                    .filter(Boolean);
                const outRows = [];
                for (var ci = 0; ci < chunks.length; ci++) {
                    var parts = chunks[ci].split('|').map(function (x) { return String(x).trim(); });
                    if (parts.length < 3) {
                        return { ok: false, err: '테이블행 컬럼 형식 오류: ' + chunks[ci] };
                    }
                    var d = parts[0] || fallbackDate;
                    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                        return { ok: false, err: '테이블행 날짜는 YYYY-MM-DD 형식이어야 합니다.' };
                    }
                    var nm = parts[1] || fallbackName || '-';
                    var net = 0, tax = 0, gross = 0, memo = '';
                    if (parts.length >= 6) {
                        // 일자|상호명|vat별도|부가세|vat포함|메모
                        var n = parseEstimateImportNumber(parts[2]);
                        var t = parseEstimateImportNumber(parts[3]);
                        var g = parseEstimateImportNumber(parts[4]);
                        if (Number.isNaN(n) || Number.isNaN(t) || Number.isNaN(g)) {
                            return { ok: false, err: '테이블행 금액은 숫자여야 합니다.' };
                        }
                        net = Math.round(n || 0);
                        tax = Math.round(t || 0);
                        gross = Math.round(g || (net + tax));
                        memo = parts[5] || defaultMemo || 'CSV';
                    } else {
                        // 일자|상호명|vat포함|메모
                        var g2 = parseEstimateImportNumber(parts[2]);
                        if (Number.isNaN(g2)) return { ok: false, err: '테이블행 vat포함은 숫자여야 합니다.' };
                        var p2 = splitNetTaxFromGross(Math.round(g2 || 0));
                        net = p2.net; tax = p2.tax; gross = p2.gross;
                        memo = (parts[3] || defaultMemo || 'CSV');
                    }
                    outRows.push([d || fallbackDate || new Date().toISOString().slice(0, 10), nm, net, tax, gross, memo]);
                }
                return { ok: true, rows: outRows };
            }

            for (var ri = 0; ri < dataRows.length; ri++) {
                var line = ri + 2;
                var cells = dataRows[ri];
                var rowMap = {};
                Object.keys(idx).forEach(function (k) {
                    rowMap[k] = cells[idx[k]] != null ? cells[idx[k]] : '';
                });

                var kindCell = hasKind ? String(rowMap.kind != null ? rowMap.kind : '').trim() : '';
                var codeCell = String(rowMap.code != null ? rowMap.code : '').trim();
                var buildingCell = String(rowMap.building != null ? rowMap.building : '').trim();
                var projectCell = String(rowMap.project != null ? rowMap.project : '').trim();

                var rowNonEmpty = cells.some(function (cl) {
                    return String(cl).trim() !== '';
                });
                if (!rowNonEmpty) continue;

                var noteSkip = String(cells[0] != null ? cells[0] : '').trim();
                if (noteSkip.indexOf('※') === 0 || noteSkip.indexOf('#') === 0) continue;

                if (!hasKind) {
                    // 구 양식(프로젝트 1행) 호환
                    if (!codeCell && !buildingCell && !projectCell) {
                        previews.push({ line: line, codeDisp: '-', building: '-', err: '코드 또는 건물명/공사명 중 하나는 필요합니다.' });
                        continue;
                    }

                    var base;
                    if (codeCell) {
                        if (usedCodes[codeCell]) {
                            previews.push({ line: line, codeDisp: codeCell, building: buildingCell || '-', err: 'CSV 안에서 코드가 중복되었습니다.' });
                            continue;
                        }
                        usedCodes[codeCell] = true;
                        var existing = estimates.find(function (e) { return String(e.code || '').trim() === codeCell; });
                        base = existing ? JSON.parse(JSON.stringify(existing)) : defaultEstimateShellForImport(codeCell, line);
                    } else {
                        base = defaultEstimateShellForImport('', line);
                        usedCodes[String(base.code)] = true;
                    }

                    var rowErr = applyEstimateCsvRowToItem(base, rowMap);
                    if (rowErr) {
                        previews.push({ line: line, codeDisp: base.code || '-', building: (base.building || buildingCell || '-').slice(0, 40), err: rowErr });
                        continue;
                    }

                    applyEstimateDefaultsAndSeed([base]);
                    seedEstimateAggregates(base);
                    var defaultDate = base.date || new Date().toISOString().slice(0, 10);
                    var defaultName = String(base.contractor || base.project || '-');

                    var salesPacked = parsePackedRows(rowMap.salesRows, defaultDate, defaultName, 'CSV');
                    if (!salesPacked.ok) {
                        previews.push({ line: line, codeDisp: base.code || '-', building: (base.building || buildingCell || '-').slice(0, 40), err: salesPacked.err });
                        continue;
                    }
                    var payPacked = parsePackedRows(rowMap.paymentRows, defaultDate, defaultName, 'CSV');
                    if (!payPacked.ok) {
                        previews.push({ line: line, codeDisp: base.code || '-', building: (base.building || buildingCell || '-').slice(0, 40), err: payPacked.err });
                        continue;
                    }
                    var purchasePacked = parsePackedRows(rowMap.purchaseRows, defaultDate, defaultName, 'CSV');
                    if (!purchasePacked.ok) {
                        previews.push({ line: line, codeDisp: base.code || '-', building: (base.building || buildingCell || '-').slice(0, 40), err: purchasePacked.err });
                        continue;
                    }
                    var transferPacked = parsePackedRows(rowMap.transferRows, defaultDate, defaultName, 'CSV');
                    if (!transferPacked.ok) {
                        previews.push({ line: line, codeDisp: base.code || '-', building: (base.building || buildingCell || '-').slice(0, 40), err: transferPacked.err });
                        continue;
                    }

                    if (salesPacked.rows.length) {
                        base.salesRows = salesPacked.rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4], base.taxIssued ? '발행' : '미발행', '-', r[5], null]; });
                    }
                    if (payPacked.rows.length) {
                        base.paymentRows = payPacked.rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4], r[5], null]; });
                    }
                    if (purchasePacked.rows.length) {
                        base.purchaseRows = purchasePacked.rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4], '미발행', '-', r[5], null]; });
                    }
                    if (transferPacked.rows.length) {
                        base.transferRows = transferPacked.rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4], r[5], null]; });
                    }
                    if (!salesPacked.rows.length && !payPacked.rows.length && !purchasePacked.rows.length && !transferPacked.rows.length) {
                        buildFinanceRowsFromSummary(base);
                    } else {
                        // 1행형 CSV에서 테이블행이 제공되면 집계값도 해당 행 합계로 즉시 동기화
                        var salesSum2 = (base.salesRows || []).reduce(function (a, v) { return a + (Number(v && v[4]) || 0); }, 0);
                        var paySum2 = (base.paymentRows || []).reduce(function (a, v) { return a + (Number(v && v[4]) || 0); }, 0);
                        var purSum2 = (base.purchaseRows || []).reduce(function (a, v) { return a + (Number(v && v[4]) || 0); }, 0);
                        var trSum2 = (base.transferRows || []).reduce(function (a, v) { return a + (Number(v && v[4]) || 0); }, 0);
                        if (!base.revenue && salesSum2) base.revenue = salesSum2;
                        if (!base.purchase && purSum2) base.purchase = purSum2;
                        base.aggregateSalesGross = salesSum2 || base.revenue || 0;
                        base.aggregatePaymentGross = paySum2;
                        base.aggregatePurchaseGross = purSum2 || base.purchase || 0;
                        base.aggregateTransferGross = trSum2;
                        if (base.revenue > 0) {
                            if (paySum2 <= 0) base.paidStatus = '미수';
                            else if (paySum2 >= base.revenue) base.paidStatus = '전액';
                            else base.paidStatus = '부분';
                        }
                    }

                    previews.push({ line: line, codeDisp: base.code, building: (base.building || '-').slice(0, 40), err: '' });
                    pendingItems.push(base);
                    continue;
                }

                // 신 양식: 한 파일에 프로젝트/매출/수금/매입/이체 행 혼합
                if (!codeCell) {
                    previews.push({ line: line, codeDisp: '-', building: '-', err: '구분이 있는 행은 코드(code)가 필수입니다.' });
                    continue;
                }
                const base2 = getOrCreateByCode(codeCell, line);
                if (!base2) {
                    previews.push({ line: line, codeDisp: codeCell || '-', building: '-', err: '코드를 찾을 수 없습니다.' });
                    continue;
                }

                const k = kindCell.replace(/\s/g, '').toLowerCase();
                const kind =
                    (k === '프로젝트' || k === 'project' || k === 'estimate') ? 'project'
                    : (k === '매출' || k === 'sales') ? 'sales'
                    : (k === '수금' || k === 'payment') ? 'payment'
                    : (k === '매입' || k === 'purchase') ? 'purchase'
                    : (k === '이체' || k === 'transfer') ? 'transfer'
                    : '';
                if (!kind) {
                    previews.push({ line: line, codeDisp: base2.code, building: (base2.building || '-').slice(0, 40), err: '구분(kind)은 프로젝트/매출/수금/매입/이체 중 하나여야 합니다.' });
                    continue;
                }

                if (kind === 'project') {
                    var perr = applyEstimateCsvRowToItem(base2, rowMap);
                    if (perr) {
                        previews.push({ line: line, codeDisp: base2.code, building: (base2.building || '-').slice(0, 40), err: perr });
                        continue;
                    }
                    seedEstimateAggregates(base2);
                    previews.push({ line: line, codeDisp: base2.code, building: (base2.building || '-').slice(0, 40), err: '' });
                    continue;
                }

                const dt = String(rowMap.rowDate != null ? rowMap.rowDate : '').trim();
                if (dt && !/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
                    previews.push({ line: line, codeDisp: base2.code, building: (base2.building || '-').slice(0, 40), err: '일자(rowDate)는 YYYY-MM-DD 형식이어야 합니다.' });
                    continue;
                }
                const nm = String(rowMap.rowName != null ? rowMap.rowName : '').trim() || String(base2.contractor || base2.project || '-');
                const memo = String(rowMap.rowMemo != null ? rowMap.rowMemo : '').trim();

                const amt = parseFinanceRowAmounts(rowMap);
                if (!amt.ok) {
                    previews.push({ line: line, codeDisp: base2.code, building: (base2.building || '-').slice(0, 40), err: amt.err });
                    continue;
                }

                if (kind === 'sales') {
                    var taxTxt = String(rowMap.taxIssued != null ? rowMap.taxIssued : '').trim();
                    if (taxTxt === '발행완료') taxTxt = '발행';
                    if (taxTxt === '') taxTxt = '미발행';
                    if (!Array.isArray(base2.salesRows)) base2.salesRows = [];
                    base2.salesRows.push([dt || (base2.date || new Date().toISOString().slice(0, 10)), nm, amt.net, amt.tax, amt.gross, (taxTxt === '발행' ? '발행' : '미발행'), '-', memo || 'CSV', null]);
                } else if (kind === 'payment') {
                    if (!Array.isArray(base2.paymentRows)) base2.paymentRows = [];
                    base2.paymentRows.push([dt || (base2.date || new Date().toISOString().slice(0, 10)), nm, amt.net, amt.tax, amt.gross, memo || 'CSV', null]);
                } else if (kind === 'purchase') {
                    var taxTxt2 = String(rowMap.taxIssued != null ? rowMap.taxIssued : '').trim();
                    if (taxTxt2 === '발행완료') taxTxt2 = '발행';
                    if (taxTxt2 === '') taxTxt2 = '미발행';
                    if (!Array.isArray(base2.purchaseRows)) base2.purchaseRows = [];
                    base2.purchaseRows.push([dt || (base2.date || new Date().toISOString().slice(0, 10)), nm, amt.net, amt.tax, amt.gross, (taxTxt2 === '발행' ? '발행' : '미발행'), '-', memo || 'CSV', null]);
                } else if (kind === 'transfer') {
                    if (!Array.isArray(base2.transferRows)) base2.transferRows = [];
                    base2.transferRows.push([dt || (base2.date || new Date().toISOString().slice(0, 10)), nm, amt.net, amt.tax, amt.gross, memo || 'CSV', null]);
                }

                previews.push({ line: line, codeDisp: base2.code, building: (base2.building || '-').slice(0, 40), err: '' });
            }

            if (hasKind) {
                const codes = Object.keys(itemByCode);
                codes.forEach(function (c) {
                    const it = itemByCode[c];
                    // 요약 값이 비어있으면 행 합계로 채움
                    const salesSum = (it.salesRows || []).reduce(function (a, v) { return a + (Number(v && v[4]) || 0); }, 0);
                    const paySum = (it.paymentRows || []).reduce(function (a, v) { return a + (Number(v && v[4]) || 0); }, 0);
                    const purSum = (it.purchaseRows || []).reduce(function (a, v) { return a + (Number(v && v[4]) || 0); }, 0);
                    const trSum = (it.transferRows || []).reduce(function (a, v) { return a + (Number(v && v[4]) || 0); }, 0);
                    if (!it.revenue && salesSum) it.revenue = salesSum;
                    if (!it.purchase && purSum) it.purchase = purSum;
                    it.aggregateSalesGross = salesSum || it.revenue || 0;
                    it.aggregatePaymentGross = paySum;
                    it.aggregatePurchaseGross = purSum || it.purchase || 0;
                    it.aggregateTransferGross = trSum;
                    if (it.revenue > 0) {
                        if (paySum <= 0) it.paidStatus = '미수';
                        else if (paySum >= it.revenue) it.paidStatus = '전액';
                        else it.paidStatus = '부분';
                    }
                    if ((it.salesRows || []).some(function (r) { return String(r && r[5] || '') === '발행'; })) it.taxIssued = true;
                    applyEstimateDefaultsAndSeed([it]);
                    seedEstimateAggregates(it);
                    pendingItems.push(it);
                });
            }

            if (!pendingItems.length) return { ok: false, error: '반영할 유효 행이 없습니다.' };
            var hasErrors = previews.some(function (p) {
                return p.err;
            });
            if (hasErrors) {
                return { ok: true, previews: previews, pendingItems: null, hasErrors: true };
            }
            return { ok: true, previews: previews, pendingItems: pendingItems, hasErrors: false };
        }

        function openEstimateImportModalWithResult(res) {
            var body = document.getElementById('estimateImportModalBody');
            var modal = document.getElementById('estimateImportModal');
            if (!body || !modal) return;

            window.__estimateImportPending = res.hasErrors ? null : res.pendingItems;

            var summary =
                '<div class="contractor-import-modal-summary">' +
                (res.hasErrors
                    ? '<strong>오류가 있는 행을 수정한 뒤 다시 업로드해 주세요.</strong> (저장 버튼은 비활성화)'
                    : '<strong>' +
                      res.pendingItems.length +
                      '건</strong>을 서버에 반영합니다. 기존 코드는 덮어쓰고, 없는 코드는 신규로 저장합니다.') +
                '</div>';

            var table =
                '<div class="table-section"><table><thead><tr><th>CSV행</th><th>코드</th><th>건물명</th><th>결과</th></tr></thead><tbody>';
            for (var pi = 0; pi < res.previews.length; pi++) {
                var p = res.previews[pi];
                table +=
                    '<tr><td>' +
                    p.line +
                    '</td><td>' +
                    escapeHtml(String(p.codeDisp || '')) +
                    '</td><td>' +
                    escapeHtml(String(p.building || '')) +
                    '</td><td class="' +
                    (p.err ? 'contractor-import-row-err' : '') +
                    '">' +
                    escapeHtml(p.err || 'OK') +
                    '</td></tr>';
            }
            table += '</tbody></table></div>';

            var actions =
                '<div class="contractor-import-modal-actions">' +
                '<button type="button" class="btn btn-secondary" onclick="closeEstimateImportModal()">닫기</button>' +
                '<button type="button" class="btn btn-primary" id="estimateImportConfirmBtn" onclick="confirmEstimateImport()" ' +
                (res.hasErrors ? 'disabled' : '') +
                '>서버에 반영</button></div>';

            body.innerHTML = summary + table + actions;
            modal.classList.add('active');
        }

        function closeEstimateImportModal() {
            var modal = document.getElementById('estimateImportModal');
            if (modal) modal.classList.remove('active');
            window.__estimateImportPending = null;
        }

        function confirmEstimateImport() {
            var pending = window.__estimateImportPending;
            if (!pending || !pending.length) return;
            var i = 0;
            function step() {
                if (i >= pending.length) {
                    syncEstimatesFromServer().then(function () {
                        alert(pending.length + '건 반영했습니다.');
                        closeEstimateImportModal();
                    });
                    return;
                }
                var item = pending[i];
                upsertEstimateToServer(item).then(function (r) {
                    if (!r.ok) {
                        alert(
                            '저장 실패 (목록 ' +
                                (i + 1) +
                                '번째 / 코드 ' +
                                item.code +
                                '): ' +
                                (r.error || '')
                        );
                        syncEstimatesFromServer();
                        closeEstimateImportModal();
                        return;
                    }
                    i++;
                    step();
                });
            }
            step();
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

        function downloadExpenseImportTemplate() {
            let csv = '\uFEFF';
            csv +=
                'id,type,date,building,purpose,amount,hasReceipt\n' +
                ',카드사용,2026-01-15,본관,사무용품,35000,false\n';
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '경비지출_업로드양식.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        var EXPENSE_IMPORT_MAX_ROWS = 500;
        var EXPENSE_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

        function normalizeExpenseImportHeaderKey(h) {
            var s = String(h || '')
                .trim()
                .toLowerCase()
                .replace(/\s/g, '');
            var map = {
                id: 'id',
                type: 'type',
                구분: 'type',
                date: 'date',
                사용일시: 'date',
                building: 'building',
                사용건물: 'building',
                purpose: 'purpose',
                사용목적: 'purpose',
                amount: 'amount',
                결제금액: 'amount',
                금액: 'amount',
                hasreceipt: 'hasReceipt',
                영수증: 'hasReceipt',
                사진: 'hasReceipt',
            };
            return map[s] || s;
        }

        function parseExpenseImportType(raw) {
            var t = String(raw == null ? '' : raw).trim();
            if (!t) return null;
            var lower = t.toLowerCase();
            if (t === '계좌이체' || lower === 'transfer' || lower === 'account' || t === '이체') {
                return '계좌이체';
            }
            if (t === '카드사용' || lower === 'card' || t === '카드') {
                return '카드사용';
            }
            return null;
        }

        function buildExpenseItemForImport(rowMap, prev, explicitId) {
            var type = parseExpenseImportType(rowMap.type);
            if (!type) {
                return { error: '구분(type)은 카드사용 또는 계좌이체여야 합니다.' };
            }
            var dateRaw = String(rowMap.date == null ? '' : rowMap.date).trim();
            if (!dateRaw || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
                return { error: '사용일시(date)는 YYYY-MM-DD 형식이어야 합니다.' };
            }
            var amountStr = String(rowMap.amount != null ? rowMap.amount : '')
                .trim()
                .replace(/,/g, '');
            var amount = Number(amountStr);
            if (!Number.isFinite(amount) || amount <= 0) {
                return { error: '결제금액(amount)은 0보다 큰 숫자여야 합니다.' };
            }
            var building = String(rowMap.building == null ? '' : rowMap.building).trim();
            var purpose = String(rowMap.purpose == null ? '' : rowMap.purpose).trim();
            var hasR = parseContractorImportBool(
                rowMap.hasReceipt != null && rowMap.hasReceipt !== '' ? rowMap.hasReceipt : ''
            );
            if (hasR === null) {
                return { error: '영수증(hasReceipt)은 true/false, 있음/없음 형식이어야 합니다.' };
            }
            var receipts = [];
            if (hasR && prev && getExpenseReceipts(prev).length) {
                getExpenseReceipts(prev).forEach(function (r) {
                    receipts.push({ dataUrl: r.dataUrl, name: r.name || '영수증' });
                });
            }
            var o = {
                id: explicitId,
                type: type,
                date: dateRaw,
                building: building,
                purpose: purpose,
                amount: Math.round(amount),
                receipts: receipts,
            };
            return { item: o };
        }

        function openExpenseCsvImportPicker() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                alert('세션을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 로그인해 주세요.');
                return;
            }
            var inp = document.getElementById('expenseCsvImportInput');
            if (!inp) return;
            inp.value = '';
            inp.click();
        }

        function onExpenseCsvImportFileChange(ev) {
            var input = ev && ev.target;
            var file = input && input.files && input.files[0];
            if (!file) return;
            if (file.size > EXPENSE_IMPORT_MAX_BYTES) {
                alert('파일이 너무 큽니다. (최대 약 2MB)');
                input.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                var text = String(reader.result || '');
                var res = parseAndValidateExpenseImportCsv(text);
                input.value = '';
                if (!res.ok) {
                    alert(res.error || 'CSV를 읽을 수 없습니다.');
                    return;
                }
                openExpenseImportModalWithResult(res);
            };
            reader.onerror = function () {
                alert('파일을 읽지 못했습니다.');
                input.value = '';
            };
            reader.readAsText(file, 'UTF-8');
        }

        function parseAndValidateExpenseImportCsv(text) {
            var rows = parseContractorCsvTextToRows(text);
            if (!rows.length) {
                return { ok: false, error: '데이터 행이 없습니다.' };
            }
            var headerCells = rows[0].map(function (h) {
                return normalizeExpenseImportHeaderKey(h);
            });
            var idx = {};
            for (var hi = 0; hi < headerCells.length; hi++) {
                var key = headerCells[hi];
                if (key && idx[key] === undefined) idx[key] = hi;
            }
            if (idx.type === undefined) {
                return { ok: false, error: 'CSV에 type(구분) 열이 필요합니다.' };
            }
            if (idx.date === undefined) {
                return { ok: false, error: 'CSV에 date(사용일시) 열이 필요합니다.' };
            }
            if (idx.amount === undefined) {
                return { ok: false, error: 'CSV에 amount(결제금액) 열이 필요합니다.' };
            }

            var dataRows = rows.slice(1);
            if (dataRows.length > EXPENSE_IMPORT_MAX_ROWS) {
                return {
                    ok: false,
                    error: '한 번에 최대 ' + EXPENSE_IMPORT_MAX_ROWS + '행까지만 업로드할 수 있습니다.',
                };
            }

            var usedExplicitIds = {};
            var previews = [];
            var pendingItems = [];
            var maxExisting =
                expenses.length > 0
                    ? Math.max.apply(
                          null,
                          expenses.map(function (e) {
                              return Number(e.id) || 0;
                          })
                      )
                    : 0;
            var autoCursor = maxExisting;

            for (var ri = 0; ri < dataRows.length; ri++) {
                var line = ri + 2;
                var cells = dataRows[ri];
                var rowMap = {};
                Object.keys(idx).forEach(function (k) {
                    rowMap[k] = cells[idx[k]] != null ? cells[idx[k]] : '';
                });

                var idCell = String(rowMap.id != null ? rowMap.id : '').trim();
                var explicitId = null;
                if (idCell !== '') {
                    explicitId = Number(idCell);
                    if (!Number.isFinite(explicitId)) {
                        previews.push({
                            line: line,
                            name: parseExpenseImportType(rowMap.type) || '-',
                            idDisp: idCell,
                            err: 'id는 숫자여야 합니다.',
                        });
                        continue;
                    }
                    if (usedExplicitIds[explicitId]) {
                        previews.push({
                            line: line,
                            name: String(rowMap.type || '').trim() || '-',
                            idDisp: String(explicitId),
                            err: 'CSV 안에서 id가 중복되었습니다.',
                        });
                        continue;
                    }
                    usedExplicitIds[explicitId] = true;
                } else {
                    do {
                        autoCursor++;
                    } while (usedExplicitIds[autoCursor]);
                    explicitId = autoCursor;
                    usedExplicitIds[explicitId] = true;
                }

                var prev = expenses.find(function (e) {
                    return Number(e.id) === explicitId;
                });
                var built = buildExpenseItemForImport(rowMap, prev, explicitId);
                if (built.error) {
                    previews.push({
                        line: line,
                        name: String(rowMap.type || '').trim() || '-',
                        idDisp: String(explicitId),
                        err: built.error,
                    });
                    continue;
                }
                previews.push({
                    line: line,
                    name: built.item.type + ' ' + built.item.date + ' ' + built.item.amount + '원',
                    idDisp: String(explicitId),
                    err: '',
                    mode: prev ? '수정' : '신규',
                });
                pendingItems.push(built.item);
            }

            var errs = previews.filter(function (p) {
                return p.err;
            });
            if (errs.length) {
                return { ok: true, previews: previews, pendingItems: null, hasErrors: true };
            }
            if (!pendingItems.length) {
                return { ok: false, error: '반영할 유효 행이 없습니다.' };
            }
            return { ok: true, previews: previews, pendingItems: pendingItems, hasErrors: false };
        }

        function openExpenseImportModalWithResult(res) {
            var body = document.getElementById('expenseImportModalBody');
            var modal = document.getElementById('expenseImportModal');
            if (!body || !modal) return;

            window.__expenseImportPending = res.hasErrors ? null : res.pendingItems;

            var summary =
                '<div class="expense-import-modal-summary">' +
                (res.hasErrors
                    ? '<strong>오류가 있는 행을 수정한 뒤 다시 업로드해 주세요.</strong> (저장 버튼은 비활성화)'
                    : '<strong>' +
                      res.pendingItems.length +
                      '건</strong>을 서버에 반영합니다. 기존 id는 수정, 빈 id는 신규 번호가 부여됩니다.') +
                '</div>';

            var table =
                '<div class="table-section"><table><thead><tr><th>CSV행</th><th>id</th><th>내용요약</th><th>구분</th><th>결과</th></tr></thead><tbody>';
            for (var pi = 0; pi < res.previews.length; pi++) {
                var p = res.previews[pi];
                table +=
                    '<tr><td>' +
                    p.line +
                    '</td><td>' +
                    escapeHtml(p.idDisp) +
                    '</td><td>' +
                    escapeHtml(p.name) +
                    '</td><td>' +
                    escapeHtml(p.mode || '-') +
                    '</td><td class="' +
                    (p.err ? 'expense-import-row-err' : '') +
                    '">' +
                    escapeHtml(p.err || 'OK') +
                    '</td></tr>';
            }
            table += '</tbody></table></div>';

            var actions =
                '<div class="expense-import-modal-actions">' +
                '<button type="button" class="btn btn-secondary" onclick="closeExpenseImportModal()">닫기</button>' +
                '<button type="button" class="btn btn-primary" id="expenseImportConfirmBtn" onclick="confirmExpenseImport()" ' +
                (res.hasErrors ? 'disabled' : '') +
                '>서버에 반영</button></div>';

            body.innerHTML = summary + table + actions;
            modal.classList.add('active');
        }

        function closeExpenseImportModal() {
            var modal = document.getElementById('expenseImportModal');
            if (modal) modal.classList.remove('active');
            window.__expenseImportPending = null;
        }

        function confirmExpenseImport() {
            var pending = window.__expenseImportPending;
            if (!pending || !pending.length) return;
            var i = 0;
            function step() {
                if (i >= pending.length) {
                    var selMonth = document.getElementById('expenseMonthFilter');
                    if (selMonth) selMonth.value = '';
                    syncExpensesFromServer().then(function () {
                        alert(pending.length + '건 반영했습니다. 월 필터는 「전체」로 바꿔 두었습니다.');
                        closeExpenseImportModal();
                    });
                    return;
                }
                var item = pending[i];
                upsertExpenseToServer(item).then(function (r) {
                    if (!r.ok) {
                        alert(
                            '저장 실패 (목록 ' +
                                (i + 1) +
                '번째 / id ' +
                                item.id +
                                '): ' +
                                (r.error || '')
                        );
                        syncExpensesFromServer();
                        closeExpenseImportModal();
                        return;
                    }
                    i++;
                    step();
                });
            }
            step();
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

        function downloadSgaImportTemplate() {
            let csv = '\uFEFF';
            csv +=
                'id,date,category,amount,memo\n' +
                ',2026-01-20,복리후생비,120000,점심\n';
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '판관비_업로드양식.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        var SGA_IMPORT_MAX_ROWS = 500;
        var SGA_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

        function normalizeSgaImportHeaderKey(h) {
            var s = String(h || '')
                .trim()
                .toLowerCase()
                .replace(/\s/g, '');
            var map = {
                id: 'id',
                date: 'date',
                지출일자: 'date',
                category: 'category',
                계정과목: 'category',
                amount: 'amount',
                금액: 'amount',
                '금액(vat별도)': 'amount',
                memo: 'memo',
                메모: 'memo',
            };
            return map[s] || s;
        }

        function buildSgaItemForImport(rowMap, prev, explicitId) {
            var dateRaw = String(rowMap.date == null ? '' : rowMap.date).trim();
            if (!dateRaw || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
                return { error: '지출일자(date)는 YYYY-MM-DD 형식이어야 합니다.' };
            }
            var category = String(rowMap.category == null ? '' : rowMap.category).trim();
            if (!category) {
                return { error: '계정과목(category)은 필수입니다.' };
            }
            var amountStr = String(rowMap.amount != null ? rowMap.amount : '')
                .trim()
                .replace(/,/g, '');
            var amount = Number(amountStr);
            if (!Number.isFinite(amount) || amount <= 0) {
                return { error: '금액(amount)은 0보다 큰 숫자여야 합니다.' };
            }
            var memo = String(rowMap.memo == null ? '' : rowMap.memo).trim();
            return {
                item: {
                    id: explicitId,
                    date: dateRaw,
                    category: category,
                    amount: Math.round(amount),
                    memo: memo,
                },
            };
        }

        function openSgaCsvImportPicker() {
            if (!window.__bpsSupabase || !window.__bpsSupabase.auth) {
                alert('세션을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 로그인해 주세요.');
                return;
            }
            var inp = document.getElementById('sgaCsvImportInput');
            if (!inp) return;
            inp.value = '';
            inp.click();
        }

        function onSgaCsvImportFileChange(ev) {
            var input = ev && ev.target;
            var file = input && input.files && input.files[0];
            if (!file) return;
            if (file.size > SGA_IMPORT_MAX_BYTES) {
                alert('파일이 너무 큽니다. (최대 약 2MB)');
                input.value = '';
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                var text = String(reader.result || '');
                var res = parseAndValidateSgaImportCsv(text);
                input.value = '';
                if (!res.ok) {
                    alert(res.error || 'CSV를 읽을 수 없습니다.');
                    return;
                }
                openSgaImportModalWithResult(res);
            };
            reader.onerror = function () {
                alert('파일을 읽지 못했습니다.');
                input.value = '';
            };
            reader.readAsText(file, 'UTF-8');
        }

        function parseAndValidateSgaImportCsv(text) {
            var rows = parseContractorCsvTextToRows(text);
            if (!rows.length) {
                return { ok: false, error: '데이터 행이 없습니다.' };
            }
            var headerCells = rows[0].map(function (h) {
                return normalizeSgaImportHeaderKey(h);
            });
            var idx = {};
            for (var hi = 0; hi < headerCells.length; hi++) {
                var key = headerCells[hi];
                if (key && idx[key] === undefined) idx[key] = hi;
            }
            if (idx.date === undefined) {
                return { ok: false, error: 'CSV에 date(지출일자) 열이 필요합니다.' };
            }
            if (idx.category === undefined) {
                return { ok: false, error: 'CSV에 category(계정과목) 열이 필요합니다.' };
            }
            if (idx.amount === undefined) {
                return { ok: false, error: 'CSV에 amount(금액) 열이 필요합니다.' };
            }

            var dataRows = rows.slice(1);
            if (dataRows.length > SGA_IMPORT_MAX_ROWS) {
                return {
                    ok: false,
                    error: '한 번에 최대 ' + SGA_IMPORT_MAX_ROWS + '행까지만 업로드할 수 있습니다.',
                };
            }

            var usedExplicitIds = {};
            var previews = [];
            var pendingItems = [];
            var maxExisting =
                sgaExpenses.length > 0
                    ? Math.max.apply(
                          null,
                          sgaExpenses.map(function (e) {
                              return Number(e.id) || 0;
                          })
                      )
                    : 0;
            var autoCursor = maxExisting;

            for (var ri = 0; ri < dataRows.length; ri++) {
                var line = ri + 2;
                var cells = dataRows[ri];
                var rowMap = {};
                Object.keys(idx).forEach(function (k) {
                    rowMap[k] = cells[idx[k]] != null ? cells[idx[k]] : '';
                });

                var idCell = String(rowMap.id != null ? rowMap.id : '').trim();
                var explicitId = null;
                if (idCell !== '') {
                    explicitId = Number(idCell);
                    if (!Number.isFinite(explicitId)) {
                        previews.push({
                            line: line,
                            name: String(rowMap.category || '').trim() || '-',
                            idDisp: idCell,
                            err: 'id는 숫자여야 합니다.',
                        });
                        continue;
                    }
                    if (usedExplicitIds[explicitId]) {
                        previews.push({
                            line: line,
                            name: String(rowMap.category || '').trim() || '-',
                            idDisp: String(explicitId),
                            err: 'CSV 안에서 id가 중복되었습니다.',
                        });
                        continue;
                    }
                    usedExplicitIds[explicitId] = true;
                } else {
                    do {
                        autoCursor++;
                    } while (usedExplicitIds[autoCursor]);
                    explicitId = autoCursor;
                    usedExplicitIds[explicitId] = true;
                }

                var prev = sgaExpenses.find(function (e) {
                    return Number(e.id) === explicitId;
                });
                var built = buildSgaItemForImport(rowMap, prev, explicitId);
                if (built.error) {
                    previews.push({
                        line: line,
                        name: String(rowMap.category || '').trim() || '-',
                        idDisp: String(explicitId),
                        err: built.error,
                    });
                    continue;
                }
                var it = built.item;
                previews.push({
                    line: line,
                    name: it.category + ' / ' + it.date + ' / ' + it.amount + '원',
                    idDisp: String(explicitId),
                    err: '',
                    mode: prev ? '수정' : '신규',
                });
                pendingItems.push(it);
            }

            var errs = previews.filter(function (p) {
                return p.err;
            });
            if (errs.length) {
                return { ok: true, previews: previews, pendingItems: null, hasErrors: true };
            }
            if (!pendingItems.length) {
                return { ok: false, error: '반영할 유효 행이 없습니다.' };
            }
            return { ok: true, previews: previews, pendingItems: pendingItems, hasErrors: false };
        }

        function openSgaImportModalWithResult(res) {
            var body = document.getElementById('sgaImportModalBody');
            var modal = document.getElementById('sgaImportModal');
            if (!body || !modal) return;

            window.__sgaImportPending = res.hasErrors ? null : res.pendingItems;

            var summary =
                '<div class="sga-import-modal-summary">' +
                (res.hasErrors
                    ? '<strong>오류가 있는 행을 수정한 뒤 다시 업로드해 주세요.</strong> (저장 버튼은 비활성화)'
                    : '<strong>' +
                      res.pendingItems.length +
                      '건</strong>을 서버에 반영합니다. 기존 id는 수정, 빈 id는 신규 번호가 부여됩니다.') +
                '</div>';

            var table =
                '<div class="table-section"><table><thead><tr><th>CSV행</th><th>id</th><th>내용요약</th><th>구분</th><th>결과</th></tr></thead><tbody>';
            for (var pi = 0; pi < res.previews.length; pi++) {
                var p = res.previews[pi];
                table +=
                    '<tr><td>' +
                    p.line +
                    '</td><td>' +
                    escapeHtml(p.idDisp) +
                    '</td><td>' +
                    escapeHtml(p.name) +
                    '</td><td>' +
                    escapeHtml(p.mode || '-') +
                    '</td><td class="' +
                    (p.err ? 'sga-import-row-err' : '') +
                    '">' +
                    escapeHtml(p.err || 'OK') +
                    '</td></tr>';
            }
            table += '</tbody></table></div>';

            var actions =
                '<div class="sga-import-modal-actions">' +
                '<button type="button" class="btn btn-secondary" onclick="closeSgaImportModal()">닫기</button>' +
                '<button type="button" class="btn btn-primary" id="sgaImportConfirmBtn" onclick="confirmSgaImport()" ' +
                (res.hasErrors ? 'disabled' : '') +
                '>서버에 반영</button></div>';

            body.innerHTML = summary + table + actions;
            modal.classList.add('active');
        }

        function closeSgaImportModal() {
            var modal = document.getElementById('sgaImportModal');
            if (modal) modal.classList.remove('active');
            window.__sgaImportPending = null;
        }

        function confirmSgaImport() {
            var pending = window.__sgaImportPending;
            if (!pending || !pending.length) return;
            var i = 0;
            function step() {
                if (i >= pending.length) {
                    var selMonth = document.getElementById('sgaMonthFilter');
                    if (selMonth) selMonth.value = '';
                    syncSgaFromServer().then(function () {
                        alert(pending.length + '건 반영했습니다. 월 필터는 「전체」로 맞춰 두었습니다.');
                        closeSgaImportModal();
                    });
                    return;
                }
                var item = pending[i];
                upsertSgaToServer(item).then(function (r) {
                    if (!r.ok) {
                        alert(
                            '저장 실패 (목록 ' +
                                (i + 1) +
                                '번째 / id ' +
                                item.id +
                                '): ' +
                                (r.error || '')
                        );
                        syncSgaFromServer();
                        closeSgaImportModal();
                        return;
                    }
                    i++;
                    step();
                });
            }
            step();
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
            const raw = (item.salesDates && item.salesDates.length) ? item.salesDates : [];
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
            if (!dates.length) return false;

            if (performancePeriodMode === 'all') {
                return true;
            }
            if (performancePeriodMode === 'month') {
                const inp = document.getElementById('performanceFilterMonth');
                const m = inp && inp.value ? inp.value.trim() : '';
                if (!/^\d{4}-\d{2}$/.test(m)) return true;
                return dates.some(function (d) { return d.slice(0, 7) === m; });
            }
            if (performancePeriodMode === 'range') {
                const fromEl = document.getElementById('performanceDateFrom');
                const toEl = document.getElementById('performanceDateTo');
                let from = fromEl && fromEl.value ? fromEl.value : '';
                let to = toEl && toEl.value ? toEl.value : '';
                if (!from || !to) return true;
                if (from > to) { const t = from; from = to; to = t; }
                return dates.some(function (d) { return d >= from && d <= to; });
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
            const toggleSgaOn = performanceSgaMode === 'include';
            const sgaInEffect = toggleSgaOn && performancePeriodMode !== 'range';
            const sgaData = sgaInEffect ? sgaExpenses.filter(sgaItemMatchesPerformancePeriod) : [];
            const totalSga = sgaData.reduce(function(sum, item) { return sum + (Number(item.amount) || 0); }, 0);

            const avgTotalsAll = getPerformanceAvgUnitTotals(data);

            // KPI 카드 업데이트
            const totalRevenue = data.reduce((sum, item) => sum + (item.revenue || 0), 0);
            const totalPurchase = data.reduce((sum, item) => sum + getItemPurchaseTotal(item), 0);
            const totalProfit = totalRevenue - totalPurchase - (sgaInEffect ? totalSga : 0);
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
            if (kpiSgaCard) kpiSgaCard.style.display = toggleSgaOn ? '' : 'none';
            if (kpiGrid) {
                kpiGrid.classList.toggle('kpi-grid--include-sga', toggleSgaOn);
                kpiGrid.classList.toggle('kpi-grid--exclude-sga', !toggleSgaOn);
            }
            const kpiProfitLabel = document.getElementById('kpiProfitLabel');
            const kpiMarginLabel = document.getElementById('kpiMarginLabel');
            if (kpiProfitLabel) kpiProfitLabel.textContent = sgaInEffect ? '순수익(판관비 포함)' : '순수익';
            if (kpiMarginLabel) kpiMarginLabel.textContent = sgaInEffect ? '수익률(판관비 포함)' : '수익률';
            const sgaHeader = document.getElementById('performanceSgaHeader');
            if (sgaHeader) sgaHeader.style.display = sgaInEffect ? '' : 'none';

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
                profit: stats.revenue - stats.purchase - (sgaInEffect ? stats.sga : 0),
                margin: stats.revenue > 0 ? ((stats.revenue - stats.purchase - (sgaInEffect ? stats.sga : 0)) / stats.revenue * 100) : 0,
                avgUnitRounded: stats.unitCount > 0 ? Math.round(stats.unitRevSum / stats.unitCount) : 0
            })).sort((a, b) => b.month.localeCompare(a.month));

            const monthlyBody = document.getElementById('performanceMonthlyTableBody');
            const perfMonthlyTable = document.querySelector('#perf-right-panel-monthly table');
            if (perfMonthlyTable) perfMonthlyTable.classList.toggle('perf-monthly--sga', sgaInEffect);
            if (monthlyBody) {
                if (monthlyData.length === 0) {
                    monthlyBody.innerHTML = '<tr><td colspan="' + (sgaInEffect ? 8 : 7) + '" style="text-align: center; padding: 40px; color: var(--gray-500);">데이터가 없습니다</td></tr>';
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
                            ${sgaInEffect ? `<td class="text-right">${(item.sga || 0).toLocaleString()}원</td>` : ''}
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
                            ${sgaInEffect ? `<td class="text-right">${(totals.sga || 0).toLocaleString()}원</td>` : ''}
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
            const sgaShareFactorOverall = sgaInEffect && totalRevenue > 0 ? totalSga / totalRevenue : 0;

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
                    const subAllocatedSga = sgaInEffect ? Math.round(subRev * sgaShareFactorOverall) : 0;
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
                    if (!sgaInEffect) return s.revenue - s.purchase;
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
                    const monthSga = sgaInEffect ? (monthlySgaMap[s.month] || 0) : 0;
                    const allocated = sgaInEffect && monthRowsRevenue > 0 ? Math.round((s.revenue / monthRowsRevenue) * monthSga) : 0;
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
                    const monthSga = sgaInEffect ? (monthlySgaMap[subMonthKey] || 0) : 0;
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

        function unpaidVatExclusiveFromGross(gross) {
            return Math.round((Number(gross) || 0) / 1.1);
        }

        function unpaidRoundedSalesGross(e) {
            return Math.round(Number(e.revenue) || 0);
        }

        function unpaidRoundedPaymentGross(e) {
            if (e.aggregatePaymentGross == null || e.aggregatePaymentGross === undefined) {
                seedEstimateAggregates(e);
            }
            return Math.round(Number(e.aggregatePaymentGross) || 0);
        }

        /** 매출일 있음 + VAT포함 매출·수금 원단위 불일치(1원 차이 포함) */
        function unpaidItemIsMismatch(e) {
            if (!getUnpaidSalesDisplayDate(e)) return false;
            return unpaidRoundedSalesGross(e) !== unpaidRoundedPaymentGross(e);
        }

        /** VAT포함 차이를 한 번에 별도로 환산(수금이 더 크면 음수·과수) */
        function unpaidBalanceNetFromItem(e) {
            const revG = unpaidRoundedSalesGross(e);
            const payG = unpaidRoundedPaymentGross(e);
            return Math.round((revG - payG) / 1.1);
        }

        function formatUnpaidSignedWon(amount) {
            const n = Math.round(Number(amount) || 0);
            if (n === 0) return '0원';
            return (n < 0 ? '\u2212' : '') + Math.abs(n).toLocaleString() + '원';
        }

        function getUnpaidSortedPool() {
            return estimates.filter(unpaidItemIsMismatch).sort(function (a, b) {
                const aSales = getUnpaidSalesDisplayDate(a);
                const bSales = getUnpaidSalesDisplayDate(b);
                if (aSales === bSales) return 0;
                return aSales < bSales ? 1 : -1;
            });
        }

        function unpaidFilterSelectFill(el, values, preferred) {
            if (!el) return '';
            const sorted = values.slice().sort(function (a, b) { return a.localeCompare(b, 'ko'); });
            let keep = preferred && sorted.indexOf(preferred) !== -1 ? preferred : '';
            el.innerHTML = '';
            const o0 = document.createElement('option');
            o0.value = '';
            o0.textContent = '전체';
            el.appendChild(o0);
            sorted.forEach(function (v) {
                const o = document.createElement('option');
                o.value = v;
                o.textContent = v;
                el.appendChild(o);
            });
            el.value = keep;
            return el.value;
        }

        function syncUnpaidFilterSelects(pool) {
            const el1 = document.getElementById('unpaidFilterCat1');
            const el2 = document.getElementById('unpaidFilterCat2');
            const el3 = document.getElementById('unpaidFilterCat3');
            if (!el1 || !el2 || !el3) return;

            const uniq = function (list, getCat) {
                return Array.from(new Set(list.map(function (x) {
                    const v = getCat(x);
                    return String(v == null ? '' : v).trim();
                }).filter(Boolean)));
            };

            const v1 = unpaidFilterSelectFill(el1, uniq(pool, function (e) { return e.category1; }), el1.value || '');
            const p1 = v1 ? pool.filter(function (e) { return String(e.category1 || '').trim() === v1; }) : pool;
            const v2 = unpaidFilterSelectFill(el2, uniq(p1, function (e) { return e.category2; }), el2.value || '');
            const p2 = v2 ? p1.filter(function (e) { return String(e.category2 || '').trim() === v2; }) : p1;
            unpaidFilterSelectFill(el3, uniq(p2, function (e) { return e.category3; }), el3.value || '');
        }

        function getUnpaidFilterTriple() {
            const el1 = document.getElementById('unpaidFilterCat1');
            const el2 = document.getElementById('unpaidFilterCat2');
            const el3 = document.getElementById('unpaidFilterCat3');
            return {
                cat1: el1 && el1.value ? String(el1.value).trim() : '',
                cat2: el2 && el2.value ? String(el2.value).trim() : '',
                cat3: el3 && el3.value ? String(el3.value).trim() : '',
            };
        }

        function filterUnpaidPool(pool, cat1, cat2, cat3) {
            return pool.filter(function (e) {
                if (cat1 && String(e.category1 || '').trim() !== cat1) return false;
                if (cat2 && String(e.category2 || '').trim() !== cat2) return false;
                if (cat3 && String(e.category3 || '').trim() !== cat3) return false;
                return true;
            });
        }

        function onUnpaidFilterChange() {
            renderUnpaidData();
        }

        function clearUnpaidFilters() {
            ['unpaidFilterCat1', 'unpaidFilterCat2', 'unpaidFilterCat3'].forEach(function (id) {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            renderUnpaidData();
        }

        function renderUnpaidData() {
            const pool = getUnpaidSortedPool();
            syncUnpaidFilterSelects(pool);
            const f = getUnpaidFilterTriple();
            const unpaidItems = filterUnpaidPool(pool, f.cat1, f.cat2, f.cat3);

            const totalBalanceNet = unpaidItems.reduce(function (sum, item) {
                return sum + unpaidBalanceNetFromItem(item);
            }, 0);

            const countEl = document.getElementById('unpaidCount');
            if (countEl) countEl.textContent = unpaidItems.length.toLocaleString() + '건';
            const totalEl = document.getElementById('totalUnpaid');
            if (totalEl) {
                totalEl.textContent =
                    formatUnpaidSignedWon(totalBalanceNet) +
                    (totalBalanceNet < 0 ? ' (과수)' : '');
                if (totalBalanceNet < 0) {
                    totalEl.style.color = 'var(--danger)';
                } else if (totalBalanceNet > 0) {
                    totalEl.style.color = 'var(--warning)';
                } else {
                    totalEl.style.color = 'var(--primary)';
                }
            }

            const tbody = document.getElementById('unpaidTableBody');
            if (!tbody) return;
            if (unpaidItems.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--gray-500);">미수금 내역이 없습니다</td></tr>';
            } else {
                tbody.innerHTML = unpaidItems.map(function (item, idx) {
                    const salesDate = getUnpaidSalesDisplayDate(item);
                    const revenueNet = unpaidVatExclusiveFromGross(item.revenue);
                    const paymentNet = unpaidVatExclusiveFromGross(unpaidRoundedPaymentGross(item));
                    const rowNum = idx + 1;
                    return `
                        <tr>
                            <td>${rowNum}</td>
                            <td>${item.building || ''}</td>
                            <td>${item.project || ''}</td>
                            <td>${salesDate}</td>
                            <td class="text-right">${revenueNet.toLocaleString()}원</td>
                            <td class="text-right">${paymentNet.toLocaleString()}원</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        function escapeCsvField(val) {
            const s = String(val == null ? '' : val);
            if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
            return s;
        }

        function downloadUnpaidCSV() {
            const pool = getUnpaidSortedPool();
            const f = getUnpaidFilterTriple();
            const rows = filterUnpaidPool(pool, f.cat1, f.cat2, f.cat3);
            let csv = '\uFEFF';
            csv += '순번,건물명,공사명,매출일자,매출금액_vat별도,수금금액_vat별도\n';
            rows.forEach(function (item, idx) {
                const salesDate = getUnpaidSalesDisplayDate(item);
                const revenueNet = unpaidVatExclusiveFromGross(item.revenue);
                const paymentNet = unpaidVatExclusiveFromGross(unpaidRoundedPaymentGross(item));
                const line = [
                    String(idx + 1),
                    escapeCsvField(item.building || ''),
                    escapeCsvField(item.project || ''),
                    escapeCsvField(salesDate),
                    String(revenueNet),
                    String(paymentNet),
                ].join(',');
                csv += line + '\n';
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '미수금_' + new Date().toISOString().slice(0, 10) + '.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
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
            const panelActions = document.getElementById('sharedPanelActions');
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
            const panelActions = document.getElementById('sharedPanelActions');
            const btnSave = document.getElementById('sharedPanelBtnSave');
            const btnCancel = document.getElementById('sharedPanelBtnCancel');
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
            const panelTitle = document.getElementById('sharedPanelTitle');
            const panelBody = document.getElementById('sharedPanelBody');
            const panelBottomSaveBar = document.getElementById('sharedPanelBottomBar');
            const overlay = document.getElementById('sharedPanelOverlay');
            const panel = document.getElementById('sharedCenterPanel');
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

            showToast('로그인이 필요합니다. Supabase 연동 후 이용해 주세요.');
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
        let basicInfoEditMode = false;
        let businessInfoEditMode = false;
        let activePanelTabId = 'basic';
        let panelBaselineSnapshot = '';
        let isPanelDirty = false;
        let isSavingChanges = false;
        let renderPanelContent = function () {};
        let recalcFinanceSummaries = function () {};
        let getProfitNetTotalsByCode = function () {
            return { salesNet: 0, purchaseNet: 0, businessGross: 0, profitNet: 0 };
        };

        function getPanelSnapshot() {
            const panelBody = document.getElementById('sharedPanelBody');
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
            const saveButtons = [document.getElementById('sharedPanelBtnBottomSave'), document.getElementById('sharedPanelBtnSave')];
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
            if (!event.target || !event.target.closest || !event.target.closest('#sharedPanelBody')) return;
            markPanelDirtyIfChanged();
        });
        document.addEventListener('change', (event) => {
            if (!event.target || !event.target.closest || !event.target.closest('#sharedPanelBody')) return;
            markPanelDirtyIfChanged();
        });

        // 프로젝트 상세 열기 (가운데 모달로 표시)
        function openPanel(code) {
            const item = findEstimateByCode(code);
            if (!item) return;

            currentEditItem = {...item};
            isEditMode = false;
            basicInfoEditMode = false;
            businessInfoEditMode = false;
            activePanelTabId = 'basic';

            renderPanelContent(item);

            document.getElementById('sharedCenterPanel').classList.add('project-detail-modal');
            document.getElementById('sharedPanelOverlay').classList.add('active');
            document.getElementById('sharedCenterPanel').classList.add('active');
        }

        (function initDashboardModule() {
            const d = createDashboard({
                getEstimates: function () { return estimates; },
                showPage: showPage,
                renderTable: renderTable,
                openPanel: openPanel
            });
            renderDashboard = d.renderDashboard;
            dashboardChangeMonth = d.dashboardChangeMonth;
            closeDashboardEventModal = d.closeDashboardEventModal;
            closeDashboardDayEventsModal = d.closeDashboardDayEventsModal;
            toggleDashboardTheme = d.toggleDashboardTheme;
        })();

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

        const estimateFinanceModal = createEstimateFinanceModal({
            splitNetTaxFromGross: splitNetTaxFromGross,
            migrateSalesRowValuesIfOld: migrateSalesRowValuesIfOld,
            normalizeSalesVatIncluded: normalizeSalesVatIncluded,
            migratePaymentRowValuesIfOld: migratePaymentRowValuesIfOld,
            normalizePaymentVatValues: normalizePaymentVatValues,
            applyEstimateDefaultsAndSeed: applyEstimateDefaultsAndSeed,
            buildFinanceRowsFromSummary: buildFinanceRowsFromSummary,
            recalcFinanceSummaries: function (code) { return recalcFinanceSummaries(code); },
            markPanelDirtyIfChanged: markPanelDirtyIfChanged,
            persistEstimateToServerByCode: persistEstimateToServerByCode,
            showToast: showToast,
        });
        const {
            paymentRowMenuHtml,
            togglePaymentRowInline,
            closePaymentRowInlines,
            onFinanceRowClick,
            renderFinanceRow,
            renderFinanceTablesFromItem,
            openFinanceRowModal,
            closeFinanceRowModal,
            saveFinanceRowModal,
            confirmDeleteFinanceRow,
            applySameFromSourceToFinanceModal,
            closeSalesSamePickerModal,
            applySelectedSalesSame,
            addPaymentRow,
            addSalesRow,
            addPurchaseRow,
            addTransferRow,
        } = estimateFinanceModal;
        estimateFinanceModal.initPaymentRowMenuListeners();

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

            const index = findEstimateIndexByCode(currentEditItem.code);
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

            const index = findEstimateIndexByCode(currentEditItem.code);
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
            const originalItem = findEstimateByCode(currentEditItem.code);
            if (originalItem) {
                currentEditItem = {...originalItem};
                renderPanelContent(currentEditItem);
            }
        }

        // 저장
        async function saveChanges() {
            return saveEstimateChanges({
                getIsSavingChanges: function () { return isSavingChanges; },
                setSaveLoading: setSaveLoading,
                getIsNewEstimate: function () { return isNewEstimate; },
                getCurrentEditItem: function () { return currentEditItem; },
                validateContractorSelectionById: validateContractorSelectionById,
                readBusinessIncomeFormIntoItem: readBusinessIncomeFormIntoItem,
                derivePurchaseTaxIssuedFromRows: derivePurchaseTaxIssuedFromRows,
                deriveSalesDatesFromSalesRows: deriveSalesDatesFromSalesRows,
                seedEstimateAggregates: seedEstimateAggregates,
                upsertEstimateToServer: upsertEstimateToServer,
                unshiftEstimate: function (e) { estimates.unshift(e); },
                setIsPanelDirty: function (v) { isPanelDirty = v; },
                showToast: showToast,
                closePanel: closePanel,
                renderTable: renderTable,
                recalcFinanceSummaries: recalcFinanceSummaries,
                findEstimateIndexByCode: findEstimateIndexByCode,
                setEstimateAt: function (i, v) { estimates[i] = v; },
                setIsEditMode: function (v) { isEditMode = v; },
                renderPanelContent: renderPanelContent,
            });
        }

        const projectRegister = createProjectRegister({
            setIsNewEstimate: function (v) { isNewEstimate = v; },
            setIsEditMode: function (v) { isEditMode = v; },
            setBasicInfoEditMode: function (v) { basicInfoEditMode = v; },
            getCurrentUserAccessProfile: function () { return currentUserAccessProfile; },
            setCurrentEditItem: function (v) { currentEditItem = v; },
            getCurrentEditItem: function () { return currentEditItem; },
            renderPanelContent: function (item) { return renderPanelContent(item); },
        });
        const { openNewEstimate } = projectRegister;

        // 공용 중앙 패널(프로젝트·계정 관리 등) 닫기
        function closePanel(forceClose = false) {
            if (!forceClose && (isEditMode || isNewEstimate) && isPanelDirty) {
                const okToClose = confirm('변경사항이 있습니다.\n저장하지 않고 닫으시겠습니까?\n\n확인: 저장하지 않고 닫기\n취소: 계속 편집');
                if (!okToClose) return;
            }
            setUserManageHeaderActions(false);
            document.getElementById('sharedPanelOverlay').classList.remove('active');
            document.getElementById('sharedCenterPanel').classList.remove('active');
            document.getElementById('sharedCenterPanel').classList.remove('project-detail-modal');
            const bottomSaveBarEl = document.getElementById('sharedPanelBottomBar');
            if (bottomSaveBarEl) bottomSaveBarEl.style.display = 'none';
            setSaveLoading(false);
            isPanelDirty = false;
            panelBaselineSnapshot = '';

            isEditMode = false;
            isNewEstimate = false;
            basicInfoEditMode = false;
            currentEditItem = null;
            isCreatingAccount = false;
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

        const financeRecalc = createFinanceRecalc({
            estimateCodeKey: estimateCodeKey,
            findEstimateByCode: findEstimateByCode,
            seedEstimateAggregates: seedEstimateAggregates,
            deriveSalesDatesFromSalesRows: deriveSalesDatesFromSalesRows,
            derivePurchaseTaxIssuedFromRows: derivePurchaseTaxIssuedFromRows,
            derivePaidStatusFromAmounts: derivePaidStatusFromAmounts,
            computeBizTaxFromGross: computeBizTaxFromGross,
            getCurrentEditItem: function () { return currentEditItem; },
            renderTable: renderTable,
        });
        recalcFinanceSummaries = financeRecalc.recalcFinanceSummaries;
        getProfitNetTotalsByCode = financeRecalc.getProfitNetTotalsByCode;

        renderPanelContent = createRenderPanelContent({
            isCurrentUserExternalContractor: isCurrentUserExternalContractor,
            getActivePanelTabId: function () { return activePanelTabId; },
            setActivePanelTabId: function (v) { activePanelTabId = v; },
            getIsNewEstimate: function () { return isNewEstimate; },
            getIsEditMode: function () { return isEditMode; },
            getBasicInfoEditMode: function () { return basicInfoEditMode; },
            getBusinessInfoEditMode: function () { return businessInfoEditMode; },
            computeBizTaxFromGross: computeBizTaxFromGross,
            getProfitNetTotalsByCode: getProfitNetTotalsByCode,
            getBadgeClass: getBadgeClass,
            getCategory1SelectOptionsHtml: getCategory1SelectOptionsHtml,
            getCategory2SelectOptionsHtml: getCategory2SelectOptionsHtml,
            getCategory3SelectOptionsHtml: getCategory3SelectOptionsHtml,
            escapeHtml: escapeHtml,
            getContractorDatalistOptionsHtml: getContractorDatalistOptionsHtml,
            getContractorDocsHtml: getContractorDocsHtml,
            resetPanelDirtyState: resetPanelDirtyState,
            renderFinanceTablesFromItem: renderFinanceTablesFromItem,
            recalcFinanceSummaries: recalcFinanceSummaries,
        });

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
                downloadEstimateImportTemplate,
                openEstimateCsvImportPicker,
                onEstimateCsvImportFileChange,
                closeEstimateImportModal,
                confirmEstimateImport,
                openNewEstimate,
                closePanel,
                openPanel,
                openPanelFromRow,
                saveChanges,
                cancelEdit,
                switchPanelTab,
                addSalesRow,
                addPaymentRow,
                addPurchaseRow,
                addTransferRow,
                onFinanceRowClick,
                togglePaymentRowInline,
                deleteRow,
                goEstimatePage,
                goContractorPage,
                goExpenseListPage,
                goSgaListPage,
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
                onUnpaidFilterChange,
                clearUnpaidFilters,

                // 업체
                downloadContractorCSV,
                downloadContractorImportTemplate,
                openContractorPanel,
                closeContractorPanel,
                saveContractor,
                closeContractorDetailPanel,
                openContractorDetailPanel,
                viewContractorImage,
                updateContractorFileName,
                openContractorCsvImportPicker,
                onContractorCsvImportFileChange,
                closeContractorImportModal,
                confirmContractorImport,

                // 경비
                downloadExpenseCSV,
                downloadExpenseImportTemplate,
                openExpenseCsvImportPicker,
                onExpenseCsvImportFileChange,
                closeExpenseImportModal,
                confirmExpenseImport,
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
                downloadSgaImportTemplate,
                openSgaCsvImportPicker,
                onSgaCsvImportFileChange,
                closeSgaImportModal,
                confirmSgaImport,
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
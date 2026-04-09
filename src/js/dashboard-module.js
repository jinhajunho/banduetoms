/** 대시보드 캘린더·KPI — app.js에서 주입: getEstimates, showPage, renderTable, openPanel */
export function createDashboard(api) {
    // 대시보드 캘린더 (마크업은 public/partials/page-dashboard.html)
    let dashboardCalendarYear = new Date().getFullYear();
    let dashboardCalendarMonth = new Date().getMonth();
    let dashboardCalendarFilter = 'all';
    let dashboardCalendarSearchTerm = '';

    function getDashboardEvents() {
        return api.getEstimates().map(e => ({
            id: e.code,
            code: e.code || '',
            building: e.building || '',
            project: e.project || '',
            manager: e.manager || '',
            contractor: e.contractor || '',
            status: e.status || '견적',
            startDate: e.startDate || '',
            endDate: e.endDate || '',
            date: e.date || '',
            amount: e.revenue || 0
        }));
    }

    function normalizeYmd(value) {
        if (!value) return '';
        const raw = String(value).trim();
        if (!raw) return '';

        // ISO(YYYY-MM-DD...) 우선 처리
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];

        // 단일 자리 월/일(YYYY-M-D)도 허용
        const loose = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (loose) {
            const y = loose[1];
            const m = String(Number(loose[2])).padStart(2, '0');
            const d = String(Number(loose[3])).padStart(2, '0');
            return y + '-' + m + '-' + d;
        }

        // Date 파싱 가능 문자열 fallback
        const dt = new Date(raw);
        if (!isNaN(dt.getTime())) {
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            return y + '-' + m + '-' + d;
        }
        return '';
    }

    function parseYmdToUtc(value) {
        const ymd = normalizeYmd(value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
        const parts = ymd.split('-').map(Number);
        return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    }

    function daysBetweenInclusive(fromYmd, toYmd) {
        const a = parseYmdToUtc(fromYmd);
        const b = parseYmdToUtc(toYmd);
        if (!a || !b) return 1;
        const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
        return Math.max(1, diff + 1);
    }

    function getEventRangeMetaForDate(event, dateStr) {
        const target = normalizeYmd(dateStr);
        const start = normalizeYmd(event.startDate);
        const end = normalizeYmd(event.endDate);
        if (!target) return null;

        if (start && end) {
            const from = start <= end ? start : end;
            const to = start <= end ? end : start;
            if (target < from || target > to) return null;
            const durationDays = daysBetweenInclusive(from, to);
            if (durationDays <= 1) {
                return { isPeriod: false, durationDays: 1, dayType: 'single' };
            }
            const targetDate = parseYmdToUtc(target);
            const dayOfWeek = targetDate ? targetDate.getUTCDay() : -1; // 0:일, 6:토
            const segmentStart = target === from || dayOfWeek === 0;
            const segmentEnd = target === to || dayOfWeek === 6;
            if (segmentStart && segmentEnd) {
                return { isPeriod: true, durationDays: durationDays, dayType: 'period-segment-single' };
            }
            if (segmentStart) return { isPeriod: true, durationDays: durationDays, dayType: 'period-segment-start' };
            if (segmentEnd) return { isPeriod: true, durationDays: durationDays, dayType: 'period-segment-end' };
            return { isPeriod: true, durationDays: durationDays, dayType: 'period-segment-middle' };
        }

        if (start && target === start) return { isPeriod: false, durationDays: 1, dayType: 'single' };
        if (end && target === end) return { isPeriod: false, durationDays: 1, dayType: 'single' };
        return null;
    }

    function matchesDashboardSearch(event) {
        const q = String(dashboardCalendarSearchTerm || '').trim().toLowerCase();
        if (!q) return true;
        const text = [
            event.code || '',
            event.building || '',
            event.project || '',
            event.manager || '',
            event.contractor || '',
        ].join(' ').toLowerCase();
        return text.includes(q);
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
            const rangeMeta = getEventRangeMetaForDate(event, dateStr);
            const hasCalendarAnchor = !!(event.startDate || event.endDate);
            let shouldShow = false;

            if (!hasCalendarAnchor || !rangeMeta) {
                shouldShow = false;
            } else if (dashboardCalendarFilter === '진행') {
                shouldShow = event.status !== '완료';
            } else if (dashboardCalendarFilter === '완료') {
                shouldShow = event.status === '완료';
            } else {
                shouldShow = true;
            }

            if (shouldShow && matchesDashboardSearch(event)) {
                acc.push({
                    ...event,
                    _isPeriod: rangeMeta.isPeriod,
                    _durationDays: rangeMeta.durationDays,
                    _dayType: rangeMeta.dayType,
                });
            }
            return acc;
        }, []).sort((a, b) => {
            if (a._isPeriod !== b._isPeriod) return a._isPeriod ? -1 : 1;
            if (a._durationDays !== b._durationDays) return b._durationDays - a._durationDays;
            const aa = (a.building || '') + ' ' + (a.project || '');
            const bb = (b.building || '') + ' ' + (b.project || '');
            return aa.localeCompare(bb, 'ko');
        });
    }

    const DASHBOARD_PERIOD_LANE_H = 22;
    const DASHBOARD_PERIOD_LANE_GAP = 2;

    let dashboardPeriodOverlayObserverReady = false;

    function dashboardEventPassesCalendarFilters(event) {
        const hasCalendarAnchor = !!(event.startDate || event.endDate);
        if (!hasCalendarAnchor) return false;
        if (dashboardCalendarFilter === '진행') return event.status !== '완료';
        if (dashboardCalendarFilter === '완료') return event.status === '완료';
        return true;
    }

    function getDashboardMultiDayPeriodEvents() {
        const out = [];
        const seen = new Set();
        getDashboardEvents().forEach(function (event) {
            const start = normalizeYmd(event.startDate);
            const end = normalizeYmd(event.endDate);
            if (!start || !end) return;
            const from = start <= end ? start : end;
            const to = start <= end ? end : start;
            if (daysBetweenInclusive(from, to) <= 1) return;
            if (!dashboardEventPassesCalendarFilters(event)) return;
            if (!matchesDashboardSearch(event)) return;
            const key = String(event.code != null ? event.code : event.id);
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ event: event, from: from, to: to });
        });
        return out;
    }

    function ensureDashboardPeriodOverlayObserver() {
        if (dashboardPeriodOverlayObserverReady) return;
        const wrap = document.querySelector('.dashboard-calendar-grid-wrap');
        if (!wrap) return;
        dashboardPeriodOverlayObserverReady = true;
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(function () {
                renderDashboardPeriodOverlay();
            }).observe(wrap);
        }
        window.addEventListener('resize', function () {
            renderDashboardPeriodOverlay();
        });
    }

    function scheduleDashboardPeriodOverlay() {
        ensureDashboardPeriodOverlayObserver();
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                renderDashboardPeriodOverlay();
            });
        });
    }

    function getDashPeriodEventsTopRelative(cellEl, wrapRect) {
        const ev = cellEl.querySelector('.calendar-day-events');
        if (ev) {
            const r = ev.getBoundingClientRect();
            return r.top - wrapRect.top;
        }
        const dayNum = cellEl.querySelector('.day-number');
        if (dayNum) {
            const r = dayNum.getBoundingClientRect();
            return r.bottom - wrapRect.top + 4;
        }
        const r = cellEl.getBoundingClientRect();
        return r.top - wrapRect.top + 28;
    }

    function renderDashboardPeriodOverlay() {
        const overlay = document.getElementById('dashboardCalendarPeriodOverlay');
        const wrap = document.querySelector('.dashboard-calendar-grid-wrap');
        const grid = document.getElementById('dashboardCalendarGrid');
        if (!overlay || !wrap || !grid) return;

        overlay.innerHTML = '';
        grid.querySelectorAll('.calendar-day-events').forEach(function (el) {
            el.style.paddingTop = '';
        });

        const cells = Array.prototype.map.call(grid.querySelectorAll('.calendar-day'), function (el) {
            return { el: el, dateStr: el.getAttribute('data-date') || '' };
        });

        const periodItems = getDashboardMultiDayPeriodEvents();
        if (periodItems.length === 0) {
            overlay.setAttribute('aria-hidden', 'true');
            return;
        }

        const segments = [];
        periodItems.forEach(function (item) {
            const from = item.from;
            const to = item.to;
            const event = item.event;
            for (var w = 0; w < 6; w++) {
                var rowCells = cells.slice(w * 7, w * 7 + 7);
                var inRow = rowCells.filter(function (c) {
                    return c.dateStr && c.dateStr >= from && c.dateStr <= to;
                });
                if (inRow.length === 0) continue;
                var startEl = inRow[0].el;
                var endEl = inRow[inRow.length - 1].el;
                var firstDs = inRow[0].dateStr;
                var lastDs = inRow[inRow.length - 1].dateStr;
                segments.push({
                    event: event,
                    from: from,
                    to: to,
                    week: w,
                    startCol: rowCells.indexOf(inRow[0]),
                    endCol: rowCells.indexOf(inRow[inRow.length - 1]),
                    startEl: startEl,
                    endEl: endEl,
                    firstDs: firstDs,
                    lastDs: lastDs
                });
            }
        });

        var byWeek = {};
        segments.forEach(function (seg) {
            if (!byWeek[seg.week]) byWeek[seg.week] = [];
            byWeek[seg.week].push(seg);
        });

        for (var w = 0; w < 6; w++) {
            var pad = 0;
            var segs = byWeek[w];
            if (segs && segs.length) {
                segs.sort(function (a, b) {
                    return a.startCol - b.startCol || a.endCol - b.endCol;
                });
                var lanes = [];
                segs.forEach(function (seg) {
                    var li = 0;
                    while (true) {
                        if (!lanes[li]) lanes[li] = [];
                        var ok = true;
                        for (var j = 0; j < lanes[li].length; j++) {
                            var o = lanes[li][j];
                            if (!(seg.endCol < o.startCol || seg.startCol > o.endCol)) {
                                ok = false;
                                break;
                            }
                        }
                        if (ok) {
                            lanes[li].push(seg);
                            seg.lane = li;
                            break;
                        }
                        li++;
                    }
                });
                var maxLane = 0;
                segs.forEach(function (s) {
                    if (s.lane > maxLane) maxLane = s.lane;
                });
                pad = (maxLane + 1) * (DASHBOARD_PERIOD_LANE_H + DASHBOARD_PERIOD_LANE_GAP);
            }
            var rowCells = cells.slice(w * 7, w * 7 + 7);
            rowCells.forEach(function (c) {
                var evEl = c.el.querySelector('.calendar-day-events');
                if (evEl && pad > 0) evEl.style.paddingTop = pad + 'px';
            });
        }

        var wrapRectDraw = wrap.getBoundingClientRect();

        var rowBaseTop = [];
        for (var rw = 0; rw < 6; rw++) {
            var minT = Infinity;
            for (var c = 0; c < 7; c++) {
                var cellEl = cells[rw * 7 + c].el;
                var t = getDashPeriodEventsTopRelative(cellEl, wrapRectDraw);
                if (t < minT) minT = t;
            }
            rowBaseTop[rw] = Number.isFinite(minT) ? minT : 0;
        }

        var wrapW = wrapRectDraw.width;
        segments.forEach(function (seg) {
            var startRect = seg.startEl.getBoundingClientRect();
            var endRect = seg.endEl.getBoundingClientRect();
            var left = startRect.left - wrapRectDraw.left;
            var width = endRect.right - startRect.left;
            if (left < 0) {
                width += left;
                left = 0;
            }
            if (left + width > wrapW) {
                width = Math.max(0, wrapW - left);
            }
            var baseTop = rowBaseTop[seg.week];
            var top = baseTop + seg.lane * (DASHBOARD_PERIOD_LANE_H + DASHBOARD_PERIOD_LANE_GAP);

            var bar = document.createElement('button');
            bar.type = 'button';
            bar.className = 'dashboard-period-bar ' + (seg.event.status === '완료' ? 'completed' : 'progress');
            if (seg.firstDs === seg.from) bar.classList.add('dashboard-period-bar-round-left');
            else bar.classList.add('dashboard-period-bar-flat-left');
            if (seg.lastDs === seg.to) bar.classList.add('dashboard-period-bar-round-right');
            else bar.classList.add('dashboard-period-bar-flat-right');

            var title = (seg.event.building ? seg.event.building + ' - ' : '') + seg.event.project;
            var span = document.createElement('span');
            span.className = 'dashboard-period-bar-title';
            span.textContent = title;
            bar.appendChild(span);

            bar.style.left = left + 'px';
            bar.style.top = top + 'px';
            bar.style.width = Math.max(0, width) + 'px';
            bar.style.height = DASHBOARD_PERIOD_LANE_H + 'px';

            bar.onclick = function () {
                showDashboardEventModal(seg.event);
            };
            overlay.appendChild(bar);
        });

        overlay.removeAttribute('aria-hidden');
    }

    function getTodayYmdString() {
        const t = new Date();
        return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    }

    function fillDashboardCalendarDayCell(dayDiv, dateStr, isOtherMonth, dayNumberDisplay) {
        dayDiv.className = 'calendar-day' + (isOtherMonth ? ' other-month' : '');
        dayDiv.setAttribute('data-date', dateStr);

        const ymd = dateStr.split('-').map(Number);
        const dayOfWeek = new Date(ymd[0], ymd[1] - 1, ymd[2]).getDay();
        if (dayOfWeek === 0) dayDiv.classList.add('sunday');
        if (dayOfWeek === 6) dayDiv.classList.add('saturday');
        if (dateStr === getTodayYmdString()) dayDiv.classList.add('today');

        dayDiv.innerHTML = '<div class="day-number">' + dayNumberDisplay + '</div>';
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'calendar-day-events';
        const dayEvents = getDashboardEventsForDate(dateStr);
        const cellEvents = dayEvents.filter(function (e) {
            return !e._isPeriod;
        });
        cellEvents.slice(0, 4).forEach(function (event) {
            const eventBar = document.createElement('div');
            eventBar.className = 'event-bar ' + (event.status === '완료' ? 'completed' : 'progress');
            const eventTitle = (event.building ? event.building + ' - ' : '') + event.project;
            eventBar.innerHTML = '<span class="event-title">' + eventTitle + '</span>';
            eventBar.onclick = function () {
                showDashboardEventModal(event);
            };
            eventsContainer.appendChild(eventBar);
        });
        dayDiv.appendChild(eventsContainer);
        if (dayEvents.length > 4) {
            const moreBtn = document.createElement('button');
            moreBtn.type = 'button';
            moreBtn.className = 'calendar-more-btn';
            moreBtn.textContent = '+' + (dayEvents.length - 4) + '개 더보기';
            moreBtn.onclick = function () {
                showDashboardDayEventsModal(dateStr, dayEvents);
            };
            dayDiv.appendChild(moreBtn);
        }
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

        const prevYear = dashboardCalendarMonth === 0 ? dashboardCalendarYear - 1 : dashboardCalendarYear;
        const prevMonthIdx = dashboardCalendarMonth === 0 ? 11 : dashboardCalendarMonth - 1;
        const nextYear = dashboardCalendarMonth === 11 ? dashboardCalendarYear + 1 : dashboardCalendarYear;
        const nextMonthIdx = dashboardCalendarMonth === 11 ? 0 : dashboardCalendarMonth + 1;

        titleEl.textContent = dashboardCalendarYear + '년 ' + (dashboardCalendarMonth + 1) + '월';

        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const day = prevLastDate - i;
            const ds =
                prevYear +
                '-' +
                String(prevMonthIdx + 1).padStart(2, '0') +
                '-' +
                String(day).padStart(2, '0');
            const dayDiv = document.createElement('div');
            fillDashboardCalendarDayCell(dayDiv, ds, true, day);
            grid.appendChild(dayDiv);
        }

        for (let day = 1; day <= lastDate; day++) {
            const dateStr =
                dashboardCalendarYear +
                '-' +
                String(dashboardCalendarMonth + 1).padStart(2, '0') +
                '-' +
                String(day).padStart(2, '0');
            const dayDiv = document.createElement('div');
            fillDashboardCalendarDayCell(dayDiv, dateStr, false, day);
            grid.appendChild(dayDiv);
        }

        const remainingDays = 42 - (firstDayOfWeek + lastDate);
        for (let day = 1; day <= remainingDays; day++) {
            const ds =
                nextYear +
                '-' +
                String(nextMonthIdx + 1).padStart(2, '0') +
                '-' +
                String(day).padStart(2, '0');
            const dayDiv = document.createElement('div');
            fillDashboardCalendarDayCell(dayDiv, ds, true, day);
            grid.appendChild(dayDiv);
        }

        scheduleDashboardPeriodOverlay();
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
        if (!api.getEstimates().some(function(e) { return e.code === codeStr; })) {
            alert('해당 코드의 프로젝트를 찾을 수 없습니다.');
            return;
        }
        closeDashboardEventModal();
        closeDashboardDayEventsModal();
        api.showPage('estimate');
        api.renderTable();
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
            api.openPanel(codeStr);
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
        const monthEstimates = api.getEstimates().filter(e => e.date && e.date.slice(0, 7) === thisMonth);
        const monthRevenue = monthEstimates.reduce((sum, e) => sum + (e.revenue || 0), 0);
        const progressCount = api.getEstimates().filter(e => e.status === '진행').length;
        const completeCount = api.getEstimates().filter(e => e.status === '완료').length;
        const estimateCount = api.getEstimates().filter(e => e.status === '견적').length;

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

        const searchInput = document.getElementById('dashboardCalendarSearch');
        const clearBtn = document.getElementById('dashboardCalendarSearchClear');
        if (searchInput) {
            searchInput.value = dashboardCalendarSearchTerm;
            searchInput.oninput = function () {
                dashboardCalendarSearchTerm = this.value || '';
                renderDashboardCalendar();
            };
        }
        if (clearBtn) {
            clearBtn.onclick = function () {
                dashboardCalendarSearchTerm = '';
                if (searchInput) searchInput.value = '';
                renderDashboardCalendar();
                if (searchInput) searchInput.focus();
            };
        }
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
    return {
        renderDashboard,
        dashboardChangeMonth,
        closeDashboardEventModal,
        closeDashboardDayEventsModal,
        toggleDashboardTheme,
    };
}

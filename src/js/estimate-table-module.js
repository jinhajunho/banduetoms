export function renderEstimateTable(api, options) {
    function collectRowNames(rows, nameIndex) {
        if (!Array.isArray(rows) || rows.length === 0) return '';
        return rows
            .map(function (r) {
                return String(r && r[nameIndex] != null ? r[nameIndex] : '').trim();
            })
            .filter(Boolean)
            .join(' ');
    }

    var preservePage = options && options.preservePage === true;
    var estimateListPage = api.getEstimateListPage();
    if (!preservePage) estimateListPage = 1;
    api.setEstimateListPage(estimateListPage);

    api.refreshCategoryFilterOptionsAll();
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    const canSeeMonetary = api.canCurrentUserSeeEstimateMonetary();
    const filterCategory1 = String(document.getElementById('filterCategory1').value || '').trim();
    const filterCategory2 = String(document.getElementById('filterCategory2').value || '').trim();
    const filterCategory3 = String(document.getElementById('filterCategory3').value || '').trim();
    const filterEstimateTypeEl = document.getElementById('filterEstimateType');
    const filterEstimateType = filterEstimateTypeEl ? filterEstimateTypeEl.value : '';
    const filterTax = document.getElementById('filterTax').value;
    const filterCashflow = document.getElementById('filterCashflow')?.value || '';
    const filterSearch = document.getElementById('filterSearch').value.toLowerCase();
    const currentStatus = api.getCurrentStatus();

    let filtered = api.getEstimates().filter(item => {
        if (!api.canCurrentUserAccessEstimateItem(item)) return false;
        if (currentStatus !== 'all' && item.status !== currentStatus) return false;
        if (!api.itemMatchesEstimateDateFilter(item)) return false;
        if (filterEstimateType && (item.type || '') !== filterEstimateType) return false;
        if (filterCategory1 && String(item.category1 || '').trim() !== filterCategory1) return false;
        if (filterCategory2 && String(item.category2 || '').trim() !== filterCategory2) return false;
        if (filterCategory3 && String(item.category3 || '').trim() !== filterCategory3) return false;
        if (filterTax) {
            if (canSeeMonetary) {
                const salesGross = item.aggregateSalesGross != null ? item.aggregateSalesGross : (item.revenue || 0);
                const purchaseGross = item.aggregatePurchaseGross != null ? item.aggregatePurchaseGross : (item.purchase || 0);
                const hasSales = item.salesEntriesNone === true ? false : (Number(salesGross) > 0);
                const hasPurchase = item.purchaseEntriesNone === true ? false : (Number(purchaseGross) > 0);
                const salesIssued = !hasSales || item.salesEntriesNone === true || item.taxIssued === true;
                const purchaseIssued = !hasPurchase || api.derivePurchaseTaxIssuedForEstimateFilter(item) === true;
                const allIssued = salesIssued && purchaseIssued;
                const hasAnyInvoiceTarget = hasSales || hasPurchase;
                if (filterTax === '발행완료' && !allIssued) return false;
                if (filterTax === '미발행' && (!hasAnyInvoiceTarget || allIssued)) return false;
            } else {
                const pIssued = api.derivePurchaseTaxIssuedForEstimateFilter(item);
                if (filterTax === '발행완료' && !pIssued) return false;
                if (filterTax === '미발행' && (pIssued || item.type !== '세금계산서')) return false;
            }
        }

        if (filterCashflow) {
            const salesGross = item.aggregateSalesGross != null ? item.aggregateSalesGross : (item.revenue || 0);
            const purchaseGross = item.aggregatePurchaseGross != null ? item.aggregatePurchaseGross : (item.purchase || 0);
            const pay = item.aggregatePaymentGross != null ? item.aggregatePaymentGross : 0;
            const transfer = item.aggregateTransferGross != null ? item.aggregateTransferGross : 0;
            const biz = api.computeBizTaxFromGross(item.businessIncomeGross);
            const hasSalesTarget = item.salesEntriesNone === true ? false : (Number(salesGross) > 0);
            const hasPurchaseTarget = item.purchaseEntriesNone === true ? false : (Number(purchaseGross) > 0);

            // 수금액이 '-'(0)이면 미수로 취급: 미수금 필터에서 반드시 잡히게 유지
            const payDone = !hasSalesTarget ? true : (pay > 0 && pay === salesGross);
            const xferDone = !hasPurchaseTarget ? true : transfer === purchaseGross;
            const netDone = biz.gross <= 0 ? true : item.businessIncomePaidStatus === '지급';
            const cashflowAllDone = payDone && xferDone && netDone;
            const contractorCashflowDone = xferDone && netDone;
            const cashflowDone = canSeeMonetary ? cashflowAllDone : contractorCashflowDone;

            const wantDone = (filterCashflow === '입금완료' || filterCashflow === '수금완료');
            const wantNotDone = (filterCashflow === '미입금' || filterCashflow === '미수금');
            if (wantDone && !cashflowDone) return false;
            if (wantNotDone && cashflowDone) return false;
        }

        if (filterSearch) {
            const salesNames = collectRowNames(item.salesRows, 1);
            const purchaseNames = collectRowNames(item.purchaseRows, 1);
            const businessNames = collectRowNames(item.businessIncomeRows, 1);
            const extraContractorTxt = Array.isArray(item.contractorExtraNames) ? item.contractorExtraNames.join(' ') : '';
            const searchText = `${item.code || ''} ${item.building} ${item.project} ${item.manager} ${item.contractor || ''} ${extraContractorTxt} ${item.category3 || ''} ${salesNames} ${purchaseNames} ${businessNames}`.toLowerCase();
            if (!searchText.includes(filterSearch)) return false;
        }
        return true;
    });

    filtered.sort(function (a, b) {
        const ka = api.getEstimateSortKey(a);
        const kb = api.getEstimateSortKey(b);
        if (kb !== ka) return kb.localeCompare(ka);
        const ac = String(a && a.code != null ? a.code : '');
        const bc = String(b && b.code != null ? b.code : '');
        return bc.localeCompare(ac, 'ko');
    });

    var totalItems = filtered.length;
    var totalPages = Math.max(1, Math.ceil(totalItems / api.ESTIMATE_PAGE_SIZE));
    estimateListPage = api.getEstimateListPage();
    if (estimateListPage > totalPages) estimateListPage = totalPages;
    if (estimateListPage < 1) estimateListPage = 1;
    api.setEstimateListPage(estimateListPage);
    var sliceStart = (estimateListPage - 1) * api.ESTIMATE_PAGE_SIZE;
    var pageRows = filtered.slice(sliceStart, sliceStart + api.ESTIMATE_PAGE_SIZE);

    tbody.innerHTML = pageRows.map(item => {
        const statusBadgeClass = {
            '견적': 'badge-estimate',
            '진행': 'badge-progress',
            '완료': 'badge-complete',
            '보류': 'badge-hold'
        }[item.status];

        const purchaseAmount = Number(
            item.aggregatePurchaseGross != null ? item.aggregatePurchaseGross : (item.purchase || 0)
        );
        const salesAmountChipClass = api.projectSalesPurchaseChipClass(false, item, purchaseAmount);
        const purchaseAmountChipClass = api.projectSalesPurchaseChipClass(true, item, purchaseAmount);
        const revenueCellHtml = canSeeMonetary
            ? `<span class="table-amount-chip ${salesAmountChipClass}">${item.revenue.toLocaleString()}원</span>`
            : `<span class="table-amount-dash">-</span>`;
        const cashflowCellHtml = canSeeMonetary
            ? api.renderCashflowTripleCell(item)
            : api.renderCashflowTransferNetCell(item);
        const codeJs = JSON.stringify(String(item.code != null ? item.code : ''));
        const statusCellHtml = canSeeMonetary
            ? `<button type="button" class="badge ${statusBadgeClass} status-popover-trigger" onclick="openStatusPopover(event, ${codeJs})">${item.status}</button>`
            : `<span class="badge ${statusBadgeClass}">${item.status}</span>`;

        const amountPairHtml = canSeeMonetary
            ? `<div class="table-amount-pair">
                        ${revenueCellHtml}
                        <span class="table-amount-slash">/</span>
                        <span class="table-amount-chip ${purchaseAmountChipClass}">${purchaseAmount.toLocaleString()}원</span>
                    </div>`
            : `<span class="table-amount-chip ${purchaseAmountChipClass}">${purchaseAmount.toLocaleString()}원</span>`;

        return `
            <tr class="table-row-clickable" data-code="${api.escapeHtmlAttr(String(item.code != null ? item.code : ''))}">
                <td onclick="event.stopPropagation()">
                    ${statusCellHtml}
                </td>
                <td>${item.category1}</td>
                <td>${item.category2}</td>
                <td>${item.category3 || '-'}</td>
                <td>${item.building}</td>
                <td>${item.project}</td>
                <td>
                    ${amountPairHtml}
                </td>
                <td>${cashflowCellHtml}</td>
                <td>${api.getEstimateTableContractorCellHtml(item)}</td>
            </tr>
        `;
    }).join('');

    api.updateEstimatePaginationUI(totalItems, totalPages, estimateListPage);

    const totalCount = filtered.length;
    const totalAmount = canSeeMonetary ? filtered.reduce((sum, item) => sum + item.revenue, 0) : 0;
    const elTotalCount = document.getElementById('totalCount');
    if (elTotalCount) elTotalCount.textContent = `${totalCount}건`;
    const elTotalAmount = document.getElementById('totalAmount');
    if (elTotalAmount) elTotalAmount.textContent = canSeeMonetary ? `${totalAmount.toLocaleString()}원` : '-';
}

export function goEstimateListPage(api, p) {
    if (p < 1) return;
    api.setEstimateListPage(p);
    api.renderTable({ preservePage: true });
}

export function bindEstimateListInteractions(api) {
    // partial 마운트 타이밍/재바인딩 누락 대비: 상태 탭은 문서 위임으로도 처리
    if (!window.__estimateStatusTabDelegationBound) {
        window.__estimateStatusTabDelegationBound = true;
        document.addEventListener('click', function (e) {
            const tab = e.target && e.target.closest && e.target.closest('#page-estimate .tabs-left .tab');
            if (!tab) return;
            document.querySelectorAll('#page-estimate .tabs-left .tab').forEach(function (t) {
                t.classList.remove('active');
            });
            tab.classList.add('active');
            api.setCurrentStatus(tab.dataset.status || 'all');
            api.renderTable();
        });
    }

    document.querySelectorAll('#page-estimate .tabs-left .tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('#page-estimate .tabs-left .tab').forEach(function (t) {
                t.classList.remove('active');
            });
            tab.classList.add('active');
            api.setCurrentStatus(tab.dataset.status);
            api.renderTable();
        });
    });

    document.addEventListener('click', function (e) {
        const tb = document.getElementById('tableBody');
        if (!tb) return;
        const tr = e.target && e.target.closest && e.target.closest('tr.table-row-clickable[data-code]');
        if (!tr || !tb.contains(tr)) return;
        if (e.target.closest('.status-popover-trigger') || e.target.closest('.status-popover-root')) return;
        const code = tr.getAttribute('data-code');
        if (code != null && code !== '') api.openPanel(code);
    });

    const filterCategory1 = document.getElementById('filterCategory1');
    const filterCategory2 = document.getElementById('filterCategory2');
    const filterCategory3 = document.getElementById('filterCategory3');
    const filterEstimateType = document.getElementById('filterEstimateType');
    const filterTax = document.getElementById('filterTax');
    const filterCashflow = document.getElementById('filterCashflow');
    const filterSearch = document.getElementById('filterSearch');
    if (filterCategory1) filterCategory1.addEventListener('change', api.renderTable);
    if (filterCategory2) filterCategory2.addEventListener('change', api.renderTable);
    if (filterCategory3) filterCategory3.addEventListener('change', api.renderTable);
    if (filterEstimateType) filterEstimateType.addEventListener('change', api.renderTable);
    if (filterTax) filterTax.addEventListener('change', api.renderTable);
    if (filterCashflow) filterCashflow.addEventListener('change', api.renderTable);
    if (filterSearch) filterSearch.addEventListener('input', api.renderTable);
}

export function initEstimateListFiltersModule(api) {
    function runEstimateFilterReset() {
        api.setCurrentStatus('all');
        document.querySelectorAll('#page-estimate .tabs-left .tab').forEach(function (t) {
            t.classList.toggle('active', t.dataset.status === 'all');
        });

        api.setEstimateDatePreset('all');

        const basisEl = document.getElementById('filterDateBasis');
        if (basisEl) basisEl.value = 'all';

        const c1 = document.getElementById('filterCategory1');
        const c2 = document.getElementById('filterCategory2');
        const c3 = document.getElementById('filterCategory3');
        if (c1) c1.value = '';
        if (c2) c2.value = '';
        if (c3) c3.value = '';

        const fType = document.getElementById('filterEstimateType');
        if (fType) fType.value = '';

        const tax = document.getElementById('filterTax');
        if (tax) tax.value = '';

        const cf = document.getElementById('filterCashflow');
        if (cf) cf.value = '';

        const fs = document.getElementById('filterSearch');
        if (fs) fs.value = '';

        api.renderTable();
    }

    function handleEstimateDatePresetButtonClick(btn) {
        if (!btn) return;
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
                api.updateEstimateByMonthPresetButtonLabel();
                api.setEstimateDatePreset('all');
                api.renderTable();
                return;
            }
            if (current === 'byMonth' && !panelOpen) {
                if (monthPanel) monthPanel.style.display = 'flex';
                api.customMonthPickerOnOpen();
                return;
            }
            api.setEstimateDatePreset('byMonth');
            api.renderTable();
            return;
        }

        api.setEstimateDatePreset(p);
        api.renderTable();
    }

    // partial 로드 타이밍/재마운트 이슈가 있어도 필터 이벤트가 반드시 먹도록 문서 위임 폴백을 둡니다.
    if (!window.__estimateFilterDelegationBound) {
        window.__estimateFilterDelegationBound = true;
        document.addEventListener('change', function (e) {
            const t = e && e.target;
            if (!t || !t.id) return;
            if (
                t.id === 'filterCategory1' ||
                t.id === 'filterCategory2' ||
                t.id === 'filterCategory3' ||
                t.id === 'filterEstimateType' ||
                t.id === 'filterTax' ||
                t.id === 'filterCashflow' ||
                t.id === 'filterDateBasis' ||
                t.id === 'filterDateFrom' ||
                t.id === 'filterDateTo' ||
                t.id === 'filterByMonth'
            ) {
                api.renderTable();
            }
        });
        document.addEventListener('input', function (e) {
            const t = e && e.target;
            if (!t || !t.id) return;
            if (t.id === 'filterSearch') api.renderTable();
        });
        document.addEventListener('click', function (e) {
            const resetHit = e.target && e.target.closest
                ? e.target.closest('#page-estimate #filterResetBtn')
                : null;
            if (resetHit) {
                runEstimateFilterReset();
                return;
            }
            const presetBtn = e.target && e.target.closest
                ? e.target.closest('#page-estimate .estimate-filter-preset')
                : null;
            if (presetBtn) {
                handleEstimateDatePresetButtonClick(presetBtn);
                return;
            }
            const rangeBtn = e.target && e.target.closest
                ? e.target.closest('#page-estimate #toggleEstimateCustomRange')
                : null;
            if (rangeBtn) {
                api.toggleEstimateCustomRange(e);
            }
        });
    }
    document.addEventListener('click', function (e) {
        if (e.target.closest('.estimate-filter-popover-anchor')) return;
        if (e.target.closest('#estimateDatePickerPanel')) return;
        api.hideEstimateFilterPopoverPanels();
    });

    api.initCustomMonthPicker();
    api.initCustomDatePicker();
    api.updateEstimateByMonthPresetButtonLabel();
    api.updateEstimateCustomRangeButtonLabel();

    const basis = document.getElementById('filterDateBasis');
    if (basis) basis.addEventListener('change', api.renderTable);
    const df = document.getElementById('filterDateFrom');
    const dt = document.getElementById('filterDateTo');
    if (df) df.addEventListener('change', api.renderTable);
    if (dt) dt.addEventListener('change', api.renderTable);

    const fs = document.getElementById('filterSearch');
    if (fs) {
        fs.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                api.renderTable();
            }
        });
    }
}

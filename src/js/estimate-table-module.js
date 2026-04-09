export function renderEstimateTable(api, options) {
    var preservePage = options && options.preservePage === true;
    var estimateListPage = api.getEstimateListPage();
    if (!preservePage) estimateListPage = 1;
    api.setEstimateListPage(estimateListPage);

    api.refreshCategoryFilterOptionsAll();
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    const canSeeMonetary = api.canCurrentUserSeeEstimateMonetary();
    const filterCategory1 = document.getElementById('filterCategory1').value;
    const filterCategory2 = document.getElementById('filterCategory2').value;
    const filterCategory3 = document.getElementById('filterCategory3').value;
    const filterTax = document.getElementById('filterTax').value;
    const filterCashflow = document.getElementById('filterCashflow')?.value || '';
    const filterSearch = document.getElementById('filterSearch').value.toLowerCase();
    const currentStatus = api.getCurrentStatus();

    let filtered = api.getEstimates().filter(item => {
        if (!api.canCurrentUserAccessEstimateItem(item)) return false;
        if (currentStatus !== 'all' && item.status !== currentStatus) return false;
        if (!api.itemMatchesEstimateDateFilter(item)) return false;
        if (filterCategory1 && item.category1 !== filterCategory1) return false;
        if (filterCategory2 && item.category2 !== filterCategory2) return false;
        if (filterCategory3 && (item.category3 || '') !== filterCategory3) return false;
        if (filterTax) {
            if (canSeeMonetary) {
                if (filterTax === '발행완료' && !item.taxIssued) return false;
                if (filterTax === '미발행' && (item.taxIssued || item.type !== '세금계산서')) return false;
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

            const payDone = salesGross <= 0 ? true : pay === salesGross;
            const xferDone = purchaseGross <= 0 ? true : transfer === purchaseGross;
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
            const searchText = `${item.code || ''} ${item.building} ${item.project} ${item.manager} ${item.contractor || ''} ${item.category3 || ''}`.toLowerCase();
            if (!searchText.includes(filterSearch)) return false;
        }
        return true;
    });

    filtered.sort(function (a, b) {
        const ka = api.getEstimateSortKey(a);
        const kb = api.getEstimateSortKey(b);
        return kb.localeCompare(ka);
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

        const purchaseAmount = Number(item.purchase || 0);
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
                <td>${item.contractor || '-'}</td>
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
        });
    });
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
    const tcr = document.getElementById('toggleEstimateCustomRange');
    if (tcr) tcr.addEventListener('click', api.toggleEstimateCustomRange);

    const resetBtn = document.getElementById('filterResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            api.setCurrentStatus('all');
            document.querySelectorAll('.tab').forEach(function (t) {
                t.classList.toggle('active', t.dataset.status === 'all');
            });

            api.setEstimateDatePreset('all');

            const basis = document.getElementById('filterDateBasis');
            if (basis) basis.value = 'date';

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
        });
    }

    const searchBtn = document.getElementById('filterSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', api.renderTable);
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

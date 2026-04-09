/**
 * 견적 패널 재무 행 ⋮ 메뉴, 행 렌더, 매출·매입·수금·이체 모달 및 동일내역 피커
 */
export function createEstimateFinanceModal(api) {
    let financeModalState = null;

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
        document.querySelectorAll('.payment-action-inline--expanded').forEach(function (w) {
            w.classList.remove('payment-action-inline--expanded');
        });
    }

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
                return ['', '', '', '', '', '미발행', '-', '', null];
            }
            return ['', '', '', '', '', '', null];
        }
        let values = [];
        if (row.dataset.rowValues) {
            values = JSON.parse(row.dataset.rowValues);
        } else {
            values = Array.from(row.cells).map(function (c) { return (c.textContent || '').replace(/원/g, '').trim(); });
            values.push(null);
        }
        if (type === 'sales' || type === 'purchase') { api.migrateSalesRowValuesIfOld(values); api.normalizeSalesVatIncluded(values); }
        if (type === 'payment') { api.migratePaymentRowValuesIfOld(values); api.normalizePaymentVatValues(values); }
        if (type === 'transfer') { api.migratePaymentRowValuesIfOld(values); api.normalizePaymentVatValues(values); }
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

    function renderFinanceTablesFromItem(item) {
        if (!item || !item.code) return;
        api.applyEstimateDefaultsAndSeed([item]);
        if (
            (Number(item.revenue) || 0) > 0 &&
            (!item.salesRows || item.salesRows.length === 0) &&
            (!item.paymentRows || item.paymentRows.length === 0) &&
            (!item.purchaseRows || item.purchaseRows.length === 0) &&
            (!item.transferRows || item.transferRows.length === 0)
        ) {
            api.buildFinanceRowsFromSummary(item);
        }

        const code = String(item.code);
        function fill(tbodyId, type, rows) {
            const body = document.getElementById(tbodyId);
            if (!body) return;
            body.innerHTML = '';
            (rows || []).forEach(function (values) {
                const tr = document.createElement('tr');
                renderFinanceRow(tr, type, values, '');
                body.appendChild(tr);
            });
        }
        fill('salesList-' + code, 'sales', item.salesRows);
        fill('salesPayments-' + code, 'payment', item.paymentRows);
        fill('purchaseList-' + code, 'purchase', item.purchaseRows);
        fill('transferList-' + code, 'transfer', item.transferRows);
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
                            <input id="fm_date" type="date" value="${values[0] || ''}" class="form-input" title="선택 입력">
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
            const p = api.splitNetTaxFromGross(g);
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
        if (!name || !gross) { alert('상호명과 금액(vat포함)은 필수입니다. 일자는 생략할 수 있습니다.'); return; }
        const parts = api.splitNetTaxFromGross(gross || Math.round(net * 1.1));
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
        api.recalcFinanceSummaries(code);
        api.markPanelDirtyIfChanged();
        closeFinanceRowModal();
        api.persistEstimateToServerByCode(code).then(function (r) {
            if (!r.ok) {
                alert(r.error || '서버에 저장하지 못했습니다. 네트워크·로그인 상태를 확인해 주세요.');
                return;
            }
            if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                api.showToast('서버에 저장되었습니다.');
            }
        });
    }

    function confirmDeleteFinanceRow() {
        if (!financeModalState || !financeModalState.row) return;
        if (!confirm('이 항목을 삭제하시겠습니까?')) return;
        const code = financeModalState.code;
        financeModalState.row.remove();
        api.recalcFinanceSummaries(code);
        api.markPanelDirtyIfChanged();
        closeFinanceRowModal();
        api.persistEstimateToServerByCode(code).then(function (r) {
            if (!r.ok) {
                alert(r.error || '서버에 저장하지 못했습니다. 네트워크·로그인 상태를 확인해 주세요.');
                return;
            }
            if (window.__bpsSupabase && window.__bpsSupabase.auth) {
                api.showToast('서버에 저장되었습니다.');
            }
        });
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
            api.migrateSalesRowValuesIfOld(values);
            api.normalizeSalesVatIncluded(values);
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

    function addPaymentRow(type, code) {
        openFinanceRowModal('payment', code, null);
    }

    function addSalesRow(code) {
        openFinanceRowModal('sales', code, null);
    }

    function addPurchaseRow(code) {
        openFinanceRowModal('purchase', code, null);
    }

    function addTransferRow(code) {
        openFinanceRowModal('transfer', code, null);
    }

    function initPaymentRowMenuListeners() {
        document.addEventListener('click', closePaymentRowInlines);
    }

    return {
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
        initPaymentRowMenuListeners,
    };
}

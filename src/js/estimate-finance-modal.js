/**
 * 견적 패널 재무 행 ⋮ 메뉴, 행 렌더, 매출·매입·수금·이체 모달 및 동일내역 피커
 */
export function createEstimateFinanceModal(api) {
    const ensureMeta = typeof api.ensureFinanceRowMetaSlot === 'function'
        ? api.ensureFinanceRowMetaSlot.bind(api)
        : function () {};
    const formatMemoCell = typeof api.formatFinanceMemoCellHtml === 'function'
        ? api.formatFinanceMemoCellHtml.bind(api)
        : function (values, type) {
            const memoIx = (type === 'sales' || type === 'purchase') ? 7 : 5;
            return String(values && values[memoIx] != null ? values[memoIx] : '');
        };
    const cloneForModal = typeof api.cloneFinanceRowValuesForContractorModal === 'function'
        ? api.cloneFinanceRowValuesForContractorModal.bind(api)
        : function (values) { return values.slice(); };
    const stampMeta = typeof api.stampFinanceRowMemoMetaAfterEdit === 'function'
        ? api.stampFinanceRowMemoMetaAfterEdit.bind(api)
        : function () {};
    const mergeRowAttachments =
        typeof api.mergeFinanceAttachmentsIntoValues9 === 'function'
            ? api.mergeFinanceAttachmentsIntoValues9.bind(api)
            : function () {};
    const isExtContractor = typeof api.isCurrentUserExternalContractor === 'function'
        ? api.isCurrentUserExternalContractor.bind(api)
        : function () { return false; };
    const findContractorByName =
        typeof api.findContractorByName === 'function' ? api.findContractorByName.bind(api) : function () { return null; };
    const scheduleFitProjectDetailModalWidth =
        typeof api.scheduleFitProjectDetailModalWidth === 'function'
            ? api.scheduleFitProjectDetailModalWidth.bind(api)
            : function () {};

    let financeModalState = null;

    function paymentRowMenuHtml() {
        const delHidden = isExtContractor() ? ' style="display:none !important;" aria-hidden="true" tabindex="-1"' : '';
        return '<span class="payment-action-inline">' +
            '<button type="button" class="payment-row-menu-trigger" onclick="event.stopPropagation(); togglePaymentRowInline(this)" title="메뉴"><i class="fas fa-ellipsis-v"></i></button>' +
            '<span class="payment-action-buttons">' +
            '<button type="button" class="payment-inline-btn" onclick="event.stopPropagation(); editRow(this); closePaymentRowInlines();">수정</button>' +
            '<button type="button" class="payment-inline-btn payment-inline-btn-danger" onclick="event.stopPropagation(); deleteRow(this); closePaymentRowInlines();"' + delHidden + '>삭제</button>' +
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
        if (type === 'transfer' && isExtContractor()) return;
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
            let v;
            if (type === 'sales' || type === 'purchase') {
                v = ['', '', '', '', '', '미발행', '-', '', '', { contractorBy: '', internalBy: '' }];
            } else {
                v = ['', '', '', '', '', '', null];
            }
            ensureMeta(v, type);
            return cloneForModal(v, type);
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
        ensureMeta(values, type);
        return cloneForModal(values, type);
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
                '<td>' + formatMemoCell(values, type) + '</td>';
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
                '<td>' + formatMemoCell(values, type) + '</td>';
            if (!(type === 'transfer' && isExtContractor())) {
                row.setAttribute('onclick', "onFinanceRowClick(event, this, '" + type + "')");
            }
        }
        row.setAttribute('data-row-type', type);
        row.setAttribute('data-saved', 'true');
        row.dataset.rowValues = JSON.stringify(values);
        if (!(type === 'transfer' && isExtContractor())) {
            row.classList.add('finance-row-clickable');
        }
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
                ensureMeta(values, type);
                const tr = document.createElement('tr');
                let rowFileIdForRender = '';
                if (
                    (type === 'sales' || type === 'purchase') &&
                    values[9] &&
                    typeof values[9] === 'object' &&
                    Array.isArray(values[9].attachments) &&
                    values[9].attachments.length
                ) {
                    if (!window.savedRowFiles) window.savedRowFiles = {};
                    const rk =
                        values[9].rowFileKey ||
                        'rowfile-' + code + '-' + type + '-' + Math.random().toString(36).slice(2);
                    values[9].rowFileKey = rk;
                    window.savedRowFiles[rk] = values[9].attachments.map(function (a) {
                        return {
                            name: (a && a.name) ? String(a.name) : '파일',
                            type: (a && (a.mimeType || a.type)) ? String(a.mimeType || a.type) : 'application/octet-stream',
                            data: a && a.legacyDataUrl ? String(a.legacyDataUrl) : '',
                            storagePath: a && typeof a.storagePath === 'string' ? a.storagePath.trim() : '',
                            date: item.date || new Date().toISOString().slice(0, 10),
                        };
                    });
                    rowFileIdForRender = rk;
                }
                renderFinanceRow(tr, type, values, rowFileIdForRender);
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
        root.dataset.financeUploadCode = String(code || '').trim();
        const isEdit = !!row;
        const fileCount = (row && row.dataset.rowFileId && window.savedRowFiles && window.savedRowFiles[row.dataset.rowFileId]) ? window.savedRowFiles[row.dataset.rowFileId].length : 0;
        const modalFileId = 'modal-file-' + Date.now();
        financeModalState = { type: type, code: code, row: row, modalFileId: modalFileId, rowFileId: row ? (row.dataset.rowFileId || '') : '' };
        const fmNameListAttr = type === 'purchase' || type === 'transfer' ? ' list="contractorListFinanceVendors"' : '';
        const fmNamePlaceholder =
            type === 'sales' || type === 'payment' ? '상호명(선택)' : type === 'purchase' || type === 'transfer' ? '업체 검색/선택' : '상호명';

        const spMemoFields = (function () {
            if (type !== 'sales' && type !== 'purchase') {
                return '<input id="fm_memo" type="text" value="' + String(values[5] || '').replace(/"/g, '&quot;') + '" placeholder="메모" class="form-input" style="grid-column:1 / -1;">';
            }
            let cEsc = String(values[7] != null ? values[7] : '').replace(/"/g, '&quot;');
            let iEsc = String(values[8] != null ? values[8] : '').replace(/"/g, '&quot;');
            // 구 버전/데이터에서 memo가 1개만 있던 경우: 내부 계정은 내부메모 칸에 기본 표시
            try {
                const meta = values && values[9] && typeof values[9] === 'object' ? values[9] : null;
                const hasInternal = meta && meta.internalBy;
                const hasContractor = meta && meta.contractorBy;
                if (!isExtContractor() && !iEsc.trim() && cEsc.trim() && (hasInternal && !hasContractor)) {
                    iEsc = cEsc;
                    cEsc = '';
                }
                if (!isExtContractor() && !iEsc.trim() && cEsc.trim() && !hasInternal && !hasContractor) {
                    iEsc = cEsc;
                    cEsc = '';
                }
            } catch (_e) {
                /* ignore */
            }
            if (isExtContractor()) {
                return '<input id="fm_memo" type="text" value="' + cEsc + '" placeholder="메모(도급사)" class="form-input" style="grid-column:1 / -1;">';
            }
            return '<label style="grid-column:1 / -1;font-size:12px;color:#64748b;margin:0;">도급사 메모 <span style="font-weight:400;">(내부 계정은 수정 불가)</span></label>' +
                '<input id="fm_memo_contractor" type="text" readonly class="form-input" style="grid-column:1 / -1;background:#f8fafc;cursor:not-allowed;" value="' + cEsc + '" title="도급사가 입력한 메모입니다. 유지하려면 금액 등만 수정하세요.">' +
                '<label style="grid-column:1 / -1;font-size:12px;color:#64748b;margin:4px 0 0 0;">내부 메모</label>' +
                '<input id="fm_memo_internal" type="text" value="' + iEsc + '" placeholder="회계/관리 전용 메모" class="form-input" style="grid-column:1 / -1;">';
        })();

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
                            <input id="fm_name" type="text" value="${(values[1] || '').replace(/"/g, '&quot;')}" placeholder="${fmNamePlaceholder}" class="form-input"${fmNameListAttr}>
                            <div style="grid-column:1 / -1;font-size:12px;line-height:1.5;color:#475569;margin:0;padding:8px 10px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">별도(vat별도) 금액을 넣으면 부가세(10%)·포함 금액이 자동으로 맞춰집니다. 현금영수증 등 부가세가 없을 때는 <strong style="font-weight:600;color:#334155;">부가세 칸에 0</strong>을 입력해 주세요.</div>
                            <input id="fm_net" type="number" value="${String(values[2] || '').replace(/,/g, '')}" placeholder="vat별도" class="form-input">
                            <input id="fm_tax" type="number" value="${String(values[3] || '').replace(/,/g, '')}" placeholder="부가세(비우면 10% 자동)" class="form-input" title="직접 수정·삭제 가능. 현금영수증 등 부가세 없으면 0 또는 비움">
                            <input id="fm_gross" type="number" value="${String(values[4] || '').replace(/,/g, '')}" placeholder="vat포함" class="form-input">
                            ${type === 'sales' || type === 'purchase'
                ? '<select id="fm_taxbill" class="form-select"><option value="미발행"' + (values[5] === '미발행' ? ' selected' : '') + '>미발행</option><option value="발행"' + (values[5] === '발행' ? ' selected' : '') + '>발행</option></select>'
                : '<span></span>'}
                            ${spMemoFields}
                            ${type === 'sales' || type === 'purchase'
                ? '<div style="grid-column:1 / -1;display:flex;align-items:center;gap:8px;"><input type="file" id="' + modalFileId + '" class="file-input-hidden" accept="image/*,application/pdf" multiple onchange="handleMultiFileSelect(this, \'' + modalFileId + '\')"><button type="button" class="btn-file-upload" onclick="document.getElementById(\'' + modalFileId + '\').click()">업로드</button><button type="button" class="btn-file-view" onclick="showFileList(\'' + modalFileId + '\')">첨부 보기' + (fileCount > 0 ? ' (' + fileCount + ')' : '') + '</button></div>'
                : ''}
                        </div>
                        <div style="padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:8px;align-items:center;">
                            <button type="button" class="btn btn-primary" id="fm_delete_row_btn" onclick="confirmDeleteFinanceRow()" style="${
            !isEdit
                ? 'visibility:hidden;'
                : isExtContractor()
                  ? 'display:none;'
                  : 'background: var(--danger); border-color: var(--danger);'
        }" ${isEdit && isExtContractor() ? 'aria-hidden="true" tabindex="-1"' : ''}>삭제</button>
                            <div style="display:flex;gap:8px;">
                                <button type="button" class="btn btn-secondary" onclick="closeFinanceRowModal()">취소</button>
                                <button type="button" class="btn btn-primary" onclick="saveFinanceRowModal()">저장</button>
                            </div>
                        </div>
                    </div>
                </div>`;

        const net = document.getElementById('fm_net');
        const tax = document.getElementById('fm_tax');
        const gross = document.getElementById('fm_gross');
        function applyFmNetDerived(ev) {
            const taxEl = document.getElementById('fm_tax');
            const grossEl = document.getElementById('fm_gross');
            const netEl = document.getElementById('fm_net');
            if (!netEl || !taxEl || !grossEl) return;
            const raw = String(netEl.value || '').replace(/,/g, '').trim();
            const kind = ev && ev.type ? ev.type : '';
            if (raw === '') {
                if (kind === 'change') {
                    taxEl.value = '';
                    grossEl.value = '';
                }
                return;
            }
            const n = parseFloat(raw, 10);
            if (isNaN(n) || n === 0) {
                if (kind === 'change') {
                    taxEl.value = '';
                    grossEl.value = '';
                }
                return;
            }
            const tStr = taxEl.value != null ? String(taxEl.value).trim() : '';
            if (tStr === '') {
                const v = Math.round(n * 0.1);
                taxEl.value = String(v);
                grossEl.value = String(Math.round(n + v));
            } else {
                const t = parseFloat(String(tStr).replace(/,/g, ''), 10);
                const tNum = isNaN(t) ? 0 : t;
                grossEl.value = String(Math.round(n + tNum));
            }
        }
        if (net) {
            net.addEventListener('input', applyFmNetDerived);
            net.addEventListener('change', applyFmNetDerived);
        }
        if (tax) tax.addEventListener('input', function () {
            const n = parseFloat(String(net && net.value != null ? net.value : '').replace(/,/g, '').trim(), 10) || 0;
            const t = parseFloat(String(tax.value || '').replace(/,/g, '').trim(), 10) || 0;
            if (gross) gross.value = (n || t) ? String(Math.round(n + t)) : '';
        });
        if (gross) gross.addEventListener('input', function () {
            const g = parseFloat(String(gross.value || '').replace(/,/g, '').trim(), 10) || 0;
            const p = api.splitNetTaxFromGross(g);
            const netEl = document.getElementById('fm_net');
            const taxEl = document.getElementById('fm_tax');
            if (netEl) netEl.value = String(p.net);
            if (taxEl) taxEl.value = String(p.tax);
        });
        applyFmNetDerived();
        if ((type === 'sales' || type === 'purchase') && row && row.dataset.rowFileId && window.savedRowFiles && window.savedRowFiles[row.dataset.rowFileId]) {
            if (!window.uploadedFiles) window.uploadedFiles = {};
            window.uploadedFiles[modalFileId] = JSON.parse(JSON.stringify(window.savedRowFiles[row.dataset.rowFileId]));
        }
    }

    function closeFinanceRowModal() {
        const root = document.getElementById('financeRowModalRoot');
        if (root) {
            root.removeAttribute('data-finance-upload-code');
            root.innerHTML = '';
        }
        financeModalState = null;
    }

    function saveFinanceRowModal() {
        if (!financeModalState) return;
        const type = financeModalState.type;
        const code = financeModalState.code;
        const row = financeModalState.row;
        const prevSnap = (row && row.dataset.rowValues) ? JSON.parse(row.dataset.rowValues) : null;
        const date = document.getElementById('fm_date').value;
        const name = document.getElementById('fm_name').value.trim();
        function parseFmMoney(id) {
            const el = document.getElementById(id);
            const v = el && el.value != null ? String(el.value).trim().replace(/,/g, '') : '';
            if (v === '') return 0;
            const n = parseFloat(v, 10);
            return isNaN(n) ? 0 : n;
        }
        const netN = Math.round(parseFmMoney('fm_net'));
        const taxN = Math.round(parseFmMoney('fm_tax'));
        const grossN = Math.round(parseFmMoney('fm_gross'));
        if (!name && type !== 'sales' && type !== 'payment') {
            alert('상호명은 필수입니다. 금액(vat포함)은 비우거나 0으로 둘 수 있습니다. 일자는 생략할 수 있습니다.');
            return;
        }
        if (name && (type === 'purchase' || type === 'transfer') && !findContractorByName(name)) {
            alert('매입·이체 상호명은 업체정보관리에 등록된 업체만 선택할 수 있습니다.');
            document.getElementById('fm_name').focus();
            return;
        }
        let values;
        if (type === 'sales' || type === 'purchase') {
            const taxbill = document.getElementById('fm_taxbill').value;
            var cMemo = '';
            var iMemo = '';
            if (isExtContractor()) {
                const fm = document.getElementById('fm_memo');
                cMemo = fm ? fm.value.trim() : '';
                iMemo = (prevSnap && prevSnap[8] != null) ? String(prevSnap[8]) : '';
            } else {
                const fc = document.getElementById('fm_memo_contractor');
                const fi = document.getElementById('fm_memo_internal');
                cMemo = fc ? fc.value.trim() : (prevSnap ? String(prevSnap[7] || '') : '');
                iMemo = fi ? fi.value.trim() : '';
            }
            values = [date, name, netN.toLocaleString(), taxN.toLocaleString(), grossN.toLocaleString(), taxbill, '-', cMemo, iMemo, null];
        } else {
            const fm = document.getElementById('fm_memo');
            const memo = fm ? fm.value.trim() : '';
            values = [date, name, netN.toLocaleString(), taxN.toLocaleString(), grossN.toLocaleString(), memo, null];
        }
        ensureMeta(values, type);
        stampMeta(values, type, prevSnap);
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
            mergeRowAttachments(values, type, rowFileId);
        }
        renderFinanceRow(targetRow, type, values, rowFileId);
        api.recalcFinanceSummaries(code);
        api.markPanelDirtyIfChanged();
        scheduleFitProjectDetailModalWidth();
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
        if (isExtContractor()) {
            alert('도급사 계정은 테이블 행을 삭제할 수 없습니다.');
            return;
        }
        if (!financeModalState || !financeModalState.row) return;
        if (!confirm('이 항목을 삭제하시겠습니까?')) return;
        const code = financeModalState.code;
        financeModalState.row.remove();
        api.recalcFinanceSummaries(code);
        api.markPanelDirtyIfChanged();
        scheduleFitProjectDetailModalWidth();
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

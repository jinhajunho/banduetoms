/**
 * 프로젝트 상세 패널 본문 HTML (기존 app.js renderPanelContent)
 * app.js에서 api 주입 후 할당합니다.
 */
export function createRenderPanelContent(api) {
        return function renderPanelContent(item) {
        const isExternalContractorView = api.isCurrentUserExternalContractor();
        const profile = api.getCurrentUserAccessProfile();
        const lockedContractorName = isExternalContractorView
            ? String(profile.contractorName || item.contractor || '').trim()
            : '';
        const canViewSalesTab = !isExternalContractorView;
        const canViewPurchaseTab = item.type === '세금계산서';
        const canViewBusinessTab = !isExternalContractorView && (item.type === '세금계산서' || item.type === '사업소득');
        const canViewProfitTab = !isExternalContractorView && (item.type === '세금계산서' || item.type === '사업소득');
        const allowedTabs = ['basic'];
        if (canViewSalesTab) allowedTabs.push('sales');
        if (canViewPurchaseTab) allowedTabs.push('purchase');
        if (canViewBusinessTab) allowedTabs.push('business');
        if (canViewProfitTab) allowedTabs.push('profit');
        let activePanelTabId = api.getActivePanelTabId();
        if (!allowedTabs.includes(activePanelTabId)) {
            activePanelTabId = canViewPurchaseTab ? 'purchase' : 'basic';
        }
        api.setActivePanelTabId(activePanelTabId);
        const codeLabel = item && item.code ? ` · ${item.code}` : '';
        const bizVals = api.computeBizTaxFromGross(item.businessIncomeGross);
        const profitNetTotals = api.getProfitNetTotalsByCode(item.code, item.revenue, item.purchase, item.businessIncomeGross);
        document.getElementById('sharedPanelTitle').textContent = api.getIsNewEstimate()
            ? ('프로젝트 등록' + (item && item.code ? ` · ${item.code}` : ''))
            : (api.getIsEditMode() ? '프로젝트 수정' + codeLabel : '프로젝트 상세' + codeLabel);
        
        const panelBody = document.getElementById('sharedPanelBody');
        panelBody.className = api.getIsEditMode() ? 'panel-body edit-mode' : 'panel-body view-mode';

        panelBody.innerHTML = `
            <!-- 탭 메뉴 (프로젝트 등록 플로우와 동일 디자인) -->
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
            <div class="new-estimate-tab-pane panel-tab-content ${activePanelTabId === 'basic' ? 'active' : ''} ${api.getBasicInfoEditMode() ? 'basic-info-editing' : ''}" id="tab-basic">
                <div class="panel-section">
                    <div class="panel-section-title panel-section-title--actions">
                        <span>기본정보</span>
                        <span class="basic-info-title-actions" style="${api.getIsNewEstimate() ? 'display:none;' : ''}">
                            <button type="button" class="btn-basic-info-edit" onclick="startBasicInfoEdit()" style="${api.getBasicInfoEditMode() ? 'display:none;' : ''}">수정</button>
                            <button type="button" class="btn-basic-info-save" onclick="saveBasicInfoEdit()" style="${api.getBasicInfoEditMode() ? '' : 'display:none;'}">저장</button>
                            <button type="button" class="btn-basic-info-cancel" onclick="cancelBasicInfoEdit()" style="${api.getBasicInfoEditMode() ? '' : 'display:none;'}">취소</button>
                            <button type="button" class="btn-basic-info-delete" onclick="deleteCurrentEstimate()" style="${api.getBasicInfoEditMode() ? 'display:none;' : ''}">삭제</button>
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
                                    <span class="detail-list-value"><span class="badge ${api.getBadgeClass(item.status)}">${item.status}</span></span>
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
                                        ${api.getCategory1SelectOptionsHtml(item.category1)}
                                    </select>
                                </div>
                            </div>
                            <div class="basic-info-row">
                                <div class="basic-info-label">중분류</div>
                                <div class="basic-info-value">
                                    <span class="detail-list-value">${item.category2}</span>
                                    <select class="form-select form-select-inline edit-input" id="edit_category2" style="display: none;">
                                        ${api.getCategory2SelectOptionsHtml(item.category2)}
                                    </select>
                                </div>
                            </div>
                            <div class="basic-info-row">
                                <div class="basic-info-label">소분류</div>
                                <div class="basic-info-value">
                                    <span class="detail-list-value">${item.category3 || '-'}</span>
                                    <select class="form-select form-select-inline edit-input" id="edit_category3" style="display: none;">
                                        ${api.getCategory3SelectOptionsHtml(item.category3 || '')}
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
                                    <span class="detail-list-value">${isExternalContractorView ? (lockedContractorName || '-') : (item.contractor || '-')}</span>
                                    ${isExternalContractorView ? `
                                    <span class="edit-input" style="display: none; width: 100%;">
                                        <input type="text" class="form-input form-input-inline" readonly value="${api.escapeHtml(lockedContractorName)}" title="외부 도급사 계정은 본인 소속 업체명으로 고정됩니다." style="background: var(--gray-100); cursor: not-allowed;">
                                        <input type="hidden" id="edit_contractor" value="${api.escapeHtml(lockedContractorName)}">
                                    </span>
                                    ` : `
                                    <span class="edit-input" style="display: none; width: 100%;">
                                        <input type="text" class="form-input form-input-inline" id="edit_contractor" list="contractorListEdit" value="${api.escapeHtml(item.contractor || '')}" placeholder="도급사 검색/선택">
                                        <datalist id="contractorListEdit">
                                            ${api.getContractorDatalistOptionsHtml()}
                                        </datalist>
                                    </span>
                                    `}
                                </div>
                            </div>
                            <div class="basic-info-row">
                                <div class="basic-info-label">첨부서류</div>
                                <div class="basic-info-value">
                                    <span class="detail-list-value">${api.getContractorDocsHtml(item.contractor || '')}</span>
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
                                    <th style="width: 100px;">매출일자 <span style="font-weight:400;color:var(--gray-500);">(선택)</span></th>
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
                                    <th style="width: 100px;">수금일자 <span style="font-weight:400;color:var(--gray-500);">(선택)</span></th>
                                    <th>상호명</th>
                                    <th style="width: 100px;">수금금액(vat별도)</th>
                                    <th style="width: 88px;">부가세(vat)</th>
                                    <th style="width: 100px;">수금금액(vat포함)</th>
                                    <th>메모</th>
                                </tr>
                            </thead>
                            <tbody id="salesPayments-${item.code}"></tbody>
                        </table>
                        </div>
                        <div class="payment-summary">
                            <span class="payment-summary-label">총 수금액(vat포함)</span>
                            <span class="payment-summary-value" id="paymentSummary-${item.code}">—</span>
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
                                    <th style="width: 100px;">매입일자 <span style="font-weight:400;color:var(--gray-500);">(선택)</span></th>
                                    <th style="width: 120px;">상호명</th>
                                    <th style="width: 100px;">매입금액(vat별도)</th>
                                    <th style="width: 88px;">부가세(vat)</th>
                                    <th style="width: 100px;">매입금액(vat포함)</th>
                                    <th style="width: 88px;">세금계산서</th>
                                    <th style="width: 88px;">첨부파일</th>
                                    <th style="width: 120px;">메모</th>
                                </tr>
                            </thead>
                            <tbody id="purchaseList-${item.code}"></tbody>
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
                                    <th style="width: 100px;">이체일자 <span style="font-weight:400;color:var(--gray-500);">(선택)</span></th>
                                    <th style="width: 160px;">상호명</th>
                                    <th style="width: 100px;">이체금액(vat별도)</th>
                                    <th style="width: 88px;">부가세(vat)</th>
                                    <th style="width: 100px;">이체금액(vat포함)</th>
                                    <th style="width: 180px;">메모</th>
                                </tr>
                            </thead>
                            <tbody id="transferList-${item.code}"></tbody>
                        </table>
                        </div>
                        <div class="payment-summary">
                            <span class="payment-summary-label">총 이체액(vat포함)</span>
                            <span class="payment-summary-value" id="transferSummary-${item.code}">—</span>
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
                        <span class="basic-info-title-actions" style="${api.getIsNewEstimate() ? 'display:none;' : ''}">
                            <button type="button" class="btn-basic-info-edit" onclick="startBusinessIncomeEdit()" style="${api.getBusinessInfoEditMode() ? 'display:none;' : ''}">수정</button>
                            <button type="button" class="btn-basic-info-save" onclick="saveBusinessIncomeEdit()" style="${api.getBusinessInfoEditMode() ? '' : 'display:none;'}">저장</button>
                            <button type="button" class="btn-basic-info-cancel" onclick="cancelBusinessIncomeEdit()" style="${api.getBusinessInfoEditMode() ? '' : 'display:none;'}">취소</button>
                        </span>
                    </div>
                    <div class="detail-grid" style="max-width:520px;">
                        <div class="detail-row">
                            <div class="detail-label">이체일 <span style="font-weight:400;color:var(--gray-500);font-size:12px;">(선택)</span></div>
                            <div class="detail-value">
                                <input type="date" class="form-input" id="biz_transfer_date" value="${item.businessIncomeTransferDate || ''}" title="선택 입력" ${(!api.getBusinessInfoEditMode() && !api.getIsEditMode() && !api.getIsNewEstimate()) ? 'disabled' : ''}>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">사업소득금액</div>
                            <div class="detail-value">
                                <input type="number" class="form-input" id="biz_gross" placeholder="세전 금액" min="0" step="1" value="${bizVals.gross}" oninput="syncBusinessIncomeDerived();" ${(!api.getBusinessInfoEditMode() && !api.getIsEditMode() && !api.getIsNewEstimate()) ? 'disabled' : ''}>
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
                                    <input type="radio" name="biz_paid" value="지급" ${item.businessIncomePaidStatus === '지급' ? 'checked' : ''} ${(!api.getBusinessInfoEditMode() && !api.getIsEditMode() && !api.getIsNewEstimate()) ? 'disabled' : ''} onchange="markPanelDirtyIfChanged()">
                                    <span>지급</span>
                                </label>
                                <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                                    <input type="radio" name="biz_paid" value="미지급" ${item.businessIncomePaidStatus !== '지급' ? 'checked' : ''} ${(!api.getBusinessInfoEditMode() && !api.getIsEditMode() && !api.getIsNewEstimate()) ? 'disabled' : ''} onchange="markPanelDirtyIfChanged()">
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
        document.getElementById('sharedPanelBtnSave').style.display = 'none';
        document.getElementById('sharedPanelBtnCancel').style.display = 'none';
        const bottomSaveBarEl = document.getElementById('sharedPanelBottomBar');
        if (bottomSaveBarEl) bottomSaveBarEl.style.display = (api.getIsEditMode() || api.getIsNewEstimate()) ? 'flex' : 'none';
        if (api.getIsEditMode() || api.getIsNewEstimate()) {
            api.resetPanelDirtyState();
        }
        if (item && item.code) {
            api.renderFinanceTablesFromItem(item);
            api.recalcFinanceSummaries(item.code);
        }    };
}

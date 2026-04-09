/**
 * 프로젝트 패널 저장 (신규 / 기존 수정) — app.js 상태는 api로 주입
 */
export async function saveEstimateChanges(api) {
    if (api.getIsSavingChanges()) return;
    api.setSaveLoading(true);
    if (api.getIsNewEstimate()) {
        const editDateEl = document.getElementById('edit_date');
        if (editDateEl) api.getCurrentEditItem().date = editDateEl.value;
        const editStatusEl = document.getElementById('edit_status');
        if (editStatusEl) api.getCurrentEditItem().status = editStatusEl.value;
        const editStartDateEl = document.getElementById('edit_startDate');
        if (editStartDateEl) api.getCurrentEditItem().startDate = editStartDateEl.value;
        const editEndDateEl = document.getElementById('edit_endDate');
        if (editEndDateEl) api.getCurrentEditItem().endDate = editEndDateEl.value;
        const editCategory1El = document.getElementById('edit_category1');
        if (editCategory1El) api.getCurrentEditItem().category1 = editCategory1El.value;
        const editCategory2El = document.getElementById('edit_category2');
        if (editCategory2El) api.getCurrentEditItem().category2 = editCategory2El.value;
        const editCategory3El = document.getElementById('edit_category3');
        if (editCategory3El) api.getCurrentEditItem().category3 = editCategory3El.value.trim();
        const editBuildingEl = document.getElementById('edit_building');
        if (editBuildingEl) api.getCurrentEditItem().building = editBuildingEl.value;
        const editProjectEl = document.getElementById('edit_project');
        if (editProjectEl) api.getCurrentEditItem().project = editProjectEl.value;
        const editManagerEl = document.getElementById('edit_manager');
        if (editManagerEl) api.getCurrentEditItem().manager = editManagerEl.value;
        const editTypeEl = document.getElementById('edit_type');
        if (editTypeEl) api.getCurrentEditItem().type = editTypeEl.value;
        if (api.isCurrentUserExternalContractor()) {
            const cn = String(api.getCurrentUserAccessProfile().contractorName || '').trim();
            if (!cn) {
                alert('계정에 연결된 도급사명이 없습니다. 관리자에게 문의하세요.');
                api.setSaveLoading(false);
                return;
            }
            api.getCurrentEditItem().contractor = cn;
        } else {
            const contractorCheck = api.validateContractorSelectionById('edit_contractor');
            if (!contractorCheck.ok) {
                api.setSaveLoading(false);
                return;
            }
            api.getCurrentEditItem().contractor = contractorCheck.value;
        }

        const cur = api.getCurrentEditItem();
        if (!cur || !cur.building || !cur.project) {
            alert('건물명과 공사명은 필수 입력 항목입니다.');
            api.setSaveLoading(false);
            return;
        }

        api.readBusinessIncomeFormIntoItem(cur);

        const newEstimate = {
            code: cur.code,
            date: cur.date,
            status: cur.status,
            startDate: cur.startDate || '',
            endDate: cur.endDate || '',
            category1: cur.category1,
            category2: cur.category2,
            category3: cur.category3 || '',
            building: cur.building,
            project: cur.project,
            manager: cur.manager,
            type: cur.type,
            contractor: cur.contractor,
            revenue: cur.revenue || 0,
            paidStatus: cur.paidStatus,
            purchase: (cur.type === '세금계산서' || cur.type === '사업소득') ? (cur.purchase || 0) : 0,
            taxIssued: !!cur.taxIssued,
            purchaseTaxIssued: api.derivePurchaseTaxIssuedFromRows(cur.purchaseRows || []),
            hasSales: false,
            hasPurchase: false,
            salesRows: cur.salesRows || [],
            paymentRows: cur.paymentRows || [],
            purchaseRows: cur.purchaseRows || [],
            transferRows: cur.transferRows || [],
            businessIncomeTransferDate: cur.businessIncomeTransferDate || '',
            businessIncomeGross: cur.businessIncomeGross || 0,
            businessIncomeNetPay: cur.businessIncomeNetPay || 0,
            businessIncomePaidStatus: cur.businessIncomePaidStatus || '미지급',
            aggregateSalesGross: cur.aggregateSalesGross,
            aggregatePaymentGross: cur.aggregatePaymentGross,
            aggregatePurchaseGross: cur.aggregatePurchaseGross,
            aggregateTransferGross: cur.aggregateTransferGross,
            salesDates: api.deriveSalesDatesFromSalesRows(cur.salesRows || []),
        };
        api.seedEstimateAggregates(newEstimate);

        const remoteNew = await api.upsertEstimateToServer(newEstimate);
        if (!remoteNew.ok) {
            alert(remoteNew.error || '견적 서버 저장 실패');
            api.setSaveLoading(false);
            return;
        }
        api.unshiftEstimate(newEstimate);
        api.setIsPanelDirty(false);
        api.showToast('견적서가 등록되었습니다.');
        api.closePanel(true);
        api.renderTable();
        api.setSaveLoading(false);
    } else {
        const cur = api.getCurrentEditItem();
        if (!cur) {
            api.setSaveLoading(false);
            return;
        }
        if (cur.code) {
            api.recalcFinanceSummaries(cur.code);
        }
        const editDateEl = document.getElementById('edit_date');
        if (editDateEl) cur.date = editDateEl.value;
        cur.status = document.getElementById('edit_status').value;
        const editStartDateEl = document.getElementById('edit_startDate');
        if (editStartDateEl) cur.startDate = editStartDateEl.value;
        const editEndDateEl = document.getElementById('edit_endDate');
        if (editEndDateEl) cur.endDate = editEndDateEl.value;
        cur.category1 = document.getElementById('edit_category1').value;
        cur.category2 = document.getElementById('edit_category2').value;
        const ec3 = document.getElementById('edit_category3');
        cur.category3 = ec3 ? ec3.value.trim() : '';
        cur.building = document.getElementById('edit_building').value;
        cur.project = document.getElementById('edit_project').value;
        cur.manager = document.getElementById('edit_manager').value;
        cur.type = document.getElementById('edit_type').value;
        if (api.isCurrentUserExternalContractor()) {
            const cn2 = String(api.getCurrentUserAccessProfile().contractorName || '').trim();
            if (!cn2) {
                alert('계정에 연결된 도급사명이 없습니다. 관리자에게 문의하세요.');
                api.setSaveLoading(false);
                return;
            }
            cur.contractor = cn2;
        } else {
            const contractorCheck2 = api.validateContractorSelectionById('edit_contractor');
            if (!contractorCheck2.ok) {
                api.setSaveLoading(false);
                return;
            }
            cur.contractor = contractorCheck2.value;
        }
        cur.revenue = parseInt(document.getElementById('edit_revenue').value, 10) || 0;
        cur.paidStatus = document.getElementById('edit_paidStatus').value;
        cur.taxIssued = document.getElementById('edit_taxIssued').value === 'true';

        if (cur.type === '세금계산서') {
            cur.purchase = parseInt(document.getElementById('edit_purchase').value, 10) || 0;
        }
        api.readBusinessIncomeFormIntoItem(cur);

        const index = api.findEstimateIndexByCode(cur.code);
        if (index !== -1) {
            const updated = { ...cur };
            const remoteEdit = await api.upsertEstimateToServer(updated);
            if (!remoteEdit.ok) {
                alert(remoteEdit.error || '견적 서버 저장 실패');
                api.setSaveLoading(false);
                return;
            }
            api.setEstimateAt(index, updated);
        }

        api.setIsEditMode(false);
        api.renderPanelContent(api.getCurrentEditItem());
        api.renderTable();

        api.setIsPanelDirty(false);
        api.showToast('저장되었습니다.');
        api.setSaveLoading(false);
    }
}

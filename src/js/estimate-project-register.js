/**
 * 프로젝트 등록: 신규 패널 열기 (본문·저장은 estimate-panel-content + estimate-save-module)
 */
export function createProjectRegister(api) {
    function openNewEstimate() {
        api.setIsNewEstimate(true);
        api.setIsEditMode(false);
        api.setBasicInfoEditMode(true);

        const yy = String(new Date().getFullYear()).slice(-2);
        const newCode = yy + String(Date.now()).slice(-6);
        const today = new Date().toISOString().slice(0, 10);

        const profile = api.getCurrentUserAccessProfile();
        const isExternalContractor =
            profile.type === 'external' && profile.role === '도급사';
        const contractorInitial = isExternalContractor
            ? String(profile.contractorName || '').trim()
            : '';
        api.setCurrentEditItem({
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
            manager: profile.name || '방준호',
            createdBy: profile.userId || '',
            type: '세금계산서',
            contractor: contractorInitial,
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
        });

        api.renderPanelContent(api.getCurrentEditItem());

        document.getElementById('sharedCenterPanel').classList.add('project-detail-modal');
        document.getElementById('sharedPanelOverlay').classList.add('active');
        document.getElementById('sharedCenterPanel').classList.add('active');
    }

    return {
        openNewEstimate,
    };
}

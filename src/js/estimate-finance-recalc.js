/**
 * 매출/매입/수금/이체 DOM 기준 집계 및 수익분석 요약 갱신
 */
export function createFinanceRecalc(api) {
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

    function recalcFinanceSummaries(code) {
        const salesBody = document.getElementById('salesList-' + code);
        const payBody = document.getElementById('salesPayments-' + code);
        const purchaseBody = document.getElementById('purchaseList-' + code);
        const transferBody = document.getElementById('transferList-' + code);

        const codeKey = api.estimateCodeKey(code);
        const estRow = api.findEstimateByCode(codeKey);
        if (estRow) api.seedEstimateAggregates(estRow);

        let salesTotal = 0, paymentDone = 0, purchaseTotal = 0, transferDone = 0;
        let salesNet = 0, purchaseNet = 0;
        let salesRowCnt = 0, paymentRowCnt = 0, purchaseRowCnt = 0, transferRowCnt = 0;
        if (salesBody) Array.from(salesBody.rows).forEach(function (r) {
            if ((r.getAttribute('data-row-type') || 'sales') !== 'sales') return;
            salesRowCnt++;
            salesTotal += getRowGrossFromValues(r, 4);
            salesNet += getRowNetFromValues(r, 2);
        });
        const salesRowsSnap = salesBody
            ? Array.from(salesBody.rows)
                .filter(function (r) { return (r.getAttribute('data-row-type') || '') === 'sales'; })
                .map(function (r) { return JSON.parse(r.dataset.rowValues || '[]'); })
            : null;
        const salesDates = api.deriveSalesDatesFromSalesRows(
            salesRowsSnap || (estRow && estRow.salesRows) || []
        );
        if (payBody) Array.from(payBody.rows).forEach(function (r) {
            if ((r.getAttribute('data-row-type') || '') !== 'payment') return;
            paymentRowCnt++;
            paymentDone += getRowGrossFromValues(r, 4);
        });
        // 표 DOM이 없는 경우(부분 로드)에는 저장된 집계값 fallback, 표 DOM이 있는데 행이 0이면 실제 0으로 취급
        if (!payBody && estRow) {
            paymentDone = Number(estRow.aggregatePaymentGross) || 0;
        }
        if (purchaseBody) Array.from(purchaseBody.rows).forEach(function (r) {
            if ((r.getAttribute('data-row-type') || 'purchase') !== 'purchase') return;
            purchaseRowCnt++;
            purchaseTotal += getRowGrossFromValues(r, 4);
            purchaseNet += getRowNetFromValues(r, 2);
        });
        if (transferBody) Array.from(transferBody.rows).forEach(function (r) {
            if ((r.getAttribute('data-row-type') || '') !== 'transfer') return;
            transferRowCnt++;
            transferDone += getRowGrossFromValues(r, 4);
        });
        if (!transferBody && estRow) {
            transferDone = Number(estRow.aggregateTransferGross) || 0;
        }

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
            estRow.salesRows = (salesBody ? Array.from(salesBody.rows).filter(r => (r.getAttribute('data-row-type') || '') === 'sales').map(r => JSON.parse(r.dataset.rowValues || '[]')) : (estRow.salesRows || []));
            estRow.paymentRows = (payBody ? Array.from(payBody.rows).filter(r => (r.getAttribute('data-row-type') || '') === 'payment').map(r => JSON.parse(r.dataset.rowValues || '[]')) : (estRow.paymentRows || []));
            estRow.purchaseRows = (purchaseBody ? Array.from(purchaseBody.rows).filter(r => (r.getAttribute('data-row-type') || '') === 'purchase').map(r => JSON.parse(r.dataset.rowValues || '[]')) : (estRow.purchaseRows || []));
            estRow.transferRows = (transferBody ? Array.from(transferBody.rows).filter(r => (r.getAttribute('data-row-type') || '') === 'transfer').map(r => JSON.parse(r.dataset.rowValues || '[]')) : (estRow.transferRows || []));
            if ((estRow.salesRows || []).length > 0) {
                estRow.taxIssued = (estRow.salesRows || []).some(function (r) {
                    return String(r && r[5] ? r[5] : '').trim() === '발행';
                });
            }
            estRow.purchaseTaxIssued = api.derivePurchaseTaxIssuedFromRows(estRow.purchaseRows || []);
            estRow.revenue = salesTotal;
            estRow.purchase = purchaseTotal;
            estRow.paidStatus = api.derivePaidStatusFromAmounts(salesTotal, paymentDone);
        }
        const currentEditItem = api.getCurrentEditItem();
        if (
            currentEditItem &&
            api.estimateCodeKey(currentEditItem.code) === codeKey
        ) {
            currentEditItem.aggregateSalesGross = salesTotal;
            currentEditItem.aggregatePaymentGross = paymentDone;
            currentEditItem.aggregatePurchaseGross = purchaseTotal;
            currentEditItem.aggregateTransferGross = transferDone;
            currentEditItem.salesDates = salesDates;
            currentEditItem.salesRows = (salesBody ? Array.from(salesBody.rows).filter(r => (r.getAttribute('data-row-type') || '') === 'sales').map(r => JSON.parse(r.dataset.rowValues || '[]')) : (currentEditItem.salesRows || []));
            currentEditItem.paymentRows = (payBody ? Array.from(payBody.rows).filter(r => (r.getAttribute('data-row-type') || '') === 'payment').map(r => JSON.parse(r.dataset.rowValues || '[]')) : (currentEditItem.paymentRows || []));
            currentEditItem.purchaseRows = (purchaseBody ? Array.from(purchaseBody.rows).filter(r => (r.getAttribute('data-row-type') || '') === 'purchase').map(r => JSON.parse(r.dataset.rowValues || '[]')) : (currentEditItem.purchaseRows || []));
            currentEditItem.transferRows = (transferBody ? Array.from(transferBody.rows).filter(r => (r.getAttribute('data-row-type') || '') === 'transfer').map(r => JSON.parse(r.dataset.rowValues || '[]')) : (currentEditItem.transferRows || []));
            if ((currentEditItem.salesRows || []).length > 0) {
                currentEditItem.taxIssued = (currentEditItem.salesRows || []).some(function (r) {
                    return String(r && r[5] ? r[5] : '').trim() === '발행';
                });
            }
            currentEditItem.purchaseTaxIssued = api.derivePurchaseTaxIssuedFromRows(currentEditItem.purchaseRows || []);
            currentEditItem.revenue = salesTotal;
            currentEditItem.purchase = purchaseTotal;
            currentEditItem.paidStatus = api.derivePaidStatusFromAmounts(salesTotal, paymentDone);
            const erEl = document.getElementById('edit_revenue');
            if (erEl) erEl.value = String(Math.round(salesTotal));
            const epEl = document.getElementById('edit_purchase');
            if (epEl) epEl.value = String(Math.round(purchaseTotal));
            const psEl = document.getElementById('edit_paidStatus');
            if (psEl) psEl.value = currentEditItem.paidStatus;
            const tiEl = document.getElementById('edit_taxIssued');
            if (tiEl && (currentEditItem.salesRows || []).length > 0) {
                tiEl.value = currentEditItem.taxIssued ? 'true' : 'false';
            }
        }
        let bizGrossForProfit = estRow ? (estRow.businessIncomeGross || 0) : 0;
        const bizInput = document.getElementById('biz_gross');
        if (bizInput && currentEditItem && api.estimateCodeKey(currentEditItem.code) === codeKey && (currentEditItem.type === '세금계산서' || currentEditItem.type === '사업소득' || currentEditItem.type === '세금계산서/사업소득')) {
            bizGrossForProfit = api.computeBizTaxFromGross(bizInput.value).gross;
        }
        updateProfitAnalysisSummary(code, salesNet, purchaseNet, bizGrossForProfit);
        api.renderTable({ preservePage: true });
    }

    return {
        getProfitNetTotalsByCode: getProfitNetTotalsByCode,
        recalcFinanceSummaries: recalcFinanceSummaries,
    };
}

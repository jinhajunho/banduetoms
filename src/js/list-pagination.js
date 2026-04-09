/** 목록 테이블 하단 페이지네이션 (숫자 버튼 + n/m건 표시). handlerName은 window 전역 함수명 문자열. */

export function paginationNumberButtonsHtml(currentPage, totalPages, handlerName) {
    const cur = currentPage;
    const n = totalPages;

    function btn(page, isActive) {
        if (isActive) {
            return '<button type="button" class="btn btn-sm estimate-page-num estimate-page-num--active" aria-current="page">' + page + '</button>';
        }
        return (
            '<button type="button" class="btn btn-secondary btn-sm estimate-page-num" onclick="' +
            handlerName +
            '(' +
            page +
            ')">' +
            page +
            '</button>'
        );
    }

    if (n <= 20) {
        let h = '';
        for (let i = 1; i <= n; i++) h += btn(i, i === cur);
        return h;
    }

    const set = new Set();
    set.add(1);
    set.add(n);
    for (let j = Math.max(2, cur - 2); j <= Math.min(n - 1, cur + 2); j++) set.add(j);
    if (cur <= 5) {
        for (let k = 2; k <= Math.min(6, n - 1); k++) set.add(k);
    }
    if (cur >= n - 4) {
        for (let k = Math.max(2, n - 5); k <= n - 1; k++) set.add(k);
    }

    const sorted = Array.from(set).sort(function (a, b) {
        return a - b;
    });
    let html = '';
    for (let x = 0; x < sorted.length; x++) {
        if (x > 0 && sorted[x] - sorted[x - 1] > 1) {
            html += '<span class="estimate-page-ellipsis" aria-hidden="true">…</span>';
        }
        html += btn(sorted[x], sorted[x] === cur);
    }
    return html;
}

export function updateGenericListPagination(wrapId, infoId, ctrlId, totalItems, totalPages, currentPage, pageSize, handlerName) {
    const wrap = document.getElementById(wrapId);
    const info = document.getElementById(infoId);
    const ctrl = document.getElementById(ctrlId);
    if (!wrap || !info || !ctrl) return;
    if (totalItems === 0) {
        wrap.style.display = 'none';
        return;
    }
    wrap.style.display = '';
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);
    info.textContent = start + '–' + end + ' / ' + totalItems + '건';
    ctrl.innerHTML = paginationNumberButtonsHtml(currentPage, totalPages, handlerName);
}

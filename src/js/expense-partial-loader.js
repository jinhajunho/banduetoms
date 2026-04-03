/** public/partials/page-expenses.html — 경비지출관리 목록 영역 단일 소스(CSV 미리보기·등록/상세 패널은 index.html 유지) */
const PARTIAL_URL = '/partials/page-expenses.html';

export async function ensureExpensePagePartialMounted() {
    const shell = document.getElementById('page-expenses');
    if (!shell || shell.getAttribute('data-expense-page-partial-loaded') === '1') return;
    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('경비지출관리 화면을 불러오지 못했습니다. (' + res.status + ')');
    }
    shell.innerHTML = await res.text();
    shell.setAttribute('data-expense-page-partial-loaded', '1');
}

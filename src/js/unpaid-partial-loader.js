/** public/partials/page-unpaid.html — 미수금 본문 단일 소스 */
const PARTIAL_URL = '/partials/page-unpaid.html';

export async function ensureUnpaidPartialMounted() {
    const shell = document.getElementById('page-unpaid');
    if (!shell || shell.getAttribute('data-unpaid-partial-loaded') === '1') return;
    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('미수금 화면을 불러오지 못했습니다. (' + res.status + ')');
    }
    shell.innerHTML = await res.text();
    shell.setAttribute('data-unpaid-partial-loaded', '1');
}

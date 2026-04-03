/** public/partials/page-sga.html — 판관비관리 목록 단일 소스(CSV 미리보기·등록/상세 패널은 index 유지) */
const PARTIAL_URL = '/partials/page-sga.html';

export async function ensureSgaPagePartialMounted() {
    const shell = document.getElementById('page-sga');
    if (!shell || shell.getAttribute('data-sga-page-partial-loaded') === '1') return;
    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('판관비관리 화면을 불러오지 못했습니다. (' + res.status + ')');
    }
    shell.innerHTML = await res.text();
    shell.setAttribute('data-sga-page-partial-loaded', '1');
}

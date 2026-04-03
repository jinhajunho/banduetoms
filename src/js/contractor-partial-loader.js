/** public/partials/page-contractors.html — 업체정보관리 목록 영역 단일 소스(모달은 index.html 유지) */
const PARTIAL_URL = '/partials/page-contractors.html';

export async function ensureContractorPagePartialMounted() {
    const shell = document.getElementById('page-contractors');
    if (!shell || shell.getAttribute('data-contractor-page-partial-loaded') === '1') return;
    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('업체정보관리 화면을 불러오지 못했습니다. (' + res.status + ')');
    }
    shell.innerHTML = await res.text();
    shell.setAttribute('data-contractor-page-partial-loaded', '1');
}

/** public/partials/page-estimate.html — 프로젝트 관리 본문 단일 소스 */
const PARTIAL_URL = '/partials/page-estimate.html';

export async function ensureEstimatePartialMounted() {
    const shell = document.getElementById('page-estimate');
    if (!shell || shell.getAttribute('data-estimate-partial-loaded') === '1') return;
    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('프로젝트 관리 화면을 불러오지 못했습니다. (' + res.status + ')');
    }
    shell.innerHTML = await res.text();
    shell.setAttribute('data-estimate-partial-loaded', '1');
}

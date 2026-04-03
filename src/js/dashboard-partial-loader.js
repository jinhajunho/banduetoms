/** public/partials/page-dashboard.html — 대시보드 본문 단일 소스 */
const PARTIAL_URL = '/partials/page-dashboard.html';

export async function ensureDashboardPartialMounted() {
    const shell = document.getElementById('page-dashboard');
    if (!shell || shell.getAttribute('data-dashboard-partial-loaded') === '1') return;
    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('대시보드 화면을 불러오지 못했습니다. (' + res.status + ')');
    }
    shell.innerHTML = await res.text();
    shell.setAttribute('data-dashboard-partial-loaded', '1');
}

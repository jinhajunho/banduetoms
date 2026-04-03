/** public/partials/page-weekly.html — 주간보고 본문 단일 소스 */
const PARTIAL_URL = '/partials/page-weekly.html';

export async function ensureWeeklyPartialMounted() {
    const shell = document.getElementById('page-weekly');
    if (!shell || shell.getAttribute('data-weekly-partial-loaded') === '1') return;
    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('주간보고 화면을 불러오지 못했습니다. (' + res.status + ')');
    }
    shell.innerHTML = await res.text();
    shell.setAttribute('data-weekly-partial-loaded', '1');
}

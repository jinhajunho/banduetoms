/** public/partials/page-performance.html — 경영실적관리 본문 단일 소스 (#performanceDatePickerPanel은 index.html에 유지) */
const PARTIAL_URL = '/partials/page-performance.html';

export async function ensurePerformancePartialMounted() {
    const shell = document.getElementById('page-performance');
    if (!shell || shell.getAttribute('data-performance-partial-loaded') === '1') return;
    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('경영실적관리 화면을 불러오지 못했습니다. (' + res.status + ')');
    }
    shell.innerHTML = await res.text();
    shell.setAttribute('data-performance-partial-loaded', '1');
}

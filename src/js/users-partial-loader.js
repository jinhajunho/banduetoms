/** public/partials/page-users.html — 관리자설정(계정·필터값) 단일 소스 */
const PARTIAL_URL = '/partials/page-users.html';

export async function ensureUsersPagePartialMounted() {
    const shell = document.getElementById('page-users');
    if (!shell || shell.getAttribute('data-users-page-partial-loaded') === '1') return;
    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('관리자설정 화면을 불러오지 못했습니다. (' + res.status + ')');
    }
    shell.innerHTML = await res.text();
    shell.setAttribute('data-users-page-partial-loaded', '1');
}

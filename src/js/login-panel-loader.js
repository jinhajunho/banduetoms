/** public/partials/login-panel.html — 로그인 카드 + 브랜드(로고 영역) 단일 소스 */
const PARTIAL_URL = '/partials/login-panel.html';

export async function ensureLoginPanelMounted() {
    const mount = document.getElementById('loginPanelMount');
    if (!mount || mount.getAttribute('data-login-panel-loaded') === '1') return;
    if (document.getElementById('loginForm')) return;

    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('로그인 패널을 불러오지 못했습니다. (' + res.status + ')');
    }
    mount.innerHTML = await res.text();
    mount.setAttribute('data-login-panel-loaded', '1');
}

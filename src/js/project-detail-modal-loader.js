/**
 * public/partials/panel-project-detail-modal.html — 공용 중앙 패널 shell
 * (#sharedPanelOverlay, #sharedCenterPanel, #sharedPanelBody …)
 */
const PARTIAL_URL = '/partials/panel-project-detail-modal.html';

export async function ensureProjectDetailModalMounted() {
    if (document.getElementById('sharedPanelOverlay') && document.getElementById('sharedCenterPanel')) return;
    const res = await fetch(PARTIAL_URL);
    if (!res.ok) {
        throw new Error('공용 중앙 패널을 불러오지 못했습니다. (' + res.status + ')');
    }
    const tpl = document.createElement('template');
    tpl.innerHTML = (await res.text()).trim();
    document.body.appendChild(tpl.content);
}

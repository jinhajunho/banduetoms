import { test, expect } from '@playwright/test';

const hasCreds = !!(process.env.E2E_USER_ID && process.env.E2E_PASSWORD);

test.describe('로그인 후 스모크', () => {
    test.skip(!hasCreds, 'E2E_USER_ID / E2E_PASSWORD 환경 변수를 설정하세요.');

    test('로그인 후 대시보드·해시 네비게이션', async ({ page }) => {
        test.setTimeout(120_000);

        // `login.js`는 `/api/auth/profile-status`를 먼저 호출한다.
        // 이 API는 `SUPABASE_SERVICE_ROLE_KEY`가 없으면 500을 반환하므로,
        // 먼저 사전 체크해서 명확한 가이드를 스킵으로 제공한다.
        const userId = process.env.E2E_USER_ID;
        const profileResp = await page.request.get(
            `/api/auth/profile-status?displayUserId=${encodeURIComponent(userId)}`
        );
        const profileBody = await profileResp.json().catch(() => null);
        if (profileBody?.error && profileBody.error.includes('SUPABASE_SERVICE_ROLE_KEY')) {
            test.skip('SUPABASE_SERVICE_ROLE_KEY를 `.env.local`에 설정하세요. (프로필 조회 API가 실패함)');
        }

        await page.goto('/login.html');

        const userInput = page.locator('#loginUserId');
        const pwInput = page.locator('#loginPassword');
        await expect(userInput).toBeVisible();
        await expect(pwInput).toBeVisible();

        // `login.js`는 Supabase 환경변수가 없으면 입력을 disabled로 만들고 안내 문구를 표시합니다.
        if (await userInput.isDisabled()) {
            const errText = (await page.locator('#loginError').textContent()).trim();
            test.skip(`로그인 입력이 disabled입니다(예상: Supabase VITE_SUPABASE_URL/ANON_KEY 누락). ${errText}`);
        }

        await userInput.fill(process.env.E2E_USER_ID);
        await pwInput.fill(process.env.E2E_PASSWORD);

        // `login.js`는 profile-status에 따라 비밀번호 재설정이 필요하면
        // #loginConfirmWrap을 표시하고 #loginPasswordConfirm 입력이 필요합니다.
        const confirmWrap = page.locator('#loginConfirmWrap');
        const confirmInput = page.locator('#loginPasswordConfirm');
        if (await confirmWrap.isVisible({ timeout: 10_000 }).catch(() => false)) {
            await confirmInput.fill(process.env.E2E_PASSWORD);
        }

        await page.locator('#loginSubmitBtn').click();

        const urlPromise = page.waitForURL(/index\.html#/i, { timeout: 60_000 });
        const errorLocator = page.locator('#loginError');
        const errorPromise = errorLocator
            .filter({ hasText: /.+/ })
            .waitFor({ state: 'visible', timeout: 15_000 })
            .then(() => errorLocator.textContent().then(t => (t || '').trim()))
            .catch(() => '');

        const outcome = await Promise.race([
            urlPromise.then(() => ({ kind: 'url' })),
            errorPromise.then((msg) => ({ kind: 'error', msg })),
        ]);

        if (outcome.kind === 'error') {
            throw new Error(`로그인 실패(화면 오류): ${outcome.msg}`);
        }
        await expect(page.locator('#sidebar')).toBeVisible();
        await expect(page.locator('#page-dashboard')).toBeVisible();

        await page.goto('/index.html#estimate');
        await expect(page.locator('#page-estimate')).toBeVisible();

        await page.goto('/index.html#performance');
        await expect(page.locator('#page-performance')).toBeVisible();
    });
});

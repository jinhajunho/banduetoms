import { test, expect } from '@playwright/test';

test.describe('로그인 페이지', () => {
    test('로그인 폼이 표시된다', async ({ page }) => {
        await page.goto('/login.html');
        await expect(page.locator('#loginForm')).toBeVisible();
        await expect(page.locator('#loginUserId')).toBeVisible();
        await expect(page.locator('#loginPassword')).toBeVisible();
        await expect(page.locator('#loginSubmitBtn')).toBeVisible();
    });
});

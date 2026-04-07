import { defineConfig, devices } from '@playwright/test';

const port = 3000;
/** Vite 기본은 localhost; 127.0.0.1과 해석이 어긋나면 webServer 재사용·요청이 실패할 수 있음 */
const baseURL = `http://localhost:${port}`;

/**
 * E2E: `npm run test:e2e`
 * 인증 시나리오: E2E_USER_ID, E2E_PASSWORD 환경 변수 필요.
 * 로컬은 Supabase용 .env(VITE_SUPABASE_*)로 dev 서버를 띄운 뒤 실행하세요.
 */
export default defineConfig({
    testDir: 'tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'list',
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run dev:e2e',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});

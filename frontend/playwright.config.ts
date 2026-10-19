import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 15000,
    expect: { timeout: 1500 },
    workers: 1,
    retries: 0,
    forbidOnly: true,
    outputDir: './test-results',
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4350',
        channel: 'chrome',
        headless: true,
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npx --no-install ng serve --configuration e2e --host 127.0.0.1 --port 4350',
        url: 'http://127.0.0.1:4350',
        timeout: 25000,
        reuseExistingServer: true,
    },
});

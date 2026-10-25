import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e/integracion',
    testMatch: '**/*.integracion.ts',
    timeout: 60000,
    expect: { timeout: 7000 },
    workers: 1,
    fullyParallel: false,
    retries: 0,
    forbidOnly: true,
    outputDir: './e2e/integracion/salida/resultados',
    reporter: [['list'], ['json', { outputFile: './e2e/integracion/salida/resultados.json' }]],
    use: {
        baseURL: 'http://127.0.0.1:4357',
        launchOptions: { executablePath: '/usr/bin/google-chrome' },
        headless: true,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    webServer: [
        {
            command: 'node e2e/integracion/servidor.cjs api',
            url: 'http://127.0.0.1:3057/api/salud',
            timeout: 30000,
            reuseExistingServer: false,
            gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
        },
        {
            command: 'node e2e/integracion/servidor.cjs angular',
            url: 'http://127.0.0.1:4357',
            timeout: 60000,
            reuseExistingServer: false,
            gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
        },
    ],
});

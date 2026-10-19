import { test, expect } from '@playwright/test';

for (const width of [1440, 768, 390]) {
    test(`operaciones simuladas y detalles a ${width}px @controles`, async ({ page, context }) => {
        await context.route('**/*', ruta => new URL(ruta.request().url()).origin === 'http://127.0.0.1:4350'
            ? ruta.continue() : ruta.abort());
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        const registro = page.getByLabel('Llamadas simuladas');
        await page.getByText('Resultados e historial', { exact: true }).click();
        await page.getByText('LinkedIn — Parcial', { exact: true }).first().click();
        await expect(page.getByText('Nuevas: 3 · Actualizadas: 2', { exact: false }).first()).toBeVisible();
        const historia = page.getByText('ciclo_manual ·', { exact: false });
        await historia.click();
        await expect(page.getByText('Duración: 60000 ms', { exact: false })).toBeVisible();
        await historia.click();
        await expect(page.getByText('Duración: 60000 ms', { exact: false })).toBeHidden();
        await expect(registro).not.toContainText('POST');
        await page.getByText('Resultados e historial', { exact: true }).click();
        await page.getByText('Configuración efectiva de búsquedas', { exact: true }).click();
        await page.getByRole('button', { name: 'Actualizar configuración guardada' }).click();
        await expect(registro).not.toContainText('POST');
        await page.getByText('Configuración efectiva de búsquedas', { exact: true }).click();
        if (width > 768) await page.getByRole('button', { name: 'Scrapear LinkedIn', exact: true }).click();
        else await page.getByRole('button', { name: 'Extraer ofertas de LinkedIn', exact: true }).click();
        await expect(registro).toContainText('POST /scraping/linkedin');
        await page.getByRole('button', { name: 'Evaluar ofertas pendientes con IA' }).click();
        await expect(registro).toContainText('POST /evaluacion/ejecutar');
        await expect(page.getByRole('button', { name: 'Evaluar ofertas pendientes con IA' })).toBeEnabled({ timeout: 4000 });
        await page.getByRole('button', { name: 'Reintentar evaluación de ofertas con error' }).click();
        await expect(registro).toContainText('POST /evaluacion/reintentar-errores');
        await expect(page.getByRole('button', { name: 'Evaluar ofertas pendientes con IA' })).toBeEnabled({ timeout: 4000 });
        await page.getByRole('button', { name: 'Ejecutar ciclo completo de scraping y evaluación' }).click();
        await expect(registro).toContainText('POST /automatizacion/ejecutar');
        await expect(page.getByRole('dialog', { name: 'Ciclo completo en progreso' })).toBeHidden({ timeout: 5000 });
        // Inspeccionar o ejecutar el ciclo manual no debe programar el cron.
        await expect(registro).not.toContainText('POST /automatizacion/iniciar');
        await expect(registro).not.toContainText('PATCH');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

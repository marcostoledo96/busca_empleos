import { expect, test } from '@playwright/test';

const titulo = 'Soporte Técnico Informático JR';
const motivo = 'Confirmar si Active Directory es obligatorio y si contás con esa experiencia.';
const afinidad = /80\s*%/;

test.beforeEach(async ({ context, page }) => {
    await context.route('**/*', ruta => new URL(ruta.request().url()).origin === 'http://127.0.0.1:4350'
        ? ruta.continue() : ruta.abort());
    await page.clock.setFixedTime(new Date('2026-01-15T18:00:00.000Z'));
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const tema of ['light', 'dark'] as const) {
        test(`afinidad por confirmar · ${viewport.width}×${viewport.height} · ${tema}`, async ({ page }, info) => {
            await page.setViewportSize(viewport);
            await page.goto('/?detalle=calibracion-105');
            // El harness monta el dashboard sin App; aplico la misma clase que toggleTema().
            await page.locator('html').evaluate((raiz, oscuro) => raiz.classList.toggle('dark', oscuro), tema === 'dark');
            if (tema === 'dark') await expect(page.locator('html')).toHaveClass(/\bdark\b/);
            else await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
            const filtro = page.getByRole('tab', { name: /por confirmar/i });
            await expect(filtro).toHaveAccessibleName(/por confirmar.*\b1\b/i);
            await filtro.click();
            const movil = viewport.width < 769;
            const oferta = movil
                ? page.getByRole('listitem', { name: `Oferta: ${titulo}`, exact: true })
                : page.getByRole('row').filter({ hasText: titulo });
            const disparador = movil ? oferta : oferta.getByRole('button', { name: `Ver detalle de ${titulo}`, exact: true });
            await expect(disparador).toBeVisible();
            await expect(oferta).toContainText('Buena afinidad · Por confirmar');
            await expect(oferta).toContainText(afinidad);
            await expect(oferta).toContainText(motivo);
            await expect(oferta).not.toContainText(/pendiente de evaluación|aprobada|rechazada/i);
            expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
            await page.screenshot({ path: info.outputPath('listado.png') });

            await disparador.focus();
            await expect(disparador).toBeFocused();
            await page.keyboard.press('Enter');
            const detalle = page.getByRole('dialog');
            await expect(detalle.getByRole('heading', { name: titulo })).toBeVisible();
            await expect(detalle).toContainText(afinidad);
            await expect(detalle).toContainText(motivo);
            await expect(detalle).not.toContainText('No manejás Active Directory');
            await page.screenshot({ path: info.outputPath('detalle.png') });
            await page.keyboard.press('Escape');
            await expect(detalle).toBeHidden();
            await expect(disparador).toBeFocused();

            const registro = await page.getByLabel('Llamadas simuladas').textContent();
            expect(registro).not.toMatch(/(^|\n)(POST|PATCH) /);
        });
    }
}

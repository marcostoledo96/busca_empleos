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
    test(`Kubernetes por confirmar y oferta sin evaluar · ${viewport.width}×${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/?detalle=calibracion-105-kubernetes');
        const confirmacion = page.getByRole('tab', { name: /por confirmar/i });
        const pendientes = page.getByRole('tab', { name: /pendientes/i });
        await expect(confirmacion).toHaveAccessibleName(/por confirmar.*\b1\b/i);
        await expect(pendientes).toHaveAccessibleName(/pendientes.*\b1\b/i);

        const movil = viewport.width < 769;
        const oferta = (tituloOferta: string) => movil
            ? page.getByRole('listitem', { name: `Oferta: ${tituloOferta}`, exact: true })
            : page.getByRole('row').filter({ hasText: tituloOferta });
        const kubernetes = 'Operaciones de plataforma junior';
        const sinDescripcion = 'Oferta sin descripción';
        await confirmacion.click();
        await expect(oferta(sinDescripcion)).toHaveCount(0);
        await expect(oferta(kubernetes)).toContainText('Buena afinidad · Por confirmar');
        await expect(oferta(kubernetes)).toContainText(afinidad);
        await expect(oferta(kubernetes)).toContainText('Confirmar si Kubernetes es obligatorio');
        await (movil ? oferta(kubernetes) : oferta(kubernetes).getByRole('button', { name: `Ver detalle de ${kubernetes}` })).click();
        const detalle = page.getByRole('dialog');
        await expect(detalle).toContainText('80 % de afinidad');
        await detalle.locator('summary', { hasText: 'Ver desglose y evidencias del matching' }).click();
        const duda = detalle.locator('.desglose-por-confirmar');
        await expect(duda.getByText('Kubernetes', { exact: true })).toBeVisible();
        await expect(duda.getByText('El aviso menciona Kubernetes sin indicar si es obligatorio.', { exact: false })).toBeVisible();
        await expect(duda.getByText('Perfil:', { exact: true })).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(detalle).toBeHidden();

        await pendientes.click();
        await expect(oferta(kubernetes)).toHaveCount(0);
        await expect(oferta(sinDescripcion)).toContainText('Sin evaluar');
        await expect(oferta(sinDescripcion)).not.toContainText(/por confirmar|afinidad|fallo técnico/i);
        expect(await page.getByLabel('Llamadas simuladas').textContent()).not.toMatch(/(^|\n)(POST|PATCH) /);
    });

    test(`F6: dashboard con resultados mixtos de la API simulada · ${viewport.width}×${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/?detalle=calibracion-105-f6');
        const confirmacion = page.getByRole('tab', { name: /por confirmar/i });
        const rechazadas = page.getByRole('tab', { name: /rechazadas por IA/i });
        const resumen = page.getByRole('list', { name: 'Resumen de estadísticas' });
        for (const [etiqueta, cantidad] of [['Total', '4'], ['Por confirmar', '2'], ['Rechazadas por IA', '2'], ['Fallos técnicos', '0']]) {
            await expect(resumen.getByRole('listitem').filter({ has: page.getByText(etiqueta, { exact: true }) }))
                .toContainText(new RegExp(`${cantidad}$`));
        }
        await expect(confirmacion).toHaveAccessibleName(/por confirmar.*\b2\b/i);
        await expect(rechazadas).toHaveAccessibleName(/rechazadas por IA.*\b2\b/i);

        const movil = viewport.width < 769;
        const oferta = (nombre: string) => movil
            ? page.getByRole('listitem', { name: `Oferta: ${nombre}`, exact: true })
            : page.getByRole('row').filter({ hasText: nombre });
        const abrir = (nombre: string) => (movil ? oferta(nombre) : oferta(nombre).getByRole('button', { name: `Ver detalle de ${nombre}`, exact: true })).click();
        const detalle = page.getByRole('dialog');
        const detalleEvidencia = detalle.locator('summary', { hasText: 'Ver desglose y evidencias del matching' });
        const confirmables = ['Operaciones de plataforma junior', 'Soporte de clústeres junior'];
        const exclusiones = [['Infraestructura de contenedores junior', 'Kubernetes'], ['Soporte de directorio junior', 'Active Directory']];
        await confirmacion.click();
        for (const [nombre] of exclusiones) await expect(oferta(nombre)).toHaveCount(0);
        for (const nombre of confirmables) {
            await expect(oferta(nombre)).toContainText('Buena afinidad · Por confirmar');
            await expect(oferta(nombre)).toContainText(afinidad);
            await abrir(nombre);
            await expect(detalle).toContainText('80 % de afinidad');
            await expect(detalle).toContainText('0 exclusiones');
            await detalleEvidencia.click();
            const duda = detalle.locator('.desglose-por-confirmar');
            await expect(duda.getByText('Perfil:', { exact: true })).toHaveCount(0);
            if (nombre === confirmables[1]) await expect(detalle).toContainText('Tiempo de espera agotado en el último intento sintético.');
            await page.keyboard.press('Escape');
            await expect(detalle).toBeHidden();
        }

        await rechazadas.click();
        for (const nombre of confirmables) await expect(oferta(nombre)).toHaveCount(0);
        for (const [nombre, tecnologia] of exclusiones) {
            await abrir(nombre);
            await expect(detalle).toContainText(`Ausencia confirmada de experiencia con ${tecnologia}.`);
            await expect(detalle).toContainText('1 exclusiones');
            await detalleEvidencia.click();
            await expect(detalle.locator('.desglose-en-contra')).toContainText(`Declaré que no tengo experiencia con ${tecnologia}.`);
            await page.keyboard.press('Escape');
            await expect(detalle).toBeHidden();
        }
        expect(await page.getByLabel('Llamadas simuladas').textContent()).not.toMatch(/(^|\n)(POST|PATCH) /);
    });

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

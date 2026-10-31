import { test, expect, Page, Locator } from '@playwright/test';
// Mantengo expectativas independientes para no cargar módulos Angular en el runner Node.
const urlsBumeran71 = ['programador', 'qa', 'tester', 'desarrollador', 'full-stack', 'frontend', 'soporte-tecnico', 'help-desk', 'it', 'support']
    .map(termino => `https://www.bumeran.com.ar/empleos-busqueda-${termino}.html`);
const errorBumeran71 = {
    mensaje: 'El proveedor rechazó el inicio del Actor. No recibí un run ID; no intenté cancelación remota.',
};
const mensajeExtenso = 'DiagnosticoSinteticoSinEspacios'.repeat(18);

const etapa = process.env['ISSUE58_CAPTURA'] === 'antes' ? 'antes' : 'despues';
const estado = (page: Page) => page.getByLabel('Estado operativo de búsquedas');
const avisos = (page: Page) => page.getByLabel('Avisos operativos de búsquedas');

async function comprobarTextoCompleto(elemento: Locator) {
    await expect(elemento).toBeVisible();
    expect(await elemento.evaluate(nodo => {
        const caja = nodo.getBoundingClientRect();
        const estilo = getComputedStyle(nodo);
        const rango = document.createRange();
        rango.selectNodeContents(nodo);
        return { dentro: caja.left >= -1 && caja.right <= innerWidth + 1,
            contenido: nodo.scrollWidth <= nodo.clientWidth + 1,
            alto: nodo.scrollHeight <= nodo.clientHeight + 1,
            lineas: [...rango.getClientRects()].every(rect => rect.left >= -1 && rect.right <= innerWidth + 1),
            recorte: estilo.textOverflow === 'ellipsis' || estilo.webkitLineClamp !== 'none' && estilo.webkitLineClamp !== '' };
    })).toMatchObject({ dentro: true, contenido: true, alto: true, lineas: true, recorte: false });
}

test.beforeEach(async ({ context }) => {
    // También bloqueo cualquier solicitud que escapara accidentalmente del interceptor Angular.
    await context.route('**/*', ruta => new URL(ruta.request().url()).origin === 'http://127.0.0.1:4350'
        ? ruta.continue() : ruta.abort());
});

const escenarios = ['normal', 'advertencias', 'getonbrd', 'historial', 'sincronizacion', 'parcial',
    'fallido', 'en-curso', 'recuperacion', 'configuracion', 'conservado', 'inactiva', 'extenso', 'multiples'];
for (const escenario of escenarios) {
    test(`issue58 escenario ${escenario}`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 844 });
        await page.goto(`/?issue58=${escenario}`);
        await expect(estado(page)).toBeVisible();
        await expect(avisos(page)).not.toHaveAttribute('open');
        await page.screenshot({ path: `.angular/issue58/${etapa}-${escenario}-320.png`, fullPage: true });
        if (escenario === 'en-curso') {
            await expect(estado(page)).toContainText('Último ciclo: En curso');
            await expect(estado(page)).toContainText('Resultado anterior conservado');
            await expect(page.getByRole('dialog', { name: 'Ciclo completo en progreso' })).toBeVisible();
        } else {
            const resumen = avisos(page).locator('summary').first();
            await resumen.focus();
            await page.keyboard.press('Tab');
            await page.keyboard.press('Shift+Tab');
            await expect(resumen).toBeFocused();
            expect(await resumen.evaluate(nodo => {
                const estilo = getComputedStyle(nodo);
                return estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 2;
            })).toBe(true);
            await page.keyboard.press('Enter');
            await expect(avisos(page)).toHaveAttribute('open', '');
            await page.keyboard.press('Enter');
            await expect(avisos(page)).not.toHaveAttribute('open');
        }
        if (escenario === 'historial') {
            await expect(estado(page).getByRole('alert')).toContainText('No pude actualizar el historial');
        }
        if (['sincronizacion', 'recuperacion'].includes(escenario)) {
            const alerta = page.locator('.dashboard__sincronizacion').getByRole('alert');
            await expect(alerta).toContainText('Servicio de sincronización sintético no disponible');
            await comprobarTextoCompleto(alerta);
            await expect(page.getByRole('button', { name: 'REINTENTAR', exact: true })).toBeVisible();
            if (escenario === 'recuperacion') {
                await page.getByRole('button', { name: 'REINTENTAR', exact: true }).click();
                await expect(page.locator('.dashboard__sincronizacion')).toContainText('completada');
                await expect(alerta).toHaveCount(0);
                await expect(page.getByText('Servicio de sincronización sintético no disponible', { exact: false })).toHaveCount(0);
            }
        }
        if (['parcial', 'multiples'].includes(escenario)) {
            await expect(estado(page)).toContainText('Último ciclo: Parcial');
            await expect(estado(page)).toContainText('Cuota sintética agotada');
            await expect(estado(page).getByRole('alert')).toHaveCount(0);
            await expect(avisos(page)).not.toContainText('Cuota sintética agotada');
        }
        if (escenario === 'fallido') await expect(estado(page).getByRole('alert').filter({ hasText: 'LinkedIn' }).first()).toBeVisible();
        if (escenario === 'configuracion') await expect(estado(page).getByRole('alert')).toContainText('No pude consultar la configuración');
        if (escenario === 'conservado') {
            await page.getByText('Resultados e historial', { exact: true }).click();
            const ejecucion = page.getByText('ciclo_manual ·', { exact: false });
            await expect(ejecucion).toBeVisible();
            await page.getByRole('button', { name: 'Actualizar historial', exact: true }).click();
            await expect(estado(page).getByRole('alert')).toContainText('Conservo la lista anterior');
            await expect(ejecucion).toBeVisible();
        }
        if (['advertencias', 'getonbrd', 'inactiva', 'extenso'].includes(escenario)) {
            await avisos(page).locator('summary').first().click();
            await expect(avisos(page)).toContainText('GETONBRD_ENABLED=true');
            await expect(avisos(page)).toContainText('Desactivado por costo y baja utilidad');
            await expect(avisos(page)).toContainText('No aplico maxResultados');
            await expect(avisos(page)).toContainText('límite estricto');
            await expect(avisos(page)).toContainText('Remotive no dispone de categoría para: administrativo de salud');
            await expect(avisos(page)).toContainText('RemoteOK no dispone de etiquetas compatibles');
            await expect(page.getByRole('button', { name: 'Scrapear GetOnBrd', exact: true, includeHidden: true })).toBeDisabled();
            await expect(page.getByRole('button', { name: 'Scrapear Google Jobs', exact: true })).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Scrapear InfoJobs', exact: true })).toHaveCount(0);
            if (escenario === 'extenso') {
                await comprobarTextoCompleto(avisos(page).getByText(mensajeExtenso, { exact: false }).first());
                await page.screenshot({ path: `.angular/issue58/${etapa}-extenso-abierto-320.png`, fullPage: true });
            }
        }
        if (escenario === 'multiples') {
            await expect(estado(page)).toContainText('Angular');
            await expect(estado(page)).toContainText('React');
            await expect(estado(page).getByText('Consulta sintética no disponible', { exact: false })).toHaveCount(2);
        }
        await expect(page.getByLabel('Llamadas simuladas')).not.toContainText('POST');
        await expect(page.getByLabel('Llamadas simuladas')).not.toContainText('PATCH');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

for (const [width, height, tema] of [[320, 844, 'claro'], [360, 800, 'oscuro'], [390, 844, 'claro'],
    [768, 900, 'oscuro'], [1440, 900, 'claro']] as const) {
    test(`issue58 geometría y toast ${width} ${tema}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce' });
        await context.route('**/*', ruta => new URL(ruta.request().url()).origin === 'http://127.0.0.1:4350'
            ? ruta.continue() : ruta.abort());
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:4350/?issue58=extenso&tema=${tema}`);
        const resumen = avisos(page).locator('summary').first();
        await resumen.tap();
        await comprobarTextoCompleto(avisos(page).getByText(mensajeExtenso, { exact: false }).first());
        expect((await resumen.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `.angular/issue58/${etapa}-avisos-${width}-${tema}.png`, fullPage: true });
        await resumen.tap();
        const extraer = page.getByRole('button', { name: width > 768 ? 'Scrapear LinkedIn' : 'Extraer ofertas de LinkedIn', exact: true });
        expect((await extraer.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await extraer.tap();
        const toast = page.locator('app-panel-control .p-toast-message').last();
        await comprobarTextoCompleto(toast);
        await comprobarTextoCompleto(toast.locator('.p-toast-detail'));
        expect(await toast.locator('.p-toast-detail').textContent()).toContain(mensajeExtenso);
        await page.screenshot({ path: `.angular/issue58/${etapa}-toast-${width}-${tema}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await context.close();
    });
}

test('issue71: HTTP403 compartido por diez URLs mantiene resumen y detalle móvil', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/?issue58=bumeran-403');
    const resumen = estado(page).getByText('Bumeran · Ciclo: Error · http', { exact: true });
    await expect(resumen).toBeVisible();
    await expect(resumen).not.toContainText('https://');
    const evento = estado(page).locator('p').filter({ hasText: 'http 403' });
    await expect(evento).toHaveCount(1);
    await expect(evento).toContainText(errorBumeran71.mensaje);
    await expect(estado(page)).not.toContainText('cancelacion_no_confirmada');
    for (const url of urlsBumeran71) await expect(evento).toContainText(url);
    await comprobarTextoCompleto(evento);
    const detalles = page.getByLabel('Resultados e historial');
    await expect(detalles).not.toHaveAttribute('open');
    await detalles.locator('summary').first().click();
    await expect(detalles).toHaveAttribute('open', '');
    for (const url of urlsBumeran71) await expect(detalles).toContainText(url);
    await expect(page.getByLabel('Llamadas simuladas')).not.toContainText('POST');
    await expect(page.getByLabel('Llamadas simuladas')).not.toContainText('PATCH');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('issue58 sin ejecuciones, cancelado, 202 y recuperación alternativa', async ({ page }) => {
    await page.goto('/?issue58=sin-ejecuciones');
    await expect(estado(page)).toContainText('Último ciclo: Sin ejecuciones');
    await page.goto('/?issue58=cancelado');
    await expect(estado(page)).toContainText('Último ciclo: Cancelada');
    await page.goto('/?issue58=alternativa');
    await expect(page.locator('.dashboard__mensaje').first()).toContainText('vía alternativa');
    await expect(page.locator('.dashboard__sincronizacion').getByRole('alert')).toHaveCount(0);
    await page.goto('/?issue58=normal');
    await page.getByRole('button', { name: 'Ejecutar ciclo completo de scraping y evaluación' }).click();
    await expect(estado(page)).toContainText('Último ciclo: En curso');
    await expect(estado(page)).toContainText('Resultado anterior conservado');
    await expect(page.getByRole('dialog', { name: 'Ciclo completo en progreso' })).toBeVisible();
});

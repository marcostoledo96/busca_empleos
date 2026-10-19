import { test, expect } from '@playwright/test';

const tamanos = [
    { width: 1440, height: 900 }, { width: 1366, height: 768 },
    { width: 1024, height: 768 }, { width: 768, height: 900 },
    { width: 390, height: 844 }, { width: 320, height: 844 },
];

test.beforeEach(async ({ context, page }) => {
    // Sólo permito recursos del servidor local. El interceptor del fixture no llama al backend.
    await context.route('**/*', ruta => new URL(ruta.request().url()).origin === 'http://127.0.0.1:4350'
        ? ruta.continue() : ruta.abort());
    await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
            document.documentElement.classList.toggle('dark', new URLSearchParams(location.search).get('tema') === 'oscuro');
        });
    });
});

test('matriz sintética @evidencia', async ({ page }) => {
    test.setTimeout(25000);
    for (const tema of ['claro', 'oscuro']) {
        for (const tamano of tamanos) {
            await page.setViewportSize(tamano);
            await page.goto(`/?tema=${tema}`);
            await expect(page.getByRole('heading', { name: 'OFERTAS_DISPONIBLES' })).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            await page.addStyleTag({ content: '*,*::before,*::after { animation: none !important; transition: none !important; }' });
            await page.screenshot({ path: `.angular/issue51-historico/dashboard/${process.env['EVIDENCIA48'] || 'despues'}-${tamano.width}-${tema}.png`, fullPage: true });
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            console.log(JSON.stringify({ tema, ancho: tamano.width, ...await page.evaluate(() => ({
                altoPanel: document.querySelector('.panel')!.getBoundingClientRect().height,
                inicioListado: document.querySelector('.resultados')!.getBoundingClientRect().top + scrollY,
            })) }));
        }
    }
});

test('detalles abiertos y objetivos táctiles en toda la matriz @responsive', async ({ page }) => {
    test.setTimeout(25000);
    for (const tema of ['claro', 'oscuro']) {
        await page.goto(`/?tema=${tema}`);
        await page.getByText('Configuración efectiva de búsquedas', { exact: true }).click();
        await page.getByText('Configuración guardada actual', { exact: true }).click();
        await page.getByText('Resultados e historial', { exact: true }).click();
        await page.getByText('LinkedIn — Parcial', { exact: true }).first().click();
        await page.getByText('ciclo_manual ·', { exact: false }).click();
        for (const tamano of tamanos) {
            await page.setViewportSize(tamano);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            const controles = page.locator('app-panel-control button:visible, .panel-diagnosticos summary:visible, .dashboard__sincronizacion summary');
            for (const control of await controles.all()) {
                const caja = await control.boundingBox();
                expect(caja!.height).toBeGreaterThanOrEqual(44);
                expect(caja!.x).toBeGreaterThanOrEqual(0);
                expect(caja!.x + caja!.width).toBeLessThanOrEqual(tamano.width);
            }
        }
    }
});

test('título completo a 320px con fallback ancho @fallback320', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    for (const tema of ['claro', 'oscuro']) {
        await page.goto(`/?tema=${tema}`);
        await expect(page.getByRole('heading', { name: 'OFERTAS_DISPONIBLES' })).toBeVisible();
        // Reproduzco una fuente de sistema más ancha sin alterar tamaño, espaciado ni viewport.
        await page.addStyleTag({ content: '.dashboard-titulo { font-family: "DejaVu Sans", sans-serif !important; }' });
        await page.evaluate(() => document.fonts.ready);
        for (const abierto of [false, true]) {
            if (abierto) {
                await page.getByText('Configuración efectiva de búsquedas', { exact: true }).click();
                await page.getByText('Configuración guardada actual', { exact: true }).click();
                await page.getByText('Resultados e historial', { exact: true }).click();
            }
            const medidas = await page.getByRole('heading', { name: 'OFERTAS_DISPONIBLES' }).evaluate(titulo => {
                const rango = document.createRange();
                rango.selectNodeContents(titulo);
                return {
                    anchoPagina: document.documentElement.scrollWidth, viewport: innerWidth,
                    fuente: getComputedStyle(titulo).fontFamily,
                    caja: titulo.getBoundingClientRect().toJSON(),
                    fragmentos: Array.from(rango.getClientRects(), rect => rect.toJSON()),
                };
            });
            console.log(JSON.stringify({ tema, abierto, ...medidas }));
            await page.getByRole('heading', { name: 'OFERTAS_DISPONIBLES' }).scrollIntoViewIfNeeded();
            await page.screenshot({ path: `.angular/issue51-historico/dashboard/fallback320-${tema}-${abierto ? 'abierto' : 'cerrado'}.png` });
            expect(medidas.anchoPagina).toBeLessThanOrEqual(medidas.viewport);
            for (const fragmento of medidas.fragmentos) {
                expect(fragmento.left).toBeGreaterThanOrEqual(medidas.caja.left);
                expect(fragmento.right).toBeLessThanOrEqual(medidas.caja.right);
            }
            await expect(page.getByRole('heading', { name: 'OFERTAS_DISPONIBLES' })).toHaveText('OFERTAS_DISPONIBLES');
            await expect(page.getByLabel('Total', { exact: true })).toHaveText('25');
        }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const titulo = page.getByRole('heading', { name: 'OFERTAS_DISPONIBLES' });
    await expect(titulo).toHaveCSS('font-size', '40px');
    expect(await titulo.evaluate(elemento => {
        const rango = document.createRange();
        rango.selectNodeContents(elemento);
        return rango.getClientRects().length;
    })).toBe(1);
});

test('acciones primero y diagnósticos cerrados @regresion', async ({ page }) => {
    await page.goto('/');
    const configuracion = page.getByText('Configuración efectiva de búsquedas', { exact: true });
    await expect(page.getByRole('button', { name: 'Actualizar configuración guardada' })).toBeHidden();
    await expect(configuracion).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actualizar historial', exact: true })).toBeHidden();
    const accion = await page.getByRole('button', { name: 'Ejecutar ciclo completo de scraping y evaluación' }).boundingBox();
    const diagnostico = await configuracion.boundingBox();
    expect(accion!.y).toBeLessThan(diagnostico!.y);
});

test('resumen crítico visible sin abrir detalles @regresion', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Cuota del proveedor agotada', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Límite de peticiones alcanzado', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Falta la clave del proveedor; no puedo ejecutar esta fuente.', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Último ciclo: Parcial', { exact: false }).first()).toBeVisible();
});

test('divulgación por teclado no ejecuta operaciones @preservar', async ({ page }) => {
    await page.goto('/');
    const resumen = page.getByText('Configuración efectiva de búsquedas', { exact: true });
    await resumen.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Actualizar configuración guardada' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Actualizar configuración guardada' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(resumen).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Actualizar configuración guardada' })).toBeHidden();
    await page.getByText('Resultados e historial', { exact: true }).click();
    await page.getByRole('button', { name: 'Actualizar historial', exact: true }).click();
    await page.getByText('Registro del fixture', { exact: true }).click();
    await expect(page.getByLabel('Llamadas simuladas')).not.toContainText('POST');
    await expect(page.getByLabel('Llamadas simuladas')).not.toContainText('PATCH');
    await expect(page.getByText('ciclo_manual ·', { exact: false })).toBeVisible();
});

test('contadores, pestañas, filtro y apertura de oferta @preservar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Total', { exact: true })).toHaveText('25');
    await expect(page.getByLabel('Aprobadas', { exact: true })).toHaveText('10');
    await page.getByRole('tab', { name: /PENDIENTES/ }).click();
    await expect(page.getByRole('tab', { name: /PENDIENTES/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /^APROBADAS/ }).click();
    await page.getByRole('combobox', { name: 'FILTRAR POR PLATAFORMA' }).click();
    await page.getByRole('option', { name: 'LinkedIn', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'FILTRAR POR PLATAFORMA' })).toContainText('LinkedIn');
    await page.getByRole('button', { name: /detalle/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
});

for (const estado of ['vacio', 'error', 'cargando', 'completado']) {
    test(`estado ${estado} @estados`, async ({ page }) => {
        await page.goto(`/?estado=${estado}`);
        if (estado === 'error') {
            await expect(page.getByRole('alert').filter({ hasText: /No pude/ }).first()).toBeVisible();
            await expect(page.getByText('Estado de sincronización: fallida.', { exact: false })).toBeVisible();
        } else if (estado === 'cargando') {
            await expect(page.getByText('Sincronizando ofertas:', { exact: false })).toBeVisible();
            await expect(page.getByRole('progressbar', { name: /Progreso de evaluación/ })).toBeVisible();
        } else if (estado === 'vacio') {
            await expect(page.getByLabel('Total', { exact: true })).toHaveText('0');
            await page.getByText('Resultados e historial', { exact: true }).click();
            await expect(page.getByText('No hay ejecuciones recientes.')).toBeVisible();
        } else {
            await expect(page.getByText('Último ciclo: Completada', { exact: false }).first()).toBeVisible();
        }
    });
}

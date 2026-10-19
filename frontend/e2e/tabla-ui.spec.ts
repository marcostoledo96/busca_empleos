import { test, expect, Page } from '@playwright/test';
const FECHA_TABLA = '2026-10-19T12:00:00.000Z';

const vista = (page: Page) => page.locator('.vista-desktop:visible, .vista-mobile:visible');
const tarjetas = (page: Page) => page.locator('.card-oferta:visible');
const filas = (page: Page) => page.locator('.p-datatable-tbody:visible > tr');
const buscar = (page: Page) => vista(page).getByRole('textbox');
const seleccionPagina = (page: Page) => vista(page).getByRole('checkbox', { name: 'Seleccionar ofertas de esta página', exact: true });
const barra = (page: Page) => page.getByRole('toolbar', { name: 'Acciones masivas sobre ofertas seleccionadas' });
const reevaluacion = (page: Page) => page.getByRole('region', { name: 'Volver a evaluar ofertas seleccionadas', exact: true });
const escrituras = async (page: Page): Promise<{ metodo: string; ruta: string; cuerpo: unknown }[]> =>
    JSON.parse(await page.getByLabel('Cuerpos simulados').textContent() || '[]');

async function iniciar(page: Page, parametros = 'tabla=1') {
    await page.goto(`/?${parametros}`);
    await page.getByText('Registro del fixture', { exact: true }).click();
    await expect(vista(page)).toHaveCount(1);
}

async function filtrarAngular(page: Page, sufijo = '') {
    await buscar(page).fill(`Angular junior${sufijo}`);
    // PrimeNG difiere el filtro desktop; espero su DOM incluso en la vista móvil.
    const tablaActiva = vista(page).locator('..').locator('.p-datatable-tbody > tr');
    await expect(tablaActiva).toHaveCount(sufijo ? 1 : 20);
    await expect(tablaActiva).toContainText(Array(sufijo ? 1 : 20).fill(`Angular junior${sufijo}`));
}

async function destinoBulk(page: Page, nombre = 'CV enviado') {
    await barra(page).getByRole('combobox').click();
    await page.getByRole('option', { name: nombre, exact: true }).click();
}

async function sinDesborde(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ context, page }) => {
    await context.route('**/*', ruta => new URL(ruta.request().url()).origin === 'http://127.0.0.1:4350' ? ruta.continue() : ruta.abort());
    await page.clock.setFixedTime(new Date(FECHA_TABLA));
});

test('búsqueda desktop por título, empresa, ubicación, acentos, mayúsculas y espacios conserva contains', async ({ page }) => {
    await iniciar(page);
    for (const [texto, cantidad] of [['ANGULAR JUNIOR', 20], ['tecnologia del rio', 1], ['CORDOBA', 1], [' ', 20]] as const) {
        await buscar(page).fill(texto);
        await expect(filas(page)).toHaveCount(cantidad);
    }
    await buscar(page).fill(' Angular ');
    await expect(vista(page).getByRole('status')).toContainText('No hay ofertas que coincidan');
    await vista(page).getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(buscar(page)).toHaveValue('');
    await expect(filas(page)).toHaveCount(20);
    expect(await escrituras(page)).toEqual([]);
});

test('plataforma, pestaña, ordenamiento y búsqueda invalidan selección sin escrituras', async ({ page }) => {
    await iniciar(page);
    await filtrarAngular(page);
    await seleccionPagina(page).check();
    await expect(barra(page)).toContainText('20 ofertas seleccionadas');
    await page.getByRole('combobox', { name: 'FILTRAR POR PLATAFORMA', exact: true }).click();
    await page.getByRole('option', { name: 'LinkedIn', exact: true }).click();
    await expect(barra(page)).toBeHidden();
    await expect(filas(page).locator('.columna-plataforma .tag-plataforma')).toHaveText(Array(20).fill('LINKEDIN'));
    await seleccionPagina(page).check();
    await page.getByRole('tab', { name: /RECHAZADAS POR IA/ }).click();
    await expect(barra(page)).toBeHidden();
    await expect(filas(page)).toHaveCount(1);
    await page.getByRole('tab', { name: /APROBADAS/ }).click();
    await seleccionPagina(page).check();
    await vista(page).getByRole('columnheader', { name: /TÍTULO/ }).click();
    await expect(barra(page)).toBeHidden();
    await expect(vista(page).getByRole('columnheader', { name: /TÍTULO/ })).toHaveAttribute('aria-sort', 'ascending');
    await seleccionPagina(page).check();
    await buscar(page).fill('Córdoba');
    await expect(barra(page)).toBeHidden();
    await expect(filas(page)).toHaveCount(1);
    expect(await escrituras(page)).toEqual([]);
});

test('página desktop final parcial y payload masivo sólo de sus cinco IDs visibles', async ({ page }) => {
    await iniciar(page);
    await filtrarAngular(page);
    await seleccionPagina(page).check();
    await vista(page).locator('.p-paginator-next').click();
    await expect(barra(page)).toBeHidden();
    await vista(page).locator('.p-paginator-next').click();
    await expect(filas(page)).toHaveCount(5);
    await seleccionPagina(page).check();
    await expect(barra(page)).toContainText('5 ofertas seleccionadas');
    await destinoBulk(page);
    await barra(page).getByRole('button', { name: 'Aplicar acción masiva' }).click();
    await expect(page.getByText('Acción masiva guardada', { exact: true })).toBeVisible();
    expect(await escrituras(page)).toEqual([{ metodo: 'PATCH', ruta: '/ofertas/bulk/postulacion',
        cuerpo: { ids: [1041,1042,1043,1044,1045], estado_postulacion: 'cv_enviado' } }]);
    await expect(barra(page)).toBeHidden();
});

test('ambas barras independientes, cancelación, error recuperable y no doble envío', async ({ page }) => {
    await iniciar(page, 'tabla=1&errorBulk=1');
    await filtrarAngular(page, ' 01');
    await expect(barra(page)).toBeHidden();
    await seleccionPagina(page).check();
    await expect(reevaluacion(page)).toContainText('1 oferta seleccionada');
    await expect(barra(page)).toContainText('1 oferta seleccionada');
    await destinoBulk(page);
    await barra(page).getByRole('button', { name: 'Cancelar selección masiva' }).click();
    await expect(barra(page)).toBeHidden();
    expect(await escrituras(page)).toEqual([]);
    await seleccionPagina(page).check();
    await destinoBulk(page);
    const aplicar = barra(page).getByRole('button', { name: 'Aplicar acción masiva' });
    await aplicar.dblclick();
    await expect(page.getByText('Acción masiva no guardada', { exact: true })).toBeVisible();
    await expect(barra(page)).toContainText('1 oferta seleccionada');
    expect(await escrituras(page)).toHaveLength(1);
    await aplicar.click();
    await expect(page.getByText('Acción masiva guardada', { exact: true })).toBeVisible();
    expect(await escrituras(page)).toHaveLength(2);
    expect((await escrituras(page)).map(p => p.cuerpo)).toEqual(Array(2).fill({ ids: [1001], estado_postulacion: 'cv_enviado' }));
    await expect(barra(page)).toBeHidden();
    await expect(reevaluacion(page)).toBeHidden();
});

test('reevaluación exige confirmar, cancelar no escribe y un doble clic envía una sola vez', async ({ page }) => {
    await iniciar(page);
    await filtrarAngular(page, ' 01');
    await seleccionPagina(page).check();
    await reevaluacion(page).getByRole('button', { name: 'Volver a evaluar seleccionadas', exact: true }).click();
    const confirmacion = page.getByRole('region', { name: 'Confirmar reevaluación', exact: true });
    await expect(confirmacion).toContainText('llamadas pagas');
    await confirmacion.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(await escrituras(page)).toEqual([]);
    await reevaluacion(page).getByRole('button', { name: 'Volver a evaluar seleccionadas', exact: true }).click();
    await confirmacion.getByRole('button', { name: 'Confirmar reevaluación', exact: true }).dblclick();
    await expect(confirmacion).toBeHidden();
    const peticiones = await escrituras(page);
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0].ruta).toBe('/evaluacion/ejecutar');
    expect(peticiones[0].cuerpo).toMatchObject({ ids: [1001] });
});

for (const ancho of [390, 320]) {
    test(`tarjetas ${ancho}: selección, dropdown, teclado, modal Escape y página parcial`, async ({ page }) => {
        await page.setViewportSize({ width: ancho, height: 844 });
        await iniciar(page);
        await filtrarAngular(page);
        await expect(tarjetas(page)).toHaveCount(20);
        const tarjeta = tarjetas(page).first();
        const checkbox = tarjeta.getByRole('checkbox');
        await checkbox.focus();
        await checkbox.press('Space');
        await expect(checkbox).toBeChecked();
        await expect(page.getByRole('dialog')).toBeHidden();
        const seleccion = await tarjeta.locator('label').boundingBox();
        expect(seleccion!.width).toBeGreaterThanOrEqual(44);
        expect(seleccion!.height).toBeGreaterThanOrEqual(44);
        const selector = tarjeta.getByRole('combobox');
        await selector.focus();
        await selector.press('Space');
        await expect(page.getByRole('option', { name: 'CV enviado', exact: true })).toBeVisible();
        await expect(page.getByRole('dialog')).toBeHidden();
        const overlay = page.locator('.p-select-overlay:visible');
        expect(await overlay.evaluate(e => !e.closest('.card-oferta'))).toBe(true);
        const limites = await overlay.boundingBox();
        expect(limites!.x).toBeGreaterThanOrEqual(0);
        expect(limites!.x + limites!.width).toBeLessThanOrEqual(ancho);
        await page.keyboard.press('Escape');
        await expect(selector).toBeFocused();
        for (const tecla of ['Enter', 'Space']) {
            await tarjeta.focus();
            await tarjeta.press(tecla);
            await expect(page.getByRole('dialog')).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(page.getByRole('dialog')).toBeHidden();
            await expect(tarjeta).toBeFocused();
        }
        await vista(page).getByRole('button', { name: 'Ir a página 3' }).click();
        await expect(barra(page)).toBeHidden();
        await expect(tarjetas(page)).toHaveCount(5);
        await seleccionPagina(page).check();
        await expect(barra(page)).toContainText('5 ofertas seleccionadas');
        await buscar(page).fill('Angular junior 01');
        await expect(tarjetas(page)).toHaveCount(1);
        await expect(barra(page)).toBeHidden();
        await expect(vista(page).getByRole('navigation')).toHaveCount(0);
        await sinDesborde(page);
        expect(await escrituras(page)).toEqual([]);
    });
}

test('refresco mantiene IDs visibles seleccionados y reducción de resultados ajusta la última página móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await iniciar(page);
    await filtrarAngular(page);
    await tarjetas(page).first().getByRole('checkbox').check();
    await expect(barra(page)).toContainText('1 oferta seleccionada');
    const registro = page.getByLabel('Llamadas simuladas');
    const lecturas = ((await registro.textContent()) || '').match(/GET \/ofertas\/sincronizacion/g)?.length || 0;
    await page.getByRole('button', { name: 'Refrescar datos sintéticos' }).click();
    await expect.poll(async () => ((await registro.textContent()) || '').match(/GET \/ofertas\/sincronizacion/g)?.length || 0).toBe(lecturas + 1);
    await expect(barra(page)).toContainText('1 oferta seleccionada');
    await expect(tarjetas(page).first().getByRole('checkbox')).toBeChecked();
    await vista(page).getByRole('button', { name: 'Ir a página 3' }).click();
    await expect(tarjetas(page)).toHaveCount(5);
    await seleccionPagina(page).check();
    await page.getByRole('button', { name: 'Reducir datos sintéticos a 15' }).click();
    await expect(tarjetas(page)).toHaveCount(15);
    await expect(barra(page)).toBeHidden();
    await expect(vista(page).getByRole('navigation')).toHaveCount(0);
    expect(await escrituras(page)).toEqual([]);
});

test('tabla abre detalle issue50 y Escape devuelve foco sin escrituras', async ({ page }) => {
    await iniciar(page);
    await buscar(page).fill('Angular junior 01');
    const abrir = vista(page).getByRole('button', { name: 'Ver detalle de Angular junior 01', exact: true });
    await abrir.click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Angular junior 01' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(abrir).toBeFocused();
    expect(await escrituras(page)).toEqual([]);
});

for (const [ancho, alto] of [[1440,900], [1024,768], [768,900], [390,844], [320,844]]) {
    for (const tema of ['claro', 'oscuro']) {
        test(`matriz extrema ${ancho} ${tema}: texto íntegro, sin overflow de página y controles visibles`, async ({ page }) => {
            await page.setViewportSize({ width: ancho, height: alto });
            await iniciar(page, `tabla=1&tema=${tema}`);
            await buscar(page).fill('Frontend sintética');
            const oferta = ancho <= 768 ? tarjetas(page) : filas(page);
            await expect(oferta).toHaveCount(1);
            await expect(oferta).toContainText('AccesibilidadSinEspacios'.repeat(12));
            await expect(oferta).toContainText('NombreCorporativoExtenso'.repeat(10));
            await sinDesborde(page);
            if (ancho > 768) {
                const scroll = vista(page).locator('.p-datatable-table-container');
                expect(await scroll.evaluate(e => getComputedStyle(e).overflowX)).toBe('auto');
                await vista(page).getByRole('button', { name: /^Ver detalle/ }).scrollIntoViewIfNeeded();
                await expect(vista(page).getByRole('button', { name: /^Ver detalle/ })).toBeInViewport();
            } else {
                const caja = await oferta.boundingBox();
                expect(caja!.x).toBeGreaterThanOrEqual(0);
                expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho);
            }
            await page.screenshot({ path: `../docs/evidencias/issue-51/matriz-extremos-${ancho}-${tema}.png`, fullPage: true, animations: 'disabled' });
            expect(await escrituras(page)).toEqual([]);
        });
    }
}

for (const [estado, tab, texto, porcentaje] of [
    ['pendiente', /PENDIENTES/, 'Pendiente de evaluación', false],
    ['error', /PENDIENTES/, 'ERROR TÉCNICO', false],
    ['desactualizada', /PENDIENTES/, 'Desactualizada · reevaluación pendiente', false],
    ['reevaluacion-fallida', /APROBADAS/, 'Resultado anterior conservado', true],
    ['historica', /APROBADAS/, 'Vigencia desconocida', true],
    ['rechazada', /RECHAZADAS POR IA/, 'RECHAZADA', true],
] as const) {
    test(`estado ${estado}: diferencia evaluación de seguimiento`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await iniciar(page);
        await page.getByRole('tab', { name: tab }).click();
        await buscar(page).fill(`Caso ${estado}`);
        const tarjeta = tarjetas(page);
        await expect(tarjeta).toHaveCount(1);
        await expect(tarjeta).toContainText(texto);
        await expect(tarjeta.locator('.card-oferta__match')).toHaveCount(porcentaje ? 1 : 0);
        if (estado === 'rechazada') await expect(tarjeta.locator('.card-oferta__match')).toHaveAttribute('data-nivel', 'bajo');
        if (estado === 'error' || estado === 'reevaluacion-fallida') {
            await tarjeta.locator('summary').click();
            await expect(tarjeta.locator('details')).toHaveAttribute('open', '');
            await expect(page.getByRole('dialog')).toBeHidden();
        }
        expect(await escrituras(page)).toEqual([]);
    });
}

test('vacío global, categoría sin ofertas, filtro sin coincidencias, carga y error técnico', async ({ page }) => {
    await iniciar(page, 'estado=vacio');
    await expect(vista(page)).toContainText('No hay ofertas guardadas');
    await iniciar(page, 'detalle=aprobada');
    await page.getByRole('tab', { name: /RECHAZADAS POR IA/ }).click();
    await expect(vista(page)).toContainText('Esta categoría no tiene ofertas disponibles');
    await page.getByRole('tab', { name: /APROBADAS/ }).click();
    await buscar(page).fill('No coincide');
    await expect(vista(page)).toContainText('No hay ofertas que coincidan');
    await vista(page).getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(filas(page)).toHaveCount(2);
    await iniciar(page, 'estado=cargando');
    await expect(page.getByText('Estado de sincronización: en_progreso.', { exact: true })).toBeVisible();
    await iniciar(page, 'estado=error');
    await expect(page.getByRole('alert').filter({ hasText: /sincronización/ })).toBeVisible();
    expect(await escrituras(page)).toEqual([]);
});

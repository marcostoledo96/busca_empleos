import { test, expect, Page } from '@playwright/test';

const inicial = 'GET /preferencias\nGET /preferencias/cv-base';
const tabs = ['PERFIL', 'TECNOLOGÍAS', 'ROLES', 'BÚSQUEDA', 'IA', 'IMPORTAR CV', 'EVALUACIONES'];
const registro = (pagina: Page) => pagina.getByLabel('Llamadas simuladas');
async function abrirEditor(pagina: Page) {
    await pagina.getByRole('tab', { name: 'IMPORTAR CV', exact: true }).click();
    const detalle = pagina.locator('details').filter({ has: pagina.getByText('Consultar y editar CV base', { exact: true }) });
    if (await detalle.getAttribute('open') === null) await detalle.locator('summary').click();
    return pagina.getByLabel('Texto del CV en Markdown');
}

test.beforeEach(async ({ context, page }) => {
    const escapes: string[] = [];
    await context.route('**/*', ruta => {
        const url = new URL(ruta.request().url());
        if (url.origin === 'https://fonts.googleapis.com') return ruta.fulfill({ contentType: 'text/css', body: '' });
        if (url.origin !== 'http://127.0.0.1:4350' || url.pathname.startsWith('/api/')) {
            escapes.push(url.href);
            return ruta.abort();
        }
        return ruta.continue();
    });
    await page.exposeFunction('consultarEscapes', () => escapes);
});

test.afterEach(async ({ page }) => {
    const escapes = await page.evaluate(() =>
        (window as unknown as { consultarEscapes: () => Promise<string[]> }).consultarEscapes());
    expect(escapes, 'No deben existir intentos de red productiva').toEqual([]);
});

test('A: navegación antes del contenido secundario y editor solamente en Importar CV', async ({ page }) => {
    await page.goto('/preferencias');
    const lista = page.getByRole('tablist');
    await expect(lista).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    expect((await lista.boundingBox())!.y).toBeLessThan(400);
    await expect(page.getByLabel('Texto del CV en Markdown')).toBeHidden();
    await expect(page.locator('.perfil-ia')).toBeVisible();
    const editor = await abrirEditor(page);
    await expect(editor).toHaveValue(/CV sintético/);
    await expect(registro(page)).toHaveText(inicial);
});

test('B: resumen confirmado breve y detalles completos por teclado, sin confundir edición', async ({ page }) => {
    await page.goto('/preferencias');
    const perfil = page.locator('.perfil-ia');
    const detalles = perfil.locator('details');
    await expect(detalles).not.toHaveAttribute('open', '');
    await expect(perfil.getByText('Candidatura sintética', { exact: false }).first()).toBeVisible();
    await expect(perfil.getByRole('heading', { name: 'Tecnologías y evidencia' })).toBeHidden();
    const resumen = detalles.locator('summary');
    await resumen.focus();
    await page.keyboard.press('Enter');
    await expect(detalles).toHaveAttribute('open', '');
    for (const texto of ['Candidato confirmado', 'Idiomas confirmados', 'Tecnologías y evidencia',
        'Preferencias de búsqueda guardadas', 'Roles objetivo — preferencias, no experiencia acreditada',
        'Políticas obligatorias del sistema — no editables', 'No aceptar inglés oral avanzado excluyente.',
        'SoporteDeAplicacionesEmpresarialesConNombreExtensoSinEspaciosParaRevisarOverflow']) {
        await expect(perfil).toContainText(texto);
    }
    await page.getByLabel('Nombre completo').fill('Nombre todavía sin guardar');
    await expect(perfil).not.toContainText('Nombre todavía sin guardar');
    await expect(page.getByText('Cambios sin guardar.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar preferencias', exact: true }).click();
    await expect(perfil).toContainText('Nombre todavía sin guardar');
    await expect(registro(page)).toHaveText(`${inicial}\nPUT /preferencias`);
    await expect(page.getByRole('status').filter({ hasText: 'Preferencias actualizadas correctamente.' })).toBeVisible();
});

test('C: borrador protegido entre pestañas, guard cancelado, beforeunload y guardado', async ({ page }) => {
    await page.goto('/preferencias');
    const editor = await abrirEditor(page);
    await editor.fill('# Fuente pendiente');
    await page.getByText('Consultar y editar CV base', { exact: true }).click();
    await page.getByRole('tab', { name: 'IA', exact: true }).click();
    await expect(page.getByText('CV base: Cambios pendientes', { exact: true })).toBeVisible();
    const cancelacion = page.waitForEvent('dialog');
    const intento = page.getByRole('link', { name: 'Salir de Preferencias (fixture)' }).click();
    const dialogo = await cancelacion;
    expect(dialogo.type()).toBe('confirm');
    await dialogo.dismiss();
    await intento;
    await expect(page).toHaveURL(/\/preferencias$/);
    const salida = page.waitForEvent('dialog');
    const navegacion = page.evaluate(() => { location.href = '/salida'; });
    const nativo = await salida;
    expect(nativo.type()).toBe('beforeunload');
    await nativo.dismiss();
    await navegacion;
    await expect(page).toHaveURL(/\/preferencias$/);
    await expect(await abrirEditor(page)).toHaveValue('# Fuente pendiente');
    await page.getByRole('button', { name: 'Guardar CV base', exact: true }).click();
    await expect(page.getByText('CV base: Guardado correctamente', { exact: true })).toBeVisible();
    await expect(registro(page)).toHaveText(`${inicial}\nPUT /preferencias/cv-base`);
    await page.getByRole('link', { name: 'Salir de Preferencias (fixture)' }).click();
    await expect(page).toHaveURL(/\/salida$/);
});

test('D: errores globales conservan borrador y perfil confirmado', async ({ page }) => {
    await page.goto('/preferencias?error=cv-guardar,guardar');
    const editor = await abrirEditor(page);
    await editor.fill('# Conservo mi fuente');
    await page.getByRole('button', { name: 'Guardar CV base', exact: true }).click();
    await page.getByRole('tab', { name: 'PERFIL', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'No pude guardar el CV base' })).toBeVisible();
    await page.getByLabel('Nombre completo').fill('Borrador fallido');
    await page.getByRole('button', { name: 'Guardar preferencias', exact: true }).click();
    await expect(page.getByText('No se pudieron guardar las preferencias.', { exact: true })).toBeVisible();
    await expect(page.locator('.perfil-ia')).not.toContainText('Borrador fallido');
    await expect(await abrirEditor(page)).toHaveValue('# Conservo mi fuente');
    await expect(registro(page)).toHaveText(`${inicial}\nPUT /preferencias/cv-base\nPUT /preferencias`);
});

for (const formato of ['pdf', 'md']) {
    test(`E: ${formato} extraer, editar, analizar, decidir y aplicar sin guardar automáticamente`, async ({ page }) => {
        await page.goto('/preferencias');
        await page.getByRole('tab', { name: 'IMPORTAR CV', exact: true }).click();
        await page.getByLabel('Documento del CV (.pdf o .md)').setInputFiles({
            name: `cv.${formato}`, mimeType: formato === 'pdf' ? 'application/pdf' : 'text/markdown', buffer: Buffer.from('CV sintético'),
        });
        await expect(registro(page)).toHaveText(inicial);
        await page.getByRole('button', { name: 'Extraer texto sin IA', exact: true }).click();
        const texto = page.getByLabel('Borrador temporal: corregir o pegar texto del CV');
        await expect(texto).toHaveValue(/CV sintético extraído/);
        await texto.fill('# Texto corregido antes del análisis');
        await page.getByRole('tab', { name: 'IA', exact: true }).click();
        await page.getByRole('tab', { name: 'IMPORTAR CV', exact: true }).click();
        await expect(registro(page)).toHaveText(`${inicial}\nPOST /preferencias/importar-cv/extraer-texto`);
        await page.getByRole('button', { name: 'Analizar este texto con IA', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Borrador revisable del CV' })).toBeVisible();
        await expect(texto).toHaveValue('# Texto corregido antes del análisis');
        await expect(page.getByLabel('Textos analizados simulados')).toHaveText('# Texto corregido antes del análisis');
        await page.locator('#cv-nombre').fill('Propuesta revisada');
        const docker = page.locator('.importar-pregunta').filter({ hasText: '¿Confirmás conocimientos básicos de Docker?' });
        await docker.getByRole('button', { name: 'Aplicar sugerencia', exact: true }).click();
        const experiencia = page.locator('.importar-pregunta').filter({ hasText: '¿Qué tareas realizaste en el proyecto?' });
        await experiencia.getByRole('textbox').fill('Documento mis pruebas sintéticas');
        await experiencia.getByRole('button', { name: 'Guardar nota e ignorar', exact: true }).click();
        await page.getByRole('tab', { name: 'PERFIL', exact: true }).click();
        await expect(page.getByLabel('Nombre completo')).toHaveValue('Candidatura sintética');
        await page.getByRole('tab', { name: 'IMPORTAR CV', exact: true }).click();
        await expect(docker).toContainText('Estado: aplicada');
        await expect(experiencia).toContainText('Estado: nota');
        await page.getByRole('button', { name: 'APLICAR AL FORMULARIO' }).click();
        await page.getByRole('tab', { name: 'PERFIL', exact: true }).click();
        await expect(page.getByLabel('Nombre completo')).toHaveValue('Propuesta revisada');
        await expect(page.locator('.perfil-ia')).not.toContainText('Propuesta revisada');
        await expect(registro(page)).toHaveText(`${inicial}\nPOST /preferencias/importar-cv/extraer-texto\nPOST /preferencias/importar-cv/analizar`);
        await page.getByRole('button', { name: 'Guardar preferencias', exact: true }).click();
        await expect(page.locator('.perfil-ia')).toContainText('Propuesta revisada');
        await page.getByRole('tab', { name: 'IMPORTAR CV', exact: true }).click();
        await expect(page.getByText('Documento mis pruebas sintéticas', { exact: true })).toBeVisible();
        await expect(registro(page)).toHaveText(`${inicial}\nPOST /preferencias/importar-cv/extraer-texto\nPOST /preferencias/importar-cv/analizar\nPUT /preferencias`);
        await page.getByRole('link', { name: 'Salir de Preferencias (fixture)' }).click();
        await page.getByRole('link', { name: 'Volver a Preferencias (fixture)' }).click();
        await expect(page.getByLabel('Nombre completo')).toHaveValue('Propuesta revisada');
        await page.getByRole('tab', { name: 'IMPORTAR CV', exact: true }).click();
        await expect(page.getByText('Documento mis pruebas sintéticas', { exact: true })).toBeVisible();
        await expect(page.locator('.importar-pregunta').filter({ hasText: '¿Confirmás conocimientos básicos de Docker?' })).toContainText('Estado: aplicada');
    });
}

test('E: cancelar revisión no modifica preferencias ni analiza al editar la fuente', async ({ page }) => {
    await page.goto('/preferencias');
    const editor = await abrirEditor(page);
    await editor.fill('# Texto manual para analizar');
    await expect(registro(page)).toHaveText(inicial);
    await page.getByRole('button', { name: 'Analizar texto del editor con IA', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Borrador revisable del CV' })).toBeVisible();
    await page.getByRole('button', { name: 'CANCELAR', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Borrador revisable del CV' })).toBeHidden();
    await expect(editor).toHaveValue('# Texto manual para analizar');
    await expect(page.getByLabel('Textos analizados simulados')).toHaveText('# Texto manual para analizar');
    await page.getByRole('tab', { name: 'PERFIL', exact: true }).click();
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Candidatura sintética');
    await expect(registro(page)).toHaveText(`${inicial}\nPOST /preferencias/importar-cv/analizar`);
});

for (const escenario of [
    { consulta: 'esperando=cv-carga', mensaje: 'Cargando CV base…' },
    { consulta: 'error=cv-carga', mensaje: 'No pude cargar el CV base. Reintentá la carga antes de editar.' },
]) {
    test(`D: estado global ${escenario.consulta} sin abrir el editor`, async ({ page }) => {
        await page.goto(`/preferencias?${escenario.consulta}`);
        await page.getByRole('tab', { name: 'ROLES', exact: true }).click();
        await expect(page.getByLabel('Estado de los cambios')).toContainText(escenario.mensaje);
        await expect(page.getByText(escenario.mensaje, { exact: true })).toBeVisible();
        await expect(registro(page)).toHaveText(inicial);
    });
}

for (const operacion of ['cv-guardar', 'analizar', 'extraer']) {
    test(`D: ${operacion} en curso sigue visible al cambiar de pestaña`, async ({ page }) => {
        await page.goto(`/preferencias?esperando=${operacion}`);
        let mensaje: string;
        if (operacion === 'cv-guardar') {
            await (await abrirEditor(page)).fill('# Fuente a guardar');
            await page.getByRole('button', { name: 'Guardar CV base', exact: true }).click();
            mensaje = 'CV base: Guardando';
        } else {
            await page.getByRole('tab', { name: 'IMPORTAR CV', exact: true }).click();
            if (operacion === 'analizar') {
                await page.getByLabel('Borrador temporal: corregir o pegar texto del CV').fill('# Texto manual');
                await page.getByRole('button', { name: 'Analizar este texto con IA', exact: true }).click();
                mensaje = 'DeepSeek está procesando tu CV. Esto puede tardar unos minutos.';
            } else {
                await page.getByLabel('Documento del CV (.pdf o .md)').setInputFiles({ name: 'cv.md', mimeType: 'text/markdown', buffer: Buffer.from('# CV') });
                await page.getByRole('button', { name: 'Extraer texto sin IA', exact: true }).click();
                mensaje = 'Extrayendo texto sin IA…';
            }
        }
        await page.getByRole('tab', { name: 'IA', exact: true }).click();
        await expect(page.getByText(mensaje, { exact: true })).toBeVisible();
        const llamada = operacion === 'cv-guardar' ? 'PUT /preferencias/cv-base' :
            `POST /preferencias/importar-cv/${operacion === 'extraer' ? 'extraer-texto' : 'analizar'}`;
        await expect(registro(page)).toHaveText(`${inicial}\n${llamada}`);
    });
}

for (const ancho of [1440, 1366, 1024, 768, 390, 320]) {
    for (const tema of ['claro', 'oscuro']) {
        test(`F: ${ancho}px ${tema}, siete pestañas por teclado y sin overflow global`, async ({ page }) => {
            await page.setViewportSize({ width: ancho, height: ancho <= 390 ? 844 : ancho === 1440 ? 900 : 768 });
            await page.goto(`/preferencias?tema=${tema}`);
            await expect(page.getByRole('tab')).toHaveCount(7);
            const detalle = page.locator('.perfil-ia details');
            await detalle.locator('summary').focus();
            await page.keyboard.press('Space');
            await expect(detalle).toHaveAttribute('open', '');
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
            await detalle.locator('summary').press('Enter');
            await page.getByLabel('Nombre completo').fill('NombreMuyExtensoSinEspacios'.repeat(8));
            for (const nombre of tabs) {
                const tab = page.getByRole('tab', { name: nombre, exact: true });
                await tab.focus();
                await page.keyboard.press('Enter');
                await expect(tab).toHaveAttribute('aria-selected', 'true');
                await tab.scrollIntoViewIfNeeded();
                const caja = (await tab.boundingBox())!;
                expect(caja.height).toBeGreaterThanOrEqual(44);
                expect(caja.x).toBeGreaterThanOrEqual(0);
                expect(caja.x + caja.width).toBeLessThanOrEqual(ancho + 1);
                expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
                if (nombre === 'IMPORTAR CV') {
                    const editor = await abrirEditor(page);
                    await editor.fill('TextoLargoSinEspacios'.repeat(40));
                    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
                }
                const controles = page.getByRole('tabpanel').filter({ visible: true }).locator('button, input:not([type=checkbox]), select, textarea');
                for (const control of await controles.all()) {
                    if (await control.isVisible()) {
                        const cajaControl = (await control.boundingBox())!;
                        const html = await control.evaluate(nodo => nodo.outerHTML);
                        expect(cajaControl.height, html).toBeGreaterThanOrEqual(44);
                        expect(cajaControl.width, html).toBeGreaterThanOrEqual(44);
                    }
                }
            }
            await expect(registro(page)).toHaveText(inicial);
        });
    }
}

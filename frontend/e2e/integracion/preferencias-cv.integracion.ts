import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { createRequire } from 'node:module';

const requerir = createRequire(`${process.cwd()}/../backend/package.json`);
const { validarEntorno, TOKEN } = requerir('./tests/helpers/issue-57-entorno');
const api = 'http://127.0.0.1:3057';
const headers = { Authorization: `Bearer ${TOKEN}` };
const tabs = ['PERFIL', 'TECNOLOGÍAS', 'ROLES', 'BÚSQUEDA', 'IA', 'IMPORTAR CV', 'EVALUACIONES'];
const fuente = '# Fuente sintética confirmada\n\n## Proyecto\nDocumento pruebas de software sin datos personales.';
async function control(request: APIRequestContext, data: object) {
    const respuesta = await request.post(`${api}/__issue57/control`, { headers, data });
    expect(respuesta.status()).toBe(200);
}
async function sql(request: APIRequestContext) {
    const respuesta = await request.get(`${api}/__issue57/evidencia`, { headers });
    expect(respuesta.status()).toBe(200);
    const datos = await respuesta.json();
    expect(datos.esquema.base).toBe('busca_empleos_issue57_test');
    expect(datos.esquema.nombre).toMatch(/^issue57_\d+_\d+$/);
    expect(datos.inesperadas).toEqual([]);
    expect(datos.cron.every((fila: { activo: boolean }) => !fila.activo)).toBe(true);
    return datos;
}
async function tab(page: Page, nombre: string) {
    await page.getByRole('tab', { name: nombre, exact: true }).click();
}
async function editor(page: Page) {
    await tab(page, 'IMPORTAR CV');
    const detalle = page.locator('details').filter({ has: page.getByText('Consultar y editar CV base', { exact: true }) });
    if (await detalle.getAttribute('open') === null) await detalle.locator('summary').click();
    return page.getByLabel('Texto del CV en Markdown');
}
async function captura(page: Page, info: any, nombre: string) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${nombre}.png`), fullPage: true });
}
// Genero un PDF mínimo con xref real: el extractor instalado procesa bytes, no una respuesta simulada.
function pdf(texto: string) {
    const contenido = texto ? `BT /F1 12 Tf 30 700 Td (${texto}) Tj ET` : '';
    const objetos = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`];
    let salida = '%PDF-1.4\n';
    const offsets = [0];
    objetos.forEach((objeto, indice) => { offsets.push(Buffer.byteLength(salida)); salida += `${indice + 1} 0 obj\n${objeto}\nendobj\n`; });
    const inicio = Buffer.byteLength(salida);
    salida += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicio}\n%%EOF\n`;
    return Buffer.from(salida);
}

test.beforeEach(async ({ request, context }) => {
    validarEntorno();
    await control(request, { reset: true });
    const preferencias = await request.put(`${api}/api/preferencias`, { headers, data: {
        nombre: 'Candidatura sintética T3', perfil_profesional: 'Perfil confirmado para pruebas.', idioma_candidato: 'Español',
        modalidad_aceptada: 'cualquiera', modelo_ia_evaluacion: 'deepseek-flash', modelo_ia_importacion: 'deepseek-v4-pro',
        tecnologias_detalle: [], preguntas_perfil_pendientes: [], plataformas_preferidas: [], plataformas_excluidas: [],
        terminos_busqueda: ['desarrollo junior'],
    } });
    expect(preferencias.status()).toBe(200);
    const cv = await request.put(`${api}/api/preferencias/cv-base`, { headers: { ...headers, 'Content-Type': 'text/markdown; charset=utf-8' }, data: fuente });
    expect(cv.status()).toBe(200);
    await context.route('**/*', async ruta => {
        const destino = new URL(ruta.request().url());
        if (destino.origin === 'http://127.0.0.1:4357') return ruta.continue();
        await ruta.abort('blockedbyclient');
        throw new Error(`Red inesperada: ${destino.origin}${destino.pathname}`);
    });
});

for (const analizada of [false, true]) {
    test(`T9 importación ${analizada ? 'analizada con decisiones' : 'textual'}: salida explícita sin PUT`, async ({ page, request }, info) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/preferencias?tema=oscuro');
        await tab(page, 'IMPORTAR CV');
        const antes = await sql(request);
        let puts = 0;
        page.on('request', r => { if (r.method() === 'PUT') puts++; });
        const texto = page.getByLabel('Borrador temporal: corregir o pegar texto del CV');
        await texto.fill('# Revisión sintética T9');
        if (analizada) {
            await control(request, { escenario: 'ia_cv' });
            await page.getByRole('button', { name: 'Analizar este texto con IA', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Borrador revisable del CV' })).toBeVisible();
            await page.locator('#cv-nombre').fill('Propuesta revisada T9');
            await page.locator('.importar-pregunta').filter({ hasText: '¿Confirmo Docker básico?' }).getByRole('button', { name: 'Aplicar sugerencia', exact: true }).click();
        }
        // Sin la guarda se navega silenciosamente: no espero un diálogo para producir el RED.
        const dialogos: string[] = [];
        const rechazar = async (dialogo: any) => { dialogos.push(dialogo.type()); await dialogo.dismiss(); };
        page.on('dialog', rechazar);
        await page.getByRole('link', { name: 'Preparar CV imprimible con los datos guardados' }).click();
        await expect(page).toHaveURL(/\/preferencias/);
        expect(dialogos).toEqual(['confirm']);
        await page.evaluate(() => { location.href = '/cv'; });
        await expect(texto).toHaveValue('# Revisión sintética T9');
        expect(dialogos).toEqual(['confirm', 'beforeunload']);
        if (analizada) {
            await expect(page.locator('#cv-nombre')).toHaveValue('Propuesta revisada T9');
            await expect(page.locator('.importar-pregunta').filter({ hasText: '¿Confirmo Docker básico?' }).getByRole('button', { name: 'Aplicar sugerencia', exact: true })).toBeDisabled();
            await expect(page.locator('.importar-pregunta').filter({ hasText: '¿Confirmo Docker básico?' })).toContainText('Estado: aplicada');
        }
        const rechazado = await sql(request);
        expect(rechazado.preferencias).toEqual(antes.preferencias);
        expect(rechazado.cvBase).toEqual(antes.cvBase);
        expect(rechazado.llamadas.filter((l: any) => l.tipo === 'http')).toHaveLength(analizada ? 1 : 0);
        expect(puts).toBe(0);
        await captura(page, info, `t9-importacion-${analizada}`);
        page.off('dialog', rechazar);
        page.once('dialog', d => d.accept());
        await page.getByRole('link', { name: 'Preparar CV imprimible con los datos guardados' }).click();
        await expect(page).toHaveURL(/\/cv$/);
        expect(puts).toBe(0);
        const descartado = await sql(request);
        expect(descartado.preferencias).toEqual(antes.preferencias);
        expect(descartado.cvBase).toEqual(antes.cvBase);
        expect(descartado.llamadas).toEqual(rechazado.llamadas);
        await page.goto('/preferencias');
        await tab(page, 'IMPORTAR CV');
        await expect(texto).toHaveValue('');
        await info.attach('SQL-importacion-rechazada-descartada', { body: JSON.stringify({ antes, rechazado, descartado }), contentType: 'application/json' });
    });
}

for (const falla of [false, true]) {
    test(`T9 PUT retenido ${falla ? '500' : '200'} conserva edición posterior y SQL del envío`, async ({ page, request }, info) => {
        await page.setViewportSize({ width: 320, height: 844 });
        await page.goto('/preferencias?tema=claro');
        const nombre = page.getByLabel('Nombre completo');
        await expect(nombre).toHaveValue('Candidatura sintética T3');
        const antes = await sql(request);
        if (falla) await control(request, { fallo: 'preferencias_cv' });
        let liberar!: () => void;
        let recibida!: () => void;
        const retenida = new Promise<void>(r => { liberar = r; });
        const lista = new Promise<void>(r => { recibida = r; });
        let payload: any;
        let puts = 0;
        await page.route('**/api/preferencias', async ruta => {
            if (ruta.request().method() !== 'PUT') return ruta.continue();
            puts++;
            payload = ruta.request().postDataJSON();
            const respuesta = await ruta.fetch();
            recibida();
            await retenida;
            await ruta.fulfill({ response: respuesta });
        });
        await nombre.fill('Enviado T9');
        await page.getByRole('button', { name: 'Guardar preferencias', exact: true }).click();
        await lista;
        await nombre.fill('Edición posterior T9');
        expect(payload).toEqual({ nombre: 'Enviado T9' });
        liberar();
        await expect(page.getByRole('status').filter({ hasText: falla ? 'No se pudieron guardar las preferencias.' : 'Guardé las preferencias enviadas. Quedan cambios posteriores sin guardar.' })).toBeVisible();
        await expect(nombre).toHaveValue('Edición posterior T9');
        await expect(page.getByText('Cambios sin guardar.', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Guardar preferencias', exact: true })).toBeEnabled();
        const despues = await sql(request);
        if (falla) expect(despues.preferencias).toEqual(antes.preferencias);
        else expect(despues.preferencias[0].nombre).toBe('Enviado T9');
        expect(despues.cvBase).toEqual(antes.cvBase);
        expect(despues.llamadas).toEqual(antes.llamadas);
        const rechazar = async (d: any) => d.dismiss();
        page.on('dialog', rechazar);
        await page.getByRole('link', { name: 'Preparar CV imprimible con los datos guardados' }).click();
        await expect(page).toHaveURL(/\/preferencias/);
        await expect(nombre).toHaveValue('Edición posterior T9');
        expect(puts).toBe(1);
        await captura(page, info, `t9-put-${falla}`);
        page.off('dialog', rechazar);
        page.once('dialog', d => d.accept());
        await page.reload();
        await expect(nombre).toHaveValue(falla ? 'Candidatura sintética T3' : 'Enviado T9');
        expect(puts).toBe(1);
        expect((await sql(request)).preferencias).toEqual(despues.preferencias);
        await info.attach('SQL-PUT-retenido', { body: JSON.stringify({ antes, despues, payload, puts }), contentType: 'application/json' });
    });
}

test('F preferencias móviles: siete pestañas, modelos sin IA, SQL500, borrador, guard y reintento', async ({ page, request }, info) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/preferencias?tema=claro');
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Candidatura sintética T3');
    const antes = await sql(request);
    await page.getByLabel('Nombre completo').fill('Nombre revisado sintético T3');
    for (const nombre of tabs) {
        await tab(page, nombre);
        await expect(page.getByRole('tab', { name: nombre, exact: true })).toHaveAttribute('aria-selected', 'true');
        await captura(page, info, `pestana-320-${tabs.indexOf(nombre)}`);
    }
    await tab(page, 'BÚSQUEDA');
    const terminos = page.locator('.campo').filter({ has: page.getByText('Términos de búsqueda', { exact: true }) });
    await terminos.getByRole('combobox').fill('QA sintético');
    await page.locator('.p-autocomplete-overlay').getByRole('option', { name: 'QA sintético', exact: true }).click();
    await expect(terminos).toContainText('QA sintético');
    const plataformas = page.locator('.campo').filter({ has: page.getByText('Plataformas preferidas', { exact: true }) });
    await plataformas.locator('p-multiselect').click();
    await page.getByRole('option', { name: 'LinkedIn', exact: true }).click();
    await page.keyboard.press('Escape');
    await tab(page, 'IA');
    const modelo = page.locator('.campo').filter({ has: page.getByText('Modelo evaluación ofertas', { exact: true }) });
    await modelo.getByRole('combobox').click();
    await page.getByRole('option', { name: 'DeepSeek V4 Pro (potente)', exact: true }).click();
    expect((await sql(request)).llamadas).toEqual(antes.llamadas);
    await control(request, { fallo: 'preferencias_cv' });
    const guardar = page.getByRole('button', { name: 'Guardar preferencias', exact: true });
    const fallo = page.waitForResponse(r => r.url().endsWith('/api/preferencias') && r.request().method() === 'PUT');
    await guardar.click();
    expect((await fallo).status()).toBe(500);
    await expect(page.getByText('No se pudieron guardar las preferencias.', { exact: true })).toBeVisible();
    await expect(guardar).toBeEnabled();
    expect((await sql(request)).preferencias).toEqual(antes.preferencias);
    await tab(page, 'PERFIL');
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Nombre revisado sintético T3');
    const salida = page.waitForEvent('dialog');
    const intento = page.getByRole('link', { name: 'Preparar CV imprimible con los datos guardados' }).click();
    await (await salida).dismiss();
    await intento;
    await expect(page).toHaveURL(/\/preferencias/);
    const recarga = page.waitForEvent('dialog');
    const navegacion = page.evaluate(() => { location.href = '/cv'; });
    const nativo = await recarga;
    expect(nativo.type()).toBe('beforeunload');
    await nativo.dismiss();
    await navegacion;
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Nombre revisado sintético T3');
    await control(request, {});
    await guardar.click();
    await expect(page.getByRole('status').filter({ hasText: 'Preferencias actualizadas correctamente.' })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Nombre revisado sintético T3');
    const despues = await sql(request);
    expect(despues.preferencias[0]).toMatchObject({ nombre: 'Nombre revisado sintético T3', modelo_ia_evaluacion: 'deepseek-v4-pro', plataformas_preferidas: ['linkedin'], terminos_busqueda: ['desarrollo junior', 'QA sintético'] });
    expect(despues.llamadas).toEqual(antes.llamadas);
    await info.attach('SQL-preferencias-antes-despues', { body: JSON.stringify({ antes, despues }, null, 2), contentType: 'application/json' });
});

test('F CV base móvil: edición, error SQL conserva fuente y borrador, salida cancelada y guardado explícito', async ({ page, request }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/preferencias?tema=oscuro');
    const texto = await editor(page);
    await expect(texto).toHaveValue(fuente);
    const antes = await sql(request);
    const revisado = `${fuente}\n\n## Educación\nCurso sintético confirmado.`;
    await texto.fill(revisado);
    await control(request, { fallo: 'preferencias_cv' });
    const guardar = page.getByRole('button', { name: 'Guardar CV base', exact: true });
    const respuesta = page.waitForResponse(r => r.url().endsWith('/cv-base') && r.request().method() === 'PUT');
    await guardar.click();
    expect((await respuesta).status()).toBe(500);
    await expect(page.getByRole('alert').filter({ hasText: 'No pude guardar el CV base' })).toBeVisible();
    await expect(guardar).toBeEnabled();
    expect((await sql(request)).cvBase).toEqual(antes.cvBase);
    await tab(page, 'IA');
    await expect(await editor(page)).toHaveValue(revisado);
    const salida = page.waitForEvent('dialog');
    const intento = page.getByRole('link', { name: 'Preparar CV imprimible con los datos guardados' }).click();
    await (await salida).dismiss();
    await intento;
    await expect(texto).toHaveValue(revisado);
    await captura(page, info, 'cv-base-error-borrador-390-oscuro');
    await control(request, {});
    await guardar.click();
    await expect(page.getByText('CV base: Guardado correctamente', { exact: true })).toBeVisible();
    await page.reload();
    await expect(await editor(page)).toHaveValue(revisado);
    const despues = await sql(request);
    expect(despues.cvBase[0].cv_base).toBe(revisado);
    expect(despues.preferencias).toEqual(antes.preferencias);
    expect(despues.llamadas).toEqual(antes.llamadas);
    await info.attach('SQL-cv-base-antes-despues', { body: JSON.stringify({ antes, despues }, null, 2), contentType: 'application/json' });
});

for (const formato of ['md', 'pdf']) {
    test(`F importar ${formato}: extracción real, corrección, IA explícita, decisiones y SQL sólo al guardar`, async ({ page, request }, info) => {
        await page.setViewportSize({ width: 412, height: 915 });
        await page.goto('/preferencias?tema=claro');
        await tab(page, 'IMPORTAR CV');
        const antes = await sql(request);
        await page.getByLabel('Documento del CV (.pdf o .md)').setInputFiles({ name: `sintetico.${formato}`, mimeType: formato === 'pdf' ? 'application/pdf' : 'text/markdown', buffer: formato === 'pdf' ? pdf('CV sintetico seleccionable T3') : Buffer.from('# CV sintético Markdown T3') });
        expect((await sql(request)).llamadas).toEqual(antes.llamadas);
        await page.getByRole('button', { name: 'Extraer texto sin IA', exact: true }).click();
        const texto = page.getByLabel('Borrador temporal: corregir o pegar texto del CV');
        await expect(texto).toHaveValue(formato === 'pdf' ? /CV sintetico seleccionable T3/ : '# CV sintético Markdown T3');
        const corregido = '# CV corregido sintético T3\nDocumento pruebas de software.';
        await texto.fill(corregido);
        await tab(page, 'IA');
        await tab(page, 'IMPORTAR CV');
        await expect(texto).toHaveValue(corregido);
        const extraido = await sql(request);
        expect(extraido.preferencias).toEqual(antes.preferencias);
        expect(extraido.cvBase).toEqual(antes.cvBase);
        expect(extraido.llamadas).toEqual(antes.llamadas);
        await control(request, { escenario: 'ia_cv' });
        const analisis = page.waitForRequest('**/api/preferencias/importar-cv/analizar');
        await page.getByRole('button', { name: 'Analizar este texto con IA', exact: true }).click();
        expect((await analisis).postData()).toContain(corregido);
        await expect(page.getByRole('heading', { name: 'Borrador revisable del CV' })).toBeVisible();
        await page.locator('#cv-nombre').fill('Nombre confirmado desde importación');
        await page.locator('.importar-pregunta').filter({ hasText: '¿Confirmo Docker básico?' }).getByRole('button', { name: 'Aplicar sugerencia', exact: true }).click();
        await page.locator('.importar-pregunta').filter({ hasText: '¿Confirmo remoto?' }).getByRole('button', { name: 'Ignorar', exact: true }).click();
        await page.getByRole('button', { name: 'APLICAR AL FORMULARIO' }).click();
        await tab(page, 'PERFIL');
        await expect(page.getByLabel('Nombre completo')).toHaveValue('Nombre confirmado desde importación');
        const aplicado = await sql(request);
        expect(aplicado.preferencias).toEqual(antes.preferencias);
        expect(aplicado.cvBase).toEqual(antes.cvBase);
        expect(aplicado.llamadas.filter((llamada: any) => llamada.tipo === 'http')).toHaveLength(1);
        await page.getByRole('button', { name: 'Guardar preferencias', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Preferencias actualizadas correctamente.' })).toBeVisible();
        const dialogosGuardado: string[] = [];
        page.on('dialog', async d => { dialogosGuardado.push(d.type()); await d.accept(); });
        await page.getByRole('link', { name: 'Preparar CV imprimible con los datos guardados' }).click();
        await expect(page).toHaveURL(/\/cv$/);
        expect(dialogosGuardado).toEqual([]);
        await page.goto('/preferencias');
        await page.reload();
        expect(dialogosGuardado).toEqual([]);
        await expect(page.getByLabel('Nombre completo')).toHaveValue('Nombre confirmado desde importación');
        const despues = await sql(request);
        expect(despues.preferencias[0].tecnologias_detalle).toEqual([expect.objectContaining({ nombre: 'Docker', nivel: 'basico' })]);
        expect(despues.preferencias[0].modalidad_aceptada).toBe('cualquiera');
        expect(despues.preferencias[0].preguntas_perfil_pendientes).toEqual(expect.arrayContaining([expect.objectContaining({ campo: 'docker', estado: 'aplicada' }), expect.objectContaining({ campo: 'modalidad_aceptada', estado: 'ignorada' })]));
        expect(despues.cvBase).toEqual(antes.cvBase);
        await captura(page, info, `importado-${formato}-412-claro`);
        await info.attach(`SQL-importacion-${formato}`, { body: JSON.stringify({ antes, extraido, aplicado, despues }, null, 2), contentType: 'application/json' });
    });
}

test('F documentos rechazados: PDF vacío real, inválido y límite conservan SQL y texto corregido', async ({ page, request }, info) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/preferencias');
    await tab(page, 'IMPORTAR CV');
    const texto = page.getByLabel('Borrador temporal: corregir o pegar texto del CV');
    page.on('dialog', dialogo => dialogo.accept());
    const antes = await sql(request);
    for (const caso of [
        { nombre: 'vacio.pdf', buffer: pdf(''), codigo: 'SIN_TEXTO_EXTRAIBLE', estado: 422 },
        { nombre: 'invalido.pdf', buffer: Buffer.from('%PDF-1.4\nno es un documento\n%%EOF'), codigo: 'DOCUMENTO_INVALIDO', estado: 422 },
        { nombre: 'excesivo.pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 65), codigo: 'DOCUMENTO_DEMASIADO_GRANDE', estado: 413 },
    ]) {
        await page.getByLabel('Documento del CV (.pdf o .md)').setInputFiles({ name: caso.nombre, mimeType: 'application/pdf', buffer: caso.buffer });
        await texto.fill('# Borrador temporal que no debo perder');
        if (caso.estado !== 413) {
            const respuesta = page.waitForResponse('**/importar-cv/extraer-texto');
            await page.getByRole('button', { name: 'Extraer texto sin IA', exact: true }).click();
            expect((await respuesta).status()).toBe(caso.estado);
            expect(await (await respuesta).json()).toMatchObject({ codigo: caso.codigo });
        }
        await expect(page.getByRole('alert').filter({ hasText: caso.estado === 413 ? /5 MiB/ : /manualmente/ })).toBeVisible();
        await expect(texto).toHaveValue('# Borrador temporal que no debo perder');
        const despues = await sql(request);
        expect(despues.preferencias).toEqual(antes.preferencias);
        expect(despues.cvBase).toEqual(antes.cvBase);
        expect(despues.llamadas).toEqual(antes.llamadas);
    }
    await captura(page, info, 'importacion-error-320');
    await info.attach('SQL-importacion-rechazos', { body: JSON.stringify(await sql(request), null, 2), contentType: 'application/json' });
});

test('F CV real: fuentes guardadas, faltantes, selección, borrador, A4 oscuro e impresión explícita', async ({ page, request }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => { (window as any).impresiones = 0; window.print = () => { (window as any).impresiones++; }; });
    await page.goto('/preferencias?tema=oscuro');
    const antes = await sql(request);
    await page.getByRole('link', { name: 'Preparar CV imprimible con los datos guardados' }).click();
    await expect(page).toHaveURL(/\/cv$/);
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Candidatura sintética T3');
    await expect(page.getByText('Faltan datos de nombre o contacto.', { exact: false })).toBeVisible();
    await page.getByText('CV base guardado, original completo', { exact: true }).click();
    await expect(page.locator('#fuente-cv')).toHaveText(fuente);
    expect(await page.locator('.bloque-incluir:checked').count()).toBe(0);
    await page.getByLabel('Nombre', { exact: true }).fill('Borrador imprimible local');
    await page.getByLabel('Contacto y ubicación (texto libre)').fill('Contacto sintético, sin datos reales');
    await page.locator('.bloque-incluir').last().check();
    await page.getByLabel('Revisé los hechos, la selección y mis cambios manuales.', { exact: false }).check();
    await page.getByRole('button', { name: 'Revisar vista previa', exact: true }).click();
    const documento = page.getByRole('article', { name: 'Vista previa del CV' });
    await expect(documento).toContainText('Borrador imprimible local');
    await expect(documento).toContainText('Documento pruebas de software');
    expect(await page.evaluate(() => (window as any).impresiones)).toBe(0);
    await captura(page, info, 'cv-previa-390-oscuro');
    await page.getByRole('button', { name: 'Volver a editar', exact: true }).click();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Borrador imprimible local');
    const salida = page.waitForEvent('dialog');
    const intento = page.getByRole('link', { name: '← Volver a Preferencias', exact: true }).click();
    await (await salida).dismiss();
    await intento;
    await expect(page).toHaveURL(/\/cv$/);
    await page.getByRole('button', { name: 'Revisar vista previa', exact: true }).click();
    await page.emulateMedia({ media: 'print' });
    const estilo = await documento.evaluate(elemento => ({ fondo: getComputedStyle(elemento).backgroundColor, color: getComputedStyle(elemento).color, reglas: Array.from(document.styleSheets).flatMap(hoja => Array.from(hoja.cssRules).map(regla => regla.cssText)).join('\n') }));
    expect(estilo.fondo).toBe('rgb(255, 255, 255)');
    // Verifico contraste WCAG AA sobre blanco, no un negro arbitrario.
    const canales = estilo.color.match(/\d+/g)!.slice(0, 3).map(Number).map(canal => {
        const valor = canal / 255;
        return valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
    });
    const luminancia = canales[0] * 0.2126 + canales[1] * 0.7152 + canales[2] * 0.0722;
    expect(1.05 / (luminancia + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(estilo.reglas).toMatch(/size: a4/i);
    await page.screenshot({ path: info.outputPath('cv-print-A4.png'), fullPage: true });
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('button', { name: 'Imprimir / Guardar como PDF', exact: true }).click();
    expect(await page.evaluate(() => (window as any).impresiones)).toBe(1);
    const despues = await sql(request);
    expect(despues.preferencias).toEqual(antes.preferencias);
    expect(despues.cvBase).toEqual(antes.cvBase);
    expect(despues.llamadas).toEqual(antes.llamadas);
    await info.attach('SQL-cv-impresion-sin-escrituras', { body: JSON.stringify({ antes, despues, estilo }, null, 2), contentType: 'application/json' });
});

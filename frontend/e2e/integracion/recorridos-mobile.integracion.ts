import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { createRequire } from 'node:module';

const requerir = createRequire(`${process.cwd()}/../backend/package.json`);
const { validarEntorno, TOKEN } = requerir('./tests/helpers/issue-57-entorno');
const api = 'http://127.0.0.1:3057';
const headers = { Authorization: `Bearer ${TOKEN}` };
const titulo = 'Desarrollo junior sintético 1';
const dialogo = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: titulo, exact: true }) });
const nota = (page: Page) => dialogo(page).getByLabel('Nota de seguimiento', { exact: true });
const guardar = (page: Page) => dialogo(page).getByRole('button', { name: 'Guardar seguimiento', exact: true });
const vista = (page: Page) => page.locator('.vista-desktop:visible, .vista-mobile:visible');
const barra = (page: Page) => page.getByRole('toolbar', { name: 'Acciones masivas sobre ofertas seleccionadas' });

async function control(request: APIRequestContext, data: object) {
    const respuesta = await request.post(`${api}/__issue57/control`, { headers, data });
    expect(respuesta.status()).toBe(200);
    expect(await respuesta.json()).toEqual({ exito: true });
}
async function evidencia(request: APIRequestContext) {
    const respuesta = await request.get(`${api}/__issue57/evidencia`, { headers });
    expect(respuesta.status()).toBe(200);
    const datos = await respuesta.json();
    expect(datos.esquema.base).toBe('busca_empleos_issue57_test');
    expect(datos.esquema.nombre).toMatch(/^issue57_\d+_\d+$/);
    expect(datos.inesperadas).toEqual([]);
    expect(datos.cron.every((fila: { activo: boolean }) => fila.activo === false)).toBe(true);
    return datos;
}
async function abrir(page: Page, tab = 'PENDIENTES') {
    await page.getByRole('tab', { name: new RegExp(tab) }).click();
    const disparador = page.viewportSize()!.width <= 768
        ? page.getByRole('listitem', { name: `Oferta: ${titulo}`, exact: true })
        : page.getByRole('button', { name: `Ver detalle de ${titulo}`, exact: true });
    await disparador.click();
    await expect(dialogo(page)).toBeVisible();
    return disparador;
}
async function seleccionarDestino(page: Page) {
    await barra(page).getByRole('combobox').click();
    await page.getByRole('option', { name: 'CV enviado', exact: true }).click();
}
async function sinDesborde(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function esperarEvaluacion(request: APIRequestContext) {
    await expect.poll(async () => {
        const respuesta = await request.get(`${api}/api/evaluacion/progreso`, { headers });
        expect(respuesta.status()).toBe(200);
        return (await respuesta.json()).datos.activo;
    }).toBe(false);
}
async function refrescar(page: Page) {
    const lectura = page.waitForResponse('**/api/ofertas/sincronizacion?*');
    await page.getByRole('button', { name: 'Actualizar listado integrado', exact: true }).click();
    expect((await lectura).status()).toBe(200);
    await expect(page.getByText('Estado de sincronización: completada.', { exact: false })).toBeVisible();
}

test.beforeEach(async ({ context, request }) => {
    validarEntorno();
    await control(request, { reset: true });
    const inicial = await request.post(`${api}/api/scraping/linkedin`, { headers, data: { maxResultados: 2 } });
    expect(inicial.status()).toBe(200);
    await context.route('**/*', async ruta => {
        const destino = new URL(ruta.request().url());
        if (destino.origin === 'http://127.0.0.1:4357') return ruta.continue();
        await ruta.abort('blockedbyclient');
        throw new Error(`Red inesperada bloqueada: ${destino.origin}${destino.pathname}`);
    });
});

for (const caso of [{ width: 360, height: 800, tema: 'claro' },
    { width: 412, height: 915, tema: 'oscuro' }, { width: 768, height: 900, tema: 'claro' }]) {
    test(`A rutas y sesión SDK sintética ${caso.width} ${caso.tema}`, async ({ page, request }, info) => {
        await page.setViewportSize(caso);
        await page.addInitScript(() => {
            if (!sessionStorage.getItem('issue60-sesion')) sessionStorage.setItem('issue60-sesion', 'cerrada');
        });
        const antes = await evidencia(request);
        for (const ruta of ['/', '/preferencias', '/cv']) {
            await page.goto(`${ruta}?tema=${caso.tema}`);
            await expect(page).toHaveURL(/\/login$/);
            await expect(page.getByRole('heading', { name: 'Authentication', exact: true })).toBeVisible();
        }
        await page.evaluate(() => sessionStorage.setItem('issue60-popup', 'error'));
        const login = page.getByRole('button', { name: 'Autenticar con Google' });
        await login.click();
        await expect(page.getByRole('alert')).toHaveText(/AUTHENTICATION_FAILED/);
        await expect(login).toBeEnabled();
        await page.evaluate(() => sessionStorage.removeItem('issue60-popup'));
        await login.click();
        await expect(page).toHaveURL('http://127.0.0.1:4357/');
        await expect(page.getByRole('heading', { name: 'OFERTAS_DISPONIBLES' })).toBeVisible();
        const menu = page.getByRole('button', { name: 'Abrir menú de navegación' });
        await menu.click();
        const navegacion = page.getByRole('dialog', { name: 'Menú de navegación' });
        await expect(navegacion).toBeVisible();
        await expect(navegacion.getByRole('link', { name: 'DASHBOARD', exact: true })).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(navegacion.getByRole('link', { name: 'PREFERENCIAS', exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(navegacion.getByRole('link', { name: 'DASHBOARD', exact: true })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(menu).toBeFocused();
        await menu.click();
        await navegacion.getByRole('link', { name: 'PREFERENCIAS', exact: true }).click();
        await expect(page).toHaveURL(/\/preferencias$/);
        await page.getByRole('link', { name: 'Preparar CV imprimible con los datos guardados' }).click();
        await expect(page).toHaveURL(/\/cv$/);
        await page.reload();
        await expect(page).toHaveURL(/\/cv$/);
        await page.goBack();
        await expect(page).toHaveURL(/\/preferencias$/);
        await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
        await expect(page).toHaveURL(/\/login$/);
        await page.goBack();
        await expect(page).toHaveURL(/\/login$/);
        await sinDesborde(page);
        await page.screenshot({ path: info.outputPath('login.png'), fullPage: true });
        expect(await evidencia(request)).toEqual(antes);
    });
}

test('A token rechazado 401/403 conserva SQL y sesión ausente vuelve a login', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const antes = await evidencia(request);
    for (const [token, codigo] of [['issue57-vencido', 401], ['issue57-identidad-ajena', 403]] as const) {
        await page.goto('/login');
        await page.evaluate(valor => sessionStorage.setItem('issue60-token', valor), token);
        const rechazo = page.waitForResponse(respuesta => new URL(respuesta.url()).pathname === '/api/ofertas/sincronizacion');
        await page.goto('/');
        expect((await rechazo).status()).toBe(codigo);
        await expect(page.getByText('Estado de sincronización: fallida.', { exact: false })).toBeVisible();
        await expect(page.getByText('No pude cargar las ofertas guardadas.', { exact: false })).toBeVisible();
        await expect(page.getByRole('alert').filter({ hasText: 'Estado de sincronización: fallida.' }))
            .toContainText(codigo === 401 ? 'Token de autenticación inválido.' : 'Acceso denegado. Este sistema es de uso personal.');
        await expect(page.getByRole('button', { name: 'REINTENTAR', exact: true })).toBeEnabled();
        expect(await evidencia(request)).toEqual(antes);
    }
    await page.evaluate(() => { sessionStorage.removeItem('issue60-token'); sessionStorage.setItem('issue60-sesion', 'cerrada'); });
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
});

test('D estado, fecha y nota sobreviven recarga y segunda revisión con lectura PostgreSQL', async ({ page, request }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?tema=oscuro');
    await abrir(page);
    const antes = await evidencia(request);
    await expect(dialogo(page).getByRole('link', { name: 'Abrir oferta en página original' })).toBeFocused();
    const selectorEstado = dialogo(page).getByRole('combobox', { name: 'Estado manual actual' });
    await selectorEstado.focus();
    await selectorEstado.press('Space');
    await expect(page.getByRole('option', { name: 'CV enviado', exact: true })).toBeVisible();
    const estado = page.waitForResponse('**/api/ofertas/*/postulacion');
    await page.getByRole('option', { name: 'CV enviado', exact: true }).click();
    expect((await estado).status()).toBe(200);
    await expect(dialogo(page)).toBeHidden();
    await abrir(page, 'POSTULADAS');
    await dialogo(page).getByLabel('Fecha de envío, si se conoce').fill('2026-01-15');
    await nota(page).fill('Nota sintética larga. '.repeat(60));
    const envio = page.waitForResponse('**/api/ofertas/*/seguimiento');
    await guardar(page).click();
    expect((await envio).status()).toBe(200);
    await expect(dialogo(page).getByText('Seguimiento guardado.', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.reload();
    await abrir(page, 'POSTULADAS');
    await expect(dialogo(page).getByRole('combobox', { name: 'Estado manual actual' })).toContainText('CV enviado');
    await expect(dialogo(page).getByLabel('Fecha de envío, si se conoce')).toHaveValue('2026-01-15');
    await expect(nota(page)).toHaveValue('Nota sintética larga. '.repeat(60));
    const primera = await evidencia(request);
    expect(primera.ofertas[0]).toMatchObject({ estado_postulacion: 'cv_enviado', fecha_postulacion: '2026-01-15', nota_postulacion: 'Nota sintética larga. '.repeat(60) });
    expect(primera.ofertas[1]).toEqual(antes.ofertas[1]);
    await nota(page).fill('Segunda revisión sintética confirmada');
    await guardar(page).click();
    await expect(dialogo(page).getByText('Seguimiento guardado.', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.reload();
    const disparador = await abrir(page, 'POSTULADAS');
    await expect(nota(page)).toHaveValue('Segunda revisión sintética confirmada');
    const segunda = await evidencia(request);
    expect(segunda.ofertas[0]).toMatchObject({ estado_postulacion: 'cv_enviado', fecha_postulacion: '2026-01-15', nota_postulacion: 'Segunda revisión sintética confirmada' });
    expect(segunda.ofertas[1]).toEqual(antes.ofertas[1]);
    expect(segunda.llamadas).toEqual(antes.llamadas);
    await sinDesborde(page);
    await page.screenshot({ path: info.outputPath('seguimiento-390-oscuro.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(disparador).toBeFocused();
    await info.attach('SQL-seguimiento-dos-revisiones', { body: JSON.stringify({ primera, segunda }, null, 4), contentType: 'application/json' });
});

test('D fallo SQL, 400, respuesta tardía y doble envío conservan borrador y permiten reintento', async ({ page, request }, info) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/?tema=claro');
    await abrir(page);
    const antes = await evidencia(request);
    await control(request, { fallo: 'persistencia' });
    await nota(page).fill('Borrador sintético recuperable');
    const fallo = page.waitForResponse('**/api/ofertas/*/seguimiento');
    await guardar(page).click();
    expect((await fallo).status()).toBe(500);
    await expect(dialogo(page).getByRole('alert')).toContainText('Conservé el borrador');
    await expect(guardar(page)).toBeEnabled();
    expect((await evidencia(request)).ofertas).toEqual(antes.ofertas);
    await control(request, { fallo: 'ninguno' });
    const invalidacion = await request.patch(`${api}/api/ofertas/${antes.ofertas[0].id}/seguimiento`, {
        headers, data: { fecha_postulacion: '2026-02-30', nota_postulacion: 'No debo escribir' },
    });
    expect(invalidacion.status()).toBe(400);
    expect(await invalidacion.json()).toEqual({ exito: false, error: 'fecha_postulacion debe ser una fecha real YYYY-MM-DD o null.' });
    expect((await evidencia(request)).ofertas).toEqual(antes.ofertas);
    let liberar!: () => void;
    const retenida = new Promise<void>(resolve => { liberar = resolve; });
    let envios = 0;
    await page.route('**/api/ofertas/*/seguimiento', async ruta => { envios++; await retenida; await ruta.continue(); });
    await guardar(page).dblclick();
    await expect(guardar(page)).toBeDisabled();
    await expect(dialogo(page).getByText('Guardando seguimiento…', { exact: true })).toBeVisible();
    await nota(page).fill('Edición posterior a la solicitud');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: /POSTULADAS/ }).click();
    await abrir(page);
    await expect(nota(page)).toHaveValue('Edición posterior a la solicitud');
    const confirmada = page.waitForResponse('**/api/ofertas/*/seguimiento');
    liberar();
    expect((await confirmada).status()).toBe(200);
    await expect(guardar(page)).toBeEnabled();
    expect(envios).toBe(1);
    await expect(nota(page)).toHaveValue('Edición posterior a la solicitud');
    await expect(dialogo(page).getByText('Seguimiento guardado.', { exact: true })).toBeHidden();
    expect((await evidencia(request)).ofertas[0].nota_postulacion).toBe('Borrador sintético recuperable');
    await guardar(page).click();
    await expect(dialogo(page).getByText('Seguimiento guardado.', { exact: true })).toBeVisible();
    expect(envios).toBe(2);
    const final = await evidencia(request);
    expect(final.ofertas[0].nota_postulacion).toBe('Edición posterior a la solicitud');
    expect(final.ofertas[1]).toEqual(antes.ofertas[1]);
    await info.attach('SQL-reintento-y-versiones', { body: JSON.stringify(final, null, 4), contentType: 'application/json' });
});

test('D bulk SQL parcial concilia y reintenta sólo IDs válidos; filtro y página invalidan selección', async ({ page, request }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await control(request, { escenario: 'volumen', reset: true });
    expect((await request.post(`${api}/api/scraping/linkedin`, { headers, data: { maxResultados: 25 } })).status()).toBe(200);
    const antes = await evidencia(request);
    expect(antes.ofertas).toHaveLength(25);
    const escrituras: number[][] = [];
    page.on('request', solicitud => {
        if (new URL(solicitud.url()).pathname === '/api/ofertas/bulk/postulacion') escrituras.push(solicitud.postDataJSON().ids);
    });
    await page.goto('/?tema=claro');
    await page.getByRole('tab', { name: /PENDIENTES/ }).click();
    const seleccion = vista(page).getByRole('checkbox', { name: 'Seleccionar ofertas de esta página', exact: true });
    await seleccion.check();
    await expect(barra(page)).toContainText('20 ofertas seleccionadas');
    await vista(page).locator('.p-paginator-next').click();
    await expect(barra(page)).toBeHidden();
    await seleccion.check();
    await expect(barra(page)).toContainText('5 ofertas seleccionadas');
    await vista(page).getByRole('textbox').fill('sintético 1');
    await expect(barra(page)).toBeHidden();
    await vista(page).getByRole('textbox').fill('');
    await expect(vista(page).locator('.p-datatable-tbody > tr')).toHaveCount(20);
    await vista(page).getByRole('columnheader', { name: /TÍTULO/ }).click();
    for (const numero of [1, 2]) await vista(page).getByRole('checkbox', { name: `Seleccionar Desarrollo junior sintético ${numero}`, exact: true }).check();
    await seleccionarDestino(page);
    await barra(page).getByRole('button', { name: 'Cancelar selección masiva' }).click();
    expect(escrituras).toEqual([]);
    expect((await evidencia(request)).ofertas).toEqual(antes.ofertas);
    for (const numero of [1, 2]) await vista(page).getByRole('checkbox', { name: `Seleccionar Desarrollo junior sintético ${numero}`, exact: true }).check();
    await seleccionarDestino(page);
    await expect(barra(page)).toContainText('2 ofertas seleccionadas');
    for (const numero of [1, 2]) await expect(vista(page).getByRole('checkbox', { name: `Seleccionar Desarrollo junior sintético ${numero}`, exact: true })).toBeChecked();
    await control(request, { fallo: 'postulacion_parcial' });
    const primeraEscritura = page.waitForResponse('**/api/ofertas/bulk/postulacion');
    await barra(page).getByRole('button', { name: 'Aplicar acción masiva' }).click();
    expect((await primeraEscritura).status()).toBe(200);
    expect(escrituras).toEqual([[1, 2]]);
    await expect(page.getByText('Actualización parcial', { exact: true })).toBeVisible();
    await expect(barra(page)).toContainText('1 oferta seleccionada');
    const parcial = await evidencia(request);
    expect(parcial.ofertas.filter((fila: { estado_postulacion: string }) => fila.estado_postulacion === 'cv_enviado').map((fila: { id: number }) => fila.id)).toEqual([1]);
    expect(parcial.ofertas.slice(1)).toEqual(antes.ofertas.slice(1));
    await control(request, { fallo: 'ninguno' });
    await seleccionarDestino(page);
    await barra(page).getByRole('button', { name: 'Aplicar acción masiva' }).click();
    await expect(page.getByText('Acción masiva guardada', { exact: true })).toBeVisible();
    await expect(barra(page)).toBeHidden();
    expect(escrituras).toEqual([[1, 2], [2]]);
    const final = await evidencia(request);
    expect(final.ofertas.slice(0, 2).map((fila: { estado_postulacion: string }) => fila.estado_postulacion)).toEqual(['cv_enviado', 'cv_enviado']);
    expect(final.ofertas.slice(2)).toEqual(antes.ofertas.slice(2));
    // Preservo el otro consumidor de la misma revalidación sin realizar nuevas llamadas a IA.
    await page.goto('/?reevaluar=1');
    await vista(page).getByRole('columnheader', { name: /TÍTULO/ }).click();
    for (const numero of [1, 2]) await vista(page).getByRole('checkbox', { name: `Seleccionar Desarrollo junior sintético ${numero}`, exact: true }).check();
    await page.getByRole('button', { name: 'Volver a evaluar seleccionadas', exact: true }).click();
    const confirmacion = page.getByRole('region', { name: 'Confirmar reevaluación', exact: true });
    await expect(confirmacion).toContainText('Voy a volver a evaluar 2 ofertas');
    await confirmacion.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(await evidencia(request)).toEqual(final);
    await info.attach('SQL-bulk-parcial-reintento', { body: JSON.stringify({ antes, parcial, final, escrituras }, null, 4), contentType: 'application/json' });
});

test('B/G lecturas indisponibles, proveedor 429/503 y ciclo fallido recuperan sin perder SQL', async ({ page, request }, info) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto('/?tema=oscuro');
    await expect(page.getByLabel('Total', { exact: true })).toHaveText('2');
    const antes = await evidencia(request);
    await page.getByText('Configuración efectiva de búsquedas', { exact: true }).click();
    await control(request, { fallo: 'previsualizacion_lectura' });
    const previa = page.waitForResponse('**/api/scraping/previsualizacion');
    await page.getByRole('button', { name: 'Actualizar configuración guardada' }).click();
    expect((await previa).status()).toBe(503);
    await expect(page.getByRole('alert').filter({ hasText: 'No pude consultar la configuración de búsqueda.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actualizar configuración guardada' })).toBeEnabled();
    expect((await evidencia(request)).ofertas).toEqual(antes.ofertas);
    await control(request, { fallo: 'previsualizacion_429' });
    const limite = page.waitForResponse('**/api/scraping/previsualizacion');
    await page.getByRole('button', { name: 'Actualizar configuración guardada' }).click();
    expect((await limite).status()).toBe(429);
    await expect(page.getByRole('button', { name: 'Actualizar configuración guardada' })).toBeEnabled();
    expect((await evidencia(request)).ofertas).toEqual(antes.ofertas);
    await control(request, { fallo: 'ninguno' });
    await page.getByRole('button', { name: 'Actualizar configuración guardada' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'No pude consultar la configuración de búsqueda.' })).toBeHidden();
    await page.getByText('Configuración efectiva de búsquedas', { exact: true }).click();
    await page.getByText('Resultados e historial', { exact: true }).click();
    await expect(page.locator('summary').filter({ hasText: /^individual ·/ })).toHaveCount(1);
    await control(request, { fallo: 'historial_lectura' });
    const historia = page.waitForResponse('**/api/automatizacion/historial*');
    await page.getByRole('button', { name: 'Actualizar historial', exact: true }).click();
    expect((await historia).status()).toBe(503);
    await expect(page.getByRole('alert').filter({ hasText: 'No pude actualizar el historial.' })).toBeVisible();
    await expect(page.locator('summary').filter({ hasText: /^individual ·/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Actualizar historial', exact: true })).toBeEnabled();
    await control(request, { fallo: 'ninguno' });
    await page.getByRole('button', { name: 'Actualizar historial', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'No pude actualizar el historial.' })).toBeHidden();
    const buscar = page.getByRole('button', { name: 'Extraer ofertas de LinkedIn', exact: true });
    for (const escenario of ['429', '503']) {
        await control(request, { escenario });
        const respuesta = page.waitForResponse('**/api/scraping/linkedin');
        await buscar.click();
        const resultado = await respuesta;
        // El contrato traduce el estado del proveedor a 502; no lo atribuyo al HTTP de Express.
        expect(resultado.status()).toBe(502);
        expect((await resultado.json()).datos).toMatchObject({ estado: 'error', errores: expect.arrayContaining([
            expect.objectContaining({ tipo: escenario === '429' ? 'limite_solicitudes' : 'http' }),
        ]) });
        await expect(page.getByRole('dialog', { name: 'Carga en progreso' })).toBeHidden();
        await expect(buscar).toBeEnabled();
        await expect(page.getByRole('alert').filter({ hasText: 'Error en LinkedIn' }).first()).toBeVisible();
        expect((await evidencia(request)).ofertas).toEqual(antes.ofertas);
    }
    await control(request, { escenario: 'correcto' });
    const recuperada = page.waitForResponse('**/api/scraping/linkedin');
    await buscar.click();
    expect((await recuperada).status()).toBe(200);
    await expect(buscar).toBeEnabled();
    const previoCiclo = await evidencia(request);
    await control(request, { fallo: 'historial_inicio' });
    const ciclo = page.getByRole('button', { name: 'Ejecutar ciclo completo de scraping y evaluación' });
    const inicio = page.waitForResponse('**/api/automatizacion/ejecutar');
    await ciclo.click();
    expect((await inicio).status()).toBe(202);
    await expect(page.getByText('Último ciclo: Error ·', { exact: false })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Ciclo completo en progreso' })).toBeHidden();
    await expect(ciclo).toBeEnabled();
    expect((await evidencia(request)).ofertas).toEqual(previoCiclo.ofertas);
    await control(request, { escenario: 'vacio', fallo: 'ninguno' });
    await ciclo.click();
    await expect(page.getByText('Último ciclo: Sin resultados ·', { exact: false })).toBeVisible();
    const final = await evidencia(request);
    expect(final.historial.at(-1)).toMatchObject({ estado: 'sin_resultados', fin: expect.any(String) });
    await sinDesborde(page);
    await info.attach('SQL-recuperacion-lecturas-proveedor-ciclo', { body: JSON.stringify(final, null, 4), contentType: 'application/json' });
});

test('E reevaluación individual y seleccionada conserva resultado anterior ante JSON incompleto y recupera', async ({ page, request }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?tema=oscuro');
    await abrir(page);
    const antes = await evidencia(request);
    expect(antes.evaluaciones.map((fila: { estado_evaluacion: string }) => fila.estado_evaluacion)).toEqual(['pendiente', 'pendiente']);
    expect(antes.llamadas.filter((llamada: { tipo: string }) => llamada.tipo === 'http')).toEqual([]);
    const individual = page.waitForResponse('**/api/evaluacion/ejecutar');
    await dialogo(page).getByRole('button', { name: 'Reevaluar oferta', exact: true }).click();
    const iniciada = await individual;
    expect(iniciada.status()).toBe(200);
    expect(iniciada.request().postDataJSON()).toEqual({ ids: [1] });
    await esperarEvaluacion(request);
    await page.keyboard.press('Escape');
    await refrescar(page);
    await abrir(page, 'APROBADAS');
    await expect(dialogo(page).getByText('Compatibilidad estimada: 85%', { exact: true })).toBeVisible();
    const correcta = await evidencia(request);
    expect(correcta.evaluaciones[0]).toMatchObject({ estado_evaluacion: 'aprobada', porcentaje_match: 85, firma_criterios_evaluacion: expect.any(String) });
    expect(correcta.evaluaciones[1]).toEqual(antes.evaluaciones[1]);
    await control(request, { escenario: 'ia_incompleta' });
    await dialogo(page).getByRole('button', { name: 'Reevaluar oferta', exact: true }).click();
    await esperarEvaluacion(request);
    await page.keyboard.press('Escape');
    await refrescar(page);
    await abrir(page, 'APROBADAS');
    await expect(dialogo(page).getByText('Se conserva la evaluación anterior válida.', { exact: false })).toBeVisible();
    await expect(dialogo(page).getByText('Compatibilidad estimada: 85%', { exact: true })).toBeVisible();
    const incompleta = await evidencia(request);
    expect(incompleta.evaluaciones[0]).toMatchObject({ ...correcta.evaluaciones[0], evaluacion_error_mensaje: expect.any(String) });
    expect(incompleta.evaluaciones[1]).toEqual(antes.evaluaciones[1]);
    await page.keyboard.press('Escape');
    await control(request, { escenario: 'correcto' });
    await page.goto('/?reevaluar=1');
    await vista(page).getByRole('checkbox', { name: 'Seleccionar ofertas de esta página', exact: true }).check();
    const region = page.getByRole('region', { name: 'Volver a evaluar ofertas seleccionadas', exact: true });
    await region.getByRole('button', { name: 'Volver a evaluar seleccionadas', exact: true }).click();
    const confirmacion = page.getByRole('region', { name: 'Confirmar reevaluación', exact: true });
    await confirmacion.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect((await evidencia(request)).llamadas).toEqual(incompleta.llamadas);
    await region.getByRole('button', { name: 'Volver a evaluar seleccionadas', exact: true }).click();
    const seleccionada = page.waitForResponse('**/api/evaluacion/ejecutar');
    await confirmacion.getByRole('button', { name: 'Confirmar reevaluación', exact: true }).click();
    const respuesta = await seleccionada;
    expect(respuesta.status()).toBe(200);
    expect(respuesta.request().postDataJSON().ids.sort()).toEqual([1, 2]);
    await esperarEvaluacion(request);
    const final = await evidencia(request);
    expect(final.evaluaciones.every((fila: { estado_evaluacion: string; evaluacion_error_mensaje: string | null }) => fila.estado_evaluacion === 'aprobada' && fila.evaluacion_error_mensaje === null)).toBe(true);
    expect(final.evaluaciones[0].firma_criterios_evaluacion).toBe(correcta.evaluaciones[0].firma_criterios_evaluacion);
    expect(final.ofertas).toEqual(antes.ofertas);
    await info.attach('SQL-IA-individual-incompleta-seleccionada', { body: JSON.stringify({ correcta, incompleta, final }, null, 4), contentType: 'application/json' });
});

test('B/D interrupción de sincronización reanuda; rechazo SQL revierte estado sin tocar IA', async ({ page, request }, info) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/?tema=claro');
    await expect(page.getByText('Estado de sincronización: completada.', { exact: false })).toBeVisible();
    const antes = await evidencia(request);
    let liberar!: () => void;
    const retenida = new Promise<void>(resolve => { liberar = resolve; });
    let finalizarRuta!: () => void;
    const rutaTerminada = new Promise<void>(resolve => { finalizarRuta = resolve; });
    const retener = async (ruta: import('@playwright/test').Route) => {
        await retenida;
        try { await ruta.abort('aborted'); } finally { finalizarRuta(); }
    };
    await page.route('**/api/ofertas/sincronizacion?*', retener);
    await page.getByRole('button', { name: 'Actualizar listado integrado', exact: true }).click();
    await expect(page.getByText('Sincronizando ofertas:', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'CANCELAR', exact: true }).click();
    await expect(page.getByText('Estado de sincronización: cancelada.', { exact: false })).toBeVisible();
    liberar();
    await rutaTerminada;
    await page.unroute('**/api/ofertas/sincronizacion?*', retener);
    const reanudada = page.waitForResponse('**/api/ofertas/sincronizacion?*');
    await page.getByRole('button', { name: 'REANUDAR', exact: true }).click();
    expect((await reanudada).status()).toBe(200);
    await expect(page.getByText('Estado de sincronización: completada.', { exact: false })).toBeVisible();
    await abrir(page);
    await expect(dialogo(page).getByRole('link', { name: 'Abrir oferta en página original' })).toBeFocused();
    await control(request, { fallo: 'persistencia' });
    const selector = dialogo(page).getByRole('combobox', { name: 'Estado manual actual' });
    await selector.focus();
    await selector.press('Space');
    const cambio = page.waitForResponse('**/api/ofertas/*/postulacion');
    await page.getByRole('option', { name: 'CV enviado', exact: true }).click();
    expect((await cambio).status()).toBe(500);
    await expect(page.getByText('Postulación no guardada', { exact: true })).toBeVisible();
    await expect(dialogo(page)).toBeHidden();
    await abrir(page);
    await expect(selector).toContainText('No postulado');
    const final = await evidencia(request);
    expect(final.ofertas).toEqual(antes.ofertas);
    expect(final.evaluaciones).toEqual(antes.evaluaciones);
    expect(final.llamadas).toEqual(antes.llamadas);
    await control(request, { fallo: 'ninguno' });
    await info.attach('SQL-interrupcion-rollback', { body: JSON.stringify(final, null, 4), contentType: 'application/json' });
});

import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { createRequire } from 'node:module';

const requerirBackend = createRequire(`${process.cwd()}/../backend/package.json`);
const { validarEntorno, TOKEN } = requerirBackend('./tests/helpers/issue-57-entorno');
const { Pool } = requerirBackend('pg');
const cabeceras = { Authorization: `Bearer ${TOKEN}` };
const api = 'http://127.0.0.1:3057';

async function control(request: APIRequestContext, datos: object) {
    const respuesta = await request.post(`${api}/__issue57/control`, { headers: cabeceras, data: datos });
    expect(respuesta.status()).toBe(200);
    expect(await respuesta.json()).toEqual({ exito: true });
}

async function evidencia(request: APIRequestContext) {
    const respuesta = await request.get(`${api}/__issue57/evidencia`, { headers: cabeceras });
    expect(respuesta.status()).toBe(200);
    const datos = await respuesta.json();
    expect(datos.esquema.base).toBe('busca_empleos_issue57_test');
    expect(datos.esquema.nombre).toMatch(/^issue57_\d+_\d+$/);
    expect(datos.inesperadas).toEqual([]);
    expect(datos.cron.every((fila: { activo: boolean }) => !fila.activo)).toBe(true);
    expect(new Set(datos.ofertas.map((fila: { identidad_canonica: string }) => fila.identidad_canonica)).size).toBe(datos.ofertas.length);
    return datos;
}

async function sinDesborde(page: Page) {
    expect(await page.evaluate(() => ({ pagina: document.documentElement.scrollWidth, viewport: innerWidth })))
        .toEqual({ pagina: page.viewportSize()!.width, viewport: page.viewportSize()!.width });
}

for (const caso of [
    { width: 1440, height: 900, tema: 'claro' },
    { width: 390, height: 844, tema: 'oscuro' },
    { width: 320, height: 844, tema: 'claro' },
]) {
    test(`Angular → Express → SQL ${caso.width} ${caso.tema}`, async ({ page, context, request }, testInfo) => {
        validarEntorno();
        await page.setViewportSize(caso);
        await control(request, { reset: true });
        // Creo datos previos mediante el endpoint real, no insertando respuestas en el navegador.
        const inicial = await request.post(`${api}/api/scraping/linkedin`, { headers: cabeceras, data: { maxResultados: 1 } });
        expect(inicial.status()).toBe(200);
        const antes = await evidencia(request);
        expect(antes.ofertas).toHaveLength(1);

        const externas: string[] = [];
        const erroresPagina: string[] = [];
        const erroresConsola: { texto: string; url: string }[] = [];
        const fallosRed: string[] = [];
        const http: { ruta: string; estado: number }[] = [];
        const posts: string[] = [];
        let liberarPost: (() => void) | undefined;
        let esperaPost: Promise<void> | undefined;
        await context.route('**/*', async ruta => {
            const destino = new URL(ruta.request().url());
            if (destino.origin !== 'http://127.0.0.1:4357') {
                externas.push(destino.href);
                return ruta.abort('blockedbyclient');
            }
            if (destino.pathname === '/api/scraping/linkedin' && ruta.request().method() === 'POST' && esperaPost) {
                await esperaPost;
            }
            return ruta.continue();
        });
        page.on('pageerror', error => erroresPagina.push(error.message));
        page.on('console', mensaje => {
            if (mensaje.type() === 'error') erroresConsola.push({ texto: mensaje.text(), url: mensaje.location().url ?? '' });
        });
        page.on('requestfailed', solicitud => fallosRed.push(`${solicitud.method()} ${solicitud.url()} ${solicitud.failure()?.errorText}`));
        page.on('response', respuesta => {
            if (respuesta.status() >= 400) http.push({ ruta: new URL(respuesta.url()).pathname, estado: respuesta.status() });
        });
        page.on('request', solicitud => {
            if (solicitud.method() === 'POST' && new URL(solicitud.url()).pathname.startsWith('/api/')) {
                posts.push(new URL(solicitud.url()).pathname);
                expect(solicitud.headers()['authorization']).toBe(`Bearer ${TOKEN}`);
            }
        });
        await page.goto(`/?tema=${caso.tema}`);
        await expect(page.getByRole('heading', { name: 'OFERTAS_DISPONIBLES' })).toBeVisible();
        await expect(page.getByLabel('Total', { exact: true })).toHaveText('1');
        await expect(page.getByText('Estado de sincronización: completada.', { exact: false })).toBeVisible();
        await expect(page.locator('html')).toHaveClass(caso.tema === 'oscuro' ? /dark/ : /^$/);
        await page.getByText('Configuración efectiva de búsquedas', { exact: true }).click();
        const previa = page.waitForResponse('**/api/scraping/previsualizacion');
        await page.getByRole('button', { name: 'Actualizar configuración guardada' }).click();
        const configuracion = await previa;
        expect(configuracion.status()).toBe(200);
        const resumen = (await configuracion.json()).datos.plataformas.find((fuente: { plataforma: string }) => fuente.plataforma === 'linkedin');
        expect(resumen).toMatchObject({ terminos: ['desarrollo junior'], origen: { terminos: 'preferencias' } });
        await page.getByText('Configuración guardada actual', { exact: true }).click();
        await expect(page.getByText(/Términos: desarrollo junior/).first()).toBeVisible();
        await sinDesborde(page);
        await page.getByText('Configuración efectiva de búsquedas', { exact: true }).click();

        if (caso.width < 769) {
            await page.getByRole('group', { name: 'Seleccionar plataforma de scraping', exact: true }).getByRole('combobox').click();
            await page.getByRole('option', { name: 'LinkedIn', exact: true }).click();
        }
        const buscar = caso.width < 769
            ? page.getByRole('button', { name: 'Extraer ofertas de LinkedIn' })
            : page.getByRole('button', { name: 'Scrapear LinkedIn', exact: true });
        const ciclo = page.getByRole('button', { name: 'Ejecutar ciclo completo de scraping y evaluación' });
        // Retengo sólo el envío, nunca fabrico la respuesta HTTP: compruebo carga y exclusión mutua.
        esperaPost = new Promise(resolve => { liberarPost = resolve; });
        const busqueda = page.waitForResponse(respuesta => new URL(respuesta.url()).pathname === '/api/scraping/linkedin');
        await buscar.click();
        await expect(page.getByRole('dialog', { name: 'Carga en progreso' })).toBeVisible();
        await expect(buscar).toBeDisabled();
        await expect(ciclo).toBeDisabled();
        expect(posts).toEqual(['/api/scraping/linkedin']);
        liberarPost!();
        esperaPost = undefined;
        expect((await busqueda).status()).toBe(200);
        await expect(page.getByRole('dialog', { name: 'Carga en progreso' })).toBeHidden();
        await expect(page.getByLabel('Total', { exact: true })).toHaveText('2');
        const despues = await evidencia(request);
        await testInfo.attach('SQL-despues-de-buscar', { body: JSON.stringify(despues, null, 4), contentType: 'application/json' });
        expect(despues.ofertas).toHaveLength(2);
        expect(despues.ofertas[0]).toMatchObject({ id: antes.ofertas[0].id, fecha_extraccion: antes.ofertas[0].fecha_extraccion });
        expect(despues.historial).toHaveLength(2);
        expect(despues.historial.every((fila: { estado: string; fin: string }) => fila.estado === 'completada' && fila.fin)).toBe(true);
        const actor = despues.llamadas.find((llamada: { tipo: string }) => llamada.tipo === 'actor');
        expect(new URL(actor.input.urls[0]).searchParams.get('keywords')).toBe('desarrollo junior');

        const lista = await request.get(`${api}/api/ofertas`, { headers: cabeceras });
        expect(lista.status()).toBe(200);
        expect((await lista.json()).datos.map((fila: { id: number }) => fila.id).sort())
            .toEqual(despues.ofertas.map((fila: { id: number }) => fila.id).sort());
        await page.getByRole('tab', { name: /PENDIENTES/ }).click();
        await page.getByRole('combobox', { name: 'FILTRAR POR PLATAFORMA' }).click();
        await page.getByRole('option', { name: 'LinkedIn', exact: true }).click();
        await expect(page.getByRole('combobox', { name: 'FILTRAR POR PLATAFORMA' })).toContainText('LinkedIn');
        const ofertasVisibles = caso.width < 769
            ? page.getByRole('listitem', { name: /^Oferta:/ })
            : page.getByRole('button', { name: /detalle/i });
        await expect(ofertasVisibles).toHaveCount(2);
        await ofertasVisibles.first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByRole('dialog')).toContainText('Desarrollo junior sintético');
        await sinDesborde(page);
        await page.screenshot({ path: testInfo.outputPath('detalle.png'), fullPage: true });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await page.getByText('Resultados e historial', { exact: true }).click();
        await expect(page.locator('summary').filter({ hasText: /^individual ·/ })).toHaveCount(2);

        // Un trigger PostgreSQL real impide iniciar el historial: Express responde 503, no 502 de proveedor.
        await control(request, { fallo: 'historial_inicio' });
        const error503 = page.waitForResponse(respuesta => new URL(respuesta.url()).pathname === '/api/scraping/linkedin');
        await buscar.click();
        const fallo = await error503;
        expect(fallo.status()).toBe(503);
        expect((await fallo.json()).exito).toBe(false);
        await expect(page.getByRole('dialog', { name: 'Carga en progreso' })).toBeHidden();
        await expect(page.getByRole('alert').filter({ hasText: /historial/i }).first()).toBeVisible();
        const rechazada = await evidencia(request);
        expect(rechazada.ofertas).toEqual(despues.ofertas);
        expect(rechazada.historial).toEqual(despues.historial);
        expect(rechazada.llamadas).toEqual(despues.llamadas);
        await expect(page.getByLabel('Total', { exact: true })).toHaveText('2');
        await control(request, { fallo: 'ninguno' });
        const recuperacion = page.waitForResponse(respuesta => new URL(respuesta.url()).pathname === '/api/scraping/linkedin');
        const syncRecuperacion = page.waitForResponse('**/api/ofertas/sincronizacion?*');
        await buscar.click();
        expect((await recuperacion).status()).toBe(200);
        const sincronizada = await syncRecuperacion;
        expect(sincronizada.status()).toBe(200);
        expect((await sincronizada.json()).completada).toBe(true);
        await expect(page.getByText('Sincronizando ofertas:', { exact: false })).toBeHidden();
        await expect(page.getByText('Estado de sincronización: completada.', { exact: false })).toBeVisible();
        await expect(buscar).toBeEnabled();
        expect((await evidencia(request)).ofertas).toHaveLength(2);

        // Reproduzco un fallo de lectura real, limitado al esquema SQL efímero del runner.
        const esquema = despues.esquema.nombre;
        validarEntorno();
        const pool = new Pool({ ssl: false, connectionTimeoutMillis: 3000, options: `-c search_path=${esquema}` });
        try {
            const identidad = (await pool.query('SELECT current_database() AS base, current_user AS usuario, current_schema() AS esquema, version() AS version')).rows[0];
            expect(identidad).toMatchObject({ base: 'busca_empleos_issue57_test', usuario: 'busca_empleos_test', esquema });
            expect(identidad.version).toMatch(/^PostgreSQL 15\./);
            validarEntorno();
            await pool.query('ALTER TABLE ofertas RENAME COLUMN fecha_ultima_extraccion TO issue57_fecha_retenida');
            try {
                const syncFallida = page.waitForResponse('**/api/ofertas/sincronizacion?*');
                const fallbackFallido = page.waitForResponse(respuesta => new URL(respuesta.url()).pathname === '/api/ofertas');
                await page.getByRole('button', { name: 'Actualizar listado integrado', exact: true }).click();
                expect((await syncFallida).status()).toBe(500);
                expect((await fallbackFallido).status()).toBe(500);
                await expect(page.getByText('No pude actualizar las ofertas. Conservo los datos anteriores; no están confirmados como actualizados. Volvé a intentar.', { exact: false })).toBeVisible();
                await expect(page.getByText('Estado de sincronización: fallida.', { exact: false })).toBeVisible();
                await expect(page.getByLabel('Total', { exact: true })).toHaveText('2');
                await expect(ofertasVisibles).toHaveCount(2);
            } finally {
                validarEntorno();
                await pool.query('ALTER TABLE ofertas RENAME COLUMN issue57_fecha_retenida TO fecha_ultima_extraccion');
            }
        } finally { await pool.end(); }
        const syncRestaurada = page.waitForResponse('**/api/ofertas/sincronizacion?*');
        await page.getByRole('button', { name: 'Actualizar listado integrado', exact: true }).click();
        expect((await syncRestaurada).status()).toBe(200);
        await expect(page.getByText('Estado de sincronización: completada.', { exact: false })).toBeVisible();
        await expect(page.getByLabel('Total', { exact: true })).toHaveText('2');

        await control(request, { escenario: 'parcial' });
        const aceptado = page.waitForResponse('**/api/automatizacion/ejecutar');
        const terminal = page.waitForResponse(async respuesta => {
            if (new URL(respuesta.url()).pathname !== '/api/automatizacion/progreso' || respuesta.status() !== 200) return false;
            const datos = (await respuesta.json()).datos;
            return datos.activo === false && datos.porcentaje === 100;
        });
        await ciclo.click();
        expect((await aceptado).status()).toBe(202);
        await expect(page.getByRole('dialog', { name: 'Ciclo completo en progreso' })).toBeVisible();
        await expect(ciclo).toBeDisabled();
        const progreso = (await (await terminal).json()).datos;
        expect(progreso.pasos.find((paso: { nombre: string }) => paso.nombre === 'google_jobs').estado).toBe('omitida');
        await expect(page.getByRole('dialog', { name: 'Ciclo completo en progreso' })).toBeHidden();
        await expect(page.getByText('Último ciclo: Parcial ·', { exact: false })).toBeVisible();
        await expect(page.getByRole('alert').first()).toBeVisible();
        const estado = await request.get(`${api}/api/automatizacion/estado`, { headers: cabeceras });
        expect(estado.status()).toBe(200);
        const resultado = (await estado.json()).datos.ultimoResultado;
        expect(resultado).toMatchObject({ exito: false, estado: 'parcial' });
        expect(resultado.fuentes.find((fuente: { plataforma: string }) => fuente.plataforma === 'linkedin').estado).toBe('completada');
        expect(resultado.fuentes.find((fuente: { plataforma: string }) => fuente.plataforma === 'indeed').estado).toBe('error');
        expect(resultado.fuentes.find((fuente: { plataforma: string }) => fuente.plataforma === 'google_jobs').estado).toBe('deshabilitada');
        const durables = await evidencia(request);
        await testInfo.attach('SQL-ciclo-terminal', { body: JSON.stringify(durables, null, 4), contentType: 'application/json' });
        expect(durables.ofertas).toHaveLength(2);
        expect(durables.historial.at(-1)).toMatchObject({ tipo: 'ciclo_manual', estado: 'parcial', fin: expect.any(String) });
        await expect(page.locator('summary').filter({ hasText: /^ciclo_manual ·.*Parcial/ })).toHaveCount(1);
        await sinDesborde(page);
        await page.screenshot({ path: testInfo.outputPath('ciclo-parcial.png'), fullPage: true });

        await control(request, { escenario: 'vacio' });
        const segundo202 = page.waitForResponse('**/api/automatizacion/ejecutar');
        await ciclo.click();
        expect((await segundo202).status()).toBe(202);
        await expect(page.getByRole('dialog', { name: 'Ciclo completo en progreso' })).toBeHidden({ timeout: 15000 });
        await expect(page.getByText('Último ciclo: Sin resultados ·', { exact: false })).toBeVisible();
        const final = await evidencia(request);
        expect(final.ofertas).toHaveLength(2);
        expect(final.historial.at(-1)).toMatchObject({ tipo: 'ciclo_manual', estado: 'sin_resultados', fin: expect.any(String) });
        expect(final.historial).toHaveLength(5);
        expect(posts).toEqual(['/api/scraping/linkedin', '/api/scraping/linkedin', '/api/scraping/linkedin',
            '/api/automatizacion/ejecutar', '/api/automatizacion/ejecutar']);
        expect(http).toEqual([
            { ruta: '/api/scraping/linkedin', estado: 503 },
            { ruta: '/api/ofertas/sincronizacion', estado: 500 },
            { ruta: '/api/ofertas', estado: 500 },
        ]);
        expect(erroresPagina).toEqual([]);
        expect(fallosRed).toEqual([]);
        expect(externas).toEqual([]);
        // Exijo los tres fallos HTTP inyectados y los dos diagnósticos exactos del fallback Angular.
        expect(erroresConsola).toEqual([
            { texto: 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)', url: 'http://127.0.0.1:4357/api/scraping/linkedin' },
            { texto: 'Failed to load resource: the server responded with a status of 500 (Internal Server Error)', url: 'http://127.0.0.1:4357/api/ofertas/sincronizacion?limite=500' },
            { texto: 'Error al sincronizar dashboard: HttpErrorResponse', url: 'http://127.0.0.1:4357/main.js' },
            { texto: 'Failed to load resource: the server responded with a status of 500 (Internal Server Error)', url: 'http://127.0.0.1:4357/api/ofertas' },
            { texto: 'Error al cargar dashboard: HttpErrorResponse', url: 'http://127.0.0.1:4357/main.js' },
        ]);
        await sinDesborde(page);
        await page.screenshot({ path: testInfo.outputPath('dashboard-recuperado.png'), fullPage: true });
        await testInfo.attach('SQL-y-fronteras', { body: JSON.stringify({ antes, despues, final, http, externas }, null, 4), contentType: 'application/json' });
        for (const nombre of ['detalle.png', 'ciclo-parcial.png', 'dashboard-recuperado.png']) {
            await testInfo.attach(nombre, { path: testInfo.outputPath(nombre), contentType: 'image/png' });
        }
    });
}

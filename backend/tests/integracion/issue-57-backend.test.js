const { prepararBase, TOKEN, ofertaLinkedin } = require('../helpers/issue-57-entorno');
const { crearProveedores, cerrarRed } = require('../helpers/issue-57-proveedores');
const { prepararControles, esperarTerminal } = require('../helpers/issue-57-runtime');
const request = require('supertest');

const proveedores = crearProveedores();
for (const nombre of ['dotenv', 'apify-client', 'node-cron', 'nodemailer']) {
    jest.doMock(nombre, () => proveedores.modulos[nombre]);
}
jest.doMock('../../src/config/firebase-admin', () => proveedores.modulos.firebase);

jest.setTimeout(20000);
describe('Issue #57 — Express, servicios y PostgreSQL reales', () => {
    let pool;
    let esquema;
    let app;
    let controles;
    let restaurarRed;
    const obtener = ruta => request(app).get(ruta).set('Authorization', `Bearer ${TOKEN}`);
    const enviar = (ruta, cuerpo = {}) => request(app).post(ruta).set('Authorization', `Bearer ${TOKEN}`).send(cuerpo);
    const buscar = cuerpo => enviar('/api/scraping/linkedin', cuerpo);
    const terminal = () => esperarTerminal(() => obtener('/api/automatizacion/progreso'));
    const filas = async () => (await controles.evidencia()).ofertas;
    const historial = async () => {
        const respuesta = await obtener('/api/automatizacion/historial');
        expect(respuesta.status).toBe(200);
        expect(respuesta.body.exito).toBe(true);
        return respuesta.body.datos;
    };
    beforeAll(async () => {
        restaurarRed = cerrarRed(proveedores);
        ({ pool, esquema } = await prepararBase());
        controles = await prepararControles(pool, esquema);
        app = require('../../src/app');
    });
    beforeEach(async () => {
        if (!pool) throw new Error('No se preparó PostgreSQL sintético.');
        proveedores.cambiar('correcto');
        proveedores.llamadas.length = 0;
        await controles.reset();
    });
    afterEach(async () => {
        proveedores.liberar();
        proveedores.liberarEvaluacion();
        expect(proveedores.inesperadas).toEqual([]);
        if (pool) {
            expect((await pool.query('SELECT current_schema() AS nombre')).rows[0].nombre).toBe(esquema);
            expect((await pool.query('SELECT * FROM configuracion_cron WHERE activo')).rows).toEqual([]);
            const datos = await filas();
            expect(new Set(datos.map(fila => fila.identidad_canonica)).size).toBe(datos.length);
        }
    });
    afterAll(async () => {
        if (pool) await pool.end();
        restaurarRed?.();
    });

    test('conservo el middleware real: rechazo ausencia, token inválido e identidad ajena sin escrituras', async () => {
        const antes = await controles.evidencia();
        expect((await request(app).get('/api/ofertas')).body).toEqual({
            exito: false, error: 'No autorizado. Se requiere un token de autenticación.',
        });
        expect((await request(app).post('/api/scraping/linkedin').send({})).status).toBe(401);
        for (const [token, estado, error] of [
            ['invalido', 401, 'Token de autenticación inválido.'],
            ['issue57-identidad-ajena', 403, 'Acceso denegado. Este sistema es de uso personal.'],
        ]) {
            const respuesta = await request(app).post('/api/scraping/linkedin').set('Authorization', `Bearer ${token}`).send({});
            expect(respuesta.status).toBe(estado);
            expect(respuesta.body).toEqual({ exito: false, error });
        }
        expect((await obtener('/api/ofertas')).status).toBe(200);
        expect(await controles.evidencia()).toEqual(antes);
        expect(proveedores.llamadas).toEqual([]);
    });

    test('resuelvo preferencias y límites, normalizo, deduplico y consulto ofertas e historial en SQL', async () => {
        expect((await obtener('/api/ofertas')).body.datos).toEqual([]);
        const previa = await obtener('/api/scraping/previsualizacion');
        expect(previa.status).toBe(200);
        expect(previa.body.datos.plataformas.find(p => p.plataforma === 'linkedin' || p.id === 'linkedin')).toBeDefined();
        const resultado = await buscar({ maxResultados: 2 });
        expect(resultado.status).toBe(200);
        expect(resultado.body.exito).toBe(true);
        expect(resultado.body.datos).toMatchObject({ estado: 'completada', ofertas_nuevas: 2, total_crudos: 3,
            duplicadasDescartadas: 1, historial: { guardado: true } });
        const actor = proveedores.llamadas.find(llamada => llamada.tipo === 'actor');
        expect(actor.input.count).toBe(2);
        expect(actor.input.urls.length).toBeGreaterThan(0);
        const preferencias = (await pool.query('SELECT terminos_busqueda FROM preferencias WHERE id=1')).rows[0];
        expect(new URL(actor.input.urls[0]).searchParams.get('keywords')).toBe(preferencias.terminos_busqueda[0]);
        const guardadas = await filas();
        expect(guardadas).toHaveLength(2);
        expect(guardadas[0].titulo).toBe(ofertaLinkedin(1).jobTitle);
        expect(guardadas[0].identidad_canonica).toContain('57000001');
        const lista = await obtener('/api/ofertas');
        expect(lista.body.total).toBe(2);
        expect(new Set(lista.body.datos.map(fila => fila.id))).toEqual(new Set(guardadas.map(fila => fila.id)));
        expect((await historial())[0]).toMatchObject({ estado: 'completada', tipo: 'individual' });
        expect((await controles.evidencia()).historial[0]).toMatchObject({ estado: 'completada', fin: expect.any(Date) });
        expect((await obtener(`/api/ofertas/${guardadas[0].id}`)).body.datos.titulo).toBe(guardadas[0].titulo);
    });

    test.each([
        ['vacio', 200, 'sin_resultados', null],
        ['429', 502, 'error', 'limite_solicitudes'],
        ['500', 502, 'error', 'http'],
        ['503', 502, 'error', 'http'],
        ['timeout', 504, 'timeout', 'timeout'],
        ['invalido', 502, 'error', 'red'],
    ])('comunico %s sin falso éxito ni pérdida y permito reintentar', async (escenario, http, estado, tipo) => {
        await buscar();
        const antes = await filas();
        proveedores.cambiar(escenario);
        const respuesta = await buscar();
        expect(respuesta.status).toBe(http);
        expect(respuesta.body.exito).toBe(http === 200);
        expect(respuesta.body.datos.estado).toBe(estado);
        if (http !== 200) expect(respuesta.body.error).toBe('No pude completar la consulta al proveedor.');
        if (tipo) expect(respuesta.body.datos.errores).toEqual(expect.arrayContaining([expect.objectContaining({ tipo })]));
        expect(await filas()).toEqual(antes);
        expect((await historial())[0].estado).toBe(estado);
        expect((await controles.evidencia()).historial.at(-1).estado).toBe(estado);
        proveedores.cambiar('correcto');
        const reintento = await buscar();
        expect(reintento.status).toBe(200);
        expect(reintento.body.datos.estado).toBe('completada');
        expect(await filas()).toHaveLength(2);
        expect((await historial())[0].estado).toBe('completada');
    });

    test('rechazo opciones inválidas y conservo el contrato de fuente deshabilitada sin llamar proveedores', async () => {
        const antes = await controles.evidencia();
        const invalida = await buscar({ maxResultados: 0 });
        expect(invalida.status).toBe(400);
        expect(invalida.body).toEqual({ exito: false, error: 'maxResultados debe ser un entero entre 1 y 500.' });
        expect(await controles.evidencia()).toEqual(antes);
        const inactiva = await enviar('/api/scraping/google-jobs');
        expect(inactiva.status).toBe(200);
        expect(inactiva.body.datos).toMatchObject({ estado: 'deshabilitada', codigo_resultado: 'PLATAFORMA_INACTIVA', ofertas_nuevas: 0 });
        expect(inactiva.body.datos.mensaje).toContain('desactivado');
        expect((await historial())[0].estado).toBe('deshabilitada');
        expect(await filas()).toEqual([]);
        expect(proveedores.llamadas).toEqual([]);
    });

    test.each([
        ['persistencia', 500, 'error', 0], ['persistencia_parcial', 200, 'parcial', 1],
    ])('inyecto %s mediante trigger PostgreSQL y preservo las ofertas útiles', async (modo, http, estado, cantidad) => {
        await controles.fallo(modo);
        const respuesta = await buscar();
        expect(respuesta.status).toBe(http);
        expect(respuesta.body.datos.estado).toBe(estado);
        expect(respuesta.body.datos.erroresGuardado).toBe(2 - cantidad);
        expect(respuesta.body.datos.errores).toContainEqual({ tipo: 'persistencia', mensaje: 'No pude guardar todas las ofertas.' });
        if (http === 500) expect(respuesta.body).toMatchObject({ exito: false,
            error: 'No se pudo persistir ninguna oferta por fallos en la base de datos.' });
        else expect(respuesta.body.datos.mensaje).toContain('Conservo los resultados disponibles.');
        expect(await filas()).toHaveLength(cantidad);
        expect((await historial())[0].estado).toBe(estado);
        await controles.fallo('ninguno');
        expect((await buscar()).status).toBe(200);
        expect(await filas()).toHaveLength(2);
    });

    test('fallo al iniciar historial sin invocar proveedor y comunico fallo al finalizar sin perder ofertas', async () => {
        await controles.fallo('historial_inicio');
        const inicio = await buscar();
        expect(inicio.status).toBe(503);
        expect(inicio.body).toEqual({ exito: false, error: 'No pude iniciar el historial de la ejecución.' });
        expect(await filas()).toEqual([]);
        expect(await historial()).toEqual([]);
        expect(proveedores.llamadas).toEqual([]);
        await controles.fallo('historial_fin');
        const fin = await buscar();
        expect(fin.status).toBe(200);
        expect(fin.body.datos.historial).toMatchObject({ guardado: false,
            error: 'No pude finalizar el historial; el resultado de scraping se conserva.' });
        expect(await filas()).toHaveLength(2);
        expect((await historial())[0]).toMatchObject({ estado: 'ejecutando', fin: null });
        await controles.fallo('ninguno');
        expect((await buscar()).body.datos.historial.guardado).toBe(true);
        expect(await filas()).toHaveLength(2);
    });

    test('reproduzco esquema sin última extracción ni historial y restauro el flujo migrado', async () => {
        await pool.query('ALTER TABLE ofertas RENAME COLUMN fecha_ultima_extraccion TO issue57_fecha_legacy');
        await pool.query('ALTER TABLE ejecuciones_busqueda RENAME TO issue57_historial_legacy');
        try {
            for (const ruta of ['/api/ofertas', '/api/ofertas/sincronizacion']) {
                const respuesta = await obtener(ruta);
                expect(respuesta.status).toBe(500);
                expect(respuesta.body).toEqual({ exito: false, error: 'Error interno del servidor.' });
            }
            await expect(pool.query('SELECT fecha_ultima_extraccion FROM ofertas')).rejects.toMatchObject({ code: '42703' });
            await expect(pool.query('SELECT * FROM ejecuciones_busqueda')).rejects.toMatchObject({ code: '42P01' });
            const historialAusente = await obtener('/api/automatizacion/historial');
            expect(historialAusente.status).toBe(503);
            expect(historialAusente.body).toEqual({ exito: false, error: 'No pude consultar el historial de ejecuciones.' });
            expect((await buscar()).status).toBe(503);
            expect(proveedores.llamadas).toEqual([]);
        } finally {
            await pool.query('ALTER TABLE ofertas RENAME COLUMN issue57_fecha_legacy TO fecha_ultima_extraccion');
            await pool.query('ALTER TABLE issue57_historial_legacy RENAME TO ejecuciones_busqueda');
        }
        expect((await buscar()).status).toBe(200);
        expect((await obtener('/api/ofertas/sincronizacion')).status).toBe(200);
        expect(await filas()).toHaveLength(2);
        expect((await historial())[0].estado).toBe('completada');
    });

    test('sincronizo todos los cursores y conservo fecha inicial, estado, fecha y nota manual ante reaparición', async () => {
        await buscar();
        const inicial = (await filas())[0];
        const estado = await request(app).patch(`/api/ofertas/${inicial.id}/postulacion`)
            .set('Authorization', `Bearer ${TOKEN}`).send({ estado_postulacion: 'en_proceso' });
        expect(estado.status).toBe(200);
        const seguimiento = await request(app).patch(`/api/ofertas/${inicial.id}/seguimiento`)
            .set('Authorization', `Bearer ${TOKEN}`).send({ fecha_postulacion: '2026-01-15', nota_postulacion: 'Mi nota sintética manual.' });
        expect(seguimiento.status).toBe(200);
        await pool.query("UPDATE ofertas SET fecha_ultima_extraccion=NOW()-INTERVAL '40 days' WHERE id=$1", [inicial.id]);
        const reaparicion = await buscar();
        expect(reaparicion.status).toBe(200);
        expect(reaparicion.body.datos.ofertas_reapariciones).toBe(2);
        const posterior = (await filas())[0];
        expect(posterior.fecha_extraccion).toEqual(inicial.fecha_extraccion);
        expect(posterior.fecha_ultima_extraccion.getTime()).toBeGreaterThan(inicial.fecha_ultima_extraccion.getTime());
        expect(posterior).toMatchObject({ estado_postulacion: 'en_proceso', nota_postulacion: 'Mi nota sintética manual.' });
        // Creo volumen sintético por el modelo real, sin omitir los límites públicos de cursor.
        const modelo = require('../../src/modelos/oferta');
        for (let indice = 3; indice <= 105; indice++) {
            await modelo.crearOferta({ titulo: `Oferta sintética ${indice}`, empresa: 'Empresa ficticia',
                descripcion: 'Desarrollo JavaScript junior.', url: ofertaLinkedin(indice).jobUrl, plataforma: 'linkedin' });
        }
        let cursor;
        const ids = [];
        let bloques = 0;
        do {
            const respuesta = await obtener('/api/ofertas/sincronizacion').query({ limite: 100, ...(cursor ? { cursor } : {}) });
            expect(respuesta.status).toBe(200);
            expect(respuesta.body.total_inicial).toBe(105);
            ids.push(...respuesta.body.datos.map(fila => fila.id));
            cursor = respuesta.body.cursor_siguiente;
            bloques++;
            expect(bloques).toBeLessThanOrEqual(2);
            const manual = respuesta.body.datos.find(fila => fila.id === inicial.id);
            if (manual) expect(manual).toMatchObject({ estado_postulacion: 'en_proceso', fecha_postulacion: '2026-01-15', nota_postulacion: 'Mi nota sintética manual.' });
        } while (cursor);
        expect(bloques).toBe(2);
        expect(ids).toHaveLength(105);
        expect(new Set(ids)).toEqual(new Set((await filas()).map(fila => fila.id)));
        const antes = await filas();
        expect((await obtener('/api/ofertas/sincronizacion').query({ cursor: 'invalido' })).status).toBe(400);
        expect(await filas()).toEqual(antes);
        expect((await obtener('/api/ofertas/sincronizacion')).status).toBe(200);
    });

    test('acepto 202, rechazo ciclo concurrente, espero terminal parcial y puedo ejecutar otro ciclo', async () => {
        proveedores.cambiar('retenido');
        const aceptado = await enviar('/api/automatizacion/ejecutar');
        expect(aceptado.status).toBe(202);
        expect(aceptado.body.datos.activo).toBe(true);
        const duplicado = await enviar('/api/automatizacion/ejecutar');
        expect(duplicado.status).toBe(409);
        expect(duplicado.body).toEqual({ exito: false, error: 'Ya hay un ciclo de automatización en curso.' });
        proveedores.cambiar('parcial');
        proveedores.liberar();
        const progreso = await terminal();
        expect(progreso.activo).toBe(false);
        expect(progreso.porcentaje).toBe(100);
        const estado = await obtener('/api/automatizacion/estado');
        expect(estado.body.datos.ultimoResultado).toMatchObject({ exito: false, estado: 'parcial' });
        const fuentes = estado.body.datos.ultimoResultado.fuentes;
        expect(fuentes.find(f => f.plataforma === 'linkedin')).toMatchObject({ estado: 'completada', nuevas: 2 });
        expect(fuentes.find(f => f.plataforma === 'indeed').estado).toBe('error');
        expect(fuentes.find(f => f.plataforma === 'google_jobs').estado).toBe('deshabilitada');
        expect(progreso.pasos.find(p => p.nombre === 'google_jobs').estado).toBe('omitida');
        expect(await filas()).toHaveLength(2);
        expect((await historial())[0]).toMatchObject({ tipo: 'ciclo_manual', estado: 'parcial' });
        expect((await controles.evidencia()).historial).toHaveLength(1);
        proveedores.cambiar('vacio');
        expect((await enviar('/api/automatizacion/ejecutar')).status).toBe(202);
        await terminal();
        expect((await obtener('/api/automatizacion/estado')).body.datos.ultimoResultado.estado).toBe('sin_resultados');
        expect((await historial())[0].estado).toBe('sin_resultados');
        expect(await filas()).toHaveLength(2);
    });

    test('cancelo evaluación activa por su contrato real sin detener cron ni perder scraping', async () => {
        proveedores.retenerEvaluacion();
        expect((await enviar('/api/automatizacion/ejecutar')).status).toBe(202);
        const limite = Date.now() + 8000;
        while (!proveedores.llamadas.some(llamada => llamada.destino?.includes('api.deepseek.com')) && Date.now() < limite) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        expect(proveedores.llamadas.some(llamada => llamada.destino?.includes('api.deepseek.com'))).toBe(true);
        const cancelacion = await enviar('/api/evaluacion/cancelar');
        expect(cancelacion.status).toBe(200);
        expect(cancelacion.body.exito).toBe(true);
        proveedores.liberarEvaluacion();
        await terminal();
        const estado = (await obtener('/api/automatizacion/estado')).body.datos;
        expect(estado.ultimoResultado).toMatchObject({ exito: false, estado: 'parcial', evaluacion: { estado: 'cancelado' } });
        expect(estado.ultimoResultado.errores).toContain('La evaluación fue cancelada. Conservo los resultados parciales.');
        expect(await filas()).toHaveLength(2);
        expect((await historial())[0].estado).toBe('parcial');
        expect((await pool.query("SELECT estado FROM evaluacion_lotes ORDER BY id DESC LIMIT 1")).rows[0].estado).toBe('cancelado');
    });
});

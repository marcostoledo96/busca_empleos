jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));
const pool = require('../../src/config/base-datos');
const { resolverConfiguracion, resolverConfiguraciones, validarOpciones } = require('../../src/servicios/servicio-configuracion-busqueda');
const terminos = ['soporte IT', 'mesa de ayuda'];

describe('Configuración común de búsquedas', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        pool.query.mockResolvedValue({ rows: [{ terminos_busqueda: terminos, zonas_preferidas: ['CABA', 'GBA Oeste'] }] });
    });

    test.each(['linkedin', 'computrabajo', 'indeed', 'bumeran', 'glassdoor', 'jooble', 'adzuna'])('%s usa términos guardados sin modificarlos', (id) => {
        const preferencias = { terminos_busqueda: terminos };
        const configuracion = resolverConfiguracion(id, {}, preferencias);
        expect(configuracion.opciones.terminos).toEqual(terminos);
        expect(configuracion.resumen.origen.terminos).toBe('preferencias');
        expect(preferencias).toEqual({ terminos_busqueda: terminos });
    });

    test('override prevalece solo para esta ejecución y defaults solo ante ausencia', () => {
        const preferencias = { terminos_busqueda: terminos };
        expect(resolverConfiguracion('linkedin', { terminos: ['QA'] }, preferencias).opciones.terminos).toEqual(['QA']);
        expect(preferencias.terminos_busqueda).toEqual(terminos);
        expect(resolverConfiguracion('linkedin', {}, {}).resumen.origen.terminos).toBe('defecto');
        expect(() => resolverConfiguracion('linkedin', { terminos: [] }, preferencias)).toThrow(/términos/i);
        expect(() => resolverConfiguracion('linkedin', {}, { terminos_busqueda: [] })).toThrow(/términos/i);
        expect(() => resolverConfiguracion('linkedin', {}, { terminos_busqueda: null })).toThrow(/términos/i);
    });

    test.each([
        null, [], 'texto', { terminos: null }, { terminos: 'QA' }, { terminos: [1] }, { terminos: [' '] },
        { terminos: Array(101).fill('QA') }, { terminos: ['x'.repeat(201)] },
        { maxResultados: 0 }, { maxResultados: -1 }, { maxResultados: 1.5 }, { maxResultados: '10' }, { maxResultados: 501 },
        { ubicacion: [] }, { ubicacion: '' }, { terminosBusqueda: ['QA'] }, { ubicaciones: [] },
        { terminos: ['QA'], terminos_busqueda: ['IT'] },
        { filtrarNivelLinkedin: 'no' }, { filtrar_nivel_linkedin: 1 },
    ])('rechazo opciones inválidas %j', (opciones) => {
        expect(() => validarOpciones(opciones)).toThrow();
    });

    test('alias válido, cap Adzuna y regiones realmente soportadas', () => {
        expect(resolverConfiguracion('linkedin', { terminos_busqueda: ['QA'] }, {}).opciones.terminos).toEqual(['QA']);
        expect(resolverConfiguracion('adzuna', { maxResultados: 500 }, {}).opciones.maxResultados).toBe(50);
        expect(resolverConfiguracion('linkedin', {}, { zonas_preferidas: ['CABA', 'GBA Oeste'] }).opciones.ubicaciones).toEqual(['CABA', 'GBA Oeste']);
        const glassdoor = resolverConfiguracion('glassdoor', {}, { zonas_preferidas: ['CABA'] });
        expect(glassdoor.resumen.ubicacion).toEqual(['Buenos Aires', 'Argentina']);
        expect(glassdoor.resumen.advertencias.join(' ')).toMatch(/zonas/i);
    });

    test('preview solo consulta, mapea objetivos en Remotive y RemoteOK sin inventar términos', async () => {
        const configuraciones = await resolverConfiguraciones({}, { previsualizacion: true });
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(pool.query.mock.calls[0][0]).toMatch(/^SELECT/);
        // Para 'soporte IT', Remotive debe mapear a customer-service y RemoteOK a support
        expect(configuraciones.remotive.resumen).toMatchObject({ filtros: { categoria: 'customer-service' } });
        expect(configuraciones.remoteok.resumen.filtros.tags).toContain('support');
        for (const id of ['getonbrd', 'google_jobs', 'infojobs']) {
            expect(configuraciones[id].resumen.habilitada).toBe(false);
        }
        pool.query.mockResolvedValue({ rows: [{ terminos_busqueda: [] }] });
        const vacias = await resolverConfiguraciones({}, { previsualizacion: true });
        expect(vacias.linkedin.resumen.terminos).toEqual([]);
        expect(vacias.linkedin.resumen.ejecutable).toBe(false);
        await expect(resolverConfiguraciones()).rejects.toMatchObject({ status: 400 });
    });

    test.each([{ terminosInvalidos: ['###'] }, { terminosInvalidos: ['soporte IT', '###'] }])('Computrabajo rechaza términos sin consulta después de limpiar: %j', ({ terminosInvalidos }) => {
        expect(() => resolverConfiguracion('computrabajo', { terminos: terminosInvalidos }, {})).toThrow(/términos/i);
        const preview = resolverConfiguracion('computrabajo', { terminos: terminosInvalidos }, {}, { previsualizacion: true });
        expect(preview.resumen.ejecutable).toBe(false);
        expect(preview.resumen.advertencias.join(' ')).toMatch(/términos/i);
    });

    test.each(['indeed', 'bumeran', 'jooble', 'adzuna'])('%s sigue rechazando una transformación sin palabras utilizables', (id) => {
        expect(() => resolverConfiguracion(id, { terminos: ['###'] }, {})).toThrow(/términos/i);
    });

    test.each(['jooble', 'remoteok'])('%s informa que maxResultados no es un límite estricto', (id) => {
        const { resumen } = resolverConfiguracion(id, { maxResultados: 10 }, {});
        expect(resumen.maxResultados).toBe(10);
        expect(resumen.advertencias.join(' ')).toMatch(/umbral de acumulación.*no.*límite estricto.*superar 10/i);
    });

    test('batch ejecuta compatibles para QA y C# sin omitir', async () => {
        for (const termino of ['QA', 'C#']) {
            pool.query.mockResolvedValue({ rows: [{ terminos_busqueda: [termino] }] });
            const configuraciones = await resolverConfiguraciones({}, { omitirIncompatibles: true });
            expect(configuraciones.linkedin.resumen.motivoOmision).toBeUndefined();
            expect(configuraciones.computrabajo.resumen.motivoOmision).toBeUndefined();
            for (const id of ['indeed', 'bumeran', 'jooble', 'adzuna']) {
                expect(configuraciones[id].opciones.terminos).toEqual([termino]);
                expect(configuraciones[id].resumen.motivoOmision).toBeUndefined();
            }
        }
    });

    test('batch omite solamente incompatibilidad por fuente para ### sin reescribir términos', async () => {
        pool.query.mockResolvedValue({ rows: [{ terminos_busqueda: ['###'] }] });
        const configuraciones = await resolverConfiguraciones({}, { omitirIncompatibles: true });
        expect(configuraciones.linkedin.opciones.terminos).toEqual(['###']);
        expect(configuraciones.linkedin.resumen.motivoOmision).toBeUndefined();
        for (const id of ['indeed', 'bumeran', 'jooble', 'adzuna', 'computrabajo']) {
            expect(configuraciones[id].resumen.motivoOmision).toMatch(/no.*defaults/i);
            expect(configuraciones[id].resumen.advertencias).toContain(configuraciones[id].resumen.motivoOmision);
            try {
                resolverConfiguracion(id, { terminos: ['###'] });
                throw new Error('Esperaba incompatibilidad individual');
            } catch (error) {
                expect(error).toMatchObject({ status: 400, codigo: 'consulta_incompatible_fuente' });
            }
        }
        expect(configuraciones.glassdoor.resumen.motivoOmision).toBeUndefined();
        for (const id of ['getonbrd', 'google_jobs', 'infojobs']) {
            expect(configuraciones[id].resumen.motivoOmision).toBeUndefined();
        }
    });

    test.each([[], null, 3, [' '], Array(101).fill('QA')].map(guardados => ({ guardados })))('batch no convierte global inválido %j en omisiones', async ({ guardados }) => {
        pool.query.mockResolvedValue({ rows: [{ terminos_busqueda: guardados }] });
        await expect(resolverConfiguraciones({}, { omitirIncompatibles: true })).rejects.toMatchObject({ status: 400 });
    });

    test('credenciales ausentes no son incompatibilidad de consulta', () => {
        const original = process.env.JOOBLE_API_KEY;
        delete process.env.JOOBLE_API_KEY;
        try {
            const { resumen } = resolverConfiguracion('jooble', { terminos: ['soporte'] }, {}, { omitirIncompatibles: true });
            expect(resumen.ejecutable).toBe(false);
            expect(resumen.motivoOmision).toBeUndefined();
            expect(resumen.advertencias.join(' ')).toMatch(/API key/);
        } finally {
            if (original === undefined) delete process.env.JOOBLE_API_KEY;
            else process.env.JOOBLE_API_KEY = original;
        }
    });

    test('falla de lectura no habilita defaults silenciosos', async () => {
        pool.query.mockRejectedValue(new Error('sin conexión'));
        await expect(resolverConfiguraciones()).rejects.toMatchObject({ status: 503 });
    });

    test('LinkedIn permite activar y desactivar su filtro de nivel de experiencia', () => {
        const { construirUrlsLinkedin } = require('../../src/config/apify');
        const conFiltro = resolverConfiguracion('linkedin', { filtrarNivelLinkedin: true }, {});
        expect(conFiltro.opciones.filtrarNivelLinkedin).toBe(true);
        expect(conFiltro.resumen.filtros.nivelesExperiencia).toEqual(['internship', 'entry_level']);
        const urlsConFiltro = construirUrlsLinkedin(conFiltro.opciones);
        expect(urlsConFiltro.every(url => url.includes('f_E=1%2C2'))).toBe(true);

        const sinFiltro = resolverConfiguracion('linkedin', { filtrarNivelLinkedin: false }, {});
        expect(sinFiltro.opciones.filtrarNivelLinkedin).toBe(false);
        expect(sinFiltro.resumen.filtros.nivelesExperiencia).toEqual([]);
        expect(sinFiltro.resumen.advertencias.join(' ')).toMatch(/filtro de nivel.*desactivado/i);
        const urlsSinFiltro = construirUrlsLinkedin(sinFiltro.opciones);
        expect(urlsSinFiltro.some(url => url.includes('f_E='))).toBe(false);
    });

    test('resumen expone equivalenciasAplicadas y equivalenciasSugeridas separadas', () => {
        const { resumen } = resolverConfiguracion('bumeran', { terminos: ['QA manual', 'C#'] }, {});
        expect(resumen.equivalenciasAplicadas).toEqual({ 'C#': 'c-sharp' });
        expect(resumen.equivalenciasSugeridas['QA manual']).toEqual(['tester manual']);
        expect(resumen.equivalenciasSugeridas['C#']).toEqual(expect.arrayContaining(['c sharp', '.net']));
    });
});

test('LinkedIn aplica todas las zonas guardadas en URLs reales sin alterar filtros', () => {
    const { construirUrlsLinkedin } = require('../../src/config/apify');
    const { opciones } = resolverConfiguracion('linkedin', {}, { terminos_busqueda: terminos, zonas_preferidas: ['CABA', 'GBA Oeste'] });
    const urls = construirUrlsLinkedin(opciones);
    expect(urls).toHaveLength(4);
    expect(urls.some(url => url.includes('location=CABA'))).toBe(true);
    expect(urls.some(url => url.includes('location=GBA+Oeste'))).toBe(true);
    expect(urls.every(url => url.includes('f_E=1%2C2&f_TPR=r1209600'))).toBe(true);
});

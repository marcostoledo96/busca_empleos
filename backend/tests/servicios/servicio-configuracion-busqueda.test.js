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

    test.each([null, [], 'texto', { terminos: null }, { terminos: 'QA' }, { terminos: [1] }, { terminos: [' '] }, { terminos: Array(101).fill('QA') }, { terminos: ['x'.repeat(201)] }, { maxResultados: 0 }, { maxResultados: -1 }, { maxResultados: 1.5 }, { maxResultados: '10' }, { maxResultados: 501 }, { ubicacion: [] }, { ubicacion: '' }, { terminosBusqueda: ['QA'] }, { ubicaciones: [] }, { terminos: ['QA'], terminos_busqueda: ['IT'] }])('rechazo opciones inválidas %j', (opciones) => {
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

    test('preview solo consulta, informa filtros fijos y bloqueo, no inventa términos', async () => {
        const configuraciones = await resolverConfiguraciones({}, { previsualizacion: true });
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(pool.query.mock.calls[0][0]).toMatch(/^SELECT/);
        expect(configuraciones.remotive.resumen).toMatchObject({ terminos: [], filtros: { categoria: 'software-dev' } });
        expect(configuraciones.remoteok.resumen.filtros.tags).toContain('frontend');
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

    test('falla de lectura no habilita defaults silenciosos', async () => {
        pool.query.mockRejectedValue(new Error('sin conexión'));
        await expect(resolverConfiguraciones()).rejects.toMatchObject({ status: 503 });
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

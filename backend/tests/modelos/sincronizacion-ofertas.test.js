jest.mock('../../src/config/base-datos', () => ({ connect: jest.fn() }));

const pool = require('../../src/config/base-datos');
const { obtenerBloqueSincronizacion } = require('../../src/modelos/oferta');

function cargarModeloConEntorno(entorno, secreto) {
    jest.resetModules();
    const advertir = jest.fn();
    process.env.NODE_ENV = entorno;
    if (secreto === undefined) {
        delete process.env.CURSOR_SINCRONIZACION_SECRETO;
    } else {
        process.env.CURSOR_SINCRONIZACION_SECRETO = secreto;
    }
    jest.doMock('../../src/config/base-datos', () => ({ connect: jest.fn() }));
    jest.doMock('../../src/utils/logger', () => ({ warn: advertir }));
    return { modelo: require('../../src/modelos/oferta'), advertir };
}

function crearClienteSnapshot({ mutar = false } = {}) {
    let verificaciones = 0;
    return {
        query: jest.fn(async (sql, parametros = []) => {
            if (sql.startsWith('BEGIN') || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
            if (sql.includes('COALESCE(MAX(id)')) return { rows: [{ max_id: 10000 }] };
            if (sql.includes('COUNT(*)::integer AS total')) {
                verificaciones += 1;
                return { rows: [{ total: 10000, firma: mutar && verificaciones > 1 ? 'mutada' : 'estable' }] };
            }
            if (sql.includes('SELECT id, titulo')) {
                const ultimoId = parametros[2];
                const limite = parametros[3];
                const desde = Math.min(10000, ultimoId - 1);
                const hasta = Math.max(0, desde - limite);
                return {
                    rows: Array.from({ length: desde - hasta }, (_, indice) => ({ id: desde - indice, titulo: `Oferta ${desde - indice}` })),
                };
            }
            throw new Error(`Query inesperada: ${sql}`);
        }),
        release: jest.fn(),
    };
}

describe('sincronización de ofertas por cursor', () => {
    test('incluye la descripción en la proyección sincronizada', async () => {
        const cliente = crearClienteSnapshot();
        pool.connect.mockResolvedValue(cliente);

        await obtenerBloqueSincronizacion({ limite: 500 });

        const consultaOfertas = cliente.query.mock.calls.find(([sql]) => sql.includes('SELECT id, titulo'))[0];
        expect(consultaOfertas).toMatch(/\bdescripcion\b/);
        expect(cliente.release).toHaveBeenCalledTimes(1);
    });

    test('recorre 10.000 IDs únicos y coincide con el total del snapshot', async () => {
        const cliente = crearClienteSnapshot();
        pool.connect.mockResolvedValue(cliente);
        const ids = new Set();
        let cursor;
        let total = 0;

        do {
            const bloque = await obtenerBloqueSincronizacion({ limite: 500, cursor });
            bloque.datos.forEach((oferta) => ids.add(oferta.id));
            total = bloque.total;
            cursor = bloque.cursor_siguiente;
        } while (cursor);

        expect(ids.size).toBe(10000);
        expect(total).toBe(10000);
    });

    test('expone metadatos públicos estables sin filtrar internos del cursor', async () => {
        const cliente = crearClienteSnapshot();
        pool.connect.mockResolvedValue(cliente);

        const primerBloque = await obtenerBloqueSincronizacion({ limite: 500 });
        const segundoBloque = await obtenerBloqueSincronizacion({
            limite: 500,
            cursor: primerBloque.cursor_siguiente,
        });

        for (const bloque of [primerBloque, segundoBloque]) {
            expect(bloque).toEqual(expect.objectContaining({
                fecha_corte: expect.any(String),
                max_id: 10000,
                total_inicial: 10000,
                total: 10000,
            }));
            expect(bloque).not.toHaveProperty('firma');
            expect(bloque).not.toHaveProperty('ultimo_id');
            expect(bloque).not.toHaveProperty('expira_en');
        }
        expect(segundoBloque.fecha_corte).toBe(primerBloque.fecha_corte);
        expect(segundoBloque.max_id).toBe(primerBloque.max_id);
        expect(segundoBloque.total_inicial).toBe(primerBloque.total_inicial);
    });

    test('invalida el snapshot cuando cambia su firma', async () => {
        const cliente = crearClienteSnapshot({ mutar: true });
        pool.connect.mockResolvedValue(cliente);
        const primero = await obtenerBloqueSincronizacion({ limite: 500 });

        await expect(obtenerBloqueSincronizacion({ limite: 500, cursor: primero.cursor_siguiente }))
            .rejects.toMatchObject({ codigo: 'SINCRONIZACION_INVALIDADA' });
    });

    describe('secreto de firma por ambiente', () => {
        const entornoOriginal = process.env.NODE_ENV;
        const secretoOriginal = process.env.CURSOR_SINCRONIZACION_SECRETO;

        afterEach(() => {
            process.env.NODE_ENV = entornoOriginal;
            if (secretoOriginal === undefined) {
                delete process.env.CURSOR_SINCRONIZACION_SECRETO;
            } else {
                process.env.CURSOR_SINCRONIZACION_SECRETO = secretoOriginal;
            }
            jest.resetModules();
        });

        test('rechaza iniciar en producción sin CURSOR_SINCRONIZACION_SECRETO', () => {
            expect(() => cargarModeloConEntorno('production')).toThrow(
                'CURSOR_SINCRONIZACION_SECRETO es obligatorio en producción.'
            );
        });

        test('usa un secreto efímero y advierte fuera de producción', () => {
            const { modelo, advertir } = cargarModeloConEntorno('test');

            expect(modelo._internas.firmarCursor({ version: 1 })).toEqual(expect.any(String));
            expect(advertir).toHaveBeenCalledWith(expect.stringContaining('CURSOR_SINCRONIZACION_SECRETO'));
        });

        test('acepta un cursor tras recargar el módulo con el mismo secreto', () => {
            const primerModelo = cargarModeloConEntorno('test', 'secreto-estable').modelo;
            const cursor = primerModelo._internas.firmarCursor({
                version: 1,
                fecha_corte: '2026-06-15T00:00:00.000Z',
                max_id: 10,
                ultimo_id: 9,
                firma: 'estable',
                expira_en: Date.now() + 60_000,
            });
            const segundoModelo = cargarModeloConEntorno('test', 'secreto-estable').modelo;

            expect(segundoModelo._internas.leerCursor(cursor)).toEqual(expect.objectContaining({ max_id: 10 }));
        });

        test('rechaza un cursor si el secreto cambia', () => {
            const primerModelo = cargarModeloConEntorno('test', 'secreto-a').modelo;
            const cursor = primerModelo._internas.firmarCursor({
                version: 1,
                fecha_corte: '2026-06-15T00:00:00.000Z',
                max_id: 10,
                ultimo_id: 9,
                firma: 'estable',
                expira_en: Date.now() + 60_000,
            });
            const segundoModelo = cargarModeloConEntorno('test', 'secreto-b').modelo;

            expect(segundoModelo._internas.leerCursor(cursor)).toBeNull();
        });
    });
});

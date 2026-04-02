// Tests para el modelo de ofertas (CRUD).
// Estos tests corren contra la base de datos REAL, no contra mocks.
// ¿Por qué? Porque lo que quiero verificar es que mis queries SQL funcionan
// de verdad contra PostgreSQL, no que JavaScript sabe hacer un mock.
//
// ⚠️  IMPORTANTE: estos tests hacen TRUNCATE sobre la tabla ofertas.
// Para proteger los datos de producción, solo corren si la variable
// de entorno ALLOW_DB_TESTS=true está activa.
//
// Cómo correrlos en PowerShell:
//   $env:ALLOW_DB_TESTS="true"; npx jest tests/modelos --runInBand
// En Linux/Mac:
//   ALLOW_DB_TESTS=true npx jest tests/modelos --runInBand

const pool = require('../../src/config/base-datos');
const modeloOferta = require('../../src/modelos/oferta');

// Si no está el flag, todos los tests de este archivo se marcan como 'skipped'.
// Esto protege la BD de producción cuando se corre el test suite normal.
const contexto = process.env.ALLOW_DB_TESTS === 'true' ? describe : describe.skip;

// Datos de ejemplo que reutilizo en varios tests.
// Los defino acá para no repetirlos en cada test (principio DRY).
const ofertaEjemplo = {
    titulo: 'Desarrollador Frontend Junior',
    empresa: 'TechCorp Argentina',
    ubicacion: 'Buenos Aires, Argentina',
    modalidad: 'remoto',
    descripcion: 'Buscamos desarrollador junior con conocimientos en Angular y TypeScript.',
    url: 'https://www.linkedin.com/jobs/view/12345',
    plataforma: 'linkedin',
    nivel_requerido: 'junior',
    salario_min: 500000,
    salario_max: 800000,
    moneda: 'ARS',
    datos_crudos: { fuente: 'apify', actor: 'linkedin-scraper' }
};

const segundaOferta = {
    titulo: 'QA Tester Trainee',
    empresa: 'SoftDev SA',
    ubicacion: 'Córdoba, Argentina',
    modalidad: 'hibrido',
    descripcion: 'Posición trainee para testing manual y automatizado.',
    url: 'https://www.computrabajo.com.ar/ofertas/67890',
    plataforma: 'computrabajo',
    nivel_requerido: 'trainee'
};

contexto('Modelo de ofertas — CRUD', () => {
    // Antes de cada test, limpio la tabla para arrancar de cero.
    // TRUNCATE es como DELETE pero más rápido, y RESTART IDENTITY
    // resetea el contador del SERIAL (id vuelve a 1).
    beforeEach(async () => {
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY');
    });

    // Al terminar todos los tests, cierro el pool.
    afterAll(async () => {
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY');
        await pool.end();
    });

    // === crearOferta() ===

    describe('crearOferta()', () => {
        test('debería insertar una oferta y retornarla con todos los campos', async () => {
            const ofertaCreada = await modeloOferta.crearOferta(ofertaEjemplo);

            // Verifico que tiene un ID asignado por la BD.
            expect(ofertaCreada.id).toBeDefined();
            expect(typeof ofertaCreada.id).toBe('number');

            // Verifico los campos que mandé.
            expect(ofertaCreada.titulo).toBe(ofertaEjemplo.titulo);
            expect(ofertaCreada.empresa).toBe(ofertaEjemplo.empresa);
            expect(ofertaCreada.url).toBe(ofertaEjemplo.url);
            expect(ofertaCreada.plataforma).toBe(ofertaEjemplo.plataforma);
            expect(ofertaCreada.salario_min).toBe('500000');
            expect(ofertaCreada.salario_max).toBe('800000');
            expect(ofertaCreada.moneda).toBe('ARS');

            // Verifico los defaults que pone la BD.
            expect(ofertaCreada.estado_evaluacion).toBe('pendiente');
            expect(ofertaCreada.fecha_extraccion).toBeInstanceOf(Date);

            // Verifico que datos_crudos se guardó como JSONB.
            expect(ofertaCreada.datos_crudos).toEqual(ofertaEjemplo.datos_crudos);
        });

        test('debería retornar null al insertar una URL duplicada (deduplicación silenciosa)', async () => {
            // Inserto la primera vez — debería funcionar.
            const primera = await modeloOferta.crearOferta(ofertaEjemplo);
            expect(primera).not.toBeNull();

            // Inserto la misma URL otra vez — debería retornar null sin error.
            const duplicada = await modeloOferta.crearOferta(ofertaEjemplo);
            expect(duplicada).toBeNull();

            // Verifico que en la tabla hay solo 1 registro.
            const conteo = await pool.query('SELECT COUNT(*) AS total FROM ofertas');
            expect(parseInt(conteo.rows[0].total)).toBe(1);
        });
    });

    // === obtenerOfertas() ===

    describe('obtenerOfertas()', () => {
        test('debería retornar todas las ofertas sin filtros', async () => {
            // Inserto dos ofertas distintas.
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);

            const ofertas = await modeloOferta.obtenerOfertas();

            expect(ofertas).toHaveLength(2);
        });

        test('debería filtrar ofertas por estado_evaluacion', async () => {
            // Inserto una oferta y la apruebo manualmente.
            const oferta = await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.actualizarEvaluacion(oferta.id, 'aprobada', 'Cumple con el perfil');

            // Inserto otra que queda pendiente.
            await modeloOferta.crearOferta(segundaOferta);

            // Filtro solo las aprobadas.
            const aprobadas = await modeloOferta.obtenerOfertas({ estado: 'aprobada' });
            expect(aprobadas).toHaveLength(1);
            expect(aprobadas[0].titulo).toBe(ofertaEjemplo.titulo);
        });
    });

    // === obtenerOfertaPorId() ===

    describe('obtenerOfertaPorId()', () => {
        test('debería retornar la oferta con el ID indicado', async () => {
            const ofertaCreada = await modeloOferta.crearOferta(ofertaEjemplo);

            const encontrada = await modeloOferta.obtenerOfertaPorId(ofertaCreada.id);

            expect(encontrada).not.toBeNull();
            expect(encontrada.id).toBe(ofertaCreada.id);
            expect(encontrada.titulo).toBe(ofertaEjemplo.titulo);
        });

        test('debería retornar null si el ID no existe', async () => {
            const encontrada = await modeloOferta.obtenerOfertaPorId(99999);

            expect(encontrada).toBeNull();
        });
    });

    // === obtenerOfertasPendientes() ===

    describe('obtenerOfertasPendientes()', () => {
        test('debería retornar solo las ofertas con estado "pendiente"', async () => {
            // Inserto dos ofertas (ambas quedan pendientes por default).
            const oferta1 = await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);

            // Apruebo la primera, la segunda queda pendiente.
            await modeloOferta.actualizarEvaluacion(oferta1.id, 'aprobada', 'Match');

            const pendientes = await modeloOferta.obtenerOfertasPendientes();

            expect(pendientes).toHaveLength(1);
            expect(pendientes[0].titulo).toBe(segundaOferta.titulo);
            expect(pendientes[0].estado_evaluacion).toBe('pendiente');
        });
    });

    // === obtenerEstadisticas() ===

    describe('obtenerEstadisticas()', () => {
        test('debería retornar conteo por cada estado de evaluación', async () => {
            // Inserto 3 ofertas con distintos estados.
            const oferta1 = await modeloOferta.crearOferta(ofertaEjemplo);
            const oferta2 = await modeloOferta.crearOferta(segundaOferta);
            await modeloOferta.crearOferta({
                ...ofertaEjemplo,
                url: 'https://www.linkedin.com/jobs/view/99999',
                titulo: 'Fullstack Junior',
            });

            // Apruebo una, rechazo otra, la tercera queda pendiente.
            await modeloOferta.actualizarEvaluacion(oferta1.id, 'aprobada', 'Match');
            await modeloOferta.actualizarEvaluacion(oferta2.id, 'rechazada', 'No match');

            const estadisticas = await modeloOferta.obtenerEstadisticas();

            expect(estadisticas.total).toBe(3);
            expect(estadisticas.pendientes).toBe(1);
            expect(estadisticas.aprobadas).toBe(1);
            expect(estadisticas.rechazadas).toBe(1);
        });

        test('debería retornar todo en cero cuando la tabla está vacía', async () => {
            const estadisticas = await modeloOferta.obtenerEstadisticas();

            expect(estadisticas.total).toBe(0);
            expect(estadisticas.pendientes).toBe(0);
            expect(estadisticas.aprobadas).toBe(0);
            expect(estadisticas.rechazadas).toBe(0);
        });
    });

    // === actualizarEvaluacion() ===

    describe('actualizarEvaluacion()', () => {
        test('debería cambiar el estado y la razón de evaluación', async () => {
            const oferta = await modeloOferta.crearOferta(ofertaEjemplo);

            const actualizada = await modeloOferta.actualizarEvaluacion(
                oferta.id,
                'rechazada',
                'Requiere Java, no coincide con el stack del perfil'
            );

            expect(actualizada.estado_evaluacion).toBe('rechazada');
            expect(actualizada.razon_evaluacion).toBe(
                'Requiere Java, no coincide con el stack del perfil'
            );

            // Verifico que en la BD también cambió.
            const verificacion = await modeloOferta.obtenerOfertaPorId(oferta.id);
            expect(verificacion.estado_evaluacion).toBe('rechazada');
        });

        test('debería guardar el porcentaje de match cuando se proporciona', async () => {
            const oferta = await modeloOferta.crearOferta(ofertaEjemplo);

            const actualizada = await modeloOferta.actualizarEvaluacion(
                oferta.id,
                'aprobada',
                'Match perfecto con Angular y TypeScript.',
                85
            );

            expect(actualizada.porcentaje_match).toBe(85);

            const verificacion = await modeloOferta.obtenerOfertaPorId(oferta.id);
            expect(verificacion.porcentaje_match).toBe(85);
        });

        test('debería guardar porcentaje null si no se proporciona', async () => {
            const oferta = await modeloOferta.crearOferta(ofertaEjemplo);

            const actualizada = await modeloOferta.actualizarEvaluacion(
                oferta.id,
                'aprobada',
                'Cumple requisitos.'
            );

            expect(actualizada.porcentaje_match).toBeNull();
        });
    });

    // === actualizarPostulacion() ===

    describe('actualizarPostulacion()', () => {
        test('debería cambiar el estado de postulación de una oferta', async () => {
            const oferta = await modeloOferta.crearOferta(ofertaEjemplo);

            // Por default arranca en 'no_postulado'.
            expect(oferta.estado_postulacion).toBe('no_postulado');

            const actualizada = await modeloOferta.actualizarPostulacion(
                oferta.id,
                'cv_enviado'
            );

            expect(actualizada.estado_postulacion).toBe('cv_enviado');
        });

        test('debería retornar null si el ID no existe', async () => {
            const resultado = await modeloOferta.actualizarPostulacion(99999, 'cv_enviado');
            expect(resultado).toBeNull();
        });
    });

    // === obtenerOfertas() — Sorting ===

    describe('obtenerOfertas() — Sorting', () => {
        test('debería ordenar por porcentaje_match DESC', async () => {
            const oferta1 = await modeloOferta.crearOferta(ofertaEjemplo);
            const oferta2 = await modeloOferta.crearOferta(segundaOferta);

            await modeloOferta.actualizarEvaluacion(oferta1.id, 'aprobada', 'Match', 60);
            await modeloOferta.actualizarEvaluacion(oferta2.id, 'aprobada', 'Match', 90);

            const ofertas = await modeloOferta.obtenerOfertas({
                ordenar_por: 'porcentaje_match',
                direccion: 'DESC'
            });

            expect(ofertas[0].porcentaje_match).toBe(90);
            expect(ofertas[1].porcentaje_match).toBe(60);
        });

        test('debería usar fecha_extraccion DESC como orden por defecto', async () => {
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);

            const ofertas = await modeloOferta.obtenerOfertas();

            // La segunda insertada tiene fecha_extraccion más reciente.
            expect(ofertas[0].titulo).toBe(segundaOferta.titulo);
        });

        test('debería ignorar columnas de orden no permitidas (previene SQL injection)', async () => {
            await modeloOferta.crearOferta(ofertaEjemplo);

            // Intento meter una columna maliciosa — el modelo debería ignorarla
            // y usar fecha_extraccion por defecto.
            const ofertas = await modeloOferta.obtenerOfertas({
                ordenar_por: 'DROP TABLE ofertas; --'
            });

            expect(ofertas).toHaveLength(1);
        });

        test('debería filtrar por estado_postulacion', async () => {
            const oferta1 = await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);

            await modeloOferta.actualizarPostulacion(oferta1.id, 'cv_enviado');

            const conCv = await modeloOferta.obtenerOfertas({ estado_postulacion: 'cv_enviado' });
            expect(conCv).toHaveLength(1);
            expect(conCv[0].id).toBe(oferta1.id);
        });
    });
});

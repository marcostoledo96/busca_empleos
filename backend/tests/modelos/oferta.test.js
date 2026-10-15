// Tests para el modelo de ofertas (CRUD).
// Estos tests corren contra la base de datos REAL, no contra mocks.
// ¿Por qué? Porque lo que quiero verificar es que mis queries SQL funcionan
// de verdad contra PostgreSQL, no que JavaScript sabe hacer un mock.
//
// ⚠️  IMPORTANTE: estos tests hacen TRUNCATE sobre la tabla ofertas.
// Para proteger los datos de producción, solo corren si la variable
// de entorno ALLOW_DB_TESTS=true está activa.
//
// ⚠️  PROTECCIÓN ADICIONAL: además de ALLOW_DB_TESTS, se verifica que
// NODE_ENV === 'test' o que PGDATABASE contenga 'test' antes de ejecutar
// cualquier TRUNCATE. Si no se cumple, los tests se saltan automáticamente.
// NUNCA correr estos tests contra una base de datos de producción.
//
// Cómo correrlos en PowerShell:
//   $env:ALLOW_DB_TESTS="true"; $env:NODE_ENV="test"; npx jest tests/modelos --runInBand
// En Linux/Mac:
//   ALLOW_DB_TESTS=true NODE_ENV=test npx jest tests/modelos --runInBand

const pool = require('../../src/config/base-datos');
const modeloOferta = require('../../src/modelos/oferta');
const { asegurarBaseDeDatosDeTest } = require('../helpers/test-db-guard');

// Si no está el flag, todos los tests de este archivo se marcan como 'skipped'.
// Esto protege la BD de producción cuando se corre el test suite normal.
// Además, verifico que NODE_ENV sea 'test' o que PGDATABASE contenga 'test'
// como doble seguro para no correr TRUNCATE contra producción.
const dbTestsPermitidos = process.env.ALLOW_DB_TESTS === 'true';
const entornoSeguro = process.env.NODE_ENV === 'test'
    || (process.env.PGDATABASE || '').includes('test');
const contexto = (dbTestsPermitidos && entornoSeguro) ? describe : describe.skip;

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
    // Antes del TRUNCATE, verifico que la BD realmente termine en "_test".
    // Esto previene que un DATABASE_URL mal configurado destruya datos de producción.
    beforeEach(async () => {
        await asegurarBaseDeDatosDeTest(pool);
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY');
    });

    // Al terminar todos los tests, limpio y cierro el pool.
    afterAll(async () => {
        await asegurarBaseDeDatosDeTest(pool);
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

        test('debería manejar reaparición al reinsertar la misma identidad sin crear nueva fila', async () => {
            // Inserto la primera vez — debería funcionar.
            const primera = await modeloOferta.crearOferta(ofertaEjemplo);
            expect(primera).not.toBeNull();
            expect(primera.es_nueva).toBe(true);
            expect(primera.fecha_ultima_extraccion).toBeInstanceOf(Date);

            // Simulo un timestamp previo para verificar actualización de fecha_ultima_extraccion
            await pool.query(
                `UPDATE ofertas SET fecha_ultima_extraccion = NOW() - INTERVAL '1 hour' WHERE id = $1`,
                [primera.id]
            );
            const previa = await modeloOferta.obtenerOfertaPorId(primera.id);

            // Inserto la misma identidad otra vez — no crea nueva fila, es_nueva es false y fecha_ultima_extraccion se actualiza.
            const duplicada = await modeloOferta.crearOferta(ofertaEjemplo);
            expect(duplicada).not.toBeNull();
            expect(duplicada.id).toBe(primera.id);
            expect(duplicada.es_nueva).toBe(false);
            expect(duplicada.es_reaparicion).toBe(true);
            expect(duplicada.fecha_ultima_extraccion).toBeInstanceOf(Date);
            expect(new Date(duplicada.fecha_ultima_extraccion).getTime()).toBeGreaterThan(
                new Date(previa.fecha_ultima_extraccion).getTime()
            );

            // Verifico que en la tabla hay solo 1 registro.
            const conteo = await pool.query('SELECT COUNT(*) AS total FROM ofertas');
            expect(parseInt(conteo.rows[0].total)).toBe(1);
        });
    });

    // === obtenerOfertas() ===

    describe('obtenerOfertas()', () => {
        test('debería retornar ofertas recientes (dentro de los últimos 30 días)', async () => {
            // Inserto dos ofertas distintas. Ambas tienen fecha_extraccion = NOW()
            // (default de la BD), así que caen dentro de los últimos 30 días.
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);

            const resultado = await modeloOferta.obtenerOfertas();

            expect(resultado.ofertas).toHaveLength(2);
            expect(resultado.total).toBe(2);
        });

        test('debería incluir ofertas con fecha_extraccion de hace 29 días (límite inclusivo)', async () => {
            // Inserto una oferta y le fuerzo fecha_extraccion a hace 29 días.
            // Debe aparecer porque 29 < 30.
            const oferta = await modeloOferta.crearOferta(ofertaEjemplo);
            await pool.query(
                `UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '29 days', fecha_ultima_extraccion = NOW() - INTERVAL '29 days' WHERE id = $1`,
                [oferta.id]
            );

            const resultado = await modeloOferta.obtenerOfertas();

            expect(resultado.ofertas).toHaveLength(1);
            expect(resultado.total).toBe(1);
            expect(resultado.ofertas[0].id).toBe(oferta.id);
        });

        test('debería excluir ofertas con fecha_extraccion de hace 31 días (fuera de la ventana)', async () => {
            // Inserto una oferta reciente (default NOW(), dentro de los 30 días).
            await modeloOferta.crearOferta(ofertaEjemplo);

            // Inserto otra y le fuerzo fecha_extraccion a hace 31 días.
            // No debería aparecer porque está fuera de la ventana de 30 días.
            const ofertaVieja = await modeloOferta.crearOferta(segundaOferta);
            await pool.query(
                `UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '31 days', fecha_ultima_extraccion = NOW() - INTERVAL '31 days' WHERE id = $1`,
                [ofertaVieja.id]
            );

            const resultado = await modeloOferta.obtenerOfertas();

            // Solo la oferta reciente debería aparecer.
            expect(resultado.ofertas).toHaveLength(1);
            expect(resultado.total).toBe(1);
            expect(resultado.ofertas[0].titulo).toBe(ofertaEjemplo.titulo);
        });

        test('el total debería reflejar solo ofertas dentro de los últimos 30 días', async () => {
            // Inserto 3 ofertas: 2 recientes y 1 vieja (más de 30 días).
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);
            const ofertaVieja = await modeloOferta.crearOferta({
                ...ofertaEjemplo,
                url: 'https://www.linkedin.com/jobs/view/33333',
                titulo: 'Oferta Vieja',
            });
            await pool.query(
                `UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '31 days', fecha_ultima_extraccion = NOW() - INTERVAL '31 days' WHERE id = $1`,
                [ofertaVieja.id]
            );

            const resultado = await modeloOferta.obtenerOfertas();

            // El total cuenta solo las 2 recientes, no la vieja.
            expect(resultado.ofertas).toHaveLength(2);
            expect(resultado.total).toBe(2);
        });

        test('debería filtrar ofertas por estado_evaluacion dentro de los últimos 30 días', async () => {
            // Inserto una oferta y la apruebo manualmente.
            const oferta = await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.actualizarEvaluacion(oferta.id, 'aprobada', 'Cumple con el perfil');

            // Inserto otra que queda pendiente.
            await modeloOferta.crearOferta(segundaOferta);

            // Filtro solo las aprobadas.
            const resultado = await modeloOferta.obtenerOfertas({ estado: 'aprobada' });
            expect(resultado.ofertas).toHaveLength(1);
            expect(resultado.ofertas[0].titulo).toBe(ofertaEjemplo.titulo);
            expect(resultado.total).toBe(1);
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
        test('debería retornar conteo por cada estado de evaluación (solo últimos 30 días)', async () => {
            // Inserto 3 ofertas con distintos estados, todas recientes.
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

        test('debería excluir ofertas de hace más de 30 días del conteo', async () => {
            // Inserto una oferta y la apruebo, pero con fecha de hace 31 días.
            // No debe sumar al conteo de aprobadas ni al total.
            const ofertaAprobadaVieja = await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.actualizarEvaluacion(ofertaAprobadaVieja.id, 'aprobada', 'Match');
            await pool.query(
                `UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '31 days', fecha_ultima_extraccion = NOW() - INTERVAL '31 days' WHERE id = $1`,
                [ofertaAprobadaVieja.id]
            );

            // Inserto una oferta reciente pendiente.
            await modeloOferta.crearOferta(segundaOferta);

            const estadisticas = await modeloOferta.obtenerEstadisticas();

            // Solo la oferta reciente cuenta.
            expect(estadisticas.total).toBe(1);
            expect(estadisticas.pendientes).toBe(1);
            expect(estadisticas.aprobadas).toBe(0);
        });

        test('debería incluir ofertas de hace 29 días en el conteo', async () => {
            // Inserto una oferta y le fuerzo fecha a hace 29 días — debe aparecer.
            const oferta = await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.actualizarEvaluacion(oferta.id, 'rechazada', 'Requiere Java');
            await pool.query(
                `UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '29 days', fecha_ultima_extraccion = NOW() - INTERVAL '29 days' WHERE id = $1`,
                [oferta.id]
            );

            const estadisticas = await modeloOferta.obtenerEstadisticas();

            expect(estadisticas.total).toBe(1);
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

            const resultado = await modeloOferta.obtenerOfertas({
                ordenar_por: 'porcentaje_match',
                direccion: 'DESC'
            });

            expect(resultado.ofertas[0].porcentaje_match).toBe(90);
            expect(resultado.ofertas[1].porcentaje_match).toBe(60);
        });

        test('debería usar fecha_extraccion DESC como orden por defecto', async () => {
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);

            const resultado = await modeloOferta.obtenerOfertas();

            // La segunda insertada tiene fecha_extraccion más reciente.
            expect(resultado.ofertas[0].titulo).toBe(segundaOferta.titulo);
        });

        test('debería ignorar columnas de orden no permitidas (previene SQL injection)', async () => {
            await modeloOferta.crearOferta(ofertaEjemplo);

            // Intento meter una columna maliciosa — el modelo debería ignorarla
            // y usar fecha_extraccion por defecto.
            const resultado = await modeloOferta.obtenerOfertas({
                ordenar_por: 'DROP TABLE ofertas; --'
            });

            expect(resultado.ofertas).toHaveLength(1);
        });

        test('debería filtrar por estado_postulacion', async () => {
            const oferta1 = await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);

            await modeloOferta.actualizarPostulacion(oferta1.id, 'cv_enviado');

            const resultado = await modeloOferta.obtenerOfertas({ estado_postulacion: 'cv_enviado' });
            expect(resultado.ofertas).toHaveLength(1);
            expect(resultado.ofertas[0].id).toBe(oferta1.id);
        });

        test('debería excluir ofertas viejas del sorting (filtro de últimos 30 días)', async () => {
            // Inserto una oferta reciente y la apruebo con 60%.
            const ofertaReciente = await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.actualizarEvaluacion(ofertaReciente.id, 'aprobada', 'Match', 60);

            // Inserto otra oferta y la fuerzo a fecha vieja con 90% de match.
            // Aunque tiene mejor porcentaje, no debería aparecer porque está fuera
            // de la ventana de 30 días.
            const ofertaVieja = await modeloOferta.crearOferta(segundaOferta);
            await modeloOferta.actualizarEvaluacion(ofertaVieja.id, 'aprobada', 'Match', 90);
            await pool.query(
                `UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '31 days', fecha_ultima_extraccion = NOW() - INTERVAL '31 days' WHERE id = $1`,
                [ofertaVieja.id]
            );

            const resultado = await modeloOferta.obtenerOfertas({
                ordenar_por: 'porcentaje_match',
                direccion: 'DESC'
            });

            // Solo la oferta reciente (60%) aparece, la vieja (90%) queda filtrada.
            expect(resultado.ofertas).toHaveLength(1);
            expect(resultado.ofertas[0].porcentaje_match).toBe(60);
            expect(resultado.total).toBe(1);
        });
    });

    // === obtenerOfertas() — Sin paginación (sin limite_pagina) ===

    describe('obtenerOfertas() — Sin paginación', () => {
        test('sin limite_pagina: debería retornar TODAS las ofertas sin LIMIT', async () => {
            // Inserto varias ofertas y verifico que todas se retornan.
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);
            await modeloOferta.crearOferta({
                ...ofertaEjemplo,
                url: 'https://www.linkedin.com/jobs/view/55555',
                titulo: 'Backend Junior',
            });

            const resultado = await modeloOferta.obtenerOfertas();

            // Sin limite_pagina, obtengo todas sin restricción.
            expect(resultado.ofertas).toHaveLength(3);
            expect(resultado.total).toBe(3);
            // limite_pagina debe ser null cuando no se pasa paginación.
            expect(resultado.limite_pagina).toBeNull();
            expect(resultado.pagina).toBe(1);
        });

        test('sin limite_pagina: debería excluir ofertas fuera de los últimos 30 días', async () => {
            // Inserto una oferta reciente y una vieja.
            await modeloOferta.crearOferta(ofertaEjemplo);
            const ofertaVieja = await modeloOferta.crearOferta(segundaOferta);
            await pool.query(
                `UPDATE ofertas SET fecha_extraccion = NOW() - INTERVAL '31 days', fecha_ultima_extraccion = NOW() - INTERVAL '31 days' WHERE id = $1`,
                [ofertaVieja.id]
            );

            const resultado = await modeloOferta.obtenerOfertas();

            // Solo la oferta reciente aparece.
            expect(resultado.ofertas).toHaveLength(1);
            expect(resultado.total).toBe(1);
            expect(resultado.limite_pagina).toBeNull();
        });

        test('sin limite_pagina con filtros: debería retornar todas las que coincidan', async () => {
            // Inserto 3 ofertas con distinto estado.
            const oferta1 = await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);
            const oferta3 = await modeloOferta.crearOferta({
                ...ofertaEjemplo,
                url: 'https://www.linkedin.com/jobs/view/77777',
                titulo: 'Otra aprobada',
            });

            // Apruebo 2 ofertas.
            await modeloOferta.actualizarEvaluacion(oferta1.id, 'aprobada', 'Match');
            await modeloOferta.actualizarEvaluacion(oferta3.id, 'aprobada', 'Match');

            // Filtro por estado 'aprobada' sin paginación.
            const resultado = await modeloOferta.obtenerOfertas({ estado: 'aprobada' });

            expect(resultado.ofertas).toHaveLength(2);
            expect(resultado.total).toBe(2);
            expect(resultado.limite_pagina).toBeNull();
        });

        test('limite_pagina vacío o nulo: debería comportarse como sin paginación', async () => {
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);

            // Paso limite_pagina como string vacío — no debe paginar.
            const resultado = await modeloOferta.obtenerOfertas({ limite_pagina: '' });

            expect(resultado.ofertas).toHaveLength(2);
            expect(resultado.limite_pagina).toBeNull();
        });
    });

    // === obtenerOfertas() — Con paginación (con limite_pagina) ===

    describe('obtenerOfertas() — Con paginación', () => {
        test('con limite_pagina: debería paginar correctamente', async () => {
            // Inserto 3 ofertas.
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);
            await modeloOferta.crearOferta({
                ...ofertaEjemplo,
                url: 'https://www.linkedin.com/jobs/view/55555',
                titulo: 'Backend Junior',
            });

            // Pido página 1 con límite 2.
            const resultado = await modeloOferta.obtenerOfertas({ limite_pagina: 2, pagina: 1 });

            expect(resultado.ofertas).toHaveLength(2);
            expect(resultado.total).toBe(3);
            expect(resultado.pagina).toBe(1);
            expect(resultado.limite_pagina).toBe(2);
        });

        test('con limite_pagina: página 2 debería retornar los resultados restantes', async () => {
            // Inserto 3 ofertas.
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);
            await modeloOferta.crearOferta({
                ...ofertaEjemplo,
                url: 'https://www.linkedin.com/jobs/view/55555',
                titulo: 'Backend Junior',
            });

            // Pido página 2 con límite 2 (debería tener 1 sola oferta).
            const resultado = await modeloOferta.obtenerOfertas({ limite_pagina: 2, pagina: 2 });

            expect(resultado.ofertas).toHaveLength(1);
            expect(resultado.total).toBe(3);
            expect(resultado.pagina).toBe(2);
            expect(resultado.limite_pagina).toBe(2);
        });

        test('con limite_pagina mayor al total: debería retornar todas sin error', async () => {
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);

            // Pido límite 100 — hay solo 2 ofertas.
            const resultado = await modeloOferta.obtenerOfertas({ limite_pagina: 100 });

            expect(resultado.ofertas).toHaveLength(2);
            expect(resultado.total).toBe(2);
            expect(resultado.limite_pagina).toBe(100);
        });

        test('con limite_pagina inválido: debería comportarse como sin paginación', async () => {
            await modeloOferta.crearOferta(ofertaEjemplo);
            await modeloOferta.crearOferta(segundaOferta);

            // Paso un valor no numérico — no debe paginar.
            const resultado = await modeloOferta.obtenerOfertas({ limite_pagina: 'abc' });

            expect(resultado.ofertas).toHaveLength(2);
            expect(resultado.limite_pagina).toBeNull();
        });

        test('con limite_pagina negativo: debería comportarse como sin paginación', async () => {
            await modeloOferta.crearOferta(ofertaEjemplo);

            const resultado = await modeloOferta.obtenerOfertas({ limite_pagina: -5 });

            expect(resultado.ofertas).toHaveLength(1);
            expect(resultado.limite_pagina).toBeNull();
        });
    });

    // === actualizarDescripcionManual() y CAS (Issue #17 / B-08) ===

    describe('actualizarDescripcionManual() y CAS de evaluación', () => {
        test('actualizarDescripcionManual() actualiza campos, preserva original y resetea a pendiente', async () => {
            const creada = await modeloOferta.crearOferta(ofertaEjemplo);
            const nuevaDescripcion = 'Esta es una nueva descripción completa pegada manualmente por el usuario para la oferta.';

            const actualizada = await modeloOferta.actualizarDescripcionManual(creada.id, nuevaDescripcion);

            expect(actualizada).not.toBeNull();
            expect(actualizada.descripcion).toBe(nuevaDescripcion);
            expect(actualizada.descripcion_original).toBe(ofertaEjemplo.descripcion);
            expect(actualizada.origen_descripcion).toBe('manual');
            expect(actualizada.descripcion_completitud).toBe('completa');
            expect(actualizada.descripcion_modificada_en).toBeInstanceOf(Date);
            expect(actualizada.estado_evaluacion).toBe('pendiente');
            expect(actualizada.evaluacion_error_mensaje).toBe('REEVALUACION_SOLICITADA');

            // Segunda edición manual: debe conservar la primera descripción_original intacta
            const segundaEdicion = 'Segunda modificación manual con longitud suficiente de más de veinte caracteres para validar.';
            const actualizada2 = await modeloOferta.actualizarDescripcionManual(creada.id, segundaEdicion);
            expect(actualizada2.descripcion_original).toBe(ofertaEjemplo.descripcion);
            expect(actualizada2.descripcion).toBe(segundaEdicion);
        });

        test('actualizarEvaluacion() con CAS exitoso con fecha NO NULA tras edición manual y rechazo ante carrera (B-09)', async () => {
            const creada = await modeloOferta.crearOferta(ofertaEjemplo);
            expect(creada.descripcion_modificada_en).toBeNull();

            // 1. Usuario edita manualmente la descripción (guarda fecha no nula con microsegundos en BD)
            const manual = await modeloOferta.actualizarDescripcionManual(creada.id, 'Descripción modificada manualmente con más de veinte caracteres.');
            expect(manual.estado_evaluacion).toBe('pendiente');
            expect(manual.descripcion_modificada_en).not.toBeNull();

            // 2. Worker lee la fila con fecha NO NULA desde BD
            const leida = await modeloOferta.obtenerOfertaPorId(creada.id);
            expect(leida.descripcion_modificada_en).toBeInstanceOf(Date);

            // 3. Reevaluación sin concurrencia: UPDATE debe afectar 1 fila (no retornar null por pérdida de microsegundos)
            const evalExitosa = await modeloOferta.actualizarEvaluacion(
                leida.id,
                'aprobada',
                'Coincidencia confirmada post-edición',
                92,
                null,
                null,
                'firma-post-manual-v1',
                null,
                leida.descripcion,
                leida.descripcion_modificada_en
            );
            expect(evalExitosa).not.toBeNull();
            expect(evalExitosa.estado_evaluacion).toBe('aprobada');
            expect(evalExitosa.porcentaje_match).toBe(92);

            // 4. Se simula edición intercalada posterior (cambia nuevamente la fecha en BD)
            const segundaEdicion = await modeloOferta.actualizarDescripcionManual(creada.id, 'Segunda edición manual con longitud suficiente de más de veinte caracteres.');
            expect(segundaEdicion.estado_evaluacion).toBe('pendiente');

            // 5. Worker concurrente intenta escribir con el snapshot anterior (fecha no nula desactualizada):
            // Debe fallar el CAS (retornar null) para no sobrescribir el estado pendiente
            const evalConcurrenteDesactualizada = await modeloOferta.actualizarEvaluacion(
                leida.id,
                'rechazada',
                'Resultado viejo descartado',
                40,
                null,
                null,
                'firma-desactualizada',
                null,
                leida.descripcion,
                leida.descripcion_modificada_en
            );
            expect(evalConcurrenteDesactualizada).toBeNull();

            // 6. La BD conserva el estado pendiente con REEVALUACION_SOLICITADA
            const ofertaFinal = await modeloOferta.obtenerOfertaPorId(creada.id);
            expect(ofertaFinal.estado_evaluacion).toBe('pendiente');
            expect(ofertaFinal.evaluacion_error_mensaje).toBe('REEVALUACION_SOLICITADA');
        });

        test('registrarErrorEvaluacion() con CAS exitoso con fecha NO NULA y rechazo ante carrera (B-09)', async () => {
            const creada = await modeloOferta.crearOferta(ofertaEjemplo);

            // 1. Edición manual
            await modeloOferta.actualizarDescripcionManual(creada.id, 'Descripción con más de veinte caracteres para probar error de evaluación.');
            const leida = await modeloOferta.obtenerOfertaPorId(creada.id);
            expect(leida.descripcion_modificada_en).toBeInstanceOf(Date);

            // 2. Registro de error sin concurrencia: afecta 1 fila
            const errorExitoso = await modeloOferta.registrarErrorEvaluacion(
                leida.id,
                'Error de timeout en IA',
                leida.descripcion,
                leida.descripcion_modificada_en
            );
            expect(errorExitoso).not.toBeNull();
            expect(errorExitoso.evaluacion_error_mensaje).toBe('Error de timeout en IA');

            // 3. Edición intercalada
            await modeloOferta.actualizarDescripcionManual(creada.id, 'Otra modificación manual con longitud suficiente de más de veinte caracteres.');

            // 4. Intento registrar error con snapshot desactualizado: retorna null
            const errorConcurrente = await modeloOferta.registrarErrorEvaluacion(
                leida.id,
                'Error viejo',
                leida.descripcion,
                leida.descripcion_modificada_en
            );
            expect(errorConcurrente).toBeNull();
        });
    });
});

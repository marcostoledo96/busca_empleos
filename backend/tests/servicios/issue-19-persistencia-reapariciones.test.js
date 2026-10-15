// Tests para persistencia de ofertas y reapariciones (Issue #19 - Tarea T3).
// Valido inserción inicial, deduplicación por identidad canónica, reglas de calidad
// en reapariciones (descripción, modalidad, ubicación, origen manual, postulación)
// y ventana de visibilidad de 30 días basada en actividad reciente.

const pool = require('../../src/config/base-datos');
const modeloOferta = require('../../src/modelos/oferta');
const { asegurarBaseDeDatosDeTest } = require('../helpers/test-db-guard');

const dbTestsPermitidos = process.env.ALLOW_DB_TESTS === 'true';
const entornoSeguro = process.env.NODE_ENV === 'test'
    || (process.env.PGDATABASE || '').includes('test');
const contexto = (dbTestsPermitidos && entornoSeguro) ? describe : describe.skip;

const ofertaBase = {
    titulo: 'Desarrollador Backend Node.js Senior',
    empresa: 'Globant',
    ubicacion: 'Buenos Aires, Argentina',
    modalidad: 'remoto',
    descripcion: 'Buscamos desarrollador senior con sólida experiencia en Node.js, Express y bases de datos relacionales PostgreSQL.',
    url: 'https://www.linkedin.com/jobs/view/4436157529',
    plataforma: 'linkedin',
    nivel_requerido: 'senior',
    salario_min: 1500000,
    salario_max: 2200000,
    moneda: 'ARS',
    datos_crudos: { fuente: 'apify', lote: 'lote-101' },
};

contexto('Issue #19 - Persistencia y Reapariciones de Ofertas', () => {
    beforeEach(async () => {
        await asegurarBaseDeDatosDeTest(pool);
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY');
    });

    afterAll(async () => {
        await asegurarBaseDeDatosDeTest(pool);
        await pool.query('TRUNCATE TABLE ofertas RESTART IDENTITY');
        await pool.end();
    });

    test('1. Inserción de oferta nueva (es_nueva: true, resultado_persistencia: "insertada")', async () => {
        const resultado = await modeloOferta.crearOferta(ofertaBase);

        expect(resultado).not.toBeNull();
        expect(resultado.id).toBeDefined();
        expect(resultado.es_nueva).toBe(true);
        expect(resultado.fue_actualizada).toBe(false);
        expect(resultado.es_reaparicion).toBe(false);
        expect(resultado.resultado_persistencia).toBe('insertada');
        expect(resultado.identidad_canonica).toBe('linkedin:4436157529');
        expect(resultado.fecha_extraccion).toBeInstanceOf(Date);
        expect(resultado.fecha_ultima_extraccion).toBeInstanceOf(Date);
        expect(resultado.estado_evaluacion).toBe('pendiente');

        const conteo = await pool.query('SELECT COUNT(*)::integer AS total FROM ofertas');
        expect(conteo.rows[0].total).toBe(1);
    });

    test('2. Reaparición sin cambios relevantes preserva evaluación, actualiza fecha_ultima_extraccion y preserva fecha_extraccion', async () => {
        // Inserto y evalúo la oferta
        const creada = await modeloOferta.crearOferta(ofertaBase);
        await modeloOferta.actualizarEvaluacion(
            creada.id,
            'aprobada',
            'Perfil coincide con los requerimientos técnicos.',
            90
        );

        // Simulo que la primera extracción ocurrió hace 2 horas
        await pool.query(
            `UPDATE ofertas
             SET fecha_extraccion = NOW() - INTERVAL '2 hours',
                 fecha_ultima_extraccion = NOW() - INTERVAL '2 hours'
             WHERE id = $1`,
            [creada.id]
        );
        const leidaAntes = await modeloOferta.obtenerOfertaPorId(creada.id);

        // Reaparición idéntica desde el scraper
        const reaparicion = await modeloOferta.crearOferta(ofertaBase);

        expect(reaparicion).not.toBeNull();
        expect(reaparicion.id).toBe(creada.id);
        expect(reaparicion.es_nueva).toBe(false);
        expect(reaparicion.fue_actualizada).toBe(false);
        expect(reaparicion.es_reaparicion).toBe(true);
        expect(reaparicion.resultado_persistencia).toBe('reaparicion');

        // Preserva evaluación intacta
        expect(reaparicion.estado_evaluacion).toBe('aprobada');
        expect(reaparicion.porcentaje_match).toBe(90);
        expect(reaparicion.razon_evaluacion).toBe('Perfil coincide con los requerimientos técnicos.');

        // Preserva primera detección intacta
        expect(new Date(reaparicion.fecha_extraccion).toISOString()).toBe(
            new Date(leidaAntes.fecha_extraccion).toISOString()
        );

        // Actualiza fecha_ultima_extraccion
        expect(new Date(reaparicion.fecha_ultima_extraccion).getTime()).toBeGreaterThan(
            new Date(leidaAntes.fecha_ultima_extraccion).getTime()
        );

        // No crea fila duplicada
        const conteo = await pool.query('SELECT COUNT(*)::integer AS total FROM ofertas');
        expect(conteo.rows[0].total).toBe(1);
    });

    test('3. Reaparición que completa descripción vacía actualiza descripción y marca REEVALUACION_SOLICITADA', async () => {
        // Oferta creada inicialmente sin descripción completa
        const ofertaIncompleta = {
            ...ofertaBase,
            descripcion: null,
            modalidad: 'remoto',
            ubicacion: 'Buenos Aires',
        };
        const creada = await modeloOferta.crearOferta(ofertaIncompleta);
        expect(creada.descripcion).toBeNull();

        // Apruebo la oferta inicial
        await modeloOferta.actualizarEvaluacion(creada.id, 'aprobada', 'Evaluada sin descripción', 70);

        // Reaparición que trae la descripción completa
        const reaparicion = await modeloOferta.crearOferta({
            ...ofertaBase,
            descripcion: 'Descripción completa extraída posteriormente con más de 20 caracteres y requisitos técnicos.',
        });

        expect(reaparicion.id).toBe(creada.id);
        expect(reaparicion.es_nueva).toBe(false);
        expect(reaparicion.fue_actualizada).toBe(true);
        expect(reaparicion.es_reaparicion).toBe(false);
        expect(reaparicion.resultado_persistencia).toBe('actualizada');

        // Se actualizó la descripción
        expect(reaparicion.descripcion).toContain('Descripción completa extraída posteriormente');

        // Se solicita reevaluación
        expect(reaparicion.estado_evaluacion).toBe('pendiente');
        expect(reaparicion.evaluacion_error_mensaje).toBe('REEVALUACION_SOLICITADA');
        expect(reaparicion.porcentaje_match).toBeNull();
        expect(reaparicion.razon_evaluacion).toBe('Información de la oferta actualizada por nueva extracción; requiere reevaluación.');
    });

    test('4. Reaparición con descripción más corta conserva la descripción larga existente', async () => {
        const descripcionLarga = 'Esta es una descripción larga y muy detallada con todos los requisitos necesarios para el puesto de trabajo solicitado.';
        const creada = await modeloOferta.crearOferta({
            ...ofertaBase,
            descripcion: descripcionLarga,
        });

        // Reaparición con descripción resumida / corta
        const reaparicion = await modeloOferta.crearOferta({
            ...ofertaBase,
            descripcion: 'Descripción corta.',
        });

        expect(reaparicion.id).toBe(creada.id);
        expect(reaparicion.es_nueva).toBe(false);
        expect(reaparicion.fue_actualizada).toBe(false);
        expect(reaparicion.es_reaparicion).toBe(true);
        expect(reaparicion.resultado_persistencia).toBe('reaparicion');

        // Conserva la descripción larga previa
        expect(reaparicion.descripcion).toBe(descripcionLarga);
    });

    test('5. Reaparición con descripción manual no sobrescribe la descripción manual', async () => {
        const creada = await modeloOferta.crearOferta(ofertaBase);

        // Usuario edita manualmente la descripción
        const manualTexto = 'Descripción corregida y editada a mano por el usuario con más de veinte caracteres.';
        await modeloOferta.actualizarDescripcionManual(creada.id, manualTexto);
        await modeloOferta.actualizarEvaluacion(creada.id, 'aprobada', 'Evaluación manual confirmada', 95);

        // Reaparición con una descripción supuestamente más larga del scraper
        const reaparicion = await modeloOferta.crearOferta({
            ...ofertaBase,
            descripcion: 'Descripción larguísima del scraper que de ninguna manera debe pisar el texto que el usuario editó a mano conscientemente.',
        });

        expect(reaparicion.id).toBe(creada.id);
        expect(reaparicion.origen_descripcion).toBe('manual');
        expect(reaparicion.descripcion).toBe(manualTexto);
        expect(reaparicion.estado_evaluacion).toBe('aprobada');
        expect(reaparicion.porcentaje_match).toBe(95);
        expect(reaparicion.fue_actualizada).toBe(false);
        expect(reaparicion.es_reaparicion).toBe(true);
    });

    test('6. Reaparición preserva estados de postulación manuales (cv_enviado, en_proceso, descartada)', async () => {
        const estadosManuales = ['cv_enviado', 'en_proceso', 'descartada'];

        for (let i = 0; i < estadosManuales.length; i++) {
            const estado = estadosManuales[i];
            const oferta = {
                ...ofertaBase,
                url: `https://www.linkedin.com/jobs/view/900000000${i}`,
            };

            const creada = await modeloOferta.crearOferta(oferta);
            await modeloOferta.actualizarPostulacion(creada.id, estado);

            // Reaparición de la oferta
            const reaparicion = await modeloOferta.crearOferta(oferta);

            expect(reaparicion.id).toBe(creada.id);
            expect(reaparicion.estado_postulacion).toBe(estado);
        }
    });

    test('7. Oferta de hace 40 días con reaparición hoy es visible en consultas de 30 días', async () => {
        const creada = await modeloOferta.crearOferta(ofertaBase);

        // Fuerzo fechas a hace 40 días
        await pool.query(
            `UPDATE ofertas
             SET fecha_extraccion = NOW() - INTERVAL '40 days',
                 fecha_ultima_extraccion = NOW() - INTERVAL '40 days'
             WHERE id = $1`,
            [creada.id]
        );

        // Antes de reaparecer, la ventana de 30 días no la lista
        const listadoAntes = await modeloOferta.obtenerOfertas();
        expect(listadoAntes.total).toBe(0);
        expect(listadoAntes.ofertas).toHaveLength(0);

        const estadisticasAntes = await modeloOferta.obtenerEstadisticas();
        expect(estadisticasAntes.total).toBe(0);

        // Reaparición hoy
        const reaparicion = await modeloOferta.crearOferta(ofertaBase);
        expect(reaparicion.es_reaparicion).toBe(true);
        expect(new Date(reaparicion.fecha_ultima_extraccion).getTime()).toBeGreaterThan(
            Date.now() - 5000
        );

        // Ahora es visible en el listado de 30 días
        const listadoDespues = await modeloOferta.obtenerOfertas();
        expect(listadoDespues.total).toBe(1);
        expect(listadoDespues.ofertas).toHaveLength(1);
        expect(listadoDespues.ofertas[0].id).toBe(creada.id);

        // Y en las estadísticas
        const estadisticasDespues = await modeloOferta.obtenerEstadisticas();
        expect(estadisticasDespues.total).toBe(1);
    });

    test('8. Reaparición que completa modalidad o ubicación faltante marca REEVALUACION_SOLICITADA', async () => {
        const ofertaSinModalidad = {
            ...ofertaBase,
            modalidad: null,
            ubicacion: null,
        };
        const creada = await modeloOferta.crearOferta(ofertaSinModalidad);
        await modeloOferta.actualizarEvaluacion(creada.id, 'aprobada', 'Evaluada sin modalidad ni ubicación', 80);

        // Reaparición que trae modalidad y ubicación
        const reaparicion = await modeloOferta.crearOferta({
            ...ofertaBase,
            modalidad: 'hibrido',
            ubicacion: 'Córdoba, Argentina',
        });

        expect(reaparicion.id).toBe(creada.id);
        expect(reaparicion.fue_actualizada).toBe(true);
        expect(reaparicion.modalidad).toBe('hibrido');
        expect(reaparicion.ubicacion).toBe('Córdoba, Argentina');
        expect(reaparicion.estado_evaluacion).toBe('pendiente');
        expect(reaparicion.evaluacion_error_mensaje).toBe('REEVALUACION_SOLICITADA');
    });

    test('9. Reaparición combina datos_crudos incrementales con los existentes', async () => {
        const creada = await modeloOferta.crearOferta({
            ...ofertaBase,
            datos_crudos: { primerLote: 'lote-1', metadata: { version: 1 } },
        });

        const reaparicion = await modeloOferta.crearOferta({
            ...ofertaBase,
            datos_crudos: { segundoLote: 'lote-2', metadata: { version: 2 } },
        });

        expect(reaparicion.datos_crudos).toEqual({
            primerLote: 'lote-1',
            segundoLote: 'lote-2',
            metadata: { version: 2 },
        });
    });
});

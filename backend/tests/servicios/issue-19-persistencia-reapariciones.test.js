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

    test('10. Reaparición que completa empresa, nivel, salario o moneda marca fue_actualizada=true y resultado_persistencia="actualizada"', async () => {
        const ofertaParcial = {
            ...ofertaBase,
            empresa: null,
            nivel_requerido: null,
            salario_min: null,
            salario_max: null,
            moneda: null,
        };
        const creada = await modeloOferta.crearOferta(ofertaParcial);
        expect(creada.empresa).toBeNull();
        expect(creada.nivel_requerido).toBeNull();

        const reaparicion = await modeloOferta.crearOferta({
            ...ofertaBase,
            empresa: 'Globant Argentina S.A.',
            nivel_requerido: 'semi_senior',
            salario_min: 1800000,
            salario_max: 2500000,
            moneda: 'ARS',
        });

        expect(reaparicion.id).toBe(creada.id);
        expect(reaparicion.es_nueva).toBe(false);
        expect(reaparicion.fue_actualizada).toBe(true);
        expect(reaparicion.es_reaparicion).toBe(false);
        expect(reaparicion.resultado_persistencia).toBe('actualizada');
        expect(reaparicion.empresa).toBe('Globant Argentina S.A.');
        expect(reaparicion.nivel_requerido).toBe('semi_senior');
        expect(Number(reaparicion.salario_min)).toBe(1800000);
        expect(Number(reaparicion.salario_max)).toBe(2500000);
        expect(reaparicion.moneda).toBe('ARS');
    });

    test('11. URL extremadamente larga (>500 caracteres) se persiste y deduplica sin violar límites de columna', async () => {
        const paramsLargo = 'paramExtra='.repeat(50) + 'valorFinalLargo';
        const urlLarga = `https://portal-desconocido.com/empleos/oferta-tecnica-especial?id=123456&${paramsLargo}`;
        expect(urlLarga.length).toBeGreaterThan(600);

        const ofertaLarga = {
            titulo: 'Desarrollador con URL Extensa',
            empresa: 'Empresa Global',
            url: urlLarga,
            plataforma: 'desconocida',
        };

        const insertada = await modeloOferta.crearOferta(ofertaLarga);
        expect(insertada).not.toBeNull();
        expect(insertada.identidad_canonica).toBeDefined();
        expect(insertada.identidad_canonica.length).toBeLessThanOrEqual(500);

        // Reaparición con la misma URL extensa
        const reaparicion = await modeloOferta.crearOferta(ofertaLarga);
        expect(reaparicion.id).toBe(insertada.id);
        expect(reaparicion.es_nueva).toBe(false);
        expect(reaparicion.resultado_persistencia).toBe('reaparicion');
    });

    test('12. Reconciliación transparente ante conflicto de URL histórica sin identidad_canonica', async () => {
        const urlHistorica = 'https://www.glassdoor.com.ar/job-listing/developer-jl=100889977';
        const resPrevia = await pool.query(
            `INSERT INTO ofertas (
                titulo, empresa, url, plataforma, identidad_canonica,
                fecha_extraccion, fecha_ultima_extraccion, estado_evaluacion, estado_postulacion
            ) VALUES (
                'Fila Histórica', 'Empresa X', $1, 'glassdoor', 'glassdoor:url:https://www.glassdoor.com.ar/job-listing/developer-jl=100889977',
                NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', 'pendiente', 'no_postulado'
            ) RETURNING *`,
            [urlHistorica]
        );
        const idHistorico = resPrevia.rows[0].id;

        const ofertaNueva = {
            titulo: 'Fila Histórica Enriquecida',
            empresa: 'Empresa X',
            url: urlHistorica,
            plataforma: 'glassdoor',
            descripcion: 'Nueva descripción detallada que enriquece la fila histórica recuperada.',
        };

        const reconciliada = await modeloOferta.crearOferta(ofertaNueva);
        expect(reconciliada.id).toBe(idHistorico);
        expect(reconciliada.identidad_canonica).toBe('glassdoor:100889977');
        expect(reconciliada.descripcion).toContain('Nueva descripción detallada');
    });

    test('13. Enriquecimiento de nivel_requerido (null -> senior) marca REEVALUACION_SOLICITADA y repetición idéntica no reevalúa', async () => {
        // Oferta creada inicialmente sin nivel_requerido y aprobada
        const ofertaSinNivel = {
            ...ofertaBase,
            nivel_requerido: null,
            url: 'https://www.linkedin.com/jobs/view/4436157999',
        };
        const creada = await modeloOferta.crearOferta(ofertaSinNivel);
        expect(creada.nivel_requerido).toBeNull();

        await modeloOferta.actualizarEvaluacion(creada.id, 'aprobada', 'Evaluada sin nivel explícito', 85);

        // Reaparición que incorpora nivel_requerido = 'senior'
        const reaparicionSenior = await modeloOferta.crearOferta({
            ...ofertaSinNivel,
            nivel_requerido: 'senior',
        });

        expect(reaparicionSenior.id).toBe(creada.id);
        expect(reaparicionSenior.nivel_requerido).toBe('senior');
        expect(reaparicionSenior.fue_actualizada).toBe(true);
        expect(reaparicionSenior.estado_evaluacion).toBe('pendiente');
        expect(reaparicionSenior.evaluacion_error_mensaje).toBe('REEVALUACION_SOLICITADA');
        expect(reaparicionSenior.porcentaje_match).toBeNull();
        expect(reaparicionSenior.razon_evaluacion).toBe('Información de la oferta actualizada por nueva extracción; requiere reevaluación.');

        // Se vuelve a evaluar
        await modeloOferta.actualizarEvaluacion(creada.id, 'rechazada', 'Nivel senior excluido para perfil junior', 15);

        // Reaparición idéntica con el mismo nivel_requerido = 'senior'
        const reaparicionIdentica = await modeloOferta.crearOferta({
            ...ofertaSinNivel,
            nivel_requerido: 'senior',
        });

        expect(reaparicionIdentica.id).toBe(creada.id);
        expect(reaparicionIdentica.fue_actualizada).toBe(false);
        expect(reaparicionIdentica.es_reaparicion).toBe(true);
        expect(reaparicionIdentica.resultado_persistencia).toBe('reaparicion');
        // Conserva intacta la evaluación rechazada
        expect(reaparicionIdentica.estado_evaluacion).toBe('rechazada');
        expect(reaparicionIdentica.porcentaje_match).toBe(15);
    });

    test('14. Conflicto de URL entre portales distintos o IDs distintos no sobrescribe la fila anterior y aísla la oferta nueva', async () => {
        const urlCompartida = 'https://empresa.com/careers/software-engineer';

        // 1. Inserción inicial desde Adzuna con datos específicos
        const ofertaAdzuna = {
            titulo: 'Ingeniero de Software (Adzuna)',
            empresa: 'Empresa Global S.A.',
            url: urlCompartida,
            plataforma: 'adzuna',
            datos_crudos: { id: 'adzuna-item-123' },
        };
        const insertadaAdzuna = await modeloOferta.crearOferta(ofertaAdzuna);
        expect(insertadaAdzuna.plataforma).toBe('adzuna');
        expect(insertadaAdzuna.identidad_canonica).toBe('adzuna:adzuna-item-123');

        // Usuario envía CV y guarda estado manual
        await modeloOferta.actualizarPostulacion(insertadaAdzuna.id, 'cv_enviado');

        // 2. Extracción posterior desde Jooble con la misma URL externa
        const ofertaJooble = {
            titulo: 'Software Engineer Backend (Jooble)',
            empresa: 'Empresa Global S.A.',
            url: urlCompartida,
            plataforma: 'jooble',
            datos_crudos: { id: 'jooble-item-456' },
        };
        const resultadoJooble = await modeloOferta.crearOferta(ofertaJooble);

        // Ambas filas deben coexistir en la base de datos sin sobreescribirse
        expect(resultadoJooble).not.toBeNull();
        expect(resultadoJooble.id).not.toBe(insertadaAdzuna.id);
        expect(resultadoJooble.plataforma).toBe('jooble');
        expect(resultadoJooble.identidad_canonica).toBe('jooble:jooble-item-456');

        // La fila previa de Adzuna debe permanecer 100% inalterada
        const adzunaLeida = await modeloOferta.obtenerOfertaPorId(insertadaAdzuna.id);
        expect(adzunaLeida.plataforma).toBe('adzuna');
        expect(adzunaLeida.identidad_canonica).toBe('adzuna:adzuna-item-123');
        expect(adzunaLeida.estado_postulacion).toBe('cv_enviado');
        expect(adzunaLeida.titulo).toBe('Ingeniero de Software (Adzuna)');

        const totalFilas = await pool.query('SELECT COUNT(*)::integer AS total FROM ofertas');
        expect(totalFilas.rows[0].total).toBe(2);
    });

    test('15. Concurrencia real con Promise.all: dos upserts simultáneos con el mismo ID no generan duplicados ni errores', async () => {
        const ofertaConcurrente = {
            titulo: 'Desarrollador Fullstack Concurrente',
            empresa: 'Tech Corp',
            ubicacion: 'CABA, Argentina',
            modalidad: 'remoto',
            descripcion: 'Descripción concurrente para probar locking atómico...',
            url: 'https://www.linkedin.com/jobs/view/9998887771',
            plataforma: 'linkedin',
        };

        // Ejecuto simultáneamente dos llamadas idénticas
        const [res1, res2] = await Promise.all([
            modeloOferta.crearOferta(ofertaConcurrente),
            modeloOferta.crearOferta(ofertaConcurrente),
        ]);

        expect(res1).not.toBeNull();
        expect(res2).not.toBeNull();
        expect(res1.id).toBe(res2.id);

        // Exactamente una es nueva y la otra es reaparición
        const esNuevas = [res1.es_nueva, res2.es_nueva];
        expect(esNuevas).toContain(true);
        expect(esNuevas).toContain(false);

        // Exactamente 1 fila existe en la base de datos
        const conteo = await pool.query('SELECT COUNT(*)::integer AS total FROM ofertas WHERE identidad_canonica = $1', ['linkedin:9998887771']);
        expect(conteo.rows[0].total).toBe(1);
    });
});

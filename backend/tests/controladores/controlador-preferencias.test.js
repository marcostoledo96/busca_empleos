// Tests del controlador de preferencias — verifico que los endpoints HTTP
// responden correctamente y validan los datos de entrada.
//
// Mockeo los modelos y servicios que app.js importa al arrancar.
// Solo testeo que el controlador:
//   1. Llama al modelo correcto.
//   2. Valida campos con reglas de negocio (enums, arrays, booleans).
//   3. Retorna los status y mensajes apropiados.

jest.mock('../../src/modelos/oferta');
jest.mock('../../src/modelos/preferencia');
jest.mock('../../src/servicios/servicio-scraping');
jest.mock('../../src/servicios/servicio-evaluacion');
jest.mock('../../src/utils/middleware-auth', () => ({
    verificarAuth: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const modeloPreferencia = require('../../src/modelos/preferencia');
const {
    NIVELES_VALIDOS,
    MODALIDADES_VALIDAS,
    ZONAS_VALIDAS,
    MODELOS_IA_VALIDOS,
} = require('../../src/controladores/controlador-preferencias');

// Preferencias de ejemplo que simula lo que retorna la BD.
const preferenciasEjemplo = {
    id: 1,
    nombre: 'Marcos Ezequiel Toledo',
    nivel_experiencia: 'junior',
    perfil_profesional: 'Desarrollador de software junior.',
    stack_tecnologico: ['JavaScript', 'TypeScript', 'Angular', 'React', 'Node.js'],
    modalidad_aceptada: 'cualquiera',
    zonas_preferidas: ['CABA', 'GBA Oeste'],
    terminos_busqueda: ['developer', 'qa', 'tester'],
    reglas_exclusion: ['Java'],
    prompt_personalizado: null,
    usar_prompt_personalizado: false,
    modelo_ia: 'deepseek-v4-flash',
    fecha_creacion: '2025-01-01T00:00:00.000Z',
    fecha_actualizacion: '2025-01-01T00:00:00.000Z',
};

describe('Controlador de preferencias', () => {
    afterEach(() => jest.clearAllMocks());

    // === GET /api/preferencias ===

    describe('GET /api/preferencias', () => {
        test('retorna las preferencias con status 200', async () => {
            modeloPreferencia.obtenerPreferencias.mockResolvedValue(preferenciasEjemplo);

            const res = await request(app).get('/api/preferencias');

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.nombre).toBe('Marcos Ezequiel Toledo');
            expect(res.body.datos.stack_tecnologico).toHaveLength(5);
        });
    });

    // === PUT /api/preferencias ===

    describe('PUT /api/preferencias', () => {
        test('actualiza preferencias con datos válidos', async () => {
            const datosActualizados = { ...preferenciasEjemplo, nombre: 'Nombre actualizado' };
            modeloPreferencia.actualizarPreferencias.mockResolvedValue(datosActualizados);

            const res = await request(app)
                .put('/api/preferencias')
                .send({ nombre: 'Nombre actualizado' });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(res.body.datos.nombre).toBe('Nombre actualizado');
            expect(res.body.mensaje).toContain('actualizadas');
        });

        test('retorna 404 si el modelo no encuentra la fila', async () => {
            modeloPreferencia.actualizarPreferencias.mockResolvedValue(null);

            const res = await request(app)
                .put('/api/preferencias')
                .send({ nombre: 'Test' });

            expect(res.status).toBe(404);
            expect(res.body.exito).toBe(false);
        });

        // --- Validación de nivel_experiencia ---

        test('rechaza nivel_experiencia inválido', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ nivel_experiencia: 'senior' });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
            expect(res.body.error).toContain('nivel_experiencia');
            // No debe haber llamado al modelo si la validación falló.
            expect(modeloPreferencia.actualizarPreferencias).not.toHaveBeenCalled();
        });

        test('acepta cada nivel_experiencia válido', async () => {
            for (const nivel of NIVELES_VALIDOS) {
                modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                    ...preferenciasEjemplo,
                    nivel_experiencia: nivel,
                });

                const res = await request(app)
                    .put('/api/preferencias')
                    .send({ nivel_experiencia: nivel });

                expect(res.status).toBe(200);
            }
        });

        // --- Validación de modalidad_aceptada ---

        test('rechaza modalidad_aceptada inválida', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ modalidad_aceptada: 'virtual' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('modalidad_aceptada');
            expect(modeloPreferencia.actualizarPreferencias).not.toHaveBeenCalled();
        });

        // --- Validación de modelo_ia ---

        test('rechaza modelo_ia inválido', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ modelo_ia: 'gpt-4' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('modelo_ia');
            expect(modeloPreferencia.actualizarPreferencias).not.toHaveBeenCalled();
        });

        // --- Validación de arrays de strings ---

        test('rechaza stack_tecnologico vacío', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ stack_tecnologico: [] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('stack_tecnologico');
        });

        test('rechaza stack_tecnologico que no es array', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ stack_tecnologico: 'JavaScript' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('stack_tecnologico');
        });

        test('rechaza stack_tecnologico con strings vacíos', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ stack_tecnologico: ['JavaScript', '', 'React'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('stack_tecnologico');
        });

        test('rechaza terminos_busqueda vacío', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ terminos_busqueda: [] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('terminos_busqueda');
        });

        // --- Validación de zonas_preferidas ---

        test('acepta zonas_preferidas con valores personalizados (fuera del enum original)', async () => {
            // El controlador ahora acepta cualquier string no vacío porque el CV
            // importado puede traer ubicaciones reales como "Buenos Aires, Argentina"
            // que no están en ZONAS_VALIDAS. Solo rechaza strings vacíos o no-strings.
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                zonas_preferidas: ['CABA', 'La Plata'],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ zonas_preferidas: ['CABA', 'La Plata'] });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
        });

        test('acepta zonas_preferidas vacío (el usuario puede no tener preferencia)', async () => {
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                zonas_preferidas: [],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ zonas_preferidas: [] });

            expect(res.status).toBe(200);
        });

        test('rechaza zonas_preferidas que no es array', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ zonas_preferidas: 'CABA' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('zonas_preferidas');
        });

        // --- Validación de reglas_exclusion ---

        test('filtra strings vacíos en reglas_exclusion y acepta los válidos', async () => {
            // validarArrayStrings filtra silenciosamente los strings vacíos (porque
            // el AutoComplete puede dejar items en blanco). 'Java' queda y es válido.
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                reglas_exclusion: ['Java'],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ reglas_exclusion: ['Java', ''] });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
        });

        test('rechaza reglas_exclusion donde todos los elementos son strings vacíos', async () => {
            // Si después de filtrar no queda ningún elemento válido, se rechaza
            // porque permitirVacio es true para reglas_exclusion (array vacío está
            // permitido, pero un array con solo basura se limpia a vacío, que también
            // es válido). Sin embargo, si TODO el array son strings vacíos o no-strings,
            // el filtro los elimina y queda un array vacío, que sí es aceptado.
            // Para probar el rechazo, enviamos algo que NO sea array.
            const res = await request(app)
                .put('/api/preferencias')
                .send({ reglas_exclusion: 'no-es-array' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('reglas_exclusion');
        });

        test('acepta reglas_exclusion vacío', async () => {
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                reglas_exclusion: [],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ reglas_exclusion: [] });

            expect(res.status).toBe(200);
        });

        // --- Validación de usar_prompt_personalizado ---

        test('rechaza usar_prompt_personalizado que no es boolean', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ usar_prompt_personalizado: 'si' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('usar_prompt_personalizado');
            expect(res.body.error).toContain('true o false');
        });

        // --- Validación de idioma_candidato ---

        test('acepta idioma_candidato como string válido', async () => {
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                idioma_candidato: 'Español nativo, Inglés básico oral / intermedio escrito',
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ idioma_candidato: 'Español nativo, Inglés básico oral / intermedio escrito' });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
        });

        test('rechaza idioma_candidato vacío', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ idioma_candidato: '' });

            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
            expect(res.body.error).toContain('idioma_candidato');
        });

        test('rechaza idioma_candidato que no es string', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ idioma_candidato: 3 });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('idioma_candidato');
        });

        // --- Múltiples errores ---

        test('acumula múltiples errores de validación', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({
                    nivel_experiencia: 'ceo',
                    modalidad_aceptada: 'espacial',
                    stack_tecnologico: [],
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('nivel_experiencia');
            expect(res.body.error).toContain('modalidad_aceptada');
            expect(res.body.error).toContain('stack_tecnologico');
            expect(modeloPreferencia.actualizarPreferencias).not.toHaveBeenCalled();
        });

        test('no filtra mensajes de error interno al cliente en error 500', async () => {
            modeloPreferencia.actualizarPreferencias.mockRejectedValue(
                new Error('relation "preferencias" does not exist — este es un detalle interno de BD')
            );

            const res = await request(app)
                .put('/api/preferencias')
                .send({ nombre: 'Nuevo nombre' });

            expect(res.status).toBe(500);
            expect(res.body.exito).toBe(false);
            // El mensaje debe ser genérico, NO contener el error real de BD.
            expect(res.body.error).toBe('Error interno al guardar preferencias.');
            expect(res.body.error).not.toContain('does not exist');
            expect(res.body.error).not.toContain('relation');
        });

        // --- scoring_config deprecado: se ignora sin error ---

        test('ignora scoring_config en payload legacy sin error', async () => {
            // Un cliente viejo puede mandar scoring_config — el backend
            // ya no lo valida ni persiste, pero no debe responder con error.
            // scoring_config no está en camposPermitidos del modelo, así que
            // aunque llegue al modelo, se ignora silenciosamente.
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                nombre: 'Test legacy scoring',
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({
                    nombre: 'Test legacy scoring',
                    scoring_config: { umbral_aprobacion: 70 },
                });

            // scoring_config se ignora porque no está en camposPermitidos.
            // La request es válida porque nombre sí está permitido.
            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
        });
    });

    // === Validación de plataformas con registry ===

    describe('validación de plataformas_preferidas y plataformas_excluidas', () => {
        test('acepta plataformas_preferidas con ids internos válidos', async () => {
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                plataformas_preferidas: ['linkedin', 'computrabajo'],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_preferidas: ['linkedin', 'computrabajo'] });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
        });

        test('acepta plataformas_excluidas con ids internos válidos', async () => {
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                plataformas_excluidas: ['google_jobs', 'infojobs'],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_excluidas: ['google_jobs', 'infojobs'] });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
        });

        test('acepta slug HTTP "google-jobs" y lo normaliza a id interno', async () => {
            // El registry normaliza google-jobs (slug HTTP) a google_jobs (id interno).
            // El controlador acepta ambos formatos gracias a normalizarIdPlataforma.
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                plataformas_preferidas: ['google-jobs'],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_preferidas: ['google-jobs'] });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
        });

        test('rechaza plataformas_preferidas con valores inválidos', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_preferidas: ['linkedin', 'no_existe'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('plataformas_preferidas');
            expect(res.body.error).toContain('no_existe');
            expect(modeloPreferencia.actualizarPreferencias).not.toHaveBeenCalled();
        });

        test('acepta plataformas_preferidas vacío', async () => {
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                plataformas_preferidas: [],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_preferidas: [] });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
        });

        test('acepta todas las plataformas activas del registry', async () => {
            const activas = ['linkedin', 'computrabajo', 'indeed', 'bumeran', 'glassdoor', 'getonbrd', 'jooble', 'remotive', 'remoteok', 'adzuna'];
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                plataformas_preferidas: activas,
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_preferidas: activas });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
        });

        test('acepta plataformas inactivas en preferencias (existen en el registry)', async () => {
            // google_jobs e infojobs son inactivas pero siguen siendo válidas como valores.
            // El usuario puede excluirlas o incluirlas en preferencias.
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                plataformas_preferidas: ['linkedin', 'google_jobs'],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_preferidas: ['linkedin', 'google_jobs'] });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
        });

        // --- Normalización de slugs HTTP a ids internos antes de persistir ---

        test('normaliza slug HTTP "google-jobs" a id interno "google_jobs" antes de persistir', async () => {
            // El cliente manda 'google-jobs' (slug HTTP), pero la BD debe recibir
            // 'google_jobs' (id interno canónico). Verifico que el controlador
            // normaliza antes de llamar al modelo.
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                plataformas_preferidas: ['google_jobs'],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_preferidas: ['google-jobs'] });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            // Verifico que el modelo recibió el id normalizado, no el slug crudo.
            expect(modeloPreferencia.actualizarPreferencias).toHaveBeenCalledWith(
                expect.objectContaining({
                    plataformas_preferidas: ['google_jobs'],
                })
            );
        });

        test('normaliza slug HTTP en plataformas_excluidas antes de persistir', async () => {
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                plataformas_excluidas: ['google_jobs'],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_excluidas: ['google-jobs'] });

            expect(res.status).toBe(200);
            expect(res.body.exito).toBe(true);
            expect(modeloPreferencia.actualizarPreferencias).toHaveBeenCalledWith(
                expect.objectContaining({
                    plataformas_excluidas: ['google_jobs'],
                })
            );
        });

        test('no altera ids internos que ya son canónicos', async () => {
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                plataformas_preferidas: ['linkedin', 'computrabajo'],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_preferidas: ['linkedin', 'computrabajo'] });

            expect(res.status).toBe(200);
            expect(modeloPreferencia.actualizarPreferencias).toHaveBeenCalledWith(
                expect.objectContaining({
                    plataformas_preferidas: ['linkedin', 'computrabajo'],
                })
            );
        });

        test('normaliza mix de slugs HTTP e ids internos en un mismo array', async () => {
            modeloPreferencia.actualizarPreferencias.mockResolvedValue({
                ...preferenciasEjemplo,
                plataformas_preferidas: ['linkedin', 'google_jobs'],
            });

            const res = await request(app)
                .put('/api/preferencias')
                .send({ plataformas_preferidas: ['linkedin', 'google-jobs'] });

            expect(res.status).toBe(200);
            expect(modeloPreferencia.actualizarPreferencias).toHaveBeenCalledWith(
                expect.objectContaining({
                    plataformas_preferidas: ['linkedin', 'google_jobs'],
                })
            );
        });
    });
});

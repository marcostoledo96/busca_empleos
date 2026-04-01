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
    modelo_ia: 'deepseek-chat',
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

        test('rechaza zonas_preferidas con valores fuera del enum', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ zonas_preferidas: ['CABA', 'La Plata'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('La Plata');
            expect(res.body.error).toContain('inválidos');
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

        test('rechaza reglas_exclusion con strings vacíos', async () => {
            const res = await request(app)
                .put('/api/preferencias')
                .send({ reglas_exclusion: ['Java', ''] });

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
    });
});

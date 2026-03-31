// Tests del servicio de evaluación con IA.
//
// ¿Qué testeamos acá?
// 1. Que el prompt se construya correctamente con los datos de la oferta.
// 2. Que la respuesta de DeepSeek se parsee bien (JSON → objeto).
// 3. Que una oferta aprobada actualice el estado en la BD.
// 4. Que una oferta rechazada actualice el estado correctamente.
// 5. Que el filtro de Java funcione (regla estricta).
// 6. Que se manejen errores de la API sin romper el flujo.
// 7. Que evaluarOfertasPendientes() procese todas las pendientes.
//
// IMPORTANTE: Mockeamos DeepSeek (no queremos gastar plata ni depender
// de la red en cada test). También mockeamos el modelo de ofertas
// para no depender de la BD en estos tests unitarios.

// Mockeo el módulo de configuración de DeepSeek.
jest.mock('../../src/config/deepseek', () => ({
    consultarDeepSeek: jest.fn(),
    DEEPSEEK_URL: 'https://api.deepseek.com/chat/completions',
    DEEPSEEK_MODELO: 'deepseek-chat',
}));

// Mockeo el modelo de ofertas para no tocar la base de datos.
jest.mock('../../src/modelos/oferta', () => ({
    obtenerOfertasPendientes: jest.fn(),
    actualizarEvaluacion: jest.fn(),
}));

const { consultarDeepSeek } = require('../../src/config/deepseek');
const modeloOferta = require('../../src/modelos/oferta');
const {
    construirPromptEvaluacion,
    evaluarOferta,
    evaluarOfertasPendientes,
    PERFIL_CANDIDATO,
    INSTRUCCIONES_SISTEMA,
} = require('../../src/servicios/servicio-evaluacion');

// Oferta de ejemplo que simula lo que viene de la BD.
const ofertaEjemplo = {
    id: 1,
    titulo: 'Desarrollador Frontend Junior',
    empresa: 'TechCorp',
    ubicacion: 'Buenos Aires, Argentina',
    modalidad: 'remoto',
    descripcion: 'Buscamos desarrollador frontend con experiencia en React y TypeScript. Nivel trainee/junior. Modalidad remota.',
    plataforma: 'linkedin',
    nivel_requerido: 'junior',
    url: 'https://linkedin.com/jobs/1234',
};

// Oferta que debería ser rechazada por requerir Java.
const ofertaConJava = {
    id: 2,
    titulo: 'Desarrollador Java Junior',
    empresa: 'JavaCorp',
    ubicacion: 'Buenos Aires, Argentina',
    modalidad: 'presencial',
    descripcion: 'Buscamos desarrollador Java con Spring Boot. Nivel junior.',
    plataforma: 'linkedin',
    nivel_requerido: 'junior',
    url: 'https://linkedin.com/jobs/5678',
};

describe('Servicio de evaluación con IA', () => {

    // Limpio los mocks antes de cada test para que no se contaminen.
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('construirPromptEvaluacion()', () => {

        test('incluye el título de la oferta en el prompt', () => {
            const prompt = construirPromptEvaluacion(ofertaEjemplo);
            expect(prompt).toContain('Desarrollador Frontend Junior');
        });

        test('incluye la empresa en el prompt', () => {
            const prompt = construirPromptEvaluacion(ofertaEjemplo);
            expect(prompt).toContain('TechCorp');
        });

        test('incluye la descripción completa en el prompt', () => {
            const prompt = construirPromptEvaluacion(ofertaEjemplo);
            expect(prompt).toContain('experiencia en React y TypeScript');
        });

        test('incluye la modalidad y ubicación', () => {
            const prompt = construirPromptEvaluacion(ofertaEjemplo);
            expect(prompt).toContain('remoto');
            expect(prompt).toContain('Buenos Aires');
        });

        test('las instrucciones de sistema incluyen formato JSON de respuesta', () => {
            // Las instrucciones de JSON van en el mensaje de sistema,
            // no en el prompt del usuario. El prompt solo lleva los datos
            // de la oferta. Las instrucciones de formato las recibe DeepSeek
            // como "contexto de sistema" separado.
            expect(INSTRUCCIONES_SISTEMA).toContain('JSON');
            expect(INSTRUCCIONES_SISTEMA).toContain('match');
            expect(INSTRUCCIONES_SISTEMA).toContain('razon');
            expect(INSTRUCCIONES_SISTEMA).toContain('porcentaje');
        });
    });

    describe('PERFIL_CANDIDATO', () => {

        test('menciona nivel trainee/junior', () => {
            expect(PERFIL_CANDIDATO).toMatch(/trainee|junior/i);
        });

        test('incluye exclusión explícita de Java', () => {
            expect(PERFIL_CANDIDATO).toMatch(/java/i);
            expect(PERFIL_CANDIDATO).toMatch(/excluir|rechazar|no.*match/i);
        });

        test('incluye las tecnologías principales del stack', () => {
            expect(PERFIL_CANDIDATO).toMatch(/angular/i);
            expect(PERFIL_CANDIDATO).toMatch(/react/i);
            expect(PERFIL_CANDIDATO).toMatch(/node/i);
            expect(PERFIL_CANDIDATO).toMatch(/typescript/i);
            expect(PERFIL_CANDIDATO).toMatch(/postgresql/i);
        });
    });

    describe('evaluarOferta()', () => {

        test('retorna match:true cuando DeepSeek aprueba la oferta', async () => {
            // Simulo que DeepSeek responde con match: true.
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({
                    match: true,
                    porcentaje: 85,
                    razon: 'La oferta pide React y TypeScript, que están en el perfil del candidato.',
                })
            );

            const resultado = await evaluarOferta(ofertaEjemplo);

            expect(resultado.match).toBe(true);
            expect(resultado.razon).toContain('React');
            expect(resultado.porcentaje).toBe(85);
            expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
        });

        test('retorna match:false cuando DeepSeek rechaza la oferta', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({
                    match: false,
                    porcentaje: 15,
                    razon: 'La oferta requiere 5 años de experiencia, no es junior.',
                })
            );

            const resultado = await evaluarOferta(ofertaEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.razon).toContain('experiencia');
            expect(resultado.porcentaje).toBe(15);
        });

        test('pasa el perfil del candidato como mensaje de sistema', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, razon: 'Cumple requisitos.' })
            );

            await evaluarOferta(ofertaEjemplo);

            // Verifico que el primer argumento (mensaje sistema) contiene el perfil.
            const mensajeSistema = consultarDeepSeek.mock.calls[0][0];
            expect(mensajeSistema).toContain(PERFIL_CANDIDATO);
        });

        test('maneja respuesta con markdown fence (```json)', async () => {
            // Algunos modelos envuelven el JSON en bloques de código markdown.
            consultarDeepSeek.mockResolvedValueOnce(
                '```json\n{"match": true, "porcentaje": 70, "razon": "Cumple."}\n```'
            );

            const resultado = await evaluarOferta(ofertaEjemplo);

            expect(resultado.match).toBe(true);
            expect(resultado.razon).toBe('Cumple.');
            expect(resultado.porcentaje).toBe(70);
        });

        test('retorna error descriptivo si DeepSeek falla', async () => {
            consultarDeepSeek.mockRejectedValueOnce(
                new Error('DeepSeek respondió con error 500')
            );

            const resultado = await evaluarOferta(ofertaEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.razon).toContain('error');
            expect(resultado.error).toBe(true);
        });

        test('retorna error si la respuesta no es JSON válido', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                'Esto no es JSON, es texto libre de la IA.'
            );

            const resultado = await evaluarOferta(ofertaEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.razon).toContain('parsear');
            expect(resultado.error).toBe(true);
        });

        test('acota el porcentaje a 0–100 si DeepSeek devuelve fuera de rango', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, porcentaje: 150, razon: 'Excede rango.' })
            );

            const resultado = await evaluarOferta(ofertaEjemplo);
            expect(resultado.porcentaje).toBe(100);
        });

        test('retorna porcentaje null si DeepSeek no lo incluye en la respuesta', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, razon: 'Cumple requisitos.' })
            );

            const resultado = await evaluarOferta(ofertaEjemplo);
            expect(resultado.porcentaje).toBeNull();
        });
    });

    describe('evaluarOfertasPendientes()', () => {

        test('procesa todas las ofertas pendientes y actualiza la BD', async () => {
            // Simulo 2 ofertas pendientes en la BD.
            modeloOferta.obtenerOfertasPendientes.mockResolvedValueOnce([
                ofertaEjemplo,
                { ...ofertaEjemplo, id: 3, titulo: 'QA Tester Junior' },
            ]);

            // DeepSeek aprueba la primera, rechaza la segunda.
            consultarDeepSeek
                .mockResolvedValueOnce(JSON.stringify({
                    match: true,
                    porcentaje: 85,
                    razon: 'Cumple con React y TypeScript.',
                }))
                .mockResolvedValueOnce(JSON.stringify({
                    match: false,
                    porcentaje: 20,
                    razon: 'Requiere experiencia en Selenium que no tiene.',
                }));

            // Simulo que actualizarEvaluacion retorna la oferta actualizada.
            modeloOferta.actualizarEvaluacion
                .mockResolvedValueOnce({ ...ofertaEjemplo, estado_evaluacion: 'aprobada' })
                .mockResolvedValueOnce({ ...ofertaEjemplo, id: 3, estado_evaluacion: 'rechazada' });

            const resultado = await evaluarOfertasPendientes();

            // Verifico que se procesaron las 2 ofertas.
            expect(resultado.total).toBe(2);
            expect(resultado.aprobadas).toBe(1);
            expect(resultado.rechazadas).toBe(1);
            expect(resultado.errores).toBe(0);

            // Verifico que se llamó a actualizarEvaluacion 2 veces.
            expect(modeloOferta.actualizarEvaluacion).toHaveBeenCalledTimes(2);

            // Primera oferta: aprobada con porcentaje.
            expect(modeloOferta.actualizarEvaluacion).toHaveBeenCalledWith(
                1, 'aprobada', 'Cumple con React y TypeScript.', 85
            );

            // Segunda oferta: rechazada con porcentaje.
            expect(modeloOferta.actualizarEvaluacion).toHaveBeenCalledWith(
                3, 'rechazada', 'Requiere experiencia en Selenium que no tiene.', 20
            );
        });

        test('retorna resultado vacío si no hay ofertas pendientes', async () => {
            modeloOferta.obtenerOfertasPendientes.mockResolvedValueOnce([]);

            const resultado = await evaluarOfertasPendientes();

            expect(resultado.total).toBe(0);
            expect(resultado.aprobadas).toBe(0);
            expect(resultado.rechazadas).toBe(0);
            expect(consultarDeepSeek).not.toHaveBeenCalled();
        });

        test('cuenta errores sin detener el procesamiento del lote', async () => {
            modeloOferta.obtenerOfertasPendientes.mockResolvedValueOnce([
                ofertaEjemplo,
                { ...ofertaEjemplo, id: 4, titulo: 'Angular Dev' },
            ]);

            // La primera oferta falla, la segunda se aprueba.
            consultarDeepSeek
                .mockRejectedValueOnce(new Error('Timeout'))
                .mockResolvedValueOnce(JSON.stringify({
                    match: true,
                    razon: 'Angular está en el perfil.',
                }));

            modeloOferta.actualizarEvaluacion
                .mockResolvedValueOnce({ ...ofertaEjemplo, estado_evaluacion: 'rechazada' })
                .mockResolvedValueOnce({ ...ofertaEjemplo, id: 4, estado_evaluacion: 'aprobada' });

            const resultado = await evaluarOfertasPendientes();

            // La que falló cuenta como error (se marca rechazada con razón de error).
            expect(resultado.total).toBe(2);
            expect(resultado.errores).toBe(1);
            expect(resultado.aprobadas).toBe(1);
        });
    });
});

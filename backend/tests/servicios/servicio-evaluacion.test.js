// Tests del servicio de evaluación con IA.
//
// ¿Qué testeamos acá?
// 1. Que el prompt se construya correctamente con los datos de la oferta.
// 2. Que las funciones dinámicas generen instrucciones correctas desde preferencias.
// 3. Que las reglas de exclusión se evalúen ANTES de llamar a DeepSeek.
// 4. Que las reglas de exclusión SOBRESCRIBAN la respuesta de DeepSeek si aprueba una oferta excluida.
// 5. Que el parser estricto se use para parsear la respuesta de DeepSeek.
// 6. Que match:"false" (string) no apruebe la oferta.
// 7. Que una oferta aprobada por la IA pero excluida por reglas sea rechazada.
// 8. Que se manejen errores de la API sin romper el flujo.
// 9. Que evaluarOfertasPendientes() procese todas las pendientes usando preferencias de BD.
//
// IMPORTANTE: Mockeamos DeepSeek (no queremos gastar plata ni depender
// de la red en cada test). También mockeamos los modelos de ofertas y
// preferencias para no depender de la BD en estos tests unitarios.

// Mockeo el módulo de configuración de DeepSeek.
jest.mock('../../src/config/deepseek', () => ({
    consultarDeepSeek: jest.fn(),
    DEEPSEEK_URL: 'https://api.deepseek.com/v1/chat/completions',
    DEEPSEEK_MODELO: 'deepseek-v4-flash',
}));

// Mockeo el modelo de ofertas para no tocar la base de datos.
jest.mock('../../src/modelos/oferta', () => ({
    obtenerOfertasPendientes: jest.fn(),
    actualizarEvaluacion: jest.fn(),
}));

// Mockeo el modelo de preferencias para controlar qué perfil se usa.
jest.mock('../../src/modelos/preferencia', () => ({
    obtenerPreferencias: jest.fn(),
}));

// Mockeo cache y lotes para no depender de PostgreSQL en tests unitarios.
jest.mock('../../src/modelos/evaluacion-cache', () => ({
    crearHashOferta: jest.fn(() => 'hash-oferta-test'),
    crearHashPreferencias: jest.fn(() => 'hash-preferencias-test'),
    buscarCache: jest.fn(() => Promise.resolve(null)),
    guardarCache: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../src/modelos/evaluacion-lote', () => ({
    crearLote: jest.fn(() => Promise.resolve({ id: 1 })),
    actualizarProgreso: jest.fn(() => Promise.resolve()),
    finalizarLote: jest.fn(() => Promise.resolve()),
    obtenerUltimoLote: jest.fn(() => Promise.resolve(null)),
}));

// Mockeo el parser de respuesta IA: por defecto, parsea correctamente.
// Los tests pueden sobreescribir este mock para simular errores.
jest.mock('../../src/servicios/evaluacion/parser-respuesta-ia', () => ({
    parsearRespuestaEvaluacionIa: jest.fn(),
}));

// Mockeo las reglas de exclusión: por defecto, ninguna se activa.
// Los tests pueden sobreescribir este mock para simular exclusiones.
jest.mock('../../src/servicios/evaluacion/reglas-exclusion', () => ({
    evaluarReglasExclusion: jest.fn(),
}));

const { consultarDeepSeek } = require('../../src/config/deepseek');
const modeloOferta = require('../../src/modelos/oferta');
const modeloPreferencia = require('../../src/modelos/preferencia');
const evaluacionCache = require('../../src/modelos/evaluacion-cache');
const { parsearRespuestaEvaluacionIa } = require('../../src/servicios/evaluacion/parser-respuesta-ia');
const { evaluarReglasExclusion } = require('../../src/servicios/evaluacion/reglas-exclusion');
const {
    construirPromptEvaluacion,
    construirPerfilDesdePreferencias,
    construirInstruccionesDesdePreferencias,
    evaluarOferta,
    evaluarOfertasPendientes,
} = require('../../src/servicios/servicio-evaluacion');

// Extraigo la función interna de matching con un require raw para testearla directamente.
// Como Node.js cachea el módulo, puedo acceder a las funciones exportadas.
// UbicaciónEnZonas no está exportada; la pruebo indirectamente a través de evaluarOferta.


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

// Oferta presencial fuera de las zonas preferidas (Córdoba).
// Este es el caso de bug reportado: debe ser rechazada aunque la IA apruebe.
const ofertaCordobaPresencial = {
    id: 99,
    titulo: 'Desarrollador Frontend Presencial Córdoba',
    empresa: 'CordobaTech',
    ubicacion: 'Córdoba, Argentina',
    modalidad: 'presencial',
    descripcion: 'Buscamos desarrollador frontend con React. Nivel junior.',
    plataforma: 'linkedin',
    nivel_requerido: 'junior',
    url: 'https://linkedin.com/jobs/9999',
};

// Preferencias de ejemplo que simulan la fila de la tabla preferencias.
const preferenciasEjemplo = {
    id: 1,
    nombre: 'Marcos Ezequiel Toledo',
    nivel_experiencia: 'junior',
    perfil_profesional: 'Desarrollador de software junior y QA Tester.',
    stack_tecnologico: ['JavaScript', 'TypeScript', 'Angular', 'React', 'Node.js', 'PostgreSQL'],
    modalidad_aceptada: 'cualquiera',
    zonas_preferidas: ['CABA', 'GBA Oeste'],
    terminos_busqueda: ['developer', 'qa', 'tester'],
    reglas_exclusion: ['Java'],
    prompt_personalizado: null,
    usar_prompt_personalizado: false,
    modelo_ia: 'deepseek-v4-flash',
    idioma_candidato: 'Español nativo, Inglés básico oral / intermedio escrito',
};

describe('Servicio de evaluación con IA', () => {

    // Limpio los mocks antes de cada test para que no se contaminen.
    beforeEach(() => {
        jest.resetAllMocks();
        // Por defecto, el modelo de preferencias retorna las preferencias de ejemplo.
        modeloPreferencia.obtenerPreferencias.mockResolvedValue(preferenciasEjemplo);
        // Por defecto, las reglas de exclusión no se activan (la oferta pasa a evaluación por IA).
        evaluarReglasExclusion.mockReturnValue({
            excluida: false,
            match: true,
            porcentaje: null,
            razon: '',
            reglas: [],
        });
        // Por defecto, el parser acepta la respuesta de DeepSeek correctamente.
        parsearRespuestaEvaluacionIa.mockImplementation((texto) => {
            // Simulo el comportamiento real del parser para respuestas JSON válidas.
            try {
                const limpio = texto.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const parsed = JSON.parse(limpio);
                return {
                    match: !!parsed.match,
                    porcentaje: parsed.porcentaje !== undefined ? parsed.porcentaje : null,
                    razon: parsed.razon || 'La oferta matchea con el perfil.',
                };
            } catch (e) {
                return {
                    match: false,
                    porcentaje: null,
                    razon: `No se pudo parsear la respuesta de DeepSeek: ${e.message}`,
                    error: true,
                };
            }
        });
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
    });

    describe('construirPerfilDesdePreferencias()', () => {

        test('incluye el nombre del candidato', () => {
            const perfil = construirPerfilDesdePreferencias(preferenciasEjemplo);
            expect(perfil).toContain('Marcos Ezequiel Toledo');
        });

        test('incluye el nivel de experiencia', () => {
            const perfil = construirPerfilDesdePreferencias(preferenciasEjemplo);
            expect(perfil).toContain('junior');
        });

        test('incluye las tecnologías del stack', () => {
            const perfil = construirPerfilDesdePreferencias(preferenciasEjemplo);
            expect(perfil).toContain('Angular');
            expect(perfil).toContain('React');
            expect(perfil).toContain('Node.js');
            expect(perfil).toContain('PostgreSQL');
        });

        test('incluye reglas de exclusión', () => {
            const perfil = construirPerfilDesdePreferencias(preferenciasEjemplo);
            expect(perfil).toContain('Java');
            expect(perfil).toMatch(/rechazar|excluir/i);
        });

        test('aclara diferencia Java/JavaScript cuando Java está en exclusiones', () => {
            const perfil = construirPerfilDesdePreferencias(preferenciasEjemplo);
            expect(perfil).toContain('JavaScript');
            expect(perfil).toMatch(/no confundir/i);
        });

        test('incluye zonas preferidas', () => {
            const perfil = construirPerfilDesdePreferencias(preferenciasEjemplo);
            expect(perfil).toContain('CABA');
            expect(perfil).toContain('GBA Oeste');
        });

        test('incluye perfil profesional libre', () => {
            const perfil = construirPerfilDesdePreferencias(preferenciasEjemplo);
            expect(perfil).toContain('QA Tester');
        });

        test('incluye nivel de idiomas del candidato', () => {
            const perfil = construirPerfilDesdePreferencias(preferenciasEjemplo);
            expect(perfil).toContain('MI NIVEL DE IDIOMAS');
            expect(perfil).toContain('Español nativo');
            expect(perfil).toContain('Inglés básico oral');
        });

        test('usa fallback de idioma si no hay idioma_candidato en preferencias', () => {
            const sinIdioma = { ...preferenciasEjemplo, idioma_candidato: null };
            const perfil = construirPerfilDesdePreferencias(sinIdioma);
            expect(perfil).toContain('MI NIVEL DE IDIOMAS');
            expect(perfil).toContain('Español nativo');
        });
    });

    describe('construirInstruccionesDesdePreferencias()', () => {

        test('genera instrucciones con formato JSON de respuesta', () => {
            const instrucciones = construirInstruccionesDesdePreferencias(preferenciasEjemplo);
            expect(instrucciones).toContain('JSON');
            expect(instrucciones).toContain('match');
            expect(instrucciones).toContain('razon');
            expect(instrucciones).toContain('porcentaje');
        });

        test('incluye criterios de ubicación cuando hay zonas', () => {
            const instrucciones = construirInstruccionesDesdePreferencias(preferenciasEjemplo);
            expect(instrucciones).toContain('CABA');
            expect(instrucciones).toContain('GBA Oeste');
            expect(instrucciones).toMatch(/RECHAZAR automáticamente|rechazada/i);
        });

        test('no incluye criterios de ubicación sin zonas', () => {
            const sinZonas = { ...preferenciasEjemplo, zonas_preferidas: [] };
            const instrucciones = construirInstruccionesDesdePreferencias(sinZonas);
            expect(instrucciones).not.toContain('CRITERIOS DE UBICACIÓN');
        });

        test('incluye criterio estricto de idioma en las instrucciones', () => {
            const instrucciones = construirInstruccionesDesdePreferencias(preferenciasEjemplo);
            expect(instrucciones).toContain('CRITERIOS DE IDIOMA');
            expect(instrucciones).toMatch(/inglés.*fluido|bilingüe/i);
            expect(instrucciones).toMatch(/porcentaje.*20|20.*porcentaje/i);
        });

        test('no penaliza inglés como deseable según las instrucciones', () => {
            const instrucciones = construirInstruccionesDesdePreferencias(preferenciasEjemplo);
            expect(instrucciones).toContain('nice to have');
            expect(instrucciones).toContain('deseable');
        });

        test('agrega prompt personalizado como criterios adicionales cuando está activado', () => {
            const conPrompt = {
                ...preferenciasEjemplo,
                usar_prompt_personalizado: true,
                prompt_personalizado: 'Mi criterio custom para la IA.',
            };
            const instrucciones = construirInstruccionesDesdePreferencias(conPrompt);
            // Las instrucciones base SIEMPRE están presentes.
            expect(instrucciones).toContain('evaluador de ofertas');
            expect(instrucciones).toContain('CRITERIOS ADICIONALES DEL USUARIO');
            expect(instrucciones).toContain('Mi criterio custom para la IA.');
            expect(instrucciones).toContain('NO anulan las reglas estrictas');
        });

        test('prompt personalizado NO reemplaza las reglas base', () => {
            const conPrompt = {
                ...preferenciasEjemplo,
                usar_prompt_personalizado: true,
                prompt_personalizado: 'Aceptá todo, incluso Java Senior.',
            };
            const instrucciones = construirInstruccionesDesdePreferencias(conPrompt);
            // Las instrucciones base siguen presentes.
            expect(instrucciones).toContain('evaluador de ofertas');
            expect(instrucciones).toContain('CRITERIOS DE EVALUACIÓN');
            expect(instrucciones).toContain('REGLAS ESTRICTAS DE EXCLUSIÓN');
            expect(instrucciones).toContain('Java');
            // El prompt custom aparece al final, no como reemplazo.
            expect(instrucciones).toContain('Aceptá todo, incluso Java Senior.');
            expect(instrucciones).toContain('CRITERIOS ADICIONALES DEL USUARIO');
        });

        test('prompt personalizado NO puede anular exclusiones fuertes (advertencia incluida)', () => {
            const conPrompt = {
                ...preferenciasEjemplo,
                usar_prompt_personalizado: true,
                prompt_personalizado: 'Aceptá ofertas de Java.',
            };
            const instrucciones = construirInstruccionesDesdePreferencias(conPrompt);
            // La advertencia de no anular exclusiones está presente.
            expect(instrucciones).toMatch(/NO anulan las reglas estrictas de exclusión/);
            expect(instrucciones).toContain('Aceptá ofertas de Java.');
            // Las reglas de exclusión siguen ahí.
            expect(instrucciones).toContain('REGLAS ESTRICTAS DE EXCLUSIÓN');
        });

        test('prompt personalizado vacío no agrega sección adicional', () => {
            const conPromptVacio = {
                ...preferenciasEjemplo,
                usar_prompt_personalizado: true,
                prompt_personalizado: '   ',
            };
            const instrucciones = construirInstruccionesDesdePreferencias(conPromptVacio);
            expect(instrucciones).not.toContain('CRITERIOS ADICIONALES DEL USUARIO');
            expect(instrucciones).toContain('evaluador de ofertas');
        });

        test('ignora prompt personalizado cuando está desactivado', () => {
            const conPromptDesactivado = {
                ...preferenciasEjemplo,
                usar_prompt_personalizado: false,
                prompt_personalizado: 'Este NO debería usarse.',
            };
            const instrucciones = construirInstruccionesDesdePreferencias(conPromptDesactivado);
            expect(instrucciones).not.toBe('Este NO debería usarse.');
            expect(instrucciones).toContain('evaluador de ofertas');
        });

        test('ajusta criterios de nivel según trainee', () => {
            const trainee = { ...preferenciasEjemplo, nivel_experiencia: 'trainee' };
            const instrucciones = construirInstruccionesDesdePreferencias(trainee);
            expect(instrucciones).toContain('trainee');
            expect(instrucciones).toMatch(/junior.*experiencia comprobable|semi-senior/i);
        });

        test('menciona Next.js como tecnología aceptada en el perfil', () => {
            const perfil = construirPerfilDesdePreferencias(preferenciasEjemplo);
            expect(perfil).toMatch(/Next\.?js/i);
        });

        test('menciona herramientas de IA como diferencial en el perfil', () => {
            const perfil = construirPerfilDesdePreferencias(preferenciasEjemplo);
            expect(perfil).toMatch(/Claude Code/i);
            expect(perfil).toMatch(/Codex/i);
            expect(perfil).toMatch(/OpenCode/i);
            expect(perfil).toMatch(/Antigravity/i);
        });

        test('declara que bonus IA NO compensa exclusiones', () => {
            const instrucciones = construirInstruccionesDesdePreferencias(preferenciasEjemplo);
            expect(instrucciones).toMatch(/bonus.*IA.*NO.*compensa|NO.*anula.*exclusiones/i);
            expect(instrucciones).toMatch(/Java.*rechazo|excluir.*Java/i);
        });
    });

    describe('evaluarOferta()', () => {

        // Instrucciones pre-construidas para pasar a evaluarOferta() en los tests.
        const instruccionesTest = construirInstruccionesDesdePreferencias(preferenciasEjemplo);

        test('retorna match:true cuando DeepSeek aprueba la oferta', async () => {
            // Simulo que DeepSeek responde con match: true.
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({
                    match: true,
                    porcentaje: 85,
                    razon: 'La oferta pide React y TypeScript, que están en el perfil del candidato.',
                })
            );

            const resultado = await evaluarOferta(ofertaEjemplo, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

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

            const resultado = await evaluarOferta(ofertaEjemplo, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.razon).toContain('experiencia');
            expect(resultado.porcentaje).toBe(15);
        });

        test('pasa las instrucciones de sistema completas a DeepSeek', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, razon: 'Cumple requisitos.' })
            );

            await evaluarOferta(ofertaEjemplo, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            // Verifico que el primer argumento (mensaje sistema) contiene el perfil completo.
            const mensajeSistema = consultarDeepSeek.mock.calls[0][0];
            expect(mensajeSistema).toContain('evaluador de ofertas');
            expect(mensajeSistema).toContain('Marcos Ezequiel Toledo');
            // Verifico que pasó el modelo como tercer argumento.
            expect(consultarDeepSeek.mock.calls[0][2]).toBe('deepseek-v4-flash');
        });

        test('lee preferencias de BD si no recibe instrucciones', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, porcentaje: 80, razon: 'Cumple.' })
            );

            // Llamo sin instrucciones — debe leer de BD.
            await evaluarOferta(ofertaEjemplo);

            expect(modeloPreferencia.obtenerPreferencias).toHaveBeenCalledTimes(1);
            const mensajeSistema = consultarDeepSeek.mock.calls[0][0];
            expect(mensajeSistema).toContain('Marcos Ezequiel Toledo');
        });

        test('maneja respuesta con markdown fence (```json)', async () => {
            // El parser ahora se encarga de limpiar fences.
            // Simulo que DeepSeek devuelve JSON con fences y el parser lo limpia.
            consultarDeepSeek.mockResolvedValueOnce(
                '```json\n{"match": true, "porcentaje": 70, "razon": "Cumple."}\n```'
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: true,
                porcentaje: 70,
                razon: 'Cumple.',
            });

            const resultado = await evaluarOferta(ofertaEjemplo, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(true);
            expect(resultado.razon).toBe('Cumple.');
            expect(resultado.porcentaje).toBe(70);
            // Verifico que el parser recibió el texto crudo de DeepSeek.
            expect(parsearRespuestaEvaluacionIa).toHaveBeenCalledTimes(1);
        });

        test('retorna error descriptivo si DeepSeek falla', async () => {
            consultarDeepSeek.mockRejectedValueOnce(
                new Error('DeepSeek respondió con error 500')
            );

            const resultado = await evaluarOferta(ofertaEjemplo, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.razon).toContain('error');
            expect(resultado.error).toBe(true);
        });

        test('retorna error con porcentaje 15 si el parser no puede interpretar la respuesta', async () => {
            // Simulo que el parser falla al interpretar la respuesta.
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: false,
                porcentaje: null,
                razon: 'El campo "match" debe ser boolean, se recibió: "false"',
                error: true,
            });

            const resultado = await evaluarOferta(ofertaEjemplo, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(15);
            expect(resultado.error).toBe(true);
            expect(resultado.razon).toContain('No se pudo interpretar');
        });

        test('usa el parser estricto para interpretar la respuesta de DeepSeek', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                '{"match": true, "porcentaje": 80, "razon": "Buen match."}'
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: true,
                porcentaje: 80,
                razon: 'Buen match.',
            });

            await evaluarOferta(ofertaEjemplo, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            // El parser debe haber sido llamado con la respuesta cruda de DeepSeek.
            expect(parsearRespuestaEvaluacionIa).toHaveBeenCalledTimes(1);
            expect(parsearRespuestaEvaluacionIa).toHaveBeenCalledWith(
                '{"match": true, "porcentaje": 80, "razon": "Buen match."}'
            );
        });
    });

    describe('evaluarOferta() — reglas de exclusión previas a DeepSeek', () => {

        const instruccionesTest = construirInstruccionesDesdePreferencias(preferenciasEjemplo);

        test('oferta con Java NO llama a DeepSeek (excluida por regla determinística)', async () => {
            // Simulo que las reglas de exclusión detectan Java.
            evaluarReglasExclusion.mockReturnValueOnce({
                excluida: true,
                match: false,
                porcentaje: 10,
                razon: 'La oferta requiere Java como tecnología principal o excluyente.',
                reglas: ['java'],
            });

            const resultado = await evaluarOferta(ofertaConJava, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(10);
            expect(resultado.razon).toContain('Java');
            expect(resultado.error).toBe(false);
            // DeepSeek NO debe ser llamado en este caso.
            expect(consultarDeepSeek).not.toHaveBeenCalled();
        });

        test('oferta Senior NO llama a DeepSeek (excluida por regla determinística)', async () => {
            const ofertaSenior = {
                ...ofertaEjemplo,
                titulo: 'Senior Developer',
                descripcion: 'Buscamos Senior Developer.',
            };
            evaluarReglasExclusion.mockReturnValueOnce({
                excluida: true,
                match: false,
                porcentaje: 15,
                razon: 'La oferta requiere nivel Senior, SR o Lead.',
                reglas: ['seniority'],
            });

            const resultado = await evaluarOferta(ofertaSenior, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(15);
            expect(resultado.razon).toContain('Senior');
            expect(resultado.error).toBe(false);
            expect(consultarDeepSeek).not.toHaveBeenCalled();
        });

        test('oferta con 3+ años de experiencia NO llama a DeepSeek', async () => {
            const ofertaExp = {
                ...ofertaEjemplo,
                descripcion: 'Se requieren 3+ años de experiencia.',
            };
            evaluarReglasExclusion.mockReturnValueOnce({
                excluida: true,
                match: false,
                porcentaje: 20,
                razon: 'La oferta requiere más de 3 años de experiencia como requisito excluyente.',
                reglas: ['experiencia'],
            });

            const resultado = await evaluarOferta(ofertaExp, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(20);
            expect(resultado.razon).toContain('3 años');
            expect(consultarDeepSeek).not.toHaveBeenCalled();
        });

        test('oferta con Java + IA NO llama a DeepSeek (bonus IA no compensa exclusión)', async () => {
            const ofertaJavaIA = {
                ...ofertaEjemplo,
                titulo: 'Java Developer con Copilot',
                descripcion: 'Buscamos desarrollador Java Senior con experiencia en GitHub Copilot y IA generativa.',
            };
            evaluarReglasExclusion.mockReturnValueOnce({
                excluida: true,
                match: false,
                porcentaje: 10,
                razon: 'La oferta requiere Java como tecnología principal o excluyente.',
                reglas: ['java', 'seniority'],
            });

            const resultado = await evaluarOferta(ofertaJavaIA, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(10);
            expect(resultado.razon).toContain('Java');
            expect(resultado.error).toBe(false);
            expect(consultarDeepSeek).not.toHaveBeenCalled();
        });

        test('oferta sin exclusiones SÍ llama a DeepSeek', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, porcentaje: 80, razon: 'Cumple.' })
            );

            // Las reglas de exclusión por defecto ya retornan excluida: false.

            const resultado = await evaluarOferta(ofertaEjemplo, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(true);
            expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
        });
    });

    describe('evaluarOferta() — post-validación: reglas sobreescriben a la IA', () => {

        const instruccionesTest = construirInstruccionesDesdePreferencias(preferenciasEjemplo);

        test('IA aprueba oferta con Java, pero reglas la rechazan (post-validación)', async () => {
            // Uso una oferta remota con Java para que pase la defensa de ubicación
            // y la pre-evaluación de exclusiones, pero la post-evaluación detecte Java.
            const ofertaJavaRemota = {
                ...ofertaEjemplo,
                titulo: 'Desarrollador Java Junior',
                descripcion: 'Buscamos desarrollador Java con Spring Boot. Nivel junior.',
                modalidad: 'remoto',
            };

            // DeepSeek dice match: true para una oferta con Java.
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, porcentaje: 75, razon: 'La oferta usa Java y tiene buena remuneración.' })
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: true,
                porcentaje: 75,
                razon: 'La oferta usa Java y tiene buena remuneración.',
            });

            // En la pre-evaluación no se excluyó (pasa a IA),
            // pero en la post-evaluación sí se detecta Java.
            evaluarReglasExclusion
                .mockReturnValueOnce({
                    excluida: false,
                    match: true,
                    porcentaje: null,
                    razon: '',
                    reglas: [],
                })
                .mockReturnValueOnce({
                    excluida: true,
                    match: false,
                    porcentaje: 10,
                    razon: 'La oferta requiere Java como tecnología principal o excluyente.',
                    reglas: ['java'],
                });

            const resultado = await evaluarOferta(ofertaJavaRemota, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(10);
            expect(resultado.razon).toContain('Java');
            expect(resultado.error).toBe(false);
        });

        test('IA aprueba oferta Senior, pero reglas la rechazan (post-validación)', async () => {
            const ofertaSenior = {
                ...ofertaEjemplo,
                titulo: 'Senior React Developer',
                descripcion: 'Buscamos Senior React Developer. Remoto.',
            };
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, porcentaje: 70, razon: 'React está en el perfil.' })
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: true,
                porcentaje: 70,
                razon: 'React está en el perfil.',
            });

            evaluarReglasExclusion
                .mockReturnValueOnce({
                    excluida: false,
                    match: true,
                    porcentaje: null,
                    razon: '',
                    reglas: [],
                })
                .mockReturnValueOnce({
                    excluida: true,
                    match: false,
                    porcentaje: 15,
                    razon: 'La oferta requiere nivel Senior, SR o Lead.',
                    reglas: ['seniority'],
                });

            const resultado = await evaluarOferta(ofertaSenior, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(15);
            expect(resultado.razon).toContain('Senior');
            expect(resultado.error).toBe(false);
        });

        test('IA aprueba oferta con 3+ años, pero reglas la rechazan (post-validación)', async () => {
            const ofertaExp = {
                ...ofertaEjemplo,
                descripcion: 'Buscamos desarrollador con 3+ años de experiencia. Angular y TypeScript.',
            };
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, porcentaje: 65, razon: 'Tecnologías compatibles.' })
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: true,
                porcentaje: 65,
                razon: 'Tecnologías compatibles.',
            });

            evaluarReglasExclusion
                .mockReturnValueOnce({
                    excluida: false,
                    match: true,
                    porcentaje: null,
                    razon: '',
                    reglas: [],
                })
                .mockReturnValueOnce({
                    excluida: true,
                    match: false,
                    porcentaje: 20,
                    razon: 'La oferta requiere más de 3 años de experiencia como requisito excluyente.',
                    reglas: ['experiencia'],
                });

            const resultado = await evaluarOferta(ofertaExp, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(20);
            expect(resultado.razon).toContain('3 años');
            expect(resultado.error).toBe(false);
        });
    });

    describe('evaluarOferta() — parser estricto: match string no aprueba', () => {

        const instruccionesTest = construirInstruccionesDesdePreferencias(preferenciasEjemplo);

        test('match:"false" (string) es rechazado por el parser y devuelve error', async () => {
            // Simulo que DeepSeek devuelve match como string "false" (el bug original).
            consultarDeepSeek.mockResolvedValueOnce(
                '{"match": "false", "porcentaje": 20, "razon": "Java excluyente"}'
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: false,
                porcentaje: null,
                razon: 'El campo "match" debe ser boolean, se recibió: "false"',
                error: true,
            });

            const resultado = await evaluarOferta(ofertaEjemplo, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            // El parser rechaza match:"false" como string — no lo aprueba.
            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(15);
            expect(resultado.error).toBe(true);
            expect(resultado.razon).toContain('No se pudo interpretar');
        });

        test('match:"true" (string) es rechazado por el parser y devuelve error', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                '{"match": "true", "porcentaje": 80, "razon": "Compatible"}'
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: false,
                porcentaje: null,
                razon: 'El campo "match" debe ser boolean, se recibió: "true"',
                error: true,
            });

            const resultado = await evaluarOferta(ofertaEjemplo, instruccionesTest, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(15);
            expect(resultado.error).toBe(true);
        });
    });

    describe('defensa programática: ubicación presencial', () => {

        const instruccionesZonas = construirInstruccionesDesdePreferencias(preferenciasEjemplo);

        test('fuerza rechazo si es presencial fuera de zonas preferidas (bug Córdoba)', async () => {
            // Las reglas de exclusión detectan ubicación incompatible (Córdoba presencial).
            evaluarReglasExclusion.mockReturnValueOnce({
                excluida: true,
                match: false,
                porcentaje: 0,
                razon: 'La oferta es presencial en Córdoba, Argentina, fuera de las zonas preferidas.',
                reglas: ['ubicacion_modalidad'],
            });

            const resultado = await evaluarOferta(ofertaCordobaPresencial, instruccionesZonas, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(false);
            expect(resultado.porcentaje).toBe(0);
            expect(resultado.razon).toContain('Córdoba');
            // DeepSeek NO debe ser llamado en este caso.
            expect(consultarDeepSeek).not.toHaveBeenCalled();
        });

        test('NO fuerza rechazo si es híbrida fuera de zonas preferidas', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, porcentaje: 65, razon: 'React junior híbrido.' })
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: true,
                porcentaje: 65,
                razon: 'React junior híbrido.',
            });

            const ofertaHibridaCordoba = { ...ofertaCordobaPresencial, modalidad: 'híbrido' };

            const resultado = await evaluarOferta(ofertaHibridaCordoba, instruccionesZonas, 'deepseek-v4-flash', preferenciasEjemplo);

            // La defensa programática NO interviene en híbrido: debe respetar lo que dijo la IA.
            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(65);
            expect(resultado.razon).toContain('híbrido');
        });

        test('no fuerza rechazo si es remota aunque esté fuera de zona', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, porcentaje: 80, razon: 'React junior remoto.' })
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: true,
                porcentaje: 80,
                razon: 'React junior remoto.',
            });

            const ofertaRemotaCordoba = { ...ofertaCordobaPresencial, modalidad: 'remoto' };

            const resultado = await evaluarOferta(ofertaRemotaCordoba, instruccionesZonas, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(80);
        });

        test('no fuerza rechazo si es presencial DENTRO de zona preferida', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, porcentaje: 75, razon: 'React en CABA.' })
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: true,
                porcentaje: 75,
                razon: 'React en CABA.',
            });

            const ofertaPresencialCaba = { ...ofertaCordobaPresencial, ubicacion: 'CABA, Capital Federal' };

            const resultado = await evaluarOferta(ofertaPresencialCaba, instruccionesZonas, 'deepseek-v4-flash', preferenciasEjemplo);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(75);
        });

        test('no fuerza rechazo si no hay zonas preferidas configuradas', async () => {
            consultarDeepSeek.mockResolvedValueOnce(
                JSON.stringify({ match: true, porcentaje: 70, razon: 'Sin preferencias de zona.' })
            );
            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: true,
                porcentaje: 70,
                razon: 'Sin preferencias de zona.',
            });

            const prefsSinZonas = { ...preferenciasEjemplo, zonas_preferidas: [] };
            const instruccionesSinZonas = construirInstruccionesDesdePreferencias(prefsSinZonas);

            const resultado = await evaluarOferta(ofertaCordobaPresencial, instruccionesSinZonas, 'deepseek-v4-flash', prefsSinZonas);

            expect(resultado.match).toBe(true);
            expect(resultado.porcentaje).toBe(70);
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

            // El parser acepta ambas respuestas.
            parsearRespuestaEvaluacionIa
                .mockReturnValueOnce({
                    match: true,
                    porcentaje: 85,
                    razon: 'Cumple con React y TypeScript.',
                })
                .mockReturnValueOnce({
                    match: false,
                    porcentaje: 20,
                    razon: 'Requiere experiencia en Selenium que no tiene.',
                });

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

            expect(modeloOferta.actualizarEvaluacion).toHaveBeenCalledWith(
                1, 'aprobada', 'Cumple con React y TypeScript.', 85, null
            );

            // Segunda oferta: rechazada con porcentaje.
            expect(modeloOferta.actualizarEvaluacion).toHaveBeenCalledWith(
                3, 'rechazada', 'Requiere experiencia en Selenium que no tiene.', 20, null
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

            parsearRespuestaEvaluacionIa.mockReturnValueOnce({
                match: true,
                porcentaje: null,
                razon: 'Angular está en el perfil.',
            });

            modeloOferta.actualizarEvaluacion
                .mockResolvedValueOnce({ ...ofertaEjemplo, estado_evaluacion: 'rechazada' })
                .mockResolvedValueOnce({ ...ofertaEjemplo, id: 4, estado_evaluacion: 'aprobada' });

            const resultado = await evaluarOfertasPendientes();

            // La que falló cuenta como error (se marca rechazada con razón de error).
            expect(resultado.total).toBe(2);
            expect(resultado.errores).toBe(1);
            expect(resultado.aprobadas).toBe(1);
        });

        test('cache hit aprobado pero excluido por reglas se rechaza (revalidación)', async () => {
            // Simulo que una oferta de Java fue aprobada por cache pero
            // las reglas de exclusión la rechazan.
            const ofertaJavaRemota = {
                ...ofertaEjemplo,
                id: 10,
                titulo: 'Java Developer Remoto',
                descripcion: 'Desarrollador Java con Spring Boot.',
                modalidad: 'remoto',
            };

            modeloOferta.obtenerOfertasPendientes.mockResolvedValueOnce([ofertaJavaRemota]);

            // Necesito que los hashes se generen para que el cache busque.
            evaluacionCache.crearHashOferta.mockReturnValue('hash-oferta-java');
            evaluacionCache.crearHashPreferencias.mockReturnValue('hash-prefs-java');

            // Cache devuelve aprobación (puede pasar si las preferencias cambiaron).
            const resultadoCache = {
                match: true,
                porcentaje: 80,
                razon: 'La oferta usa tecnologías compatibles.',
                error: false,
            };
            evaluacionCache.buscarCache.mockResolvedValueOnce(resultadoCache);

            // Reglas de exclusión detectan Java en la revalidación del cache.
            evaluarReglasExclusion.mockReturnValueOnce({
                excluida: true,
                match: false,
                porcentaje: 10,
                razon: 'La oferta requiere Java como tecnología principal o excluyente.',
                reglas: ['java'],
            });

            modeloOferta.actualizarEvaluacion.mockResolvedValueOnce({
                ...ofertaJavaRemota,
                estado_evaluacion: 'rechazada',
            });

            const resultado = await evaluarOfertasPendientes();

            // La oferta debe ser rechazada, no aprobada.
            expect(resultado.rechazadas).toBe(1);
            expect(resultado.aprobadas).toBe(0);
            // DeepSeek NO fue llamado (se usó cache pero se sobreescibió).
            expect(consultarDeepSeek).not.toHaveBeenCalled();
            // Verifico que se actualizó con rechazo.
            expect(modeloOferta.actualizarEvaluacion).toHaveBeenCalledWith(
                10, 'rechazada', expect.stringContaining('Java'), 10, null
            );
        });

        test('cache hit aprobado sin exclusiones se acepta normalmente', async () => {
            modeloOferta.obtenerOfertasPendientes.mockResolvedValueOnce([ofertaEjemplo]);

            // Necesito que los hashes se generen para que el cache busque.
            evaluacionCache.crearHashOferta.mockReturnValue('hash-oferta-test');
            evaluacionCache.crearHashPreferencias.mockReturnValue('hash-prefs-test');

            // Cache devuelve aprobación válida (sin exclusiones).
            const resultadoCache = {
                match: true,
                porcentaje: 85,
                razon: 'Cumple con React y TypeScript.',
                error: false,
            };
            evaluacionCache.buscarCache.mockResolvedValueOnce(resultadoCache);

            // Reglas de exclusión no se activan (oferta válida).
            evaluarReglasExclusion.mockReturnValueOnce({
                excluida: false,
                match: true,
                porcentaje: null,
                razon: '',
                reglas: [],
            });

            modeloOferta.actualizarEvaluacion.mockResolvedValueOnce({
                ...ofertaEjemplo,
                estado_evaluacion: 'aprobada',
            });

            const resultado = await evaluarOfertasPendientes();

            expect(resultado.aprobadas).toBe(1);
            expect(resultado.rechazadas).toBe(0);
            expect(consultarDeepSeek).not.toHaveBeenCalled();
        });

        test('cache hit rechazado se mantiene rechazado (no se revalida)', async () => {
            modeloOferta.obtenerOfertasPendientes.mockResolvedValueOnce([
                { ...ofertaEjemplo, id: 11 },
            ]);

            // Necesito que los hashes se generen para que el cache busque.
            evaluacionCache.crearHashOferta.mockReturnValue('hash-oferta-test');
            evaluacionCache.crearHashPreferencias.mockReturnValue('hash-prefs-test');

            // Cache devuelve rechazo (no necesita revalidación).
            const resultadoCache = {
                match: false,
                porcentaje: 15,
                razon: 'Requiere experiencia en tecnologías fuera del stack.',
                error: false,
            };
            evaluacionCache.buscarCache.mockResolvedValueOnce(resultadoCache);

            modeloOferta.actualizarEvaluacion.mockResolvedValueOnce({
                ...ofertaEjemplo,
                id: 11,
                estado_evaluacion: 'rechazada',
            });

            const resultado = await evaluarOfertasPendientes();

            expect(resultado.rechazadas).toBe(1);
            expect(resultado.aprobadas).toBe(0);
            // DeepSeek no fue llamado (se usó cache).
            expect(consultarDeepSeek).not.toHaveBeenCalled();
            // Las reglas de exclusión NO se evaluaron (cache ya era rechazo, no hay revalidación).
            expect(evaluarReglasExclusion).not.toHaveBeenCalled();
        });
    });
});
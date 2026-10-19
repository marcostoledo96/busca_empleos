// Pruebas integradas de matching para Issue #15: normalización -> ingreso -> evaluación.
'use strict';

const {
    normalizarOfertaJooble,
    normalizarOfertaAdzuna,
    normalizarOfertaComputrabajo,
    normalizarOfertaLinkedin,
} = require('../../src/servicios/servicio-normalizacion');

const { filtrarOfertasPorIdioma } = require('../../src/servicios/servicio-ingreso-ofertas');
const { evaluarReglasExclusion } = require('../../src/servicios/evaluacion/reglas-exclusion');
const { evaluarOferta } = require('../../src/servicios/servicio-evaluacion');

// Mock de DeepSeek para pruebas integradas sintéticas sin costo ni llamadas reales
jest.mock('../../src/config/deepseek', () => ({
    ...jest.requireActual('../../src/config/deepseek'),
    consultarDeepSeek: jest.fn(),
}));

jest.mock('../../src/modelos/oferta', () => ({
    guardarResultadoEvaluacion: jest.fn().mockImplementation((id, res) => Promise.resolve({ id, ...res })),
}));

jest.mock('../../src/modelos/evaluacion-cache', () => ({
    buscarCache: jest.fn().mockResolvedValue(null),
    guardarCache: jest.fn().mockResolvedValue(),
}));

const { consultarDeepSeek } = require('../../src/config/deepseek');

describe('Issue #15: Integración Normalización → Ingreso → Evaluación', () => {
    const preferencias = {
        nivel_experiencia: 'junior',
        nivel_real_seniority: 'junior',
        anios_experiencia_reales: 1,
        zonas_preferidas: ['CABA', 'GBA Oeste'],
        reglas_exclusion: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        consultarDeepSeek.mockResolvedValue(JSON.stringify({
            match: true,
            porcentaje: 85,
            razon: 'Excelente coincidencia técnica.',
        }));
    });

    test('24. Los normalizadores de distintas fuentes entregan un contrato compatible', () => {
        const itemJooble = {
            link: 'https://jooble.org/desc/100',
            title: 'Frontend Junior',
            salary: 'AR$1.500.000 - AR$2.000.000 por mes',
            type: 'Full-time',
            location: 'Capital Federal, Buenos Aires',
            snippet: 'React y Node.js',
        };
        const itemComp = {
            url: 'https://computrabajo.com.ar/101',
            title: 'Frontend Junior',
            location: 'Morón, Buenos Aires',
            modalidadDetalle: 'Híbrido',
            descriptionText: 'Desarrollador React',
        };

        const joobleNorm = normalizarOfertaJooble(itemJooble);
        const compNorm = normalizarOfertaComputrabajo(itemComp);

        const camposRequeridos = ['titulo', 'empresa', 'ubicacion', 'modalidad', 'descripcion', 'url', 'plataforma', 'salario_min', 'salario_max', 'moneda', 'datos_crudos'];

        for (const campo of camposRequeridos) {
            expect(joobleNorm).toHaveProperty(campo);
            expect(compNorm).toHaveProperty(campo);
        }

        expect(joobleNorm.modalidad).toBeNull(); // Full-time es jornada, no presencial
        expect(compNorm.modalidad).toBe('hibrido');
        expect(joobleNorm.salario_min).toBe(1500000);
        expect(joobleNorm.salario_max).toBe(2000000);
        expect(joobleNorm.moneda).toBe('ARS');
    });

    test('25. Una oferta sintética en español con Requirements y Nice to have pasa el filtro de ingreso y la evaluación', async () => {
        const ofertaCruda = {
            link: 'https://jooble.org/desc/102',
            title: 'Desarrollador React Junior',
            snippet: 'Buscamos desarrollador para nuestro equipo. Requirements: experiencia con React. Nice to have: TypeScript. Ofrecemos excelente clima laboral.',
            location: 'Capital Federal, Buenos Aires',
            type: 'Full-time',
        };

        const normalizada = normalizarOfertaJooble(ofertaCruda);

        // Paso 1: Filtro de ingreso por idioma
        const ingresadas = filtrarOfertasPorIdioma([normalizada]);
        expect(ingresadas).toHaveLength(1);
        expect(ingresadas[0].titulo).toBe('Desarrollador React Junior');

        // Paso 2: Reglas de exclusión determinísticas
        const exclusion = evaluarReglasExclusion(normalizada, preferencias);
        expect(exclusion.excluida).toBe(false);

        // Paso 3: Servicio de evaluación (defensa programática + IA)
        const resultado = await evaluarOferta(normalizada, 'Instrucciones perfil', 'deepseek-v4-flash', preferencias);
        expect(resultado.match).toBe(true);
        expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    });

    test('26. Las correcciones no generan falsos rechazos en ofertas presenciales de CABA o GBA Oeste', async () => {
        const ofertaCapital = {
            id: 201,
            titulo: 'QA Tester Junior',
            descripcion: 'Pruebas funcionales en aplicaciones web.',
            modalidad: 'presencial',
            ubicacion: 'Capital Federal, Buenos Aires',
        };

        const ofertaMoron = {
            id: 202,
            titulo: 'Soporte IT Junior',
            descripcion: 'Mesa de ayuda y mantenimiento de redes.',
            modalidad: 'presencial',
            ubicacion: 'Morón, Buenos Aires',
        };

        // Ambas deben ser aceptadas por la defensa geográfica y llegar a la IA
        const resCap = await evaluarOferta(ofertaCapital, 'Instrucciones', 'deepseek-v4-flash', preferencias);
        expect(resCap.match).toBe(true);

        const resMoron = await evaluarOferta(ofertaMoron, 'Instrucciones', 'deepseek-v4-flash', preferencias);
        expect(resMoron.match).toBe(true);
    });

    test('26b. Una oferta presencial con ubicación ausente no se rechaza automáticamente (conserva incertidumbre)', async () => {
        const ofertaSinUbicacion = {
            id: 203,
            titulo: 'Desarrollador Junior Presencial',
            descripcion: 'Puesto presencial para desarrollo web frontend.',
            modalidad: 'presencial',
            ubicacion: '',
        };

        // No debe ser rechazada de antemano por las defensas de ubicación
        const exclusion = evaluarReglasExclusion(ofertaSinUbicacion, preferencias);
        expect(exclusion.excluida).toBe(false);

        const res = await evaluarOferta(ofertaSinUbicacion, 'Instrucciones', 'deepseek-v4-flash', preferencias);
        expect(res.match).toBe(true);
        expect(consultarDeepSeek).toHaveBeenCalledTimes(1);
    });
});

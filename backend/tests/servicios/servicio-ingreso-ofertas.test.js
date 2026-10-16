const { filtrarOfertasPorIdioma, guardarLoteOfertasAislado } = require('../../src/servicios/servicio-ingreso-ofertas');
const { detectarIdioma } = require('../../src/servicios/servicio-normalizacion');

test('comparto detectarIdioma sin agregar exclusiones de matching al ingreso', () => {
    const ofertas = [
        { titulo: 'Soporte técnico', descripcion: 'Buscamos una persona para nuestro equipo. Las tareas incluyen la asistencia de los usuarios y la resolución de problemas.' },
        { titulo: 'Software engineer', descripcion: 'We are looking for a software engineer to join our team. You will work with our customers and you should have experience with the tools.' },
        { titulo: 'Desarrollador Java senior', descripcion: 'Buscamos un desarrollador para nuestro equipo de sistemas con experiencia en Java.' },
        { titulo: null, descripcion: null },
    ];
    const originales = JSON.stringify(ofertas);
    expect(filtrarOfertasPorIdioma(ofertas)).toEqual(ofertas.filter(oferta => detectarIdioma(oferta.titulo, oferta.descripcion) !== 'en'));
    expect(filtrarOfertasPorIdioma(ofertas)).toContain(ofertas[2]);
    expect(filtrarOfertasPorIdioma(ofertas)).not.toContain(ofertas[1]);
    expect(JSON.stringify(ofertas)).toBe(originales);
    expect(filtrarOfertasPorIdioma([])).toEqual([]);
});

describe('guardarLoteOfertasAislado', () => {
    test('discrimina ofertas nuevas con es_nueva, esNueva o resultado_persistencia "insertada"', async () => {
        const ofertas = [
            { titulo: 'Oferta 1', url: 'https://ejemplo.com/1' },
            { titulo: 'Oferta 2', url: 'https://ejemplo.com/2' },
            { titulo: 'Oferta 3', url: 'https://ejemplo.com/3' },
        ];
        const modeloMock = {
            crearOferta: jest.fn()
                .mockResolvedValueOnce({ id: 1, es_nueva: true })
                .mockResolvedValueOnce({ id: 2, esNueva: true })
                .mockResolvedValueOnce({ id: 3, resultado_persistencia: 'insertada' }),
        };

        const res = await guardarLoteOfertasAislado(ofertas, modeloMock);

        expect(res).toEqual({
            guardadas: 3,
            actualizadas: 0,
            reapariciones: 0,
            duplicadas: 0,
            errores: 0,
            detallesErrores: [],
        });
    });

    test('discrimina ofertas actualizadas e incrementa actualizadas y duplicadas', async () => {
        const ofertas = [
            { titulo: 'Oferta 1', url: 'https://ejemplo.com/1' },
            { titulo: 'Oferta 2', url: 'https://ejemplo.com/2' },
            { titulo: 'Oferta 3', url: 'https://ejemplo.com/3' },
        ];
        const modeloMock = {
            crearOferta: jest.fn()
                .mockResolvedValueOnce({ id: 1, fue_actualizada: true })
                .mockResolvedValueOnce({ id: 2, esActualizada: true })
                .mockResolvedValueOnce({ id: 3, resultado_persistencia: 'actualizada' }),
        };

        const res = await guardarLoteOfertasAislado(ofertas, modeloMock);

        expect(res).toEqual({
            guardadas: 0,
            actualizadas: 3,
            reapariciones: 0,
            duplicadas: 3,
            errores: 0,
            detallesErrores: [],
        });
    });

    test('discrimina ofertas reaparición e incrementa reapariciones y duplicadas', async () => {
        const ofertas = [
            { titulo: 'Oferta 1', url: 'https://ejemplo.com/1' },
            { titulo: 'Oferta 2', url: 'https://ejemplo.com/2' },
            { titulo: 'Oferta 3', url: 'https://ejemplo.com/3' },
        ];
        const modeloMock = {
            crearOferta: jest.fn()
                .mockResolvedValueOnce({ id: 1, es_reaparicion: true })
                .mockResolvedValueOnce({ id: 2, esReaparicion: true })
                .mockResolvedValueOnce({ id: 3, resultado_persistencia: 'reaparicion' }),
        };

        const res = await guardarLoteOfertasAislado(ofertas, modeloMock);

        expect(res).toEqual({
            guardadas: 0,
            actualizadas: 0,
            reapariciones: 3,
            duplicadas: 3,
            errores: 0,
            detallesErrores: [],
        });
    });

    test('aplica fallback de compatibilidad para mocks legacy (null o sin es_nueva)', async () => {
        const ofertas = [
            { titulo: 'Oferta legacy guardada', url: 'https://ejemplo.com/1' },
            { titulo: 'Oferta legacy duplicada', url: 'https://ejemplo.com/2' },
            { titulo: 'Oferta con es_nueva false sin otro flag', url: 'https://ejemplo.com/3' },
        ];
        const modeloMock = {
            crearOferta: jest.fn()
                .mockResolvedValueOnce({ id: 1 })
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ id: 3, es_nueva: false }),
        };

        const res = await guardarLoteOfertasAislado(ofertas, modeloMock);

        expect(res).toEqual({
            guardadas: 1,
            actualizadas: 0,
            reapariciones: 0,
            duplicadas: 2,
            errores: 0,
            detallesErrores: [],
        });
    });

    test('aísla errores individuales sin abortar el resto del lote', async () => {
        const ofertas = [
            { titulo: 'Oferta ok', url: 'https://ejemplo.com/1' },
            { titulo: 'Oferta fallida', url: 'https://ejemplo.com/2' },
            { titulo: 'Segunda oferta ok', url: 'https://ejemplo.com/3' },
        ];
        const modeloMock = {
            crearOferta: jest.fn()
                .mockResolvedValueOnce({ id: 1, es_nueva: true })
                .mockRejectedValueOnce(new Error('Fallo de conexión a la BD'))
                .mockResolvedValueOnce({ id: 3, fue_actualizada: true }),
        };

        const res = await guardarLoteOfertasAislado(ofertas, modeloMock);

        expect(res.guardadas).toBe(1);
        expect(res.actualizadas).toBe(1);
        expect(res.duplicadas).toBe(1);
        expect(res.errores).toBe(1);
        expect(res.detallesErrores).toEqual([
            {
                titulo: 'Oferta fallida',
                url: 'https://ejemplo.com/2',
                error: 'Fallo de conexión a la BD',
            },
        ]);
    });

    test('procesa correctamente un lote heterogéneo con todos los tipos de persistencia', async () => {
        const ofertas = [
            { titulo: 'Oferta Nueva', url: 'https://ejemplo.com/1' },
            { titulo: 'Oferta Actualizada', url: 'https://ejemplo.com/2' },
            { titulo: 'Oferta Reaparición', url: 'https://ejemplo.com/3' },
            { titulo: 'Oferta Duplicada Null', url: 'https://ejemplo.com/4' },
            { titulo: 'Oferta Legacy Guardada', url: 'https://ejemplo.com/5' },
            { titulo: 'Oferta Con Error', url: 'https://ejemplo.com/6' },
        ];
        const modeloMock = {
            crearOferta: jest.fn()
                .mockResolvedValueOnce({ id: 1, es_nueva: true, resultado_persistencia: 'insertada' })
                .mockResolvedValueOnce({ id: 2, fue_actualizada: true, resultado_persistencia: 'actualizada' })
                .mockResolvedValueOnce({ id: 3, es_reaparicion: true, resultado_persistencia: 'reaparicion' })
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ id: 5 })
                .mockRejectedValueOnce(new Error('Violación de constraint')),
        };

        const res = await guardarLoteOfertasAislado(ofertas, modeloMock);

        expect(res).toEqual({
            guardadas: 2,
            actualizadas: 1,
            reapariciones: 1,
            duplicadas: 3,
            errores: 1,
            detallesErrores: [
                {
                    titulo: 'Oferta Con Error',
                    url: 'https://ejemplo.com/6',
                    error: 'Violación de constraint',
                },
            ],
        });
    });
});

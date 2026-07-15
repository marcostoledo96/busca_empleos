const { calcularPuntajeOrden, ordenarOfertasPorPrioridadIa } = require('../../src/servicios/servicio-ranking-ofertas');

describe('servicio de ranking de ofertas', () => {
    const oferta = {
        id: 1,
        porcentaje_match: 80,
        puntaje_prioridad_ia: 6,
        fecha_extraccion: '2026-07-15T12:00:00.000Z',
    };

    test('solo suma el bonus cuando la preferencia está habilitada', () => {
        expect(calcularPuntajeOrden(oferta, { priorizar_ofertas_ia: false })).toBe(80);
        expect(calcularPuntajeOrden(oferta, {
            priorizar_ofertas_ia: true,
            bonus_maximo_prioridad_ia: 3,
        })).toBe(83);
    });

    test('no cambia match, porcentaje ni la razón al ordenar', () => {
        const rechazada = {
            ...oferta,
            id: 2,
            estado_evaluacion: 'rechazada',
            razon_evaluacion: 'Java excluyente',
        };
        const ordenadas = ordenarOfertasPorPrioridadIa([oferta, rechazada], {
            priorizar_ofertas_ia: true,
            bonus_maximo_prioridad_ia: 6,
        });

        expect(rechazada.estado_evaluacion).toBe('rechazada');
        expect(rechazada.razon_evaluacion).toBe('Java excluyente');
        expect(rechazada.porcentaje_match).toBe(80);
        expect(ordenadas).toHaveLength(2);
    });
});

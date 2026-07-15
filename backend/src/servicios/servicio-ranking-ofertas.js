'use strict';

function calcularPuntajeOrden(oferta, preferencias = {}) {
    const porcentaje = Number(oferta.porcentaje_match) || 0;
    if (!preferencias.priorizar_ofertas_ia) return porcentaje;
    const limite = Math.min(6, Math.max(0, Number(preferencias.bonus_maximo_prioridad_ia) || 0));
    return porcentaje + Math.min(limite, Number(oferta.puntaje_prioridad_ia) || 0);
}

function ordenarOfertasPorPrioridadIa(ofertas, preferencias) {
    return [...ofertas].sort((a, b) => {
        const diferencia = calcularPuntajeOrden(b, preferencias) - calcularPuntajeOrden(a, preferencias);
        if (diferencia) return diferencia;
        const porMatch = (Number(b.porcentaje_match) || 0) - (Number(a.porcentaje_match) || 0);
        if (porMatch) return porMatch;
        const porFecha = new Date(b.fecha_extraccion || 0).getTime() - new Date(a.fecha_extraccion || 0).getTime();
        return porFecha || Number(b.id) - Number(a.id);
    });
}

module.exports = { calcularPuntajeOrden, ordenarOfertasPorPrioridadIa };

import type { Oferta } from '../modelos/oferta.model';

const VENTANA_REEVALUACION_MS = 30 * 86_400_000;

export function esRecienteParaReevaluar(oferta: Pick<Oferta, 'fecha_ultima_extraccion' | 'fecha_extraccion'>): boolean {
    const fecha = new Date(oferta.fecha_ultima_extraccion ?? oferta.fecha_extraccion).getTime();
    return Number.isFinite(fecha) && fecha >= Date.now() - VENTANA_REEVALUACION_MS;
}

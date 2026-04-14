import { Injectable } from '@angular/core';
import { Estadisticas, Oferta } from '../modelos/oferta.model';

export interface CacheDashboard {
    ofertas: Oferta[];
    estadisticas: Estadisticas | null;
    fechaGuardado: string;
}

@Injectable({ providedIn: 'root' })
export class PersistenciaDashboardService {

    private readonly claveStorage = 'busca-empleos.dashboard.cache';

    guardarCache(cache: CacheDashboard): void {
        if (!this.storageDisponible()) {
            return;
        }

        // Excluyo datos_crudos de cada oferta para reducir el tamaño del cache.
        // datos_crudos es el JSON original de Apify y puede pesar varios KB por oferta.
        // Con cientos de ofertas, supera el límite de ~5 MB de localStorage.
        const cacheLiviano: CacheDashboard = {
            ...cache,
            ofertas: cache.ofertas.map(({ datos_crudos, ...resto }) => resto as Oferta),
        };

        try {
            localStorage.setItem(this.claveStorage, JSON.stringify(cacheLiviano));
        } catch {
            // Si aun así supera la cuota, limpio el cache anterior para no bloquear.
            localStorage.removeItem(this.claveStorage);
        }
    }

    leerCache(): CacheDashboard | null {
        if (!this.storageDisponible()) {
            return null;
        }

        const cacheSerializado = localStorage.getItem(this.claveStorage);

        if (!cacheSerializado) {
            return null;
        }

        try {
            const cache = JSON.parse(cacheSerializado) as Partial<CacheDashboard>;

            if (!Array.isArray(cache.ofertas) || typeof cache.fechaGuardado !== 'string') {
                return null;
            }

            return {
                ofertas: cache.ofertas,
                estadisticas: cache.estadisticas ?? null,
                fechaGuardado: cache.fechaGuardado,
            };
        } catch {
            return null;
        }
    }

    private storageDisponible(): boolean {
        return typeof localStorage !== 'undefined';
    }
}
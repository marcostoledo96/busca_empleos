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

        localStorage.setItem(this.claveStorage, JSON.stringify(cache));
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
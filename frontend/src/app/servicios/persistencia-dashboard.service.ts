import { Injectable } from '@angular/core';
import { Estadisticas, Oferta } from '../modelos/oferta.model';

export interface CacheDashboard {
    ofertas: Oferta[];
    estadisticas: Estadisticas | null;
    fechaGuardado: string;
    version: number;
}

// Versión actual del esquema de cache.
// Incrementar este valor invalida automáticamente cualquier cache anterior.
const VERSION_CACHE = 1;

// TTL del cache en horas (2 días).
const TTL_HORAS = 48;

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
            version: VERSION_CACHE,
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
                this.limpiarCache();
                return null;
            }

            // Invalido el cache si cambió la versión del esquema.
            if (cache.version !== VERSION_CACHE) {
                this.limpiarCache();
                return null;
            }

            // Valido el TTL: si el cache expiró, lo invalido.
            const fechaGuardado = new Date(cache.fechaGuardado).getTime();
            if (Number.isNaN(fechaGuardado) || Date.now() - fechaGuardado > TTL_HORAS * 3600000) {
                this.limpiarCache();
                return null;
            }

            return {
                ofertas: cache.ofertas,
                estadisticas: cache.estadisticas ?? null,
                fechaGuardado: cache.fechaGuardado,
                version: cache.version,
            };
        } catch {
            this.limpiarCache();
            return null;
        }
    }

    limpiarCache(): void {
        if (this.storageDisponible()) {
            localStorage.removeItem(this.claveStorage);
        }
    }

    private storageDisponible(): boolean {
        return typeof localStorage !== 'undefined';
    }
}
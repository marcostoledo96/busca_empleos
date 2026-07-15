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
    private readonly ofertasSincronizadas = new Map<number, Oferta>();
    private usandoFallbackMemoria = false;

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

    async guardarBloqueSincronizacion(ofertas: Oferta[]): Promise<{ fallback: boolean; total: number }> {
        for (const oferta of ofertas) this.ofertasSincronizadas.set(oferta.id, oferta);
        if (this.usandoFallbackMemoria || typeof indexedDB === 'undefined') {
            this.usandoFallbackMemoria = true;
            return { fallback: true, total: this.ofertasSincronizadas.size };
        }

        try {
            const base = await this.abrirBaseSincronizacion();
            await new Promise<void>((resolve, reject) => {
                const transaccion = base.transaction('ofertas', 'readwrite');
                for (const oferta of ofertas) transaccion.objectStore('ofertas').put(oferta);
                transaccion.oncomplete = () => resolve();
                transaccion.onerror = () => reject(transaccion.error);
                transaccion.onabort = () => reject(transaccion.error);
            });
            base.close();
        } catch {
            this.usandoFallbackMemoria = true;
        }
        return { fallback: this.usandoFallbackMemoria, total: this.ofertasSincronizadas.size };
    }

    async obtenerOfertasSincronizadas(): Promise<Oferta[]> {
        if (this.usandoFallbackMemoria || typeof indexedDB === 'undefined') {
            return [...this.ofertasSincronizadas.values()];
        }

        try {
            const base = await this.abrirBaseSincronizacion();
            const ofertasPersistidas = await new Promise<Oferta[]>((resolve, reject) => {
                const solicitud = base.transaction('ofertas', 'readonly').objectStore('ofertas').getAll();
                solicitud.onsuccess = () => resolve(solicitud.result as Oferta[]);
                solicitud.onerror = () => reject(solicitud.error);
            });
            base.close();
            for (const oferta of ofertasPersistidas) this.ofertasSincronizadas.set(oferta.id, oferta);
        } catch {
            this.usandoFallbackMemoria = true;
        }

        return [...this.ofertasSincronizadas.values()];
    }

    async limpiarSincronizacion(): Promise<void> {
        this.ofertasSincronizadas.clear();
        this.usandoFallbackMemoria = false;
        if (typeof indexedDB === 'undefined') {
            this.usandoFallbackMemoria = true;
            return;
        }

        let base: IDBDatabase | undefined;
        try {
            const baseAbierta = await this.abrirBaseSincronizacion();
            base = baseAbierta;
            await new Promise<void>((resolve, reject) => {
                const transaccion = baseAbierta.transaction('ofertas', 'readwrite');
                transaccion.objectStore('ofertas').clear();
                transaccion.oncomplete = () => resolve();
                transaccion.onerror = () => reject(transaccion.error);
                transaccion.onabort = () => reject(transaccion.error);
            });
        } catch {
            this.usandoFallbackMemoria = true;
        } finally {
            base?.close();
        }
    }

    private abrirBaseSincronizacion(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const solicitud = indexedDB.open('busca-empleos-sincronizacion', 1);
            solicitud.onupgradeneeded = () => {
                if (!solicitud.result.objectStoreNames.contains('ofertas')) {
                    solicitud.result.createObjectStore('ofertas', { keyPath: 'id' });
                }
            };
            solicitud.onsuccess = () => resolve(solicitud.result);
            solicitud.onerror = () => reject(solicitud.error);
        });
    }

    private storageDisponible(): boolean {
        return typeof localStorage !== 'undefined';
    }
}

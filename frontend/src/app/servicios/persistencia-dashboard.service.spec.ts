import { Oferta } from '../modelos/oferta.model';
import { PersistenciaDashboardService } from './persistencia-dashboard.service';

describe('PersistenciaDashboardService', () => {
    let servicio: PersistenciaDashboardService;

    beforeEach(async () => {
        servicio = new PersistenciaDashboardService();
        await servicio.limpiarSincronizacion();
        localStorage.clear();
    });

    it('guarda y recupera la última carga del dashboard', () => {
        const ofertaMock: Oferta = {
            id: 1,
            titulo: 'Frontend',
            empresa: 'Empresa Demo',
            ubicacion: 'Buenos Aires',
            modalidad: 'remoto',
            descripcion: 'Oferta de prueba',
            url: 'https://ejemplo.com',
            plataforma: 'linkedin',
            nivel_requerido: 'junior',
            salario_min: null,
            salario_max: null,
            moneda: null,
            estado_evaluacion: 'aprobada',
            razon_evaluacion: 'Coincide con el perfil',
            porcentaje_match: 90,
            estado_postulacion: 'no_postulado',
            fecha_publicacion: '2026-04-01T00:00:00.000Z',
            fecha_extraccion: '2026-04-01T12:00:00.000Z',
            datos_crudos: null,
        };

        const fechaGuardado = new Date().toISOString();

        servicio.guardarCache({
            ofertas: [ofertaMock],
            estadisticas: {
                total: 1,
                pendientes: 0,
                aprobadas: 1,
                rechazadas: 0,
            },
            fechaGuardado,
            version: 1,
        });

        const cache = servicio.leerCache();

        expect(cache).not.toBeNull();
        expect(cache?.ofertas.length).toBe(1);
        expect(cache?.estadisticas?.aprobadas).toBe(1);
        expect(cache?.fechaGuardado).toBe(fechaGuardado);
        expect(cache?.version).toBe(1);
    });

    it('retorna null si el JSON del storage está corrupto', () => {
        localStorage.setItem('busca-empleos.dashboard.cache', '{ json roto');

        expect(servicio.leerCache()).toBeNull();
    });

    it('retorna null si el cache no tiene la forma esperada', () => {
        localStorage.setItem('busca-empleos.dashboard.cache', JSON.stringify({ fechaGuardado: 123 }));

        expect(servicio.leerCache()).toBeNull();
    });

    it('invalida el cache si la versión del esquema cambió', () => {
        const cacheViejo = JSON.stringify({
            ofertas: [],
            estadisticas: null,
            fechaGuardado: new Date().toISOString(),
            version: 0,
        });
        localStorage.setItem('busca-empleos.dashboard.cache', cacheViejo);

        expect(servicio.leerCache()).toBeNull();
        expect(localStorage.getItem('busca-empleos.dashboard.cache')).toBeNull();
    });

    it('invalida el cache si expiró el TTL', () => {
        const cacheVencido = JSON.stringify({
            ofertas: [],
            estadisticas: null,
            fechaGuardado: new Date(Date.now() - 49 * 3600000).toISOString(),
            version: 1,
        });
        localStorage.setItem('busca-empleos.dashboard.cache', cacheVencido);

        expect(servicio.leerCache()).toBeNull();
        expect(localStorage.getItem('busca-empleos.dashboard.cache')).toBeNull();
    });

    it('recupera el cache si está dentro del TTL', () => {
        const cacheReciente = JSON.stringify({
            ofertas: [{ id: 1, titulo: 'Vigente' } as unknown as Oferta],
            estadisticas: null,
            fechaGuardado: new Date(Date.now() - 1 * 3600000).toISOString(),
            version: 1,
        });
        localStorage.setItem('busca-empleos.dashboard.cache', cacheReciente);

        const cache = servicio.leerCache();
        expect(cache).not.toBeNull();
        expect(cache?.ofertas.length).toBe(1);
    });

    it('deduplica bloques en memoria cuando IndexedDB no está disponible', async () => {
        const original = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
        const oferta = { id: 7, titulo: 'Oferta IA' } as Oferta;

        const resultado = await servicio.guardarBloqueSincronizacion([oferta, oferta]);

        expect(resultado.fallback).toBeTrue();
        expect(resultado.total).toBe(1);
        expect(await servicio.obtenerOfertasSincronizadas()).toEqual([oferta]);
        Object.defineProperty(globalThis, 'indexedDB', { value: original, configurable: true });
    });

    it('rehidrata desde IndexedDB después de recrear el servicio sin duplicar ofertas', async () => {
        const oferta = { id: 8, titulo: 'Oferta persistida' } as Oferta;
        await servicio.guardarBloqueSincronizacion([oferta, oferta]);

        const servicioRecargado = new PersistenciaDashboardService();
        const ofertas = await servicioRecargado.obtenerOfertasSincronizadas();

        expect(ofertas).toEqual([oferta]);
    });

    it('limpia IndexedDB antes de guardar y rehidratar un snapshot nuevo', async () => {
        const ofertaAnterior = { id: 801, titulo: 'Snapshot anterior' } as Oferta;
        const ofertaNueva = { id: 802, titulo: 'Snapshot nuevo' } as Oferta;
        await servicio.guardarBloqueSincronizacion([ofertaAnterior]);

        await servicio.limpiarSincronizacion();
        await servicio.guardarBloqueSincronizacion([ofertaNueva]);

        const servicioRecargado = new PersistenciaDashboardService();
        expect(await servicioRecargado.obtenerOfertasSincronizadas()).toEqual([ofertaNueva]);
    });

    it('conserva el Map si falla la lectura de IndexedDB', async () => {
        const oferta = { id: 9, titulo: 'Oferta en memoria' } as Oferta;
        await servicio.guardarBloqueSincronizacion([oferta]);
        spyOn(servicio as any, 'abrirBaseSincronizacion').and.rejectWith(new Error('IndexedDB no disponible'));

        expect(await servicio.obtenerOfertasSincronizadas()).toEqual([oferta]);
    });
});

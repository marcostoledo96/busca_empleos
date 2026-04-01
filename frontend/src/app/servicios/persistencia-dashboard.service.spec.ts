import { Oferta } from '../modelos/oferta.model';
import { PersistenciaDashboardService } from './persistencia-dashboard.service';

describe('PersistenciaDashboardService', () => {
    let servicio: PersistenciaDashboardService;

    beforeEach(() => {
        servicio = new PersistenciaDashboardService();
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

        servicio.guardarCache({
            ofertas: [ofertaMock],
            estadisticas: {
                total: 1,
                pendientes: 0,
                aprobadas: 1,
                rechazadas: 0,
            },
            fechaGuardado: '2026-04-01T12:00:00.000Z',
        });

        const cache = servicio.leerCache();

        expect(cache).not.toBeNull();
        expect(cache?.ofertas.length).toBe(1);
        expect(cache?.estadisticas?.aprobadas).toBe(1);
        expect(cache?.fechaGuardado).toBe('2026-04-01T12:00:00.000Z');
    });

    it('retorna null si el JSON del storage está corrupto', () => {
        localStorage.setItem('busca-empleos.dashboard.cache', '{ json roto');

        expect(servicio.leerCache()).toBeNull();
    });

    it('retorna null si el cache no tiene la forma esperada', () => {
        localStorage.setItem('busca-empleos.dashboard.cache', JSON.stringify({ fechaGuardado: 123 }));

        expect(servicio.leerCache()).toBeNull();
    });
});
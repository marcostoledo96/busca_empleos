import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PanelControl } from './panel-control';
import { ComponentFixture } from '@angular/core/testing';
import { ResultadoFuente, EstadoFuente } from '../../modelos/respuesta-api.model';
import { environment } from '../../../environments/environment';

// Verifico el contrato HTTP sintético, no ejecuto Express ni proveedores.
describe('Panel — resultados por fuente', () => {
    let http: HttpTestingController;
    const base = environment.urlApi;
    const fuente = (estado: EstadoFuente): ResultadoFuente => ({
        plataforma: 'linkedin', nombre: 'LinkedIn', estado, estadoScraping: estado,
        nuevas: 1, actualizadas: 2, reapariciones: 3, duplicadas: 5,
        duplicadasDescartadas: 4, idiomaDescartadas: 6, antiguasDescartadas: 7,
        totalCrudos: 23, totalElegibles: 6, consultasEjecutadas: 2,
        peticionesRealizadas: null, duracionMs: 42, motivoFinalizacion: 'http',
        errores: [{ tipo: 'http', codigoHttp: 503 }],
        resultadosConsultas: [
            { consulta: 'soporte', estado: 'completada', peticionesRealizadas: 1, totalCrudos: 23, errores: [] },
            { consulta: 'junior', estado: 'error', peticionesRealizadas: 1, totalCrudos: 0, errores: [{ tipo: 'http', codigoHttp: 503 }] },
        ],
    });
    function iniciar(): ComponentFixture<PanelControl> {
        const fixture = TestBed.createComponent(PanelControl);
        http = TestBed.inject(HttpTestingController);
        fixture.detectChanges();
        http.expectOne(`${base}/scraping/previsualizacion`).flush({ exito: true, datos: { plataformas: [] } });
        http.expectOne(`${base}/automatizacion/estado`).flush({ exito: true, datos: { activo: false, ultimoResultado: null } });
        http.expectOne(`${base}/automatizacion/historial`).flush({ exito: true, datos: [] });
        http.expectOne(`${base}/automatizacion/progreso`).flush({ exito: true, datos: { activo: false } });
        http.expectOne(`${base}/evaluacion/progreso`).flush({ exito: true, datos: { activo: false } });
        return fixture;
    }
    beforeEach(() => TestBed.configureTestingModule({
        imports: [PanelControl],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    }));
    for (const [estado, etiqueta] of Object.entries({
        completada: 'Completada', sin_resultados: 'Sin resultados', parcial: 'Parcial',
        error: 'Error', timeout: 'Timeout', sin_credenciales: 'Sin credenciales',
        deshabilitada: 'Deshabilitada', interrumpida: 'Interrumpida',
    })) {
        it(`muestro el estado ${estado} y todos los contadores sin atribuirlos a consultas`, () => {
            const fixture = iniciar();
            fixture.componentInstance.consultarEstadoCron();
            http.expectOne(`${base}/automatizacion/estado`).flush({ exito: true, datos: {
                activo: false, ultimoResultado: { estado, estadoScraping: estado, estadoEvaluacion: 'completada', fuentes: [fuente(estado as EstadoFuente)] },
            } });
            fixture.detectChanges();
            const texto = fixture.nativeElement.textContent;
            for (const valor of [etiqueta, 'Nuevas: 1', 'Actualizadas: 2', 'Reapariciones: 3',
                'Existentes (legacy, no sumable): 5', 'Intra-ejecución: 4', 'Descartadas por idioma: 6',
                'Por antigüedad: 7', 'Brutas: 23', 'Elegibles: 6', 'Peticiones: No medido',
                'Consultas ejecutadas: 2', 'Duración: 42 ms', 'Finalización: http', '503', 'soporte', 'junior']) {
                expect(texto).withContext(valor).toContain(valor);
            }
            expect(texto).not.toContain('costo');
            expect(texto).toContain('global de pendientes');
            fixture.destroy();
            http.verify();
        });
    }

    for (const [codigo, estado] of [[502, 'error'], [504, 'timeout']] as const) {
        it(`conservo datos.fuente ante HTTP ${codigo} y separo el error del historial`, () => {
            const fixture = iniciar();
            fixture.componentInstance.scrapearLinkedin();
            http.expectOne(`${base}/scraping/previsualizacion`).flush({ exito: true, datos: { plataformas: [] } });
            http.expectOne(`${base}/scraping/linkedin`).flush({ exito: false, error: 'Fallo proveedor', datos: {
                fuente: fuente(estado),
            } }, { status: codigo, statusText: 'Error' });
            http.expectOne(`${base}/automatizacion/historial`).flush({}, { status: 503, statusText: 'Error' });
            fixture.detectChanges();
            expect(fixture.nativeElement.textContent).toContain(estado === 'timeout' ? 'Timeout' : 'Error');
            expect(fixture.nativeElement.textContent).toContain('No pude actualizar el historial');
            expect(fixture.nativeElement.textContent).toContain('Nuevas: 1');
            expect(fixture.componentInstance.mostrarOverlayIndividual()).toBeFalse();
            fixture.componentInstance.actualizarHistorial();
            http.expectOne(`${base}/automatizacion/historial`).flush({ exito: true, datos: [] });
            expect(fixture.componentInstance.errorHistorial()).toBeNull();
            expect(fixture.componentInstance.resultadoIndividual()?.estado).toBe(estado);
            fixture.destroy();
            http.verify();
        });
    }

    for (const activar of [true, false]) {
        it(`reconcilio HTTP503 del cron al ${activar ? 'activar' : 'desactivar'} sin invertir el estado devuelto`, () => {
            const fixture = iniciar();
            fixture.componentInstance.cronActivo.set(true);
            fixture.componentInstance.toggleCron(activar);
            expect(fixture.componentInstance.cambiandoCron()).toBeTrue();
            http.expectOne(`${base}/automatizacion/${activar ? 'iniciar' : 'detener'}`).flush({
                exito: false, error: 'No pude confirmar persistencia', datos: {
                    activo: false, expresionCron: null, zonaHoraria: 'America/Argentina/Buenos_Aires',
                    errorCron: 'No pude confirmar persistencia', ultimoResultado: null,
                },
            }, { status: 503, statusText: 'Error' });
            fixture.detectChanges();
            expect(fixture.componentInstance.cronActivo()).toBeFalse();
            expect(fixture.componentInstance.cambiandoCron()).toBeFalse();
            expect(fixture.nativeElement.textContent).toContain('No pude confirmar persistencia');
            expect(fixture.nativeElement.textContent).toContain('America/Argentina/Buenos_Aires');
            fixture.destroy();
            http.verify();
        });
    }

    it('conservo historial anterior ante 429, bloqueo cargas solapadas y permito refrescar', () => {
        const fixture = iniciar();
        const filas = Array.from({ length: 21 }, (_, id) => ({ id: String(id), tipo: 'individual',
            inicio: '2026-06-01', fin: null, estado: 'interrumpida', duracion_ms: '42',
            resumen: { estado: 'interrumpida', fuentes: [{ plataforma: 'getonbrd', estado: 'deshabilitada',
                motivoFinalizacion: 'Requiero autorización escrita verificable', resultadosConsultas: [], errores: [] }] } }));
        fixture.componentInstance.actualizarHistorial();
        fixture.componentInstance.actualizarHistorial();
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Consultando historial');
        http.expectOne(`${base}/automatizacion/historial`).flush({ exito: true, datos: filas });
        fixture.detectChanges();
        expect(fixture.componentInstance.historial().length).toBe(20);
        expect(fixture.nativeElement.textContent).toContain('GetOnBrd');
        expect(fixture.nativeElement.textContent).toContain('autorización escrita verificable');
        fixture.componentInstance.actualizarHistorial();
        http.expectOne(`${base}/automatizacion/historial`).flush({}, { status: 429, statusText: 'Límite' });
        fixture.detectChanges();
        expect(fixture.componentInstance.historial().length).toBe(20);
        expect(fixture.nativeElement.textContent).toContain('No pude actualizar el historial');
        expect(fixture.nativeElement.textContent).not.toContain('No hay ejecuciones recientes');
        fixture.destroy();
        http.verify();
    });

    it('muestro un resultado parcial y métricas desconocidas sin fingir cero', () => {
        const fixture = TestBed.createComponent(PanelControl);
        http = TestBed.inject(HttpTestingController);
        fixture.detectChanges();
        http.match(() => true).forEach(req => {
            if (req.request.url.endsWith('/estado')) req.flush({ exito: true, datos: {
                activo: false, ultimoResultado: { estado: 'parcial', fuentes: [{
                    plataforma: 'linkedin', nombre: 'LinkedIn', estado: 'parcial', nuevas: 1,
                    actualizadas: 2, reapariciones: 3, duplicadas: 5, duplicadasDescartadas: 4,
                    peticionesRealizadas: null, resultadosConsultas: [], errores: [],
                }] },
            } });
            else if (req.request.url.endsWith('/historial')) req.flush({ exito: true, datos: [] });
            else if (req.request.url.endsWith('/previsualizacion')) req.flush({ exito: true, datos: { plataformas: [] } });
            else req.flush({ exito: true, datos: { activo: false, errores: 0 } });
        });
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Parcial');
        expect(fixture.nativeElement.textContent).toContain('No medido');
        expect(fixture.nativeElement.textContent).toContain('Actualizadas: 2');
        expect(fixture.nativeElement.textContent).toContain('Reapariciones: 3');
        expect(fixture.nativeElement.textContent).toContain('Intra-ejecución: 4');
        fixture.destroy();
        http.verify();
    });
});

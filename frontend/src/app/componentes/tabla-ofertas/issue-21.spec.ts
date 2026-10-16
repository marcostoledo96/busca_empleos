import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { TablaOfertas } from './tabla-ofertas';
import { Oferta } from '../../modelos/oferta.model';

function crearOfertas(cantidad: number): Oferta[] {
    return Array.from({ length: cantidad }, (_, indice) => ({
        id: indice + 1, titulo: `${indice < 7 ? 'Angular' : 'React'} ${indice + 1}`,
        empresa: 'Empresa sintética', ubicacion: 'Buenos Aires', plataforma: 'linkedin',
        estado_evaluacion: 'aprobada', estado_postulacion: 'no_postulado', porcentaje_match: 90,
        fecha_extraccion: new Date().toISOString(), descripcion: 'Descripción manual',
        url: 'https://example.test', datos_crudos: null,
    } as Oferta));
}

describe('Issue 21 — tabla, selección y guardado', () => {
    let fixture: ComponentFixture<TablaOfertas>;
    let componente: TablaOfertas;
    let http: HttpTestingController;
    let mensajes: jasmine.Spy;
    let vistaMobile: boolean;
    const buscar = (selector: string): any => fixture.nativeElement.querySelector(selector);
    const renderizar = () => { fixture.detectChanges(); tick(400); fixture.detectChanges(); };
    const cargar = (cantidad: number) => {
        fixture.componentRef.setInput('ofertas', crearOfertas(cantidad));
        renderizar();
    };
    const filtrar = (texto: string, mobile = false) => {
        const campo = buscar(mobile ? '#filtro-busqueda-cards' : '#filtro-busqueda-input');
        campo.value = texto;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        renderizar();
    };
    const seleccionarPagina = () => { buscar('thead input[type=checkbox]').click(); renderizar(); };
    const aplicar = () => {
        componente.estadoBulkSeleccionado = 'cv_enviado';
        renderizar();
        buscar('[aria-label="Aplicar acción masiva"]').click();
        renderizar();
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TablaOfertas],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), MessageService],
        }).compileComponents();
        fixture = TestBed.createComponent(TablaOfertas);
        componente = fixture.componentInstance;
        http = TestBed.inject(HttpTestingController);
        mensajes = spyOn(TestBed.inject(MessageService), 'add');
        vistaMobile = false;
        const original = window.matchMedia.bind(window);
        spyOn(window, 'matchMedia').and.callFake(consulta => consulta === '(max-width: 768px)'
            ? ({ matches: vistaMobile } as MediaQueryList) : original(consulta));
    });
    afterEach(() => http.verify());

    it('selecciono sólo las siete coincidencias reales entre cien ofertas y conservo selección hasta confirmación', fakeAsync(() => {
        cargar(100);
        filtrar('Angular');
        expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(7);
        expect(buscar('thead input').getAttribute('aria-label')).toBe('Seleccionar ofertas de esta página');
        seleccionarPagina();
        const emitido = jasmine.createSpy('accionMasiva');
        componente.accionMasiva.subscribe(emitido);
        aplicar();
        expect(emitido).toHaveBeenCalledOnceWith({ ids: [1, 2, 3, 4, 5, 6, 7], estadoPostulacion: 'cv_enviado' });
        expect(componente.seleccionadas().size).toBe(7);
        fixture.componentRef.setInput('accionMasivaConfirmada', 1);
        renderizar();
        expect(componente.seleccionadas().size).toBe(0);
        expect(buscar('#filtro-busqueda-input').value).toBe('Angular');
    }));

    it('cambio la página real de PrimeNG y emito únicamente sus IDs visibles', fakeAsync(() => {
        cargar(100);
        filtrar('React');
        buscar('.p-paginator-next').click();
        renderizar();
        seleccionarPagina();
        const emitido = jasmine.createSpy('accionMasiva');
        componente.accionMasiva.subscribe(emitido);
        aplicar();
        expect(emitido).toHaveBeenCalledOnceWith({
            ids: Array.from({ length: 20 }, (_, i) => i + 28), estadoPostulacion: 'cv_enviado',
        });
    }));

    it('represento selección vacía, parcial, completa y desmarcada desde el DOM', fakeAsync(() => {
        cargar(3);
        expect(buscar('thead input').checked).toBeFalse();
        buscar('tbody input[type=checkbox]').click(); renderizar();
        expect(buscar('thead input').indeterminate).toBeTrue();
        seleccionarPagina();
        expect(buscar('thead input').checked).toBeTrue();
        expect(buscar('thead input').indeterminate).toBeFalse();
        seleccionarPagina();
        expect(componente.seleccionadas().size).toBe(0);
    }));

    it('invalido selección cuando cambia la búsqueda, página, pestaña o plataforma', fakeAsync(() => {
        cargar(50);
        seleccionarPagina(); filtrar('Angular');
        expect(componente.seleccionadas().size).toBe(0);
        seleccionarPagina();
        fixture.componentRef.setInput('alcanceSeleccion', 'rechazadas:linkedin'); renderizar();
        expect(componente.seleccionadas().size).toBe(0);
        seleccionarPagina();
        fixture.componentRef.setInput('alcanceSeleccion', 'rechazadas:indeed'); renderizar();
        expect(componente.seleccionadas().size).toBe(0);
        filtrar(''); seleccionarPagina();
        buscar('.p-paginator-next').click(); renderizar();
        expect(componente.seleccionadas().size).toBe(0);
    }));

    it('revalido el conjunto visible antes de emitir aunque cambien los datos sin otro filtro', fakeAsync(() => {
        cargar(3); seleccionarPagina();
        filtrar('Angular'); seleccionarPagina();
        fixture.componentRef.setInput('ofertas', crearOfertas(3).map(o => ({ ...o, titulo: o.id === 1 ? 'Angular' : 'React' })));
        renderizar();
        // PrimeNG vuelve a filtrar al refrescar value: sólo conservo el ID aún visible.
        expect([...componente.seleccionadas()]).toEqual([1]);
        // Simulo además un ID obsoleto: la guarda debe excluirlo aunque exista en el input padre.
        componente.toggleSeleccion(2);
        const emitido = jasmine.createSpy('accionMasiva'); componente.accionMasiva.subscribe(emitido);
        componente.estadoBulkSeleccionado = 'cv_enviado';
        componente.aplicarAccionMasiva();
        expect(emitido).toHaveBeenCalledOnceWith({ ids: [1], estadoPostulacion: 'cv_enviado' });
    }));

    it('ordeno desde el encabezado sin transferir selección a otros IDs', fakeAsync(() => {
        cargar(3); buscar('tbody input').click(); renderizar();
        buscar('th[pSortableColumn="titulo"]').click(); renderizar();
        expect(componente.seleccionadas().size).toBe(0);
        seleccionarPagina();
        expect([...componente.seleccionadas()].sort()).toEqual([1, 2, 3]);
    }));

    it('rechazo destinos inválidos y bloqueo acciones y cambios individuales durante bulk', fakeAsync(() => {
        cargar(2); seleccionarPagina();
        const emitido = jasmine.createSpy('accionMasiva'); componente.accionMasiva.subscribe(emitido);
        componente.estadoBulkSeleccionado = 'inventado'; componente.aplicarAccionMasiva();
        expect(emitido).not.toHaveBeenCalled();
        fixture.componentRef.setInput('accionMasivaEnCurso', true); renderizar();
        componente.estadoBulkSeleccionado = 'cv_enviado'; componente.aplicarAccionMasiva();
        componente.cambiarPostulacion(componente.ofertas()[0], 'cv_enviado');
        expect(emitido).not.toHaveBeenCalled();
        http.expectNone(r => r.method === 'PATCH');
        expect(buscar('[aria-label="Aplicar acción masiva"]').disabled).toBeTrue();
        expect(fixture.nativeElement.textContent).toContain('Procesando');
        expect(componente.seleccionadas().size).toBe(2);
    }));

    it('evito doble envío y conservo selección útil después de un error del padre para reintentar', fakeAsync(() => {
        cargar(3); seleccionarPagina();
        const emitido = jasmine.createSpy('accionMasiva'); componente.accionMasiva.subscribe(emitido);
        componente.estadoBulkSeleccionado = 'cv_enviado'; renderizar();
        buscar('[aria-label="Aplicar acción masiva"]').click();
        buscar('[aria-label="Aplicar acción masiva"]').click();
        expect(emitido).toHaveBeenCalledTimes(1);
        fixture.componentRef.setInput('accionMasivaEnCurso', true); renderizar();
        // Simulo el contrato del padre ante fallo: termina el pendiente sin confirmar éxito.
        fixture.componentRef.setInput('accionMasivaEnCurso', false); renderizar();
        expect(componente.seleccionadas().size).toBe(3);
        aplicar();
        expect(emitido).toHaveBeenCalledTimes(2);
        fixture.componentRef.setInput('accionMasivaConfirmada', 1); renderizar();
        expect(componente.seleccionadas().size).toBe(0);
    }));

    it('al desmarcar una página no borro IDs ajenos al conjunto recibido', fakeAsync(() => {
        cargar(25);
        componente.toggleSeleccion(25);
        seleccionarPagina(); seleccionarPagina();
        expect([...componente.seleccionadas()]).toEqual([25]);
    }));

    it('reutilizo contains de PrimeNG en cards para acentos y espacios', fakeAsync(() => {
        cargar(3);
        filtrar('sintetica');
        expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
        expect(fixture.nativeElement.querySelectorAll('.card-oferta').length).toBe(3);
        filtrar(' Angular ');
        expect(buscar('.cards-vacio').textContent).toContain('No hay ofertas que coincidan');
        expect(buscar('.tabla-vacia').textContent).toContain('No hay ofertas que coincidan');
    }));

    for (const mobile of [false, true]) {
        it(`conservo las ofertas sin un falso estado vacío al buscar un espacio en ${mobile ? 'mobile' : 'escritorio'}`, fakeAsync(() => {
            vistaMobile = mobile;
            fixture.componentRef.setInput('ofertas', crearOfertas(3).map(oferta => ({
                ...oferta, titulo: 'Angular', empresa: 'ACME', ubicacion: 'CABA',
            })));
            renderizar();
            filtrar(' ', mobile);
            expect(buscar('#filtro-busqueda-input').value).toBe(' ');
            expect(buscar('#filtro-busqueda-cards').value).toBe(' ');
            expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(3);
            expect(fixture.nativeElement.querySelectorAll('.card-oferta').length).toBe(3);
            expect(buscar('.tabla-vacia')).toBeNull();
            expect(buscar('.cards-vacio')).toBeNull();
            expect(fixture.nativeElement.textContent).not.toContain('No hay ofertas que coincidan con los filtros actuales');
            expect(fixture.nativeElement.textContent).not.toContain('Limpiar filtros');
        }));
    }

    it('las acciones mobile intersectan su página efectiva y no la primera de escritorio', fakeAsync(() => {
        cargar(45);
        vistaMobile = true;
        buscar('.vista-mobile [aria-label="Ir a página 3"]').click(); renderizar();
        buscar('.vista-mobile input[type=checkbox]').click(); renderizar();
        const emitido = jasmine.createSpy('accionMasiva'); componente.accionMasiva.subscribe(emitido);
        aplicar();
        expect(emitido).toHaveBeenCalledOnceWith({ ids: [41, 42, 43, 44, 45], estadoPostulacion: 'cv_enviado' });
    }));

    it('sin visibles no selecciono nada ni emito acciones', fakeAsync(() => {
        cargar(3); filtrar('inexistente');
        seleccionarPagina();
        componente.estadoBulkSeleccionado = 'cv_enviado';
        const emitido = jasmine.createSpy('accionMasiva'); componente.accionMasiva.subscribe(emitido);
        componente.aplicarAccionMasiva();
        expect(componente.seleccionadas().size).toBe(0);
        expect(emitido).not.toHaveBeenCalled();
    }));

    for (const [inicial, final, pagina, cantidad] of [[55, 15, 1, 15], [45, 35, 2, 15], [55, 52, 3, 12]]) {
        it(`ajusto cards de ${inicial} a ${final} sin resetear páginas válidas`, fakeAsync(() => {
            cargar(inicial);
            buscar('.vista-mobile [aria-label="Ir a página 3"]').click(); renderizar();
            buscar('.card-seleccion input').click(); renderizar();
            fixture.componentRef.setInput('ofertas', crearOfertas(final)); renderizar();
            expect(componente.paginaActualCards()).toBe(pagina - 1);
            expect(fixture.nativeElement.querySelectorAll('.card-oferta').length).toBe(cantidad);
            expect(fixture.nativeElement.textContent).not.toContain('PÁG 3/1');
            if (pagina !== 3) expect(componente.seleccionadas().size).toBe(0);
            if (pagina > 1) expect(buscar('.cards-pagina').textContent).toContain(`PÁG ${pagina}/`);
        }));
    }

    it('sincronizo ambos buscadores, limpio el filtro real y emito limpiarFiltros al padre', fakeAsync(() => {
        cargar(55); filtrar('Angular', true);
        expect(buscar('#filtro-busqueda-input').value).toBe('Angular');
        expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(7);
        filtrar('no coincide');
        expect(buscar('.cards-vacio').textContent).toContain('No hay ofertas que coincidan con los filtros actuales');
        expect(buscar('.cards-pagina')).toBeNull();
        const emitido = jasmine.createSpy('limpiarFiltros');
        (componente as any).limpiarFiltros.subscribe(emitido);
        buscar('.cards-vacio button').click(); renderizar();
        expect(emitido).toHaveBeenCalledTimes(1);
        expect(buscar('#filtro-busqueda-input').value).toBe('');
        expect(buscar('#filtro-busqueda-cards').value).toBe('');
        expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(20);
    }));

    it('distingo ausencia global de una categoría vacía y plataforma sin coincidencias', fakeAsync(() => {
        cargar(0);
        expect(buscar('.cards-vacio').textContent).toContain('No hay ofertas guardadas');
        fixture.componentRef.setInput('totalOfertas', 100); renderizar();
        expect(buscar('.cards-vacio').textContent).toContain('Esta categoría no tiene ofertas disponibles');
        expect(buscar('.cards-vacio').textContent).not.toContain('scraping');
        fixture.componentRef.setInput('filtroPlataformaActivo', true); renderizar();
        expect(buscar('.cards-vacio').textContent).toContain('No hay ofertas que coincidan con los filtros actuales');
        expect(buscar('.cards-vacio button').textContent).toContain('Limpiar filtros');
    }));

    it('conservo activación por teclado y bloqueo modo demo', fakeAsync(() => {
        cargar(1);
        const emitido = jasmine.createSpy('detalle'); componente.ofertaSeleccionada.subscribe(emitido);
        buscar('.card-oferta').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(emitido).toHaveBeenCalledWith(componente.ofertas()[0]);
        fixture.componentRef.setInput('modoDemo', true); renderizar();
        componente.toggleSeleccion(1); componente.cambiarPostulacion(componente.ofertas()[0], 'cv_enviado');
        expect(componente.seleccionadas().size).toBe(0);
        http.expectNone(r => r.method === 'PATCH');
    }));

    it('reevaluación exige confirmación, IDs recientes y respeta ocupado y máximo 200', fakeAsync(() => {
        cargar(201);
        const emitido = jasmine.createSpy('reevaluar'); componente.reevaluarSeleccionadas.subscribe(emitido);
        seleccionarPagina();
        expect(emitido).not.toHaveBeenCalled();
        buscar('[data-accion="reevaluar"]').click(); renderizar();
        fixture.componentRef.setInput('evaluacionOcupada', true); renderizar();
        componente.confirmarReevaluacion(); expect(emitido).not.toHaveBeenCalled();
        fixture.componentRef.setInput('evaluacionOcupada', false); renderizar();
        buscar('[data-accion="confirmar-reevaluacion"]').click(); renderizar();
        expect(emitido).toHaveBeenCalledOnceWith(Array.from({ length: 20 }, (_, i) => i + 1));
        for (let id = 1; id <= 200; id++) componente.toggleSeleccion(id);
        expect(componente.seleccionReevaluable()).toBeTrue();
        componente.toggleSeleccion(201);
        componente.solicitarReevaluacion(); componente.confirmarReevaluacion();
        expect(emitido).toHaveBeenCalledTimes(1);
        expect(componente.seleccionReevaluable()).toBeFalse();
    }));

    it('no reevalúo ofertas históricas ni IDs inválidos', fakeAsync(() => {
        cargar(1);
        const emitido = jasmine.createSpy('reevaluar'); componente.reevaluarSeleccionadas.subscribe(emitido);
        fixture.componentRef.setInput('ofertas', [{ ...crearOfertas(1)[0], fecha_extraccion: '2020-01-01T00:00:00Z' }]);
        renderizar(); seleccionarPagina();
        expect(buscar('[data-accion="reevaluar"]').disabled).toBeTrue();
        componente.solicitarReevaluacion(); componente.confirmarReevaluacion();
        expect(emitido).not.toHaveBeenCalled();
        fixture.componentRef.setInput('ofertas', [{ ...crearOfertas(1)[0], id: -1 }]);
        renderizar(); seleccionarPagina();
        expect(componente.seleccionReevaluable()).toBeFalse();
        componente.solicitarReevaluacion(); componente.confirmarReevaluacion();
        expect(emitido).not.toHaveBeenCalled();
    }));

    it('cancelo confirmación de reevaluación si desaparecen las coincidencias', fakeAsync(() => {
        cargar(3); seleccionarPagina();
        buscar('[data-accion="reevaluar"]').click(); renderizar();
        const emitido = jasmine.createSpy('reevaluar'); componente.reevaluarSeleccionadas.subscribe(emitido);
        fixture.componentRef.setInput('ofertas', []); renderizar();
        componente.confirmarReevaluacion(); expect(emitido).not.toHaveBeenCalled();
    }));

    it('mantengo optimistic update, no anticipo éxito y confirmo con respuesta del backend', fakeAsync(() => {
        cargar(2);
        const pendiente = jasmine.createSpy('pendiente'); componente.postulacionPendiente.subscribe(pendiente);
        componente.cambiarPostulacion(componente.ofertas()[0], 'cv_enviado'); renderizar();
        expect(componente.ofertas()[0].estado_postulacion).toBe('cv_enviado');
        expect(mensajes).not.toHaveBeenCalled();
        expect(pendiente).toHaveBeenCalledWith({ id: 1, pendiente: true });
        expect(buscar('tbody p-select.p-disabled')).not.toBeNull();
        const solicitud = http.expectOne(r => r.url.endsWith('/1/postulacion'));
        expect(solicitud.request.body).toEqual({ estado_postulacion: 'cv_enviado' });
        solicitud.flush({ exito: true, datos: { estado_postulacion: 'cv_enviado' } }); renderizar();
        expect(mensajes).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success', detail: 'Postulación actualizada: CV enviado' }));
        expect(pendiente).toHaveBeenCalledWith({ id: 1, pendiente: false });
        expect(componente.ofertas()[1].estado_postulacion).toBe('no_postulado');
    }));

    for (const fallo of ['exito falso', 'HTTP 500', 'red']) {
        it(`revierto sólo la oferta afectada ante ${fallo} y notifico que no se guardó`, fakeAsync(() => {
            cargar(2);
            componente.cambiarPostulacion(componente.ofertas()[0], 'cv_enviado');
            const solicitud = http.expectOne(r => r.url.endsWith('/1/postulacion'));
            if (fallo === 'exito falso') solicitud.flush({ exito: false, error: 'No guardado' });
            else if (fallo === 'HTTP 500') solicitud.flush({}, { status: 500, statusText: 'Error' });
            else solicitud.error(new ProgressEvent('error'));
            renderizar();
            expect(componente.ofertas().map(o => o.estado_postulacion)).toEqual(['no_postulado', 'no_postulado']);
            expect(mensajes).toHaveBeenCalledOnceWith(jasmine.objectContaining({ severity: 'error', detail: jasmine.stringMatching(/no se guardó/i) }));
            componente.cambiarPostulacion(componente.ofertas()[0], 'en_proceso');
            http.expectOne(r => r.url.endsWith('/1/postulacion')).flush({ exito: true, datos: { estado_postulacion: 'en_proceso' } });
        }));
    }

    it('evito duplicados por ID, bloqueo bulk y respeto pendientes compartidos', fakeAsync(() => {
        cargar(2); seleccionarPagina();
        const oferta = componente.ofertas()[0];
        componente.cambiarPostulacion(oferta, 'cv_enviado');
        componente.cambiarPostulacion(oferta, 'en_proceso');
        expect(oferta.estado_postulacion).toBe('cv_enviado');
        const emitido = jasmine.createSpy('bulk'); componente.accionMasiva.subscribe(emitido);
        componente.estadoBulkSeleccionado = 'en_proceso'; componente.aplicarAccionMasiva();
        expect(emitido).not.toHaveBeenCalled();
        http.expectOne(r => r.url.endsWith('/1/postulacion')).flush({ exito: true, datos: { estado_postulacion: 'cv_enviado' } });
        fixture.componentRef.setInput('idsPostulacionPendiente', new Set([2])); renderizar();
        componente.cambiarPostulacion(componente.ofertas()[1], 'cv_enviado');
        http.expectNone(r => r.method === 'PATCH');
        expect(componente.ofertas()[1].estado_postulacion).toBe('no_postulado');
    }));
});

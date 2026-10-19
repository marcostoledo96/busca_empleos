import { Component, signal, viewChild } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { NEVER, of, throwError } from 'rxjs';
import { Dashboard } from '../src/app/paginas/dashboard/dashboard';
import { DemoService } from '../src/app/servicios/demo.service';
import { PersistenciaDashboardService } from '../src/app/servicios/persistencia-dashboard.service';
import { OFERTAS_DEMO } from '../src/app/datos/ofertas-demo';
import { ResumenBusqueda, ResultadoFuente } from '../src/app/modelos/respuesta-api.model';
import { crearOfertasDetalle, crearHttpDetalle } from './detalle-fixture';
import { crearOfertasTabla, crearHttpTabla } from './tabla-fixture';

// Aíslo el fixture: no inicializo Firebase, no guardo datos ni uso el interceptor productivo.
const parametros = new URLSearchParams(location.search);
const escenario = parametros.get('estado') || 'parcial';
const detalle = parametros.get('detalle');
const tabla = parametros.has('tabla');
const llamadas = signal<string[]>([]);
const cuerpos = signal<{ metodo: string; ruta: string; cuerpo: unknown }[]>([]);
const ofertas = tabla ? crearOfertasTabla() : detalle ? crearOfertasDetalle(detalle) : escenario === 'vacio' ? [] : structuredClone(OFERTAS_DEMO);
const httpTabla = tabla ? crearHttpTabla(ofertas, parametros) : null;
const httpDetalle = httpTabla ?? (detalle ? crearHttpDetalle(ofertas, parametros) : null);
let bloqueGuardado = ofertas;
let evaluacionIniciada = false;
let cicloIniciado = false;
const configuracion: ResumenBusqueda[] = ['linkedin', 'getonbrd', 'jooble'].map(plataforma => ({
    plataforma, nombre: plataforma === 'getonbrd' ? 'GetOnBrd' : plataforma,
    habilitada: true, ejecutable: plataforma !== 'jooble',
    terminos: ['desarrollador junior', 'QA trainee'], ubicacion: ['Argentina'],
    ventanaDias: 30, maxResultados: 40, filtros: { nivel: 'junior' },
    advertencias: plataforma === 'jooble' ? ['Falta la clave del proveedor; no puedo ejecutar esta fuente.'] : [],
    origen: { terminos: 'preferencias', ubicacion: 'preferencias' },
}));
const fuentes: ResultadoFuente[] = [{
    plataforma: 'linkedin', nombre: 'LinkedIn', estado: escenario === 'completado' ? 'completada' : 'parcial',
    nuevas: 3, actualizadas: 2, totalCrudos: 8, totalElegibles: 5,
    motivoFinalizacion: 'Límite de peticiones alcanzado',
    errores: escenario === 'completado' ? [] : [{ tipo: 'proveedor', codigoHttp: 429, mensaje: 'Cuota del proveedor agotada' }],
}];
const resultado = { estado: fuentes[0].estado, estadoScraping: fuentes[0].estado,
    estadoEvaluacion: 'completada', fuentes, configuracion };
const progresoEvaluacion = () => ({ activo: escenario === 'cargando',
    estado: escenario === 'cargando' ? 'activo' : 'completado',
    total: 4, evaluadas: escenario === 'cargando' ? 2 : 4,
    aprobadas: 1, rechazadas: 1, errores: 0, porcentaje: escenario === 'cargando' ? 50 : 100 });

const fixtureHttp: HttpInterceptorFn = solicitud => {
    const ruta = new URL(solicitud.url, location.origin).pathname.replace(/^.*\/api/, '');
    llamadas.update(actuales => [...actuales, `${solicitud.method} ${ruta}`]);
    if (['POST', 'PATCH'].includes(solicitud.method)) cuerpos.update(actuales => [...actuales,
        { metodo: solicitud.method, ruta, cuerpo: structuredClone(solicitud.body) }]);
    const respuestaDetalle = httpDetalle?.(solicitud, ruta);
    if (respuestaDetalle) return respuestaDetalle;
    if (escenario === 'error' && /ofertas|historial|previsualizacion/.test(ruta)) {
        return throwError(() => new HttpErrorResponse({ status: 503, error: { error: 'Fallo sintético de carga' } }));
    }
    if (escenario === 'cargando' && ruta.endsWith('/ofertas/sincronizacion')) return NEVER;
    let datos: unknown;
    if (ruta.endsWith('/scraping/previsualizacion')) datos = { plataformas: configuracion };
    else if (ruta.endsWith('/automatizacion/historial')) datos = escenario === 'vacio' ? [] : [{
        id: 48, tipo: 'ciclo_manual', inicio: '2026-01-15T18:00:00Z', fin: '2026-01-15T18:01:00Z',
        duracion_ms: 60000, estado: fuentes[0].estado, resumen: resultado,
    }];
    else if (ruta.endsWith('/automatizacion/estado')) datos = { activo: false, expresionCron: null,
        ultimaEjecucion: null, zonaHoraria: 'America/Argentina/Buenos_Aires',
        ultimoResultado: escenario === 'vacio' ? null : resultado };
    else if (ruta.endsWith('/automatizacion/progreso')) datos = { activo: false, porcentaje: cicloIniciado ? 100 : 0,
        pasos: cicloIniciado ? [{ nombre: 'linkedin', label: 'LinkedIn', estado: 'completada', extraidas: 3 }] : [] };
    else if (ruta.endsWith('/automatizacion/ejecutar')) { cicloIniciado = true; datos = { configuracion }; }
    else if (ruta.endsWith('/evaluacion/progreso')) datos = { ...progresoEvaluacion(), activo: escenario === 'cargando' && !evaluacionIniciada };
    else if (/\/evaluacion\/(ejecutar|reintentar-errores)$/.test(ruta)) {
        evaluacionIniciada = true;
        return of(new HttpResponse({ body: { exito: true, en_curso: true, cantidad: 4, mensaje: 'Evaluación sintética iniciada' } }));
    }
    else if (ruta.endsWith('/evaluacion/cancelar')) datos = null;
    else if (ruta.includes('/scraping/') && solicitud.method === 'POST') datos = {
        mensaje: 'Búsqueda sintética', plataforma: ruta.split('/').pop(), total_extraidas: 5,
        ofertas_nuevas: 3, ofertas_duplicadas: 0, fuente: fuentes[0], configuracion: configuracion[0],
    };
    else if (ruta.endsWith('/ofertas/sincronizacion')) return of(new HttpResponse({ body: {
        exito: true, datos: structuredClone(ofertas), total: ofertas.length, total_inicial: ofertas.length,
        max_id: 48, fecha_corte: '2026-01-15T18:00:00Z', cursor_siguiente: null, completada: true,
    } }));
    else if (ruta.endsWith('/ofertas')) datos = ofertas;
    else if (ruta.endsWith('/preferencias')) datos = { priorizar_ofertas_ia: false, bonus_maximo_prioridad_ia: 0 };
    else return throwError(() => new Error(`Solicitud no prevista por el fixture: ${solicitud.method} ${ruta}`));
    return of(new HttpResponse({ body: { exito: true, datos } }));
};

@Component({
    selector: 'app-root', imports: [Dashboard],
    template: `<header>Busco Trabajo · Entorno sintético E2E</header><app-dashboard />
        <details><summary>Registro del fixture</summary><output aria-label="Llamadas simuladas">{{ llamadas().join('\n') }}</output>
        <output aria-label="Cuerpos simulados">{{ cuerposJson() }}</output></details>
        @if (tabla) {
            <button type="button" (click)="refrescar()">Refrescar datos sintéticos</button>
            <button type="button" (click)="recortar()">Reducir datos sintéticos a 15</button>
        }`,
    styles: `:host { display: block; max-width: 1280px; margin: auto; padding: 24px; }
        header { font-family: var(--font-mono); margin-bottom: 24px; }
        output { display: block; white-space: pre-wrap; overflow-wrap: anywhere; }
        @media (max-width: 768px) { :host { padding: 16px; } }`,
})
class EscenarioDashboard {
    readonly llamadas = llamadas;
    readonly tabla = tabla;
    readonly dashboard = viewChild.required(Dashboard);
    cuerposJson(): string { return JSON.stringify(cuerpos()); }
    refrescar(): void { this.dashboard().cargarDatos(); }
    recortar(): void { httpTabla?.recortar(); this.refrescar(); }
}

if (['/preferencias', '/salida', '/cv'].includes(location.pathname)) {
    void import('./preferencias-fixture').then(fixture => fixture.iniciarPreferencias());
} else {
document.documentElement.classList.toggle('dark', parametros.get('tema') === 'oscuro');
bootstrapApplication(EscenarioDashboard, { providers: [
    provideNoopAnimations(),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: detalle || tabla ? '.dark' : 'none' } } }),
    provideHttpClient(withInterceptors([fixtureHttp])),
    { provide: DemoService, useValue: { esModoDemo: signal(false) } },
    { provide: PersistenciaDashboardService, useValue: {
        leerCache: () => null, guardarCache: () => {},
        limpiarSincronizacion: async () => { bloqueGuardado = []; },
        guardarBloqueSincronizacion: async (bloque: typeof ofertas) => {
            bloqueGuardado = bloque; return { fallback: false, total: bloque.length };
        },
        obtenerOfertasSincronizadas: async () => bloqueGuardado,
    } },
] }).catch(console.error);
}

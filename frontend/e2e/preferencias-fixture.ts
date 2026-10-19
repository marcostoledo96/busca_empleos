import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, RouterLink, RouterOutlet } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { NEVER, of, throwError } from 'rxjs';
import { Preferencias } from '../src/app/paginas/preferencias/preferencias';
import { cambiosCvGuard } from '../src/app/guards/cambios-cv.guard';
import { DemoService } from '../src/app/servicios/demo.service';
import { PerfilEfectivo, Preferencias as DatosPreferencias, PreferenciasActualizar } from '../src/app/modelos/preferencia.model';
import { ResultadoImportacionCv } from '../src/app/servicios/preferencias.service';

const parametros = new URLSearchParams(location.search);
const errores = new Set((parametros.get('error') || '').split(','));
const esperando = parametros.get('esperando');
const fecha = '2026-01-15T18:00:00.000Z';
const llamadas = signal<string[]>([]);
const textosAnalizados = signal<string[]>([]);
const textoExtraido = '# CV sintético extraído\n\nDesarrollo interfaces accesibles con Angular y TypeScript.\nReviso pruebas funcionales y documento resultados.\n';
let fuente = { cv_base: '# CV sintético\n\nDesarrollo aplicaciones con Angular, Node.js y PostgreSQL.\nPractico QA funcional y accesibilidad.\n', cv_base_actualizado_en: fecha };

let preferencias: DatosPreferencias = {
    id: 49, nombre: 'Candidatura sintética', nivel_experiencia: 'junior',
    perfil_profesional: 'Desarrollo interfaces accesibles y servicios web. Practico pruebas funcionales, documentación y trabajo en equipo en proyectos de aprendizaje.',
    idioma_candidato: 'Español nativo; inglés escrito intermedio y conversación básica.',
    stack_tecnologico: ['Angular', 'TypeScript', 'Node.js', 'PostgreSQL', 'PruebasDeAccesibilidadAutomatizadasConNombresExtensosParaComprobarDesbordes'],
    modalidad_aceptada: 'cualquiera', zonas_preferidas: ['CABA', 'GBA Oeste'],
    terminos_busqueda: ['frontend angular', 'qa manual', 'soporte it'], reglas_exclusion: ['Java', 'Senior', 'Más de tres años excluyentes'],
    prompt_personalizado: 'Valoro equipos con mentoría y prácticas de accesibilidad.', usar_prompt_personalizado: false,
    modelo_ia: 'deepseek-flash', modelo_ia_evaluacion: 'deepseek-flash', modelo_ia_importacion: 'deepseek-v4-pro',
    fecha_creacion: fecha, fecha_actualizacion: fecha,
    tecnologias_detalle: [
        { nombre: 'Angular', nivel: 'medio', categoria: 'frontend', importancia: 'principal', aliases: ['angular', 'angular 20'], evidencia: 'Proyecto sintético de interfaces accesibles con formularios y navegación.' },
        { nombre: 'TypeScript', nivel: 'medio', categoria: 'lenguaje', importancia: 'principal', aliases: ['ts'], evidencia: 'Servicios y componentes tipados.' },
        { nombre: 'Node.js', nivel: 'basico', categoria: 'backend', importancia: 'secundaria', aliases: ['node', 'nodejs'], evidencia: 'API de práctica con validación.' },
        { nombre: 'PostgreSQL', nivel: 'basico', categoria: 'base_de_datos', importancia: 'secundaria', aliases: ['postgres', 'pg'], evidencia: 'Consultas parametrizadas.' },
        { nombre: 'PruebasDeAccesibilidadAutomatizadasConNombresExtensosParaComprobarDesbordes', nivel: 'basico', categoria: 'testing', importancia: 'secundaria', aliases: ['auditorías de accesibilidad con navegación por teclado'], evidencia: 'Dato deliberadamente largo para revisar el ajuste del contenido.' },
        { nombre: 'Java', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['java'], evidencia: 'Sin experiencia declarada; exclusión confirmada.' },
    ],
    roles_objetivo_detalle: [
        { rol: 'Desarrollo frontend junior con foco en accesibilidad y sistemas de diseño', prioridad: 'alta', aliases: ['frontend angular', 'desarrollo de interfaces accesibles'], evidencia: 'Preferencia de búsqueda, no experiencia acreditada.' },
        { rol: 'QA manual y automatización de pruebas funcionales en aplicaciones web', prioridad: 'media', aliases: ['qa manual', 'tester funcional'], evidencia: 'Interés en calidad de software.' },
        { rol: 'SoporteDeAplicacionesEmpresarialesConNombreExtensoSinEspaciosParaRevisarOverflow', prioridad: 'baja', aliases: ['mesa de ayuda', 'help desk'], evidencia: 'Rol secundario solicitado.' },
    ],
    preguntas_perfil_pendientes: [{ id: 'pregunta-sintetica', campo: 'disponibilidad', pregunta: '¿Qué horarios preferís?', estado: 'nota', nota: 'Dato sintético para revisión manual.' }],
    disponibilidad: 'full_time', expectativa_salarial_min: 700000, expectativa_salarial_max: 1200000, moneda_salarial: 'ARS',
    nivel_ingles_detalle: { espanol: 'Nativo', reading: 'B1', writing: 'B1', speaking: 'A2', listening: 'A2', regla: 'No aceptar inglés oral avanzado excluyente.' },
    keywords_positivas: ['accesibilidad', 'mentoría', 'herramientas de IA'], keywords_negativas: ['guardias excluyentes'],
    plataformas_preferidas: ['linkedin', 'getonbrd'], plataformas_excluidas: [],
    max_caracteres_descripcion_ia: 2500, temperatura_evaluacion: 0, temperatura_importacion: 0,
    fecha_importacion_cv: fecha, anios_experiencia_reales: 1, nivel_real_seniority: 'Junior',
    conocimientos_ausentes: ['Java', 'Kubernetes'], limitaciones_explicitas: 'No acredito experiencia senior ni conversación avanzada en inglés.',
    priorizar_ofertas_ia: true, bonus_maximo_prioridad_ia: 6, filtrar_nivel_linkedin: true,
};

// Simulo la confirmación del servidor solamente al guardar; editar nunca cambia esta vista.
function confirmarPerfil(datos: DatosPreferencias): PerfilEfectivo {
    return {
        version: 1,
        candidato: {
            nombre: datos.nombre, nivel_real_seniority: datos.nivel_real_seniority ?? null,
            anios_experiencia_reales: datos.anios_experiencia_reales ?? null, perfil_profesional: datos.perfil_profesional,
            tecnologias_detalle: structuredClone(datos.tecnologias_detalle), stack_tecnologico: [...datos.stack_tecnologico],
            nivel_ingles_detalle: structuredClone(datos.nivel_ingles_detalle ?? null), idioma_candidato: datos.idioma_candidato,
            conocimientos_ausentes: [...(datos.conocimientos_ausentes ?? [])], limitaciones_explicitas: datos.limitaciones_explicitas ?? null,
        },
        restricciones: {
            preferencias: {
                roles_objetivo_detalle: structuredClone(datos.roles_objetivo_detalle), modalidad_aceptada: datos.modalidad_aceptada,
                zonas_preferidas: [...datos.zonas_preferidas], reglas_exclusion: [...datos.reglas_exclusion],
                disponibilidad: datos.disponibilidad ?? null, expectativa_salarial_min: datos.expectativa_salarial_min ?? null,
                expectativa_salarial_max: datos.expectativa_salarial_max ?? null, moneda_salarial: datos.moneda_salarial ?? null,
                keywords_positivas: datos.keywords_positivas ?? [], keywords_negativas: datos.keywords_negativas ?? [],
                plataformas_preferidas: datos.plataformas_preferidas ?? [], plataformas_excluidas: datos.plataformas_excluidas ?? [],
            },
            politicas_sistema: ['Excluir Java requerido.', 'Excluir Senior, SR o Lead y más de tres años excluyentes.', 'El bonus IA no compensa exclusiones de idioma o ubicación.'],
        },
        secciones: [{ id: 'perfil', titulo: 'Perfil confirmado sintético', texto: datos.perfil_profesional ?? '' }],
        texto: `Perfil confirmado sintético: ${datos.nombre}. ${datos.perfil_profesional}`,
    };
}
preferencias.perfil_efectivo = confirmarPerfil(preferencias);

const analisis: Partial<ResultadoImportacionCv> = {
    nombre: 'Candidatura propuesta por análisis sintético', nivel_experiencia: 'junior',
    perfil_profesional: 'Desarrollo interfaces y reviso pruebas. Este texto es una propuesta sin guardar.',
    idioma_candidato: 'Español nativo; inglés a confirmar.',
    tecnologias_detalle: [{ nombre: 'Docker', nivel: 'ninguno', categoria: 'herramienta', importancia: 'secundaria', aliases: ['contenedores'], evidencia: 'Mención sintética pendiente de revisión.' }],
    roles_objetivo_detalle: [{ rol: 'QA junior propuesto (no se aplica automáticamente)', prioridad: 'media', aliases: ['tester'] }],
    terminos_busqueda: ['qa junior'], reglas_exclusion: [], keywords_positivas: ['soporte de aplicaciones'],
    preguntas: [
        { campo: 'docker', pregunta: '¿Confirmás conocimientos básicos de Docker?', motivo: 'La mención no acredita nivel.', sugerencia: 'Cambiar únicamente Docker a básico.' },
        { campo: 'salario', pregunta: '¿Querés quitar el filtro salarial?', sugerencia: 'Quitar únicamente el filtro salarial.' },
        { campo: 'experiencia', pregunta: '¿Qué tareas realizaste en el proyecto?', motivo: 'Necesito evidencia antes de confirmar experiencia.' },
    ],
    advertencias: ['Análisis simulado: no consulté DeepSeek ni guardé datos.'],
};

const fixtureHttp: HttpInterceptorFn = solicitud => {
    const ruta = new URL(solicitud.url, location.origin).pathname.replace(/^.*\/api/, '');
    llamadas.update(actuales => [...actuales, `${solicitud.method} ${ruta}`]);
    const responder = (datos: unknown, cambio = false) => of(new HttpResponse({
        body: { exito: true, datos: structuredClone(datos), ...(cambio ? { cambio_criterios: true } : {}) },
    }));
    const fallar = (mensaje: string) => throwError(() => new HttpErrorResponse({ status: 503, error: { error: mensaje } }));
    const operacion = ruta === '/preferencias' ? (solicitud.method === 'GET' ? 'preferencias-carga' : 'guardar') :
        ruta === '/preferencias/cv-base' ? (solicitud.method === 'GET' ? 'cv-carga' : 'cv-guardar') :
        ruta.endsWith('/extraer-texto') ? 'extraer' : ruta.endsWith('/analizar') ? 'analizar' : 'desconocida';
    if (esperando === operacion) return NEVER;
    if (errores.has(operacion)) return fallar(`No pude completar ${operacion}: error sintético recuperable.`);
    if (ruta === '/preferencias' && solicitud.method === 'GET') return responder(preferencias);
    if (ruta === '/preferencias' && solicitud.method === 'PUT') {
        preferencias = { ...preferencias, ...structuredClone(solicitud.body as PreferenciasActualizar), fecha_actualizacion: fecha };
        preferencias.perfil_efectivo = confirmarPerfil(preferencias);
        return responder(preferencias, true);
    }
    if (ruta === '/preferencias/cv-base' && solicitud.method === 'GET') return responder(fuente);
    if (ruta === '/preferencias/cv-base' && solicitud.method === 'PUT') {
        fuente = { cv_base: solicitud.body as string, cv_base_actualizado_en: fecha };
        return responder(fuente);
    }
    if (ruta === '/preferencias/importar-cv/extraer-texto' && solicitud.method === 'POST') {
        const archivo = (solicitud.body as FormData).get('cv') as File;
        // No parseo documentos reales: ambos formatos devuelven el mismo texto sintético completo.
        return responder({ texto: textoExtraido, formato: archivo.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'md' });
    }
    if (ruta === '/preferencias/importar-cv/analizar' && solicitud.method === 'POST') {
        const archivo = (solicitud.body as FormData).get('cv') as File;
        void archivo.text().then(texto => textosAnalizados.update(actuales => [...actuales, texto]));
        return responder(errores.has('revision') ? { ...analisis, preguntas: null } : analisis);
    }
    if (ruta === '/evaluacion/resetear' && solicitud.method === 'POST') return responder({ reseteadas: 3 });
    // Nunca delego al siguiente interceptor: una ruta no prevista tampoco puede salir a la red.
    return fallar(`Solicitud no prevista por el fixture: ${solicitud.method} ${ruta}`);
};

@Component({
    selector: 'app-salida-fixture',
    template: '<h2>Salida sintética de Preferencias</h2><p>No abro servicios ni datos productivos.</p>',
})
class SalidaFixture {}

@Component({
    selector: 'app-root', imports: [RouterOutlet, RouterLink],
    template: `<header>Busco Trabajo · Preferencias sintéticas E2E
        <nav aria-label="Navegación del fixture">
            <a routerLink="/preferencias" [queryParams]="consulta">Volver a Preferencias (fixture)</a> ·
            <a routerLink="/salida" [queryParams]="consulta">Salir de Preferencias (fixture)</a>
        </nav></header>
        <router-outlet />
        <details><summary>Registro del fixture</summary><output aria-label="Llamadas simuladas">{{ llamadas().join('\n') }}</output>
            <output aria-label="Textos analizados simulados">{{ textosAnalizados().join('\n---\n') }}</output></details>`,
    styles: `:host { display: block; max-width: 1280px; margin: auto; padding: 24px; }
        header { font-family: var(--font-mono); margin-bottom: 24px; }
        output { display: block; white-space: pre-wrap; overflow-wrap: anywhere; }
        @media (max-width: 768px) { :host { padding: 16px; } }`,
})
class EscenarioPreferencias {
    readonly llamadas = llamadas;
    readonly textosAnalizados = textosAnalizados;
    readonly consulta = Object.fromEntries(parametros);
}

export function iniciarPreferencias(): void {
    document.documentElement.classList.toggle('dark', parametros.get('tema') === 'oscuro');
    bootstrapApplication(EscenarioPreferencias, { providers: [
        provideNoopAnimations(),
        providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.dark' } } }),
        provideHttpClient(withInterceptors([fixtureHttp])),
        provideRouter([
            { path: 'preferencias', component: Preferencias, canDeactivate: [cambiosCvGuard] },
            { path: 'salida', component: SalidaFixture },
            { path: 'cv', component: SalidaFixture },
            { path: '', component: SalidaFixture, pathMatch: 'full' },
        ]),
        { provide: DemoService, useValue: { esModoDemo: signal(false) } },
    ] }).catch(console.error);
}

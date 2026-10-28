import { Component, inject, signal, OnInit, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PreferenciasService, ResultadoImportacionCv } from '../../servicios/preferencias.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { Preferencias as PreferenciasModel, PreferenciasActualizar, PerfilEfectivo, PreguntaPerfil, ModeloDeepSeek, normalizarModeloDeepSeek } from '../../modelos/preferencia.model';
import { DemoService } from '../../servicios/demo.service';
import { obtenerOpcionesPreferenciaPlataforma } from '../../config/plataformas';

// PrimeNG
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { MultiSelect } from 'primeng/multiselect';
import { AutoComplete } from 'primeng/autocomplete';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Toast } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';

type PreguntaImportacion = PreguntaPerfil;

const EQUIVALENCIAS_SUGERIDAS_PREFERENCIAS: Record<string, string[]> = {
    'qa manual': ['tester manual'],
    'tester manual': ['qa manual'],
    'soporte it': ['mesa de ayuda', 'help desk'],
    'mesa de ayuda': ['soporte it', 'help desk'],
    'help desk': ['soporte it', 'mesa de ayuda'],
    'frontend angular': ['desarrollador angular'],
    'desarrollador angular': ['frontend angular'],
    'angular': ['frontend angular'],
    'c#': ['c sharp', '.net'],
    'c sharp': ['c#', '.net'],
    '.net': ['c#', 'c sharp'],
};

@Component({
    selector: 'app-preferencias',
    imports: [
        FormsModule,
        NgTemplateOutlet,
        RouterLink,
        InputText,
        Textarea,
        Select,
        MultiSelect,
        AutoComplete,
        ToggleSwitch,
        Toast,
        TabsModule,
    ],
    providers: [MessageService],
    templateUrl: './preferencias.html',
    styleUrl: './preferencias.css'
})
export class Preferencias implements OnInit {

    private readonly servicio = inject(PreferenciasService);
    private readonly evaluacionService = inject(EvaluacionService);
    private readonly mensajes = inject(MessageService);
    private readonly demoService = inject(DemoService);

    readonly modoDemo = this.demoService.esModoDemo;

    // Estado de carga y guardado.
    cargando = signal(true);
    guardando = signal(false);

    // Estado para el reseteo de evaluaciones.
    diasReset = signal<number | null>(null);
    reseteando = signal(false);

    // Mensaje accesible para lectores de pantalla (aria-live).
    readonly mensajeAccesible = signal('');
    readonly perfilCambio = signal(false);

    perfilEfectivo: PerfilEfectivo | null = null;
    private formularioGuardado = '';
    private tecnologiasEditadas = false;
    private rolesEditados = false;

    get cambiosSinGuardar(): boolean {
        return this.tecnologiasEditadas || this.rolesEditados ||
            (this.formularioGuardado !== '' && JSON.stringify(this.datosFormulario()) !== this.formularioGuardado);
    }

    // Inicializo los hechos sin afirmar información personal no confirmada.
    nombre = '';
    nivelExperiencia: PreferenciasModel['nivel_experiencia'] | undefined;
    perfilProfesional = '';
    idiomaCandidato = '';
    stackTecnologico: string[] = [];
    modalidadAceptada: PreferenciasModel['modalidad_aceptada'] = 'cualquiera';
    zonasPreferidas: string[] = [];
    terminosBusqueda: string[] = [];
    reglasExclusion: string[] = [];
    promptPersonalizado = '';
    usarPromptPersonalizado = false;
    modeloIa: ModeloDeepSeek = 'deepseek-flash';
    modeloIaEvaluacion: ModeloDeepSeek = 'deepseek-flash';
    modeloIaImportacion: ModeloDeepSeek = 'deepseek-v4-pro';
    priorizarOfertasIa = false;
    bonusMaximoPrioridadIa = 6;
    filtrarNivelLinkedin = true;
    disponibilidad: 'full_time' | 'part_time' | 'freelance' | 'a_coordinar' = 'full_time';
    expectativaSalarialMin: number | null = null;
    expectativaSalarialMax: number | null = null;
    monedaSalarial: 'ARS' | 'USD' | 'NO_FILTRAR' = 'NO_FILTRAR';
    nivelInglesDetalle: NonNullable<PreferenciasModel['nivel_ingles_detalle']> = {};
    keywordsPositivas: string[] = [];
    keywordsNegativas: string[] = [];
    plataformasPreferidas: string[] = [];
    plataformasExcluidas: string[] = [];
    maxCaracteresDescripcionIa = 2500;
    temperaturaEvaluacion = 0;
    temperaturaImportacion = 0;
    fechaImportacionCv: string | null = null;
    aniosExperienciaReales: number | null = null;
    tabActiva = signal(0);
    nivelRealSeniority = '';
    conocimientosAusentes: string[] = [];
    limitacionesExplicitas = '';

    // Perfil detallado: tecnologías con niveles y categorías.
    tecnologiasDetalle: Array<{ nombre: string; nivel: string; categoria: string; importancia: string; aliases: string[]; evidencia?: string }> = [];
    rolesObjetivoDetalle: Array<{ rol: string; prioridad: string; aliases: string[]; evidencia?: string }> = [];
    // scoringConfig fue eliminado en B1 (deprecación de scoring previo).
    // La evaluación ahora usa DeepSeek directo + reglas-exclusion, sin scoring previo.

    // Mantengo la fuente separada del formulario y del borrador extraído.
    cvBaseTexto = '';
    cvBaseGuardado: string | null = null;
    cvBaseFecha: string | null = null;
    cvBaseCargado = false;
    cargandoCvBase = signal(true);
    guardandoCvBase = signal(false);
    leyendoCvBase = signal(false);
    errorCargaCvBase = '';
    errorCvBase = '';
    private cvBaseEditado = false;
    private cvBaseExito = false;

    get cambiosImportacionPendientes(): boolean {
        return !this.importacionAplicada && !!(this.textoCvImportacion.trim() || this.resultadoImportacion ||
            this.archivoCvSeleccionado || this.analizandoCv() || this.extrayendoCv());
    }

    get cambiosCvPendientes(): boolean {
        return this.cvBaseCargado && (this.cvBaseGuardado === null
            ? this.cvBaseEditado || this.cvBaseTexto !== '' : this.cvBaseTexto !== this.cvBaseGuardado);
    }

    get estadoCvBase(): string {
        if (this.guardandoCvBase()) return 'Guardando';
        if (this.errorCvBase) return 'Error al guardar';
        if (this.cambiosCvPendientes) return 'Cambios pendientes';
        return this.cvBaseExito ? 'Guardado correctamente' : 'Sin cambios';
    }

    editarCvBase(texto: string): void {
        this.cvBaseTexto = texto;
        this.cvBaseEditado = true;
        this.cvBaseExito = false;
        this.errorCvBase = '';
    }

    @HostListener('window:beforeunload', ['$event'])
    advertirSalidaCv(evento: BeforeUnloadEvent): void {
        if (!this.cambiosSinGuardar && !this.cambiosCvPendientes && !this.cambiosImportacionPendientes && !this.guardandoCvBase()) return;
        evento.preventDefault();
        evento.returnValue = '';
    }

    cargarCvBase(): void {
        if (this.modoDemo() || this.guardandoCvBase() || this.cambiosCvPendientes) return;
        this.cargandoCvBase.set(true);
        this.errorCargaCvBase = '';
        const textoInicial = this.cvBaseTexto;
        this.servicio.obtenerCvBase().subscribe({
            next: respuesta => {
                this.cargandoCvBase.set(false);
                if (!respuesta.exito || !respuesta.datos ||
                    !(respuesta.datos.cv_base === null || typeof respuesta.datos.cv_base === 'string') ||
                    !(respuesta.datos.cv_base_actualizado_en === null || typeof respuesta.datos.cv_base_actualizado_en === 'string')) {
                    this.errorCargaCvBase = 'No pude cargar el CV base. Reintentá la carga antes de editar.';
                    return;
                }
                this.cvBaseGuardado = respuesta.datos.cv_base;
                this.cvBaseFecha = respuesta.datos.cv_base_actualizado_en;
                // Conservo incluso ediciones programáticas realizadas mientras esperaba la carga.
                if (this.cvBaseTexto === textoInicial && !this.cvBaseEditado) {
                    this.cvBaseTexto = respuesta.datos.cv_base ?? '';
                }
                this.cvBaseCargado = true;
            },
            error: () => {
                this.cargandoCvBase.set(false);
                this.errorCargaCvBase = 'No pude cargar el CV base. Reintentá la carga antes de editar.';
            },
        });
    }

    private validarTextoCv(texto: string): string {
        if (texto.includes('\u0000')) return 'El CV no puede contener caracteres NUL.';
        if (new TextEncoder().encode(texto).byteLength > 1048576) return 'El CV no puede superar 1 MiB en UTF-8.';
        // Rechazo sustitutos sueltos: codificarlos en UTF-8 perdería información.
        if (new TextDecoder('utf-8', { ignoreBOM: true }).decode(new TextEncoder().encode(texto)) !== texto) {
            return 'El CV debe contener texto UTF-8 válido.';
        }
        return '';
    }

    guardarFuenteCv(): void {
        if (!this.cvBaseCargado || this.modoDemo() || this.guardandoCvBase() || this.leyendoCvBase() || this.cargandoCvBase()) return;
        const texto = this.cvBaseTexto;
        this.errorCvBase = this.validarTextoCv(texto);
        if (this.errorCvBase) return;
        this.guardandoCvBase.set(true);
        this.cvBaseExito = false;
        this.servicio.guardarCvBase(texto).subscribe({
            next: respuesta => {
                this.guardandoCvBase.set(false);
                if (!respuesta.exito || !respuesta.datos || respuesta.datos.cv_base !== texto ||
                    typeof respuesta.datos.cv_base_actualizado_en !== 'string') {
                    this.errorCvBase = 'No pude confirmar el guardado. Reintentá sin cerrar el editor.';
                    return;
                }
                this.cvBaseGuardado = texto;
                this.cvBaseFecha = respuesta.datos.cv_base_actualizado_en;
                this.cvBaseEditado = this.cvBaseTexto !== texto;
                this.cvBaseExito = !this.cambiosCvPendientes;
            },
            error: () => {
                this.guardandoCvBase.set(false);
                this.errorCvBase = 'No pude guardar el CV base. Conservé el texto; reintentá.';
            },
        });
    }

    usarArchivoComoCvBase(): void {
        if (!this.cvBaseCargado || this.modoDemo() || this.guardandoCvBase() || this.cargandoCvBase()) return;
        const texto = this.textoCvImportacion;
        this.errorTextoCv = this.validarTextoCv(texto);
        if (this.errorTextoCv || !texto.trim()) return;
        if (this.cambiosCvPendientes && !window.confirm('¿Reemplazar los cambios pendientes del CV base con el texto revisado?')) return;
        this.editarCvBase(texto);
    }

    analizarFuenteCv(): void {
        if (!this.cvBaseCargado || this.modoDemo() || this.guardandoCvBase() || this.leyendoCvBase() || this.guardando() || this.analizandoCv() || this.cargandoCvBase()) return;
        const texto = this.cvBaseTexto;
        const error = this.validarTextoCv(texto);
        if (error || !texto.trim()) {
            this.mensajes.add({ severity: 'warn', summary: 'CV inválido', detail: error || 'Escribí el CV antes de analizar.' });
            return;
        }
        this.tabActiva.set(5);
        this.ejecutarAnalisisCv(new File([texto], 'cv-base.md', { type: 'text/markdown' }));
    }

    // Mantengo el documento y el texto temporal separados de la fuente persistida.
    archivoCvSeleccionado: File | null = null;
    textoCvImportacion = '';
    extrayendoCv = signal(false);
    errorExtraccionCv = '';
    errorAnalisisCv = '';
    errorTextoCv = '';
    textoExtraidoCv = false;
    textoRevisadoCv = false;
    importacionAplicada = false;

    get estadoImportacion(): string {
        if (this.importacionAplicada) return this.cambiosSinGuardar
            ? 'Perfil revisado → Cambios aplicados al formulario, sin guardar. Elegí Guardar preferencias.'
            : 'Perfil revisado → Cambios aplicados. Preferencias guardadas.';
        if (this.analizandoCv()) return 'Texto revisado → Analizando con IA…';
        if (this.resultadoImportacion) return 'Análisis completado → Perfil pendiente de revisión. Revisá antes de aplicar.';
        if (this.extrayendoCv()) return 'Extrayendo texto, sin IA…';
        if (this.textoRevisadoCv) return 'Texto revisado. El análisis requiere confirmación explícita.';
        if (this.textoExtraidoCv) return 'Texto extraído. Revisá el borrador completo antes de analizar.';
        return 'Borrador temporal. Seleccioná un documento o pegá texto manualmente.';
    }
    analizandoCv = signal(false);
    private solicitudCv = 0;
    resultadoImportacion: Partial<ResultadoImportacionCv> | null = null;
    preguntasImportacion: PreguntaImportacion[] = [];
    preguntasPerfilPendientes: PreguntaImportacion[] = [];
    // Registro únicamente decisiones explícitas sobre preferencias protegidas.
    preferenciasRevisadas = new Set<string>();

    // Sugerencias para los AutoComplete en modo entrada libre.
    sugerencias: string[] = [];

    // Opciones para los selects.
    opcionesNivel = [
        { label: 'Trainee', value: 'trainee' },
        { label: 'Junior', value: 'junior' },
        { label: 'Semi-Senior', value: 'semi-senior' },
    ];

    opcionesModalidad = [
        { label: 'Cualquiera', value: 'cualquiera' },
        { label: 'Remoto', value: 'remoto' },
        { label: 'Híbrido', value: 'hibrido' },
        { label: 'Presencial', value: 'presencial' },
    ];

    opcionesZonas = [
        { label: 'CABA', value: 'CABA' },
        { label: 'GBA Oeste', value: 'GBA Oeste' },
        { label: 'GBA Norte', value: 'GBA Norte' },
        { label: 'GBA Sur', value: 'GBA Sur' },
        { label: 'Interior', value: 'Interior' },
    ];

    // Solo modelos DeepSeek compatibles con la API configurada.
    // Los modelos legacy (deepseek-chat, deepseek-reasoner) y de otros
    // proveedores (kimi, glm, qwen, mimo) requieren endpoints distintos
    // que todavía no están integrados en este servicio.
    opcionesModelo = [
        { label: 'DeepSeek Flash', value: 'deepseek-flash' },
        { label: 'DeepSeek V4 Pro (potente)', value: 'deepseek-v4-pro' },
    ];

    opcionesModeloImportacion = [
        { label: 'DeepSeek V4 Pro', value: 'deepseek-v4-pro' },
        { label: 'DeepSeek Flash', value: 'deepseek-flash' },
    ];

    opcionesNivelTecnologia = [
        { label: 'Ninguno', value: 'ninguno' },
        { label: 'Básico', value: 'basico' },
        { label: 'Medio', value: 'medio' },
        { label: 'Avanzado', value: 'avanzado' },
    ];

    opcionesCategoriaTecnologia = [
        { label: 'Frontend', value: 'frontend' },
        { label: 'Backend', value: 'backend' },
        { label: 'Base de datos', value: 'base_de_datos' },
        { label: 'Lenguaje', value: 'lenguaje' },
        { label: 'Testing', value: 'testing' },
        { label: 'Herramienta', value: 'herramienta' },
        { label: 'Metodología', value: 'metodologia' },
        { label: 'Cloud', value: 'cloud' },
        { label: 'Otro', value: 'otro' },
    ];

    opcionesPrioridadRol = [
        { label: 'Alta', value: 'alta' },
        { label: 'Media', value: 'media' },
        { label: 'Baja', value: 'baja' },
    ];

    opcionesImportanciaTecnologia = [
        { label: 'Principal', value: 'principal' },
        { label: 'Secundaria', value: 'secundaria' },
        { label: 'Penalizable', value: 'penalizable' },
        { label: 'No prioritaria', value: 'no_prioritaria' },
    ];

    opcionesDisponibilidad = [
        { label: 'Full time', value: 'full_time' },
        { label: 'Part time', value: 'part_time' },
        { label: 'Freelance', value: 'freelance' },
        { label: 'A coordinar', value: 'a_coordinar' },
    ];

    opcionesMonedaSalarial = [
        { label: 'No filtrar', value: 'NO_FILTRAR' },
        { label: 'ARS', value: 'ARS' },
        { label: 'USD', value: 'USD' },
    ];

    // Opciones de plataformas para preferencias (solo activas).
    // Sale del registry, usa el id interno como valor.
    opcionesPlataformas = obtenerOpcionesPreferenciaPlataforma();

    private crearTecnologiasSugeridas(): Array<{ nombre: string; nivel: string; categoria: string; importancia: string; aliases: string[]; evidencia?: string }> {
        return [
            { nombre: 'Angular 20', nivel: 'avanzado', categoria: 'frontend', importancia: 'principal', aliases: ['angular', 'angular 20'], evidencia: 'Portfolio, IFTS 26, Busca Empleos AI' },
            { nombre: 'Node.js', nivel: 'avanzado', categoria: 'backend', importancia: 'principal', aliases: ['node', 'node.js', 'nodejs'], evidencia: 'AeroTest, Busca Empleos AI, SanPa Holmes' },
            { nombre: 'PostgreSQL', nivel: 'avanzado', categoria: 'base_de_datos', importancia: 'principal', aliases: ['postgresql', 'postgres', 'pg'], evidencia: 'AeroTest, Busca Empleos AI, SanPa Holmes' },
            { nombre: 'TypeScript', nivel: 'avanzado', categoria: 'lenguaje', importancia: 'principal', aliases: ['typescript', 'ts'], evidencia: 'Angular, Node, Busca Empleos AI' },
            { nombre: 'JavaScript', nivel: 'avanzado', categoria: 'lenguaje', importancia: 'principal', aliases: ['javascript', 'js'], evidencia: 'Proyectos web y frontend' },
            { nombre: 'QA Manual', nivel: 'avanzado', categoria: 'testing', importancia: 'principal', aliases: ['qa manual', 'qa tester', 'testing funcional'], evidencia: '+80 bugs documentados en AeroTest' },
            { nombre: 'React', nivel: 'medio', categoria: 'frontend', importancia: 'principal', aliases: ['react', 'react.js', 'reactjs'], evidencia: 'SanPa Holmes y proyectos frontend' },
            { nombre: 'C#', nivel: 'medio', categoria: 'lenguaje', importancia: 'secundaria', aliases: ['c#', 'c sharp', 'csharp'], evidencia: 'Grupo Scout San Patricio' },
            { nombre: 'SQL Server', nivel: 'medio', categoria: 'base_de_datos', importancia: 'secundaria', aliases: ['sql server', 'mssql'], evidencia: 'Grupo Scout San Patricio' },
            { nombre: 'Java', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['java'], evidencia: 'Regla de exclusión estricta' },
            { nombre: 'Spring Boot', nivel: 'ninguno', categoria: 'backend', importancia: 'penalizable', aliases: ['spring boot', 'springboot'], evidencia: 'Regla de exclusión estricta' },
            { nombre: 'React Native', nivel: 'basico', categoria: 'mobile', importancia: 'no_prioritaria', aliases: ['react native'], evidencia: 'No priorizar ofertas mobile' },
            { nombre: 'Kotlin', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['kotlin'], evidencia: 'Regla de exclusión' },
            { nombre: 'Go', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['go', 'golang'], evidencia: 'Regla de exclusión' },
            { nombre: 'Python', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['python'], evidencia: 'Regla de exclusión' },
            { nombre: 'PHP', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['php'], evidencia: 'Regla de exclusión' },
            { nombre: 'Ruby', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['ruby', 'rails'], evidencia: 'Regla de exclusión' },
            { nombre: 'Swift', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['swift'], evidencia: 'Regla de exclusión' },
            { nombre: 'AWS', nivel: 'ninguno', categoria: 'cloud', importancia: 'penalizable', aliases: ['aws', 'amazon web services'], evidencia: 'Regla de exclusión' },
            { nombre: 'MongoDB', nivel: 'ninguno', categoria: 'base_de_datos', importancia: 'penalizable', aliases: ['mongodb', 'mongo'], evidencia: 'Regla de exclusión' },
            { nombre: 'GraphQL', nivel: 'ninguno', categoria: 'backend', importancia: 'penalizable', aliases: ['graphql'], evidencia: 'Regla de exclusión' },
            { nombre: 'Kubernetes', nivel: 'ninguno', categoria: 'cloud', importancia: 'penalizable', aliases: ['kubernetes', 'k8s'], evidencia: 'Regla de exclusión' },
        ];
    }

    private crearRolesSugeridos(): Array<{ rol: string; prioridad: string; aliases: string[]; evidencia?: string }> {
        return [
            { rol: 'QA Manual Jr', prioridad: 'alta', aliases: ['qa manual', 'qa tester', 'testing funcional'], evidencia: 'Rol principal buscado' },
            { rol: 'Frontend Developer Jr', prioridad: 'alta', aliases: ['frontend', 'angular developer', 'react developer'], evidencia: 'Rol principal buscado' },
            { rol: 'Full Stack Developer Jr', prioridad: 'media', aliases: ['full stack', 'fullstack', 'node developer'], evidencia: 'Rol secundario buscado' },
            { rol: 'Soporte IT / Aplicaciones', prioridad: 'media', aliases: ['soporte it', 'soporte de aplicaciones', 'help desk'], evidencia: 'Rol secundario buscado' },
        ];
    }

    get equivalenciasSugeridasDisponibles(): Array<{ terminoOrigen: string; sugerencia: string }> {
        const resultado: Array<{ terminoOrigen: string; sugerencia: string }> = [];
        const terminosActuales = (this.terminosBusqueda || []).map(t => t.trim().toLowerCase());
        const vistos = new Set<string>();

        for (const termino of this.terminosBusqueda || []) {
            const normalizado = termino.trim().toLowerCase();
            const sugerencias = EQUIVALENCIAS_SUGERIDAS_PREFERENCIAS[normalizado] || [];
            for (const sug of sugerencias) {
                const sugNorm = sug.toLowerCase();
                if (!terminosActuales.includes(sugNorm) && !vistos.has(sugNorm)) {
                    vistos.add(sugNorm);
                    resultado.push({ terminoOrigen: termino, sugerencia: sug });
                }
            }
        }
        return resultado;
    }

    agregarTerminoSugerido(sugerencia: string): void {
        const normalizada = sugerencia.trim().toLowerCase();
        if (!this.terminosBusqueda.some(t => t.trim().toLowerCase() === normalizada)) {
            this.terminosBusqueda = [...this.terminosBusqueda, sugerencia];
        }
    }

    ngOnInit(): void {
        if (this.demoService.esModoDemo()) {
            this.cargarPreferenciasMockup();
            this.cargandoCvBase.set(false);
            return;
        }
        this.cargarPreferencias();
        this.cargarCvBase();
    }

    // En modo entrada libre, devuelvo el texto escrito como sugerencia
    // para que el usuario lo confirme con Enter o clic.
    // Si el campo está vacío, no muestro nada.
    filtrarLibre(event: { query: string }): void {
        const texto = event.query.trim();
        this.sugerencias = texto ? [texto] : [];
    }

    // Carga un perfil de ejemplo para el modo demo.
    // Los datos son ficticios y representan un perfil típico de dev junior argentino.
    private cargarPreferenciasMockup(): void {
        this.nombre = 'Dev Jr. Argentina';
        this.nivelExperiencia = 'junior';
        this.perfilProfesional = 'Desarrollador junior con experiencia en frontend (Angular, React), backend (Node.js, Express, C#/.NET) y QA testing manual y automatizado. Busco primera experiencia formal o una oportunidad de crecimiento en equipo tech.';
        this.idiomaCandidato = 'Español nativo, Inglés básico oral / intermedio escrito';
        this.stackTecnologico = ['TypeScript', 'Angular', 'React', 'Node.js', 'Express', 'C#', 'ASP.NET', 'PostgreSQL', 'SQL Server', 'HTML5', 'CSS3', 'React Native'];
        this.modalidadAceptada = 'cualquiera';
        this.zonasPreferidas = ['CABA', 'GBA Oeste', 'GBA Norte'];
        this.terminosBusqueda = ['Angular developer junior', 'Frontend developer', 'QA Tester Jr', 'Node.js junior', '.NET junior', 'Soporte IT', 'Help Desk Jr'];
        this.reglasExclusion = ['Java', 'Spring Boot', 'PHP', 'Ruby', 'COBOL', 'Kotlin'];
        this.promptPersonalizado = '';
        this.usarPromptPersonalizado = false;
        this.modeloIa = 'deepseek-flash';
        this.modeloIaEvaluacion = 'deepseek-flash';
        this.modeloIaImportacion = 'deepseek-v4-pro';
        this.disponibilidad = 'full_time';
        this.monedaSalarial = 'NO_FILTRAR';
        this.aniosExperienciaReales = 1;
        this.keywordsPositivas = ['healthtech', 'angular', 'frontend'];
        this.keywordsNegativas = ['java', 'cableado', 'soporte hardware'];
        this.plataformasPreferidas = ['linkedin', 'getonbrd'];
        this.plataformasExcluidas = [];
        this.filtrarNivelLinkedin = true;
        this.tecnologiasDetalle = this.crearTecnologiasSugeridas();
        this.rolesObjetivoDetalle = this.crearRolesSugeridos();
        this.cargando.set(false);
    }

    cargarPreferencias(): void {
        this.cargando.set(true);
        this.servicio.obtenerPreferencias().subscribe({
            next: (respuesta) => {
                if (respuesta.exito && respuesta.datos) {
                    this.mapearDesdeApi(respuesta.datos);
                }
                this.cargando.set(false);
            },
            error: () => {
                this.mensajeAccesible.set('No se pudieron cargar las preferencias.');
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar las preferencias.',
                });
                this.cargando.set(false);
            }
        });
    }

    private datosFormulario(): PreferenciasActualizar {
        const stackDerivado = this.tecnologiasDetalle
            .filter(tech => tech.nivel !== 'ninguno')
            .map(tech => tech.nombre)
            .filter((nombre, index, arr) => nombre && nombre.trim() && arr.indexOf(nombre) === index);

        return {
            nombre: this.nombre,
            nivel_experiencia: this.nivelExperiencia,
            perfil_profesional: this.perfilProfesional,
            idioma_candidato: this.idiomaCandidato,
            stack_tecnologico: stackDerivado,
            modalidad_aceptada: this.modalidadAceptada,
            zonas_preferidas: this.zonasPreferidas,
            terminos_busqueda: this.terminosBusqueda,
            reglas_exclusion: this.reglasExclusion,
            prompt_personalizado: this.promptPersonalizado,
            usar_prompt_personalizado: this.usarPromptPersonalizado,
            modelo_ia: this.modeloIa,
            priorizar_ofertas_ia: this.priorizarOfertasIa,
            bonus_maximo_prioridad_ia: this.bonusMaximoPrioridadIa,
            filtrar_nivel_linkedin: this.filtrarNivelLinkedin,
            tecnologias_detalle: this.tecnologiasDetalle as any,
            roles_objetivo_detalle: this.rolesObjetivoDetalle as any,
            // scoring_config eliminado en B1: ya no se envía al backend.
            preguntas_perfil_pendientes: this.preguntasPerfilPendientes as any,
            modelo_ia_evaluacion: this.modeloIaEvaluacion,
            modelo_ia_importacion: this.modeloIaImportacion,
            disponibilidad: this.disponibilidad,
            expectativa_salarial_min: this.expectativaSalarialMin,
            expectativa_salarial_max: this.expectativaSalarialMax,
            moneda_salarial: this.monedaSalarial,
            nivel_ingles_detalle: this.nivelInglesDetalle as any,
            keywords_positivas: this.keywordsPositivas,
            keywords_negativas: this.keywordsNegativas,
            plataformas_preferidas: this.plataformasPreferidas,
            plataformas_excluidas: this.plataformasExcluidas,
            max_caracteres_descripcion_ia: this.maxCaracteresDescripcionIa,
            temperatura_evaluacion: this.temperaturaEvaluacion,
            temperatura_importacion: this.temperaturaImportacion,
            anios_experiencia_reales: this.aniosExperienciaReales,
            nivel_real_seniority: this.nivelRealSeniority,
            conocimientos_ausentes: this.conocimientosAusentes,
            limitaciones_explicitas: this.limitacionesExplicitas,
            fecha_importacion_cv: this.fechaImportacionCv,
        };
    }

    guardar(): void {
        if (this.modoDemo() || this.guardando() || this.analizandoCv()) return;
        this.guardando.set(true);
        // Congelo también listas y objetos: los controles siguen disponibles durante el PUT.
        const formulario = structuredClone(this.datosFormulario());
        const anterior = this.formularioGuardado ? JSON.parse(this.formularioGuardado) : null;
        // Envío solo cambios: un control vacío no materializa un dato ausente persistido.
        const datos: PreferenciasActualizar = Object.fromEntries(Object.entries(formulario).filter(([campo, valor]) =>
            anterior === null || JSON.stringify(valor) !== JSON.stringify(anterior[campo]) ||
            (this.tecnologiasEditadas && ['tecnologias_detalle', 'stack_tecnologico'].includes(campo)) ||
            (this.rolesEditados && campo === 'roles_objetivo_detalle')
        ));
        if (datos.tecnologias_detalle !== undefined) {
            datos.stack_tecnologico = formulario.stack_tecnologico;
        }
        // null expresa borrado explícito del resumen; una cadena vacía no es un idioma válido.
        if (typeof datos.idioma_candidato === 'string' && !datos.idioma_candidato.trim()) {
            datos.idioma_candidato = null;
        }
        this.servicio.actualizarPreferencias(datos).subscribe({
            next: (respuesta) => {
                if (respuesta.exito && respuesta.datos) {
                    const posteriores = Object.fromEntries(Object.entries(this.datosFormulario()).filter(([campo, valor]) =>
                        JSON.stringify(valor) !== JSON.stringify(formulario[campo as keyof PreferenciasActualizar])));
                    this.mapearDesdeApi(respuesta.datos);
                    const confirmado = this.formularioGuardado;
                    if (Object.keys(posteriores).length) {
                        this.mapearDesdeApi({ ...respuesta.datos, ...posteriores } as PreferenciasModel);
                        // Comparo el borrador conservado contra la respuesta persistida, no contra sí mismo.
                        this.formularioGuardado = confirmado;
                    }
                    // Uso únicamente el cambio confirmado sobre los criterios persistidos.
                    if (respuesta.cambio_criterios === true) this.perfilCambio.set(true);
                    const mensaje = this.cambiosSinGuardar
                        ? 'Guardé las preferencias enviadas. Quedan cambios posteriores sin guardar.'
                        : 'Preferencias actualizadas correctamente.';
                    this.mensajeAccesible.set(mensaje);
                    this.mensajes.add({
                        severity: this.cambiosSinGuardar ? 'info' : 'success',
                        summary: 'Guardado',
                        detail: mensaje,
                    });
                }
                this.guardando.set(false);
            },
            error: (err) => {
                this.mensajeAccesible.set('No se pudieron guardar las preferencias.');
                const detalle = err?.error?.error || err?.message || 'Error desconocido';
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error al guardar',
                    detail: detalle,
                });
                console.error('Error al guardar preferencias:', err);
                this.guardando.set(false);
            }
        });
    }

    // Mapeo los datos de la API a las propiedades del componente.
    private mapearDesdeApi(prefs: PreferenciasModel): void {
        this.nombre = prefs.nombre ?? '';
        this.nivelExperiencia = prefs.nivel_experiencia ?? undefined;
        this.perfilProfesional = prefs.perfil_profesional ?? '';
        this.idiomaCandidato = prefs.idioma_candidato ?? '';
        this.stackTecnologico = prefs.stack_tecnologico ?? [];
        this.modalidadAceptada = prefs.modalidad_aceptada ?? 'cualquiera';
        this.zonasPreferidas = prefs.zonas_preferidas ?? [];
        this.terminosBusqueda = prefs.terminos_busqueda ?? [];
        this.reglasExclusion = prefs.reglas_exclusion ?? [];
        this.promptPersonalizado = prefs.prompt_personalizado ?? '';
        this.usarPromptPersonalizado = prefs.usar_prompt_personalizado ?? false;
        this.modeloIa = normalizarModeloDeepSeek(prefs.modelo_ia ?? 'deepseek-flash');
        this.modeloIaEvaluacion = normalizarModeloDeepSeek(prefs.modelo_ia_evaluacion ?? prefs.modelo_ia ?? 'deepseek-flash');
        this.modeloIaImportacion = normalizarModeloDeepSeek(prefs.modelo_ia_importacion ?? 'deepseek-v4-pro');
        this.priorizarOfertasIa = prefs.priorizar_ofertas_ia ?? false;
        this.bonusMaximoPrioridadIa = prefs.bonus_maximo_prioridad_ia ?? 6;
        this.filtrarNivelLinkedin = prefs.filtrar_nivel_linkedin !== false;
        this.disponibilidad = prefs.disponibilidad ?? 'full_time';
        this.expectativaSalarialMin = prefs.expectativa_salarial_min ?? null;
        this.expectativaSalarialMax = prefs.expectativa_salarial_max ?? null;
        this.monedaSalarial = prefs.moneda_salarial ?? 'NO_FILTRAR';
        this.nivelInglesDetalle = { ...(prefs.nivel_ingles_detalle ?? {}) };
        this.keywordsPositivas = prefs.keywords_positivas ?? [];
        this.keywordsNegativas = prefs.keywords_negativas ?? [];
        this.plataformasPreferidas = prefs.plataformas_preferidas ?? [];
        this.plataformasExcluidas = prefs.plataformas_excluidas ?? [];
        this.maxCaracteresDescripcionIa = prefs.max_caracteres_descripcion_ia ?? 2500;
        this.temperaturaEvaluacion = prefs.temperatura_evaluacion ?? 0;
        this.temperaturaImportacion = prefs.temperatura_importacion ?? 0;
        this.fechaImportacionCv = prefs.fecha_importacion_cv ?? null;
        this.aniosExperienciaReales = prefs.anios_experiencia_reales ?? null;
        this.nivelRealSeniority = prefs.nivel_real_seniority ?? '';
        this.conocimientosAusentes = prefs.conocimientos_ausentes ?? [];
        this.limitacionesExplicitas = prefs.limitaciones_explicitas ?? '';
        this.preguntasPerfilPendientes = structuredClone((prefs.preguntas_perfil_pendientes || []) as PreguntaImportacion[]);
        const tecnologiasApi = (prefs as any).tecnologias_detalle ?? [];
        const rolesApi = prefs.roles_objetivo_detalle ?? [];
        this.tecnologiasDetalle = structuredClone(tecnologiasApi);
        this.rolesObjetivoDetalle = structuredClone(rolesApi);
        this.perfilEfectivo = prefs.perfil_efectivo ?? null;
        this.formularioGuardado = JSON.stringify(this.datosFormulario());
        this.tecnologiasEditadas = false;
        this.rolesEditados = false;
        // scoring_config ya no se consume en el frontend (B1). Se ignora.
    }

    // Resetea a "pendiente" las evaluaciones de los últimos N días.
    resetearEvaluaciones(): void {
        const dias = this.diasReset();
        if (!dias || dias < 1 || dias > 365) return;

        this.reseteando.set(true);
        this.evaluacionService.resetearEvaluaciones(dias).subscribe({
            next: (respuesta) => {
                this.reseteando.set(false);
                if (respuesta.exito) {
                    const n = respuesta.datos?.reseteadas ?? 0;
                    const mensaje = n > 0
                        ? `Se resetearon ${n} oferta${n !== 1 ? 's' : ''} a pendiente.`
                        : `No había evaluaciones en los últimos ${dias} día${dias !== 1 ? 's' : ''}.`;
                    this.mensajeAccesible.set(mensaje);
                    this.mensajes.add({
                        severity: n > 0 ? 'success' : 'info',
                        summary: n > 0 ? 'Listo' : 'Sin cambios',
                        detail: n > 0
                            ? `Se resetearon ${n} oferta${n !== 1 ? 's' : ''} a pendiente.`
                            : `No había evaluaciones en los últimos ${dias} día${dias !== 1 ? 's' : ''}.`,
                    });
                    this.diasReset.set(null);
                }
            },
            error: () => {
                this.reseteando.set(false);
                this.mensajeAccesible.set('No se pudo ejecutar el reseteo. Verificá que el backend esté corriendo.');
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo ejecutar el reseteo. Verificá que el backend esté corriendo.',
                });
            }
        });
    }

    // Agrega una tecnología vacía a la tabla de niveles.
    agregarTecnologia(): void {
        this.tecnologiasEditadas = true;
        this.tecnologiasDetalle = [
            ...this.tecnologiasDetalle,
            { nombre: '', nivel: 'basico', categoria: 'lenguaje', importancia: 'secundaria', aliases: [] },
        ];
    }

    // Quita una tecnología de la tabla por índice.
    quitarTecnologia(idx: number): void {
        this.tecnologiasEditadas = true;
        this.tecnologiasDetalle = this.tecnologiasDetalle.filter((_, i: number) => i !== idx);
    }

    vaciarTecnologias(): void {
        this.tecnologiasEditadas = true;
        this.tecnologiasDetalle = [];
    }

    cargarTecnologiasSugeridas(): void {
        this.tecnologiasEditadas = true;
        this.tecnologiasDetalle = this.crearTecnologiasSugeridas();
    }

    agregarRol(): void {
        this.rolesEditados = true;
        this.rolesObjetivoDetalle = [
            ...this.rolesObjetivoDetalle,
            { rol: '', prioridad: 'media', aliases: [] },
        ];
    }

    quitarRol(idx: number): void {
        this.rolesEditados = true;
        this.rolesObjetivoDetalle = this.rolesObjetivoDetalle.filter((_, i: number) => i !== idx);
    }

    cargarRolesSugeridos(): void {
        this.rolesEditados = true;
        this.rolesObjetivoDetalle = this.crearRolesSugeridos();
    }

    listaAString(lista: string[] | undefined): string {
        return (lista || []).join(', ');
    }

    stringALista(texto: string): string[] {
        return texto
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
    }

    // --- Importación con extracción y revisión explícitas ---

    private limpiarRevisionCv(): void {
        this.solicitudCv++;
        this.analizandoCv.set(false);
        this.extrayendoCv.set(false);
        this.resultadoImportacion = null;
        this.preguntasImportacion = [];
        this.preferenciasRevisadas.clear();
        this.importacionAplicada = false;
        this.errorAnalisisCv = '';
    }

    private confirmarDescarteCv(incluirTexto = false): boolean {
        return !(this.resultadoImportacion || (incluirTexto && this.textoCvImportacion)) ||
            window.confirm('¿Descartar el borrador y las decisiones de la revisión actual?');
    }

    onArchivoCvSeleccionado(evento: Event): void {
        if (this.modoDemo() || this.guardandoCvBase() || this.leyendoCvBase() || this.guardando()) return;
        const input = evento.target as HTMLInputElement;
        const archivo = input.files?.[0];
        // Reinicio el control nativo para permitir elegir el mismo archivo otra vez.
        input.value = '';
        if (!archivo) return;
        this.errorExtraccionCv = !/\.(pdf|md)$/i.test(archivo.name) ? 'Seleccioná un archivo PDF o Markdown (.md).' :
            archivo.size === 0 ? 'El documento está vacío.' :
            archivo.size > 5 * 1048576 ? 'El documento no puede superar 5 MiB.' : '';
        if (this.errorExtraccionCv || !this.confirmarDescarteCv(true)) return;
        this.limpiarRevisionCv();
        this.archivoCvSeleccionado = archivo;
        this.textoCvImportacion = '';
        this.textoExtraidoCv = false;
        this.textoRevisadoCv = false;
        this.errorTextoCv = '';
        this.mensajes.clear();
    }

    editarTextoImportacion(evento: Event): void {
        const editor = evento.target as HTMLTextAreaElement;
        if (!this.confirmarDescarteCv()) {
            editor.value = this.textoCvImportacion;
            return;
        }
        this.limpiarRevisionCv();
        this.textoCvImportacion = editor.value;
        this.textoRevisadoCv = true;
        this.errorTextoCv = '';
    }

    extraerTextoCv(): void {
        const archivo = this.archivoCvSeleccionado;
        if (!archivo || this.modoDemo() || this.extrayendoCv() || this.guardando() || this.guardandoCvBase() ||
            !this.confirmarDescarteCv(true)) return;
        this.limpiarRevisionCv();
        const solicitud = this.solicitudCv;
        this.errorExtraccionCv = '';
        this.extrayendoCv.set(true);
        this.servicio.extraerTextoCv(archivo).subscribe({
            next: respuesta => {
                if (solicitud !== this.solicitudCv) return;
                this.extrayendoCv.set(false);
                const datos = respuesta.datos;
                if (!respuesta.exito || !datos || typeof datos.texto !== 'string' ||
                    !['pdf', 'md'].includes(datos.formato) || !datos.texto.trim() || this.validarTextoCv(datos.texto)) {
                    this.errorExtraccionCv = 'No pude validar la extracción completa. Conservé el borrador; podés pegar texto manualmente.';
                    return;
                }
                this.textoCvImportacion = datos.texto;
                this.textoExtraidoCv = true;
                this.textoRevisadoCv = false;
                this.errorTextoCv = '';
            },
            error: error => {
                if (solicitud !== this.solicitudCv) return;
                this.extrayendoCv.set(false);
                this.errorExtraccionCv = typeof error.error?.error === 'string' ? error.error.error :
                    'No pude extraer el texto por un error de red. Conservé el borrador; podés pegar texto manualmente.';
            },
        });
    }

    analizarCv(): void {
        if (this.modoDemo() || this.guardandoCvBase() || this.leyendoCvBase() || this.guardando() || this.analizandoCv() || this.extrayendoCv()) return;
        const texto = this.textoCvImportacion;
        this.errorAnalisisCv = this.validarTextoCv(texto) || (!texto.trim() ? 'Pegá o extraé texto antes de analizar.' : '');
        if (this.errorAnalisisCv) return;
        this.ejecutarAnalisisCv(new File([texto], 'cv-revisado.md', { type: 'text/markdown' }));
    }

    private ejecutarAnalisisCv(archivo: File): void {
        if (this.resultadoImportacion && !window.confirm('¿Descartar las correcciones y notas de la revisión actual para analizar nuevamente?')) return;
        this.limpiarRevisionCv();
        const solicitud = this.solicitudCv;
        this.textoRevisadoCv = true;
        if (archivo.size > 1024 * 1024) {
            this.mensajes.add({ severity: 'warn', summary: 'Archivo grande', detail: 'El CV no puede superar 1 MB.' });
            return;
        }

        this.analizandoCv.set(true);
        this.servicio.analizarCvMarkdown(archivo).subscribe({
            next: (resp) => {
                if (solicitud !== this.solicitudCv) return;
                this.analizandoCv.set(false);
                if (resp.exito && resp.datos) {
                    const datos = resp.datos;
                    // La omisión es válida; null o un contenedor inválido no lo son.
                    if (['preguntas', 'preguntas_perfil_pendientes'].some(campo =>
                        Object.hasOwn(datos, campo) && (!Array.isArray((datos as any)[campo]) ||
                            (datos as any)[campo].some((p: any) => !p || typeof p.campo !== 'string' || typeof p.pregunta !== 'string')))) {
                        this.errorAnalisisCv = 'El análisis contiene preguntas inválidas. Conservé el texto para corregir o reintentar.';
                        this.mensajes.add({ severity: 'error', summary: 'Error', detail: this.errorAnalisisCv });
                        return;
                    }
                    // Trabajo sobre una copia: la respuesta del proveedor no recibe ediciones.
                    this.resultadoImportacion = structuredClone(datos);
                    this.preguntasImportacion = (datos.preguntas_perfil_pendientes ?? datos.preguntas ?? []).map(p => ({
                        ...structuredClone(p), id: crypto.randomUUID(), estado: 'pendiente',
                    }));
                    if (Object.hasOwn(datos, 'preguntas_perfil_pendientes')) {
                        this.resultadoImportacion.preguntas_perfil_pendientes = this.preguntasImportacion;
                    } else if (Object.hasOwn(datos, 'preguntas')) {
                        this.resultadoImportacion.preguntas = this.preguntasImportacion;
                    }
                    // El backend normaliza salario ausente a null: conservo los valores manuales.
                    if (['expectativa_salarial_min', 'expectativa_salarial_max', 'moneda_salarial'].some(campo => Object.hasOwn(datos, campo))) {
                        this.resultadoImportacion.expectativa_salarial_min = datos.expectativa_salarial_min ?? this.expectativaSalarialMin;
                        this.resultadoImportacion.expectativa_salarial_max = datos.expectativa_salarial_max ?? this.expectativaSalarialMax;
                        this.resultadoImportacion.moneda_salarial = datos.moneda_salarial ?? this.monedaSalarial;
                    }
                    if (datos.nivel_ingles_detalle) {
                        this.resultadoImportacion.nivel_ingles_detalle = {
                            ...datos.nivel_ingles_detalle, ...this.nivelInglesDetalle,
                        };
                    }
                    // Mantengo el nivel confirmado hasta que lo edite explícitamente en la revisión.
                    if (datos.tecnologias_detalle?.length) {
                        this.resultadoImportacion.tecnologias_detalle = [
                            ...structuredClone(this.tecnologiasDetalle),
                            ...structuredClone(datos.tecnologias_detalle.filter(t => !this.tecnologiasDetalle.some(
                                existente => existente.nombre.toLowerCase() === t.nombre.toLowerCase()))),
                        ];
                    }
                    this.mensajes.add({ severity: 'success', summary: 'CV analizado', detail: 'Revisá los datos extraídos antes de aplicar.' });
                } else {
                    this.errorAnalisisCv = resp.error || 'No se pudo analizar el CV.';
                    this.mensajes.add({ severity: 'error', summary: 'Error', detail: this.errorAnalisisCv });
                }
            },
            error: (error) => {
                if (solicitud !== this.solicitudCv) return;
                this.analizandoCv.set(false);
                this.errorAnalisisCv = typeof error.error?.error === 'string' ? error.error.error : 'No se pudo analizar el CV.';
                this.mensajes.add({ severity: 'error', summary: 'Error', detail: this.errorAnalisisCv });
            },
        });
    }

    rechazarTecnologiaImportacion(indice: number): void {
        if (!this.resultadoImportacion?.tecnologias_detalle) return;
        this.resultadoImportacion.tecnologias_detalle.splice(indice, 1);
    }

    private tecnologiasRevisadas() {
        const propuestas = this.resultadoImportacion?.tecnologias_detalle?.filter(t => t.nombre.trim()) ?? [];
        // Rechazar una propuesta no autoriza borrar una tecnología confirmada.
        return [...structuredClone(propuestas), ...structuredClone(this.tecnologiasDetalle.filter(
            actual => !propuestas.some(t => t.nombre.trim().toLowerCase() === actual.nombre.trim().toLowerCase())))];
    }

    aplicarImportacion(): void {
        if (!this.resultadoImportacion || this.guardando() || this.analizandoCv()) return;

        const r = this.resultadoImportacion;

        if (r.nombre != null) this.nombre = r.nombre;
        if (r.nivel_experiencia) this.nivelExperiencia = r.nivel_experiencia as any;
        if (r.perfil_profesional != null) this.perfilProfesional = r.perfil_profesional;
        if (r.idioma_candidato != null) this.idiomaCandidato = r.idioma_candidato;
        // Conservo preferencias laborales: importar hechos no confirma otros criterios.
        if (r.nivel_ingles_detalle) {
            this.nivelInglesDetalle = {
                ...this.nivelInglesDetalle,
                ...r.nivel_ingles_detalle,
            };
        }
        if (r.tecnologias_detalle?.length) {
            this.tecnologiasDetalle = this.tecnologiasRevisadas();
            this.tecnologiasEditadas = true;
        }
        // Los roles objetivo son preferencias de búsqueda, no hechos del CV.
        // Los términos de búsqueda y exclusiones continúan bajo edición explícita.
        // scoring_config ya no se aplica (B1): se ignora del resultado de importación.
        // Aplico solamente preferencias aceptadas en la revisión, nunca detecciones automáticas.
        if (this.preferenciasRevisadas.has('salario')) {
            this.expectativaSalarialMin = r.expectativa_salarial_min ?? null;
            this.expectativaSalarialMax = r.expectativa_salarial_max ?? null;
            this.monedaSalarial = (r.moneda_salarial ?? this.monedaSalarial) as typeof this.monedaSalarial;
        }
        if (this.preferenciasRevisadas.has('keywords_positivas')) {
            this.keywordsPositivas = structuredClone(r.keywords_positivas ?? []);
        }
        // La omisión conserva preguntas confirmadas; [] explícito permite limpiarlas.
        if (Object.hasOwn(r, 'preguntas_perfil_pendientes') || Object.hasOwn(r, 'preguntas')) {
            this.preguntasPerfilPendientes = structuredClone(r.preguntas_perfil_pendientes ?? r.preguntas ?? []);
        }
        this.fechaImportacionCv = new Date().toISOString();

        this.limpiarRevisionCv();
        this.importacionAplicada = true;

        this.mensajes.add({ severity: 'success', summary: 'Preferencias cargadas', detail: 'Revisá y guardá para confirmar los cambios.' });
    }

    cancelarImportacion(): void {
        this.limpiarRevisionCv();
        this.archivoCvSeleccionado = null;
        this.textoCvImportacion = '';
        this.textoExtraidoCv = false;
        this.textoRevisadoCv = false;
        this.errorExtraccionCv = '';
        this.errorTextoCv = '';
    }

    /**
     * Detecta si una pregunta de importación tiene acción automática conocida.
     * Limito las acciones a cambios acotados y explícitos del borrador.
     * No infiero experiencia a partir de respuestas libres.
     */
    preguntaTieneAccionAutomatica(campo: string): boolean {
        const clavesAccionables = ['docker', 'salario', 'soporte'];
        const texto = (campo || '').toLowerCase();
        return clavesAccionables.some(clave => texto.includes(clave));
    }

    /** Preguntas que tienen acción automática (aplicar sugerencia hace un cambio real). */
    get preguntasAccionables(): PreguntaImportacion[] {
        return this.preguntasImportacion.filter(p => this.preguntaTieneAccionAutomatica(p.campo));
    }

    /** Preguntas informativas: todavía no hay acción real, solo guardar como nota. */
    get preguntasInformativas(): PreguntaImportacion[] {
        return this.preguntasImportacion.filter(p => !this.preguntaTieneAccionAutomatica(p.campo));
    }

    alcanceSugerencia(campo: string): string {
        const texto = campo.toLowerCase();
        if (texto.includes('docker')) return 'Cambiar únicamente el nivel de Docker a básico en el borrador.';
        if (texto.includes('salario')) return 'Quitar únicamente el filtro salarial en el borrador. No modifica experiencia.';
        if (texto.includes('soporte')) return 'Agregar únicamente «soporte de aplicaciones» a palabras clave positivas. No modifica experiencia.';
        return 'Sin acción automática: reviso los hechos en los controles del borrador.';
    }

    aceptarSugerenciaImportacion(id: string | undefined): void {
        const pregunta = this.preguntasImportacion.find(p => id && p.id === id);
        const borrador = this.resultadoImportacion;
        if (!pregunta || !borrador || ['aplicada', 'ignorada', 'nota'].includes(pregunta.estado ?? '')) return;
        const campo = pregunta.campo.toLowerCase();
        if (campo.includes('docker')) {
            const tecnologias = borrador.tecnologias_detalle ?? [];
            const existente = tecnologias.find(t => t.nombre.toLowerCase() === 'docker');
            if (existente) existente.nivel = 'basico';
            else tecnologias.push({ nombre: 'Docker', nivel: 'basico', categoria: 'herramienta', importancia: 'secundaria', aliases: ['docker'] });
            borrador.tecnologias_detalle = tecnologias;
        } else if (campo.includes('salario')) {
            borrador.expectativa_salarial_min = null;
            borrador.expectativa_salarial_max = null;
            borrador.moneda_salarial = 'NO_FILTRAR';
            this.preferenciasRevisadas.add('salario');
        } else if (campo.includes('soporte')) {
            borrador.keywords_positivas = [...new Set([...(this.preferenciasRevisadas.has('keywords_positivas') ? borrador.keywords_positivas ?? [] : this.keywordsPositivas), 'soporte de aplicaciones'])];
            this.preferenciasRevisadas.add('keywords_positivas');
        } else return;
        pregunta.estado = 'aplicada';
        pregunta.respuesta = pregunta.respuesta || this.alcanceSugerencia(pregunta.campo);
    }

    ignorarPreguntaImportacion(id: string | undefined): void {
        const pregunta = this.preguntasImportacion.find(p => id && p.id === id);
        if (!pregunta || pregunta.estado === 'aplicada') return;
        pregunta.estado = 'ignorada';
        delete pregunta.respuesta;
        delete pregunta.nota;
    }

    guardarNotaEIgnorar(id: string | undefined): void {
        const pregunta = this.preguntasImportacion.find(p => id && p.id === id);
        if (!pregunta?.respuesta?.trim() || pregunta.estado === 'aplicada') return;
        pregunta.nota = pregunta.respuesta;
        pregunta.estado = 'nota';
    }

    actualizarRespuestaPregunta(id: string | undefined, valor: string): void {
        const pregunta = this.preguntasImportacion.find(p => id && p.id === id);
        if (!pregunta || ['aplicada', 'ignorada', 'nota'].includes(pregunta.estado ?? '')) return;
        pregunta.respuesta = valor;
        pregunta.estado = valor.trim() ? 'respondida' : 'pendiente';
    }

    get resumenImportacion(): { agregar: string[]; modificar: string[]; conservar: string[] } {
        const resumen = { agregar: [] as string[], modificar: [] as string[], conservar: [] as string[] };
        const r = this.resultadoImportacion;
        if (!r) return resumen;
        const campos: Array<[string, unknown, unknown]> = [
            ['Nombre', r.nombre, this.nombre], ['Nivel', r.nivel_experiencia, this.nivelExperiencia],
            ['Perfil profesional', r.perfil_profesional, this.perfilProfesional], ['Idiomas', r.idioma_candidato, this.idiomaCandidato],
            ['Inglés detallado', r.nivel_ingles_detalle ? { ...this.nivelInglesDetalle, ...r.nivel_ingles_detalle } : undefined, this.nivelInglesDetalle],
            ['Tecnologías', r.tecnologias_detalle?.length ? this.tecnologiasRevisadas() : undefined, this.tecnologiasDetalle],
            ['Preguntas', Object.hasOwn(r, 'preguntas_perfil_pendientes') || Object.hasOwn(r, 'preguntas') ? this.preguntasImportacion : undefined, this.preguntasPerfilPendientes],
        ];
        if (this.preferenciasRevisadas.has('salario')) campos.push(['Filtro salarial', [r.expectativa_salarial_min, r.expectativa_salarial_max, r.moneda_salarial], [this.expectativaSalarialMin, this.expectativaSalarialMax, this.monedaSalarial]]);
        else resumen.conservar.push('Filtro salarial');
        if (this.preferenciasRevisadas.has('keywords_positivas')) campos.push(['Palabras clave positivas', r.keywords_positivas, this.keywordsPositivas]);
        else resumen.conservar.push('Palabras clave positivas');
        for (const [nombre, propuesto, actual] of campos) {
            if (propuesto == null || JSON.stringify(propuesto) === JSON.stringify(actual)) resumen.conservar.push(nombre);
            else if (actual == null || actual === '' || (Array.isArray(actual) && actual.length === 0)) resumen.agregar.push(nombre);
            else resumen.modificar.push(nombre);
        }
        resumen.conservar.push('Roles', 'Términos de búsqueda', 'Modalidad', 'Zonas', 'Exclusiones', 'Disponibilidad', 'Plataformas', 'Experiencia real');
        return resumen;
    }
}

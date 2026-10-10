import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PreferenciasService, ResultadoImportacionCv } from '../../servicios/preferencias.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { Preferencias as PreferenciasModel, PreferenciasActualizar, PerfilEfectivo, PreguntaPerfil } from '../../modelos/preferencia.model';
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

@Component({
    selector: 'app-preferencias',
    imports: [
        FormsModule,
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
    modeloIa: PreferenciasModel['modelo_ia'] = 'deepseek-v4-flash';
    modeloIaEvaluacion: 'deepseek-v4-flash' | 'deepseek-v4-pro' = 'deepseek-v4-flash';
    modeloIaImportacion: 'deepseek-v4-flash' | 'deepseek-v4-pro' = 'deepseek-v4-pro';
    priorizarOfertasIa = false;
    bonusMaximoPrioridadIa = 6;
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

    // Importación de CV Markdown.
    archivoCvSeleccionado: File | null = null;
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
        { label: 'DeepSeek V4 Flash (recomendado)', value: 'deepseek-v4-flash' },
        { label: 'DeepSeek V4 Pro (potente)', value: 'deepseek-v4-pro' },
    ];

    opcionesModeloImportacion = [
        { label: 'DeepSeek V4 Pro (recomendado para CV)', value: 'deepseek-v4-pro' },
        { label: 'DeepSeek V4 Flash', value: 'deepseek-v4-flash' },
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

    ngOnInit(): void {
        if (this.demoService.esModoDemo()) {
            this.cargarPreferenciasMockup();
            return;
        }
        this.cargarPreferencias();
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
        this.modeloIa = 'deepseek-v4-flash';
        this.modeloIaEvaluacion = 'deepseek-v4-flash';
        this.modeloIaImportacion = 'deepseek-v4-pro';
        this.disponibilidad = 'full_time';
        this.monedaSalarial = 'NO_FILTRAR';
        this.aniosExperienciaReales = 1;
        this.keywordsPositivas = ['healthtech', 'angular', 'frontend'];
        this.keywordsNegativas = ['java', 'cableado', 'soporte hardware'];
        this.plataformasPreferidas = ['linkedin', 'getonbrd'];
        this.plataformasExcluidas = [];
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
        if (this.modoDemo() || this.guardando()) return;
        this.guardando.set(true);
        const formulario = this.datosFormulario();
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
                    this.mapearDesdeApi(respuesta.datos);
                    // Uso únicamente el cambio confirmado sobre los criterios persistidos.
                    if (respuesta.cambio_criterios === true) this.perfilCambio.set(true);
                    this.mensajeAccesible.set('Preferencias actualizadas correctamente.');
                    this.mensajes.add({
                        severity: 'success',
                        summary: 'Guardado',
                        detail: 'Preferencias actualizadas correctamente.',
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
        this.modeloIa = prefs.modelo_ia ?? 'deepseek-v4-flash';
        this.modeloIaEvaluacion = prefs.modelo_ia_evaluacion ?? 'deepseek-v4-flash';
        this.modeloIaImportacion = prefs.modelo_ia_importacion ?? 'deepseek-v4-pro';
        this.priorizarOfertasIa = prefs.priorizar_ofertas_ia ?? false;
        this.bonusMaximoPrioridadIa = prefs.bonus_maximo_prioridad_ia ?? 6;
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

    // --- Importación de CV Markdown ---

    onArchivoCvSeleccionado(evento: Event): void {
        const input = evento.target as HTMLInputElement;
        this.archivoCvSeleccionado = input.files?.[0] ?? null;
        this.solicitudCv++;
        this.analizandoCv.set(false);
        this.resultadoImportacion = null;
        this.preguntasImportacion = [];
        this.preferenciasRevisadas.clear();
        this.mensajes.clear();
    }

    analizarCv(): void {
        const solicitud = ++this.solicitudCv;
        const archivo = this.archivoCvSeleccionado;
        this.analizandoCv.set(false);
        // Descarto sugerencias anteriores antes de validar o iniciar otro análisis.
        this.resultadoImportacion = null;
        this.preguntasImportacion = [];
        this.preferenciasRevisadas.clear();
        if (!this.archivoCvSeleccionado) return;

        if (this.archivoCvSeleccionado.size > 1024 * 1024) {
            this.mensajes.add({ severity: 'warn', summary: 'Archivo grande', detail: 'El CV no puede superar 1 MB.' });
            return;
        }

        this.analizandoCv.set(true);
        this.servicio.analizarCvMarkdown(this.archivoCvSeleccionado).subscribe({
            next: (resp) => {
                if (solicitud !== this.solicitudCv || archivo !== this.archivoCvSeleccionado) return;
                this.analizandoCv.set(false);
                if (resp.exito && resp.datos) {
                    const datos = resp.datos;
                    // La omisión es válida; null o un contenedor inválido no lo son.
                    if (['preguntas', 'preguntas_perfil_pendientes'].some(campo =>
                        Object.hasOwn(datos, campo) && (!Array.isArray((datos as any)[campo]) ||
                            (datos as any)[campo].some((p: any) => !p || typeof p.campo !== 'string' || typeof p.pregunta !== 'string')))) {
                        this.mensajes.add({ severity: 'error', summary: 'Error', detail: 'La extracción contiene preguntas inválidas.' });
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
                    this.mensajes.add({ severity: 'error', summary: 'Error', detail: resp.error || 'No se pudo analizar el CV.' });
                }
            },
            error: (error) => {
                if (solicitud !== this.solicitudCv || archivo !== this.archivoCvSeleccionado) return;
                this.analizandoCv.set(false);
                const detalle = typeof error.error?.error === 'string' ? error.error.error : 'No se pudo analizar el CV.';
                this.mensajes.add({ severity: 'error', summary: 'Error', detail: detalle });
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
        if (!this.resultadoImportacion) return;

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

        this.cancelarImportacion();

        this.mensajes.add({ severity: 'success', summary: 'Preferencias cargadas', detail: 'Revisá y guardá para confirmar los cambios.' });
    }

    cancelarImportacion(): void {
        this.solicitudCv++;
        this.analizandoCv.set(false);
        this.preferenciasRevisadas.clear();
        this.resultadoImportacion = null;
        this.preguntasImportacion = [];
        this.archivoCvSeleccionado = null;
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

import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PreferenciasService, ResultadoImportacionCv } from '../../servicios/preferencias.service';
import { EvaluacionService } from '../../servicios/evaluacion.service';
import { Preferencias as PreferenciasModel, PreferenciasActualizar } from '../../modelos/preferencia.model';
import { DemoService } from '../../servicios/demo.service';

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

type PreguntaImportacion = {
    campo: string;
    pregunta: string;
    motivo?: string;
    sugerencia?: string | null;
    estado?: 'pendiente' | 'aplicada' | 'ignorada';
    respuesta?: string;
    tieneAccionAutomatica?: boolean;
};

@Component({
    selector: 'app-preferencias',
    imports: [
        FormsModule,
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

    // Datos del formulario — inicializo con valores por defecto.
    nombre = '';
    nivelExperiencia: PreferenciasModel['nivel_experiencia'] = 'junior';
    perfilProfesional = '';
    idiomaCandidato = 'Español nativo, Inglés básico oral / intermedio escrito';
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
    disponibilidad: 'full_time' | 'part_time' | 'freelance' | 'a_coordinar' = 'full_time';
    expectativaSalarialMin: number | null = null;
    expectativaSalarialMax: number | null = null;
    monedaSalarial: 'ARS' | 'USD' | 'NO_FILTRAR' = 'NO_FILTRAR';
    nivelInglesDetalle: {
        espanol: string | null;
        reading: string | null;
        writing: string | null;
        speaking: string | null;
        listening: string | null;
        regla: string | null;
    } = {
        espanol: 'nativo',
        reading: 'A2',
        writing: 'A2_basico',
        speaking: 'A1',
        listening: 'A1',
        regla: 'Aceptar lectura técnica e inglés deseable. Penalizar inglés conversacional, fluido, avanzado o bilingüe.',
    };
    keywordsPositivas: string[] = [];
    keywordsNegativas: string[] = [];
    plataformasPreferidas: string[] = [];
    plataformasExcluidas: string[] = [];
    maxCaracteresDescripcionIa = 2500;
    temperaturaEvaluacion = 0;
    temperaturaImportacion = 0;
    fechaImportacionCv: string | null = null;
    aniosExperienciaReales: number | null = 1;
    tabActiva = signal(0);
    nivelRealSeniority = 'Junior / Junior avanzado en proyectos propios, sin experiencia formal semi-senior o senior';
    conocimientosAusentes: string[] = [];
    limitacionesExplicitas = '';

    // Perfil detallado: tecnologías con niveles y categorías.
    tecnologiasDetalle: Array<{ nombre: string; nivel: string; categoria: string; importancia: string; aliases: string[]; evidencia?: string }> = [];
    rolesObjetivoDetalle: Array<{ rol: string; prioridad: string; aliases: string[]; evidencia?: string }> = [];
    scoringConfig = {
        umbral_aprobacion: 60,
        penalizaciones: {} as Record<string, number>,
        bonificaciones: {} as Record<string, number>,
        deepseek: {
            ajuste_maximo_normal: 15,
            ajuste_maximo_con_evidencia: 25,
        },
    };

    // Importación de CV Markdown.
    archivoCvSeleccionado: File | null = null;
    analizandoCv = signal(false);
    resultadoImportacion: ResultadoImportacionCv | null = null;
    preguntasImportacion: PreguntaImportacion[] = [];
    preguntasPerfilPendientes: PreguntaImportacion[] = [];

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

    opcionesPlataformas = [
        { label: 'LinkedIn', value: 'linkedin' },
        { label: 'Computrabajo', value: 'computrabajo' },
        { label: 'Indeed', value: 'indeed' },
        { label: 'Bumeran', value: 'bumeran' },
        { label: 'Glassdoor', value: 'glassdoor' },
        { label: 'GetOnBrd', value: 'getonbrd' },
        { label: 'Jooble', value: 'jooble' },
        { label: 'Google Jobs', value: 'google-jobs' },
        { label: 'Adzuna', value: 'adzuna' },
    ];

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
            { nombre: 'Java', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['java'], evidencia: 'Penalizable para scoring' },
            { nombre: 'Spring Boot', nivel: 'ninguno', categoria: 'backend', importancia: 'penalizable', aliases: ['spring boot', 'springboot'], evidencia: 'Penalizable para scoring' },
            { nombre: 'React Native', nivel: 'basico', categoria: 'mobile', importancia: 'no_prioritaria', aliases: ['react native'], evidencia: 'No priorizar ofertas mobile' },
            { nombre: 'Kotlin', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['kotlin'], evidencia: 'Penalizable para scoring' },
            { nombre: 'Go', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['go', 'golang'], evidencia: 'Penalizable para scoring' },
            { nombre: 'Python', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['python'], evidencia: 'Penalizable para scoring' },
            { nombre: 'PHP', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['php'], evidencia: 'Penalizable para scoring' },
            { nombre: 'Ruby', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['ruby', 'rails'], evidencia: 'Penalizable para scoring' },
            { nombre: 'Swift', nivel: 'ninguno', categoria: 'lenguaje', importancia: 'penalizable', aliases: ['swift'], evidencia: 'Penalizable para scoring' },
            { nombre: 'AWS', nivel: 'ninguno', categoria: 'cloud', importancia: 'penalizable', aliases: ['aws', 'amazon web services'], evidencia: 'Penalizable para scoring' },
            { nombre: 'MongoDB', nivel: 'ninguno', categoria: 'base_de_datos', importancia: 'penalizable', aliases: ['mongodb', 'mongo'], evidencia: 'Penalizable para scoring' },
            { nombre: 'GraphQL', nivel: 'ninguno', categoria: 'backend', importancia: 'penalizable', aliases: ['graphql'], evidencia: 'Penalizable para scoring' },
            { nombre: 'Kubernetes', nivel: 'ninguno', categoria: 'cloud', importancia: 'penalizable', aliases: ['kubernetes', 'k8s'], evidencia: 'Penalizable para scoring' },
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

    private normalizarScoringConfig(config: any): typeof this.scoringConfig {
        return {
            umbral_aprobacion: 60,
            penalizaciones: {
                semi_senior: 10,
                senior: 20,
                sr_director: 30,
                tecnologia_desconocida_importante: 5,
                anio_experiencia_excedente: 5,
                ingles_avanzado: 25,
                soporte_hardware: 15,
                qa_no_software: 20,
                ...(config?.penalizaciones || {}),
            },
            bonificaciones: {
                healthtech: 5,
                stack_principal_completo: 10,
                rol_prioridad_alta: 5,
                rol_prioridad_media: 3,
                ...(config?.bonificaciones || {}),
            },
            deepseek: {
                ajuste_maximo_normal: 15,
                ajuste_maximo_con_evidencia: 25,
                ...(config?.deepseek || {}),
            },
        };
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
        this.scoringConfig = this.normalizarScoringConfig(null);
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

    guardar(): void {
        this.guardando.set(true);
        const stackDerivado = this.tecnologiasDetalle
            .filter(tech => tech.nivel !== 'ninguno')
            .map(tech => tech.nombre)
            .filter((nombre, index, arr) => nombre && nombre.trim() && arr.indexOf(nombre) === index);

        const stackFinal = stackDerivado.length > 0
            ? stackDerivado
            : (this.stackTecnologico.length > 0 ? this.stackTecnologico : ['Sin stack definido']);

        const datos: PreferenciasActualizar = {
            nombre: this.nombre,
            nivel_experiencia: this.nivelExperiencia,
            perfil_profesional: this.perfilProfesional,
            idioma_candidato: this.idiomaCandidato,
            stack_tecnologico: stackFinal,
            modalidad_aceptada: this.modalidadAceptada,
            zonas_preferidas: this.zonasPreferidas,
            terminos_busqueda: this.terminosBusqueda,
            reglas_exclusion: this.reglasExclusion,
            prompt_personalizado: this.promptPersonalizado,
            usar_prompt_personalizado: this.usarPromptPersonalizado,
            modelo_ia: this.modeloIa,
            tecnologias_detalle: this.tecnologiasDetalle as any,
            roles_objetivo_detalle: this.rolesObjetivoDetalle as any,
            scoring_config: this.scoringConfig as any,
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

        this.servicio.actualizarPreferencias(datos).subscribe({
            next: (respuesta) => {
                if (respuesta.exito && respuesta.datos) {
                    this.mapearDesdeApi(respuesta.datos);
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
        this.nivelExperiencia = prefs.nivel_experiencia ?? 'junior';
        this.perfilProfesional = prefs.perfil_profesional ?? '';
        this.idiomaCandidato = prefs.idioma_candidato ?? 'Español nativo, Inglés básico oral / intermedio escrito';
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
        this.disponibilidad = prefs.disponibilidad ?? 'full_time';
        this.expectativaSalarialMin = prefs.expectativa_salarial_min ?? null;
        this.expectativaSalarialMax = prefs.expectativa_salarial_max ?? null;
        this.monedaSalarial = prefs.moneda_salarial ?? 'NO_FILTRAR';
        this.nivelInglesDetalle = {
            espanol: 'nativo',
            reading: 'A2',
            writing: 'A2_basico',
            speaking: 'A1',
            listening: 'A1',
            regla: 'Aceptar lectura técnica e inglés deseable. Penalizar inglés conversacional, fluido, avanzado o bilingüe.',
            ...(prefs.nivel_ingles_detalle || {}),
        };
        this.keywordsPositivas = prefs.keywords_positivas ?? [];
        this.keywordsNegativas = prefs.keywords_negativas ?? [];
        this.plataformasPreferidas = prefs.plataformas_preferidas ?? [];
        this.plataformasExcluidas = prefs.plataformas_excluidas ?? [];
        this.maxCaracteresDescripcionIa = prefs.max_caracteres_descripcion_ia ?? 2500;
        this.temperaturaEvaluacion = prefs.temperatura_evaluacion ?? 0;
        this.temperaturaImportacion = prefs.temperatura_importacion ?? 0;
        this.fechaImportacionCv = prefs.fecha_importacion_cv ?? null;
        this.aniosExperienciaReales = prefs.anios_experiencia_reales ?? 1;
        this.nivelRealSeniority = prefs.nivel_real_seniority ?? 'Junior / Junior avanzado en proyectos propios, sin experiencia formal semi-senior o senior';
        this.conocimientosAusentes = prefs.conocimientos_ausentes ?? [];
        this.limitacionesExplicitas = prefs.limitaciones_explicitas ?? '';
        this.preguntasPerfilPendientes = (prefs.preguntas_perfil_pendientes || []) as PreguntaImportacion[];
        const tecnologiasApi = (prefs as any).tecnologias_detalle ?? [];
        const rolesApi = (prefs as any).roles_objetivo_detalle ?? [];
        this.tecnologiasDetalle = tecnologiasApi.length > 0 ? tecnologiasApi : this.crearTecnologiasSugeridas();
        this.rolesObjetivoDetalle = rolesApi.length > 0 ? rolesApi : this.crearRolesSugeridos();
        const scoringApi = ((prefs as any).scoring_config || {}) as any;
        this.scoringConfig = this.normalizarScoringConfig(scoringApi) as any;
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
        this.tecnologiasDetalle = [
            ...this.tecnologiasDetalle,
            { nombre: '', nivel: 'basico', categoria: 'lenguaje', importancia: 'secundaria', aliases: [] },
        ];
    }

    // Quita una tecnología de la tabla por índice.
    quitarTecnologia(idx: number): void {
        this.tecnologiasDetalle = this.tecnologiasDetalle.filter((_, i: number) => i !== idx);
    }

    cargarTecnologiasSugeridas(): void {
        this.tecnologiasDetalle = this.crearTecnologiasSugeridas();
    }

    agregarRol(): void {
        this.rolesObjetivoDetalle = [
            ...this.rolesObjetivoDetalle,
            { rol: '', prioridad: 'media', aliases: [] },
        ];
    }

    quitarRol(idx: number): void {
        this.rolesObjetivoDetalle = this.rolesObjetivoDetalle.filter((_, i: number) => i !== idx);
    }

    cargarRolesSugeridos(): void {
        this.rolesObjetivoDetalle = this.crearRolesSugeridos();
    }

    restaurarScoringRecomendado(): void {
        this.scoringConfig = {
            umbral_aprobacion: 60,
            penalizaciones: {
                semi_senior: 10,
                senior: 20,
                sr_director: 30,
                tecnologia_desconocida_importante: 5,
                anio_experiencia_excedente: 5,
                ingles_avanzado: 25,
                soporte_hardware: 15,
                qa_no_software: 20,
            },
            bonificaciones: {
                healthtech: 5,
                stack_principal_completo: 10,
                rol_prioridad_alta: 5,
                rol_prioridad_media: 3,
            },
            deepseek: {
                ajuste_maximo_normal: 15,
                ajuste_maximo_con_evidencia: 25,
            },
        } as any;
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
    }

    analizarCv(): void {
        if (!this.archivoCvSeleccionado) return;

        if (this.archivoCvSeleccionado.size > 1024 * 1024) {
            this.mensajes.add({ severity: 'warn', summary: 'Archivo grande', detail: 'El CV no puede superar 1 MB.' });
            return;
        }

        this.analizandoCv.set(true);
        this.servicio.analizarCvMarkdown(this.archivoCvSeleccionado).subscribe({
            next: (resp) => {
                this.analizandoCv.set(false);
                if (resp.exito && resp.datos) {
                    this.resultadoImportacion = resp.datos;
                    this.preguntasImportacion = (resp.datos.preguntas_perfil_pendientes || resp.datos.preguntas || []).map((p: any) => ({
                        ...p,
                        estado: 'pendiente',
                        respuesta: '',
                    }));
                    this.mensajes.add({ severity: 'success', summary: 'CV analizado', detail: 'Revisá los datos extraídos antes de aplicar.' });
                }
            },
            error: () => {
                this.analizandoCv.set(false);
                this.mensajes.add({ severity: 'error', summary: 'Error', detail: 'No se pudo analizar el CV.' });
            },
        });
    }

    aplicarImportacion(): void {
        if (!this.resultadoImportacion) return;

        const r = this.resultadoImportacion;

        if (r.nombre) this.nombre = r.nombre;
        if (r.nivel_experiencia) this.nivelExperiencia = r.nivel_experiencia as any;
        if (r.perfil_profesional) this.perfilProfesional = r.perfil_profesional;
        if (r.idioma_candidato) this.idiomaCandidato = r.idioma_candidato;
        if (r.modalidad_aceptada) this.modalidadAceptada = r.modalidad_aceptada as any;
        if (r.disponibilidad) this.disponibilidad = r.disponibilidad as any;
        if (r.zonas_preferidas?.length) this.zonasPreferidas = r.zonas_preferidas;
        if (r.expectativa_salarial_min !== undefined) this.expectativaSalarialMin = r.expectativa_salarial_min ?? null;
        if (r.expectativa_salarial_max !== undefined) this.expectativaSalarialMax = r.expectativa_salarial_max ?? null;
        if (r.moneda_salarial) this.monedaSalarial = r.moneda_salarial as any;
        if (r.nivel_ingles_detalle) {
            this.nivelInglesDetalle = {
                ...this.nivelInglesDetalle,
                ...r.nivel_ingles_detalle,
            };
        }
        if (r.tecnologias_detalle?.length) this.tecnologiasDetalle = r.tecnologias_detalle;
        if (r.roles_objetivo_detalle?.length) this.rolesObjetivoDetalle = r.roles_objetivo_detalle;
        if (r.terminos_busqueda?.length) this.terminosBusqueda = r.terminos_busqueda;
        if (r.reglas_exclusion?.length) this.reglasExclusion = r.reglas_exclusion;
        if (r.keywords_positivas?.length) this.keywordsPositivas = r.keywords_positivas;
        if (r.keywords_negativas?.length) this.keywordsNegativas = r.keywords_negativas;
        if (r.plataformas_preferidas?.length) this.plataformasPreferidas = r.plataformas_preferidas;
        if (r.plataformas_excluidas?.length) this.plataformasExcluidas = r.plataformas_excluidas;
        if (r.scoring_config) {
            this.scoringConfig = this.normalizarScoringConfig(r.scoring_config);
        }
        if (r.preguntas_perfil_pendientes?.length) {
            this.preguntasImportacion = r.preguntas_perfil_pendientes.map((p: any) => ({ ...p, estado: 'pendiente', respuesta: '' }));
        }
        this.preguntasPerfilPendientes = this.preguntasImportacion.filter(p => p.estado !== 'ignorada');
        this.fechaImportacionCv = new Date().toISOString();

        this.resultadoImportacion = null;
        this.preguntasImportacion = [];
        this.archivoCvSeleccionado = null;

        this.mensajes.add({ severity: 'success', summary: 'Preferencias cargadas', detail: 'Revisá y guardá para confirmar los cambios.' });
    }

    cancelarImportacion(): void {
        this.resultadoImportacion = null;
        this.preguntasImportacion = [];
        this.archivoCvSeleccionado = null;
    }

    /**
     * Detecta si una pregunta de importación tiene acción automática conocida.
     * Solo estas palabras clave aplican cambios reales al perfil; el resto
     * queda como notas informativas pendientes.
     */
    preguntaTieneAccionAutomatica(campo: string): boolean {
        const clavesAccionables = ['react native', 'docker', 'salario', 'soporte'];
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

    aceptarSugerenciaImportacion(indice: number): void {
        const pregunta = this.preguntasImportacion[indice];
        if (!pregunta) return;

        const campo = (pregunta.campo || '').toLowerCase();
        const sugerencia = (pregunta.sugerencia || '').toLowerCase();

        if (campo.includes('react native')) {
            const existente = this.tecnologiasDetalle.find(t => t.nombre.toLowerCase() === 'react native');
            const payload = {
                nombre: 'React Native',
                nivel: 'basico',
                categoria: 'mobile',
                importancia: 'no_prioritaria',
                aliases: ['react native'],
                evidencia: sugerencia || 'No priorizar ofertas mobile',
            };
            if (existente) {
                Object.assign(existente, payload);
            } else {
                this.tecnologiasDetalle = [...this.tecnologiasDetalle, payload];
            }
        } else if (campo.includes('docker')) {
            const existente = this.tecnologiasDetalle.find(t => t.nombre.toLowerCase() === 'docker');
            const payload = {
                nombre: 'Docker',
                nivel: 'basico',
                categoria: 'herramienta',
                importancia: 'secundaria',
                aliases: ['docker'],
                evidencia: sugerencia || 'Uso local / básico',
            };
            if (existente) {
                Object.assign(existente, payload);
            } else {
                this.tecnologiasDetalle = [...this.tecnologiasDetalle, payload];
            }
        } else if (campo.includes('salario')) {
            this.expectativaSalarialMin = null;
            this.expectativaSalarialMax = null;
            this.monedaSalarial = 'NO_FILTRAR';
        this.aniosExperienciaReales = 1;
        } else if (campo.includes('soporte')) {
            if (!this.keywordsPositivas.includes('soporte de aplicaciones')) {
                this.keywordsPositivas = [...this.keywordsPositivas, 'soporte de aplicaciones'];
            }
        } else {
            // Si no es una pregunta con acción automática conocida,
            // simplemente guardamos la respuesta como nota pendiente.
            // El usuario puede editarla después.
            console.log(`[Importar CV] Pregunta "${pregunta.campo}" sin acción automática. Guardada como nota.`);
        }

        this.preguntasImportacion[indice] = {
            ...pregunta,
            estado: 'aplicada',
            respuesta: pregunta.respuesta || sugerencia || 'Sugerencia aplicada',
        };
        this.sincronizarPreguntasPendientes();
        this.mensajes.add({ severity: 'success', summary: 'Sugerencia aplicada', detail: `Pregunta "${pregunta.pregunta.substring(0, 60)}..." marcada como aplicada.` });
    }

    ignorarPreguntaImportacion(indice: number): void {
        const pregunta = this.preguntasImportacion[indice];
        if (!pregunta) return;
        this.preguntasImportacion[indice] = { ...pregunta, estado: 'ignorada' };
        this.sincronizarPreguntasPendientes();
        this.mensajes.add({ severity: 'info', summary: 'Pregunta ignorada', detail: `Pregunta "${pregunta.pregunta.substring(0, 60)}..." fue ignorada.` });
    }

    actualizarRespuestaPregunta(indice: number, valor: string): void {
        const pregunta = this.preguntasImportacion[indice];
        if (!pregunta) return;
        this.preguntasImportacion[indice] = {
            ...pregunta,
            respuesta: valor,
            estado: valor.trim() ? 'aplicada' : 'pendiente',
        };
        this.sincronizarPreguntasPendientes();
    }

    private sincronizarPreguntasPendientes(): void {
        this.preguntasPerfilPendientes = this.preguntasImportacion
            .filter(p => p.estado !== 'ignorada')
            .map(({ campo, pregunta, motivo, sugerencia, respuesta, estado }) => ({ campo, pregunta, motivo, sugerencia, respuesta, estado }));
    }
}

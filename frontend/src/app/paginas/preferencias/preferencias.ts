import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PreferenciasService } from '../../servicios/preferencias.service';
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
import { MessageService } from 'primeng/api';

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
    modeloIa: PreferenciasModel['modelo_ia'] = 'deepseek-chat';

    // Sugerencias para los AutoComplete en modo entrada libre.
    // filtrarLibre() devuelve el texto escrito como única sugerencia,
    // así el usuario lo ve en el dropdown y lo confirma con Enter o clic.
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

    opcionesModelo = [
        { label: 'DeepSeek Chat (rápido)', value: 'deepseek-chat' },
        { label: 'DeepSeek Reasoner (potente)', value: 'deepseek-reasoner' },
    ];

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
        this.modeloIa = 'deepseek-chat';
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
        const datos: PreferenciasActualizar = {
            nombre: this.nombre,
            nivel_experiencia: this.nivelExperiencia,
            perfil_profesional: this.perfilProfesional,
            idioma_candidato: this.idiomaCandidato,
            stack_tecnologico: this.stackTecnologico,
            modalidad_aceptada: this.modalidadAceptada,
            zonas_preferidas: this.zonasPreferidas,
            terminos_busqueda: this.terminosBusqueda,
            reglas_exclusion: this.reglasExclusion,
            prompt_personalizado: this.promptPersonalizado,
            usar_prompt_personalizado: this.usarPromptPersonalizado,
            modelo_ia: this.modeloIa,
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
            error: () => {
                this.mensajeAccesible.set('No se pudieron guardar las preferencias.');
                this.mensajes.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron guardar las preferencias.',
                });
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
        this.modeloIa = prefs.modelo_ia ?? 'deepseek-chat';
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
}

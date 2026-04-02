import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PreferenciasService } from '../../servicios/preferencias.service';
import { Preferencias as PreferenciasModel, PreferenciasActualizar } from '../../modelos/preferencia.model';

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
    private readonly mensajes = inject(MessageService);

    // Estado de carga y guardado.
    cargando = signal(true);
    guardando = signal(false);

    // Datos del formulario — inicializo con valores por defecto.
    nombre = '';
    nivelExperiencia: PreferenciasModel['nivel_experiencia'] = 'junior';
    perfilProfesional = '';
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
        this.cargarPreferencias();
    }

    // En modo entrada libre, devuelvo el texto escrito como sugerencia
    // para que el usuario lo confirme con Enter o clic.
    // Si el campo está vacío, no muestro nada.
    filtrarLibre(event: { query: string }): void {
        const texto = event.query.trim();
        this.sugerencias = texto ? [texto] : [];
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
                    this.mensajes.add({
                        severity: 'success',
                        summary: 'Guardado',
                        detail: 'Preferencias actualizadas correctamente.',
                    });
                }
                this.guardando.set(false);
            },
            error: () => {
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
        this.stackTecnologico = prefs.stack_tecnologico ?? [];
        this.modalidadAceptada = prefs.modalidad_aceptada ?? 'cualquiera';
        this.zonasPreferidas = prefs.zonas_preferidas ?? [];
        this.terminosBusqueda = prefs.terminos_busqueda ?? [];
        this.reglasExclusion = prefs.reglas_exclusion ?? [];
        this.promptPersonalizado = prefs.prompt_personalizado ?? '';
        this.usarPromptPersonalizado = prefs.usar_prompt_personalizado ?? false;
        this.modeloIa = prefs.modelo_ia ?? 'deepseek-chat';
    }
}

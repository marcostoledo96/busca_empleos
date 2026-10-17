import { Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DemoService } from '../../servicios/demo.service';
import { PreferenciasService } from '../../servicios/preferencias.service';

interface BloqueCv {
    id: number;
    titulo: string;
    texto: string;
    incluir: boolean;
}

type Enfoque = 'desarrollo' | 'qa' | 'soporte' | 'salud';
type Seccion = 'perfil' | 'contenido' | 'habilidades';

@Component({
    selector: 'app-cv',
    imports: [FormsModule, RouterLink],
    templateUrl: './cv.html',
    styleUrl: './cv.css',
})
export class Cv implements OnInit {
    private readonly preferencias = inject(PreferenciasService);
    private readonly demo = inject(DemoService);
    private readonly destroyRef = inject(DestroyRef);
    readonly modoDemo = this.demo.esModoDemo;
    readonly cargando = signal(false);
    readonly enfoques: { valor: Enfoque; etiqueta: string; patron: RegExp }[] = [
        { valor: 'desarrollo', etiqueta: 'Desarrollo de software', patron: /desarrollo|software|programaci[oó]n|frontend|backend/i },
        { valor: 'qa', etiqueta: 'QA / Testing', patron: /\bqa\b|test|pruebas|calidad/i },
        { valor: 'soporte', etiqueta: 'Soporte IT', patron: /soporte|help.?desk|equipos|infraestructura/i },
        { valor: 'salud', etiqueta: 'Salud / Administración sanitaria', patron: /salud|sanitari|hospital|cl[ií]nic/i },
    ];
    readonly etiquetas: Record<Seccion, string> = {
        perfil: 'Perfil profesional', contenido: 'Experiencia, proyectos, educación e idiomas', habilidades: 'Habilidades y tecnologías',
    };
    nombre = '';
    contacto = '';
    enlaces = '';
    resumen = '';
    habilidades = '';
    incluirResumen = false;
    incluirHabilidades = true;
    bloques: BloqueCv[] = [];
    secciones: Seccion[] = ['perfil', 'contenido', 'habilidades'];
    enfoque: Enfoque = 'desarrollo';
    fuenteCv = '';
    fuentePerfil = '';
    ambasFuentes = false;
    cargado = false;
    revisionConfirmada = false;
    vistaPrevia = false;
    cambiosPendientes = false;
    mensaje = '';
    error = '';
    private revision = 0;
    private solicitud = 0;
    private siguienteId = 0;

    ngOnInit(): void {
        this.cargarFuentes();
    }

    cargarFuentes(): void {
        if (this.modoDemo()) return;
        if (this.cambiosPendientes && !window.confirm('Voy a reemplazar el borrador local con las fuentes guardadas. ¿Descarto mis cambios?')) return;
        const solicitud = ++this.solicitud;
        const revision = this.revision;
        this.cargando.set(true);
        this.error = '';
        this.mensaje = '';
        forkJoin({ perfil: this.preferencias.obtenerPreferencias(), cv: this.preferencias.obtenerCvBase() })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: ({ perfil, cv }) => {
                    if (solicitud !== this.solicitud) return;
                    this.cargando.set(false);
                    if (!perfil.exito || !cv.exito) {
                        this.error = 'No pude cargar las fuentes. Conservé el borrador anterior. Podés reintentar.';
                        return;
                    }
                    if (revision !== this.revision) {
                        this.mensaje = 'Conservé las ediciones realizadas durante la carga. Recargá explícitamente si querés reemplazarlas.';
                        return;
                    }
                    // Tomo sólo campos del candidato; nunca las políticas, roles objetivo o texto del perfil efectivo.
                    const candidato = perfil.datos?.perfil_efectivo?.candidato;
                    this.fuenteCv = cv.datos?.cv_base ?? '';
                    this.nombre = candidato?.nombre ?? '';
                    this.resumen = candidato?.perfil_profesional ?? '';
                    this.habilidades = (candidato?.tecnologias_detalle ?? [])
                        .filter(t => ['basico', 'medio', 'avanzado'].includes(t.nivel) && t.importancia !== 'penalizable')
                        .map(t => t.nombre).join(', ');
                    this.fuentePerfil = [this.nombre, this.resumen, this.habilidades].filter(Boolean).join('\n\n');
                    this.ambasFuentes = !!this.fuenteCv.trim() && !!this.fuentePerfil.trim();
                    this.contacto = '';
                    this.enlaces = '';
                    this.incluirResumen = false;
                    this.incluirHabilidades = true;
                    this.bloques = this.separarBloques(this.fuenteCv);
                    this.secciones = ['perfil', 'contenido', 'habilidades'];
                    this.enfoque = 'desarrollo';
                    this.cargado = true;
                    this.vistaPrevia = false;
                    this.revisionConfirmada = false;
                    this.cambiosPendientes = false;
                },
                error: () => {
                    if (solicitud !== this.solicitud) return;
                    this.cargando.set(false);
                    this.error = 'No pude cargar las fuentes. Conservé el borrador anterior. Podés reintentar.';
                },
            });
    }

    private separarBloques(texto: string): BloqueCv[] {
        const bloques: BloqueCv[] = [];
        let titulo = '';
        let lineas: string[] = [];
        let enCodigo = false;
        const guardar = () => {
            if (titulo || lineas.join('\n').trim()) {
                bloques.push({ id: ++this.siguienteId, titulo, texto: lineas.join('\n').trim(), incluir: false });
            }
        };
        // shortcut: sólo separo encabezados ATX fuera de cercas; otros formatos quedan como texto para revisión manual.
        for (const linea of texto.split('\n')) {
            if (/^\s*(```|~~~)/.test(linea)) enCodigo = !enCodigo;
            const encabezado = !enCodigo && /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(linea);
            if (encabezado) {
                guardar();
                titulo = encabezado[1];
                lineas = [];
            } else {
                lineas.push(linea);
            }
        }
        guardar();
        return bloques;
    }

    editar(): void {
        this.revision++;
        this.cambiosPendientes = true;
        this.revisionConfirmada = false;
        this.vistaPrevia = false;
    }

    editarResumen(valor: string): void {
        this.resumen = valor;
        this.incluirResumen = !!valor.trim();
        this.editar();
    }

    cambiarEnfoque(valor: Enfoque): void {
        this.enfoque = valor;
        const patron = this.enfoques.find(e => e.valor === valor)!.patron;
        this.bloques = [...this.bloques].sort((a, b) =>
            Number(patron.test(`${b.titulo} ${b.texto}`)) - Number(patron.test(`${a.titulo} ${a.texto}`)));
        this.editar();
    }

    get evidenciaLimitada(): boolean {
        const patron = this.enfoques.find(e => e.valor === this.enfoque)!.patron;
        return this.bloques.filter(b => b.texto.trim() && patron.test(`${b.titulo} ${b.texto}`)).length < 2;
    }

    agregarBloque(): void {
        this.bloques = [...this.bloques, { id: ++this.siguienteId, titulo: '', texto: '', incluir: false }];
        this.editar();
    }

    moverBloque(indice: number, paso: number): void {
        this.mover(this.bloques, indice, paso);
    }

    moverSeccion(indice: number, paso: number): void {
        this.mover(this.secciones, indice, paso);
    }

    private mover<T>(elementos: T[], indice: number, paso: number): void {
        const destino = indice + paso;
        if (destino < 0 || destino >= elementos.length) return;
        [elementos[indice], elementos[destino]] = [elementos[destino], elementos[indice]];
        this.editar();
    }

    get enlacesSeguros(): string[] {
        return this.enlaces.split('\n').map(e => e.trim()).filter(e => this.esEnlaceSeguro(e));
    }

    private esEnlaceSeguro(enlace: string): boolean {
        if (!/^(https?:\/\/|mailto:)/i.test(enlace) || /[\s\u0000-\u001f\u007f]/.test(enlace)) return false;
        try {
            const url = new URL(enlace);
            return url.protocol === 'mailto:' ? !!url.pathname : !!url.hostname && !url.username && !url.password;
        } catch {
            return false;
        }
    }

    get hayEnlacesInvalidos(): boolean {
        return this.enlaces.split('\n').some(e => e.trim() && !this.esEnlaceSeguro(e.trim()));
    }

    get faltanDatos(): boolean {
        return !this.nombre.trim() || (!this.contacto.trim() && !this.enlacesSeguros.length);
    }

    previsualizar(): void {
        if (this.cargado && this.revisionConfirmada && !this.cargando()) this.vistaPrevia = true;
    }

    imprimir(): void {
        if (this.vistaPrevia && this.revisionConfirmada) window.print();
    }

    confirmarSalida(): boolean {
        return !this.cambiosPendientes || window.confirm('El borrador sólo vive en esta pestaña. ¿Salgo y descarto mis cambios?');
    }

    @HostListener('window:beforeunload', ['$event'])
    avisarSalida(evento: BeforeUnloadEvent): void {
        if (this.cambiosPendientes) {
            evento.preventDefault();
            evento.returnValue = '';
        }
    }
}

import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { defer, of, throwError, timer, switchMap } from 'rxjs';
import { Oferta, ItemRequisitoExplicacion } from '../src/app/modelos/oferta.model';

export const FECHA_DETALLE = '2026-01-15T18:00:00.000Z';
const requisito = (nombre: string, oferta: string, perfil: string, tipo: ItemRequisitoExplicacion['tipo'] = 'obligatorio'): ItemRequisitoExplicacion => ({
    requisito: nombre, tipo, evidencia_oferta: oferta, evidencia_perfil: perfil,
    explicacion: `Comparo el requisito ${nombre} con la evidencia declarada; no infiero experiencia ausente.`,
});

// Mantengo los mismos datos antes/después; cada carga obtiene su propia copia.
export function crearOfertasDetalle(escenario: string): Oferta[] {
    const base: Oferta = {
        id: 501, titulo: 'Frontend Angular junior · oferta sintética', empresa: 'Laboratorio sintético del Sur',
        ubicacion: 'Buenos Aires, Argentina', modalidad: 'Híbrido', plataforma: 'linkedin',
        descripcion: 'Buscamos una persona junior para desarrollar interfaces Angular y TypeScript.\n\nOfrecemos mentoría, revisión de código y pruebas funcionales. Valoramos herramientas de IA con revisión humana.\n\nRequisitos: Angular, SQL básico. Docker deseable. Horario a confirmar con el equipo.',
        url: 'https://example.invalid/ofertas/501', nivel_requerido: 'Junior',
        salario_min: '800000', salario_max: '1200000', moneda: 'ARS',
        estado_evaluacion: 'aprobada', razon_evaluacion: 'Cumplo Angular y el nivel junior. Debo confirmar el horario; Docker es deseable.',
        porcentaje_match: 84, estado_postulacion: 'no_postulado', fecha_postulacion: null, nota_postulacion: null,
        fecha_publicacion: '2026-01-13T12:00:00.000Z', fecha_publicacion_aproximada: true,
        fecha_extraccion: '2026-01-14T18:00:00.000Z', fecha_ultima_extraccion: FECHA_DETALLE,
        datos_crudos: null, firma_criterios_evaluacion: 'criterios-sinteticos-v1', vigencia_evaluacion: 'actual',
        prioridad_ia: true, puntaje_prioridad_ia: 6,
        evidencias_prioridad_ia: ['El aviso valora herramientas de IA con revisión humana; no reemplaza requisitos excluyentes.'],
        origen_descripcion: 'scraper', descripcion_completitud: 'completa',
        explicacion_evaluacion: {
            desglose_disponible: true,
            cumplidos: [requisito('Angular y TypeScript', 'Desarrollo de interfaces Angular y TypeScript.', 'Proyecto sintético con componentes y formularios Angular.')],
            no_cumplidos: [requisito('Docker deseable', 'Valoramos Docker, sin carácter excluyente.', 'No declaro experiencia con Docker.', 'deseable')],
            por_confirmar: [requisito('Horario de trabajo', 'Horario a acordar con el equipo.', 'Disponibilidad no confirmada.', 'desconocido')],
            exclusiones: [],
        },
    };
    const cambios: Record<string, Partial<Oferta>> = {
        aprobada: {},
        rechazada: {
            estado_evaluacion: 'rechazada', porcentaje_match: 88,
            razon_evaluacion: 'Rechazo por Java obligatorio; la compatibilidad alta y la prioridad IA no compensan la exclusión.',
            explicacion_evaluacion: { ...base.explicacion_evaluacion!, exclusiones: [
                requisito('Java obligatorio', 'Java es requisito obligatorio para el puesto.', 'No declaro Java; lo excluyo explícitamente.'),
            ] },
        },
        pendiente: { estado_evaluacion: 'pendiente', porcentaje_match: 97, razon_evaluacion: null, explicacion_evaluacion: null, firma_criterios_evaluacion: null },
        error: { estado_evaluacion: 'pendiente', porcentaje_match: null, razon_evaluacion: null, explicacion_evaluacion: null,
            firma_criterios_evaluacion: null, evaluacion_error_mensaje: 'Servicio sintético no disponible (HTTP 503).' },
        'reevaluacion-fallida': { evaluacion_error_mensaje: 'La reevaluación sintética falló por tiempo de espera.' },
        desactualizada: { estado_evaluacion: 'pendiente', evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA', vigencia_evaluacion: 'anterior' },
        historica: { explicacion_evaluacion: null, firma_criterios_evaluacion: null, vigencia_evaluacion: 'desconocida' },
        postulada: { estado_postulacion: 'cv_enviado', fecha_postulacion: '2026-01-14', nota_postulacion: 'Envié un CV sintético. Pendiente de respuesta; no realicé una postulación real.' },
        'textos-largos': { titulo: `Frontend sintética ${'AccesibilidadSinEspacios'.repeat(12)}`,
            empresa: `Empresa sintética ${'NombreCorporativoExtenso'.repeat(10)}`,
            descripcion: `${base.descripcion}\n\n${'Responsabilidades sintéticas: revisar accesibilidad y documentar decisiones. '.repeat(60)}\n${'IdentificadorSinEspacios'.repeat(40)}` },
    };
    if (!(escenario in cambios)) throw new Error(`Escenario de detalle no previsto: ${escenario}`);
    return structuredClone([{ ...base, ...cambios[escenario] }, {
        ...base, id: 502, titulo: 'Segunda oferta sintética para comprobar borradores independientes',
        url: 'https://example.invalid/ofertas/502', prioridad_ia: false,
    }]);
}

export function crearHttpDetalle(ofertas: Oferta[], parametros: URLSearchParams) {
    // Nunca comparto referencias con el Dashboard: su actualización optimista no altera el servidor.
    // Variante optativa: preservo intacta la fixture v1 usada en las comparaciones históricas.
    if (parametros.get('extremosDetalle') === '1') {
        ofertas[0].url = `https://example.invalid/${'RutaSinEspacios'.repeat(200)}`;
        ofertas[0].nota_postulacion = 'NotaSinEspacios'.repeat(200);
    }
    const guardadas = structuredClone(ofertas);
    const errores = new Set((parametros.get('errorDetalle') || '').split(','));
    const demoras = (parametros.get('demoraDetalle') || '0').split(',').map(Number);
    let revision = 0;
    const responder = (datos: unknown) => of(new HttpResponse({ body: { exito: true, datos: structuredClone(datos) } }));
    const fallar = (status: number, error: string) => throwError(() => new HttpErrorResponse({ status, error: { exito: false, error } }));
    return (solicitud: HttpRequest<unknown>, ruta: string) => {
        if (solicitud.method === 'GET' && ruta === '/ofertas') return responder(guardadas);
        if (solicitud.method === 'GET' && ruta === '/ofertas/sincronizacion') return of(new HttpResponse({ body: {
            exito: true, datos: structuredClone(guardadas), total: guardadas.length, total_inicial: guardadas.length,
            max_id: 502, fecha_corte: FECHA_DETALLE, cursor_siguiente: null, completada: true,
        } }));
        const coincidencia = ruta.match(/^\/ofertas\/(\d+)(?:\/(postulacion|seguimiento|descripcion))?$/);
        const reevaluar = ruta === '/evaluacion/ejecutar' && solicitud.method === 'POST';
        if (!coincidencia && !reevaluar) return null;
        const cuerpo = (solicitud.body || {}) as Record<string, unknown>;
        const operacion = reevaluar ? 'reevaluacion' : coincidencia![2];
        const id = reevaluar ? (cuerpo['ids'] as number[] | undefined)?.[0] : Number(coincidencia![1]);
        const oferta = guardadas.find(item => item.id === id);
        if (!oferta) return fallar(404, 'No encontré la oferta sintética.');
        if (solicitud.method === 'GET' && !operacion) return responder(oferta);
        if ((!reevaluar && solicitud.method !== 'PATCH') || !operacion) return fallar(405, 'Método sintético no permitido.');
        const demora = demoras[Math.min(revision++, demoras.length - 1)] || 0;
        // Capturo el cuerpo de esta revisión; sólo confirmo el servidor al emitir su respuesta.
        const cambios = structuredClone(cuerpo);
        return timer(Math.max(0, Math.min(demora, 10000))).pipe(switchMap(() => defer(() => {
            if (errores.has(operacion)) return fallar(503, `No pude guardar ${operacion}: error HTTP sintético.`);
            if (errores.has(`validacion-${operacion}`)) return fallar(400, `Validación sintética de ${operacion}: revisá los datos.`);
            if (operacion === 'postulacion') {
                if (!['no_postulado', 'cv_enviado', 'en_proceso', 'descartada'].includes(String(cambios['estado_postulacion']))) return fallar(400, 'Estado manual inválido.');
                oferta.estado_postulacion = cambios['estado_postulacion'] as Oferta['estado_postulacion'];
            } else if (operacion === 'seguimiento') {
                const fecha = cambios['fecha_postulacion'];
                const nota = cambios['nota_postulacion'];
                if (fecha != null && fecha !== '' && (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(Date.parse(`${fecha}T00:00:00Z`)) || new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) !== fecha)) return fallar(400, 'Fecha de postulación inválida.');
                if (nota != null && (typeof nota !== 'string' || Array.from(nota).length > 4000)) return fallar(400, 'La nota supera los 4000 caracteres Unicode.');
                if ('fecha_postulacion' in cambios) oferta.fecha_postulacion = (fecha || null) as string | null;
                if ('nota_postulacion' in cambios) oferta.nota_postulacion = (nota || null) as string | null;
            } else if (operacion === 'descripcion') {
                const descripcion = cambios['descripcion'];
                if (typeof descripcion !== 'string' || descripcion.trim().length < 20 || descripcion.trim().length > 50000) return fallar(400, 'La descripción debe tener entre 20 y 50000 caracteres.');
                oferta.descripcion_original ??= oferta.descripcion;
                Object.assign(oferta, { descripcion: descripcion.trim(), origen_descripcion: 'manual', descripcion_completitud: 'completa',
                    descripcion_modificada_en: FECHA_DETALLE, estado_evaluacion: 'pendiente', evaluacion_error_mensaje: 'REEVALUACION_SOLICITADA' });
            } else {
                const ids = parametros.has('tabla') ? cambios['ids'] as number[] : [oferta.id];
                if (!ids?.length || !ids.every(id => guardadas.some(item => item.id === id))) return fallar(400, 'IDs de reevaluación inválidos.');
                guardadas.filter(item => ids.includes(item.id)).forEach(item => item.estado_evaluacion = 'pendiente');
                return of(new HttpResponse({ body: { exito: true, en_curso: true, cantidad: ids.length, mensaje: 'Reevaluación sintética iniciada' } }));
            }
            return responder(oferta);
        })));
    };
}

# API REST — Busca Empleos

## Resultados por fuente e historial (issue #20)

Los individuales conservan los campos anteriores y agregan `datos.fuente`, el mismo
objeto que integra `ultimoResultado.fuentes[]` en ciclo/cron. Leo su `estado`, no deduzco
éxito por estar activa en el registry. Estados: `completada`, `sin_resultados`, `parcial`,
`error`, `timeout`, `sin_credenciales`, `deshabilitada`, `cancelada`; el ciclo agrega `omitida` para
consultas incompatibles. Solo si GetOnBrd está deshabilitado conservo `datos.estado: "bloqueado"`
por compatibilidad; `datos.fuente.estado` es `deshabilitada`, con motivo del registry y cero peticiones.
Si está habilitado, `datos.estado` refleja el resultado real, nunca un bloqueo fijo.

Ejemplo **sintético ilustrativo**, no resultado de un proveedor real:

```json
{
    "plataforma": "linkedin", "estado": "parcial", "estadoScraping": "parcial",
    "nuevas": 1, "actualizadas": 0, "reapariciones": 0, "duplicadas": 0,
    "erroresGuardado": 0, "totalExtraidas": 1, "totalCrudos": 1, "totalElegibles": 1,
    "consultasEjecutadas": 2, "peticionesRealizadas": null, "idiomaDescartadas": 0,
    "duracionMs": 42, "duracionScrapingMs": 40, "motivoFinalizacion": "http",
    "errores": [{ "tipo": "http", "codigoHttp": 503, "mensaje": "El proveedor rechazó la petición." }],
    "resultadosConsultas": [
        { "consulta": "junior", "estado": "completada", "peticionesRealizadas": null, "totalCrudos": null, "errores": [] },
        { "consulta": "soporte", "estado": "error", "peticionesRealizadas": null, "totalCrudos": null, "errores": [{ "tipo": "http", "codigoHttp": 503 }] }
    ]
}
```

No atribuyo persistencia ni IA por consulta. `duplicadas` es el contador legacy de
existentes (puede incluir actualizadas/reapariciones), no una categoría adicional para
sumar. `duplicadasDescartadas` informa deduplicación previa de #16. `null` significa
no medible, nunca cero ni costo exacto. `estadoScraping` permanece separado de errores
al guardar; `estado` incluye el resultado del ingreso.

Individual: 200 para éxito, vacío válido, parcial o fuente no ejecutable; 502 para
fallo del proveedor, 504 para timeout y 500 para fallo total del ingreso. El cuerpo
conserva `datos.fuente` en esos errores. Fallo al iniciar historial: 503 sin scraping.
`datos.historial` informa `{ id, guardado }`, con `error` si no pude finalizarlo;
el resultado de scraping no se descarta por ese fallo. El ciclo conserva su 202;
si falla el registro posterior, expone `ultimoResultado.errorHistorial` y `progreso.error`.
La evaluación global no es atribuible a las fuentes de esta búsqueda.

`GET /api/automatizacion/historial` requiere autenticación existente y responde
`{ exito: true, datos: [{ id, tipo, inicio, fin, estado, duracion_ms, resumen }] }`.
`tipo` es `individual`, `ciclo_manual` o `cron`; `id` y `duracion_ms` pueden ser strings
numéricos de PostgreSQL. `resumen` contiene `estado`, `fuentes[]` sanitizadas y
`evaluacionGlobal: true` (indicador de alcance, no resultado de evaluación).
Las filas en curso usan `estado: "ejecutando"` y `fin: null`; tras reinicio,
`estado: "interrumpida"` nunca equivale a éxito. Lista hasta 20, más recientes primero.
Lectura fallida: 503, nunca lista vacía fingida. Esta ruta hereda el límite de 5/min
del router de automatización; consulto al abrir/terminar una ejecución, no en cada tick de progreso.

El estado del cron agrega `zonaHoraria` y `errorCron`. Los POST iniciar/detener esperan
persistencia y aplicación real: 400 para configuración inválida, 503 para fallo operativo,
con estado local en `datos`. Detener es idempotente y persiste inactivo aunque no haya tarea.

## Configuración efectiva de búsquedas (issue #13)

Consulto `GET /api/scraping/previsualizacion` con autenticación Firebase. Devuelve
HTTP 200, `{ exito: true, datos: { plataformas: ResumenBusqueda[] } }`, sin llamar
proveedores, evaluar ofertas ni crear/actualizar preferencias. Representa lo guardado,
no el formulario local. Una falla de lectura devuelve 503; no sustituyo por defaults.

```typescript
interface ResumenBusqueda {
    plataforma: string; // ID canónico: google_jobs, no google-jobs.
    nombre: string;
    habilitada: boolean; // Estado del registry, no prueba de conectividad.
    ejecutable: boolean; // Configuración utilizable y credenciales presentes cuando corresponden.
    motivoOmision?: string; // Consulta incompatible con esta fuente; no falta de credenciales.
    terminos: string[]; // Vacío para integraciones de filtros fijos o inactivas.
    ubicacion: string[];
    ventanaDias: number | null; // null: esta integración no aplica ventana.
    maxResultados: number; // Techo local; Bumeran no lo envía al actor.
    filtros: Record<string, unknown>;
    consultasEfectivas?: string[] | Record<string, unknown>;
    equivalenciasAplicadas?: Record<string, string | string[]>;
    advertencias: string[];
    origen: {
        terminos: 'ejecucion' | 'preferencias' | 'defecto' | 'fijo';
        ubicacion: 'ejecucion' | 'preferencias' | 'defecto' | 'fijo';
    };
}
```

Los POST individuales y `POST /api/automatizacion/ejecutar` admiten un objeto opcional
con `terminos` (alias `terminos_busqueda`, nunca ambos), `maxResultados` y `ubicacion`.
También admito `ubicaciones` no vacío para LinkedIn, sin combinarlo con `ubicacion`.
Rechazo campos desconocidos, tipos inválidos y términos vacíos/blancos con 400 antes
de invocar proveedores. Admito hasta 100 textos de 200 caracteres y `maxResultados`
entero de 1 a 500; Adzuna conserva su cap de 50. `[]` explícito o persistido no activa
defaults: rechazo la ejecución individual/ciclo con 400 antes de todos los proveedores, incluso los de filtros fijos; preview conserva `[]` para fuentes que requieren términos,
`ejecutable: false` y una advertencia. Los overrides nunca actualizan preferencias.
Defaults: LinkedIn/Indeed 100, GetOnBrd 40 y las demás fuentes 50. En Bumeran aplico el límite local, no sobre el consumo del actor. Para Jooble, `filtros.maxPaginasPorTermino` refleja el override validado de la ejecución; si no lo recibo, informo y aplico 2 páginas por término.
Valido también la consulta luego de la transformación existente: Computrabajo
rechaza cualquier término que quede vacío al quitar signos (por ejemplo `###`),
sin enviar una URL genérica. Las fuentes que fragmentan palabras conservan su
rechazo cuando no queda ninguna palabra utilizable. No agrego reglas nuevas de matching.

`maxResultados` delimita el techo estricto de ofertas útiles devueltas en todas las fuentes (issue #16).
En Jooble, RemoteOK y Computrabajo, las ofertas se deduplican y filtran por fecha antes de contar contra
el cupo, y el lote final se recorta determinísticamente con `slice(0, maxResultados)`.
Las respuestas individuales de scraping incluyen métricas completas de ejecución:
`maxResultados`, `ventanaDias`, `consultasEjecutadas`, `consultasOmitidas`, `totalCrudos`, `totalElegibles`,
`duplicadasDescartadas`, `antiguasDescartadas`, `sinFechaConocida` y `motivoFinalizacion`
(`'limite_resultados'`, `'limite_peticiones'`, `'limite_paginas'` o `'agotado'`).
Bumeran informa el límite configurable local (`maxResultados` numérico), con advertencia de que el actor no recibe ese límite ni garantiza un techo de costo. Elimino términos exactamente repetidos después de recortar espacios, sin modificar las preferencias guardadas.

Un POST individual activo agrega `datos.configuracion: ResumenBusqueda` y
`datos.descartadas_por_idioma`, manteniendo contadores existentes. Adzuna sin
credenciales también devuelve su configuración y advertencia existente.
El ciclo valida y reserva antes del 202, sin esperar extracción/evaluación; conserva
409 si otro ciclo está activo y 503 ante falla de lectura. El 202 agrega
`datos.configuracion: ResumenBusqueda[]`. Polling de `/api/automatizacion/progreso`
expone la misma lista en `datos.configuracion`; `/api/automatizacion/estado` conserva
la lista ejecutada en `datos.ultimoResultado.configuracion` al finalizar. No confundo
preview actual con el snapshot de un ciclo anterior. Ante error de preparación,
libero la reserva y no acepto ni ejecuto el ciclo.

Si los términos globales son válidos pero una transformación existente deja una
consulta inutilizable, el individual devuelve 400. Ciclo y cron omiten únicamente
esa fuente: el resumen incluye `motivoOmision` y la misma advertencia; el paso del
polling informa `estado: "omitida"`, `motivo` y `extraidas: 0`. El resultado final
incluye `omisiones: [{ plataforma, motivo }]`, separado de `errores` y de los
contadores. Completar el proceso no significa que todas las fuentes se ejecutaron.
Con `['QA']`, LinkedIn/Computrabajo/Glassdoor reciben los mismos términos;
Indeed/Jooble/Adzuna/Bumeran se omiten, sin defaults ni escritura de preferencias.
No uso `ejecutable: false` como causa genérica de omisión: los controles vigentes
de credenciales y fuentes deshabilitadas se mantienen. Tipos/aliases/límites
inválidos y lectura fallida siguen abortando todo el ciclo antes del 202.

Ejemplo parcial de preview, cuando hay credenciales configuradas:

```json
{
    "exito": true,
    "datos": {
        "plataformas": [{
            "plataforma": "linkedin",
            "nombre": "LinkedIn",
            "habilitada": true,
            "ejecutable": true,
            "terminos": ["soporte IT", "mesa de ayuda"],
            "ubicacion": ["CABA", "GBA Oeste"],
            "ventanaDias": 14,
            "maxResultados": 100,
            "filtros": { "nivelesExperiencia": ["internship", "entry_level"] },
            "advertencias": [],
            "origen": { "terminos": "preferencias", "ubicacion": "preferencias" }
        }]
    }
}
```

La lista real incluye todas las plataformas del registry. Muestro los filtros y
advertencias del backend sin deducir capacidades por nombre desde el frontend.
GetOnBrd usa `habilitada`/`ejecutable` de esta misma preview: dependen de
`GETONBRD_ENABLED=true` y de verificar la evidencia pública conservada. `advertencias` explica
el bloqueo y las preferencias incompatibles; no deduzco habilitación solo del flag en frontend.
Su `consultasEfectivas` conserva los términos guardados o explícitos y `filtros` informa
`maxPeticiones` (2 por defecto, máximo 10), `porPagina` (20) y `timeoutMs` (5000).
Google Jobs e InfoJobs conservan su respuesta inactiva y cero requests.
No activo cron al consultar ni al ejecutar manualmente.

### GetOnBrd individual

`POST /api/scraping/getonbrd` acepta las opciones comunes `terminos`/`terminos_busqueda`,
`maxResultados` (40 por defecto) y `maxPeticiones`. No acepta `destino`, evidencia ni banderas
de habilitación desde HTTP. Usa la persistencia común y devuelve nuevas, actualizadas,
reapariciones, duplicadas y errores de guardado en `datos.fuente`, más historial.
La ventana local es de 30 días; no envío ubicación ni otros filtros incompatibles al proveedor.

Una respuesta parcial mantiene HTTP 200 y `fuente.estado: 'parcial'`, ofertas ingresadas,
`errores` y `checkpoint`. Un fallo externo sin ofertas devuelve 502 (`error`), o 504 (`timeout`),
con `exito: false`; una cancelación conserva `cancelada`. HTTP 429 aparece como
`errores: [{ tipo: 'limite_solicitudes', codigoHttp: 429 }]`, sin reintentos.
Los campos `checkpoint` y `run_id` están en la fuente cuando el scraper se ejecutó;
el historial conserva un checkpoint saneado. No expongo una ruta nueva de reanudación.
Ver [evidencia y rollback](scraping.md#getonbrd--api-pública-con-habilitación-controlada).

## CV base editable — documento fuente (issue #12)

Uso GET y PUT `/api/preferencias/cv-base`, con la misma autenticación Firebase
que el resto de la API. Mantengo esta fuente privada separada del perfil confirmado.
No leo un CV del repositorio ni ejecuto IA, evaluación, scraping o invalidación de caché.

Ambos métodos devuelven HTTP 200 y `{ exito: true, datos: { cv_base,
cv_base_actualizado_en } }`. GET sin documento devuelve ambos campos `null`;
un documento guardado vacío devuelve `cv_base: ""` y su fecha ISO 8601.
PUT devuelve el texto persistido y la fecha generada por PostgreSQL, no por el cliente.

En PUT envío **el texto crudo**, no JSON, con `Content-Type: text/plain` o
`text/markdown`, opcionalmente `charset=utf-8` (también entre comillas).
Admito hasta **1048576 bytes UTF-8 inclusive**, sin costo de envoltorio JSON.
Conservo espacios, Markdown, BOM y saltos de línea exactamente; no recorto ni normalizo.
Un cuerpo de cero bytes guarda un documento vacío; no borra ni restablece la ausencia.
Rechazo UTF-8 inválido y NUL con 400, exceso con 413, tipo/charset/codificación
comprimida no admitidos con 415. No admito JSON, multipart ni `null` como cuerpo.
Los errores usan `{ exito: false, error }`; un fallo de BD devuelve 500 genérico
sin registrar ni exponer el documento. No aumento el límite JSON global.

Para Angular envío un string con ese Content-Type y el token del interceptor;
calculo el límite con `new TextEncoder().encode(texto).length`. Distingo `null`
de `""` al cargar. Uso la fecha retornada sólo tras guardar exitosamente.
Guardar fuente, analizar su snapshot mediante el importador existente, aplicar la
revisión y guardar preferencias siguen siendo cuatro acciones independientes.


## Perfil efectivo de solo lectura (issue #8)

GET `/api/preferencias` y PUT `/api/preferencias` conservan su envoltorio
`{ exito, datos, mensaje? }`. Agrego `datos.perfil_efectivo`, derivado de la fila
persistida devuelta por el modelo, nunca del formulario sin guardar. PUT ignora
este campo de solo lectura: no se almacena ni constituye una fuente alternativa.
Después de guardar, uso los valores retornados y refresco la vista; cambios locales
pendientes no están representados en ella.

Contrato para el consumidor frontend (los tipos se documentan acá; no agrego archivos frontend):

```typescript
interface TecnologiaConfirmada {
    nombre: string;
    nivel: 'ninguno' | 'basico' | 'medio' | 'avanzado';
    categoria: string;
    importancia?: string;
    aliases?: string[];
    evidencia?: string;
}
interface RolConfirmado {
    rol: string;
    prioridad: 'alta' | 'media' | 'baja';
    aliases?: string[];
    evidencia?: string;
}
interface InglesConfirmado {
    espanol?: string | null;
    reading?: string | null;
    writing?: string | null;
    speaking?: string | null;
    listening?: string | null;
    regla?: string | null;
}
interface PerfilEfectivo {
    version: 1;
    candidato: {
        nombre: string | null;
        nivel_real_seniority: string | null;
        anios_experiencia_reales: number | null;
        perfil_profesional: string | null; // Experiencia y proyectos confirmados, sin inferir años.
        tecnologias_detalle: TecnologiaConfirmada[];
        stack_tecnologico: string[];
        nivel_ingles_detalle: InglesConfirmado | null;
        idioma_candidato: string | null; // Solo legacy cuando falta detalle de inglés.
        conocimientos_ausentes: string[];
        limitaciones_explicitas: string | null; // TEXT en el esquema, no array.
    };
    restricciones: {
        preferencias: {
            roles_objetivo_detalle: RolConfirmado[]; // Objetivos de búsqueda, no experiencia.
            modalidad_aceptada: string | null;
            zonas_preferidas: string[] | null;
            reglas_exclusion: string[] | null;
            disponibilidad: string | null;
            expectativa_salarial_min: number | string | null; // pg NUMERIC puede devolver string.
            expectativa_salarial_max: number | string | null;
            moneda_salarial: string | null;
            keywords_positivas: string[] | null;
            keywords_negativas: string[] | null;
            plataformas_preferidas: string[] | null;
            plataformas_excluidas: string[] | null;
        };
        politicas_sistema: string[]; // Java, Senior/SR/Lead, 3+ años, inglés requerido y geografía.
    };
    secciones: { id: string; titulo: string; texto: string }[];
    texto: string; // Exactamente secciones.map(s => s.texto).join('\n\n'), incluido en proveedor.
}
```

En PUT, omitir un campo conserva su valor persistido. El frontend envía solo controles
modificados y acciones explícitas: no materializa detalles ausentes/null al editar un
nombre ni elimina compatibilidad legacy de stack, idioma o nivel. `idioma_candidato: null`
expresa borrado del resumen; una cadena vacía o un valor no textual sigue respondiendo
400. Un detalle de inglés `{}` o con subcampos vacíos/null es una edición explícita,
no se completa con niveles ni reactiva el resumen anterior. `[]` confirma eliminación,
no ausencia. Aplicar CV no reemplaza roles objetivo ni los restantes criterios laborales.

PUT acepta `stack_tecnologico: []`, `roles_objetivo_detalle: []` y
`tecnologias_detalle: []` como eliminaciones explícitas. Si envío tecnologías
detalladas, el modelo deriva el stack aunque también envíe el anterior; excluye
nivel `ninguno`. Los tipos/niveles/categorías y evidencia siguen validados en HTTP.
Ubico los roles objetivo en `restricciones.preferencias.roles_objetivo_detalle`,
no en `candidato`: querer un puesto no acredita haberlo desempeñado. Conservo `[]`.
No cambio términos de búsqueda ni restricciones al editar hechos del candidato.
Inglés C1 no desactiva la exclusión obligatoria de ofertas que requieran inglés
avanzado ni menciones genéricas obligatorias («English required», «inglés requerido»,
«inglés obligatorio/excluyente») sin nivel especificado: esa política no es una
afirmación sobre la capacidad lingüística.
`reglas_exclusion: []` tampoco desactiva políticas obligatorias. Preferencias
laborales son criterios para IA salvo geografía presencial, que tiene defensa
programática. El prompt personalizado sigue almacenado intacto y solo agrega
criterios, no hechos ni permisos para quitar restricciones. Prioridad IA permanece
un ajuste del ranking, no un bonus fijo sobre el match. `filtrar_nivel_linkedin`
permite omitir `f_E=1,2` en URLs de LinkedIn sin cambiar el seniority real del perfil.

## Vista previa de documentos CV sin IA (issue #23)

En `POST /api/preferencias/importar-cv/extraer-texto` envío `multipart/form-data`
con un único archivo en el campo `cv`, sin otros campos. Exijo el Bearer de Firebase
antes de recibir el archivo y aplico el limitador existente de 5 solicitudes por minuto
por IP, compartido con operaciones costosas (desactivado en tests).

Admito `.pdf` con texto seleccionable (`application/pdf`) y `.md` UTF-8
(`text/markdown` o `text/plain`); ambos admiten `application/octet-stream` si
el contenido supera las validaciones. Normalizo extensión y MIME para compararlos,
pero no modifico el texto Markdown, incluidos BOM, espacios y saltos de línea.
El máximo del archivo es **5 MiB (5242880 bytes) inclusive** y el del texto completo
es **1048576 bytes UTF-8 inclusive**, el mismo `MAX_BYTES_CV_BASE` del CV base.
Compruebo encabezado/cierre y parseo real del PDF, UTF-8 estricto en Markdown y
caracteres inválidos en ambos formatos. No recorto el contenido para hacerlo entrar.

La respuesta de éxito es exactamente:

```json
{ "exito": true, "datos": { "texto": "Nombre: Persona Sintetica", "formato": "pdf" } }
```

`formato` es `pdf` o `md`. Extraigo todas las páginas; uno su texto con dos saltos
de línea y no cuento los separadores decorativos del lector como texto útil.
Si todas las páginas quedan sin texto útil, respondo `SIN_TEXTO_EXTRAIBLE`.
Si algunas tienen texto y otras quedan vacías o solo con espacios, rechazo el PDF
completo con HTTP422 `EXTRACCION_INCOMPLETA`, sin `datos` ni texto parcial, y ofrezco
pegarlo manualmente. Es una política conservadora: también rechazo documentos válidos
que incluyan una página en blanco, o mezclen páginas de texto con páginas escaneadas.
El lector no distingue esas páginas de ciertas pérdidas de contenido por corrupción,
aun con `stopAtErrors`; no garantizo detectar corrupción arbitraria ni pérdidas dentro
de una página que todavía devuelva texto. No realizo OCR ni admito DOCX; un documento
escaneado sin texto seleccionable no se puede extraer.
No guardo bytes originales ni texto en disco o PostgreSQL, no modifico CV base,
preferencias, ofertas, postulaciones o notas, no invoco DeepSeek ni registro contenido
privado o errores crudos del parser. El resultado es texto para revisar, no un perfil aplicado.

Los errores documentales devuelven exactamente `{ exito: false, codigo, error }`,
sin `datos` ni texto parcial:

| HTTP | código | error |
| --- | --- | --- |
| 400 | `FORMATO_NO_ADMITIDO` | Admito únicamente PDF con texto seleccionable o Markdown (.md). Podés pegar el texto manualmente. |
| 400 | `CARGA_INVALIDA` | Enviá un único documento en el campo cv. Podés pegar el texto manualmente. |
| 413 | `DOCUMENTO_DEMASIADO_GRANDE` | El documento no puede superar 5 MiB. Podés pegar el texto manualmente. |
| 413 | `TEXTO_DEMASIADO_GRANDE` | El texto completo supera 1048576 bytes. No lo recorté. Reducí el documento o pegá texto manualmente. |
| 422 | `DOCUMENTO_INVALIDO` | El documento está dañado o no coincide con el formato declarado. Podés pegar el texto manualmente. |
| 422 | `SIN_TEXTO_EXTRAIBLE` | No pude recuperar texto del documento. Podés pegarlo manualmente; no realizo OCR. |
| 422 | `TEXTO_INVALIDO` | Necesito texto UTF-8 válido sin caracteres de control inválidos. Podés pegar el texto manualmente. |
| 422 | `EXTRACCION_INCOMPLETA` | No pude extraer todas las páginas de forma completa. Podés pegar el texto manualmente. |

Conservo las respuestas existentes de autenticación (401/403) y limitación (429),
con `{ exito: false, error }` sin `codigo`. Esta extracción no modifica el contrato de
`/importar-cv/analizar`: el análisis continúa recibiendo Markdown y puede rechazar
con `PRESUPUESTO_DOCUMENTO` un texto que sí entra en la vista previa, por su menor
presupuesto de mensajes de IA. No envío binarios al endpoint de análisis.

## Extracción de CV completo (issue #10)

En `POST /api/preferencias/importar-cv/analizar` envío un único Markdown en el campo
multipart `cv` (máximo 1 MiB). Analizo el contenido completo en una solicitud lógica,
sin recortar a 15000 caracteres. Uso `modelo_ia_importacion` seleccionado (Pro como
fallback), con normalización del alias Flash, razonamiento `enabled/low`,
`response_format: json_object`, `max_tokens: 16384`, timeout de 120000 ms por intento
y hasta tres reintentos transitorios. No envío temperatura. Exijo `finish_reason: stop`
y objeto JSON no vacío antes del validador. Ver [configuración por tarea](evaluacion-ia.md#configuración-del-cliente-deepseekjs).
Uso bytes UTF-8 de ambos mensajes como presupuesto conservador, **no tokens exactos**:
acepto hasta 602688 bytes de mensajes (contexto de 1000000 menos reserva de salida
máxima 393216 —384 × 1024— y margen de formato 4096). El límite efectivo del CV
es ese techo menos los bytes de instrucciones y encuadre del prompt de usuario;
un archivo permitido por Multer puede excederlo. Esta cota conservadora de entrada
no equivale al límite de salida configurado de 16384 tokens ni garantiza completitud.
Rechazo UTF-8 malformado con decodificación fatal, sin sustituir bytes silenciosamente.
Referencia de límites: https://api-docs.deepseek.com/quick_start/pricing.

Devuelvo `{ exito: true, datos }` solamente después de validar el objeto JSON y
cada campo presente: enums compartidos con PUT, objetos de tecnologías/roles,
aliases, listas de strings, inglés anidado, preguntas y salarios numéricos finitos
entre 0 y 999999999 (mínimo no mayor que máximo). Plataformas usan ids canónicos;
zonas admiten ubicaciones declaradas, no solo el catálogo de zonas. Rechazo campos
no reconocidos y objetos superiores vacíos. Acepto extracción parcial sin inventar
hechos: omisión permanece omisión, `[]` permanece vacío; `null` solo se admite en
textos/enums escalares, salarios e inglés (incluidos sus subcampos), no en listas
ni elementos de tecnologías/roles/preguntas. No convierto strings en números.
Exijo al menos un hecho útil: nombre, perfil profesional o idioma no vacío, nivel de
experiencia no null, tecnologías válidas no vacías o alguna habilidad de inglés
(`reading`, `writing`, `speaking`, `listening`) no vacía. Preguntas, advertencias,
preferencias laborales y la guía `regla` solas no bastan: respondo 422
`CONTRATO_INVALIDO`. No exijo todos los campos ni cuento espacios como información.
No guardo preferencias ni devuelvo datos crudos al fallar.

Los errores contienen `{ exito: false, codigo, error }`:

| HTTP | código | Condición |
| --- | --- | --- |
| 400 / 413 | `CARGA_INVALIDA` | Falta de archivo, archivo vacío, UTF-8 malformado, formato/campo inválido o carga superior a 1 MiB |
| 413 | `PRESUPUESTO_DOCUMENTO` | Los mensajes completos exceden el presupuesto conservador |
| 422 | `JSON_INVALIDO` | El contenido de extracción no es JSON interpretable |
| 422 | `CONTRATO_INVALIDO` | JSON válido con estructura/campos inválidos |
| 422 | `SALIDA_TRUNCADA` | El proveedor informa `finish_reason: length` |
| 422 | `SALIDA_INCOMPLETA` | Finalización distinta de `stop`, ausente o desconocida, aunque el contenido sea JSON válido |
| 502 | `PROVEEDOR_NO_DISPONIBLE` | Fallo de comunicación o respuesta del proveedor |

El prompt incluye las categorías e importancias canónicas (`mobile`, `no_prioritaria`)
y aliases opcionales, vacíos o de hasta 20 strings, sin inventarlos.

No registro contenido del CV, respuesta cruda ni mensajes privados del proveedor
en errores/reintentos de esta importación. Las restantes llamadas conservan su comportamiento.

## Firma y vigencia de evaluaciones (issue #9, T1)

GET/PUT `/api/preferencias` agregan `firma_criterios_evaluacion: string` al
envoltorio. PUT agrega `cambio_criterios: boolean`, comparando los criterios
anteriores con la fila completa efectivamente persistida (`RETURNING *`), no con
el formulario parcial. Guardar no evalúa ofertas, no hace scraping ni llama IA.
Cambios visuales, términos de búsqueda o contenido personalizado inactivo no
modifican la firma; los mensajes efectivos, modelo y contrato de reglas sí.
Conservo las reglas de PUT parcial y los valores `null`, `[]`, `{}` y `0`.

GET `/api/ofertas`, GET `/api/ofertas/:id` y GET `/api/ofertas/sincronizacion`
agregan en cada oferta:

- `firma_criterios_evaluacion: string | null`: firma guardada al evaluar con éxito;
  las filas históricas permanecen en null (sin backfill).
- `vigencia_evaluacion: 'actual' | 'anterior' | 'desconocida'`: comparación con
  los criterios actualmente guardados. Una firma diferente es anterior; una
  firma ausente, estado pendiente o error de evaluación es desconocido, nunca actual.

La vigencia describe **criterios del perfil**, no certifica que el contenido de
una oferta no haya cambiado desde su evaluación. La identidad de caché sí incluye
las entradas efectivas de cada oferta. No modifico estados manuales de postulación
ni el comportamiento existente de `fecha_evaluacion`. La migración 019 agrega
únicamente la firma nullable. T2 reutiliza `/api/evaluacion/ejecutar` para la
selección por IDs; la confirmación visual corresponde a T3.

## Base URL

```
http://localhost:3000/api
```

## Autenticación

Todos los endpoints bajo `/api/` (excepto `/api/salud`) requieren un token JWT de Firebase en el header `Authorization`.

```
Authorization: Bearer <firebase_id_token>
```

El token se obtiene desde el cliente Angular (Firebase Auth). El middleware del backend verifica:
1. Que el token sea válido (firmado por Firebase).
2. Que el email del usuario autenticado coincida con `EMAIL_AUTORIZADO` en las variables de entorno.

Si falta el token o no es válido, la API retorna `401 Unauthorized`:
```json
{ "exito": false, "error": "No autorizado." }
```

> **Nota para desarrollo local:** Los tests de Jest mockean el middleware de auth (`verificarAuth`) para poder testear los controladores sin token real.



Todas las respuestas siguen este formato:

```json
// Éxito
{ "exito": true, "datos": { ... } }

// Error
{ "exito": false, "error": "Mensaje descriptivo" }
```

## Resumen de endpoints

| Método | Ruta | Descripción | Auth | Rate Limited |
|--------|------|-------------|:----:|:----------:|
| GET | `/api/salud` | Health check del servidor | No | No |
| GET | `/api/ofertas` | Lista ofertas con filtros opcionales | **Sí** | No |
| GET | `/api/ofertas/estadisticas` | Contadores por estado de evaluación | **Sí** | No |
| GET | `/api/ofertas/diagnostico/persistencia` | Verifica qué base está leyendo la API y cuántas ofertas ve | **Sí** | No |
| GET | `/api/ofertas/:id` | Detalle de una oferta | **Sí** | No |
| PATCH | `/api/ofertas/:id/postulacion` | Actualizar estado de postulación | **Sí** | No |
| PATCH | `/api/ofertas/:id/seguimiento` | Editar fecha y nota personales | **Sí** | No |
| POST | `/api/scraping/linkedin` | Ejecutar scraping de LinkedIn | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/computrabajo` | Ejecutar scraping de Computrabajo | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/indeed` | Ejecutar scraping de Indeed | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/bumeran` | Ejecutar scraping de Bumeran | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/glassdoor` | Ejecutar scraping de Glassdoor | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/getonbrd` | Ejecutar GetOnBrd con habilitación efectiva o informar bloqueo | **Sí** | **Sí** (5/min, límite común de scraping) |
| POST | `/api/scraping/jooble` | Ejecutar scraping de Jooble | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/google-jobs` | Ejecutar scraping de Google Jobs | **Sí** | **Inactivo** — responde sin invocar Apify |
| POST | `/api/evaluacion/ejecutar` | Evaluar pendientes recientes o forzar IDs seleccionados | **Sí** | **Sí** (5/min) |
| GET | `/api/evaluacion/reintentar-errores` | Preview de candidatos actuales, solo total e IDs, sin ejecutar | **Sí** | **Sí** (5/min compartido) |
| POST | `/api/evaluacion/reintentar-errores` | Reintentar pendientes con fallo técnico reciente sin resultado previo ni seguimiento manual | **Sí** | **Sí** (5/min) |
| GET | `/api/automatizacion/estado` | Estado actual del cron | **Sí** | No |
| GET | `/api/automatizacion/historial` | Hasta 20 ejecuciones durables sanitizadas | **Sí** | **Sí** (5/min) |
| POST | `/api/automatizacion/iniciar` | Programar el cron | **Sí** | No |
| POST | `/api/automatizacion/detener` | Detener el cron | **Sí** | No |
| GET | `/api/automatizacion/progreso` | Progreso del ciclo de automatización activo | **Sí** | No |
| POST | `/api/automatizacion/ejecutar` | Ejecutar ciclo completo manual (asíncrono: 202/409) | **Sí** | No |

---

## Endpoints de ofertas

Archivo de rutas: `backend/src/rutas/ofertas.js`
Controlador: `backend/src/controladores/controlador-ofertas.js`

> **Gotcha:** La ruta `/estadisticas` se registra ANTES de `/:id` para que Express no confunda "estadisticas" con un ID.

### GET /api/ofertas

Lista las ofertas recientes y las postulaciones en seguimiento, con filtros opcionales por query params.

> **Visibilidad (#22):** Incluyo las ofertas con `COALESCE(fecha_ultima_extraccion, fecha_extraccion)` dentro de los últimos 30 días **o** estado `cv_enviado`/`en_proceso` **o** `fecha_postulacion` explícita (también en estados cerrados). Una nota sola no retiene ofertas históricas. Aplico esta misma política al conteo, estadísticas y sincronización; no amplío la cola de evaluación IA ni cambio fechas de extracción.

**Query params:**

| Param | Tipo | Valores posibles |
|-------|------|-----------------|
| `estado` | string | `pendiente`, `aprobada`, `rechazada` |
| `plataforma` | string | Id interno del registry. Se aceptan slugs HTTP como alias (ej: `google-jobs` → `google_jobs`). Ver `backend/src/config/plataformas.js` para la lista completa. |
| `estado_postulacion` | string | `no_postulado`, `cv_enviado`, `en_proceso`, `descartada` |
| `ordenar_por` | string | `fecha_extraccion`, `fecha_publicacion`, `porcentaje_match` |
| `direccion` | string | `ASC`, `DESC` (default: `DESC`) |

**Ejemplo request:**
```
GET /api/ofertas?estado=aprobada&plataforma=linkedin
GET /api/ofertas?ordenar_por=porcentaje_match&direccion=DESC
GET /api/ofertas?estado_postulacion=cv_enviado
```

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": [
        {
            "id": 1,
            "titulo": "Desarrollador Frontend Junior",
            "empresa": "TechCorp",
            "ubicacion": "Buenos Aires, Argentina",
            "modalidad": "remoto",
            "descripcion": "Buscamos desarrollador...",
            "url": "https://linkedin.com/jobs/...",
            "plataforma": "linkedin",
            "nivel_requerido": "junior",
            "salario_min": null,
            "salario_max": null,
            "moneda": null,
            "estado_evaluacion": "aprobada",
            "razon_evaluacion": "Matchea con Angular y React del perfil.",
            "porcentaje_match": 85,
            "estado_postulacion": "no_postulado",
            "fecha_publicacion": "2026-03-28T00:00:00.000Z",
            "fecha_extraccion": "2026-03-29T14:30:00.000Z",
            "fecha_ultima_extraccion": "2026-03-29T14:30:00.000Z",
            "identidad_canonica": "linkedin:4436157529",
            "datos_crudos": { ... }
        }
    ],
    "total": 1
}
```

### GET /api/ofertas/estadisticas

Retorna contadores agrupados por estado de evaluación del mismo universo visible que `GET /api/ofertas`: recientes o seguimiento activo o fecha de postulación explícita. Las reapariciones conservan la primera `fecha_extraccion` y actualizan únicamente `fecha_ultima_extraccion`.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "total": 150,
        "pendientes": 30,
        "aprobadas": 45,
        "rechazadas": 75
    }
}
```

### GET /api/ofertas/sincronizacion

Transfiere una proyección liviana del mismo universo visible que el listado por bloques, incluyendo `fecha_postulacion` (`YYYY-MM-DD` o `null`) y `nota_postulacion`. Requiere
`limite` entero entre 100 y 500 (default 500) y un `cursor` opaco opcional retornado por el
bloque previo.

```json
{
  "exito": true,
  "datos": [{ "id": 42, "titulo": "...", "prioridad_ia": true }],
  "total": 10000,
  "fecha_corte": "2026-06-15T00:00:00.000Z",
  "max_id": 10000,
  "total_inicial": 10000,
  "cursor_siguiente": "cursor-opaco-o-null",
  "completada": false
}
```

El primer bloque fija `fecha_corte`, `max_id` y `total_inicial` (igual a `total` por compatibilidad)
para todo el snapshot. El cursor es opaco: la respuesta nunca expone su `firma`, `ultimo_id`,
expiración ni otros datos internos. Inserciones posteriores quedan fuera. La clasificación de
errores es parte del contrato: límite o cursor inválido responden `400`; un snapshot invalidado
por cambios concurrentes responde `409` con `codigo: "SINCRONIZACION_INVALIDADA"`; y un fallo
operativo inesperado responde `500` genérico sin exponer detalles de PostgreSQL. El cliente debe
descartar únicamente un snapshot invalidado y reiniciarlo.

### GET /api/ofertas/diagnostico/persistencia

Retorna un diagnóstico mínimo de la conexión PostgreSQL visible desde la API.
Sirve para confirmar si el backend está leyendo la base esperada y cuántas ofertas
persistidas detecta al momento de la consulta.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "configuracion": {
            "host": "localhost",
            "puerto": 5432,
            "baseDatos": "busca_empleos",
            "usuario": "postgres"
        },
        "conexion": {
            "base_datos_actual": "busca_empleos",
            "usuario_actual": "postgres",
            "puerto_postgresql": 5432,
            "host_postgresql": "127.0.0.1",
            "tabla_ofertas_existe": true,
            "total_ofertas": 24
        },
        "fecha_consulta": "2026-04-01T18:30:00.000Z"
    }
}
```

**Uso recomendado para debugging:**
1. Scrapear o evaluar una búsqueda.
2. Consultar este endpoint y anotar `total_ofertas`.
3. Reiniciar el backend.
4. Consultar de nuevo el endpoint.
5. Si `total_ofertas` cambia inesperadamente, el problema está en la persistencia real o en la base apuntada por el `.env`.

### GET /api/ofertas/:id

Retorna una oferta específica.

**Validación:** El ID debe ser un número entero positivo (se valida en el boundary).

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "id": 42,
        "titulo": "QA Tester Junior",
        ...
    }
}
```

**Error — ID inválido (400):**
```json
{ "exito": false, "error": "El ID debe ser un número entero positivo." }
```

**Error — no encontrada (404):**
```json
{ "exito": false, "error": "Oferta no encontrada." }
```

### PATCH /api/ofertas/:id/seguimiento

Actualizo parcialmente fecha y nota, con autenticación habitual y sin modificar estado manual, matching ni caché de IA.

```json
{ "fecha_postulacion": "2024-02-29", "nota_postulacion": "Envié CV; espero respuesta." }
```

- `fecha_postulacion`: día real `YYYY-MM-DD` (años 0001–9999), sin hora/zona, o `null`. No infiero fechas históricas.
- `nota_postulacion`: texto de hasta 4000 puntos Unicode o `null`; admito texto vacío sin recortarlo. Cuento igual que `char_length` de PostgreSQL UTF8: 4000 emoji astrales son válidos, 4001 se rechazan con `400` sin escribir datos.
- Campo omitido: conservo su valor. `null` explícito: limpio ese campo. Cada cliente debe enviar sólo los campos realmente editados; una respuesta de oferta completa no autoriza a reemplazar localmente campos ajenos al PATCH. No implemento versionado para conflictos del mismo campo.
- Rechazo cuerpo vacío, arrays, campos adicionales, tipos incorrectos y fechas imposibles con `400`, sin escribir datos.
- `200`: `{ "exito": true, "datos": { "id": 1, "fecha_postulacion": "2024-02-29", "nota_postulacion": "Envié CV", "...": "resto de la oferta" }, "mensaje": "Seguimiento actualizado correctamente." }`.
- ID inválido: `400`; oferta inexistente: `404` (`Oferta no encontrada.`); fallo inesperado: `500` genérico. Sin token válido: `401`.

Los endpoints existentes de estado individual/masivo y las reapariciones del scraper no sobrescriben fecha ni nota. El snapshot conserva la firma `id+xmin`: si una edición concurrente modifica filas del universo, respondo `409` y reinicio la sincronización, nunca acepto silenciosamente un snapshot mezclado.

### PATCH /api/ofertas/:id/postulacion

Actualiza el estado de postulación de una oferta.

**Body:**
```json
{
    "estado_postulacion": "cv_enviado"
}
```

| Campo | Tipo | Valores válidos |
|-------|------|----------------|
| `estado_postulacion` | string | `no_postulado`, `cv_enviado`, `en_proceso`, `descartada` |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "id": 42,
        "titulo": "QA Tester Junior",
        "estado_postulacion": "cv_enviado",
        ...
    }
}
```

**Error — estado inválido (400):**
```json
{ "exito": false, "error": "El estado de postulación 'invalido' no es válido. Estados permitidos: no_postulado, cv_enviado, en_proceso, descartada." }
```

**Error — body vacío (400):**
```json
{ "exito": false, "error": "Se requiere el campo estado_postulacion." }
```

**Error — ID inválido (400):**
```json
{ "exito": false, "error": "El ID debe ser un número entero positivo." }
```

**Error — no encontrada (404):**
```json
{ "exito": false, "error": "Oferta no encontrada." }
```

### PATCH /api/ofertas/:id/descripcion

Actualiza manualmente el texto de la descripción de una oferta (por ejemplo, cuando fue extraída como extracto de tarjeta parcial y el usuario pega el aviso completo).

**Comportamiento y reglas:**
- Conserva el texto previo original en `descripcion_original` mediante `COALESCE(descripcion_original, descripcion)` (sin sobreescribir si ya existía).
- Asigna `origen_descripcion = 'manual'` y `descripcion_completitud = 'completa'`.
- Registra la fecha de modificación en `descripcion_modificada_en = NOW()`.
- Resetea la evaluación a `estado_evaluacion = 'pendiente'` y `evaluacion_error_mensaje = 'REEVALUACION_SOLICITADA'`.
- Altera el `hash_oferta` de la oferta, invalidando entradas obsoletas de caché para reevaluaciones futuras.
- **Inmutabilidad de contexto:** NO modifica el `estado_postulacion`, notas manuales, título, empresa, plataforma, fecha de publicación ni fecha de extracción.

**Body:**
```json
{
    "descripcion": "Texto completo del aviso laboral con requisitos detallados..."
}
```

| Campo | Tipo | Requerido | Restricciones |
|---|---|---|---|
| `descripcion` | string | Sí | Mínimo 20 caracteres, máximo 50.000 caracteres |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "id": 42,
        "titulo": "Desarrollador Angular Junior",
        "descripcion": "Texto completo pegado...",
        "origen_descripcion": "manual",
        "descripcion_completitud": "completa",
        "descripcion_original": "Extracto previo de tarjeta...",
        "estado_evaluacion": "pendiente",
        "evaluacion_error_mensaje": "REEVALUACION_SOLICITADA",
        "vigencia_evaluacion": "actual"
    },
    "mensaje": "Descripción actualizada correctamente. La oferta quedó pendiente de reevaluación."
}
```

**Errores comunes:**
- `400`: ID inválido o descripción ausente / menor a 20 caracteres / mayor a 50.000 caracteres.
- `404`: Oferta no encontrada.

---

## Endpoints de scraping

Archivo de rutas: `backend/src/rutas/scraping.js`
Controlador: `backend/src/controladores/controlador-scraping.js`

> Rate limited: máximo 5 requests por minuto (protege créditos de Apify).

### POST /api/scraping/linkedin

Ejecuta el scraping de LinkedIn, normaliza resultados y guarda en BD.

**Body (opcional):**
```json
{
    "maxResultados": 100,
    "terminos": ["react developer", "angular developer"],
    "ubicacion": "Argentina"
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `maxResultados` | number | 100 | Máximo de ofertas a extraer. |
| `terminos` | string[] | 7 términos predefinidos | Términos de búsqueda personalizados. |
| `ubicacion` | string | "Argentina" | Ubicación para filtrar. |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de LinkedIn completado: 15 ofertas nuevas, 2 actualizadas y 3 reapariciones.",
        "plataforma": "linkedin",
        "ofertas_nuevas": 15,
        "ofertas_actualizadas": 2,
        "ofertas_reapariciones": 3,
        "ofertas_duplicadas": 5,
        "ofertas_errores": 0,
        "total_extraidas": 20,
        "duplicadas_descartadas": 2
    }
}
```

### POST /api/scraping/computrabajo

Ejecuta el scraping de Computrabajo, normaliza y guarda en BD.

**Body (opcional):**
```json
{
    "maxResultados": 50,
    "terminos": ["frontend developer junior"]
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `maxResultados` | number | 50 | Máximo de ofertas a extraer. |
| `terminos` | string[] | 7 términos predefinidos | Términos de búsqueda personalizados. |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de Computrabajo completado: 10 ofertas nuevas, 1 actualizadas y 2 reapariciones.",
        "plataforma": "computrabajo",
        "ofertas_nuevas": 10,
        "ofertas_actualizadas": 1,
        "ofertas_reapariciones": 2,
        "ofertas_duplicadas": 3,
        "ofertas_errores": 0,
        "total_extraidas": 13,
        "duplicadas_descartadas": 1
    }
}
```

### POST /api/scraping/indeed

Ejecuta el scraping de Indeed Argentina, normaliza resultados y guarda en BD.

**Body (opcional):**
```json
{
    "maxResultados": 100,
    "terminos": ["react developer", "angular developer"]
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `maxResultados` | number | 100 | Máximo de ofertas a extraer. |
| `terminos` | string[] | 7 términos predefinidos | Términos de búsqueda personalizados. |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de Indeed completado: 12 ofertas nuevas, 3 actualizadas y 5 reapariciones.",
        "plataforma": "indeed",
        "ofertas_nuevas": 12,
        "ofertas_actualizadas": 3,
        "ofertas_reapariciones": 5,
        "ofertas_duplicadas": 8,
        "ofertas_errores": 0,
        "total_extraidas": 20,
        "duplicadas_descartadas": 4
    }
}
```

### POST /api/scraping/bumeran

Ejecuto Bumeran mediante `apify/puppeteer-scraper`, normalizo, deduplico, aplico el máximo local y guardo en BD.

**Body (opcional):**
```json
{
    "terminos": ["frontend developer junior"]
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `terminos` | string[] | 7 términos predefinidos | Términos de búsqueda personalizados. |

> **Nota:** Bumeran no acepta `maxResultados` porque extrae desde las tarjetas de la página de resultados.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de Bumeran completado: 8 ofertas nuevas.",
        "plataforma": "bumeran",
        "ofertas_nuevas": 8,
        "ofertas_duplicadas": 2,
        "total_extraidas": 10
    }
}
```

---

### POST /api/scraping/glassdoor

Ejecuta el scraping de Glassdoor Argentina usando el actor de Apify, normaliza y guarda en BD.

**Body (opcional):**
```json
{
    "maxResultados": 50,
    "terminos": ["React developer junior"]
}
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `maxResultados` | number | 50 | Cantidad máxima de ofertas a extraer. |
| `terminos` | string[] | 7 términos predefinidos | Términos de búsqueda personalizados. |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "mensaje": "Scraping de Glassdoor completado: 11 ofertas nuevas.",
        "plataforma": "glassdoor",
        "ofertas_nuevas": 11,
        "ofertas_duplicadas": 3,
        "total_extraidas": 14
    }
}
```

---

### POST /api/scraping/getonbrd

Uso autenticación y contrato común de scraping. La fuente está habilitada efectivamente solo
con `GETONBRD_ENABLED=true` y evidencia/configuración válidas; consulto ese estado en
`GET /api/scraping/previsualizacion`. Sin esas condiciones no consulto al proveedor ni ingreso ofertas.

**Request opcional cuando está habilitada:**
```json
{
    "terminos": ["qa junior"],
    "maxResultados": 10,
    "maxPeticiones": 1
}
```

Sin body uso las preferencias guardadas y los límites del resolver. La respuesta incluye
`datos.fuente`, `configuracion`, `historial`, contadores comunes y sus alias compatibles
(`ofertas_nuevas`, `ofertas_actualizadas`, `ofertas_reapariciones`, `ofertas_duplicadas`,
`total_extraidas`), más métricas y checkpoint. No devuelvo un listado de ofertas en la respuesta
operativa: lo consulto mediante el listado habitual.

| Resultado | HTTP y estado |
|-----------|---------------|
| Completada o vacía | 200; `datos.fuente.estado`: `completada` o `sin_resultados` |
| Parcial o cancelada | 200; `parcial` o `cancelada`; conservo resultados válidos y motivo |
| Timeout | 504, `exito: false`, estado `timeout` |
| Error sin resultados | 502, `exito: false`, estado `error` (500 si no pude guardar ninguna oferta por fallos de BD) |
| Deshabilitada o bloqueada por guarda | 200 sin HTTP externo; `datos.fuente.estado: "deshabilitada"` y motivo |

En el último caso conservo el alias legacy `datos.estado: "bloqueado"`,
`motivo_terminacion: "politica_destino"`, `destino: "bloqueado"`, `ofertas: []` y métricas
sin solicitudes; no representa una búsqueda vacía exitosa.

Para rollback configuro `GETONBRD_ENABLED=false` y reinicio el backend, sin retirar evidencia
ni borrar ofertas o historial. La integración habilitable no equivale a activación productiva
ni aceptación operativa: el smoke histórico de tres ofertas en memoria no valida novedad,
repetición ni utilidad. Ver [alcance, límites y consulta acotada](scraping.md#getonbrd--api-pública-con-habilitación-controlada).

---

Archivo de rutas: `backend/src/rutas/evaluacion.js`
Controlador: `backend/src/controladores/controlador-evaluacion.js`

> Rate limited: máximo 5 requests por minuto (protege créditos de DeepSeek).

### POST /api/evaluacion/ejecutar

Sin `ids` (body ausente o `{}`), evalúo solamente pendientes extraídas en los
últimos **30 días**, también en automatización. Con `{"ids":[5,6]}`, fuerzo
exactamente esa selección, cualquiera sea su estado de evaluación o postulación.

Acepto **1–200 IDs únicos**, enteros positivos seguros de JavaScript, sin convertir
strings. Todas las ofertas deben existir y tener `fecha_extraccion` dentro de la
ventana fija de 30 días; no uso fecha de publicación ni evaluación. Rechazo con
**400** una selección vacía, malformada, duplicada, excesiva, histórica o inexistente,
o un conteo inesperado: no evalúo parcialmente ni omito IDs silenciosamente.

Leo una única copia del perfil persistido al iniciar el worker. Ignoro preferencias
entrantes y `forzar: false`: una selección válida siempre omite lectura de caché y
reemplaza su resultado compatible, sin saltar exclusiones ni modificar campos
manuales de postulación. No necesito reset previo.

**Respuesta inmediata (200, selección de dos ofertas):**
```json
{
    "exito": true,
    "mensaje": "Evaluación iniciada.",
    "en_curso": true,
    "cantidad": 2,
    "periodo_dias": 30
}
```

Sin selección retorno el mismo envoltorio sin `cantidad` ni `periodo_dias`.
Reutilizo el worker, mutex, progreso y cancelación existentes: **409** si hay una
evaluación en curso. Consulto GET `/api/evaluacion/progreso` para el avance y POST
`/api/evaluacion/cancelar` para detener después de la oferta actual. Si falla una
reevaluación forzada, conservo el último resultado válido (estado, razón, porcentaje,
fecha, firma y prioridad) y registro solamente `evaluacion_error_mensaje`. Sin resultado
válido previo, un fallo técnico (HTTP 503, 429, timeout, conexión o JSON no conforme)
mantiene la oferta en `estado_evaluacion = 'pendiente'` con `evaluacion_error_mensaje`;
nunca la guardo como rechazada ni la convierto en descarte manual.
Solo reemplazo caché después de persistir exitosamente la oferta; un fallo opcional de
caché no revierte el resultado guardado.
Guardar preferencias no inicia evaluación ni scraping; solo esta ejecución explícita
puede consumir IA cuando las exclusiones no resuelven la oferta.

### GET /api/evaluacion/reintentar-errores

Consulto con el Bearer Firebase habitual, sin body ni parámetros. Hereda el rate
limit de evaluación (5/min compartido), pero no toma locks ni inicia worker/lotes,
no lee preferencias ni llama proveedores y no escribe ofertas, firmas o caché.

**200 (ejemplo sintético, no IDs históricos):**
```json
{ "exito": true, "total": 2, "ids": [42, 17] }
```

Sin candidatos: `{ "exito": true, "total": 0, "ids": [] }`. Solo devuelvo cantidad
e IDs, nunca filas, mensajes privados, perfil ni notas. Fallo SQL: **503** con
`{ "exito": false, "error": "No pude consultar los candidatos a reintento." }`.
Conservo 401/403 de autenticación y 429 del limitador.

GET y POST comparten un único selector: pendientes con extracción inclusiva de
30 días por `COALESCE(fecha_ultima_extraccion, fecha_extraccion)`, error no nulo
ni vacío/blanco ni marcador `REEVALUACION_SOLICITADA`, firma y porcentaje nulos,
`estado_postulacion = 'no_postulado'`, fecha y nota de postulación nulas.
Excluyo aprobadas/rechazadas incluso con error y pendientes con resultado previo
(incluido porcentaje cero) o datos manuales (incluida nota vacía).
Orden: `fecha_extraccion DESC, id DESC`.

El total representa candidatos **actuales**, no un inventario histórico del incidente.
Es un snapshot no vinculante: puede quedar obsoleto, no reserva IDs ni autoriza un
POST. Antes de leer producción requiero permiso específico; antes de cualquier
futuro reintento requiero autorización explícita de producción con IDs exactos,
alcance/costo y revalidación exacta e inmediata de esos IDs contra el selector actual.
Si cambian, detengo el procedimiento. El POST genérico no representa ese permiso
ni queda ligado al GET. Ver [procedimiento seguro](evaluacion-ia.md#preview-de-solo-lectura-y-autorización-futura-70-t2).

### POST /api/evaluacion/reintentar-errores

Reutilizo el selector protegido descrito en el GET, el worker y el mutex existentes.
No agrego endpoint de ejecución, reintentos, cambios de presupuesto ni recuperación automática.

- No reevalúo aprobadas/rechazadas, resultados previos ni seguimiento manual aunque tengan error.
- Si no hay ofertas con fallos técnicos, responde **200** con `{ exito: true, total: 0, mensaje: 'No hay ofertas con errores de evaluación para reintentar.' }`.
- Si hay ofertas con error, responde **200** `{ exito: true, en_curso: true, total: N, mensaje: 'Reintentando evaluación de ofertas con error...' }` y procesa en background bajo el mismo Advisory Lock (`EVALUACION_OFERTAS`).
- Si ya hay una evaluación activa, responde **409 Conflict**.
- Si el reintento es exitoso, limpia `evaluacion_error_mensaje = null`, asigna el resultado laboral (`aprobada` o `rechazada`), firma canónica y desglose explicable.
- Si vuelve a fallar, actualiza el mensaje de error y conserva el estado recuperable.

### GET /api/evaluacion/progreso

Retorno `{ exito: true, datos }` con los campos habituales y `estado`
(`inactivo`, `activo`, `completado`, `cancelado` o `error`), `mensaje_error`,
`procesadas` y `pendientes`. `evaluadas` cuenta resultados válidos persistidos;
`aprobadas + rechazadas = evaluadas`, `procesadas = evaluadas + errores` y
`pendientes = total - evaluadas` incluye fallos de proveedor y ofertas no procesadas.
El porcentaje describe procesamiento, no garantiza éxito. Un fallo SQL detiene el
lote sin contar la oferta fallida ni las siguientes; prevalece sobre una cancelación.
El POST ya aceptado sigue siendo 200: consulto este progreso para conocer el resultado.

Persisto los contadores finales y el estado terminal antes de liberar el mutex. Al
rehidratar un lote con error recupero estado/contadores y un aviso genérico: el detalle
de la excepción queda en memoria, no agrego una columna ni historial de errores.
Si la BD está caída, no puedo garantizar escrituras del lote. El próximo inicio
limpia el estado de error anterior.

### POST /api/evaluacion/resetear

Sin body o con `{}`, reseteo evaluaciones aprobadas/rechazadas de ofertas extraídas
en los últimos **30 días**. Con `{"dias":7}`, uso ese período explícito: entero entre
**1 y 30** (admito cadenas numéricas legacy, no conversiones parciales). Un valor
inválido responde **400** antes de adquirir el mutex o escribir; el modelo también
rechaza períodos fuera de 1–30. El mutex o progreso ocupado responde **409**.

Retorno **200** con `{ exito: true, datos: { reseteadas, ofertas }, mensaje }`;
`ofertas` contiene `id` y `titulo`. Limpio firma, resultado, fecha y prioridad de
evaluación; conservo campos manuales. Persisto `REEVALUACION_SOLICITADA` en
`evaluacion_error_mensaje` como **intención interna de evaluación forzada pendiente**,
no como error técnico. El worker omite caché para esa próxima evaluación y reemplaza
el marcador al guardar su resultado, sin borrar cachés compartidas.

Resetear no llama IA ni hace scraping. Rechazo períodos mayores que 30 para conservar
intactas las evaluaciones históricas fuera de la ventana reevaluable. Recomiendo la
selección explícita mediante `/ejecutar` para reevaluar ofertas recientes sin reset previo.

---

## Endpoints de automatización

Archivo de rutas: `backend/src/rutas/automatizacion.js`
Controlador: `backend/src/controladores/controlador-automatizacion.js`

### GET /api/automatizacion/estado

Retorna el estado actual del cron.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "datos": {
        "activo": true,
        "expresionCron": "0 20 * * 2",
        "ultimaEjecucion": "2026-03-31T12:00:00.000Z",
        "ultimoResultado": { ... }
    }
}
```

### POST /api/automatizacion/iniciar

Programa el cron. Si ya hay uno activo, lo reemplaza.

**Body (opcional):**
```json
{ "expresionCron": "0 8 * * *" }
```

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `expresionCron` | string | `"0 20 * * 2"` | Expresión cron (martes 20:00 ART por default). |

**Ejemplo response (200):**
```json
{
    "exito": true,
    "mensaje": "Cron programado: \"0 20 * * 2\"",
    "datos": { "activo": true, "expresionCron": "0 20 * * 2", ... }
}
```

**Error — expresión inválida (400):**
```json
{ "exito": false, "error": "Expresión cron inválida o zona horaria no permitida." }
```

### POST /api/automatizacion/detener

Detiene el cron activo.

**Body:** Ninguno.

**Ejemplo response (200):**
```json
{
    "exito": true,
    "mensaje": "Cron detenido exitosamente.",
    "datos": { "activo": false, "expresionCron": null, ... }
}
```

Sin tarea activa también respondo 200 después de persistir inactivo. Si la escritura
falla devuelvo 503 y `datos.errorCron`; no confirmo una desactivación durable inexistente.

### GET /api/automatizacion/progreso

Retorna el progreso del ciclo de automatización activo, si lo hay.

**Body:** Ninguno.

**Ejemplo response — ciclo activo (200):**
```json
{
    "exito": true,
    "datos": {
        "enProgreso": true,
        "pasoActual": 3,
        "pasosTotales": 9,
        "pasoDescripcion": "Scraping de Indeed",
        "iniciadoEn": "2026-06-21T19:00:00.000Z"
    }
}
```

**Ejemplo response — sin ciclo activo (200):**
```json
{
    "exito": true,
    "datos": {
        "enProgreso": false,
        "pasoActual": 0,
        "pasosTotales": 9,
        "pasoDescripcion": null,
        "iniciadoEn": null
    }
}
```

### POST /api/automatizacion/ejecutar

Ejecuta un ciclo completo manual (scraping + guardado + evaluación) de forma asíncrona. No requiere cron activo.

**Comportamiento:**

- Si **no hay** un ciclo activo, la API responde inmediatamente con `202 Accepted` y el ciclo se ejecuta en background (fire-and-forget).
- Si **ya hay** un ciclo activo, la API responde `409 Conflict` y no inicia un segundo ciclo.

El frontend debe consultar `GET /api/automatizacion/progreso` para seguir el avance del ciclo en background.

**Body:** Ninguno.

**Ejemplo response — aceptado (202):**
```json
{
    "exito": true,
    "mensaje": "Ciclo de automatización iniciado en background."
}
```

**Ejemplo response — ciclo activo (409):**
```json
{
    "exito": false,
    "error": "Ya hay un ciclo de automatización en ejecución."
}
```

---

## Endpoint de salud

### GET /api/salud

Health check simple para verificar que el servidor está activo.

**Ejemplo response (200):**
```json
{ "exito": true, "mensaje": "El servidor está funcionando correctamente." }
```

---

## Manejo de errores

Archivo: `backend/src/utils/middleware-errores.js`

| Middleware | Status | Cuándo |
|-----------|--------|--------|
| `rutaNoEncontrada` | 404 | Ruta inexistente. Responde con `{ exito: false, error: "Ruta no encontrada: METHOD /path" }`. |
| `manejarErrores` | 500 (o error.statusCode) | Error no manejado en controladores. En producción oculta detalles internos. |

Express 5 atrapa automáticamente los errores en controladores async (Promises rechazadas). No hace falta try/catch ni wrappers.

## Rate limiting

- **Scope:** `/api/scraping` y `/api/evaluacion`.
- **Límite:** 5 requests por minuto por IP.
- **En tests:** Desactivado (`NODE_ENV=test` usa un middleware vacío).
- **Respuesta cuando se excede (429):**

```json
{ "exito": false, "error": "Demasiadas solicitudes. Esperá un minuto antes de intentar de nuevo." }
```

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general, middlewares, formato de respuesta.
- [Base de datos](base-de-datos.md) — Schema, modelo, queries.
- [Scraping](scraping.md) — Qué hace cada endpoint de scraping internamente.
- [Evaluación IA](evaluacion-ia.md) — Cómo funciona la evaluación que dispara `/evaluacion/ejecutar`.
- [Automatización](automatizacion.md) — Ciclo completo que ejecutan los endpoints de automatización.

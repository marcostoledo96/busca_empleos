# API REST — Busca Empleos

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
un ajuste del ranking, no un bonus fijo sobre el match.

## Extracción de CV completo (issue #10)

En `POST /api/preferencias/importar-cv/analizar` envío un único Markdown en el campo
multipart `cv` (máximo 1 MiB). Analizo el contenido completo en una solicitud lógica,
sin recortar a 15000 caracteres. Mantengo modelo, timeout y reintentos existentes.
Uso bytes UTF-8 de ambos mensajes como presupuesto conservador, **no tokens exactos**:
acepto hasta 602688 bytes de mensajes (contexto de 1000000 menos reserva de salida
máxima 393216 —384 × 1024— y margen de formato 4096). El límite efectivo del CV
es ese techo menos los bytes de instrucciones y encuadre del prompt de usuario;
un archivo permitido por Multer puede excederlo. No aumento `max_tokens`.
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
| POST | `/api/scraping/linkedin` | Ejecutar scraping de LinkedIn | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/computrabajo` | Ejecutar scraping de Computrabajo | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/indeed` | Ejecutar scraping de Indeed | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/bumeran` | Ejecutar scraping de Bumeran | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/glassdoor` | Ejecutar scraping de Glassdoor | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/getonbrd` | Consultar estado bloqueado del piloto GetOnBrd | **Sí** | **Inactivo** |
| POST | `/api/scraping/jooble` | Ejecutar scraping de Jooble | **Sí** | **Sí** (5/min) |
| POST | `/api/scraping/google-jobs` | Ejecutar scraping de Google Jobs | **Sí** | **Inactivo** — responde sin invocar Apify |
| POST | `/api/evaluacion/ejecutar` | Evaluar pendientes recientes o forzar IDs seleccionados | **Sí** | **Sí** (5/min) |
| GET | `/api/automatizacion/estado` | Estado actual del cron | **Sí** | No |
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

Lista las ofertas de los **últimos 30 días**, con filtros opcionales por query params.

> **Ventana de 30 días:** Solo se muestran ofertas con `fecha_extraccion` dentro de los últimos 30 días. Ofertas más antiguas no aparecen en el listado ni en el conteo total.

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
            "datos_crudos": { ... }
        }
    ],
    "total": 1
}
```

### GET /api/ofertas/estadisticas

Retorna contadores agrupados por estado de evaluación **de los últimos 30 días**.

> **Ventana de 30 días:** Al igual que `GET /api/ofertas`, este endpoint solo cuenta ofertas con `fecha_extraccion` dentro de los últimos 30 días. Ofertas más antiguas no se incluyen en los conteos ni en el total. Esto garantiza que las estadísticas sean consistentes con lo que el usuario ve en el listado.

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

Transfiere una proyección liviana de las ofertas de los últimos 30 días por bloques. Requiere
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
        "mensaje": "Scraping de LinkedIn completado: 15 ofertas nuevas.",
        "plataforma": "linkedin",
        "ofertas_nuevas": 15,
        "ofertas_duplicadas": 5,
        "total_extraidas": 20
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
        "mensaje": "Scraping de Computrabajo completado: 10 ofertas nuevas.",
        "plataforma": "computrabajo",
        "ofertas_nuevas": 10,
        "ofertas_duplicadas": 3,
        "total_extraidas": 13
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
        "mensaje": "Scraping de Indeed completado: 12 ofertas nuevas.",
        "plataforma": "indeed",
        "ofertas_nuevas": 12,
        "ofertas_duplicadas": 8,
        "total_extraidas": 20
    }
}
```

### POST /api/scraping/bumeran

Ejecuta el scraping de Bumeran usando cheerio-scraper, normaliza y guarda en BD.

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

El endpoint es un **shadow endpoint**: devuelve un Result Contract bloqueado y no llama a red,
servicios externos ni `crearOferta`. Acepta autenticación normal, pero no body operativo mientras
el registry esté inactivo.

```json
{
    "exito": true,
    "datos": {
        "run_id": null,
        "estado": "bloqueado",
        "motivo_terminacion": "politica_destino",
        "destino": "bloqueado",
        "ofertas": [],
        "checkpoint": { "termino_indice": 0, "termino": null, "pagina_confirmada": 0, "pagina_siguiente": 1, "item_offset": 0 },
        "metricas": { "requests": 0, "paginas": 0, "recibidas": 0, "normalizadas": 0, "dentro_ventana": 0, "fuera_ventana": 0, "duplicadas_intra_run": 0, "invalidas": 0, "latencia_ms": 0 }
    }
}
```

La activación futura requiere API oficial con sandbox/fixtures, evidencia escrita auditable y
rollout explícito. El rollback es deshabilitar el registry y retirar la evidencia; no hay datos
productivos generados por este piloto.

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
válido previo mantengo el rechazo técnico existente; nunca lo convierto en descarte manual.
Solo reemplazo caché después de persistir exitosamente la oferta; un fallo opcional de
caché no revierte el resultado guardado.
Guardar preferencias no inicia evaluación ni scraping; solo esta ejecución explícita
puede consumir IA cuando las exclusiones no resuelven la oferta.

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
{ "exito": false, "error": "Expresión cron inválida: \"invalida\"" }
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

**Error — no hay cron activo (400):**
```json
{ "exito": false, "error": "No hay ningún cron activo para detener." }
```

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

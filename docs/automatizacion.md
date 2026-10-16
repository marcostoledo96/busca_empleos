# Automatización — Busca Empleos

## Snapshot de búsquedas y cron (issue #13)

Reservo el ciclo antes de leer preferencias para impedir aceptaciones simultáneas.
Resuelvo todas las configuraciones antes de invocar la primera fuente; el ciclo
manual acepta los mismos overrides que un individual, sin guardarlos. Una lectura
fallida devuelve 503 antes del 202 y libera la reserva; términos globales vacíos,
tipos/aliases/límites inválidos devuelven 400 sin invocar ninguna fuente, incluidas
las de filtros fijos. Después de la preparación, conservo extracción/evaluación
asincrónicas, pasos, contadores y errores parciales.

Distingo una consulta incompatible con una fuente de un error global. Por ejemplo,
`['QA']` se ejecuta sin cambios en LinkedIn/Computrabajo/Glassdoor, pero la
transformación existente de Indeed/Jooble/Adzuna/Bumeran no produce palabras
utilizables. Omisión sólo para esas fuentes: snapshot con `motivoOmision` y
advertencia, paso `omitida` con `motivo` y cero extraídas, resultado final con
`omisiones: [{ plataforma, motivo }]` separado de errores. El progreso contabiliza
el paso omitido como terminal, no como éxito del proveedor. No sustituyo términos,
no escribo preferencias ni uso falta de credenciales como incompatibilidad.

El 202 y el polling `/api/automatizacion/progreso` incluyen `datos.configuracion`;
el estado final la conserva en `datos.ultimoResultado.configuracion`. Es el snapshot
usado, no una nueva lectura de preferencias al consultar estado. Preview muestra
las preferencias actuales; puede diferir de un ciclo ya ejecutado.

Cada callback cron llama el mismo ciclo y vuelve a leer preferencias actuales,
sin reutilizar términos de una ejecución anterior. En `src/index.js` rehidrato una sola
vez el historial y la decisión persistida del cron antes de aceptar HTTP. Sin decisión,
o con decisión inactiva, no programo nada; sólo restauro una activación explícita válida,
sin ejecutar búsquedas vencidas. `programarCron` conserva default `0 20 * * 2` y zona
`America/Argentina/Buenos_Aires`. Las pruebas usan node-cron simulado, nunca cron real.

## Qué es y cómo funciona

El servicio de automatización ejecuta un ciclo completo de scraping + evaluación periódicamente usando `node-cron`. Es como una alarma programada: "cada martes a las 20:00 (ART), ejecutá el ciclo completo". Al finalizar, envía un resumen por email si las variables SMTP están configuradas (soft-disable si faltan).

**Librería:** `node-cron` (implementa sintaxis cron de Linux).
**Archivo principal:** `backend/src/servicios/servicio-automatizacion.js`.
**Controlador:** `backend/src/controladores/controlador-automatizacion.js`.

## node-cron vs setInterval

| Aspecto | node-cron | setInterval |
|---------|----------|-------------|
| Sintaxis | Expresiones cron (`0 20 * * 2`) | Milisegundos (`172800000`) |
| Referencia | Horas exactas del reloj | Tiempo relativo desde inicio |
| Ante reinicio | Sigue programado a las horas correctas | Pierde la cuenta, recalcula desde cero |
| Expresividad | "Lunes a viernes a las 8am" | Solo "cada X milisegundos" |

## Sintaxis cron

```
┌───────────── minuto (0-59)
│ ┌───────────── hora (0-23)
│ │ ┌───────────── día del mes (1-31)
│ │ │ ┌───────────── mes (1-12)
│ │ │ │ ┌───────────── día de la semana (0-7, 0 y 7 = domingo)
│ │ │ │ │
* * * * *
```

**Expresión por defecto:** `0 20 * * 2` → "Al minuto 0, hora 20 (8 PM), cualquier día del mes, cualquier mes, martes (día 2)". Timezone: `America/Argentina/Buenos_Aires`.

## Estado del servicio (singleton)

Un único objeto en memoria que mantiene el estado del cron:

```javascript
{
    cronActivo: null,       // Referencia al cron task (o null si no hay)
    expresionCron: null,    // Expresión cron actual (ej: "0 20 * * 2")
    ultimaEjecucion: null,  // ISO string de cuándo se ejecutó por última vez
    ultimoResultado: null   // Objeto con el resultado del último ciclo
}
```

Este estado es consultable desde la API (`GET /api/automatizacion/estado`) y lo usa el frontend para mostrar si el cron está activo.

## Ciclo completo (`ejecutarCicloCompleto`)

Es el "corazón" de la automatización. Se ejecuta cada vez que el cron dispara, o manualmente desde la API.

**Arquitectura registry-driven:** Las plataformas se iteran desde `PLATAFORMAS_ACTIVAS` (fuente de verdad en `config/plataformas.js`), no desde bloques hardcodeados. Los scrapers se vinculan por id en el mapa local `SCRAPERS`. Las inactivas se registran con 0 sin invocar el scraper.

```
 1. Para cada plataforma activa (PLATAFORMAS_ACTIVAS):
    ├─ Consulta incompatible → registrar motivo/omisión, NO invocar scraper
    ├─ Buscar SCRAPERS[id] → invocar scraper
    ├─ Consumir telemetría T1 sin convertir error/timeout en éxito vacío
    ├─ Filtrar idioma y persistir por fuente con ingreso #19
    └─ Conservar resultados útiles y seguir con la siguiente plataforma

 2. Para cada plataforma inactiva (PLATAFORMAS donde activa=false):
    └─ Registrar deshabilitada con motivo, paso omitido y cero intentos

 3. Sumar resultados exactos de ingreso de cada fuente, sin guardar el lote dos veces

 4. Evaluar ofertas pendientes con DeepSeek
    ├─ Éxito → resumen de aprobadas/rechazadas
    └─ Error → loguear

 5. Enviar notificación por email (soft-disable si SMTP no configurado)
    └─ Fire-and-forget: no bloquea el ciclo si falla

 6. Registrar resultado en estado del servicio
```

### Finalización con resultados parciales

Distingo la finalización del ciclo de una evaluación exitosa: si el worker resuelve con `estado: 'error'`, `errores > 0` o `estado: 'cancelado'`, marco el paso de evaluación como `error`, agrego un aviso en `resultado.errores` y retorno `exito: false`. También retorno `exito: false` si la evaluación rechaza la promesa. Conservo el resumen completo, sus contadores, las ofertas guardadas, el envío del email y la liberación del lock. Mantengo `activo: false` y `porcentaje: 100` como señales de finalización, no de éxito.

En el email HTML y texto plano, completo el aviso desde `evaluacion.errores`, `evaluacion.estado` y `erroresGuardado` cuando el arreglo general llega vacío; no anuncio «Sin errores» ante fallos o cancelación. El scraping también informa `estadoScraping` general y `fuentes[]`; un fallo total es `error`, una mezcla de fuentes correctas y fallidas es `parcial`. El ciclo termina con `exito: false` ante fallos parciales, sin descartar ofertas útiles.

### Plataformas actuales (definidas en `config/plataformas.js`)

| Plataforma | id | Activa | Scraper |
|---|---|---|---|
| LinkedIn | `linkedin` | Sí | `ejecutarScrapingLinkedin` |
| Computrabajo | `computrabajo` | Sí | `ejecutarScrapingComputrabajo` |
| Indeed | `indeed` | Sí | `ejecutarScrapingIndeed` |
| Bumeran | `bumeran` | Sí | `ejecutarScrapingBumeran` |
| Glassdoor | `glassdoor` | Sí | `ejecutarScrapingGlassdoor` |
| GetOnBrd | `getonbrd` | No | Piloto API-only bloqueado |
| Jooble | `jooble` | Sí | `ejecutarScrapingJooble` |
| Remotive | `remotive` | Sí | `ejecutarScrapingRemotive` |
| RemoteOK | `remoteok` | Sí | `ejecutarScrapingRemoteOK` |
| Adzuna | `adzuna` | Sí | `ejecutarScrapingAdzuna` (puede retornar `{deshabilitado:true}`) |
| Google Jobs | `google_jobs` | No | — (no se invoca) |
| InfoJobs | `infojobs` | No | — (no se invoca) |

Para activar/desactivar una plataforma, solo hay que cambiar `activa: true/false` en `config/plataformas.js`. El ciclo se adapta automáticamente sin tocar `servicio-automatizacion.js`.

### Diseño resiliente

- Cada plataforma activa se ejecuta en un `try/catch` independiente dentro de un loop.
- Si una plataforma falla, el ciclo sigue con la siguiente.
- Las plataformas inactivas se registran con 0 ofertas sin invocar scraper.
- Adzuna puede retornar `{ deshabilitado: true }` si faltan credenciales → conservo compatibilidad y registro `sin_credenciales`, nunca `sin_resultados`.
- Si una plataforma activa no tiene función en `SCRAPERS`, se reporta error de configuración y se continúa.
- Si la evaluación falla, el scraping ya se guardó.
- Si el email falla, el ciclo se completa igual (soft-disable).
- **Un error parcial nunca tira abajo todo el ciclo.**

### Resultado del ciclo

```javascript
{
    exito: true,
    scraping: {
        // Una clave por cada plataforma del registry (activa e inactiva).
        // Derivado automáticamente de PLATAFORMAS en config/plataformas.js.
        linkedin: 20,              // Ofertas extraídas de LinkedIn
        computrabajo: 15,          // Ofertas extraídas de Computrabajo
        indeed: 12,                // Ofertas extraídas de Indeed
        bumeran: 8,                // Ofertas extraídas de Bumeran
        glassdoor: 11,             // Ofertas extraídas de Glassdoor
        getonbrd: 0,               // Piloto bloqueado, nunca se invoca desde cron
        jooble: 5,                 // Ofertas extraídas de Jooble
        google_jobs: 0,            // Desactivado (siempre 0, no se invoca)
        remotive: 7,               // Ofertas extraídas de Remotive
        remoteok: 4,              // Ofertas extraídas de RemoteOK
        infojobs: 0,               // Desactivado (siempre 0, no se invoca)
        adzuna: 6,                 // Ofertas extraídas de Adzuna (o 0 si deshabilitado)
        totalExtraidas: 97,        // Total extraído
        guardadas: 55,             // Nuevas (sin duplicadas)
        descartadasPorIdioma: 3   // Descartadas por estar en inglés
    },
    evaluacion: {
        total: 25,
        aprobadas: 10,
        rechazadas: 15,
        errores: 0
    },
    fechaEjecucion: "2026-06-16T20:00:00.000Z",  // ISO de inicio del ciclo
    duracionSegundos: 120,                          // Duración en segundos
    errores: []                                     // Mensajes de error de pasos fallidos
}
```

## Funciones del servicio

### `ejecutarCicloCompleto()`

Ejecuta el ciclo completo descrito arriba. Retorna el objeto resumen.

> **Nota:** Cuando el cron dispara el ciclo, `ejecutarCicloCompleto()` se ejecuta con `await` y su resultado se persiste en el estado del servicio. Cuando el POST `/api/automatizacion/ejecutar` lo dispara manualmente, se ejecuta sin `await` (fire-and-forget) para no bloquear la respuesta HTTP, y el frontend debe consultar `GET /api/automatizacion/progreso` para seguir el progreso.

### `cicloEnProgreso()`

Retorna `true` si hay un ciclo de automatización ejecutándose actualmente (para evitar concurrencia). La usan tanto el cron como el endpoint POST `/ejecutar` como guard de solapamiento.

### `obtenerProgreso()`

Retorna el progreso actual del ciclo en ejecución: pasos por plataforma con estado (`pendiente`, `procesando`, `completada`, `error`), porcentaje total. El frontend consulta estos datos vía `GET /api/automatizacion/progreso`.

### `programarCron(opciones)`

Es asincrónica: valido expresión y zona, detengo la tarea anterior, persisto la activación y
creo una tarea detenida con `cron.createTask()`. Luego hago `start()` y verifico su estado.
Uso `noOverlap: true`; el callback conserva además la reserva del ciclo existente.
Retorno un controlador con `detener()` asincrónico. Una configuración inválida devuelve 400;
un fallo de persistencia o scheduler devuelve 503 con `errorCron`, sin anunciar activación.
Si falla el scheduler intento persistir inactivo; si también falla esa escritura informo que
no pude confirmar la decisión durable. Las mutaciones y la rehidratación comparten una cola
local serializada, sin scheduler adicional.

### `obtenerEstado()`

Retorna el estado actual para la API y el frontend:

```javascript
{
    activo: true/false,
    expresionCron: "0 20 * * 2" | null,
    ultimaEjecucion: "2026-03-31T12:00:00.000Z" | null,
    ultimoResultado: { ... } | null
}
```

### `detenerCron()`

Detengo y destruyo la tarea antes de persistir `activo: false`, incluso si ya estaba inactiva.
Una escritura fallida responde 503: la tarea local queda detenida, pero no prometo que la
decisión durable se haya actualizado. `errorCron` advierte del riesgo al reiniciar.

## Flujo desde la API

| Endpoint | Función del servicio |
|----------|---------------------|
| `GET /api/automatizacion/estado` | `obtenerEstado()` |
| `POST /api/automatizacion/iniciar` | `programarCron({ expresionCron })` |
| `POST /api/automatizacion/detener` | `detenerCron()` (idempotente; persiste inactivo) |
| `GET /api/automatizacion/historial` | Últimas 20 ejecuciones durables |
| `POST /api/automatizacion/ejecutar` | `ejecutarCicloCompleto()` disparado en background sin `await` (fire-and-forget) |
| `GET /api/automatizacion/progreso` | Consulta el progreso del ciclo activo (pasos, porcentaje, estados) |

### Ejecución asíncrona del POST /ejecutar

El endpoint `POST /api/automatizacion/ejecutar` ya no espera a que el ciclo termine. En su lugar:

1. Verifica si ya hay un ciclo en progreso (`cicloEnProgreso()` en el servicio).
2. Si no hay ciclo activo: responde `202 Accepted` inmediatamente y ejecuta `ejecutarCicloCompleto()` en background con `.catch()` para atrapar errores asíncronos.
3. Si ya hay un ciclo activo: responde `409 Conflict` sin iniciar nada nuevo.

Esto evita timeouts de infraestructura (Railway, proxies) cuando el ciclo total supera los 30 segundos. El frontend debe consultar `GET /api/automatizacion/progreso` mediante polling para saber cuándo termina el ciclo.

## Manejo de errores en el cron

Cuando el cron dispara `ejecutarCicloCompleto()`:
- Si hay un error **esperado** (API caída, etc.), queda atrapado dentro del ciclo (diseño resiliente).
- Si hay un error **fatal** inesperado, se atrapa en el callback del cron con un try/catch que lo loguea sin matar la tarea. El cron sigue programado para la siguiente ejecución.

## Resultado compartido e historial (issue #20)

Uso `servicio-resultados-fuente.js` en individuales, ciclo y cron. Cada fuente informa
`estado`, `estadoScraping`, consultas efectivamente ejecutadas, errores, peticiones
(`null` cuando no se conocen), contadores #16 y #19, y duración. `duracionScrapingMs`
mide extracción; `duracionMs` incluye ingreso. No invento costo ni atribuyo aprobadas IA:
`evaluacion` sigue siendo global y puede incluir pendientes anteriores.
`duplicadas` conserva su semántica legacy (incluye actualizadas/reapariciones); no se
suma a esas categorías. `duplicadasDescartadas` corresponde al filtrado intra-scraping.

Inicio una fila antes del scraping. Si falla ese registro, no consulto proveedores y
reporto `errorHistorial` en el estado del ciclo y `error` en progreso. Si falla la
finalización, conservo el resultado con `historial.guardado: false` y aviso explícito.
Guardo sólo una lista permitida: estados, contadores, consultas acotadas y códigos de
error; no ofertas, credenciales, snapshots de preferencias ni mensajes del proveedor.
Retengo 20 ejecuciones finalizadas más las actualmente en curso; la API lista las 20
más recientes. Al reiniciar marco las pendientes `interrumpida` y vuelvo a acotar.
Una finalización tardía no puede convertir una interrumpida en completada.

## Notificación por email post-ciclo

Al finalizar cada ciclo (automático o manual), el servicio envía un email de resumen a `EMAIL_NOTIFICACION_DESTINO`. El envío es **no bloqueante** (fire-and-forget): si falla, se loguea el error pero el ciclo continúa normalmente.

### Configuración SMTP

| Variable | Descripción | Obligatoria |
|----------|------------|-------------|
| `SMTP_HOST` | Servidor SMTP (ej: `smtp.gmail.com`) | Sí |
| `SMTP_PORT` | Puerto SMTP (465 para SSL, 587 para STARTTLS) | No (default: 587) |
| `SMTP_USER` | Usuario SMTP | Sí |
| `SMTP_PASS` | Contraseña de aplicación SMTP | Sí |
| `SMTP_FROM` | Email remitente (default: `SMTP_USER`) | No |
| `EMAIL_NOTIFICACION_DESTINO` | Email destino del resumen | Sí |

Si falta alguna variable obligatoria, el servicio se deshabilita silenciosamente (soft-disable): loguea un aviso con las variables faltantes y no crashea la aplicación.

### Contenido del email

El email incluye:
- **Fecha y duración** del ciclo (timezone Argentina).
- **Extracción por plataforma**: cantidad de ofertas traídas por cada plataforma con resultados.
- **Totales**: extraídas, guardadas (nuevas), descartadas por idioma.
- **Evaluación IA**: total evaluadas, aprobadas, rechazadas, errores (si hubo evaluación).
- **Errores**: lista de errores del ciclo (si los hubo).

El email se envía en formato HTML con fallback a texto plano. Los datos dinámicos se escapan para prevenir markup roto.

### Servicio

- **Archivo:** `backend/src/servicios/servicio-notificacion-email.js`
- **Dependencia:** `nodemailer`
- **Funciones:** `obtenerConfigEmail()`, `armarResumenEmail()`, `enviarResumenCiclo()`

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del flujo del sistema.
- [Scraping](scraping.md) — Pasos 1-12 del ciclo completo.
- [Evaluación IA](evaluacion-ia.md) — Paso 14 del ciclo completo.
- [API REST](api-rest.md) — Endpoints de automatización.
- [Frontend](frontend.md) — Cómo el dashboard controla el cron.

## Piloto GetOnBrd excluido

GetOnBrd permanece en el registry para transparencia, pero inactivo: el cron y el ciclo manual
registran `0` sin invocar su scraper. El piloto seguro solo admite fixtures/sandbox inyectables,
no persiste ofertas y exige evidencia escrita verificable para cualquier rollout futuro. El
rollback consiste en conservarlo inactivo y retirar evidencia/configuración de autorización.

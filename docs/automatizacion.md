# Automatización — Busca Empleos

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

```
 1. Scraping de LinkedIn
    ├─ Éxito → guardar ofertas normalizadas
    └─ Error → loguear, seguir con paso 2

 2. Scraping de Computrabajo
    ├─ Éxito → guardar ofertas normalizadas
    └─ Error → loguear, seguir con paso 3

 3. Scraping de Indeed
    ├─ Éxito → guardar ofertas normalizadas
    └─ Error → loguear, seguir con paso 4

 4. Scraping de Bumeran
    ├─ Éxito → guardar ofertas normalizadas
    └─ Error → loguear, seguir con paso 5

 5. Scraping de Glassdoor
    ├─ Éxito → guardar ofertas normalizadas
    └─ Error → loguear, seguir con paso 6

 6. Scraping de GetOnBrd (API pública gratuita, sin Apify)
    ├─ Éxito → guardar ofertas normalizadas
    └─ Error → loguear, seguir con paso 7

 7. Scraping de Jooble (API REST oficial gratuita, requiere API key)
    ├─ Éxito → guardar ofertas normalizadas
    └─ Error → loguear, seguir con paso 8

 8. Google Jobs — DESACTIVADO (consumió USD sin resultados útiles)

 9. Scraping de Remotive (API REST pública gratuita, solo remoto)
    ├─ Éxito → guardar ofertas normalizadas
    └─ Error → loguear, seguir con paso 10

10. Scraping de RemoteOK (API REST pública gratuita, solo remoto)
    ├─ Éxito → guardar ofertas normalizadas
    └─ Error → loguear, seguir con paso 11

11. InfoJobs — DESACTIVADO TEMPORALMENTE (registro de apps suspendido)

12. Scraping de Adzuna (API REST oficial, requiere credenciales)
    ├─ Éxito → guardar ofertas normalizadas
    └─ Error → loguear, seguir con paso 13

13. Filtrar ofertas en inglés (detectarIdioma) y guardar en BD
    ├─ Descartar ofertas con título/descripción en inglés
    ├─ Por cada oferta: crearOferta() → null si duplicada
    └─ Contar nuevas vs. duplicadas, descartadas por idioma

14. Evaluar ofertas pendientes con DeepSeek
    ├─ Éxito → resumen de aprobadas/rechazadas
    └─ Error → loguear

15. Enviar notificación por email (soft-disable si SMTP no configurado)
    └─ Fire-and-forget: no bloquea el ciclo si falla

16. Registrar resultado en estado del servicio
```

### Diseño resiliente

- Si LinkedIn falla, sigue con Computrabajo.
- Si Computrabajo falla, sigue con Indeed.
- Si Indeed falla, sigue con Bumeran.
- Si Bumeran falla, sigue con Glassdoor.
- Si Glassdoor falla, sigue con GetOnBrd.
- Si GetOnBrd falla, sigue con Jooble.
- Si Jooble falla, sigue con Remotive.
- Si Remotive falla, sigue con RemoteOK.
- Si RemoteOK falla, sigue con Adzuna.
- Si Adzuna falla, sigue con el guardado.
- Si la evaluación falla, el scraping ya se guardó.
- Si el email falla, el ciclo se completa igual (soft-disable).
- **Un error parcial nunca tira abajo todo el ciclo.**

### Resultado del ciclo

```javascript
{
    exito: true,
    scraping: {
        linkedin: 20,              // Ofertas extraídas de LinkedIn
        computrabajo: 15,          // Ofertas extraídas de Computrabajo
        indeed: 12,                // Ofertas extraídas de Indeed
        bumeran: 8,                // Ofertas extraídas de Bumeran
        glassdoor: 11,             // Ofertas extraídas de Glassdoor
        getonbrd: 9,               // Ofertas extraídas de GetOnBrd
        jooble: 5,                 // Ofertas extraídas de Jooble
        google_jobs: 0,            // Desactivado (siempre 0)
        remotive: 7,               // Ofertas extraídas de Remotive
        remoteok: 4,              // Ofertas extraídas de RemoteOK
        infojobs: 0,               // Desactivado temporalmente (siempre 0)
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

Programa la ejecución periódica:
1. Valida que la expresión cron sea sintácticamente correcta (`cron.validate()`).
2. Si ya hay un cron corriendo, lo detiene antes de programar uno nuevo.
3. Crea la tarea con `cron.schedule()`.
4. Actualiza el estado interno.
5. Retorna un controlador con método `detener()`.

Si la expresión es inválida, lanza un error (`"Expresión cron inválida: ..."`) que el controlador convierte en 400.

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

Detiene el cron activo desde fuera del controlador de `programarCron()`. Necesaria para que la API pueda detener el cron sin tener la referencia devuelta.

## Flujo desde la API

| Endpoint | Función del servicio |
|----------|---------------------|
| `GET /api/automatizacion/estado` | `obtenerEstado()` |
| `POST /api/automatizacion/iniciar` | `programarCron({ expresionCron })` |
| `POST /api/automatizacion/detener` | `detenerCron()` (valida que haya cron activo primero) |
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

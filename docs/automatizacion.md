# Automatización — Busca Empleos

## Qué es y cómo funciona

El servicio de automatización ejecuta un ciclo completo de scraping + evaluación periódicamente usando `node-cron`. Es como una alarma programada: "cada 48 horas, ejecutá el ciclo completo".

**Librería:** `node-cron` (implementa sintaxis cron de Linux).
**Archivo principal:** `backend/src/servicios/servicio-automatizacion.js`.
**Controlador:** `backend/src/controladores/controlador-automatizacion.js`.

## node-cron vs setInterval

| Aspecto | node-cron | setInterval |
|---------|----------|-------------|
| Sintaxis | Expresiones cron (`0 0 */2 * *`) | Milisegundos (`172800000`) |
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

**Expresión por defecto:** `0 0 */2 * *` → "Al minuto 0, hora 0, cada 2 días" (cada 48 horas, a medianoche).

## Estado del servicio (singleton)

Un único objeto en memoria que mantiene el estado del cron:

```javascript
{
    cronActivo: null,       // Referencia al cron task (o null si no hay)
    expresionCron: null,    // Expresión cron actual (ej: "0 0 */2 * *")
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

5. Guardar todas las ofertas en BD
   ├─ Por cada oferta: crearOferta() → null si duplicada
   └─ Contar nuevas vs. duplicadas

6. Evaluar ofertas pendientes con DeepSeek
   ├─ Éxito → resumen de aprobadas/rechazadas
   └─ Error → loguear

7. Registrar resultado en estado del servicio
```

### Diseño resiliente

- Si LinkedIn falla, sigue con Computrabajo.
- Si Computrabajo falla, sigue con Indeed.
- Si Indeed falla, sigue con Bumeran.
- Si Bumeran falla, sigue con el guardado.
- Si la evaluación falla, el scraping ya se guardó.
- **Un error parcial nunca tira abajo todo el ciclo.**

### Resultado del ciclo

```javascript
{
    exito: true,
    scraping: {
        linkedin: 20,          // Ofertas extraídas de LinkedIn
        computrabajo: 15,      // Ofertas extraídas de Computrabajo
        indeed: 12,            // Ofertas extraídas de Indeed
        bumeran: 8,            // Ofertas extraídas de Bumeran
        totalExtraidas: 55,    // Total extraído
        guardadas: 40          // Nuevas (sin duplicadas)
    },
    evaluacion: {
        total: 25,
        aprobadas: 10,
        rechazadas: 15,
        errores: 0
    },
    errores: []                // Mensajes de error de pasos fallidos
}
```

## Funciones del servicio

### `ejecutarCicloCompleto()`

Ejecuta el ciclo completo descrito arriba. Retorna el objeto resumen.

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
    expresionCron: "0 0 */2 * *" | null,
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
| `POST /api/automatizacion/ejecutar` | `ejecutarCicloCompleto()` (ejecución manual, sin necesidad de cron) |

## Manejo de errores en el cron

Cuando el cron dispara `ejecutarCicloCompleto()`:
- Si hay un error **esperado** (API caída, etc.), queda atrapado dentro del ciclo (diseño resiliente).
- Si hay un error **fatal** inesperado, se atrapa en el callback del cron con un try/catch que lo loguea sin matar la tarea. El cron sigue programado para la siguiente ejecución.

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del flujo del sistema.
- [Scraping](scraping.md) — Paso 1-2 del ciclo completo.
- [Evaluación IA](evaluacion-ia.md) — Paso 4 del ciclo completo.
- [API REST](api-rest.md) — Endpoints de automatización.
- [Frontend](frontend.md) — Cómo el dashboard controla el cron.

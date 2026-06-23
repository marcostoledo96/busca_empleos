# Evaluación con IA — Busca Empleos

## Qué es y por qué se usa DeepSeek

DeepSeek es un modelo de lenguaje (como ChatGPT) pero más barato, con una API compatible con el formato de OpenAI. Si algún día se quisiera cambiar a OpenAI u otro proveedor compatible, solo haría falta cambiar la URL y el modelo.

**Modelo:** `deepseek-v4-flash` (modelo rápido recomendado).
**URL:** `https://api.deepseek.com/chat/completions`.
**API key:** Variable de entorno `DEEPSEEK_API_KEY`.
**SDK:** Ninguno — usa `fetch()` nativo de Node.js 22 (menos dependencias).

## Archivos involucrados

| Archivo | Responsabilidad |
|---------|----------------|
| `backend/src/config/deepseek.js` | Función `consultarDeepSeek()` que envía mensajes y retorna la respuesta en texto. |
| `backend/src/servicios/servicio-evaluacion.js` | Construye prompts, evalúa ofertas, integra parser + reglas, actualiza la BD. |
| `backend/src/servicios/evaluacion/parser-respuesta-ia.js` | Parser estricto: limpia fences, valida schema JSON (match boolean real, porcentaje 0-100 o null, razon string con fallback). |
| `backend/src/servicios/evaluacion/reglas-exclusion.js` | Reglas determinísticas de exclusión fuerte (Java, Senior/SR/Lead, 3+ años, inglés excluyente, ubicación/modalidad). |
| `backend/src/controladores/controlador-evaluacion.js` | Recibe request HTTP y dispara la evaluación de todas las pendientes. |

## Configuración del cliente (deepseek.js)

### `consultarDeepSeek(mensajeSistema, mensajeUsuario)`

Envía un request a la API de chat completions:

- **messages:** Array con `{ role: "system", content: mensajeSistema }` y `{ role: "user", content: mensajeUsuario }`.
- **temperature:** `0` — respuestas determinísticas, sin creatividad. Para evaluar ofertas se necesita consistencia.
- **Validación:** Si la API key no está configurada o es el valor placeholder, lanza error descriptivo.

## Perfil del candidato

Definido como constante `PERFIL_CANDIDATO` en `servicio-evaluacion.js`:

```
Soy un candidato de nivel Trainee / Junior buscando empleo en tecnología.

Stack tecnológico:
- Lenguajes: HTML, CSS, JavaScript, TypeScript, C#, SQL
- Frontend: Angular, React, React Native
- Backend: Node.js, Express, ASP.NET
- Bases de datos: PostgreSQL, SQL Server
- Otros: Git, API REST

Modalidad aceptada: Cualquiera (Remoto, Híbrido, Presencial).
Ubicación: Buenos Aires, Argentina.

REGLA ESTRICTA DE EXCLUSIÓN:
- Si la oferta requiere Java como tecnología principal o excluyente, RECHAZAR.
- Esta regla NO aplica a JavaScript. No confundir Java con JavaScript.
```

## Instrucciones de sistema (prompt de sistema)

Las instrucciones le dicen a DeepSeek exactamente cómo evaluar. Incluyen el perfil completo del candidato.

### Criterios de evaluación

| Criterio | Resultado |
|----------|----------|
| Candidato cumple ≥60% de requisitos técnicos | `match: true` |
| Nivel pedido es trainee, junior, o no especificado | `match: true` |
| Requiere Java (no JavaScript) como tecnología principal | `match: false` |
| Requiere nivel Senior o >3 años de experiencia comprobable | `match: false` |
| Requiere tecnologías fuera del stack (Kotlin, Swift, Rust, Go como principal) | `match: false` |

### Formato de respuesta exigido

```json
{"match": true, "razon": "Explicación breve en español", "porcentaje": 85}
{"match": false, "razon": "Explicación breve en español", "porcentaje": 25}
```

- La razón debe ser 1-2 oraciones, en español, mencionando las tecnologías relevantes.
- El porcentaje (0-100) indica qué tan buen match es la oferta con el perfil:
  - **90-100:** Match perfecto. Cumple todas las tecnologías y el nivel.
  - **70-89:** Buen match. Cumple la mayoría de requisitos.
  - **50-69:** Match parcial. Algunas tecnologías coinciden.
  - **0-49:** No es match. Requiere tecnologías o experiencia fuera del perfil.
- El backend aplica un clamp `Math.max(0, Math.min(100, porcentaje))` para asegurar rango válido.

## Flujo de evaluación

### Evaluación individual (`evaluarOferta`)

```
1. Construir prompt con datos de la oferta (título, empresa, ubicación, modalidad, nivel, descripción)
2. Ejecutar reglas de exclusión determinísticas (pre-validación):
   - Si la oferta es excluida → retornar rechazo sin llamar DeepSeek.
   - Si no → continuar.
3. Enviar a DeepSeek: sistema = instrucciones + perfil, usuario = datos de la oferta
4. Recibir respuesta en texto
5. Limpiar fences Markdown y parsear JSON con parser estricto (parser-respuesta-ia.js)
   - match debe ser boolean real (rechaza "true"/"false" string)
   - porcentaje entero 0-100 o null
   - razon string con fallback si vacía
6. Post-validación: reaplicar reglas de exclusión sobre resultado IA
   - Si DeepSeek aprobó una oferta excluida → sobrescribir con rechazo determinístico.
7. Retornar resultado
```

**Manejo de errores:** Si la API falla o la respuesta no es JSON válido, la oferta se marca como rechazada con un mensaje de error descriptivo, sin romper el flujo de las demás.

### Construcción del prompt (`construirPromptEvaluacion`)

No se manda el JSON crudo de la oferta. Se arma un texto legible:

```
Título: React Developer Junior
Empresa: TechCorp
Ubicación: Buenos Aires
Modalidad: remoto
Nivel requerido: junior
Plataforma: linkedin

Descripción completa de la oferta:
Buscamos un desarrollador...
```

Campos opcionales (empresa, ubicación, etc.) se omiten si son null.

### Evaluación masiva (`evaluarOfertasPendientes`)

```
1. Buscar todas las ofertas con estado_evaluacion = 'pendiente'
2. Si no hay pendientes → retornar resumen vacío
3. Para CADA oferta (secuencialmente):
   a. Evaluar con DeepSeek
   b. Determinar estado: match=true → 'aprobada', match=false → 'rechazada'
   c. Actualizar en BD: actualizarEvaluacion(id, estado, razon, porcentaje)
   d. Sumar contadores
4. Retornar resumen con totales
```

**¿Por qué secuencial y no en paralelo?** DeepSeek tiene rate limits. Si se mandan 100 requests simultáneos, bloquea. Procesando de a una, se respetan los límites y se facilita el debugging.

### Resumen de retorno

```javascript
{
    total: 30,       // Ofertas procesadas
    aprobadas: 12,   // match: true
    rechazadas: 18,  // match: false
    errores: 0,      // Fallos de API o parseo
    detalle: [       // Detalle por oferta
        { id: 5, titulo: "...", estado: "aprobada", razon: "..." },
        { id: 6, titulo: "...", estado: "rechazada", razon: "..." }
    ]
}
```

## Limpieza de respuesta

DeepSeek a veces envuelve el JSON en bloques de código markdown:

````
```json
{"match": true, "razon": "..."}
```
````

El servicio limpia esto antes de parsear:

```javascript
const jsonLimpio = respuestaTexto
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
```

## Bonus de IA y Next.js

> **Nota:** El sistema de scoring previo fue deprecado en B1. Los bonus de IA/Next.js
> ya no se configuran desde la UI de preferencias. DeepSeek + reglas-exclusion son el
> único flujo de evaluación. Los bonus por IA se manejan directamente en el prompt de
> DeepSeek como parte de los criterios de evaluación.
>
> La migración 016 elimina físicamente del esquema las columnas legacy de scoring previo
> (`score_previo`, `analisis_previo`, `scoring_version` en `ofertas` y `scoring_config`
> en `preferencias`), el índice `idx_ofertas_score_previo` y el constraint
> `chk_ofertas_score_previo`. Esta eliminación es irreversible; ver
> [Base de datos](base-de-datos.md) para detalles de rollback.

El prompt de DeepSeek incluye un **bonus acotado** para ofertas que valoren el uso competente de herramientas de IA y Next.js.

### Herramientas IA reconocidas

Se detectan menciones de: Claude Code, Codex, OpenCode, Antigravity, Copilot, ChatGPT, GPT-4, LLM, IA generativa, agentes de IA, prompt engineering, automatización/integración con IA, y AI tools.

### Magnitud del bonus

| Señal | Bonus máximo |
|-------|-------------|
| Herramientas IA | +6 |
| Next.js | +4 |
| Combinado (IA + Next.js) | +8 (cap) |

### Salvaguardas

El bonus IA **NO compensa** las siguientes exclusiones:

| Exclusión | Cap aplicado |
|-----------|-------------|
| Java como tecnología principal/excluyente | Score máximo 35 |
| Senior / SR / Lead | Score máximo 45 |
| Inglés avanzado excluyente | Score máximo 15 |

Estos caps se aplican **después** de sumar el bonus, de modo que ninguna oferta excluida por Java, seniority o idioma pueda quedar aprobada por el bonus IA.

### Detección de IA en evaluación

Los patrones regex para IA están diseñados para evitar falsos positivos: no matchean "ai" suelto ni acrónimos irrelevantes. Solo detectan términos concretos de productividad con IA en desarrollo. La detección se ejecuta dentro del prompt de DeepSeek, no como scoring previo.

### Next.js en el perfil

Next.js se incluye como tecnología aceptada en el stack del candidato (nivel práctico). Los patrones `next.js`, `nextjs`, `next 13+`, `app router`, `pages router` se reconocen en la evaluación de IA.

## Criterios adicionales del usuario (antes "prompt personalizado")

El campo de texto libre en preferencias ahora se llama **"criterios adicionales para la IA"** y funciona como complemento, no como reemplazo del prompt base.

### Comportamiento

- Cuando `usar_prompt_personalizado === true`, el texto se agrega al final del prompt de sistema bajo un bloque `### CRITERIOS ADICIONALES DEL USUARIO`.
- El texto NUNCA reemplaza las reglas base (exclusión Java, Senior/SR/Lead, 3+ años, inglés excluyente, ubicación/modalidad).
- Si el texto está vacío, no se agrega la sección adicional.

### UI

La interfaz de preferencias muestra:
- **Label:** "Criterios adicionales para la IA"
- **Placeholder:** "Agregá criterios extra para la evaluación (no reemplazan las reglas automáticas)"
- El cambio de nombre evita que el usuario crea que puede reescribir todo el prompt de evaluación.

## Parser estricto de respuesta IA (`parser-respuesta-ia.js`)

### Schema validado

| Campo | Tipo | Regla |
|-------|------|-------|
| `match` | boolean | **Rechaza** `"true"` o `"false"` como string. Solo acepta `true`/`false` literales. |
| `porcentaje` | number \| null | Entero 0-100. Clamp si fuera de rango. Null permitido. |
| `razon` | string | Fallback descriptivo si vacía o solo espacios. |

### Limpieza previa

Antes de parsear, elimina fences Markdown (```json ... ```) automáticamente.

### Manejo de errores

Si el JSON es inválido o no cumple el schema, retorna `{ match: false, porcentaje: null, razon: "Error de parseo: ...", error: true }`.

## Reglas determinísticas de exclusión (`reglas-exclusion.js`)

### Exclusiones fuertes

| Exclusión | Porcentaje | Regla |
|-----------|-----------|-------|
| Java como tecnología principal/excluyente | 10 | `java` |
| Senior / SR / Lead | 15 | `seniority` |
| 3+ años de experiencia excluyente | 20 | `experiencia` |
| Inglés avanzado/fluido/bilingüe excluyente | 15 | `idioma` |
| Presencial fuera de zonas preferidas | 10 | `ubicacion_modalidad` |

### Pre-validación

Se ejecutan antes de llamar a DeepSeek. Si alguna regla excluye, se retorna rechazo sin consumo de API.

### Post-validación

Se reaplican después de parsear la respuesta IA. Si DeepSeek aprueba una oferta que debió ser excluida, el resultado se sobrescribe con rechazo determinístico.

### Cache defensivo

También se aplican al leer resultados cacheados en `evaluarOfertasPendientes()`. Una oferta cacheada como aprobada pero que ahora es excluible se rechaza igual.

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del flujo.
- [Base de datos](base-de-datos.md) — Columnas `estado_evaluacion` y `razon_evaluacion`.
- [API REST](api-rest.md) — Endpoint POST `/api/evaluacion/ejecutar`.
- [Automatización](automatizacion.md) — Cómo el cron dispara evaluación después del scraping.

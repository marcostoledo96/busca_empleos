# Evaluación con IA — Busca Empleos

## Qué es y por qué se usa DeepSeek

DeepSeek es un modelo de lenguaje (como ChatGPT) pero más barato, con una API compatible con el formato de OpenAI. Si algún día se quisiera cambiar a OpenAI u otro proveedor compatible, solo haría falta cambiar la URL y el modelo.

**Modelo:** `deepseek-chat` (modelo principal, bueno y barato).
**URL:** `https://api.deepseek.com/chat/completions`.
**API key:** Variable de entorno `DEEPSEEK_API_KEY`.
**SDK:** Ninguno — usa `fetch()` nativo de Node.js 22 (menos dependencias).

## Archivos involucrados

| Archivo | Responsabilidad |
|---------|----------------|
| `backend/src/config/deepseek.js` | Función `consultarDeepSeek()` que envía mensajes y retorna la respuesta en texto. |
| `backend/src/servicios/servicio-evaluacion.js` | Construye prompts, evalúa ofertas, parsea respuestas JSON, actualiza la BD. |
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
{"match": true, "razon": "Explicación breve en español"}
{"match": false, "razon": "Explicación breve en español"}
```

La razón debe ser 1-2 oraciones, en español, mencionando las tecnologías relevantes.

## Flujo de evaluación

### Evaluación individual (`evaluarOferta`)

```
1. Construir prompt con datos de la oferta (título, empresa, ubicación, modalidad, nivel, descripción)
2. Enviar a DeepSeek: sistema = instrucciones + perfil, usuario = datos de la oferta
3. Recibir respuesta en texto
4. Limpiar markdown code blocks (```json ... ```) si vienen
5. Parsear JSON → { match: boolean, razon: string }
6. Retornar resultado
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
   c. Actualizar en BD: actualizarEvaluacion(id, estado, razon)
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

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del flujo.
- [Base de datos](base-de-datos.md) — Columnas `estado_evaluacion` y `razon_evaluacion`.
- [API REST](api-rest.md) — Endpoint POST `/api/evaluacion/ejecutar`.
- [Automatización](automatizacion.md) — Cómo el cron dispara evaluación después del scraping.

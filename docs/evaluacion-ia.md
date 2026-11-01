# Evaluación con IA — Busca Empleos

## Qué es y por qué se usa DeepSeek

Uso DeepSeek mediante una API compatible con el formato de Chat Completions de OpenAI. Esta integración no mide calidad ni costos reales frente a otros proveedores; no implemento otros proveedores en este cambio.

**Catálogo:** `deepseek-flash` (predeterminado) y `deepseek-v4-pro`. Normalizo el alias legacy `deepseek-v4-flash` a Flash; no representa otro modelo ni una versión fijada.
**URL:** `https://api.deepseek.com/v1/chat/completions`.
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

### `consultarDeepSeek(mensajeSistema, mensajeUsuario, modelo, opciones = {})`

Envío Chat Completions con `fetch` nativo y los dos mensajes `system`/`user`:

| Tarea | Razonamiento | Formato | Salida máxima | Timeout por intento |
| --- | --- | --- | --- | --- |
| Evaluación | `thinking: { type: 'enabled' }`, `reasoning_effort: 'low'` | `json_object` | 4096 tokens | 60000 ms |
| CV (`opciones.importacionCv: true`) | Igual | `json_object` | 16384 tokens | 120000 ms |

No envío temperatura: DeepSeek la ignora con razonamiento. Conservo los valores
históricos sin presentarlos como operativos. Mantengo Pro si fue seleccionado para
CV; no elijo Flash automáticamente. Estos límites son presupuestos, no garantía de
completitud para cualquier documento. Conservo hasta tres reintentos transitorios.

Exijo `choices` no vacío, `finish_reason: 'stop'`, contenido textual no vacío y un
objeto JSON válido antes del parser estricto de la tarea. `length`, salida vacía o
JSON inválido son fallos técnicos recuperables, nunca rechazos laborales ni hits de
caché exitosos. Valido también API key y modelo compatible.

El callback opcional `opciones.alRecibirMetadatos` recibe modelo solicitado,
`max_tokens` efectivo sin modificarlo, duración total (incluidos reintentos/backoff)
y, si están disponibles, modelo reportado, `finish_reason` y tokens de
entrada/salida/razonamiento. Solo acepto modelos del catálogo y el alias legacy;
omito identificadores desconocidos, aunque parezcan nombres de modelo válidos.
Solo acepto los cierres exactos `stop`, `length`, `content_filter`, `tool_calls`,
`function_call`, `aborted` e `insufficient_system_resource`; omito cualquier otro
texto. Los tokens deben ser enteros seguros no negativos: cero es válido, ausencia
no equivale a cero. No exporto `reasoning_content`, prompts, CV ni respuestas.
El callback se ejecuta una vez por consulta, también ante fallo de transporte;
sus excepciones no invalidan una respuesta ni generan solicitudes adicionales.
El retorno sigue siendo texto. Ver [preferencias](preferencias.md) y [comparación manual pendiente](comparacion-deepseek-issue-26.md).

### Diagnóstico de fallos de evaluación (#70, T1)

Consumo ese callback en el evaluador existente. Cada fallo registra un único
`console.error('[Evaluación] Fallo técnico de IA', campos)` con ID numérico seguro,
metadatos anteriores y código normalizado; nunca registro el objeto Error, stack,
mensajes originales, respuestas ni evidencias del parser. Una evaluación válida,
una exclusión o un hit de caché no emiten ese diagnóstico de fallo.

| Código diagnóstico | Evidencia disponible |
| --- | --- |
| `SALIDA_TRUNCADA` | Cierre `length`, incluso con JSON aparentemente completo |
| `SALIDA_INCOMPLETA` | Otro cierre o cierre desconocido/ausente |
| `CHOICES_AUSENTES` | Sin primera elección |
| `SALIDA_VACIA` | Cierre `stop` sin contenido textual usable |
| `JSON_INVALIDO` | Sobre o contenido no JSON válido/objeto |
| `RESPUESTA_INVALIDA` | Schema o coherencia rechazados por el parser |
| `HTTP_4xx` / `HTTP_5xx` | Estado HTTP numérico del último intento fallido |
| `TIMEOUT` | Aborté por vencimiento del timeout del intento |
| `CANCELADA` | El transporte devolvió `AbortError` sin vencer ese timeout |
| `ERROR_TRANSPORTE` | Otro fallo de transporte |
| `ERROR_EVALUACION` | Error inesperado sin código reconocido |

Mantengo `SALIDA_INCOMPLETA` en el error público del cliente para elecciones
ausentes/contenido vacío: la clasificación más precisa viaja por el callback,
sin cambiar el contrato HTTP de importación CV. La cancelación del lote sigue
siendo entre ofertas: no aborta la petición ya iniciada ni equivale a `CANCELADA`.

En API/persistencia conservo resultados de error y mensajes técnicos seguros,
sin copiar `SyntaxError.message` ni valores rechazados en los mensajes técnicos.
Conservo el contrato semántico previo del parser: porcentaje, flags de
inconsistencia/invalidez y explicación estructurada; nunca copio esos textos al
registro diagnóstico. La telemetría no se guarda en caché ni firma ni requiere columnas nuevas.
Sigo usando `actualizarEvaluacion`/`registrarErrorEvaluacion` y confirmo caché después
del UPDATE exitoso. No cambio resultados correctos, decisiones manuales ni
postulaciones. Mantengo cuatro intentos máximos de transporte, presupuestos,
modelos, razonamiento, prompts y scoring: no hay evidencia para más reintentos.

**Límite de la evidencia:** estos diagnósticos distinguen fallos futuros; los
mensajes históricos genéricos no prueban por qué fallaron aquellas consultas.
La verificación de telemetría es sintética con fetch/almacenamiento simulados,
sin proveedor real ni producción. El preview siguiente no recupera ofertas
automáticamente ni identifica los errores históricos.

## Perfil del candidato

Construyo el perfil mediante la función pura `construirPerfilEfectivo()` de
`backend/src/servicios/evaluacion/perfil-efectivo.js`, compartida por GET/PUT de
preferencias y el mensaje de sistema enviado al proveedor. Incorporo literalmente
`perfil_efectivo.texto`, formado por sus secciones de candidato, preferencias y
políticas obligatorias. El mensaje de usuario conserva los datos de la oferta.

Uso únicamente campos persistidos: tecnologías con nivel/evidencia,
idiomas, años reales, seniority, conocimientos ausentes, limitaciones y descripción
profesional (incluye experiencia/proyectos confirmados). No invento herramientas,
proyectos, idiomas ni años formales a partir de proyectos. `null` significa no
declarado. Los criterios adicionales no sirven para reemplazar estos hechos.
Ubico `roles_objetivo_detalle` en `restricciones.preferencias`: son objetivos de
búsqueda (migración 008), no hechos de experiencia. Conservo eliminaciones `[]`.
La vista de políticas refleja también el rechazo de inglés obligatorio genérico
(«English required», «inglés requerido», «inglés obligatorio/excluyente»), incluso
sin nivel especificado y aunque el candidato declare C1. Las menciones opcionales
siguen sujetas a la interpretación contextual #7; no cambio sus reglas.

El detalle presente prevalece sobre el campo anterior: tecnologías sobre stack,
inglés detallado sobre `idioma_candidato`, seniority real sobre `nivel_experiencia`.
`[]`, `{}`, `0` y nivel `ninguno` no activan fallback. Derivo y persisto el stack
cuando recibo tecnologías detalladas, incluso si también recibo un stack anterior.
Si falta el detalle o es null, admito el campo anterior guardado, sin inventar niveles.

**Compatibilidad del esquema:** las migraciones 008/010/011/012 cargaron defaults y
backfills (incluidos `[]`, inglés y un año de experiencia). No existe una marca de
confirmación que permita distinguir un valor histórico de una eliminación explícita:
respeto el valor persistido; `[]` nunca repuebla el perfil desde el stack anterior.
No infiero hechos reales ni reescribo filas existentes. La creación de una fila desde
el modelo declara hechos desconocidos e inglés `{}` explícitamente, evitando los
defaults personales del esquema. No requiero migración. El contrato tipado está en
[API REST](api-rest.md#perfil-efectivo-de-solo-lectura-issue-8).

## Confirmación del CV antes de evaluar (issue #11)

Reviso explícitamente las habilidades y la regla del detalle de idiomas que prioriza
el perfil efectivo; corregir solo el resumen libre no cambia ese detalle. Puedo rechazar
la propuesta y conservarlo. Rechazar una tecnología propuesta conserva su hecho previo
si ya estaba confirmado; no acredito tecnologías con nombres vacíos. Soporte respeta
las palabras clave revisadas sin reintroducir las que descarté.

Trato la extracción de DeepSeek como propuesta: reviso un borrador aislado y lo aplico
al formulario sin guardarlo automáticamente. Las respuestas de preguntas no acreditan
experiencia por palabras clave. Docker, salario y soporte tienen acciones explícitas
con alcance visible y acotado; React Native requiere revisión del nivel, sin inventar
años ni sobrescribir niveles confirmados automáticamente. Conservo salario manual si
el CV no lo informa, también cuando el backend devuelve null.

Persisto estados, respuestas y notas de preguntas en el JSONB existente únicamente al
Guardar preferencias. Una nota ignorada se conserva; ignorar sin nota descarta la
respuesta. Cancelar no altera el perfil ni ediciones manuales previas. La evaluación
sigue consumiendo exclusivamente el perfil persistido retornado por el backend, nunca
el borrador ni una confirmación optimista. Ver [revisión frontend](frontend.md#revisión-aislada-de-importación-cv-issue-11).

## Instrucciones de sistema (prompt de sistema)

Las instrucciones le dicen a DeepSeek exactamente cómo evaluar. Incluyen el perfil completo del candidato.

### Criterios de evaluación

| Criterio | Resultado |
|----------|----------|
| Candidato cumple ≥60% de requisitos técnicos | `match: true` |
| Nivel pedido compatible con seniority y evidencia declarados | Evaluación contextual, no aprobación automática |
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

## Requisitos contextuales (issue #7)

Interpreto las señales de Java, seniority, experiencia e inglés dentro de cláusulas pequeñas, separando título, descripción y campos textuales de datos crudos. Conservo límites de párrafos HTML, listas, puntuación y contrastes; las condiciones deseables, opcionales o negadas afectan su cláusula y sus continuaciones de lista, no toda la oferta. Un requisito obligatorio explícito en otra entrada prevalece sobre el modificador compartido (por ejemplo, «Java: deseable, inglés avanzado obligatorio»).

- No rechazo por «empresa líder», aprender junto a un senior, Java deseable, inglés avanzado como plus o antigüedad empresarial. Si Java es deseable pero inglés avanzado es obligatorio, rechazo por idioma.
- Conservo exclusiones por tecnología principal del puesto, Senior/SR/roles de liderazgo, experiencia exigida e inglés requerido. Mantengo porcentajes y umbrales: `3+`, `>3`, mínimo/al menos 3 y cantidades mayores siguen excluyendo; 3 años sin esos calificadores no activa esa regla.
- Separo requisitos coordinados por sus señales, independientemente del prefijo: «Java deseable y es obligatorio inglés avanzado» rechaza por idioma; «Java obligatorio, preferentemente inglés avanzado» rechaza por Java. Conservo sufijos sin señal («es requisito excluyente», «no excluyente») junto al requisito anterior. Una lista negada sin condición propia continúa siendo opcional.
- Corto el alcance compartido en ambos sentidos ante contrastes («aunque», «en cambio», «mientras que», además de «pero», «but» y «sin embargo»); una condición deseable después del contraste no vuelve opcional la lista anterior.
- Comparto hacia atrás el sufijo opcional de una lista coordinada («Conocimientos en Java y Spring Boot deseables», «Experiencia en Java y Spring Boot es un plus»), sin cruzar obligaciones explícitas ni condiciones locales opcionales/negadas. Una condición obligatoria vecina conserva su exclusión; las listas sin modificador conservan su interpretación anterior.
- Reutilizo el vocabulario local opcional/negado para los sufijos colectivos, incluido «opcional», «no excluyente», «no es obligatorio» y «not required», sin anular obligaciones explícitas anteriores al sufijo.
- Admito filas compactas de «Conocimientos en/de X» bajo encabezados explícitos, tanto opcionales como obligatorios. Reconozco también los encabezados aislados «Deseables», «Opcionales» y «Obligatorios» sin dos puntos (línea o encabezado HTML), no palabras sueltas dentro de narrativa. La narrativa de producto, mentor, equipo o empresa sigue cortando la herencia; un nuevo encabezado la restablece.
- Heredo encabezados explícitos de requisitos obligatorios/deseables en ítems HTML, párrafos `<p>` y filas breves enumeradas sin viñeta, con guion o viñeta `•`, con o sin dos puntos; `Requirements` también identifica una lista de requisitos. Otro encabezado o texto narrativo corta la herencia y la obligación implícita del campo crudo. No trato una fila breve que describe producto, equipo, mentor o empresa como requisito enumerado; un encabezado obligatorio posterior restablece la herencia. Conservo la procedencia de `requirements`/`requisitos` para tecnologías enumeradas, sin convertir narrativa del producto en obligación.
- Distingo «senior team» (nivel del equipo) de «Senior developer» (nivel del candidato). Vinculo cada nivel/cantidad al sujeto anterior más cercano: un junior para un equipo senior o una empresa con 5+ años no queda excluido; un candidato con experiencia obligatoria sí, aunque la misma oración describa la empresa.
- Reconozco el rol del mentor bajo «junto a» aunque «desarrollador» aparezca después de la preposición: «Vas a aprender junto a nuestro desarrollador senior.» no exige Senior. Una exigencia posterior a la trayectoria empresarial abre contexto del candidato usando el mismo vocabulario obligatorio de las demás reglas (incluido «considera obligatorio» o «es obligatorio tener»): «Empresa con más de 3 años de trayectoria exige 6+ años de experiencia» rechaza por experiencia, sin atribuirle la primera cantidad.
- Incluyo un extracto normalizado de hasta 242 caracteres alrededor del activador, con elipsis cuando recorto, que sustenta el rechazo en la razón; no atribuyo al candidato la trayectoria de la empresa o el nivel de su mentor. Para seniority considero el sujeto anterior a cada aparición: «empresa líder y buscamos desarrollador junior» no excluye; «desarrollador Senior que acompañará a juniors» sí exige Senior.
- Una mención ambigua **no es aprobación automática**: continúo con la IA y respeto su aprobación o rechazo. Uso el mismo evaluador antes/después de IA y para revalidar aprobaciones cacheadas.

**Límite de la heurística:** no implemento un analizador gramatical general. Las condiciones distribuidas entre varias cláusulas, coordinaciones complejas o vocabulario no reconocido pueden quedar para IA; no garantizo interpretar cualquier redacción. No modifico invalidación de cache ni recupero rechazos históricos; un rechazo ya cacheado conserva el comportamiento anterior. Tampoco cambio perfil ni geografía.

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

**Manejo de errores:** Si falla la API o el JSON en una reevaluación forzada con resultado válido previo, conservo esa evaluación y actualizo únicamente `evaluacion_error_mensaje`. Sin resultado válido previo mantengo la oferta pendiente con mensaje técnico, no rechazada. Continúo las demás ofertas ante fallos de proveedor; ante fallos SQL detengo el lote con estado `error`, nunca `completado`.

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
1. Usar la selección reciente validada por el controlador, o buscar pendientes extraídas en los últimos 30 días
2. Tomar una única copia del perfil guardado; si no hay ofertas → retornar resumen vacío
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
> único flujo de evaluación. La prioridad IA vigente pertenece al ranking separado;
> no equivale a un bonus fijo de match ni a una habilidad del candidato.
>
> La migración 016 elimina físicamente del esquema las columnas legacy de scoring previo
> (`score_previo`, `analisis_previo`, `scoring_version` en `ofertas` y `scoring_config`
> en `preferencias`), el índice `idx_ofertas_score_previo` y el constraint
> `chk_ofertas_score_previo`. Esta eliminación es irreversible; ver
> [Base de datos](base-de-datos.md) para detalles de rollback.

No declaro dominio fijo de IA o Next.js ni sumo un bonus fijo al porcentaje de match.
Comparo estas tecnologías con sus niveles y evidencias guardadas. La preferencia
`priorizar_ofertas_ia` y su máximo corresponden al ranking separado explicado abajo;
no desactivan exclusiones ni certifican habilidades. El detector local sigue
registrando la señal de prioridad de ofertas aprobadas, independientemente del orden.

## Criterios adicionales del usuario (antes "prompt personalizado")

El campo de texto libre en preferencias ahora se llama **"criterios adicionales para la IA"** y funciona como complemento, no como reemplazo del prompt base.

### Comportamiento

- Cuando `usar_prompt_personalizado === true`, el texto se agrega al final del prompt de sistema bajo un bloque `### CRITERIOS ADICIONALES DEL USUARIO`.
- Conservo el texto almacenado intacto (incluidos espacios). El texto NUNCA reemplaza hechos del candidato ni reglas base (exclusión Java, Senior/SR/Lead, 3+ años, inglés excluyente, ubicación/modalidad).
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

### Caché defensiva e identidad vigente (issue #9, T1)

Centralizo la caché en `evaluarOferta()`, compartida por llamadas individuales y
lotes. Ejecuto las defensas actuales antes de cualquier hit, incluso si la caché
contiene un rechazo; una aprobación compatible nunca anula una exclusión vigente.

Extraigo los mensajes finales a `entradas-evaluacion.js` y calculo SHA-256 en
`identidad-evaluacion.js` mediante serialización canónica (claves de objetos
ordenadas recursivamente, arrays conservados). El sistema enviado contiene
literalmente el perfil efectivo; ordeno sus objetos también al presentar esa vista.
La firma de criterios incluye el mensaje de sistema real, modelo efectivo
(`modelo_ia_evaluacion`, luego `modelo_ia`, luego el predeterminado), configuración
efectiva del proveedor (`thinking`, `reasoning_effort`, `response_format` y
`max_tokens`, compartidos con el request) y versiones del contrato de reglas/parser
y del detector de prioridad. Normalizo el alias de Flash antes de firmar. No incluye
claves API, timeout, duración, consumo ni configuración visual. No borro entradas
históricas: sólo reutilizo firmas compatibles; no requiero migración ni reevaluación
automática al normalizar nombres. Incremento `VERSION_CONTRATO_EVALUACION` cuando cambio
reglas o parser.

La identidad por oferta incluye el mensaje de usuario real, con `nivel_requerido`
y `plataforma`, más las seis fuentes crudas analizadas por las exclusiones:
`description`, `descriptionHtml`, `jobDescription`, `job_description`, `requirements`
y `requisitos`. No incluyo logos, tracking ni otros metadatos visuales. Conservo
mayúsculas, espacios y acentos de los mensajes efectivos; no pruebo equivalencia
con el hash normalizado anterior ni hago fallback a cachés legacy.

Uso `evaluarOferta(oferta, instrucciones, modelo, preferencias,
{ forzar: true })`: omito la lectura de caché, mantengo exclusiones y espero el
upsert que reemplaza resultado, hashes/modelo y `creado_en`. Una ejecución posterior
reutiliza el resultado nuevo. Los errores de API/parser no se cachean ni reciben
firma de éxito; una falla de almacenamiento de caché no invalida una evaluación.
En el worker difiero ese upsert mediante las opciones internas de `evaluarOferta()`
hasta completar el UPDATE de la oferta. Si el UPDATE falla, no reemplazo caché;
las llamadas individuales conservan su contrato de caché administrada.

El lote persiste `firma_criterios_evaluacion` mediante el séptimo argumento de
`actualizarEvaluacion()`, después de prioridad IA. La migración 019 agrega una
columna TEXT nullable, sin reconstruir criterios históricos. Listado, detalle y
sincronización derivan `vigencia_evaluacion` con el mismo helper puro: actual,
anterior o desconocida; pendientes y errores nunca son actuales. La vigencia compara
criterios, no cambios posteriores del contenido de la oferta. Guardar preferencias
compara firmas antes/después usando la fila persistida y retorna `cambio_criterios`
sin llamadas pagas. Ver [contrato API](api-rest.md#firma-y-vigencia-de-evaluaciones-issue-9-t1).

## Reevaluación seleccionada y reset (issue #9, T2)

Deshabilito `backend/tests/scripts/reevaluar-masivo.js`: tanto la ejecución directa
como la importación fallan antes de cargar dependencias, variables de entorno, BD
o IA. Conservo la fuente legacy como referencia, sin reset masivo ni un segundo
flujo de evaluación. Uso el dashboard para seleccionar ofertas recientes o POST
`/api/evaluacion/ejecutar` con `{"ids":[5,6]}`.

Reutilizo POST `/api/evaluacion/ejecutar` con `{"ids":[5,6]}`. Acepto 1–200 IDs
únicos, enteros positivos seguros; todos deben existir y haberse extraído en los
últimos 30 días. La ventana es fija por `fecha_extraccion`, no por publicación ni
evaluación. Selecciones vacías, malformadas, duplicadas, excesivas, históricas,
inexistentes o con conteo inesperado responden 400 antes de evaluar: no proceso
un subconjunto silenciosamente. Respondo inmediatamente con 200, `en_curso: true`,
`cantidad` exacta y `periodo_dias: 30`; si hay evaluación activa, respondo 409.

La selección siempre fuerza caché, incluso con `forzar: false`, y puede incluir
cualquier estado de evaluación o postulación. Mantengo exclusiones, reemplazo el
resultado compatible reutilizable y conservo estados/notas manuales. Un rechazo o
error técnico no descarta manualmente la oferta. Uso una única copia profunda del
perfil persistido al comenzar el worker, nunca preferencias entrantes sin guardar.
No agrego otra orquestación: comparto mutex, progreso y cancelación entre ofertas.
Sin `ids`, el mismo worker evalúa pendientes de extracción30d, también en automatización.
Cron y ejecución manual automática adquieren `EVALUACION_OFERTAS` antes de entrar
al worker, sin adquirir nuevamente el mutex que ya posee el endpoint seleccionado.
Si está ocupado, registro el conflicto en los errores del ciclo y no modifico
progreso, cancelación, caché ni resultados de evaluación. Retengo el cliente hasta
terminar el worker y sus escrituras de progreso/finalización de lote, incluso ante
cancelación o error; luego libero el bloqueo y devuelvo el cliente una sola vez.

POST `/api/evaluacion/resetear` usa extracción30d por defecto y admite `dias`
explícito entre 1 y 30, validado antes de escribir en controlador y modelo. Reseteo aprobadas/rechazadas, limpio firma, resultado, fecha
y prioridad de evaluación, y preservo campos manuales. Con el mismo mutex de la
ejecución, protejo el reset contra un worker activo. Uso el marcador
`REEVALUACION_SOLICITADA` en `evaluacion_error_mensaje` como **intención interna de
forzar una evaluación pendiente**, no como fallo técnico. Omite caché la próxima
vez que el worker procese esa oferta; al persistir el resultado reemplazo el marcador.
No elimino cachés compartidas ni pierdo el beneficio de reutilización ordinaria.

Si `dias` supera 30, rechazo el reset para no perder resultados históricos fuera de
la ventana reevaluable. Recomiendo seleccionar IDs recientes sin reset previo. Guardar perfil o resetear no
inicia scraping ni llamadas pagas; la ejecución explícita puede consultar IA según
las defensas y caché aplicables. Ver [contrato API](api-rest.md#post-apievaluacionejecutar).

## Recorrido explícito en el dashboard (issue #9, T3)

Después de guardar un cambio relevante confirmado por el servidor, muestro el aviso
«Tu perfil cambió» y un enlace a selección de ofertas. No lo infiero del formulario,
no invalido por cambios irrelevantes y no ejecuto llamadas pagas al guardar.

En `/?reevaluar=1` muestro ofertas de todos los estados extraídas en los últimos
30 días, con vigencia textual retornada por el backend. Refresco los bloques completos,
incluidas ofertas cuyo contenido no cambió, antes de habilitar selección. Una firma
histórica ausente sigue siendo desconocida; no reconstruyo ni invento criterios.

Selecciono una o varias ofertas desde tabla o cards y confirmo cantidad, extracción30d,
uso del perfil guardado y posible costo. Reutilizo POST de IDs, mutex, progreso y
cancelación del flujo existente; no agrego scraping ni un segundo evaluador. Los errores
400/409 de selección no inician polling ni se anuncian como éxito. Un cierre con estado
`error` o errores de proveedor muestra un aviso accesible y resultados actualizados/pendientes;
un cierre cancelado no anuncia éxito. Al terminar, incluso con error o cancelación, sincronizo
resultados parciales sin modificar decisiones manuales. En tabla/cards muestro el fallo
separado del resultado anterior conservado. Ver [frontend](frontend.md#reevaluación-seleccionada-issue-9).

## Verificación reproducible de issue #9 (T4)

Registro evidencia independiente sobre `d5c1a21a0a24e7c2b1aba5583ab8440cbd951c02`,
sin cambios de código fuente durante la verificación. Desde la raíz ejecuto:

```bash
cd backend
NODE_ENV=test ALLOW_DB_TESTS=false npm test -- --runInBand --silent
cd ../frontend
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

Resultados registrados: backend 1670 pruebas aprobadas, 48 omitidas y 36 suites
aprobadas; frontend 201 pruebas aprobadas y build aprobado.

Para repetir la variante SQL, preparo primero PostgreSQL 15.19 aislado en loopback,
base con sufijo `_test`, datos sintéticos y variables PG explícitas mediante `env -i`;
nunca uso el entorno de producción. Desde `backend`, con `NODE_ENV=test` y la guarda
`ALLOW_DB_TESTS=true` en ese entorno, ejecuto `npm run db:migrate:apply` (22 migraciones, incluida
019), lo repito (0 pendientes), luego `npm run test:db` (72 aprobadas, 6 suites,
mezcla de SQL real y mocks) y `npm test -- --runInBand --silent` (1718 aprobadas,
39 suites, ninguna omitida). Estos comandos requieren configurar ese aislamiento;
no constituyen una receta de aprovisionamiento ni infraestructura genérica.

Compruebo en SQL real preservación de estados/notas manuales, JSON crudo y fechas,
reset de 30 días sin históricos, upsert fresco, selección atómica y clientes advisory
reales; 019 es idempotente y conserva firmas legacy null. No agrego historial de
evaluaciones; incremento manualmente el contrato al cambiar decisiones determinísticas o parser.

**Alcance:** backend integrado con funciones reales y proveedor/PG simulados;
12 pruebas frontend HTTP/DOM con componentes y servicios reales, HTTP simulado,
sin conexión real al backend. No ejecuto API paga, scraping, revisión visual/responsive
ni auditoría. En esta verificación previa a publicar usé Node 24.18 local;
CI remoto con Node 22 no fue ejecutado.
Confirmo limpieza de fixtures aislados (tmpfs), sin datos persistentes restantes.

## Exportación privada para auditoría offline (#69)

Adapto el exportador existente de `backend/tests/scripts/exportar-ofertas.js` con
opt-in y destino explícitos, verificación SELECT de identidad/read-only, JSONL UTF-8
sin recortar descripciones, conteo reconciliado y criterios sanitizados separados.
Distingo extracción inicial de última extracción y reporto columnas ausentes como null,
versión del formato y fecha de exportación. Omito prompts privados y evidencias narrativas
del perfil; indico instrucciones incompletas y describo la prioridad IA como ranking
separado, nunca como bonus fijo al match.
No cambio scoring ni prompts, no inicio servicios y no exporto producción automáticamente.
La salida privada queda ignorada en `.qa-runtime/issue69/`; los datos sintéticos no
representan una exportación real. No atribuyo autoría no persistida ni reconstruyo
criterios históricos: la vigencia queda desconocida mientras el helper canónico
importe configuración con dotenv. La fecha almacenada puede provenir del backfill.
Ver [campos, procedimiento, pruebas y límites de sanitización](exportacion-auditoria-matching.md).

## Documentos relacionados

- [Arquitectura](arquitectura.md) — Vista general del flujo.
- [Base de datos](base-de-datos.md) — Columnas `estado_evaluacion` y `razon_evaluacion`.
- [API REST](api-rest.md) — Endpoint POST `/api/evaluacion/ejecutar`.
- [Automatización](automatizacion.md) — Cómo el cron dispara evaluación después del scraping.

## Prioridad IA explicable

La migración 018 agrega una señal de ranking separada de la evaluación: `prioridad_ia`,
`puntaje_prioridad_ia` (0 a 6), hasta tres evidencias textuales y la versión de política.
El detector local reconoce términos concretos como Claude Code, Copilot, LLM, IA generativa,
prompt engineering y Next.js; ignora `ai` aislado y menciones negadas. Esta señal nunca cambia
`match`, `porcentaje_match`, exclusiones ni la razón de rechazo.

La preferencia `priorizar_ofertas_ia` está desactivada por defecto. Al activarla solo ordena
ofertas por `porcentaje_match + min(puntaje_prioridad_ia, bonus_maximo_prioridad_ia)`; al
desactivarla se restaura el orden existente sin borrar datos. El cache incluye
`prioridad-ia-v1`, por lo que no reutiliza una política anterior.

## Matching explicable, coherencia y descripciones parciales (#17)

A partir de la issue #17, la evaluación con DeepSeek y las defensas determinísticas generan un desglose estructurado (`explicacion_evaluacion` en formato JSONB) que acompaña a la decisión y al porcentaje de compatibilidad.

### 1. Desglose estructurado de requisitos
El objeto `explicacion_evaluacion` organiza los hallazgos en cuatro categorías:
- **`cumplidos`**: requisitos técnicos o de rol respaldados por evidencia tanto en el aviso laboral como en el perfil confirmado del candidato.
- **`no_cumplidos`**: requisitos que el candidato no cumple, diferenciando claramente condiciones obligatorias de conocimientos deseables (*nice to have*). Un conocimiento deseable ausente **no** justifica por sí solo un rechazo.
- **`por_confirmar`**: aspectos sobre los que el aviso o el perfil no ofrecen información concluyente, o que provienen de un extracto parcial truncado. No se asume que un requisito no existe solo porque no aparece en un extracto resumido.
- **`exclusiones`**: condiciones obligatorias y excluyentes que fuerzan un rechazo (ej. requisito de Java excluyente, nivel senior excluyente, idioma obligatorio no alcanzado o incompatibilidad geográfica/presencial).

Cada ítem del desglose conserva: `requisito`, `tipo` (`obligatorio` | `deseable` | `desconocido`), `evidencia_oferta`, `evidencia_perfil` y `explicacion`.

### 2. Regla de coherencia y semántica de compatibilidad
- **Compatibilidad estimada:** El porcentaje numérico representa únicamente la afinidad técnica estimada entre la vacante y el perfil. Nunca se interpreta ni presenta como "probabilidad de contratación" ni como "probabilidad de ser contratado".
- **Validación estricta de porcentaje:** Se eliminó la coerción silenciosa de cadenas vacías `""` a `0`. Valores no numéricos, vacíos o fuera del rango `[0, 100]` invalidan la coherencia de la respuesta en lugar de forzarse mediante *clamping*.
- **Coherencia lógica entre decisión y score:**
  * `match: true` con porcentaje < 60% se marca como inconsistente.
  * `match: false` con porcentaje >= 60% solo es admisible si existe una exclusión obligatoria justificada en `exclusiones` (ej. 90% de coincidencia técnica pero rechazada por exigir Java obligatoriamente). Si no hay exclusión, se marca como inconsistente.
  * Ante contradicciones inexplicadas de la IA, el sistema no invierte silenciosamente la decisión ni altera el porcentaje; identifica el resultado como inconsistente con un mensaje claro en la razón.

### 3. Tratamiento de incertidumbre y descripciones parciales
- Se distingue la procedencia y completitud del texto del aviso:
  * **Extracto parcial conocido (`parcial` / `tarjeta`):** utilizado para portales como Bumeran (donde el scraper extrae solo la tarjeta del listado). El prompt instruye explícitamente a DeepSeek que no interprete la omisión de un término en un extracto como falta de habilidad del candidato; los requisitos no mencionados van a `por_confirmar`.
  * **Descripción completa confirmada (`completa` / `manual`):** avisos con texto completo o completados por el usuario.
  * **Descripción ausente (`ausente`):** avisos sin contenido disponible.
  * **Completitud desconocida (`desconocida`):** valor por defecto para scrapers genéricos sin metadatos de completitud.

### 4. Edición manual de descripción y reevaluación
- El usuario puede pegar el texto completo de una oferta desde el diálogo de detalle (`PATCH /api/ofertas/:id/descripcion`).
- Se resguarda el texto inicial en `descripcion_original` mediante `COALESCE(descripcion_original, descripcion)`.
- Se asigna `origen_descripcion = 'manual'`, `descripcion_completitud = 'completa'` y `descripcion_modificada_en = NOW()`.
- La evaluación previa pasa a `estado_evaluacion = 'pendiente'` con `evaluacion_error_mensaje = 'REEVALUACION_SOLICITADA'`.
- Como `hash_oferta` se calcula sobre el contenido textual normalizado del prompt, cualquier cambio de descripción invalida automáticamente la caché previa de `evaluaciones_cache` sin colisiones.
- La reevaluación es explícita a través de `POST /api/evaluacion/ejecutar` enviando el ID de la oferta. No se llama automáticamente a DeepSeek al guardar el texto.

### 5. Vigencia e identidad de evaluación
- La versión del contrato de identidad se incrementó a `VERSION_CONTRATO_EVALUACION = 'evaluacion-v4'`, marcando evaluaciones anteriores como vigencia no actual.

### 6. Muestra de referencia para regresión (25 casos)
- Se incorporó la suite sintética en `backend/tests/fixtures/casos-muestra-matching.js` con 25 casos representativos (QA, Soporte, Angular, exclusión Java, Java deseable, inglés excluyente vs deseable, empresas líderes vs candidato líder, restricciones territoriales, extractos parciales, porcentajes inconsistentes, etc.) con la marca `estado_revision: 'propuesta_pendiente_revision_humana'`.

## Distinción de errores técnicos y recuperación de lotes (#18)

A partir de la issue #18, se separa conceptual y fácticamente el **rechazo laboral** (la vacante no coincide con el perfil tras una evaluación válida) del **fallo técnico** (imposibilidad de evaluar por problemas del proveedor DeepSeek, límites HTTP 429, timeouts, desconexiones o respuestas no conformes):

### 1. Manejo estricto de fallos técnicos en el evaluador
- **Sin falsos rechazos:** Las ofertas pendientes que sufran un error técnico (HTTP 503, 429, timeout, error de red, JSON malformado o `null`) **no** se persisten como `estado_evaluacion = 'rechazada'`. Permanecen en `estado_evaluacion = 'pendiente'` con el detalle en `evaluacion_error_mensaje`.
- **Preservación de evaluaciones previas:** Si una oferta previamente aprobada o rechazada sufre un fallo técnico durante una reevaluación forzada, se conserva su veredicto anterior (`aprobada`/`rechazada`), su porcentaje, su firma y su fecha original, registrando el nuevo fallo en `evaluacion_error_mensaje` sin degradar el historial válido.
- **Aislamiento en caché:** Las respuestas fallidas o inconsistentes nunca se persisten en `evaluaciones_cache`.
- **Parser tolerante a primitivos y null:** `parsearRespuestaEvaluacionIa()` valida que la respuesta sea un objeto no nulo y no array antes de acceder a propiedades como `.match`, evitando excepciones de tipo `TypeError` ante textos JSON `null`, números, cadenas o arrays.

### 2. Recuperación idempotente de lotes interrumpidos
- **Reinicio del servidor sin bloqueos:** Al bootear el backend (`src/index.js`), `rehidratarProgreso()` inspecciona el último lote persistido en `evaluacion_lotes`. Si el lote figuraba como `estado = 'activo'` pero no existe un worker en ejecución, se finaliza en base de datos como `'error'`, y en memoria se establece `progresoEvaluacion.activo = false` con `mensaje_error: 'La evaluación previa fue interrumpida por reinicio del servidor.'`.
- **Desbloqueo inmediato:** Esto previene que un lote huérfano bloquee nuevos ciclos de evaluación con HTTP 409 de Advisory Lock o validación concurrente.
- **Cancelación segura:** `cancelarEvaluacionPendiente()` distingue si hay un worker realmente iterando en memoria (señalando parada ordenada) o si se trata de un lote interrumpido/huérfano (cerrando inmediatamente el lote en BD como `'cancelado'` y reseteando el progreso en memoria).

### 3. Acción «Reintentar errores»
- GET y POST `/api/evaluacion/reintentar-errores` comparten `obtenerOfertasConErrores`: exijo `estado_evaluacion = 'pendiente'`, extracción reciente por `COALESCE(fecha_ultima_extraccion, fecha_extraccion) >= NOW() - INTERVAL '30 days'`, error no nulo ni vacío/blanco ni marcador `REEVALUACION_SOLICITADA`, firma y porcentaje nulos, estado `no_postulado` y fecha/nota de postulación nulas. Una nota vacía también queda fuera por prudencia. Ordeno por primera extracción descendente e ID descendente para desempatar.
- Excluyo aprobadas/rechazadas aunque tengan error, pendientes con firma o porcentaje anterior (incluso cero), seguimiento manual y ofertas antiguas sin reaparición reciente. No cambio los demás selectores ni las exclusiones laborales.
- El POST existente reutiliza worker, mutex y progreso; no agrego otro ejecutor ni reintentos. Si tiene éxito, limpia el error y guarda resultado y firma después del UPDATE, antes de confirmar caché.

### Preview de solo lectura y autorización futura (#70, T2)

1. Obtengo autorización específica antes de **leer producción**; una sesión autenticada no reemplaza ese permiso operativo. En un entorno autorizado, consulto únicamente `GET /api/evaluacion/reintentar-errores` con el Bearer habitual, sin body ni parámetros.
2. Reviso `{ exito: true, total, ids }`: son candidatos **actuales**, no inventario histórico del incidente. No identifico los cinco errores históricos ni afirmo conocer cuatro IDs. La respuesta no incluye filas, mensajes técnicos, notas, descripciones ni perfil. Una falla SQL devuelve 503 genérico, no una lista vacía ni el mensaje privado de la excepción.
3. No ejecuto el POST como parte de este procedimiento. Antes de cualquier recuperación futura, necesito autorización explícita de producción con **IDs exactos**, alcance y posible costo, y revalidar exactamente esos IDs contra el selector vigente inmediatamente antes de ejecutar. Si cambia el conjunto, me detengo y reviso la autorización.

El GET no adquiere mutex, inicia lotes, lee preferencias, llama IA ni escribe ofertas,
firmas o caché. Hereda autenticación y el rate limit del router (5/min compartido).
Es una consulta puntual **no vinculante**: no reserva filas, no emite un token de
snapshot ni enlaza un futuro POST. Puede quedar obsoleto por cambios concurrentes.
El POST genérico vuelve a seleccionar el conjunto vigente, no acepta una aprobación
ligada al preview y **no constituye permiso** para recuperar esos IDs. Tampoco usar
`/ejecutar` con IDs evita la necesidad de autorización y revalidación.

### Causa → persistencia → costo y caché

| Causa comprobable | Estado / error persistido | Reintento y costo | Caché / firma |
| --- | --- | --- | --- |
| `length`, cierre incompleto, contenido vacío, JSON/schema inválido | Sin éxito previo: pendiente con error técnico, nunca rechazo laboral | Solo preview; no reintento nuevo por conjetura. Una ejecución autorizada puede consumir IA | No cacheo fallo ni asigno firma de éxito |
| HTTP 429/5xx, timeout o transporte | Pendiente con error técnico | Conservo solamente los reintentos transitorios existentes; no agrego loops ni presupuesto | No cacheo fallo |
| Fallo durante reevaluación con resultado válido anterior | Conservo estado, porcentaje, fecha y firma; registro solo error | Fuera del selector protegido, sin recuperación automática | Conservo caché y firma previas |
| Respuesta válida o exclusión determinística | Aprobada/rechazada, error nulo | Fuera del preview; exclusión previa no llama IA | Persisto resultado antes de caché; conservo defensas vigentes |
| Seguimiento manual o firma/porcentaje previo en pendiente | Sin cambios por GET ni selección de errores | Excluido por prudencia, requiere revisión explícita | Sin invalidación ni borrado |
| Fallo SQL | GET: 503 genérico; worker: lote en error | No simulo éxito ni agrego reintentos | No confirmo nueva caché antes de UPDATE exitoso |
| Error histórico genérico | No puedo atribuir causa retrospectiva | El total actual no reconstruye el incidente | No reconstruyo firmas históricas |

La prueba durable `backend/tests/integracion/issue-70-recuperacion.test.js` requiere
`ALLOW_DB_TESTS=true`, `DB_TEST_SINTETICA=true`, `NODE_ENV=test` y variables PG
explícitas hacia `127.0.0.1`, puerto asignado al cluster aislado, base terminada en
`_test`, usuario/clave sintéticos y `PGSSLMODE=disable`; rechazo `DATABASE_URL` y
servicios PG. Compruebo identidad y `test-db-guard` antes de DDL. Creo solamente
ofertas, caché y lotes en un esquema propio aleatorio dentro de una transacción que
revierto al terminar, sin migraciones ni tablas públicas. Bloqueo fetch externo;
proveedor y preferencias son sintéticos, persistencia de ofertas/caché es SQL real.
Sin ambos flags los casos PG quedan **SKIPPED**, no PASS.

**Evidencia local de #70:** `npm test -- --runInBand --no-cache --silent --verbose=false`
en entorno limpio de test: 2874 PASS, 161 SKIPPED, 0 FAIL (85 suites PASS, 11 SKIPPED).
Los dos casos anteriores pasaron además contra PostgreSQL 18 aislado con identidad
verificada y schema transaccional propio; confirmé el apagado del cluster al terminar.
Los otros 159 casos omitidos no quedan verificados por esta ejecución. No ejecuté
frontend, builds, migraciones, proveedor real ni producción. La causa de los cinco
fallos históricos sigue desconocida; estas pruebas no reconstruyen ese inventario.

## Exclusiones contextuales y conflicto de fuentes (#79)

Verifico con avisos inventados sobre BASE `fe93b04631d85dee4aa5a952077f7021fd8adb2c`.
No uso el informe privado ni atribuyo sus decisiones históricas al código vigente.

- **Ya funcionaban:** trayectoria empresarial («Nuestra organización lleva 27 años
  prestando servicios; buscamos trainee sin experiencia»), empresa referente,
  mentor Senior, coordinación puntual de pruebas, JavaScript, Java negado/deseable,
  publicación en inglés y requisito explícito de inglés sin la palabra «oral».
  La alternativa literal «dominio de al menos uno entre Java, TypeScript y Ruby»
  tampoco excluía; sí fallaba al anteponer «Se requiere».
- **Corrijo:** alternativas SSR/SR (también guiones, «o» y orden inverso),
  Semi-Senior frente a Senior, Java como opción entre tecnologías, «El candidato
  debe acreditar al menos 4 años» y cantidades explícitas mayores a tres vinculadas
  a experiencia. Conservo 3 años sin calificador, 3+, mínimos y porcentajes vigentes.
- Reconozco alternativas tecnológicas locales por «o/or» o «al menos uno
  entre/de», con nombres simples de tecnologías (incluidos C# y Python), sin
  una lista cerrada de lenguajes ni una gramática general. Verifico cada opción
  con los patrones existentes del ecosistema Java: si todas pertenecen a ese
  ecosistema, conservo la exclusión.
  Otra obligación independiente, incluido Java, Senior/Lead o inglés, conserva
  su rechazo. No apruebo automáticamente SSR ni altero scores por IA/Next.js.
- Si título o cuerpo del puesto Junior/Trainee contradice `nivel_requerido`
  Senior/SR, conservo ambas fuentes en `explicacion.por_confirmar` como
  **Conflicto de seniority**, tipo desconocido. No convierto el metadato en una
  exclusión automática ni fuerzo aprobación: respeto decisión y porcentaje del
  proveedor o caché. Conservo el conflicto también si otra regla excluye y al
  persistir un lote; no modifico el objeto cacheado recibido.
- Reutilizo el evaluador antes/después del proveedor y antes de aceptar caché.
  Actualizo el contrato a `evaluacion-v5`, también con instrucciones explícitas:
  no reutilizo firmas anteriores ni borro entradas o reparo datos históricos.
  No modifico geografía (#83), perfil ni manejo de fallos técnicos.

**Evidencia focal:** primera reproducción: 50 FAIL y 88 PASS (138 pruebas).
Después de la corrección: cinco suites focales PASS, 1246 pruebas PASS, cero
FAIL/SKIPPED. Incluyo controles adicionales y aprobación/rechazo simulados,
revalidación de caché, persistencia simulada y defensa posterior. Proveedor,
modelos y caché están simulados; llamadas reales al proveedor y SQL: cero.
La suite completa y la verificación independiente corresponden al cierre del
orquestador; estos resultados focales no las sustituyen.

**Corrección focal B1–B3 tras verificación independiente:** reproduzco 30 FAIL,
22 PASS y 177 SKIPPED por filtro antes de corregir. La ampliación de experiencia
había introducido tres regresiones frente a BASE: «Tenemos experiencia de 27
años prestando servicios», experiencia del mentor y capacitación impartida por
profesionales. Ahora vinculo esas cantidades al sujeto narrativo, no al candidato;
conservo exigencias posteriores y profesionales buscados como postulantes.
Distingo «Buscamos Junior» afirmado de «No buscamos perfil Junior», manteniendo
el rechazo Senior legítimo y el conflicto solo cuando corresponde. Las opciones
«Java or TypeScript» y «Java, C# y Python» eran defectos también presentes en BASE,
no regresiones nuevas ni prueba sobre decisiones históricas. Conservo Java
independientemente obligatorio, conjunciones y alternativas exclusivamente Java.
Cierro esta tanda con seis suites focales PASS, 1337 pruebas PASS, cero FAIL/SKIPPED.
El diferencial sintético contra BASE conserva 20 controles sin diferencias de
salida, stderr ni código; confirma B1 sin exclusión en ambos y B3 corregido.
El recheck independiente acotado a B1–B3 pasa 92 pruebas; otras 159 quedan
SKIPPED por selección focal, no equivalen a PASS. La suite completa se informa
por separado en la entrega de la PR.

### Corrección del comentario de auditoría F1/F2 de PR #84

Reproduzco los seis ejemplos del comentario `6552708131` sobre
`6f6bf39845848f37c174ea4475987f62621c8861`, con BASE
`fe93b04631d85dee4aa5a952077f7021fd8adb2c`, antes de corregirlos.

- **F1:** reconozco la cadena local completa «Java o Spring Boot o TypeScript»
  (también «or»), en lugar de pares no solapados. Conservo unidas las listas
  explícitas «al menos uno entre» al separar cláusulas. Evalúo todas sus opciones;
  una obligación Java independiente o una cadena exclusivamente Java sigue
  excluyendo. Esto no equivale a aprobación automática.
- **F2:** afirmo Junior/Trainee de la vacante, no de personas que la empresa
  capacita ni de postulantes negados mediante «No se buscan» o «No queremos».
  No uso el rol nominal de los mentoreados para reabrir la vacante. Conservo
  conflictos reales, incluida una vacante Junior que capacita usuarios, y el
  rechazo de puestos Senior legítimos. No cambio porcentajes ni geografía.

RED focal: **55 FAIL, 41 PASS, 1336 SKIPPED por filtro**. GREEN final:
**1451 PASS, 0 FAIL, 0 SKIPPED**, seis suites. Verifico reglas públicas,
pre/postevaluación, proveedor simulado que aprueba/rechaza, hits de caché y
persistencia simulada, sin mutar ofertas ni objetos cacheados. El diferencial
público contra `6f6bf39` conserva 20 controles con stdout, stderr y código de
salida idénticos. Mantengo `evaluacion-v5`: esta corrección integra el mismo
contrato aún no mergeado. No heredo el PASS anterior ni afirmo reparación
histórica; el cierre final de este delta se informa al final de esta sección.
No ejecuto proveedores, SQL real ni reevaluaciones de datos privados.

**Ajuste de límites F1 tras verificación independiente:** una lista explícita
no absorbe `Java obligatorio` coordinado después de «y» o coma. Conservo esa
obligación local aunque el reconocimiento de alternativas abarque su texto;
no convierto un sufijo colectivo de una cadena «o/or» en Java obligatorio.
Agrego las dos variantes exactas a la matriz pública existente: RED **11 FAIL,
1450 SKIPPED por filtro**; GREEN **1461 PASS, 0 FAIL, 0 SKIPPED**, seis suites.
El diferencial contra `6f6bf39` conserva 24 controles con stdout, stderr y código
idénticos. No modifico F2. El recheck independiente acotado pasa **48 pruebas**,
con 94 SKIPPED por selección; conservo el PASS anterior de los 70 checks F2 sin
repetirlos. La suite backend completa final pasa **3299 pruebas**, con 166 SKIPPED
y cero FAIL (88 suites PASS, 11 SKIPPED). Estas omisiones no equivalen a PASS.
Esto no garantiza interpretar cualquier redacción.

### Residuo F2: personal dirigido o formado (reauditoría #84)

Sobre `f9182792f3c33efa680f1839df719700963b9f6e` reproduzco los tres ejemplos
sintéticos del comentario `6557211706`: Junior como personal a liderar,
coordinar o formar mediante «train», no como nivel de la vacante Senior.
Acoto esos verbos al grupo/personas Junior inmediatamente siguientes dentro de
la cláusula. No silencio Junior/Trainee por tareas propias de coordinación,
aunque esas tareas aparezcan antes del nivel declarado. Mantengo el rechazo
Senior en 15 y las dos fuentes de los conflictos reales; no cambio F1 ni v5.

RED: **30 FAIL, 33 PASS, 1461 SKIPPED por filtro**. GREEN: seis suites,
**1524 PASS, 0 FAIL, 0 SKIPPED**, con reglas públicas, pre/post, proveedor,
caché y persistencia simulados e inmutabilidad. El diferencial contra `f918279`
conserva 16 controles Senior/SR con stdout, stderr y código idénticos.
La verificación independiente reproduce 30 fallos sobre el HEAD previo y pasa
**80 pruebas, cero FAIL/SKIPPED** con la fuente corregida. La suite backend
completa pasa **3362 pruebas**, con 166 SKIPPED y cero FAIL (88 suites PASS,
11 SKIPPED). No atribuyo PASS a los omitidos ni afirmo una gramática universal.


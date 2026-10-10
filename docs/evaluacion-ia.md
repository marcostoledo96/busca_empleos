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
efectiva del proveedor (URL y temperatura cero compartidas con el request) y
versiones del contrato de reglas/parser y del detector de prioridad. No incluye claves
API ni configuración visual. Incremento `VERSION_CONTRATO_EVALUACION` cuando cambio
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
explícito entre 1 y 365. Reseteo aprobadas/rechazadas, limpio firma, resultado, fecha
y prioridad de evaluación, y preservo campos manuales. Con el mismo mutex de la
ejecución, protejo el reset contra un worker activo. Uso el marcador
`REEVALUACION_SOLICITADA` en `evaluacion_error_mensaje` como **intención interna de
forzar una evaluación pendiente**, no como fallo técnico. Omite caché la próxima
vez que el worker procese esa oferta; al persistir el resultado reemplazo el marcador.
No elimino cachés compartidas ni pierdo el beneficio de reutilización ordinaria.

Si `dias` supera 30 explícitamente, puede dejar históricos pendientes; no los evalúo
automáticamente porque el worker normal y la selección mantienen la ventana30d.
Recomiendo seleccionar IDs recientes sin reset previo. Guardar perfil o resetear no
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
400/409 de selección no inician polling ni se anuncian como éxito. Al terminar sincronizo
resultados nuevos sin modificar decisiones manuales. Ver [frontend](frontend.md#reevaluación-seleccionada-issue-9).

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

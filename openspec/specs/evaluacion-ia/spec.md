# Spec — Evaluación IA

## ADDED Requirements

### Requirement: Bonus por buen uso de herramientas IA

El sistema SHOULD valorar ofertas que mencionen buen uso de herramientas IA compatibles con el perfil, incluyendo Claude Code, Codex, OpenCode y Antigravity, dentro del prompt/criterios activos de DeepSeek. La valoración MUST mejorar ofertas ya compatibles, pero MUST NOT reactivar scoring previo ni convertir una oferta excluida en aprobada.

#### Scenario: oferta compatible recibe bonus IA

- GIVEN una oferta trainee/junior compatible con el stack y sin exclusiones
- AND la oferta valora buen uso de Claude Code, Codex, OpenCode o Antigravity
- WHEN el sistema construye el prompt de evaluación activo
- THEN la valoración SHOULD incluir esa señal positiva sin calcular scoring previo.

#### Scenario: bonus IA no anula Java excluyente

- GIVEN una oferta que valora herramientas IA pero requiere Java como tecnología principal o excluyente
- WHEN el sistema evalúa la oferta
- THEN la oferta MUST rechazarse
- AND el bonus IA MUST NOT modificar esa decisión.

#### Scenario: bonus IA no anula seniority o experiencia excluyente

- GIVEN una oferta que valora herramientas IA pero pide Senior o más de 3 años comprobables
- WHEN el sistema evalúa la oferta
- THEN la oferta MUST rechazarse por seniority o experiencia excluyente
- AND el bonus IA MUST NOT aprobarla ni compensarla.

#### Scenario: bonus IA respeta idioma y ubicación

- GIVEN una oferta que valora herramientas IA pero incumple reglas existentes de idioma o ubicación
- WHEN el sistema aplica filtros y evaluación
- THEN las reglas de idioma/ubicación MUST prevalecer
- AND el bonus IA MUST NOT saltarse esos filtros.

### Requirement: Prevalidación determinística antes de DeepSeek

El sistema MUST ejecutar reglas de exclusión antes de llamar a DeepSeek. Si una regla excluye la oferta, el sistema MUST retornar rechazo determinístico y MUST NOT consumir una llamada IA.

#### Scenario: oferta Java no llama DeepSeek

- GIVEN una oferta pendiente que requiere Java excluyente
- WHEN el sistema evalúa la oferta
- THEN retorna `match: false`, porcentaje 10 y razón explícita.
- AND DeepSeek MUST NOT ser llamado.

#### Scenario: oferta sin exclusión sigue a IA

- GIVEN una oferta trainee/junior sin exclusiones fuertes
- WHEN el sistema evalúa la oferta
- THEN el sistema MAY llamar a DeepSeek para evaluación semántica.

### Requirement: Postvalidación defensiva del resultado IA

El sistema MUST reaplicar reglas de exclusión después de parsear la respuesta IA. Si DeepSeek aprueba una oferta excluida, el sistema MUST sobrescribir el resultado con rechazo determinístico.

#### Scenario: IA aprueba oferta senior por error

- GIVEN DeepSeek responde `match: true` para una oferta Senior
- WHEN el sistema postvalida el resultado
- THEN retorna `match: false`, porcentaje 15 y razón de seniority.

### Requirement: Scoring previo fuera del flujo activo

El sistema MUST NOT usar scoring previo como paso activo de evaluación, caché, prompt ni decisión final. Las exclusiones determinísticas y DeepSeek SHALL seguir siendo las fuentes activas de evaluación.

#### Scenario: evaluación no calcula scoring previo

- GIVEN una oferta pendiente sin exclusión determinística
- WHEN el sistema ejecuta la evaluación
- THEN MUST evaluar con el flujo activo sin invocar scoring previo
- AND el resultado MUST provenir de reglas determinísticas o DeepSeek.

#### Scenario: caché no depende de scoring previo

- GIVEN una oferta ya evaluada o candidata a cachearse
- WHEN el sistema consulta o guarda caché de evaluación
- THEN MUST NOT leer ni escribir datos de scoring previo como parte del criterio de caché.

## MODIFIED Requirements

### Requirement: Prompt de evaluación con salvaguardas de bonus

El prompt de evaluación MUST indicar que Next.js pertenece al stack/perfil y que Claude Code, Codex, OpenCode y Antigravity son señales positivas cuando la oferta valore buen uso de IA. También MUST declarar que el bonus IA es secundario: Java excluyente, Senior/SR/Lead, 3+ años excluyentes, inglés excluyente, e incumplimientos de ubicación/modalidad MUST prevalecer. El prompt MUST exigir JSON compatible con el parser estricto y MUST NOT incluir instrucciones de scoring previo.
(Previously: el prompt no prohibía explícitamente instrucciones de scoring previo.)

#### Scenario: prompt comunica bonus y límites

- GIVEN una oferta pendiente de evaluación
- WHEN el sistema construye el mensaje de evaluación para IA
- THEN el prompt MUST mencionar Next.js y herramientas IA del perfil
- AND MUST incluir que el bonus IA no anula exclusiones existentes.

#### Scenario: prompt exige formato estricto

- GIVEN una oferta que llega a DeepSeek
- WHEN el sistema construye el prompt
- THEN MUST pedir `match` boolean, `razon` string y `porcentaje` numérico o null.

#### Scenario: prompt no contiene scoring previo

- GIVEN una oferta que llega a DeepSeek
- WHEN el sistema construye el prompt
- THEN MUST NOT incluir instrucciones, pesos ni umbrales de scoring previo.

### Requirement: Titulación específica actual y autónoma

El sistema MUST validar Técnico/Técnica Superior como denominaciones académicas
específicas, sin equipararlas a Tecnicatura, Licenciatura o Ingeniería. MUST exigir
una afirmación actual del mismo requisito y una fuente íntegra autónoma sin citas.
MUST NOT extraer un título de un párrafo compuesto, hipotético o negado, ni acreditar
una cursada o condición de estudiante como título obtenido. La capacidad genérica
«Técnico de soporte» MUST conservar su validación no educativa.

#### Scenario: denominación exacta afirmada

- GIVEN el requisito «Técnico Superior en Desarrollo de Software» o su denominación femenina exacta
- AND el perfil declara autónomamente «Soy Técnico Superior en Desarrollo de Software.» o, respectivamente, «Soy Técnica Superior en Desarrollo de Software.»
- WHEN el proveedor cita esa declaración como cumplimiento
- THEN el sistema MUST conservar el cumplimiento del mismo requisito, no una equivalencia.

#### Scenario: título obtenido con artículo masculino

- GIVEN el requisito «Título de Técnico Superior en Desarrollo de Software»
- AND el perfil declara autónomamente «Obtuve el Título de Técnico Superior en Desarrollo de Software.»
- WHEN el sistema valida el cumplimiento
- THEN MUST admitir esa afirmación sin perder las formas femeninas previamente admitidas.

#### Scenario: formación no acreditada

- GIVEN evidencia de estudiante, cursada, hipótesis, cita, párrafo compuesto o título distinto
- WHEN el proveedor afirma cumplimiento de una titulación obligatoria
- THEN el sistema MUST dejarla por confirmar, sin inventar incompatibilidad ni alterar el porcentaje de afinidad.

### Requirement: Marco académico explícito dentro del perfil existente

El sistema MUST reconocer únicamente el marco completo anclado al primer carácter
de `perfil_profesional`, con encabezados exactos y únicos en este orden:

```text
Formación confirmada:
<una afirmación académica autónoma>

Experiencia y proyectos:
<relato completo no vacío>
```

MUST conservar el string original íntegro en el perfil efectivo y prompt, sin campos
persistentes nuevos, migraciones ni cambios productivos. MAY normalizar CRLF sólo
para validar el marco. MUST rechazar como fuente adicional los prefijos visibles u
ocultos, comillas/cercos envolventes, encabezados duplicados/faltantes/invertidos,
bloques vacíos, líneas adicionales y títulos presentes sólo en la narrativa.
La línea MUST empezar por una letra, no por prefijos de lista o encabezado.
En la línea académica nueva MUST rechazar antes de normalizar un marcador inicial
`>` (incluso con espacios previos), backticks de código, tachado `~~` o delimitadores
HTML `<!--` y `-->`; MUST NOT borrarlos para acreditar.

La afirmación MUST superar el predicado de título actual exacto v12, sin citas y con
salvaguardas literales/de cláusula: `Soy <requisito>` sólo para Técnico/Técnica Superior;
`Obtuve la/el`, `Completé la`, `Finalicé la`, `Me gradué de la` seguidos del requisito,
o requisito seguido de `obtenida/o`, `completada/o` o `confirmada/o`. MUST NOT inferir
equivalencias ni acreditar estudiante, cursada, pendiente, negación o hipótesis.
El encabezado MUST ser tratado como declaración, no certificación de egreso.

La nueva fuente MUST usarse sólo para obligaciones académicas, no incorporarse a
los hechos generales de residencia/capacidades ni trasladarse a seniority, tecnologías,
idioma o años. MUST conservar las declaraciones autónomas y demás reglas anteriores.
El contrato MUST ser `evaluacion-v13`, cambiando firma de criterios y hash de oferta
sin modificar proveedor/configuración ni históricos.

#### Scenario: línea académica válida y relato conservado

- GIVEN el marco exacto con `Soy Técnico Superior en Desarrollo de Software.` y un relato no vacío
- WHEN el proveedor cita íntegra esa línea para el mismo requisito académico obligatorio
- THEN el sistema MUST conservar cumplimiento, afinidad y relato íntegro
- AND el worker MUST persistir aprobada sin inventar datos ni alterar otros hechos.

#### Scenario: marco inválido o fuente no académica

- GIVEN un marco inválido, una afirmación no autónoma o un título no equivalente
- WHEN el proveedor afirma cumplimiento académico obligatorio
- THEN el sistema MUST dejarlo por confirmar con el porcentaje intacto y sin exclusión inventada
- AND la excepción MUST NOT acreditar residencia ni ampliar capacidades.

## Traceability to Tests

| Scenario | Suggested test |
|---|---|
| marco académico explícito, límites, persistencia e invariantes | `backend/tests/servicios/issue-80-elegibilidad.test.js`, `backend/tests/servicios/entradas-evaluacion.test.js` |
| denominación exacta afirmada; título obtenido con artículo masculino; formación no acreditada | `backend/tests/servicios/issue-80-elegibilidad.test.js` |
| oferta compatible recibe bonus IA | `backend/tests/servicios/servicio-evaluacion.test.js` |
| bonus IA no anula Java excluyente | `backend/tests/servicios/servicio-evaluacion.test.js` |
| bonus IA no anula seniority o experiencia excluyente | `backend/tests/servicios/servicio-evaluacion.test.js` |
| bonus IA respeta idioma y ubicación | `backend/tests/servicios/servicio-evaluacion.test.js` |
| oferta Java no llama DeepSeek | `backend/tests/servicios/servicio-evaluacion.test.js` |
| oferta sin exclusión sigue a IA | `backend/tests/servicios/servicio-evaluacion.test.js` |
| IA aprueba oferta senior por error | `backend/tests/servicios/servicio-evaluacion.test.js` |
| prompt comunica bonus y límites | `backend/tests/servicios/servicio-evaluacion.test.js` |
| prompt exige formato estricto | `backend/tests/servicios/servicio-evaluacion.test.js` |
| evaluación no calcula scoring previo | `backend/tests/servicios/servicio-evaluacion.test.js` |
| caché no depende de scoring previo | `backend/tests/servicios/servicio-cache-evaluacion.test.js` |
| prompt no contiene scoring previo | `backend/tests/servicios/servicio-evaluacion.test.js` |

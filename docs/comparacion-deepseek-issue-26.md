# Comparación manual DeepSeek — preparada, NO ejecutada

Dejo una comparación sintética pequeña para decidir si conviene desactivar
razonamiento en evaluación o cambiar Pro por Flash en CV. **No hay mediciones de
calidad, latencia, tokens ni costos reales. No autorizo ni ejecuto llamadas pagas.**
Las pruebas automatizadas usan MOCKS: demuestran contratos y recuperación, no calidad
del modelo. Las suites completas/build de T2 se verifican por separado por el
orquestador; este documento no declara sus resultados.

## Ruta de reproducción sin tocar la aplicación

1. Reviso humanamente la muestra y fijo expectativas antes de ver salidas. Registro
   revisión y desacuerdos en evidencia temporal controlada, no modifico los fixtures.
2. Preparo los cuerpos siguientes en una consola Node aislada desde la raíz, sin
   cargar `.env`, cliente DeepSeek, controlador, servidor ni conexiones PostgreSQL.
   No ejecuto endpoints de la app, PUT de preferencias, caché ni reevaluaciones.
3. **Sólo con autorización posterior explícita de gasto**, un operador puede enviar
   manualmente cada cuerpo a `POST https://api.deepseek.com/v1/chat/completions`,
   `Content-Type: application/json`, mediante un cliente HTTP controlado. La
   autenticación futura se configura fuera de esta receta; no leo cuentas, secretos
   ni credenciales para prepararla. No agrego CLI ni script de benchmarking.
4. Uso una pasada por configuración, mismo orden e inputs; alterno A/B por caso y
   C/D por CV, sin reintentos automáticos. Máximo previsto: 40 requests de ofertas y
   4 de CV. No los confundo con el flujo de producción que omite exclusiones antes
   de llamar al proveedor. Registro fecha UTC, revisión git y versión del prompt;
   nombres de modelo no fijan pesos/versiones. Una muestra pequeña no prueba superioridad.

### Ofertas: exactamente 20 casos existentes

Reutilizo estos IDs de `backend/tests/fixtures/casos-muestra-matching.js`:

```js
const ids = [
    'caso-01-qa-manual-compatible',
    'caso-02-soporte-it-compatible',
    'caso-03-desarrollo-angular-compatible',
    'caso-04-requisito-java-obligatorio',
    'caso-05-java-deseable-no-excluyente',
    'caso-06-ingles-avanzado-obligatorio',
    'caso-07-ingles-avanzado-deseable',
    'caso-08-mencion-mentor-senior',
    'caso-09-empresa-lider-no-lider-candidato',
    'caso-10-anios-existencia-empresa-vs-candidato',
    'caso-11-modalidad-ubicacion-compatible-caba',
    'caso-12-remoto-restriccion-territorial-incompatible',
    'caso-13-descripcion-parcial-tarjeta',
    'caso-14-descripcion-ausente',
    'caso-15-tecnologias-sin-evidencia-por-confirmar',
    'caso-16-requisitos-obligatorios-y-deseables-mezclados',
    'caso-22-datos-perfil-incompletos',
    'caso-23-requisito-excluyente-en-extracto-parcial',
    'caso-24-exclusion-post-evaluacion-omitida-por-deepseek',
    'caso-25-oferta-legacy-sin-desglose',
];
```

**Verdad provisional, pendiente de validación humana:** los 25 casos originales,
incluidos los 20 elegidos, tienen
`estado_revision: 'propuesta_pendiente_revision_humana'`. No son un gold standard.
`resultado_esperado`, `explicacion_esperada` y `respuesta_ia_simulada` son propuestas
para regresiones MOCK, no resultados de DeepSeek real. Excluyo 17–21 porque inyectan
incoherencias/porcentajes inválidos del parser, no decisiones laborales de referencia.
En 24/25 no exijo reproducir la omisión/desglose legacy del mock: comparo una respuesta
nueva con el contrato actual. Mantengo los rechazos determinísticos como control,
pero separo su resultado del mérito del proveedor: producción puede no llamarlo.

Después del bloque `ids`, preparo en memoria (sin imprimir mensajes):

```js
const assert = require('node:assert/strict');
const { CASOS_MUESTRA_MATCHING } = require('./backend/tests/fixtures/casos-muestra-matching');
const { construirInstruccionesDesdePreferencias, construirPromptEvaluacion } =
    require('./backend/src/servicios/evaluacion/entradas-evaluacion');
const casos = ids.map(id => CASOS_MUESTRA_MATCHING.find(caso => caso.id === id));
assert.equal(new Set(ids).size, 20);
assert(casos.every(caso => caso && caso.estado_revision === 'propuesta_pendiente_revision_humana'));
const configuraciones = {
    A: { thinking: { type: 'enabled' }, reasoning_effort: 'low' },
    B: { thinking: { type: 'disabled' } },
};
const solicitudes = casos.map(caso => {
    const perfil = { ...caso.perfil, nombre: 'Persona sintética de comparación' };
    const messages = [
        { role: 'system', content: construirInstruccionesDesdePreferencias(perfil) },
        { role: 'user', content: construirPromptEvaluacion(caso) },
    ];
    return {
        id: caso.id,
        cuerpos: Object.fromEntries(Object.entries(configuraciones).map(([clave, config]) =>
            [clave, { model: 'deepseek-flash', messages, ...config,
                response_format: { type: 'json_object' }, max_tokens: 4096 }])),
    };
});
```

A es la configuración vigente; B es alternativa manual, **no** una opción del cliente.
No envío `reasoning_effort` con thinking deshabilitado ni temperatura en ninguna
variante. Mantengo el mismo perfil por caso, prompt, JSON y presupuesto; sólo cambia
razonamiento. El nombre se sustituye exclusivamente para anonimizar el fixture en
ambas variantes. No envío respuestas simuladas ni expectativas como mensajes.
Configuro timeout de 60000 ms por request; anoto cualquier aborto como fallo técnico.

### CV: Pro vigente contra Flash, mismos mensajes y ajustes

Uso los textos UTF-8 Markdown de estos dos documentos, sin recorte:

- `backend/tests/fixtures/cv-sintetico-deepseek-26.txt`: empleo de seis meses,
  proyecto local, formación en curso, tecnologías y cuatro habilidades de inglés.
- `backend/tests/fixtures/cv-sintetico-deepseek-26-extenso.txt`: dos empleos (18 meses),
  proyectos no laborales, formación incompleta, tecnologías con evidencia/límites e
  idiomas diferenciados; hechos relevantes también al cierre.

Para reproducir exactamente los mensajes vigentes, copio **únicamente las dos
funciones completas** `construirPromptExtraccionSistema()` y
`construirPromptExtraccionUsuario(contenidoMarkdown)` desde
`backend/src/controladores/controlador-preferencias.js` a la misma consola aislada.
No están exportadas: no importo ni ejecuto el controlador, no copio su módulo ni
sus dependencias. Así reutilizo las instrucciones y schema actuales sin duplicarlos
en este documento. Luego preparo (sin envío ni impresión):

```js
const { readFileSync } = require('node:fs');
const documentos = ['cv-sintetico-deepseek-26.txt', 'cv-sintetico-deepseek-26-extenso.txt'];
const solicitudesCv = documentos.map(documento => {
    const texto = readFileSync(`backend/tests/fixtures/${documento}`, 'utf8');
    const messages = [
        { role: 'system', content: construirPromptExtraccionSistema() },
        { role: 'user', content: construirPromptExtraccionUsuario(texto) },
    ];
    return { documento, cuerpos: Object.fromEntries(
        [['C', 'deepseek-v4-pro'], ['D', 'deepseek-flash']].map(([clave, model]) =>
            [clave, { model, messages, thinking: { type: 'enabled' }, reasoning_effort: 'low',
                response_format: { type: 'json_object' }, max_tokens: 16384 }])) };
});
```

Uso timeout de 120000 ms por request. Sólo cambia el modelo C/D. No guardo ni aplico
la propuesta al perfil. Comparo conservación de fechas, tareas, empleo frente a
proyectos, educación en curso, niveles/evidencia tecnológicos e idiomas; busco
omisiones, inferencias y alucinaciones, especialmente hechos finales. El contrato
no tiene arrays dedicados de educación/experiencia: reviso su conservación en
`perfil_profesional` y evidencias, no invento campos nuevos. Los marcadores finales
son localizadores, no hechos que deban salir literalmente. Esta longitud ampliada
no demuestra ausencia de truncamiento en CV arbitrariamente extensos.

## Plantillas de evidencia — todas sin medir

Creo una fila por ID/documento y variante, **sólo en evidencia temporal controlada**:

| ID/documento | Variante | Revisión humana/expectativa y evidencia | Decisión válida | Correcta / falso rechazo / falsa aprobación / sin juzgar | Error JSON/contrato | Explicación incompleta | CV: hechos conservados / omisiones / alucinaciones | Fallo técnico |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pendiente | A/B/C/D | provisional; pendiente | no medida | sin juzgar | no medido | no medida | no medido / no aplica | no medido |

| ID + variante + fecha UTC | Modelo solicitado / reportado | finish_reason | Duración ms | Tokens entrada / salida / razonamiento | Hit/miss de entrada si informado | Costo |
| --- | --- | --- | --- | --- | --- | --- |
| pendiente | no medidos | no medido | no medida | no medidos | no informado | no medido |

| Variante | Casos revisados/evaluables | Decisiones correctas | Falsos rechazos | Falsas aprobaciones | Errores JSON/contrato | Explicaciones incompletas | Fallos técnicos | CV: preservación, omisiones, alucinaciones | Tiempo total/mediana | Tokens | Costo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A/B/C/D (una fila cada una) | pendiente | no medido | no medido | no medido | no medido | no medido | no medido | no medido | no medido | no medido | no medido |

- Sólo cuento aciertos/falsos rechazos/falsas aprobaciones con expectativa humana
  validada y respuesta completa, JSON/contrato válido; anoto aparte casos sin juzgar.
  No trato un error técnico como rechazo. No uso porcentaje mock como verdad real.
- Exijo `choices[0].finish_reason === 'stop'`, contenido textual no vacío y objeto
  JSON válido; `length` es truncamiento, no resultado laboral. Para ofertas uso el
  contrato de `parsearRespuestaEvaluacionIa(texto, caso.descripcion)` en
  `backend/src/servicios/evaluacion/parser-respuesta-ia.js`: compruebo también `error`
  e incoherencias. Reviso humanamente las cuatro categorías de `explicacion` y sus
  evidencias; un JSON aceptado no garantiza una explicación completa o correcta.
  Para CV contrasto con `validarExtraccionCv(datos, opciones)` y sus validadores
  usados en `analizarCvMarkdown`; no tomo JSON parseable como extracción válida.
- Registro modelo solicitado del cuerpo y reportado de `model`, razón de cierre de
  `choices[0].finish_reason` y tiempo de pared hasta leer el cuerpo completo. Sin
  respuesta HTTP registro duración/fallo local, no invento modelo reportado ni tokens.
  Distingo timeout, HTTP 429/5xx, red, truncamiento, vacío, JSON y contrato inválido.
- Uso `usage.prompt_tokens`, `usage.completion_tokens` y
  `usage.completion_tokens_details.reasoning_tokens` sólo si son números finitos
  no negativos. Faltante es **no informado**, nunca cero. Razonamiento puede ser
  subconjunto de salida: no lo sumo dos veces. Conservo sólo metadatos seguros en
  la tabla general, nunca `reasoning_content`, prompts, CV o salidas completas.
- No calculo costos por suposición: requiero fecha/modelo reportado, tokens cobrables
  desglosados (incluidos hit/miss si las tarifas los distinguen), unidad, moneda y
  tarifas efectivas de esa fecha. Sin esos datos escribo **no medido**. Duración y
  presupuesto máximo no equivalen a costo. No afirmo ahorros por usar Flash.
- Las salidas sintéticas sólo se inspeccionan en un entorno temporal controlado,
  sin logs generales ni adjuntos privados. No incorporo CV reales, prompts de usuario
  ni credenciales. Esta receta no escribe archivos ni modifica estado de la app.

## Fuentes oficiales y límites

Las cinco fuentes fueron verificadas por el padre antes de T1 (L3 del documento ODD);
no realizo una nueva consulta de red ni afirmo precios medidos:

1. https://api-docs.deepseek.com/quick_start/pricing/
2. https://api-docs.deepseek.com/updates/
3. https://api-docs.deepseek.com/api/create-chat-completion/
4. https://api-docs.deepseek.com/guides/thinking_mode/
5. https://api-docs.deepseek.com/guides/json_mode/

L3 documenta alias legacy, catálogo vigente, `thinking.type`, esfuerzo, JSON más
instrucción explícita y temperatura ignorada con razonamiento. Las fuentes y tarifas
pueden cambiar: antes de un ensayo autorizado revalido vigencia; el máximo admitido
no es presupuesto recomendado. No comparo alias contra canónico como modelos distintos.
No cambio proveedor/API, selección automática, scoring, cron, scraping, tablas,
caché histórica ni reevaluaciones. Mantengo la configuración conservadora actual
hasta contar con comparación real autorizada y revisión humana.

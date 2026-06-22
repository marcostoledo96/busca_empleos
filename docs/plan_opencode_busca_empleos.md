# Plan incremental para OpenCode — Corrección técnica de Busca Empleos

**Proyecto:** Busca Empleos  
**Objetivo:** aplicar correcciones críticas y deuda técnica detectada en la auditoría, sin reescrituras grandes y manteniendo producción funcionando.  
**Modo de trabajo:** cambios chicos, verificables y en orden.  
**Fecha del plan:** 2026-06-22

---

## 0. Decisiones confirmadas por Marcos

Estas decisiones son **fuente de verdad** para todo el plan. No reinterpretarlas.

1. **Cron automático:** debe ser **semanal los martes**, no cada 48 horas.
2. **Prompt personalizado:** debe funcionar como **criterio adicional**, nunca como reemplazo total de las reglas obligatorias del sistema.
3. **Scoring previo:** está **deprecado** y Marcos **no quiere que exista** como feature activa.
4. **Google Jobs e InfoJobs:** quedan **desactivados**, pero no se eliminan de inmediato.
5. **Dashboard/listados:** deben mostrar **solo ofertas de los últimos 30 días**.
6. **Base de datos de test:** Marcos no tiene una DB separada; implementar la alternativa más segura para no tocar producción.
7. **Exclusiones fuertes:** deben guardar **porcentaje bajo con razón explícita**, no porcentaje 0 por defecto.

---

## 1. Reglas globales para OpenCode

Antes de ejecutar cualquier tarea:

- No hacer deploy.
- No hacer push.
- No borrar archivos sin verificación previa.
- No tocar secretos ni archivos `.env` reales.
- No correr tests destructivos contra una base de datos que no sea claramente de test.
- No reescribir arquitectura completa.
- Hacer cambios en pasos chicos.
- Después de cada paso, correr los tests relevantes.
- Si un paso requiere una migración, debe ser idempotente.
- Si aparece una duda funcional, frenar y dejarla documentada; no inventar comportamiento.

Comandos base recomendados:

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm run build
```

Tests de DB real solo después de implementar DB de test segura:

```bash
cd backend
npm run test:modelos
```

---

## 2. Objetivo final del cambio

Al terminar este plan, el sistema debe garantizar esto:

- Una oferta que requiere **Java** debe rechazarse aunque mencione IA, Copilot, ChatGPT, Claude Code o Next.js.
- Una oferta que pide **Senior/SR/Lead** debe rechazarse con porcentaje bajo y razón clara.
- Una oferta que pide **3+ años / mínimo 3 años / al menos 3 años** debe rechazarse con porcentaje bajo y razón clara.
- Una oferta con **inglés avanzado, fluido, bilingüe o conversacional excluyente** debe rechazarse con porcentaje bajo y razón clara.
- Una oferta que rompe reglas de **ubicación/modalidad configuradas** debe rechazarse con porcentaje bajo y razón clara.
- El bonus por IA debe seguir siendo positivo, pero **nunca debe compensar exclusiones fuertes**.
- El prompt personalizado debe agregar criterios, no borrar reglas base.
- El scoring previo debe quedar eliminado/deprecado de código, UI y documentación activa.
- El cron debe mostrarse y funcionar como semanal los martes.
- Los listados deben usar una ventana fija de últimos 30 días.
- Los tests destructivos deben correr solo contra una DB de test segura.

---

## 3. Orden recomendado de ejecución

No saltear pasos. Cada etapa deja el proyecto en un estado usable.

1. Preparación y baseline.
2. Parser estricto de IA.
3. Reglas determinísticas de exclusión fuerte.
4. Prompt personalizado como criterio adicional.
5. Tests P0 de match IA.
6. Deprecación del scoring previo.
7. Cron semanal: UI + docs.
8. Últimos 30 días + índices.
9. DB de test segura + CI.
10. Plataformas desactivadas y enum consistente.
11. Documentación para IA.

---

# Fase 0 — Preparación segura

## 0.1. Inspección inicial

Ejecutar:

```bash
git status
rg "score_previo|analisis_previo|scoring_version|scoring_config|guardarAnalisisPrevio" .
rg "google-jobs|google_jobs|InfoJobs|infojobs" backend frontend docs README.md AGENTS.md
rg "INTERVAL '1 month'|último mes|ultimo mes|30 días|30 dias" backend frontend docs README.md
rg "Cada 48|48 hs|48 horas|martes|EXPRESION_CRON_DEFECTO" backend frontend docs README.md
```

Registrar qué archivos aparecen. No modificar todavía.

## 0.2. Baseline de tests

Ejecutar:

```bash
cd backend
npm test

cd ../frontend
npm run build
```

Si algo falla antes de tocar código:

- Guardar error exacto.
- No arreglar cosas no relacionadas todavía.
- Documentar como “fallo preexistente”.

---

# Fase 1 — Parser estricto de respuesta IA

## Problema

El código actual hace algo equivalente a:

```js
const match = !!respuesta.match;
```

Eso es peligroso porque:

```js
!!"false" === true
```

Una respuesta como esta puede terminar aprobando una oferta rechazada:

```json
{"match":"false","porcentaje":"15","razon":"Requiere Java"}
```

## 1.1. Crear parser dedicado

Crear archivo:

```text
backend/src/servicios/evaluacion/parser-respuesta-ia.js
```

Responsabilidad única:

- Recibir texto crudo de DeepSeek.
- Limpiar fences markdown.
- Parsear JSON.
- Validar schema estricto.
- Normalizar porcentaje.
- Devolver objeto seguro.

API sugerida:

```js
function parsearRespuestaEvaluacionIa(respuestaTexto) {
    // retorna:
    // {
    //   ok: true,
    //   resultado: { match: boolean, porcentaje: number | null, razon: string }
    // }
    // o:
    // {
    //   ok: false,
    //   error: 'mensaje claro'
    // }
}
```

Reglas:

- `match` debe ser boolean real.
- Si `match` es string (`"true"`, `"false"`) → error de schema, no coercionar.
- `porcentaje` puede ser number o string numérico, pero debe quedar number entero 0-100.
- Si falta porcentaje, permitir `null`.
- `razon` debe ser string no vacío.
- Si falta razón, usar fallback seguro:
  - Para `match=true`: `La oferta matchea con el perfil.`
  - Para `match=false`: `La oferta no matchea con el perfil.`
- Si JSON es inválido → `ok:false`.

## 1.2. Integrar parser en `servicio-evaluacion.js`

En `evaluarOferta`:

- Reemplazar parseo inline por `parsearRespuestaEvaluacionIa`.
- Si parser retorna `ok:false`, devolver:

```js
{
    match: false,
    porcentaje: 15,
    razon: `No se pudo interpretar la respuesta de DeepSeek: ${error}`,
    error: true,
}
```

Usar porcentaje bajo `15`, no `null`, para que el dashboard muestre que no conviene.

## 1.3. Tests del parser

Crear:

```text
backend/tests/servicios/parser-respuesta-ia.test.js
```

Casos mínimos:

1. JSON válido con `match:true` y porcentaje numérico.
2. JSON válido con markdown fence ```json.
3. JSON válido con porcentaje string numérico.
4. JSON sin porcentaje → `porcentaje:null`.
5. `match:"false"` → error, no aprobar.
6. `match:"true"` → error, no aprobar.
7. JSON inválido → error.
8. Porcentaje 150 → clamp a 100.
9. Porcentaje -10 → clamp a 0.
10. Razón vacía → fallback.

## 1.4. Validación

Ejecutar:

```bash
cd backend
npm test -- parser-respuesta-ia
npm test -- servicio-evaluacion
npm test
```

Criterio de aceptación:

- Ninguna respuesta con `match` string puede aprobarse.
- Tests existentes de evaluación deben seguir pasando o ajustarse si validaban el comportamiento viejo.

---

# Fase 2 — Reglas determinísticas de exclusión fuerte

## Problema

Las reglas críticas hoy dependen demasiado del prompt. Eso no alcanza para producción, porque la IA puede equivocarse o el prompt personalizado puede omitir reglas.

## 2.1. Crear módulo de reglas

Crear archivo:

```text
backend/src/servicios/evaluacion/reglas-exclusion.js
```

API sugerida:

```js
function analizarExclusionesFuertes(oferta, preferencias = {}) {
    // retorna:
    // {
    //   excluida: boolean,
    //   porcentaje: number | null,
    //   razon: string | null,
    //   reglas: string[],
    // }
}
```

También exportar helpers si sirven para tests:

```js
module.exports = {
    analizarExclusionesFuertes,
    _normalizarTexto,
    _detectarJavaRequerido,
    _detectarSeniorityExcluyente,
    _detectarTresOMasAnios,
    _detectarIdiomaExcluyente,
    _detectarUbicacionOModalidadInvalida,
};
```

## 2.2. Porcentajes bajos estándar

Usar estos valores iniciales:

```js
const PORCENTAJES_EXCLUSION = {
    java: 10,
    seniority: 15,
    anios_experiencia: 20,
    idioma: 15,
    ubicacion: 10,
    modalidad: 10,
};
```

Regla: si se activan varias exclusiones, usar el porcentaje más bajo.

Ejemplo:

- Java + Senior → porcentaje 10.
- Inglés avanzado + 3 años → porcentaje 15.

## 2.3. Regla Java

Debe rechazar si Java aparece como requisito real.

Detectar:

- `Java`
- `Spring Boot`
- `Spring Framework`
- `J2EE`
- `Jakarta EE`
- `Hibernate`
- `Maven` o `Gradle` si están junto a Java/Spring

No rechazar por:

- `JavaScript`
- `TypeScript`
- `Node.js`
- `React`
- `Angular`
- `JSON`

Casos esperados:

| Texto | Resultado |
|---|---|
| `Desarrollador Java Junior` | Rechaza |
| `Java / Spring Boot` | Rechaza |
| `JavaScript Developer` | No rechaza |
| `React + JavaScript + Node.js` | No rechaza |
| `Java y JavaScript` | Rechaza |

Razón sugerida:

```text
La oferta requiere Java/Spring como requisito, tecnología excluida del perfil configurado.
```

## 2.4. Regla Senior/SR/Lead

Debe rechazar si el título, nivel normalizado o descripción muestran que el rol pide seniority alto.

Detectar especialmente en título y `nivel_requerido`:

- `Senior`
- `Sr`
- `Ssr` / `Semi Senior` si está como nivel requerido excluyente
- `Lead`
- `Tech Lead`
- `Staff Engineer`
- `Principal Engineer`
- `Architect`
- `Arquitecto de software`

Cuidado con falsos positivos:

- `trabajarás con seniors` no necesariamente es rol senior.
- `mentoría de senior` no necesariamente es requisito.

Regla práctica:

- Si aparece en `titulo` → rechazar.
- Si `nivel_requerido` es `senior` o `semi-senior` → rechazar para perfil junior.
- Si aparece en descripción junto a `requisitos`, `buscamos`, `experiencia`, `perfil` → rechazar.

Razón sugerida:

```text
La oferta pide seniority Senior/SR/Lead, fuera del objetivo Trainee/Junior configurado.
```

## 2.5. Regla 3+ años

Debe rechazar si pide 3 o más años como requisito excluyente.

Detectar español:

- `3+ años`
- `+3 años`
- `mínimo 3 años`
- `minimo 3 años`
- `al menos 3 años`
- `3 años de experiencia`
- `tres años de experiencia`
- `entre 3 y 5 años`
- `más de 3 años`
- `mas de 3 años`

Detectar inglés:

- `3+ years`
- `minimum 3 years`
- `at least 3 years`
- `3 years of experience`
- `more than 3 years`

No rechazar por:

- `0 a 3 años`
- `hasta 3 años`
- `1 a 3 años deseable`
- `3 años deseable` si claramente no es excluyente

Razón sugerida:

```text
La oferta exige 3 o más años de experiencia como requisito, fuera del rango Trainee/Junior configurado.
```

## 2.6. Regla idioma

Debe rechazar si pide idioma por encima del nivel configurado.

Detectar:

- `inglés avanzado`
- `ingles avanzado`
- `advanced english`
- `fluent english`
- `inglés fluido`
- `ingles fluido`
- `bilingual`
- `bilingüe`
- `upper intermediate`
- `B2`, `C1`, `C2` si aparece como requisito
- `daily meetings in english`
- `english-speaking team`
- `communicate in english`

No rechazar por:

- `inglés deseable`
- `english nice to have`
- `lectura de documentación en inglés`
- `inglés técnico básico`

Razón sugerida:

```text
La oferta exige inglés conversacional/avanzado como requisito, por encima del nivel configurado.
```

## 2.7. Regla ubicación/modalidad

Usar preferencias:

- `modalidad_aceptada`
- `zonas_preferidas`

Reglas:

1. Si `modalidad_aceptada = remoto` y oferta no es remota → rechazar.
2. Si oferta es `presencial` y la ubicación no coincide con zonas preferidas → rechazar.
3. Si oferta es `hibrido` fuera de zona y no hay indicio de remoto real → rechazar o cap bajo según criterio actual.
4. Si la oferta es remota → no penalizar ubicación.

Para esta app, usar porcentaje bajo en rechazo, no 0.

Razón sugerida:

```text
La oferta es presencial/híbrida fuera de las zonas preferidas configuradas.
```

## 2.8. Integración en `servicio-evaluacion.js`

En `evaluarOferta`:

1. Construir preferencias finales.
2. Ejecutar `analizarExclusionesFuertes(oferta, preferenciasFinal)`.
3. Si `excluida === true`, devolver sin llamar a DeepSeek:

```js
{
    match: false,
    porcentaje: exclusion.porcentaje,
    razon: exclusion.razon,
    exclusion_fuerte: true,
    reglas_exclusion_detectadas: exclusion.reglas,
}
```

4. Si no hay exclusión, llamar a DeepSeek.
5. Parsear con parser estricto.
6. Volver a ejecutar reglas como post-validación defensiva.
7. Si post-validación detecta exclusión, sobrescribir resultado IA.

Importante:

- No permitir que DeepSeek apruebe una exclusión fuerte.
- No aplicar bonus IA si hay exclusión fuerte.
- Si una exclusión fuerte se detecta, cachear el resultado si el cache lo permite, porque es determinístico y ahorra tokens.

## 2.9. Tests de reglas

Crear:

```text
backend/tests/servicios/reglas-exclusion.test.js
```

Casos mínimos:

### Java

- `Desarrollador Java Junior` → excluida, porcentaje 10.
- `Backend Java Spring Boot` → excluida.
- `JavaScript Developer` → no excluida.
- `React Native + JavaScript` → no excluida.
- `Java y JavaScript` → excluida.

### Seniority

- `Senior Frontend Developer` → excluida.
- `SR React Developer` → excluida.
- `Tech Lead Node.js` → excluida.
- `Frontend Junior` → no excluida.

### Experiencia

- `3+ años de experiencia` → excluida.
- `mínimo 3 años` → excluida.
- `at least 3 years` → excluida.
- `hasta 3 años` → no excluida.
- `1 a 3 años deseable` → no excluida.

### Idioma

- `inglés avanzado excluyente` → excluida.
- `fluent english required` → excluida.
- `english nice to have` → no excluida.
- `inglés técnico para documentación` → no excluida.

### Ubicación/modalidad

- Presencial Córdoba con zonas `CABA`, `GBA Oeste` → excluida.
- Presencial CABA con zonas `CABA`, `GBA Oeste` → no excluida.
- Remoto USA/LATAM → no excluida por ubicación.
- Modalidad aceptada `remoto`, oferta presencial → excluida.

## 2.10. Actualizar tests existentes de evaluación

Buscar el test que dice algo como:

```text
llama a DeepSeek SIEMPRE para ofertas que antes eran cortadas por scoring
```

Ese comportamiento ya no debe existir para exclusiones fuertes.

Reemplazar por:

- Oferta Java remota → no llama a DeepSeek.
- Oferta Java remota → `match:false`, porcentaje bajo, razón Java.
- Oferta con IA + Java → no llama a DeepSeek, porque bonus IA no compensa.

## 2.11. Validación

Ejecutar:

```bash
cd backend
npm test -- reglas-exclusion
npm test -- parser-respuesta-ia
npm test -- servicio-evaluacion
npm test
```

Criterio de aceptación:

- Todas las exclusiones fuertes se resuelven sin consultar DeepSeek.
- DeepSeek no puede revertir una exclusión fuerte.
- JavaScript no se confunde con Java.

---

# Fase 3 — Prompt personalizado como criterio adicional

## Problema

El prompt personalizado no debe reemplazar reglas duras. Marcos confirmó que debe ser criterio adicional.

## 3.1. Cambiar construcción de instrucciones

En `construirInstruccionesDesdePreferencias(prefs)`:

- Nunca retornar `prefs.prompt_personalizado` directamente.
- Siempre construir primero las instrucciones base obligatorias.
- Si `usar_prompt_personalizado === true` y hay texto:

Agregar al final:

```text
CRITERIOS ADICIONALES DEFINIDOS POR EL USUARIO:
[texto del prompt personalizado]

IMPORTANTE: Estos criterios adicionales NO pueden anular las reglas estrictas del sistema: Java excluyente, Senior/SR/Lead, 3+ años excluyentes, idioma excluyente, ubicación/modalidad inválida ni el principio de que bonus IA no compensa exclusiones fuertes.
```

## 3.2. Ajustar UI de Preferencias

En la página de preferencias, cambiar textos para que no prometa reemplazo total.

Buscar textos relacionados con:

- `prompt_personalizado`
- `usar_prompt_personalizado`
- “reemplaza”
- “usa prompt personalizado en vez del auto-generado”

Cambiar a:

```text
Criterios adicionales para la IA
```

Y aclarar:

```text
Estos criterios se agregan al prompt base. No pueden anular las reglas estrictas de exclusión.
```

## 3.3. Tests

Actualizar tests que esperaban reemplazo total.

Casos nuevos:

1. Prompt personalizado activo mantiene reglas base.
2. Prompt personalizado activo incluye el texto adicional.
3. Prompt personalizado que dice “aceptar Java” no permite aprobar Java porque reglas determinísticas lo bloquean.

## 3.4. Validación

```bash
cd backend
npm test -- servicio-evaluacion
cd ../frontend
npm run build
```

---

# Fase 4 — Deprecar y eliminar scoring previo

## Decisión funcional

Marcos confirmó:

> El scoring previo está deprecado y no quiere que exista.

Esto significa:

- No mantener scoring previo como feature activa.
- No mostrar configuración de scoring previo en UI.
- No documentarlo como parte del algoritmo.
- No guardar `score_previo`, `analisis_previo` ni `scoring_version`.
- No confundir esto con `porcentaje_match`, que sí debe seguir existiendo.

## 4.1. Buscar referencias

Ejecutar:

```bash
rg "score_previo|analisis_previo|scoring_version|guardarAnalisisPrevio|scoring_config|penalizaciones|bonificaciones" backend frontend docs README.md AGENTS.md
```

Clasificar cada referencia:

- Código activo.
- UI activa.
- Tests.
- Migraciones.
- Docs.

No borrar migraciones históricas ya aplicadas si son necesarias para reconstruir DB, salvo que se cree una migración nueva que deje el schema final correcto.

## 4.2. Backend: eliminar función de modelo

En:

```text
backend/src/modelos/oferta.js
```

Eliminar si no hay usos:

```js
guardarAnalisisPrevio
```

También sacarla de `module.exports`.

Si hay tests que la usan, eliminarlos o reemplazarlos por tests de reglas determinísticas.

## 4.3. Backend: preferencias

En:

```text
backend/src/modelos/preferencia.js
backend/src/controladores/controlador-preferencias.js
```

Eliminar del flujo activo:

- `scoring_config` de campos permitidos.
- Validación de `scoring_config` si solo existía para scoring previo.
- Inclusión de `scoring_config` en hash de cache si ya no afecta evaluación.

Archivo involucrado:

```text
backend/src/modelos/evaluacion-cache.js
```

Quitar del hash:

```js
scoring_config: preferencias.scoring_config
```

Cuidado: al cambiar hash, se invalidan caches. Eso está bien porque cambia criterio.

## 4.4. Frontend: quitar UI de scoring previo

En:

```text
frontend/src/app/paginas/preferencias/preferencias.ts
frontend/src/app/paginas/preferencias/preferencias.html
frontend/src/app/modelos/preferencia.model.ts
```

Eliminar o dejar de renderizar:

- `scoringConfig`
- `restaurarScoringRecomendado()`
- Campos de penalizaciones/bonificaciones configurables.
- `scoring_config` del payload `guardar()`.
- `scoring_config` de `Preferencias` y `PreferenciasActualizar`.

Mantener:

- `porcentaje_match` de ofertas.
- Bonus IA como criterio de evaluación dentro del prompt/base rules si corresponde.
- Reglas determinísticas de exclusión.

## 4.5. Base de datos: migración de limpieza

Crear migración con el próximo número disponible.

No asumir número fijo. Primero listar:

```bash
ls backend/sql
```

Crear algo como:

```text
backend/sql/migracion-0XX-eliminar-scoring-previo.sql
```

Contenido sugerido:

```sql
-- Migración 0XX: eliminar scoring previo deprecado
-- El scoring previo fue deprecado. La evaluación final queda basada en:
-- reglas determinísticas de exclusión + DeepSeek + porcentaje_match.

ALTER TABLE ofertas
    DROP COLUMN IF EXISTS score_previo,
    DROP COLUMN IF EXISTS analisis_previo,
    DROP COLUMN IF EXISTS scoring_version;

ALTER TABLE preferencias
    DROP COLUMN IF EXISTS scoring_config;
```

Si al revisar el schema real `scoring_config` no existe, el `DROP COLUMN IF EXISTS` no falla.

## 4.6. Docs

Eliminar o marcar como deprecado todo lo que diga:

- scoring previo activo;
- caps de scoring previo;
- `score_previo`;
- `analisis_previo`;
- `scoring_version`;
- configuración UI de scoring.

Reemplazar por:

```text
El sistema usa reglas determinísticas de exclusión fuerte antes/después de la IA. Luego DeepSeek asigna porcentaje_match para ofertas no excluidas.
```

## 4.7. Tests

Agregar/ajustar:

- Test de que `PreferenciasActualizar` no envía `scoring_config`.
- Test backend de que `actualizarPreferencias` ignora `scoring_config` si alguien lo manda.
- Test de migración, si se agrega job de DB.

## 4.8. Validación

```bash
cd backend
npm test
cd ../frontend
npm run build
```

Criterio de aceptación:

- `rg "score_previo|analisis_previo|scoring_version|guardarAnalisisPrevio|scoring_config" backend/src frontend/src docs README.md` no debe devolver referencias activas, salvo notas de migración/deprecación si se decide mantenerlas.

---

# Fase 5 — Cron semanal martes

## Decisión funcional

El cron debe ser semanal los martes. El backend ya usa esta intención con:

```js
const EXPRESION_CRON_DEFECTO = '0 20 * * 2';
const TIMEZONE_CRON = 'America/Argentina/Buenos_Aires';
```

Eso significa martes a las 20:00 Argentina.

El problema principal está en UI/docs que dicen “cada 48 hs”.

## 5.1. Cambiar textos del frontend

Buscar:

```bash
rg "48 hs|48 horas|Cada 48|cada 48" frontend docs README.md AGENTS.md
```

Cambiar textos a:

```text
Semanal: martes 20:00
```

O más corto en UI:

```text
Martes 20:00
```

En tooltip:

```text
Activa un ciclo automático semanal todos los martes a las 20:00 (hora Argentina).
```

Archivos probables:

```text
frontend/src/app/componentes/panel-control/panel-control.html
frontend/src/app/componentes/panel-control/panel-control.ts
```

## 5.2. Backend: exponer descripción humana

Opcional pero recomendado.

En `servicio-automatizacion.obtenerEstado()` agregar:

```js
descripcionCron: estado.expresionCron
    ? describirCron(estado.expresionCron)
    : null
```

Para el default:

```text
Martes 20:00 (hora Argentina)
```

No hace falta parser cron genérico completo; puede ser una función simple:

```js
function describirCron(expresion) {
    if (expresion === EXPRESION_CRON_DEFECTO) {
        return 'Martes 20:00 (hora Argentina)';
    }
    return expresion;
}
```

## 5.3. Frontend: usar descripción del backend

Actualizar modelo `EstadoAutomatizacion` si existe.

La UI puede mostrar:

```html
{{ cronActivo() ? descripcionCron() : 'Inactivo' }}
```

Fallback:

```text
Martes 20:00
```

## 5.4. Tests

Backend:

- `obtenerEstado()` con cron activo devuelve `descripcionCron`.

Frontend:

- `PanelControl` muestra “Martes 20:00” cuando cron activo.

## 5.5. Validación

```bash
cd backend
npm test -- servicio-automatizacion
cd ../frontend
npm run build
```

---

# Fase 6 — Últimos 30 días, no “último mes”

## Decisión funcional

Marcos confirmó que el dashboard/listados deben mostrar **solo últimos 30 días**.

El código no debe usar `INTERVAL '1 month'`, porque “1 month” depende del mes calendario. Usar `INTERVAL '30 days'`.

## 6.1. Cambiar modelo de ofertas

En:

```text
backend/src/modelos/oferta.js
```

Cambiar:

```sql
fecha_extraccion >= NOW() - INTERVAL '1 month'
```

por:

```sql
fecha_extraccion >= NOW() - INTERVAL '30 days'
```

Actualizar comentarios de “último mes” a “últimos 30 días”.

## 6.2. Estadísticas

Aunque el dashboard deriva stats localmente, conviene alinear `/api/ofertas/estadisticas` con últimos 30 días.

Modificar `obtenerEstadisticas()`:

```sql
SELECT estado_evaluacion, COUNT(*)::integer AS cantidad
FROM ofertas
WHERE fecha_extraccion >= NOW() - INTERVAL '30 days'
GROUP BY estado_evaluacion
```

Si en el futuro se quiere histórico, crear endpoint separado o query param explícito. Hoy no.

## 6.3. Índice de performance

Crear migración con próximo número disponible:

```sql
CREATE INDEX IF NOT EXISTS idx_ofertas_fecha_extraccion_desc
    ON ofertas (fecha_extraccion DESC);

CREATE INDEX IF NOT EXISTS idx_ofertas_estado_fecha_extraccion
    ON ofertas (estado_evaluacion, fecha_extraccion DESC);

CREATE INDEX IF NOT EXISTS idx_ofertas_plataforma_fecha_extraccion
    ON ofertas (plataforma, fecha_extraccion DESC);
```

## 6.4. Tests

Actualizar tests que dicen “último mes”.

Casos:

1. Oferta de hace 29 días aparece.
2. Oferta de hace 31 días no aparece.
3. `total` cuenta solo últimos 30 días.
4. `obtenerEstadisticas()` cuenta solo últimos 30 días.

## 6.5. Docs

Cambiar:

- “último mes” → “últimos 30 días”
- README si corresponde.
- Docs DB/API/frontend.

## 6.6. Validación

```bash
cd backend
npm test -- oferta
npm test
```

---

# Fase 7 — Base de datos de test segura

## Problema

Marcos no tiene DB de test. Los tests de modelo hacen `TRUNCATE`, por lo que no deben poder correr contra producción por accidente.

## 7.1. Refuerzo de seguridad en tests de DB

En tests que hacen `TRUNCATE`, antes de ejecutar cualquier `TRUNCATE`, validar:

```sql
SELECT current_database() AS db;
```

Abortar si el nombre de base no termina con:

```text
_test
```

Ejemplo de helper:

```js
async function asegurarBaseDeDatosDeTest(pool) {
    const resultado = await pool.query('SELECT current_database() AS db');
    const nombre = resultado.rows[0].db;

    if (!nombre.endsWith('_test')) {
        throw new Error(
            `Tests destructivos bloqueados: la base actual (${nombre}) no parece de test. ` +
            `Usá una base que termine en _test.`
        );
    }
}
```

Mantener además `ALLOW_DB_TESTS=true`.

Condición final para tests destructivos:

- `ALLOW_DB_TESTS=true`
- DB actual termina en `_test`

## 7.2. `.env.test.example`

Crear:

```text
backend/.env.test.example
```

Contenido sugerido:

```env
NODE_ENV=test
PGHOST=localhost
PGPORT=5433
PGDATABASE=busca_empleos_test
PGUSER=postgres
PGPASSWORD=postgres
PGSSLMODE=disable
ALLOW_DB_TESTS=true
```

## 7.3. Docker Compose para PostgreSQL test

Crear si no existe:

```text
docker-compose.test.yml
```

Contenido sugerido:

```yaml
services:
  postgres-test:
    image: postgres:16
    container_name: busca_empleos_postgres_test
    environment:
      POSTGRES_DB: busca_empleos_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d busca_empleos_test"]
      interval: 5s
      timeout: 5s
      retries: 10
```

## 7.4. Scripts npm

En `backend/package.json`, agregar scripts seguros:

```json
{
  "scripts": {
    "test:modelos": "jest tests/modelos --verbose --runInBand",
    "test:db": "cross-env NODE_ENV=test ALLOW_DB_TESTS=true jest tests/modelos --verbose --runInBand"
  }
}
```

Si no se quiere agregar `cross-env`, usar documentación por sistema operativo. Para Windows, `cross-env` simplifica. Si se agrega dependencia, justificarla.

Alternativa sin dependencia:

```json
"test:db": "jest tests/modelos --verbose --runInBand"
```

Y documentar que se debe cargar `.env.test` manualmente.

## 7.5. GitHub Actions con Postgres service

Actualizar `.github/workflows/ci.yml` para agregar job de integración DB.

Ejemplo:

```yaml
backend-db:
  name: Backend DB integration
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_DB: busca_empleos_test
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'
        cache-dependency-path: backend/package-lock.json
    - run: |
        cd backend
        npm ci
        PGHOST=localhost PGPORT=5432 PGDATABASE=busca_empleos_test PGUSER=postgres PGPASSWORD=postgres PGSSLMODE=disable NODE_ENV=test npm run db:migrate:apply
        PGHOST=localhost PGPORT=5432 PGDATABASE=busca_empleos_test PGUSER=postgres PGPASSWORD=postgres PGSSLMODE=disable NODE_ENV=test ALLOW_DB_TESTS=true npm run test:modelos
```

Antes de esto, arreglar el migrador para que pueda correr desde DB vacía.

## 7.6. Validación

Local:

```bash
docker compose -f docker-compose.test.yml up -d
cd backend
npm run db:migrate:apply
ALLOW_DB_TESTS=true npm run test:modelos
```

Criterio de aceptación:

- Si se apunta a una DB que no termina en `_test`, los tests abortan antes de truncar.
- En CI, los tests de modelo corren contra Postgres efímero.

---

# Fase 8 — Migrador de base de datos

## Problema

El runner de migraciones existe, pero tiene fricciones:

- Exige `schema_migrations` creada manualmente.
- Tiene shebang mal escrito.
- Mensaje puede confundir `db:migrate` con aplicar.

## 8.1. Corregir shebang

En:

```text
backend/scripts/migrar.js
```

Cambiar:

```js
//!/usr/bin/env node
```

por:

```js
#!/usr/bin/env node
```

## 8.2. Crear `schema_migrations` automáticamente

Antes de consultar migraciones aplicadas, ejecutar:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    id          VARCHAR(255) PRIMARY KEY,
    aplicado_en TIMESTAMP DEFAULT NOW(),
    exitoso     BOOLEAN DEFAULT true
);
```

Así el runner puede arrancar desde DB vacía.

## 8.3. Evitar registrar `migracion-014-schema-migrations.sql` dos veces

Opciones:

### Opción A — Recomendada

Dejar el archivo histórico, pero si el runner detecta que la migración es `migracion-014-schema-migrations.sql`, aplicarla igual de forma idempotente y registrarla.

### Opción B

Eliminar el archivo histórico solo si se confirma que no se necesita para reconstrucción manual. Mejor no hacerlo.

## 8.4. Arreglar mensaje de aplicar

En modo dry-run, el mensaje debe decir:

```text
Para aplicarlas:
  npm run db:migrate:apply
```

No `npm run db:migrate`.

## 8.5. Usar misma lógica de SSL que `base-datos.js`

Idealmente, que el runner importe config compartida o use `DATABASE_URL`/`PGSSLMODE` igual que el backend.

No bloquear P0 por esto, pero dejarlo resuelto antes de CI DB.

## 8.6. Validación

Con DB de test vacía:

```bash
cd backend
npm run db:migrate:apply
npm run db:migrate
```

Criterio:

- Primera corrida aplica pendientes.
- Segunda corrida dice que no hay pendientes.

---

# Fase 9 — Plataformas desactivadas y enums consistentes

## Decisión funcional

Google Jobs e InfoJobs quedan desactivados.

No eliminarlos todavía. Sí ordenar el estado para que no generen confusión.

## 9.1. Crear registry de plataformas

Crear backend:

```text
backend/src/config/plataformas.js
```

Ejemplo:

```js
const PLATAFORMAS = {
    linkedin: { activa: true, label: 'LinkedIn', ruta: 'linkedin' },
    computrabajo: { activa: true, label: 'Computrabajo', ruta: 'computrabajo' },
    indeed: { activa: true, label: 'Indeed', ruta: 'indeed' },
    bumeran: { activa: true, label: 'Bumeran', ruta: 'bumeran' },
    glassdoor: { activa: true, label: 'Glassdoor', ruta: 'glassdoor' },
    getonbrd: { activa: true, label: 'GetOnBrd', ruta: 'getonbrd' },
    jooble: { activa: true, label: 'Jooble', ruta: 'jooble' },
    remotive: { activa: true, label: 'Remotive', ruta: 'remotive' },
    remoteok: { activa: true, label: 'RemoteOK', ruta: 'remoteok' },
    adzuna: { activa: true, label: 'Adzuna', ruta: 'adzuna' },
    google_jobs: { activa: false, label: 'Google Jobs', ruta: 'google-jobs', motivo: 'Desactivado por costo y baja utilidad' },
    infojobs: { activa: false, label: 'InfoJobs', ruta: 'infojobs', motivo: 'Desactivado temporalmente' },
};
```

No hace falta integrarlo todo de una vez, pero debe ser fuente de verdad progresiva.

## 9.2. Arreglar `google_jobs` vs `google-jobs`

Regla:

- Valor interno DB/API: `google_jobs`.
- Slug HTTP: `google-jobs`.
- UI filters deben usar `google_jobs` si filtran por `plataforma`.

Buscar:

```bash
rg "google-jobs|google_jobs" frontend backend
```

Cambiar dropdowns de filtro a `google_jobs` si filtran ofertas.

No cambiar rutas Express que usan `/google-jobs`.

## 9.3. UI

- En scraping UI, Google Jobs e InfoJobs deben seguir ocultos/desactivados.
- En filtros de dashboard, decidir:
  - Si hay datos históricos de Google Jobs/InfoJobs que Marcos quiera ver, mantener en filtro.
  - Si no hay datos y están desactivados, ocultar del filtro.

Decisión recomendada:

- Ocultar en acciones de scraping.
- Mantener en filtros solo si aparecen datos en el dataset, o dejarlos fuera por ahora.

## 9.4. Docs

Crear una tabla de estado:

| Plataforma | Estado | Motivo |
|---|---|---|
| Google Jobs | Desactivada | Costo alto / resultados no útiles |
| InfoJobs | Desactivada | Portal developers suspendido / credenciales opcionales |

## 9.5. Tests

- Filtro frontend con `google_jobs` si queda visible.
- Endpoint `/api/scraping/google-jobs` debe devolver desactivado sin llamar a Apify.
- Ciclo completo no debe invocar Google Jobs ni InfoJobs.

---

# Fase 10 — Performance mínima: paginación y límites

Esta fase es P2, no bloquear P0.

## 10.1. Backend: límite default

Como Marcos quiere últimos 30 días, se puede mantener carga completa por ahora. Pero para evitar crecimiento inesperado, agregar límite default opcional:

- Si frontend no manda `limite_pagina`, mantener comportamiento actual por compatibilidad.
- Documentar que frontend debe migrar a paginación server-side.

No cambiar comportamiento todavía si genera mucho cambio.

## 10.2. Frontend: server-side pagination futura

Plan posterior:

- `OfertasService.obtenerOfertas(filtros)` debe aceptar `pagina` y `limite_pagina`.
- `TablaOfertas` debe usar lazy loading de PrimeNG.
- Dashboard debe guardar `total`, `pagina`, `limite_pagina`.

No mezclar con P0.

---

# Fase 11 — Documentación para IA

## 11.1. Crear índice documental

Crear:

```text
DOCUMENTACION/INDEX.md
```

Debe incluir:

- Qué docs son vigentes.
- Qué docs están stale.
- Orden de lectura para IA.
- Módulos principales.
- Reglas que no se pueden romper.

## 11.2. Crear docs IA

Crear carpeta:

```text
DOCUMENTACION/IA/
```

Archivos mínimos:

```text
DOCUMENTACION/IA/ARQUITECTURA.md
DOCUMENTACION/IA/API.md
DOCUMENTACION/IA/CORE.md
DOCUMENTACION/IA/WEBAPP.md
DOCUMENTACION/IA/INFRA.md
DOCUMENTACION/IA/TESTING.md
DOCUMENTACION/IA/GOTCHAS.md
DOCUMENTACION/IA/DECISIONES.md
```

## 11.3. Contenido crítico de `CORE.md`

Debe decir explícitamente:

```text
Reglas duras de evaluación:

1. Java requerido excluye. JavaScript no es Java.
2. Senior/SR/Lead excluye.
3. 3+ años / mínimo 3 años / al menos 3 años excluye.
4. Inglés avanzado/fluido/bilingüe excluyente excluye.
5. Ubicación/modalidad fuera de preferencias excluye.
6. Bonus IA/Next.js nunca compensa exclusiones.
7. Prompt personalizado solo agrega criterios; no reemplaza invariantes.
8. Exclusiones fuertes guardan match=false, porcentaje bajo y razón explícita.
```

## 11.4. Actualizar docs viejas

Revisar y actualizar:

```text
README.md
docs/arquitectura.md
docs/base-de-datos.md
docs/evaluacion-ia.md
docs/api-rest.md
docs/frontend.md
docs/automatizacion.md
AGENTS.md
```

Cambios necesarios:

- Reemplazar “cada 48 horas” por “martes 20:00”.
- Reemplazar “último mes” por “últimos 30 días”.
- Eliminar scoring previo como feature activa.
- Explicar reglas determinísticas.
- Explicar Google Jobs/InfoJobs desactivados.
- Alinear branch real si `main`/`master` está inconsistente.

## 11.5. OpenSpec opcional pero recomendado

Crear:

```text
openspec/specs/job-evaluation/spec.md
```

Contenido mínimo:

```markdown
# Spec — Evaluación de ofertas

## Invariantes

- Una exclusión fuerte siempre gana sobre bonus IA.
- Java requerido excluye; JavaScript no.
- Senior/SR/Lead excluye.
- 3+ años excluye.
- Inglés avanzado excluyente excluye.
- Ubicación/modalidad fuera de reglas configuradas excluye.
- Prompt personalizado solo agrega criterios.

## Resultado esperado de exclusión fuerte

- match=false
- porcentaje bajo
- razón explícita
- no se llama a DeepSeek si la exclusión se detecta antes
```

---

# Prompts sugeridos para ejecutar con OpenCode

Usar estos prompts uno por uno. No mandar todo el plan completo en una sola ejecución.

---

## Prompt 1 — Baseline y búsqueda

```text
Leé este repositorio y hacé solo preparación.

No modifiques archivos todavía.

Tareas:
1. Ejecutá git status.
2. Buscá referencias a scoring previo:
   rg "score_previo|analisis_previo|scoring_version|scoring_config|guardarAnalisisPrevio" .
3. Buscá referencias a cron 48h/martes:
   rg "48 hs|48 horas|Cada 48|cada 48|martes|EXPRESION_CRON_DEFECTO" backend frontend docs README.md AGENTS.md
4. Buscá referencias google_jobs/google-jobs/infojobs:
   rg "google-jobs|google_jobs|InfoJobs|infojobs" backend frontend docs README.md AGENTS.md
5. Corré:
   cd backend && npm test
   cd frontend && npm run build

Devolveme un resumen de:
- tests pasan/fallan;
- archivos que habría que tocar;
- riesgos antes de empezar.

No cambies código en este paso.
```

---

## Prompt 2 — Parser estricto de IA

```text
Implementá solo el parser estricto de respuesta IA.

Objetivo:
- Evitar que match string, por ejemplo "false", se convierta en true.

Tareas:
1. Crear backend/src/servicios/evaluacion/parser-respuesta-ia.js.
2. Mover ahí la limpieza de markdown fences y JSON.parse.
3. Validar schema estricto:
   - match debe ser boolean real.
   - razon debe ser string no vacío o fallback seguro.
   - porcentaje puede ser number o string numérico, queda entero 0-100, o null si falta.
4. Integrar parser en backend/src/servicios/servicio-evaluacion.js.
5. Si parser falla, devolver match=false, porcentaje=15, error=true y razón clara.
6. Crear tests backend/tests/servicios/parser-respuesta-ia.test.js.
7. Ajustar tests existentes si validaban coerción vieja.

No implementes reglas de exclusión todavía.
No toques frontend.
No toques scoring previo.

Validación:
cd backend && npm test -- parser-respuesta-ia
cd backend && npm test -- servicio-evaluacion
cd backend && npm test
```

---

## Prompt 3 — Reglas determinísticas de exclusión fuerte

```text
Implementá solo reglas determinísticas de exclusión fuerte para evaluación.

Objetivo:
Antes de llamar a DeepSeek, rechazar con match=false, porcentaje bajo y razón explícita si la oferta viola reglas duras.

Reglas obligatorias:
1. Java requerido excluye, pero JavaScript NO.
2. Senior/SR/Lead excluye.
3. 3+ años / mínimo 3 años / al menos 3 años excluye.
4. Inglés avanzado/fluido/bilingüe/conversacional excluyente excluye.
5. Ubicación/modalidad fuera de preferencias excluye.
6. Bonus IA nunca compensa exclusiones.

Porcentajes:
- Java: 10
- Senior/SR/Lead: 15
- 3+ años: 20
- Idioma: 15
- Ubicación/modalidad: 10
Si hay varias exclusiones, usar el menor.

Tareas:
1. Crear backend/src/servicios/evaluacion/reglas-exclusion.js.
2. Exportar analizarExclusionesFuertes(oferta, preferencias).
3. Integrarlo en evaluarOferta antes de DeepSeek.
4. Hacer post-validación después de DeepSeek por defensa adicional.
5. Si hay exclusión fuerte, no llamar a DeepSeek.
6. Crear backend/tests/servicios/reglas-exclusion.test.js.
7. Actualizar el test viejo que esperaba que ofertas Java llamaran siempre a DeepSeek.

No toques scoring previo todavía.
No cambies frontend salvo que un test lo requiera.

Validación:
cd backend && npm test -- reglas-exclusion
cd backend && npm test -- servicio-evaluacion
cd backend && npm test
```

---

## Prompt 4 — Prompt personalizado como criterio adicional

```text
Cambiá el comportamiento del prompt personalizado.

Decisión de producto:
El prompt personalizado es criterio adicional, no reemplazo del prompt base.

Tareas backend:
1. En construirInstruccionesDesdePreferencias, nunca retornar prompt_personalizado solo.
2. Construir siempre instrucciones base con reglas estrictas.
3. Si usar_prompt_personalizado está activo, agregar el texto al final bajo:
   "CRITERIOS ADICIONALES DEFINIDOS POR EL USUARIO".
4. Aclarar en el prompt que esos criterios no pueden anular reglas estrictas.
5. Ajustar tests que esperaban reemplazo total.

Tareas frontend:
1. Cambiar textos de UI de preferencias para decir "criterios adicionales".
2. No prometer que reemplaza el prompt generado.

Validación:
cd backend && npm test -- servicio-evaluacion
cd backend && npm test
cd frontend && npm run build
```

---

## Prompt 5 — Deprecar scoring previo

```text
Deprecá/eliminá scoring previo como feature activa.

Decisión de producto:
Marcos confirmó que scoring previo está deprecado y no quiere que exista.

Importante:
- NO eliminar porcentaje_match.
- NO eliminar reglas determinísticas de exclusión.
- NO eliminar bonus IA como criterio positivo de evaluación.
- Sí eliminar score_previo, analisis_previo, scoring_version, guardarAnalisisPrevio y scoring_config como feature activa.

Tareas:
1. Ejecutar rg "score_previo|analisis_previo|scoring_version|scoring_config|guardarAnalisisPrevio|penalizaciones|bonificaciones" backend frontend docs README.md AGENTS.md.
2. Eliminar guardarAnalisisPrevio de backend/src/modelos/oferta.js si no hay usos activos.
3. Quitar scoring_config de preferencias backend si solo existía para scoring previo.
4. Quitar scoring_config del hash de evaluacion-cache.
5. Quitar UI de scoring previo en frontend preferencias.
6. Quitar scoring_config de modelos TypeScript.
7. Crear migración idempotente con el próximo número disponible para DROP COLUMN IF EXISTS:
   - ofertas.score_previo
   - ofertas.analisis_previo
   - ofertas.scoring_version
   - preferencias.scoring_config
8. Actualizar docs para decir que scoring previo fue deprecado.

No borres migraciones históricas existentes.
No toques Google Jobs/InfoJobs en este paso.

Validación:
cd backend && npm test
cd frontend && npm run build
rg "score_previo|analisis_previo|scoring_version|guardarAnalisisPrevio|scoring_config" backend/src frontend/src docs README.md
```

---

## Prompt 6 — Cron semanal martes

```text
Alineá cron y UI con la decisión: semanal los martes.

Tareas:
1. Mantener backend default como martes 20:00 hora Argentina si ya está así.
2. Cambiar textos frontend que digan cada 48hs/cada 48 horas.
3. Mostrar "Martes 20:00" o "Semanal: martes 20:00" cuando cron esté activo.
4. Actualizar tooltip de automatización.
5. Opcional recomendado: backend obtenerEstado puede devolver descripcionCron.
6. Actualizar docs relacionadas.

Validación:
rg "48 hs|48 horas|Cada 48|cada 48" backend frontend docs README.md AGENTS.md
cd backend && npm test -- servicio-automatizacion
cd frontend && npm run build
```

---

## Prompt 7 — Últimos 30 días + índices

```text
Alineá listados y estadísticas a últimos 30 días.

Tareas:
1. En backend/src/modelos/oferta.js cambiar INTERVAL '1 month' por INTERVAL '30 days'.
2. Actualizar comentarios de último mes a últimos 30 días.
3. Hacer que obtenerEstadisticas también cuente solo últimos 30 días.
4. Actualizar tests del modelo:
   - 29 días aparece.
   - 31 días no aparece.
   - total cuenta solo 30 días.
   - estadísticas cuentan solo 30 días.
5. Crear migración idempotente con índices:
   - idx_ofertas_fecha_extraccion_desc
   - idx_ofertas_estado_fecha_extraccion
   - idx_ofertas_plataforma_fecha_extraccion
6. Actualizar docs.

Validación:
cd backend && npm test -- oferta
cd backend && npm test
rg "último mes|ultimo mes|INTERVAL '1 month'" backend frontend docs README.md AGENTS.md
```

---

## Prompt 8 — DB de test segura

```text
Implementá seguridad para tests destructivos de base de datos.

Contexto:
Marcos no tiene DB de test. Los tests de modelo hacen TRUNCATE, así que deben bloquearse si la DB no parece de test.

Tareas:
1. Crear helper de test que valide current_database() y exija que termine en _test.
2. Integrarlo antes de cualquier TRUNCATE en tests/modelos.
3. Mantener ALLOW_DB_TESTS=true como segunda condición.
4. Crear backend/.env.test.example.
5. Crear docker-compose.test.yml con Postgres efímero en puerto 5433 y DB busca_empleos_test.
6. Documentar cómo correr tests DB localmente.
7. No tocar producción ni DATABASE_URL real.

Validación:
- Si DB no termina en _test, test:modelos debe abortar antes de TRUNCATE.
- Si DB es busca_empleos_test y ALLOW_DB_TESTS=true, puede correr.
```

---

## Prompt 9 — Migrador autónomo

```text
Mejorá el runner de migraciones sin cambiar el objetivo funcional.

Tareas:
1. Corregir shebang en backend/scripts/migrar.js.
2. Hacer que el runner cree schema_migrations automáticamente si no existe.
3. Corregir mensaje dry-run para que recomiende npm run db:migrate:apply.
4. Verificar que correrlo dos veces sea seguro.
5. No borrar migraciones históricas.

Validación con DB de test:
cd backend
npm run db:migrate:apply
npm run db:migrate
```

---

## Prompt 10 — Google Jobs / InfoJobs desactivados y enums

```text
Ordená el estado de plataformas desactivadas sin reactivarlas.

Decisión:
Google Jobs e InfoJobs quedan desactivados.

Tareas:
1. Crear o proponer un registry de plataformas con activa=true/false.
2. Asegurar que ciclo completo NO llame Google Jobs ni InfoJobs.
3. Mantener endpoints desactivados sin gastar APIs.
4. Arreglar inconsistencia google_jobs vs google-jobs:
   - DB/API interna: google_jobs
   - ruta HTTP: google-jobs
5. Revisar filtros frontend para que usen el valor interno correcto si filtran por plataforma.
6. Actualizar docs.

Validación:
rg "google-jobs|google_jobs|InfoJobs|infojobs" backend frontend docs README.md
cd backend && npm test -- servicio-automatizacion
cd frontend && npm run build
```

---

## Prompt 11 — Documentación para IA

```text
Creá documentación interna para que futuros agentes no rompan el proyecto.

Tareas:
1. Crear DOCUMENTACION/INDEX.md.
2. Crear DOCUMENTACION/IA/CORE.md con reglas duras de evaluación.
3. Crear DOCUMENTACION/IA/GOTCHAS.md con:
   - Java vs JavaScript.
   - 3+ años.
   - bonus IA no compensa exclusiones.
   - prompt personalizado solo adicional.
   - cron martes 20:00.
   - últimos 30 días.
   - Google Jobs/InfoJobs desactivados.
4. Crear o actualizar DOCUMENTACION/IA/TESTING.md.
5. Actualizar README/docs viejas que contradigan el código actual.
6. No reescribir docs completas si no hace falta: corregir secciones stale.

Validación:
rg "scoring previo|score_previo|cada 48|último mes|PERFIL_CANDIDATO" README.md docs DOCUMENTACION AGENTS.md
```

---

# Checklist final de aceptación

Antes de cerrar la corrección completa:

```bash
cd backend
npm test

cd ../frontend
npm run build

cd ..
rg "score_previo|analisis_previo|scoring_version|guardarAnalisisPrevio|scoring_config" backend/src frontend/src docs README.md
rg "48 hs|48 horas|Cada 48|cada 48" backend frontend docs README.md AGENTS.md
rg "INTERVAL '1 month'|último mes|ultimo mes" backend frontend docs README.md AGENTS.md
```

Resultado esperado:

- Backend tests pasan.
- Frontend build pasa.
- No quedan referencias activas a scoring previo.
- No quedan textos de cron cada 48h.
- No queda `INTERVAL '1 month'` para listados de ofertas.
- Java/Senior/3+/inglés/ubicación se rechazan sin DeepSeek.
- Prompt personalizado no anula reglas base.
- Google Jobs e InfoJobs siguen desactivados.
- Tests destructivos de DB no pueden correr contra DB no test.

---

# Notas finales para OpenCode

Priorizar estabilidad sobre limpieza estética.

Orden de importancia:

1. Reglas de evaluación correctas.
2. Parser estricto.
3. Prompt personalizado seguro.
4. Eliminar scoring previo.
5. Cron y últimos 30 días.
6. DB test segura.
7. Docs.
8. Limpieza menor.

No mezclar muchos temas en un mismo commit/cambio. Cada prompt debe producir un diff chico y revisable.

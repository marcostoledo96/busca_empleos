# Tasks: Ciclo A — Parser estricto, reglas determinísticas y prompt seguro

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~500 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (parser+reglas) → PR 2 (integración+prompt/UI) → PR 3 (verify final) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Parser + Reglas (fundación pura) | PR 1 | Independientes; tests incluidos |
| 2 | Integración servicio-evaluacion.js | PR 2 | Depende de PR 1 |
| 3 | Prompt/UI + verify final | PR 3 | Depende de PR 2; frontend build incluido |

## Phase 1: Parser (Work Unit 1)

- [x] 1.1 Crear `backend/src/servicios/evaluacion/parser-respuesta-ia.js`: limpiar fences Markdown, parsear JSON, validar schema estricto (`match` boolean real, `porcentaje` entero 0–100 o `null`, `razon` string), normalizar y fallback seguro.
- [x] 1.2 Crear `backend/tests/servicios/parser-respuesta-ia.test.js`: JSON válido sin fence, JSON con fence, `match` string rechazado, porcentaje fuera de rango clamp a 100, razón vacía usa fallback, JSON inválido.
- [x] 1.3 Verify parcial: `npm test -- parser-respuesta-ia` al 100%.

## Phase 2: Reglas de exclusión (Work Unit 1)

- [x] 2.1 Crear `backend/src/servicios/evaluacion/reglas-exclusion.js`: funciones puras que detectan Java excluyente (sin confundir JavaScript), Senior/SR/Lead, 3+ años excluyentes, inglés avanzado/fluido/bilingüe excluyente, presencial fuera de zona. Devuelve `{ excluida, match, porcentaje, razon, reglas }`.
- [x] 2.2 Crear `backend/tests/servicios/reglas-exclusion.test.js`: Java vs JavaScript, Senior/SR/Lead, 3+ años, inglés excluyente vs deseable, ubicación presencial fuera/dentro de zona, bonus IA no compensa Java.
- [x] 2.3 Verify parcial: `npm test -- reglas-exclusion` al 100%.

## Phase 3: Integración en servicio de evaluación (Work Unit 2)

- [x] 3.1 Modificar `backend/src/servicios/servicio-evaluacion.js`: importar parser y reglas; pre-validación con reglas antes de DeepSeek (si excluida, retornar sin llamar IA); reemplazar parseo inline por parser estricto; post-validación con reglas después de parsear respuesta IA (si post detecta exclusión, sobrescribir resultado).
- [x] 3.2 Ajustar `backend/tests/servicios/servicio-evaluacion.test.js`: oferta Java no llama DeepSeek; oferta sin exclusión sigue a IA; IA aprueba oferta senior y post-validación la rechaza; prompt custom queda adicional.
- [x] 3.3 Agregar/ajustar tests en `backend/tests/servicios/servicio-scoring-previo.test.js` para certificar que bonus IA/Next.js no compensa exclusiones. **No modificar implementación de scoring previo.**
- [x] 3.4 Verify parcial: `npm test -- servicio-evaluacion` y `npm test -- servicio-scoring-previo` al 100%.

## Phase 4: Prompt seguro y UI (Work Unit 3)

- [x] 4.1 Modificar `construirInstruccionesDesdePreferencias` en `servicio-evaluacion.js`: si prompt personalizado activo, agregarlo al final bajo `CRITERIOS ADICIONALES DEL USUARIO` con advertencia de no anular reglas estrictas.
- [x] 4.2 Modificar labels en `frontend/src/app/paginas/preferencias/*`: cambiar "prompt personalizado" por "criterios adicionales para la IA" y ajustar placeholders.
- [x] 4.3 Verify parcial: `npm test -- servicio-evaluacion` (escenarios prompt adicional) y `npm run build` (frontend sin errores).

## Phase 5: Verificación final (Work Unit 3)

- [x] 5.1 Ejecutar suite completa: `npm test` en backend. Cero tests fallando.
- [x] 5.2 Confirmar que `backend/src/servicios/servicio-scoring-previo.js` no fue modificado salvo tests.
- [x] 5.3 Validar trazabilidad: cada scenario de spec tiene al menos un test asociado (ver tabla abajo).
- [x] 5.4 Revisar que no haya credenciales hardcodeadas ni queries SQL concatenadas.

## Traceability spec → tests

| Spec | Scenario | Archivo de test |
|---|---|---|
| parser-respuesta-ia | JSON válido sin fence | `backend/tests/servicios/parser-respuesta-ia.test.js` |
| parser-respuesta-ia | JSON válido con fence Markdown | `backend/tests/servicios/parser-respuesta-ia.test.js` |
| parser-respuesta-ia | boolean como string es inválido | `backend/tests/servicios/parser-respuesta-ia.test.js` |
| parser-respuesta-ia | porcentaje fuera de rango se ajusta | `backend/tests/servicios/parser-respuesta-ia.test.js` |
| parser-respuesta-ia | razón vacía usa fallback | `backend/tests/servicios/parser-respuesta-ia.test.js` |
| reglas-exclusion | Java excluyente no confunde JavaScript | `backend/tests/servicios/reglas-exclusion.test.js` |
| reglas-exclusion | Senior SR Lead excluyente | `backend/tests/servicios/reglas-exclusion.test.js` |
| reglas-exclusion | experiencia mayor a tres años excluyente | `backend/tests/servicios/reglas-exclusion.test.js` |
| reglas-exclusion | inglés excluyente | `backend/tests/servicios/reglas-exclusion.test.js` |
| reglas-exclusion | ubicación modalidad incompatible | `backend/tests/servicios/reglas-exclusion.test.js` |
| reglas-exclusion | bonus IA no compensa Java | `backend/tests/servicios/reglas-exclusion.test.js` |
| evaluacion-ia | oferta Java no llama DeepSeek | `backend/tests/servicios/servicio-evaluacion.test.js` |
| evaluacion-ia | oferta sin exclusión sigue a IA | `backend/tests/servicios/servicio-evaluacion.test.js` |
| evaluacion-ia | IA aprueba oferta senior por error | `backend/tests/servicios/servicio-evaluacion.test.js` |
| evaluacion-ia | prompt comunica bonus y límites | `backend/tests/servicios/servicio-evaluacion.test.js` |
| evaluacion-ia | prompt exige formato estricto | `backend/tests/servicios/servicio-evaluacion.test.js` |
| perfil-candidato | prompt personalizado se agrega al final | `backend/tests/servicios/servicio-evaluacion.test.js` |
| perfil-candidato | prompt personalizado no relaja Java | `backend/tests/servicios/servicio-evaluacion.test.js` |
| perfil-candidato | prompt personalizado no reemplaza seniority ni ubicación | `backend/tests/servicios/servicio-evaluacion.test.js` |
| perfil-candidato | prompt personalizado vacío no agrega sección adicional | `backend/tests/servicios/servicio-evaluacion.test.js` |
| perfil-candidato | texto de preferencias evita ambigüedad | `frontend/src/app/paginas/preferencias/*.spec.ts` |
| evaluacion-ia | cache hit aprobado pero excluido por reglas se rechaza | `backend/tests/servicios/servicio-evaluacion.test.js` |
| evaluacion-ia | cache hit aprobado sin exclusiones se acepta normalmente | `backend/tests/servicios/servicio-evaluacion.test.js` |
| evaluacion-ia | cache hit rechazado se mantiene sin revalidación | `backend/tests/servicios/servicio-evaluacion.test.js` |

## Nota sobre scoring previo

El archivo `backend/src/servicios/servicio-scoring-previo.js` **no se modifica** en este ciclo. Solo se agregan/ajustan tests en `backend/tests/servicios/servicio-scoring-previo.test.js` para certificar que bonus IA/Next.js no compensa exclusiones fuertes.

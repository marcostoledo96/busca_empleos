# Proposal: Ciclo A — Parser estricto, reglas determinísticas de exclusión y prompt personalizado seguro

## Intent

Endurecer la evaluación de ofertas para que exclusiones críticas (Java, Senior/SR/Lead, 3+ años, inglés excluyente, ubicación/modalidad) se resuelvan de forma determinística antes de consultar a DeepSeek, y para que el prompt personalizado nunca reemplace las reglas base.

## Scope

### In Scope
- Parser estricto de respuesta IA con schema validation y normalización de porcentaje.
- Módulo de reglas determinísticas de exclusión fuerte (Java, seniority, experiencia, idioma, ubicación/modalidad).
- Integración de parser + reglas en `servicio-evaluacion.js` (pre-validación + post-validación defensiva).
- Cambio de prompt personalizado a criterio adicional (no reemplazo).
- Ajustes de tests existentes y nuevos tests unitarios para parser y reglas.
- Ajustes mínimos de UI de preferencias (textos: "criterios adicionales").

### Out of Scope
- Deprecación del scoring previo (Ciclo B).
- Cambios de cron, últimos 30 días, DB de test, migrador, plataformas desactivadas, docs generales.
- Cambios en el modelo de datos (solo lectura/escritura de campos existentes).

## Capabilities

### New Capabilities
- `parser-respuesta-ia`: validar y normalizar respuesta cruda de DeepSeek a objeto seguro.
- `reglas-exclusion`: detectar exclusiones fuertes por texto de oferta y preferencias sin consultar IA.

### Modified Capabilities
- `evaluacion-ia`: requerir pre-validación con reglas determinísticas antes de DeepSeek; post-validar resultado IA para evitar que apruebe exclusiones; integrar parser estricto.
- `perfil-candidato`: cambiar `construirInstruccionesDesdePreferencias` para que el prompt personalizado se agregue al final como criterios adicionales, nunca como reemplazo total.

## Approach

1. Extraer lógica de parseo actual a `backend/src/servicios/evaluacion/parser-respuesta-ia.js` con schema estricto (match debe ser boolean real, porcentaje entero 0–100 o null, razón string con fallback).
2. Crear `backend/src/servicios/evaluacion/reglas-exclusion.js` con funciones puras de detección por regex/normalización; devolver `{ excluida, porcentaje, razon, reglas }`.
3. En `evaluarOferta`: ejecutar reglas antes de DeepSeek; si excluida, retornar sin llamar IA. Después de obtener respuesta IA, ejecutar reglas nuevamente como post-validación defensiva. Si post-validación detecta exclusión, sobrescribir resultado IA.
4. En `construirInstruccionesDesdePreferencias`: si `usar_prompt_personalizado === true`, agregar texto al final bajo bloque "CRITERIOS ADICIONALES" con advertencia de no anular reglas estrictas.
5. En frontend preferencias, cambiar labels de "prompt personalizado" a "criterios adicionales para la IA".

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/servicios/evaluacion/parser-respuesta-ia.js` | New | Parser estricto con schema validation. |
| `backend/src/servicios/evaluacion/reglas-exclusion.js` | New | Reglas determinísticas de exclusión fuerte. |
| `backend/src/servicios/servicio-evaluacion.js` | Modified | Integra parser y reglas; cambia flujo pre/post-validación. |
| `backend/tests/servicios/parser-respuesta-ia.test.js` | New | Tests unitarios del parser (JSON válido, fence, string match, clamp, fallback razón). |
| `backend/tests/servicios/reglas-exclusion.test.js` | New | Tests unitarios de reglas (Java, seniority, 3+ años, idioma, ubicación/modalidad). |
| `backend/tests/servicios/servicio-evaluacion.test.js` | Modified | Ajustar test que esperaba llamar DeepSeek para oferta Java; agregar tests de post-validación y prompt adicional. |
| `frontend/src/app/paginas/preferencias/*` | Modified | Cambiar textos de prompt personalizado a criterios adicionales. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Falsos positivos en detección de Java (confundir con JavaScript) | Med | Test exhaustivo con casos JavaScript, Node.js, React, JSON. |
| Reglas determinísticas rompen tests existentes que esperan llamada a DeepSeek | High | Ajustar tests antes de merge; mantener mock de DeepSeek para ofertas no excluidas. |
| Cambio de prompt personalizado como adicional genera prompts más largos | Low | El texto adicional es pequeño; DeepSeek soporta contexto amplio. |
| Post-validación sobrescribe resultado IA aprobado por error | Low | Solo sobrescribir si reglas detectan exclusión con alta confianza (regex explícitas). |

## Rollback Plan

- Revertir commit del Ciclo A.
- Restaurar `servicio-evaluacion.js` a versión previa (parser inline + sin reglas determinísticas).
- Frontend: restaurar textos de preferencias.
- Eliminar archivos nuevos (`parser-respuesta-ia.js`, `reglas-exclusion.js`, tests nuevos).

## Dependencies

- Ninguna externa nueva. Usa `jest` existente para tests.

## Success Criteria

- [ ] Parser rechaza `match: "false"` o `match: "true"` como error de schema, no como boolean.
- [ ] Oferta con Java no llama a DeepSeek y retorna `match: false`, porcentaje 10, razón explícita.
- [ ] Oferta Senior/SR/Lead no llama a DeepSeek y retorna `match: false`, porcentaje 15.
- [ ] Oferta con 3+ años excluyente no llama a DeepSeek y retorna `match: false`, porcentaje 20.
- [ ] Oferta con inglés avanzado/fluido/bilingüe excluyente no llama a DeepSeek y retorna `match: false`, porcentaje 15.
- [ ] Oferta presencial fuera de zonas preferidas no llama a DeepSeek y retorna `match: false`, porcentaje 10.
- [ ] Bonus IA/Next.js no compensa ninguna exclusión fuerte (test de oferta con IA + Java).
- [ ] Prompt personalizado activo mantiene reglas base y agrega texto al final del prompt.
- [ ] Tests unitarios nuevos pasan (`npm test -- parser-respuesta-ia`, `npm test -- reglas-exclusion`).
- [ ] Tests existentes de evaluación pasan o se ajustan y siguen verdes (`npm test`).
- [ ] Frontend build pasa (`npm run build`).

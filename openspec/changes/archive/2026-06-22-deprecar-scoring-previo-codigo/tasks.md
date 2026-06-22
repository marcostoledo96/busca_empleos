# Tasks: B1 — Deprecar scoring previo en código

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350–450 (borrado servicio 729 líneas + tests 757 líneas, ajustes en 6–8 archivos) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Inventario + Backend) → PR 2 (Frontend + Docs/Tests/Verify) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Inventario + backend limpieza | PR 1 | Borra `servicio-scoring-previo.js`, ajusta modelo/controlador/cache/hash |
| 2 | Frontend limpieza + docs/tests + verify | PR 2 | Quita UI/servicio/modelo scoring en Angular; actualiza docs; regresiones; build/test OK |

---

## Phase 1: Inventario y validación

- [ ] 1.1 Ejecutar `rg "score_previo|analisis_previo|scoring_version|scoring_config|guardarAnalisisPrevio|calcularScorePrevio|servicio-scoring-previo" backend/src frontend/src docs` y guardar output en `/tmp/inventario-scoring-previo.txt`.
- [ ] 1.2 Verificar que no hay scripts externos (cron, CLI, workers) que invoquen `guardarAnalisisPrevio` o `calcularScorePrevio`.
- [ ] 1.3 Confirmar que `backend/src/servicios/evaluacion/reglas-exclusion.js` NO referencia `servicio-scoring-previo` (debe ser autónomo desde Ciclo A).
- [ ] 1.4 Revisar `backend/src/index.js` y rutas: confirmar que ningún endpoint expone scoring previo activo.

## Phase 2: Backend limpieza

- [ ] 2.1 Eliminar `backend/src/servicios/servicio-scoring-previo.js`.
- [ ] 2.2 Eliminar `backend/tests/servicios/servicio-scoring-previo.test.js`.
- [ ] 2.3 En `backend/src/modelos/oferta.js`: eliminar función `guardarAnalisisPrevio` y su export. No tocar queries de columnas legacy.
- [ ] 2.4 En `backend/src/modelos/preferencia.js`: quitar `scoring_config` de listas de campos actualizables/JSONB. Conservar lectura si la columna existe.
- [ ] 2.5 En `backend/src/controladores/controlador-preferencias.js`:
  - Quitar `validarScoringConfig` y su lógica.
  - Ignorar `scoring_config` en payload de `PUT /api/preferencias` (no persistir, no fallar).
  - Quitar `scoring_config` del ejemplo de request en comentarios/docs inline.
- [ ] 2.6 En `backend/src/modelos/evaluacion-cache.js`: excluir `scoring_config` de `crearHashPreferencias()`.
- [ ] 2.7 En `backend/src/servicios/evaluacion/reglas-exclusion.js`: actualizar comentario que menciona "reutiliza lógica de scoring previo" → "reutiliza lógica determinística de filtrado".

## Phase 3: Frontend limpieza

- [ ] 3.1 En `frontend/src/app/modelos/preferencia.model.ts`: quitar campo `scoring_config` del modelo actualizable (puede dejarse como `// legacy B2` si es necesario para compilación transitoria).
- [ ] 3.2 En `frontend/src/app/servicios/preferencias.service.ts`: quitar `scoring_config` de `ResultadoImportacionCv` y de payloads enviados.
- [ ] 3.3 En `frontend/src/app/paginas/preferencias/preferencias.ts`:
  - Quitar propiedad `scoringConfig`, método `normalizarScoringConfig` y su uso en `guardar`.
  - Quitar lógica que lee `scoring_config` de la respuesta del backend.
- [ ] 3.4 En `frontend/src/app/paginas/preferencias/preferencias.html`: quitar controles, tab o sección de scoring/bonus/umbrales si existen.
- [ ] 3.5 En `frontend/src/app/servicios/preferencias.service.spec.ts`: quitar mocks/asserts de `scoring_config`.
- [ ] 3.6 Buscar en dashboard y detalle de oferta: confirmar que no se renderiza `score_previo`, `analisis_previo` ni `scoring_version`.

## Phase 4: Tests y regresiones

- [ ] 4.1 En `backend/tests/controladores/preferencias-controlador.test.js`:
  - Agregar test: `PUT /preferencias` con `scoring_config` en payload ignora el campo y no persiste cambios.
  - Agregar test: `PUT /preferencias` con `scoring_config` malformado no devuelve 500.
- [ ] 4.2 En `backend/tests/servicios/servicio-cache-evaluacion.test.js` (o equivalente): agregar test de que `crearHashPreferencias` no cambia cuando varía solo `scoring_config`.
- [ ] 4.3 En `backend/tests/servicios/servicio-evaluacion.test.js`: agregar test de que el flujo de evaluación no invoca scoring previo (verificar que no hay import ni llamada a `calcularScorePrevio`).
- [ ] 4.4 En `frontend/src/app/paginas/preferencias/*.spec.ts`: agregar test de que la UI no renderiza elementos de scoring previo.
- [ ] 4.5 Ejecutar `npm test` en backend y confirmar 0 fallas.
- [ ] 4.6 Ejecutar `npm test` / `npm run build` en frontend y confirmar 0 errores de compilación.

## Phase 5: Documentación activa

- [ ] 5.1 En `docs/evaluacion-ia.md`: marcar scoring previo como **deprecado/legacy** (Ciclo B1). Describir flujo activo: reglas determinísticas + DeepSeek + parser estricto.
- [ ] 5.2 En `docs/base-de-datos.md`: indicar que columnas `score_previo`, `analisis_previo`, `scoring_version` y `preferencias.scoring_config` son legacy; **no hay DROP COLUMN en B1**.
- [ ] 5.3 En `docs/api-rest.md`: actualizar ejemplo de `PUT /api/preferencias` para no incluir `scoring_config`.
- [ ] 5.4 En `docs/frontend.md`: quitar sección de configuración de scoring previo si existe.
- [ ] 5.5 En `AGENTS.md` y `PLANIFICACION.md`: si mencionan scoring previo como feature activa, marcar como legacy/removido en B1.
- [ ] 5.6 Verificar que `README.md` no promueve scoring previo como feature disponible.

## Phase 6: Verify final

- [ ] 6.1 Comando: `rg "score_previo|analisis_previo|scoring_version|scoring_config|guardarAnalisisPrevio|calcularScorePrevio|servicio-scoring-previo" backend/src frontend/src docs` → únicos matches permitidos: notas de migración/deprecación, comentarios `// legacy B2`, o columnas DB no usadas por código.
- [ ] 6.2 Comando: `npm test` (backend) → 0 fallas.
- [ ] 6.3 Comando: `cd frontend && npm run build` → 0 errores TypeScript.
- [ ] 6.4 Comando: `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless` → 0 fallas (si hay suite).
- [ ] 6.5 Revisión manual: `backend/src/modelos/oferta.js` no exporta `guardarAnalisisPrevio`.
- [ ] 6.6 Revisión manual: `backend/src/controladores/controlador-preferencias.js` no valida ni persiste `scoring_config`.
- [ ] 6.7 Revisión manual: `backend/src/modelos/evaluacion-cache.js` no incluye `scoring_config` en hash.

---

## Trazabilidad Spec → Tests

| Spec | Escenario | Archivo de test |
|---|---|---|
| `specs/persistencia/spec.md` | no existe migración destructiva | Revisión manual de repo / CI |
| `specs/persistencia/spec.md` | columnas legadas no bloquean flujo | `backend/tests/servicios/servicio-evaluacion.test.js`, `backend/tests/servicios/servicio-cache-evaluacion.test.js` |
| `specs/preferencias-usuario/spec.md` | payload con scoring_config no cambia preferencias | `backend/tests/controladores/preferencias-controlador.test.js` |
| `specs/preferencias-usuario/spec.md` | scoring_config malformado no rompe endpoint | `backend/tests/controladores/preferencias-controlador.test.js` |
| `specs/interfaz-usuario/spec.md` | preferencias no muestra scoring previo | `frontend/src/app/paginas/preferencias/*.spec.ts` |
| `specs/interfaz-usuario/spec.md` | dashboard no muestra score previo | `frontend/src/app/paginas/dashboard/*.spec.ts` |
| `specs/evaluacion-ia/spec.md` | evaluación no calcula scoring previo | `backend/tests/servicios/servicio-evaluacion.test.js` |
| `specs/evaluacion-ia/spec.md` | caché no depende de scoring previo | `backend/tests/servicios/servicio-cache-evaluacion.test.js` |
| `specs/evaluacion-ia/spec.md` | prompt no contiene scoring previo | `backend/tests/servicios/servicio-evaluacion.test.js` |
| `specs/documentacion-activa/spec.md` | docs no promueven scoring previo | Revisión manual de `docs/evaluacion-ia.md`, `docs/base-de-datos.md` |
| `specs/perfil-candidato/spec.md` | importar CV ignora scoring previo | `backend/tests/servicios/servicio-importar-cv.test.js` (si existe) o regresión en controlador |

---

## Comandos de verificación rápida (para copy-paste en verify)

```bash
# 1. Inventario de referencias activas
cd /home/marcos/Escritorio/Busca_empleos/busca_empleos
rg "score_previo|analisis_previo|scoring_version|scoring_config|guardarAnalisisPrevio|calcularScorePrevio|servicio-scoring-previo" backend/src frontend/src docs README.md AGENTS.md

# 2. Backend tests
cd backend && npm test

# 3. Frontend build
cd frontend && npm run build

# 4. Frontend tests (si aplica)
cd frontend && npm test -- --watch=false --browsers=ChromeHeadless
```

---

## Notas de implementación

- **No migración DB**: B1 NO toca columnas. B2 se encargará de `DROP COLUMN` reversible.
- **Compatibilidad clientes viejos**: `PUT /api/preferencias` ignora `scoring_config` silenciosamente, sin 500.
- **Hash de caché**: sacar `scoring_config` evita que un cliente viejo invalide caché al enviar el campo.
- **Rollback**: restaurar archivos borrados y reincorporar `scoring_config` en payload/hash.

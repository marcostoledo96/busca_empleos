# Tasks: herramientas-ia-nextjs-bonus

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300–450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (core backend) → PR 2 (tests + docs) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Core backend: scoring, evaluación, preferencias, migraciones | PR 1 | `main`; tests/docs en PR 2 |
| 2 | Tests y documentación | PR 2 | `main`; depende de PR 1 |

## Phase 1: Foundation / Config

- [x] 1.1 `backend/src/modelos/preferencia.js`: agregar `scoring_config.bonificaciones` con defaults IA (+6), Next.js (+4), máx combinado (+8) y `limites` de caps.
- [x] 1.2 `backend/sql/migracion-008-preferencias-detalladas.sql` y/o `backend/sql/migracion-010-preferencias-ui-completa.sql`: actualizar defaults idempotentes para `scoring_config` con nuevas claves de bonificación.
- [x] 1.3 `backend/src/servicios/servicio-scoring-previo.js`: agregar regex IA/Next.js, bonus acotado, caps por Java/seniority/idioma, detalle en respuesta.

## Phase 2: Core Implementation

- [x] 2.1 `backend/src/servicios/servicio-evaluacion.js`: actualizar perfil/prompt para mencionar Next.js y herramientas IA (Claude Code, Codex, OpenCode, Antigravity) como favorables; declarar que bonus NO compensa exclusiones.
- [x] 2.2 `backend/src/servicios/servicio-scoring-previo.js`: aplicar hard caps (`max_score_si_java_excluyente`, `max_score_si_senior`, `max_score_si_ingles_excluyente`, `max_score_si_experiencia_excluyente`) antes/después del bonus. Agregar `detectarExperienciaExcluyente` con patrones para >3 años, 3+ años, al menos 3 años, mínimo 3 años, anos sin ñ, y Lead (Tech Lead, Team Lead, Lead Developer).

## Phase 3: Testing

- [x] 3.1 `backend/tests/servicios/servicio-scoring-previo.test.js`: quitar `.skip`; cubrir bonus IA solo, Next.js solo, ambos combinados; verificar cap máximo +8. → *Spec: oferta compatible recibe bonus IA; Next.js es parte del stack aceptado*
- [x] 3.2 `backend/tests/servicios/servicio-scoring-previo.test.js`: escenario "Java + Spring + ChatGPT/Next.js" no supera cap de Java; "Senior AI Engineer Next.js" no supera cap de seniority; "JavaScript, Next.js, AI tools" no dispara exclusión Java. → *Spec: exclusión estricta prevalece; bonus IA no anula Java/seniority/idioma*
- [x] 3.3 `backend/tests/servicios/servicio-evaluacion.test.js`: verificar que prompt contiene bonus favorable y prohibición de compensar exclusiones (Java, seniority, idioma, ubicación). → *Spec: prompt comunica bonus y límites*
- [ ] 3.4 `backend/tests/modelos/preferencia.test.js`: validar defaults nuevos de `scoring_config.bonificaciones` y `limites`. → *Spec: herramientas IA reconocidas en el perfil* — **SKIP**: requiere `ALLOW_DB_TESTS=true` con BD local preparada.
- [x] 3.5 `backend/tests/servicios/servicio-scoring-previo.test.js`: escenarios de experiencia excluyente (>3 años, 3+ años, "al menos 3 años", "mínimo 3 años", "anos" sin ñ, "Lead") con cap y sin bonus IA compensatorio. Variantes de "3+ anos" sin ñ y combinación con Java/Senior para verificar el cap más bajo.

## Phase 4: Documentation

- [x] 4.1 `docs/evaluacion-ia.md`: documentar criterio de bonus IA/Next.js y límites.
- [x] 4.2 `docs/arquitectura.md`: actualizar sección de scoring con nuevas señales y caps.
- [x] 4.3 `cv.md`: reflejar IA/Next.js como habilidades valorables (no principales).
- [x] 4.4 `AGENTS.md`: actualizar reglas de perfil si cambian exclusiones o stack.

## Phase 5: Verify

- [x] 5.1 Ejecutar `cd backend && npm test`; cero tests nuevos fallando. Tests scoring (40 pass), evaluacion (42 pass). 2 failures preexistentes (controlador-preferencias, migrar) no relacionadas con este cambio.
- [ ] 5.2 Ejecutar `ALLOW_DB_TESTS=true npm test -- preferencias` con BD local preparada.
- [ ] 5.3 Validar matriz manual mínima: IA+Next.js junior, Java+IA, Senior+Next.js, JavaScript+Next.js.
# Tasks: automatizacion-registry-driven

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~350 (servicio -200/+100, tests -80/+120) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | auto-chain |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Phase 1: Foundation

- [ ] 1.1 Crear `const SCRAPERS = { linkedin: servicioScraping.ejecutarScrapingLinkedin, ... }` en `servicio-automatizacion.js`.
- [ ] 1.2 Agregar helper `armarPasosProgreso()` que devuelva pasos desde `PLATAFORMAS_ACTIVAS` + `guardado` + `evaluacion`.
- [ ] 1.3 Agregar helper `armarPesosDinamicos()` que calcule `pesoScraping = 82 / activas.length` y fije `guardado=3`, `evaluacion=15`.
- [ ] 1.4 Agregar helper `inicializarResultadoScraping()` que cree claves desde `Object.values(PLATAFORMAS)` con valor `0`.

## Phase 2: Core Refactor

- [ ] 2.1 Reemplazar bloques hardcodeados de scraping por `for...of PLATAFORMAS_ACTIVAS` que invoque `SCRAPERS[id]` con `try/catch` por plataforma.
- [ ] 2.2 Manejar Adzuna: si el scraper retorna `{ deshabilitado: true }`, registrar `0` y marcar paso completado.
- [ ] 2.3 Si `SCRAPERS[id]` no existe, marcar paso como `error`, acumular mensaje y continuar.
- [ ] 2.4 Reemplazar spread `todasLasOfertas = [...]` por acumulación dinámica del loop.
- [ ] 2.5 Actualizar `actualizarPasoPorgreso()` para usar pesos dinámicos y forzar `100` al final del ciclo.

## Phase 3: Testing

- [ ] 3.1 Ajustar test existente de 9 plataformas activas: cambiar mocks de calls fijos a verificación sobre `PLATAFORMAS_ACTIVAS`.
- [ ] 3.2 Agregar test: plataforma inactiva (ej. `infojobs`) NO es invocada aunque exista en `SCRAPERS`.
- [ ] 3.3 Agregar test: `resultado.scraping` incluye clave por cada entrada de `PLATAFORMAS` (activas e inactivas).
- [ ] 3.4 Agregar test: progreso conserva shape `{ nombre, label, estado, extraidas }` y finaliza en `100`.
- [ ] 3.5 Agregar test: falla de un scraper no aborta el ciclo; las demás plataformas ejecutan.
- [ ] 3.6 Agregar test: Adzuna retorna `{ deshabilitado: true }` → `adzuna: 0`, sin error, sin guardar objeto como oferta.
- [ ] 3.7 Correr suite completa: `cd backend && npm test`.

## Phase 4: Docs, Verify & Archive

- [ ] 4.1 Actualizar doc de módulo si existe referencia a plataformas hardcodeadas en `servicio-automatizacion`.
- [ ] 4.2 Verificar que `config/plataformas.js` no fue modificado (read-only según design).
- [ ] 4.3 Ejecutar `npm test` y confirmar cero fallas.
- [ ] 4.4 Ejecutar `npm run dev` y verificar que el servidor inicia sin errores.
- [ ] 4.5 Persistir tasks completados en Engram y marcar change como listo para archive.

## Criterio de éxito

- `servicio-automatizacion.js` deriva pasos, pesos y resultado desde `PLATAFORMAS` / `PLATAFORMAS_ACTIVAS`.
- Loop procesa solo activas; inactivas aparecen en resultado con `0` pero nunca llaman scraper.
- Progreso termina en `100%` y mantiene shape compatible con la UI.
- Adzuna deshabilitado se maneja sin crashear.
- Todos los tests pasan (`npm test` = 0 fallas).

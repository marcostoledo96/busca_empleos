# Proposal: Correcciones de auditoría OpenCode

## Intent

Aplicar correcciones identificadas en la auditoría del ecosistema OpenCode: el runner de migraciones no auto-bootstrappea `schema_migrations`, la documentación de base de datos está desactualizada, las reglas de exclusión tienen falsos positivos en "lead" y el mensaje de 3+ años es genérico, el servicio de automatización no expone errores de guardado, falta una constraint de rango salarial, y el CI no ejecuta tests de base de datos ni frontend.

## Scope

### In Scope
- Runner de migraciones (`backend/scripts/migrar.js`): auto-crear `schema_migrations` si no existe (en lugar de fallar con `process.exit`), corregir texto de ayuda; tests actualizados.
- `docs/base-de-datos.md`: convertir en fuente de verdad completa del schema actual, migraciones 001-016, comportamiento del runner y gotchas.
- `reglas-exclusion`: eliminar/ajustar el falso positivo amplio de `"lead"` (ej: "lead" como verbo o en contextos no laborales), mejorar el texto de razón de 3+ años; tests.
- `servicio-automatizacion`: trackear `erroresGuardado` en el resultado del ciclo e incluirlo en el email/resumen; tests.
- Migración aditiva `backend/sql/migracion-017-salario-rango.sql`: constraint de integridad `salario_min <= salario_max` cuando ambos no son null; documentación actualizada.
- CI (`backend/`): agregar job `test:db` con servicio Postgres y job de frontend con tests headless si es compatible.

### Out of Scope
- Preferencias editables de herramientas IA estructuradas / UI diferencial de IA (feature para sesión separada).
- Renombrar migraciones ya aplicadas en `schema_migrations`.

## Capabilities

### New Capabilities
<!-- None — this is a corrective change. -->

### Modified Capabilities
- `persistencia`: runner auto-bootstrappea tabla `schema_migrations`; migración 017 agrega constraint de rango salarial aditivo.
- `reglas-exclusion`: ajusta patrón de detección de `"lead"` para reducir falsos positivos; mejora razón de exclusión por experiencia 3+ años.
- `automatizacion`: expone `erroresGuardado` en resultado del ciclo y lo incluye en resumen/email.
- `documentacion-activa`: `docs/base-de-datos.md` se actualiza como fuente de verdad del schema, migraciones y gotchas del runner.

## Approach

1. **Runner**: reemplazar el `process.exit(1)` por creación condicional de `schema_migrations` con `CREATE TABLE IF NOT EXISTS`, luego reintentar el flujo normal. Actualizar texto de ayuda post-migración.
2. **Docs**: auditar `crear-tablas.sql`, todas las migraciones 001-016 y el runner; sincronizar columnas, índices, constraints, gotchas de rollback y comportamiento de bootstrap en `docs/base-de-datos.md`.
3. **Reglas-exclusion**: revisar `PATRON_SENIORITY_EXCLUYENTE` para excluir `"lead"` como verbo común (ej: "lead generation" en marketing no es rol de liderazgo) o ajustar contexto. Actualizar `razon` de experiencia para ser más específica. Agregar tests de regresión.
4. **Automatización**: contar excepciones en el paso de guardado (`crearOferta`), sumar a `resultado.erroresGuardado`, exponer en el objeto retornado y consumir desde `servicio-notificacion-email`.
5. **Migración 017**: `ALTER TABLE ofertas ADD CONSTRAINT chk_ofertas_salario_rango CHECK (salario_min IS NULL OR salario_max IS NULL OR salario_min <= salario_max);` — aditiva, sin tocar datos.
6. **CI**: crear `.github/workflows/ci.yml` con jobs de backend (unit + test:db con Postgres service) y frontend (`ng test --watch=false --browsers=ChromeHeadless` si el proyecto lo soporta).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/scripts/migrar.js` | Modified | Auto-bootstrap `schema_migrations`; fix help text. |
| `backend/tests/scripts/migrar.test.js` | Modified | Tests de bootstrap y texto de ayuda. |
| `docs/base-de-datos.md` | Modified | Fuente de verdad completa del schema y gotchas. |
| `backend/src/servicios/evaluacion/reglas-exclusion.js` | Modified | Ajuste de patrón "lead" y razón de experiencia. |
| `backend/tests/servicios/reglas-exclusion.test.js` | Modified | Tests de regresión para lead FP y razón. |
| `backend/src/servicios/servicio-automatizacion.js` | Modified | Tracking de `erroresGuardado`. |
| `backend/tests/servicios/servicio-automatizacion.test.js` | Modified | Asserts de `erroresGuardado` en resultado y email. |
| `backend/sql/migracion-017-salario-rango.sql` | New | Constraint aditivo de rango salarial. |
| `.github/workflows/ci.yml` | New | CI con test:db + Postgres y frontend headless. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bootstrap del runner crea tabla con columnas distintas a las esperadas por migración 014 | Low | Usar exactamente el mismo DDL que `migracion-014-schema-migrations.sql`. |
| Ajuste de patrón "lead" excluye ofertas legítimas de liderazgo | Med | Tests de regresión que verifican "Tech Lead" sigue excluyendo y "lead generation" no. |
| CI frontend headless falla por configuración Karma/Chrome | Med | Usar `ChromeHeadless` con `--no-sandbox`; si falla, documentar como known issue y dejar solo backend CI. |
| Constraint salarial rechaza datos existentes inválidos | Low | Validar con `SELECT` previo en migración usando `NOT VALID` o verificación manual antes de aplicar. |

## Rollback Plan

1. Revertir `migrar.js` al commit anterior; la tabla `schema_migrations` ya creada no afecta.
2. Si el constraint 017 causa problemas: `ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS chk_ofertas_salario_rango;`.
3. Revertir cambios en reglas-exclusion y automatización vía git checkout.
4. Desactivar CI borrando/renombrando `.github/workflows/ci.yml`.

## Dependencies

- Entorno de CI debe soportar servicios de contenedores (GitHub Actions nativo).
- Frontend debe poder correr `ng test --watch=false --browsers=ChromeHeadless` (requiere `karma-chrome-launcher`).

## Success Criteria

- [ ] `migrar.js` crea `schema_migrations` automáticamente cuando falta y continúa el flujo; texto de ayuda es correcto.
- [ ] `migrar.test.js` tiene tests que cubren bootstrap y texto de ayuda.
- [ ] `docs/base-de-datos.md` documenta todas las migraciones 001-016, el schema actual, índices, constraints y gotchas del runner.
- [ ] `reglas-exclusion` no rechaza ofertas con "lead generation" o contextos no laborales; sigue rechazando "Tech Lead".
- [ ] La razón de exclusión por 3+ años menciona explícitamente que es un requisito excluyente.
- [ ] `servicio-automatizacion` expone `erroresGuardado` en el resultado del ciclo.
- [ ] El email/resumen de ciclo incluye `erroresGuardado`.
- [ ] `servicio-automatizacion.test.js` verifica la presencia de `erroresGuardado`.
- [ ] Migración 017 es aditiva, no destructiva, y pasa tests estáticos de SQL.
- [ ] CI ejecuta `test:db` con Postgres service y pasa.
- [ ] CI ejecuta frontend tests headless si es compatible.

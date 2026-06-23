# Design: Correcciones de auditoría OpenCode

## Technical Approach

Aplicar correcciones aditivas y localizadas: el runner se auto-inicializa con el DDL exacto de `migracion-014`, la nueva migración salarial valida sin tocar datos, las reglas determinísticas ajustan `lead` por contexto de rol, automatización expone `erroresGuardado`, CI usa entornos de test explícitos, y `docs/base-de-datos.md` queda sincronizado con el schema real.

## Architecture Decisions

| Decisión | Elección | Alternativas | Rationale |
|---|---|---|---|
| Bootstrap de migraciones | Crear `schema_migrations` desde `migrar.js` con `CREATE TABLE IF NOT EXISTS` equivalente a `migracion-014-schema-migrations.sql` | Pedir ejecución manual de 014 | Evita falla inicial y no renombra migraciones aplicadas. |
| Constraint salarial | `DO $$` idempotente: si no existe constraint, contar filas inválidas; si hay, `RAISE EXCEPTION`; si no, `ADD CONSTRAINT` | `NOT VALID` silencioso o limpiar datos | Seguro: no modifica datos ni deja inválidos históricos ocultos. |
| Lead regex | Quitar `\blead\b` genérico y mantener variantes de título/rol (`Tech Lead`, `Team Lead`, `Lead Developer`, `Lead Engineer`, `Líder`) | Mantener patrón amplio | Evita falsos positivos verbales como `lead initiatives` / `lead generation`. |
| Errores guardado | Métrica raíz `resultado.erroresGuardado` + detalle en `resultado.errores` | Guardarlo dentro de `scraping` | Es métrica operativa transversal y el email la consume directo. |
| CI frontend | Ejecutar build siempre y test headless porque Angular tiene `@angular/build:karma` + `karma-chrome-launcher` | Solo build | Cumple spec; si falla en runtime, verify documentará limitación. |

## Data Flow

```text
Scrapers → filtro idioma → modeloOferta.crearOferta()
                         ├─ OK/null → guardadas o duplicadas
                         └─ throw → erroresGuardado++ + errores[]
Resultado ciclo → servicio-notificacion-email → HTML/texto con erroresGuardado

GitHub Actions → backend npm test → backend test:db con Postgres *_test → frontend build/test headless
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/scripts/migrar.js` | Modify | Reemplazar falla por función `asegurarTablaSchemaMigrations(pool)` con DDL 014; actualizar ayuda a `npm run db:migrate:apply`. |
| `backend/sql/migracion-017-salario-rango.sql` | Create | Constraint `chk_ofertas_salario_rango` idempotente, con preflight de filas `salario_min > salario_max` y sin cambios de datos. |
| `backend/src/servicios/evaluacion/reglas-exclusion.js` | Modify | Remover patrón `lead` aislado; agregar `líder/lider`, `technical lead` si aplica; derivar `patron` desde el regex que matcheó. |
| `backend/src/servicios/servicio-automatizacion.js` | Modify | Inicializar `erroresGuardado: 0`; incrementar en `catch` de `crearOferta`; agregar mensaje a `errores`. |
| `backend/src/servicios/servicio-notificacion-email.js` | Modify | Mostrar `erroresGuardado` en totales HTML/texto, incluyendo `0` o ausencia de errores. |
| `backend/tests/scripts/migrar.test.js` | Modify | Assert de bootstrap, DDL equivalente a 014, ayuda `db:migrate:apply`, migración 017 idempotente/no destructiva. |
| `backend/tests/servicios/reglas-exclusion.test.js` | Modify | Casos `lead initiatives`/`lead generation` no excluyen; `Tech Lead`, `Team Lead`, `Lead Developer`, `Líder` excluyen; razón 3+ específica. |
| `backend/tests/servicios/servicio-automatizacion.test.js` | Modify | Casos `erroresGuardado` 0, 1 y múltiples; email recibe resultado con métrica. |
| `backend/tests/servicios/servicio-notificacion-email.test.js` | Modify | Assert HTML/texto incluyen errores de guardado. |
| `docs/base-de-datos.md` | Modify | Documentar schema completo, migraciones 001-017, `schema_migrations`, constraints, gotchas duplicados y rollback. |
| `.github/workflows/ci.yml` | Create | Jobs backend unit, backend DB con servicio Postgres y frontend build/test headless. |

## Interfaces / Contracts

`ejecutarCicloCompleto()` retorna además:

```javascript
{
    erroresGuardado: number,
    errores: string[]
}
```

No se agregan secretos ni variables productivas. CI define `NODE_ENV=test`, `ALLOW_DB_TESTS=true`, `PGDATABASE=busca_empleos_test` y credenciales efímeras del service container.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Regex lead, razón experiencia, erroresGuardado, email | Jest con mocks existentes. |
| SQL/static | Migración 017 idempotente, sin `DROP TABLE/DELETE/TRUNCATE/CASCADE/CONCURRENTLY` | Tests por lectura de archivo como migraciones 015/016. |
| DB integration | `npm run test:db` contra Postgres `_test` | CI service `postgres`, guardián runtime existente. |
| Frontend | Build y Karma headless | `npm run build`; `npm test -- --watch=false --browsers=ChromeHeadless`. |

## CI Compatibility Notes

Usar `actions/setup-node`, `npm ci` por carpeta, Postgres service con healthcheck y base `busca_empleos_test`. No usar `DATABASE_URL` real ni secrets. Si Angular headless falla por entorno gráfico, mantener build y documentar limitación en verify.

## Migration / Rollout

Aplicar como una migración nueva `017`; no renombrar archivos existentes aunque haya números duplicados. Si la 017 detecta filas inválidas, falla antes de crear constraint: corregir datos manualmente o decidir una migración de limpieza separada.

## Rollback

- Runner/reglas/automatización/email/docs/CI: revertir archivos.
- Constraint 017: `ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS chk_ofertas_salario_rango;`.
- `schema_migrations` creada por bootstrap puede quedar: es compatible y esperada.

## Open Questions

- None.

# Plan de corrección priorizado para OpenCode — Busca Empleos

**Fecha:** 27 de mayo de 2026

Este plan está pensado para ejecutar en fases cortas, validando después de cada cambio. No reescribir todo junto.

## Fase 0 — Contención inmediata de secretos

**Objetivo:** cerrar el riesgo real más importante antes de tocar código.

1. Rotar Firebase Admin service account.
2. Rotar API keys presentes en `backend/.env`.
3. Crear un ZIP seguro sin `.env`, service account, `.git`, `node_modules`, coverage ni environments reales.
4. Agregar script de exportación segura.
5. Validar con grep/zipinfo que el paquete no contiene secretos.

**Comandos sugeridos:**

```bash
# Desde la raíz del repo, para exportar solo lo versionado:
git archive --format=zip HEAD -o busca_empleos_safe.zip

# Validar que no se filtren archivos sensibles:
zipinfo -1 busca_empleos_safe.zip | grep -Ei '(^|/)(\.env|firebase-service-account\.json|node_modules|\.git|coverage|environment\.ts$|environment\.prod\.ts$)' && echo 'ERROR: contiene sensibles'
```

## Fase 1 — Seguridad backend y costos

Implementar: H002, H003, H004, H005, H006.

### Cambios concretos

- `backend/src/app.js`
  - Crear rate limiter específico para importación de CV.
  - Exigir `CORS_ORIGEN` en producción.
- `backend/src/rutas/preferencias.js`
  - Aplicar rate limit solo a `POST /importar-cv/analizar`.
  - Convertir errores de Multer en 400/413.
- `backend/src/controladores/controlador-ofertas.js`
  - Reemplazar gating por `HABILITAR_DIAGNOSTICO_PERSISTENCIA=true`.
- `backend/src/config/base-datos.js`
  - Sanitizar diagnóstico para no devolver connection string.
- `backend/src/controladores/controlador-preferencias.js`
  - No devolver `err.message` al cliente.

### Verificación

```bash
cd backend
npm test -- --runInBand
node --check src/app.js
node --check src/controladores/controlador-preferencias.js
```

## Fase 2 — Base de datos y migraciones

Implementar: H007, H008.

### Cambios concretos

- Crear `backend/sql/migracion-013-constraints-integridad.sql`.
- Crear `schema_migrations` y runner `backend/scripts/migrar.js`.
- Agregar script `db:migrate` en `backend/package.json`.

### SQL base sugerido

```sql
ALTER TABLE ofertas
ADD CONSTRAINT chk_ofertas_estado_evaluacion
CHECK (estado_evaluacion IN ('pendiente', 'aprobada', 'rechazada'));

ALTER TABLE ofertas
ADD CONSTRAINT chk_ofertas_estado_postulacion
CHECK (estado_postulacion IN ('no_postulado', 'cv_enviado', 'en_proceso', 'descartada'));

ALTER TABLE ofertas
ADD CONSTRAINT chk_ofertas_porcentaje_match
CHECK (porcentaje_match IS NULL OR porcentaje_match BETWEEN 0 AND 100);

ALTER TABLE ofertas
ADD CONSTRAINT chk_ofertas_score_previo
CHECK (score_previo IS NULL OR score_previo BETWEEN 0 AND 100);
```

## Fase 3 — Concurrencia, lotes y performance

Implementar: H009, H010, H012, H013.

### Cambios concretos

- Agregar lectura de último lote en `evaluacion-lote.js`.
- Usar advisory locks de PostgreSQL para evaluación/ciclo completo.
- Agregar paginación a `GET /api/ofertas`.
- Procesar evaluación en lotes.
- Limitar acción masiva a 200 IDs.

## Fase 4 — Frontend y consistencia de datos

Implementar: H014, H015, H016.

### Cambios concretos

- Agregar TTL/version a `PersistenciaDashboardService`.
- Trackear optimistic updates pendientes por ID.
- Limpiar timeout del foco del modal.

## Fase 5 — Testing y CI

Implementar: H018, H019.

### Tests mínimos nuevos

- `backend/tests/servicios/servicio-scoring-previo.test.js`
- `backend/tests/modelos/evaluacion-cache.test.js`
- `backend/tests/modelos/evaluacion-lote.test.js`
- `frontend/src/app/paginas/dashboard/dashboard.spec.ts`
- Specs HTTP para servicios Angular.
- `.github/workflows/ci.yml`

## Fase 6 — Refactor incremental

Implementar: H017, H020, H021.

No hacer esta fase antes de blindar seguridad/costos. Refactorizar después de tener tests.

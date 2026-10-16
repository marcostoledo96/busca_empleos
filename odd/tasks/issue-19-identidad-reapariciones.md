# Issue #19 — Deduplicar por identidad y actualizar reapariciones

## Autorización y alcance
Implementación completa, pruebas unitarias e integradas sintéticas, build, worktree aislado, commits convencionales en español, publicación de rama y apertura de una única Pull Request hacia `master` con `Closes #19` autorizados por Marcos Ezequiel Toledo.
Sin merge ni cierre manual de la issue, sin consumo de APIs pagas ni scraping real con costo, sin modificar la base de datos productiva, sin activar el cron ni realizar despliegues manuales.
Workspace original en `/home/marcos/Escritorio/Busca_empleos/busca_empleos` preservado intacto.
Worktree aislado en `/home/marcos/Escritorio/Busca_empleos/busca_empleos-issue-19` sobre rama `fix/issue-19-identidad-reapariciones`, partiendo de BASE `2ea753849bfe5c9840e80decd344cc7d7578679b` (`origin/master` con PR #38 de issue #18 integrada).

## Metodología Gentle AI y SDD
- **Fase 1 (Exploración):** Realizada con subagente `odd_explorer`. Mapeo completo de normalización, `canonizarUrlGeneral`, consultas SQL de 30 días sobre `fecha_extraccion`, falta de columnas `identidad_canonica` y `fecha_ultima_extraccion`, CAS de #17 y manejo de errores técnicos de #18.
- **Fase 2 (Definición y Diseño):** Identidad canónica conservadora por plataforma (Indeed `jk`, LinkedIn `jobId`, etc.), persistencia atómica con `ON CONFLICT (identidad_canonica) DO UPDATE`, reglas de calidad de datos, protección de descripciones y postulaciones manuales, alineación de ventana de 30 días a `COALESCE(fecha_ultima_extraccion, fecha_extraccion)`.
- **Fase 3 (Tareas ODD):** T1 a T6 estructuradas como unidades atómicas con sus correspondientes tests y verificaciones.
- **Fase 4 (Implementación y Verificación):** Subagentes y ejecutores acotados con superficies autorizadas, validación con tests sintéticos y comprobación cruzada independiente.
- **Fase 5 (Entrega):** Documentación breve, commits convencionales en español, push, PR única hacia `master` y reporte final.

## Tareas y Estado de Ejecución

- [x] **T1: Backend — Servicio de identidad canónica y normalización de URLs por plataforma**
  - Crear `backend/src/servicios/servicio-identidad-ofertas.js` con `obtenerIdentidadCanonica`, `canonizarUrlPlataforma` y `extraerIdentificadorPlataforma`.
  - Reglas específicas para Indeed (`jk`/`vjk`, limpieza de tracking, preservación de query relevante), LinkedIn (identificador numérico en pathname o searchParams, formato canónico), y normalización conservadora general para otras fuentes y URLs desconocidas.
  - Integrar en `servicio-normalizacion.js`.
  - Suite de tests unitarios focalizados en `backend/tests/servicios/servicio-identidad-ofertas.test.js`.

- [x] **T2: Backend — Deduplicación intra-ejecución en scraping**
  - Unificar deduplicación en memoria en `servicio-scraping.js` utilizando la identidad canónica en todas las fuentes (incluyendo Indeed, LinkedIn y Bumeran).
  - Asegurar que dos URLs con el mismo ID no se procesen dos veces dentro de la misma extracción.
  - Pruebas en `backend/tests/servicios/servicio-scraping.test.js`.

- [x] **T3: Base de Datos y Persistencia — Migración 023 y actualización de reapariciones en `modeloOferta`**
  - Crear migración idempotente `backend/sql/migracion-023-identidad-y-reapariciones.sql` agregando `identidad_canonica` y `fecha_ultima_extraccion`, con backfill seguro y resolución conservadora de colisiones históricas (`:colision-historica-${id}`).
  - Implementar en `backend/src/modelos/oferta.js` inserción/actualización atómica (`ON CONFLICT (identidad_canonica) DO UPDATE`):
    - Reapariciones actualizan `fecha_ultima_extraccion` sin modificar `fecha_extraccion`.
    - No pisar `descripcion` si `origen_descripcion = 'manual'`.
    - Completar descripción solo si la nueva es más completa/larga.
    - No pisar estados de postulación manuales (`cv_enviado`, `en_proceso`, `descartada`).
    - Si cambian entradas relevantes de matching, marcar `REEVALUACION_SOLICITADA` y vigencia anterior sin reevaluar automáticamente.
  - Actualizar todas las consultas de 30 días (`obtenerOfertas`, `obtenerEstadisticas`, `obtenerOfertasPendientes`, `obtenerOfertasConErrores`, snapshot de sincronización) para usar `COALESCE(fecha_ultima_extraccion, fecha_extraccion)`.
  - Pruebas en `backend/tests/modelos/oferta.test.js` y `backend/tests/servicios/issue-19-persistencia-reapariciones.test.js`.

- [x] **T4: Integración — Unificación de persistencia y contadores en scraping y automatización**
  - Actualizar `guardarLoteOfertasAislado` en `servicio-ingreso-ofertas.js` distinguiendo `guardadas` (nuevas), `actualizadas` y `reapariciones`.
  - Unificar `servicio-automatizacion.js` y `controlador-scraping.js` para usar el mismo contrato de persistencia y reporte.
  - Pruebas en `backend/tests/servicios/servicio-automatizacion.test.js` y `controlador-scraping.test.js`.

- [x] **T5: Frontend y DTOs — Visualización de primera/última detección y métricas**
  - Extender `Oferta` en `frontend/src/app/modelos/oferta.model.ts` con `fecha_ultima_extraccion` e `identidad_canonica`.
  - Actualizar DTOs en `respuesta-api.model.ts` con `ofertas_actualizadas` y `ofertas_reapariciones`.
  - Actualizar `detalle-oferta.html` y `tabla-ofertas.html` para diferenciar claramente primera detección, última detección y fecha de publicación.
  - Pruebas frontend en `detalle-oferta.spec.ts` y `tabla-ofertas.spec.ts`.

- [x] **T6: Pruebas Integradas (Recorridos A, B y C), Verificación y Documentación**
  - Implementar pruebas sintéticas integradas: Recorrido A (Indeed multi-tracking -> 1 oferta), Recorrido B (reaparición completa descripción + preserva postulación + `REEVALUACION_SOLICITADA`), Recorrido C (descripción manual protegida).
  - Ejecutar suite completa backend y frontend.
  - Actualizar documentación en `docs/base-de-datos.md`, `docs/scraping.md`, `docs/api-rest.md`, `docs/frontend.md`.
  - Registrar en Engram, git commit, push y apertura de PR hacia `master` con `Closes #19`.

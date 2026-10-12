# Issue #16 — Repartir cupos y unificar límites y fechas

## Autorización y alcance
Implementación completa, pruebas unitarias e integradas sintéticas, build, worktree aislado, commits convencionales, publicación de rama y apertura de una única Pull Request hacia `master` con `Closes #16` autorizados por Marcos Ezequiel Toledo.
Sin merge ni cierre manual de la issue, sin consumo de APIs pagas ni scraping real con costo, sin modificar la base de datos productiva, sin activar el cron ni realizar despliegues manuales.
Workspace original en `/home/marcos/Escritorio/Busca_empleos/busca_empleos` preservado intacto.
Worktree aislado en `/home/marcos/Escritorio/Busca_empleos/busca_empleos-issue-16` sobre rama `fix/issue-16-cupos-fechas-scraping`, partiendo de BASE `ba8eff379f6bb380b23361b2770df591c61078cc` (`origin/master` con PR #35 de issue #15 integrada).

## Metodología Gentle AI y SDD
- **Fase 1 (Exploración):** Realizada con subagente `odd_explorer`. Evidencia grounded en Jooble, RemoteOK, Computrabajo, Adzuna, modelos y frontend.
- **Fase 2 (Definición y Diseño):** Solución YAGNI / Ponytail: reparto de consultas por round-robin, conteo de ofertas útiles y elegibles (normalizadas, deduplicadas y dentro de ventana), hard cap estricto `.slice(0, maxResultados)`, alineación de ventana a 30 días, sanitización de `Invalid Date` y protección por oferta al persistir.
- **Fase 3 (Tareas ODD):** T1 a T5 estructuradas como unidades de trabajo atómicas con sus correspondientes tests y verificaciones.
- **Fase 4 (Implementación y Verificación):** Subagente escritor acotado con superficies autorizadas, validación con tests sintéticos y comprobación cruzada independiente.
- **Fase 5 (Entrega):** Documentación breve, commits convencionales en español, push, PR única y sincronización en Engram.

## Tareas y Estado de Ejecución

- [x] **T1: Backend — Reparto de consultas, deduplicación temprana y límites estrictos**
  - Implementado pipeline de ingesta justa en `servicio-scraping.js`: normalizar, validar y deduplicar intra-ejecución antes de evaluar cupo.
  - Jooble: round-robin por término, límite de peticiones/páginas por término y global, corte por ofertas útiles y elegibles, hard cap `.slice(0, maxResultados)`.
  - RemoteOK: distribución equitativa de cupo entre tags, corte y hard cap.
  - Computrabajo: deduplicar URLs de tarjetas en memoria con `Set` antes de invocar páginas de detalle, paginación acotada (`p=2`).
  - Unificado hard cap estricto en todas las fuentes (ninguna devuelve más de `maxResultados` ofertas).
  - Métricas de ejecución y motivo de finalización parcial (`limite_resultados`, `limite_peticiones`, `limite_paginas`, `agotado`).
  - Evidencia: Commit `5bfdfde`.

- [x] **T2: Backend — Ventana de 30 días, parseo seguro y aislamiento de errores de fecha**
  - Unificada ventana efectiva de publicación a 30 días (`DIAS_VENTANA_PUBLICACION = 30`), dejando constancia si una fuente externa limita su API a 14 días (LinkedIn, Glassdoor).
  - Sanitizadas fechas en `servicio-normalizacion.js` y `servicio-scraping.js`: si `isNaN(fecha.getTime())` o fecha futura improbable (>24h), se asigna `null`.
  - Computrabajo: parseo conservador de fechas relativas ("Hace X horas", "Hace X días", "Hace X semanas", "Ayer", "Hoy") calculando fecha aproximada y preservando `fechaTexto` en `datos_crudos`.
  - Protegida inserción de ofertas en `controlador-scraping.js` y `servicio-ingreso-ofertas.js` con `guardarLoteOfertasAislado` (`try/catch` por oferta) para aislar registros conflictivos sin descartar el lote.
  - Evidencia: Commit `5bfdfde`.

- [x] **T3: Frontend y DTOs — Claridad en fechas, métricas y motivos de finalización**
  - Extendido DTO `ResumenBusqueda` y modelos TypeScript con métricas de scraping y `motivoFinalizacion`.
  - Actualizado `tabla-ofertas.html` y tarjetas móviles: etiquetado explícito "Det: {fecha}" y "Pub: {fecha}", evitando presentar la detección como publicación.
  - Actualizado `panel-control.html` y `detalle-oferta.html` reflejando métricas de corte, ventana y distinguiendo detección de publicación.
  - Evidencia: Commit `4caf794`.

- [x] **T4: Pruebas Sintéticas y Verificación Integral**
  - Casos sintéticos obligatorios (60/50 Jooble devuelve 50, 70/50 RemoteOK devuelve 50, multi-término `tester`/`soporte`/`angular` ejecutados equitativamente).
  - Pruebas de borde de fechas con reloj controlado (10d, 20d, 40d, sin fecha, inválida, futura, relativa).
  - Verificación de no regresión en fuentes existentes (GetOnBrd, Indeed, Bumeran, Glassdoor, Adzuna).
  - Prueba integrada E2E: Preferencias guardadas → Jooble simulado 60 items crudos (con duplicadas y >30d) → normalización → deduplicación → filtro 30d → cupo final max 50 → persistencia → métricas y resumen.
  - Suite backend completa: 51 suites pasadas, 2010 tests pasados, 0 fallidos.
  - Suite frontend completa: 274 tests pasados en Chrome Headless, 0 fallidos. Build de producción exitoso.
  - Evidencia: Commits `5bfdfde`, `4caf794`.

- [x] **T5: Auditoría, Documentación, Engram y Pull Request**
  - Verificación de diff estricta (`git diff --check`: limpio).
  - Documentación actualizada en `docs/scraping.md` y `docs/api-rest.md`.
  - Registro de estado y decisiones en Engram.
  - Rama `fix/issue-16-cupos-fechas-scraping` lista para push y PR única hacia `master` con `Closes #16`.

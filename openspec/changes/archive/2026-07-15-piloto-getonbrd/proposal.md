# Propuesta: Piloto seguro de GetOnBrd

## Intención

Preparar el issue #3 sin descargar ni persistir datos productivos. La integración será solo por API oficial; el scraping HTML queda prohibido. El adaptador permanecerá deshabilitado hasta acreditar autorización escrita verificable.

## Alcance

### Incluido
- Cliente para sandbox/fixtures, normalización y ventana de 30 días.
- Paginación defensiva, timeout, cancelación, límites, checkpoints y motivos explícitos de terminación.
- Métricas y deduplicación intra-run/por URL, sin datos reales.
- Guarda dura que bloquee producción salvo evidencia escrita identificada, fechada y validada junto con configuración explícita; un booleano aislado no habilita nada.
- Procedimiento de autorización, rollout y rollback futuro.

### Fuera de alcance
- HTML scraping, cron productivo, descargas reales, persistencia productiva o declaración de cobertura total.
- Activar GetOnBrd en UI, automatización o registry.

## Capacidades

### Nuevas
- `piloto-getonbrd`: preparación API-only observable, cancelable y reanudable bajo sandbox/fixtures y autorización bloqueante.

### Modificadas
- `plataformas-registry`: GetOnBrd queda inactivo por defecto y no ejecutable sin autorización válida.
- `automatizacion`: GetOnBrd queda excluido del cron y de ciclos reales.
- `documentacion-activa`: incorpora autorización, límites y rollout.

## Enfoque

Reutilizar `fetch`, `AbortController`, normalización y unicidad por URL. Fijar sandbox como destino por defecto y validar en una guarda central: entorno, host permitido y evidencia estructurada. Procesar fixtures con `run_id`, corte de 30 días, límites, checkpoint por página y terminación por agotamiento, vacío, límite, timeout, cancelación o error. No agregar dependencias ni consultar producción.

## Áreas afectadas

| Área | Impacto | Descripción |
|---|---|---|
| `backend/src/config/plataformas.js` | Modificado | Deshabilitación y guarda |
| `backend/src/servicios/servicio-scraping.js` | Modificado | Cliente y paginación segura |
| `backend/src/servicios/servicio-normalizacion.js` | Modificado | Contrato GetOnBrd/30 días |
| `backend/tests/` | Modificado | Fixtures y pruebas negativas |
| `docs/scraping.md`, `docs/automatizacion.md`, `docs/api-rest.md` | Modificado | Autorización y rollout |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Activación accidental | Media | Denegar por defecto y exigir evidencia + configuración |
| API cambia o pagina con 500 | Media | Fixtures, límites y terminación defensiva |
| Cobertura incompleta | Alta | Reportar solo cobertura observada |

## Rollback

Deshabilitar el adaptador y retirar su entrada manual; conservar checkpoints/métricas de prueba. No habrá datos productivos que borrar.

## Dependencias

- Autorización escrita para cualquier rollout real posterior.
- Rama `feat/piloto-getonbrd`; entrega single-PR por defecto, presupuesto de revisión 2.000 líneas.

## Criterios de éxito

- [ ] Ninguna prueba o flujo alcanza host, cron, BD o datos productivos.
- [ ] La guarda rechaza producción sin evidencia escrita válida aunque exista un booleano habilitado.
- [ ] Fixtures prueban ventana, paginación, cancelación, checkpoints, métricas, deduplicación y terminación.
- [ ] El procedimiento de autorización y rollout queda documentado.

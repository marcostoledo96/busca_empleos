# Exploration: piloto-getonbrd

## Current State

La rama `feat/piloto-getonbrd` ya contiene una integración activa de GetOnBrd, aunque el issue #3 la describe como inexistente. El flujo actual es `POST /api/scraping/getonbrd` → `ejecutarScrapingGetonbrd()` → `normalizarLote()` → `crearOferta()`. El scraper usa `fetch()` contra `https://www.getonbrd.com/api/v0/search/jobs`, consulta `meta.total_pages`, recorre páginas por término y guarda las ofertas mediante `ON CONFLICT (url) DO NOTHING`.

La fuente técnicamente preferible es la **API pública oficial**, no HTML. La documentación pública observada el **2026-07-15** (`https://www.getonbrd.com/api-doc.html` y `https://www.getonbrd.com/doc/openapi.yaml?v=2026-05-08-agent-docs`) declara que la Public API es abierta, sin autenticación, incluye búsqueda de empleos y ofrece sandbox: `https://sandbox.getonbrd.dev/api/v0/`. El contrato OpenAPI documenta `GET /api/v0/search/jobs`, `query`, `page`, `per_page` (máximo 120), `remote`, `country_code`, `lang`, respuesta JSON con `data`, `links.public_url` y `meta.page/per_page/total_pages`.

También se verificó producción el **2026-07-15**:

- `GET https://www.getonbrd.com/api/v0/search/jobs?query=developer&page=1` respondió `200`, `per_page: 120`, `total_pages: 3` y 120 ítems.
- El ítem observado expuso `id`, `attributes.title`, `description`, `remote_modality`, `countries`, `published_at`, `min_salary`, `max_salary`, relaciones de `seniority` y `links.public_url`.
- Una página vacía (`query=%22&page=1`) respondió `200` con `data: []` y `total_pages: 0`.
- Una página fuera de rango (`page=9999`) respondió `500`, por lo que no debe usarse una petición posterior a `total_pages` como mecanismo normal de terminación.

La evidencia contractual es suficiente para considerar la API una candidata viable, pero no para afirmar permiso irrestricto de extracción masiva. Los términos vigentes observados el **2026-07-15** (`https://www.getonbrd.com/pages/get-on-board-terms-and-conditions-agreement`, última actualización indicada: **2025-09-04**) dicen que la API pública existe y que puede haber throttling, pero también restringen la copia o descarga automática de todo o parte de GoB IP y el uso fuera de lo expresamente contemplado. Por eso el piloto debe ser pequeño, identificar el User-Agent, respetar límites y solicitar confirmación escrita a `team@getonbrd.com` antes de activar escritura productiva.

`https://www.getonbrd.com/robots.txt`, consultado el **2026-07-15**, permite `/` para `User-agent: *`, pero prohíbe varios agentes de IA y publica `Content-Signal: search=yes,ai-train=no,use=reference`. Esto no constituye autorización específica para recolectar empleos ni debe interpretarse como permiso para HTML. La política de privacidad (`https://www.getonbrd.com/about/privacy`, última actualización indicada: **2023-03-08**) reconoce APIs, feeds y servicios públicos, y dice que los datos de ofertas publicados son públicos; no reemplaza la confirmación de uso para este piloto.

El estado actual no cumple todavía el contrato de piloto de 30 días: filtra por las últimas **2 semanas** (`filtrarPorUltimasDosemanas`), no registra checkpoint por página/término, no tiene timeout ni `AbortController`, no expone motivo de terminación, no separa duplicados del origen de duplicados de BD y no tiene rollback específico. La automatización general sí aísla fallas por plataforma, pero un error de GetOnBrd no deja un cursor reanudable.

## Affected Areas

- `backend/src/servicios/servicio-scraping.js` — reemplazar la paginación actual por un contrato de ejecución acotado: fecha de corte, límite de páginas/ítems, timeout, abort/cancelación, terminación explícita y checkpoints.
- `backend/src/config/apify.js` — conservar la URL base y los términos; agregar solo configuración mínima del piloto si no puede vivir como constante local.
- `backend/src/servicios/servicio-normalizacion.js` — mantener `public_url` como identidad primaria; mapear modalidad, seniority, salarios y fecha; evaluar `company` expandido solo si se verifica su shape.
- `backend/src/modelos/oferta.js` — la restricción única por `url` ya sirve como barrera final; no alcanza para métricas de duplicados ni para una reversión auditada.
- `backend/src/servicios/servicio-automatizacion.js` y `backend/src/config/plataformas.js` — el piloto no debe alterar el cron por defecto; debe activarse mediante una guarda explícita y registrar el resultado sin romper la resiliencia registry-driven.
- `backend/src/controladores/controlador-scraping.js` y `backend/src/rutas/scraping.js` — si se expone control manual, debe ser cancelable/observable y no ejecutar una extracción ilimitada en una request HTTP larga.
- `backend/tests/servicios/servicio-scraping.test.js`, `backend/tests/servicios/servicio-normalizacion.test.js` y `backend/tests/servicios/servicio-automatizacion.test.js` — faltan pruebas de orden de paginación, página vacía, `total_pages`, corte de 30 días, duplicados intra-run, timeout, cancelación, checkpoint, rollback y métricas.
- `docs/scraping.md`, `docs/automatizacion.md`, `docs/api-rest.md` y una especificación OpenSpec de cobertura — deben dejar de describir la integración actual como cobertura probada de 30 días y documentar que la completitud externa es condicionada.

## Approaches

1. **API pública oficial, piloto shadow/manual de 30 días** — Solicitar confirmación escrita, usar sandbox para contrato, luego ejecutar producción con pocos términos, `remote=true` solo como prefiltrado y validación local; no modificar el cron y no usar HTML.
   - Pros: utiliza el contrato público documentado, evita selectores frágiles, permite medir sin comprometer el ciclo normal y tiene una vía de cancelación simple.
   - Cons: la autorización de extracción masiva todavía debe confirmarse; `total_pages` no prueba cobertura absoluta ni garantiza orden por fecha; la API puede cambiar o aplicar throttling.
   - Effort: Medium

2. **HTML público con `robots.txt` como única base** — Leer páginas de búsqueda o detalle y extraer tarjetas/HTML.
   - Pros: podría mostrar campos que la búsqueda no devuelve.
   - Cons: no hay autorización específica para scraping HTML, el HTML es más frágil, `robots.txt` no es un contrato de uso, y los términos limitan descargas automáticas. Debe descartarse.
   - Effort: High

3. **No integrar todavía; pedir feed/exportación o autorización de partner** — Mantener GetOnBrd fuera del registry hasta recibir un feed, límite y permiso explícitos.
   - Pros: riesgo legal y operativo mínimo; contrato claro y rollback trivial.
   - Cons: no produce cobertura ni métricas en los próximos 30 días.
   - Effort: Low

## Recommendation

**Go condicional para un piloto API-only; no-go para scraping HTML.** Antes de cualquier implementación, enviar a `team@getonbrd.com` una solicitud breve que describa: endpoint público, frecuencia máxima, User-Agent, campos almacenados, retención de 30 días, ausencia de acceso autenticado, ausencia de republicación pública y mecanismo de baja. Si no llega confirmación escrita o la respuesta impone límites incompatibles, elegir la alternativa 3 y no activar GetOnBrd.

Si la confirmación llega, el piloto debe ser shadow/manual y no formar parte del cron semanal durante los 30 días. La ejecución mínima propuesta es:

1. Fijar `run_id`, `started_at`, `cutoff = now - 30 days`, términos, versión del contrato y límite duro de páginas/ítems.
2. Consultar el endpoint documentado con `page >= 1`, `per_page=120` y pausa/rate limit conservador; tomar `total_pages` como límite superior y detener además en página vacía, timeout, cancelación o error.
3. Guardar un checkpoint durable después de cada página: término, página confirmada, total esperado, último `id`/URL, estado y motivo de terminación. Reanudar solo desde la última página confirmada; nunca repetir una página como si estuviera confirmada.
4. Normalizar únicamente los campos públicos necesarios. Aplicar el corte de 30 días por `published_at`; si la fuente no garantiza orden descendente por fecha, el corte **no** puede detener la paginación: solo sirve para clasificar el resultado. Registrar `agotamiento_de_paginas` separado de `corte_de_fecha`.
5. Deduplicar en tres niveles y medirlos por separado: `id`/URL dentro del lote, URL canónica contra la BD y descarte por item inválido. Mantener `ON CONFLICT (url)` como última defensa.
6. Exponer progreso y cancelación con `AbortController`; cancelar debe conservar el último checkpoint, marcar `cancelada` y no borrar filas confirmadas. Un fallo parcial debe dejar `error_parcial` y permitir reanudar.
7. Rollback: apagar la feature flag y retirar GetOnBrd del ciclo, sin borrar ofertas de usuario; si el piloto usa tablas propias de runs/checkpoints, conservarlas para auditoría y marcar el run `rolled_back`. Cualquier borrado de datos requeriría una acción separada y explícita.

Métricas mínimas por run: requests, páginas, ítems recibidos, ítems normalizados, inválidos, dentro/fuera de ventana, duplicados intra-run, duplicados BD, nuevas guardadas, errores HTTP por código, latencia, bytes si están disponibles, estado final, motivo de terminación, timestamp del último checkpoint y porcentaje de páginas observadas sobre `total_pages`. No declarar “cobertura total”; declarar “cobertura observada bajo el contrato de búsqueda y sus límites”.

**Estimación:** dos slices revisables: (1) cliente API + normalización/terminación/tests, 4–6 archivos y 180–300 líneas; (2) run/checkpoint/métricas/cancelación/rollback/docs, 5–8 archivos y 250–450 líneas. Total aproximado: 430–750 líneas, riesgo medio/alto frente al presupuesto de revisión de 2.000 líneas y sobre el umbral estándar de 400; conviene separar PRs o aceptar una excepción explícita. No implementar un endpoint de extracción síncrono largo si el trabajo puede ejecutarse como job manual controlado.

## Risks

- La existencia de una API pública y de `robots.txt` permisivo no equivale a autorización para descarga automatizada masiva; la cláusula de uso de los términos debe resolverse por escrito.
- El endpoint responde `500` fuera de rango; un cliente que ignore `total_pages` puede generar errores o presión innecesaria sobre el portal.
- La documentación no garantiza que los resultados estén ordenados por `published_at`; detener por fecha podría perder ofertas recientes.
- La implementación vigente filtra 14 días y no es todavía un piloto reanudable de 30 días.
- `remote=true` es un filtro de la API, no sustituye la validación de `remote_modality`, países y reglas de exclusión del perfil.
- Las descripciones son HTML embebido en JSON; deben tratarse como datos no confiables y no renderizarse sin sanitización.
- La forma de `company` puede requerir `expand`; no conviene agregar requests de detalle por oferta en el piloto mínimo.
- No se debe tocar Railway, secretos, el cron vigente ni los cambios locales preexistentes (`.atl/*`, borrado de `PLANIFICACION.md`, `EXPLORACION_CV_UPDATE.md`, plan objetivo y `.codegraph/`).

## Ready for Proposal

Yes, con una condición bloqueante: la propuesta debe ser **API-only**, incluir la solicitud de autorización y tratar el permiso escrito como criterio de salida antes de habilitar persistencia productiva. El orquestador debería seguir con `sdd-propose` y `sdd-spec` únicamente si se acepta el Go condicional; si no hay confirmación, registrar No-Go y cerrar el alcance sin código.

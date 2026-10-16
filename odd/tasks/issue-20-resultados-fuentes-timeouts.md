# Issue #20 — Resultados por fuente y límites de espera
Base: `15dc74aeebc5e257beb2921504580bb3896a6ea7`; rama: `feat/issue-20-resultados-fuentes-timeouts`; destino: `master`; entrega: una única PR autorizada por Marcos.
Pruebas: Jest backend, Angular, build, PostgreSQL aislado y `git diff --check`. Sin proveedores reales, cron real ni producción.

## Specs

### S1 — Contrato compartido y estados
> Reutilizá el mismo contrato para:
> - Scraping individual.
> - Ciclo completo.
> - Cron cuando esté habilitado explícitamente.
> Completada: la consulta se ejecutó correctamente.
> Sin resultados: la consulta se ejecutó correctamente, pero no produjo ofertas elegibles.
> Parcial: se obtuvieron datos útiles, pero alguna consulta falló o se alcanzó un presupuesto que impidió completarla.
> Error: la fuente no pudo consultarse correctamente.
> Timeout: se alcanzó el tiempo máximo permitido.
> Sin credenciales: faltan los datos necesarios para ejecutar la integración.
> Deshabilitada: la fuente está desactivada en el registry, incluyendo su motivo.
> No confundas «sin resultados» con «no pude consultar».
> Si una fuente tuvo errores parciales y devolvió ofertas útiles, no la presentes como completada sin advertencias.

### S2 — Métricas y regresiones
> Reutilizá los contadores existentes de #16 y #19.
> Quiero poder consultar:
> - Nombre de la plataforma.
> - Consulta efectiva ejecutada.
> - Estado.
> - Cantidad de peticiones realizadas, si puede medirse.
> - Ofertas brutas recibidas.
> - Ofertas elegibles.
> - Nuevas insertadas.
> - Existentes actualizadas.
> - Reapariciones sin cambios.
> - Duplicadas intra-ejecución.
> - Descartadas por idioma o antigüedad.
> - Errores.
> - Duración aproximada.
> - Motivo de finalización.
> Si un dato no puede atribuirse correctamente a una consulta, informalo solamente a nivel fuente.
> No inventes métricas exactas que el proveedor no entregue.
> No sumes una actualización como oferta nueva.
> Pero no atribuyas resultados de evaluaciones anteriores a una búsqueda nueva.
> El sistema debe distinguir resultados de scraping y resultados de evaluación.
> No construyas relaciones complejas entre lotes para mostrar una métrica secundaria.
> Preservá los estados de las ofertas, sus descripciones manuales y las actualizaciones seguras de #19.

### S3 — Fallos y presupuestos
> Investigá:
> - HTTP 401.
> - HTTP 403.
> - HTTP 429.
> - HTTP 500/502/503.
> - Timeout.
> - Error de red.
> - Respuesta inválida.
> - Credenciales ausentes.
> No ocultes HTTP 429 como una búsqueda vacía.
> Mantené las pausas y los límites de peticiones por proveedor.
> Si una fuente falla parcialmente, conservá los resultados que sí fueron obtenidos.
> El ciclo completo debe seguir con las fuentes restantes siempre que sea seguro.
> Definí presupuestos razonables de tiempo para:
> - Peticiones HTTP individuales.
> - Operaciones de scraping de una fuente.
> - Consultas o paginaciones cuando corresponda.
> No confíes únicamente en `Promise.race()` si la operación externa continúa consumiendo recursos después de devolver un timeout.
> Para Apify, verificá qué operaciones realmente admiten cancelación y qué consecuencias puede tener detener un Actor.
> Si una operación no puede cancelarse de manera segura, documentá esa limitación y evitá presentar el timeout local como una cancelación externa confirmada.
> No modifiques actores ni clientes por iniciativa propia.
> No quedan solicitudes huérfanas que continúen escribiendo resultados fuera del proceso controlado.
> No se dispara una ejecución duplicada al reintentar.
> No implementes reintentos infinitos.

### S4 — Historial durable y acotado
> Quiero conservar un historial simple de ejecuciones recientes, incluso después de reiniciar el backend.
> No utilices archivos locales de Railway como almacenamiento permanente.
> Para cada ejecución registrada:
> - Fecha de inicio y finalización.
> - Tipo: individual, ciclo manual o cron, cuando corresponda.
> - Estado general.
> - Resumen por fuente.
> - Contadores disponibles.
> - Duración.
> - Motivos de error o finalización parcial.
> Conservá una cantidad acotada y razonable de ejecuciones recientes, por ejemplo las últimas 10 o 20.
> Si una ejecución se interrumpe por reinicio del backend, no la presentes posteriormente como completada correctamente.
> No guardes secretos ni credenciales, respuestas crudas extensas o datos sensibles innecesarios.
> Mostrá una lista sencilla de ejecuciones recientes dentro del panel existente.

### S5 — Cron explícito e inactivo por defecto
> Implementá una persistencia mínima que guarde:
> - Activado o desactivado.
> - Expresión cron elegida.
> - Zona horaria efectiva.
> La zona vigente es `America/Argentina/Buenos_Aires`.
> El cron debe permanecer desactivado por defecto.
> Solo si el usuario activa explícitamente el cron desde la aplicación:
> 1. Validar configuración.
> 2. Guardar la decisión.
> 3. Programar la ejecución.
> 4. Confirmar el estado realmente aplicado.
> Cuando el usuario lo desactive:
> 1. Detener el cron activo.
> 2. Persistir la decisión de desactivarlo.
> 3. Mostrar el estado confirmado.
> Si el estado persistido indica inactivo, no programar nada.
> Si nunca se guardó una decisión de activación, permanecer inactivo.
> Si existe una activación explícita válida anterior, restaurar su programación según esa decisión.
> Si la configuración es inválida o no puede verificarse de forma segura, no activar el cron y reportar el problema.
> No ejecutar automáticamente búsquedas atrasadas.
> No generar ejecuciones duplicadas.
> Aprovechá el startup existente de `backend/src/index.js`, sin agregar otro scheduler.
> Validá bien la consistencia entre el estado persistido y el estado real de `node-cron`, especialmente ante errores de PostgreSQL.

### S6 — Registry y presentación
> GetOnBrd: Actualmente está deshabilitado hasta contar con autorización escrita verificable.
> No debe figurar como una fuente operativa ni como una integración de producción disponible.
> No actives su piloto.
> Google Jobs: Conservá su desactivación por costo y baja utilidad.
> InfoJobs: Conservá su estado deshabilitado mientras siga vigente.
> Estar activas en el registry significa que el usuario puede intentar consultarlas, no que el proveedor esté disponible en este momento.
> Revisá la documentación del proyecto y corregí afirmaciones desactualizadas sobre plataformas operativas.
> Actualizá el panel de control manteniendo el diseño actual.
> Los estados deben basarse siempre en la respuesta efectiva del backend.
> No inventes ofertas, tiempos ni resultados.
> Respetá accesibilidad, estados de carga y funcionamiento responsive.
> Los fallos de actualización visual no deben confundirse con fallos del scraping.
> Conservá los filtros del dashboard y los estados manuales de postulación.

### S7 — Pruebas de aceptación obligatorias
> Utilizá proveedores simulados, tiempos controlados y datos sintéticos.
1. Respuesta válida vacía → sin resultados.
2. HTTP 503 → error, no sin resultados.
3. HTTP 429 → error de límite de solicitudes.
4. Timeout → estado timeout.
5. Credenciales ausentes → sin credenciales.
6. Fuente desactivada → deshabilitada con motivo.
7. Resultado útil más una consulta fallida → parcial.
8. Una ejecución parcial conserva sus ofertas útiles.
9. GetOnBrd permanece deshabilitado.
10. Las fuentes activas no se presentan como operativas si fallaron.
11. Las ofertas nuevas de #19 se contabilizan correctamente.
12. Las actualizaciones no se cuentan como nuevas.
13. Las reapariciones mantienen su categoría.
14. Duplicadas y descartadas no se contabilizan dos veces de forma engañosa.
15. La duración corresponde a la operación medida.
16. Las consultas informadas coinciden con las realmente ejecutadas.
17. Si no existe consumo real del proveedor, no se presenta costo exacto.
18. Las aprobadas de IA solo se atribuyen cuando hay información verificable de esa ejecución.
19. Una fuente que demora demasiado termina por timeout.
20. Las fuentes siguientes continúan.
21. Una petición abortada no incorpora escrituras tardías indebidas.
22. Los límites de peticiones y paginación de #16 se conservan.
23. Los errores de proveedor no generan reintentos infinitos.
24. La terminación del ciclo distingue fallos totales y parciales.
25. Una ejecución completada queda registrada.
26. Se puede recuperar después de simular un reinicio.
27. Se conserva el historial acotado.
28. No se almacenan credenciales ni payloads sensibles.
29. Una ejecución interrumpida no se presenta como éxito.
30. El frontend muestra estados y contadores correctos.
31. Estado inicial sin configuración → inactivo.
32. Desactivación explícita permanece después de reiniciar.
33. Activación explícita se puede restaurar correctamente en un reinicio simulado.
34. No se ejecutan ciclos vencidos durante el downtime.
35. Una configuración inválida no activa el scheduler.
36. Una lectura fallida de la configuración no activa el cron por defecto.
37. Rehidratar dos veces no crea dos programaciones.
38. Las pruebas nunca ejecutan un cron real.
39. Las búsquedas siguen utilizando las preferencias de #13.
40. Las frases de #14 se preservan.
41. La normalización de #15 sigue funcionando.
42. Los cupos y límites de #16 se respetan.
43. El matching de #17 se conserva.
44. La recuperación de evaluación de #18 no presenta regresiones.
45. La deduplicación y persistencia de #19 no se rompen.
> Realizá al menos estos tres:
> A. Fallo parcial de una fuente
> Proveedor simulado → primera consulta exitosa → segunda consulta HTTP 503 → resultados útiles conservados → estado parcial → métricas coherentes → resultado mostrado en Angular.
> B. Fuente lenta
> Primera fuente supera timeout → cancelación o finalización controlada → segunda fuente termina correctamente → historial registra ambos resultados → dashboard recibe las ofertas válidas.
> C. Reinicio
> Cron explícitamente desactivado → reinicio simulado → sigue desactivado → historial de ejecuciones disponible → no se inicia scraping.
> Utilizá PostgreSQL aislado para verificar migraciones y persistencia cuando corresponda.
> Ejecutá las pruebas focales, suites backend, pruebas Angular, build y `git diff --check`.
> Separá PASS, FAIL, SKIPPED y NOT RUN.

### S8 — Alcance y entrega
> Esta PR resuelve exclusivamente la issue #20.
> No implementes:
> - Nuevas plataformas.
> - Reactivación de GetOnBrd.
> - Activación predeterminada del cron.
> - Colas distribuidas.
> - Nuevo scheduler.
> - Redis.
> - Dashboard de observabilidad empresarial.
> - Historial ilimitado.
> - Cálculo inventado de costos de proveedores.
> - Reintentos automáticos infinitos.
> - Modificaciones generales del matching.
> - Cambios de modelo DeepSeek (#26).
> - Rediseño completo del frontend.
> - Funcionalidades de filtrado y selección del dashboard que corresponden a #21.
> Hacé commits convencionales en español.
> Publicá la rama.
> Abrí una única PR hacia master con `Closes #20`.
> Consultá CI sin provocar reruns manuales innecesarios.
> No hagas merge ni cierres #20.
> No ejecutes scraping pago real, no utilices bases de producción y no actives el cron.

## Tasks
T1 | S1-S3,S6-S7 | delegated worker: scrapers y presupuestos | done | 4b54778; RED 19 nuevas fallidas/129 previas PASS; GREEN y parent spot check 169 PASS; diff-check PASS. Revisión independiente del PR slice al finalizar integración.
T2 | S1-S5,S7 | delegated worker: orquestación, historial y cron | done | 62fe20b; 143 pruebas focales PASS; PostgreSQL real 1 PASS (migración idempotente, 20 filas, sanitización, reinicio e interrupción protegida). RED host inet con máscara corregido a host(inet_server_addr()).
T3 | S1-S2,S4,S6-S7 | delegated worker: panel, contratos Angular y docs | done | c7b61b8; RED UI 1 FAIL; focal 111 PASS; completa 319 PASS/3 SKIPPED; build PASS. 9 fallos iniciales de fixtures HTTP corregidos conservando assertions. A/B/C Angular con HTTP simulado; no puente Express.
T4 | S1-S8 | independent verify + correction worker + parent: integración, revisión, publicación y CI | in_progress | B1/B2 corregidos y recheck independiente PASS. Backend final 2368 PASS/151 SKIPPED; PostgreSQL real 1 PASS; Angular completo 319 PASS/3 SKIPPED + nueva regresión 1 PASS; build PASS. Pendientes commit final/revisión nativa/publicación/CI.

## Log
L1 — Solicitud original de Marcos: issue https://github.com/marcostoledo96/busca_empleos/issues/20; el texto completo permanece en la conversación. Requisitos operativos y criterios citados arriba, no una especificación de alcance adicional.
L2 — Corrección literal de Marcos: «si, se equivoco el que me da el prompt, vos realiza todo utilizando gentle-shell y gentle-ai».
L3 — Base remota revalidada 15dc74aeebc5e257beb2921504580bb3896a6ea7, sin PR abiertas. Worktree limpio aislado del árbol original con cambios ajenos. RDD global on. Explore real utilizado: gentle-ai-explore, CodeGraph primero. Fases Gentle AI: explorar → especificar en este documento → diseñar mínimo → tareas → implementación → verificación; no hay agentes sdd-* instalados y no se inventan fases nativas SDD.
L6 — Corrección B1/B2: RED 8 FAIL/88 PASS → focal 255 PASS. Recheck B1 PASS; B2 vivo PASS pero sanitización convertía null a error. Mismo bloqueador corregido en 2 líneas y regresión durable: RED 6 FAIL/12 PASS → GREEN 18 PASS; recheck independiente B2 PASS (18 pruebas + probe JSON 6 casos). No nueva barrida.
L7 — Verificación final parent: job-12 exit 0, backend 2368 PASS/151 SKIPPED en 68 suites, PostgreSQL real 1 PASS (migración repetible/retención/sanitización/reinicio/interrupción). job-11 exit 0, Angular 319 PASS/3 SKIPPED y build 662,49kB PASS; nueva prueba UI nullable 1 PASS aparte. diff-check PASS. Backend emitió aviso de handles abiertos pero terminó exit 0; no se comprobó su presencia en base. Angular fuentes PrimeIcons 404 en Karma. Se omitieron suites DB/vertical opt-in no habilitadas y proveedores reales/cron real/producción por alcance. A/B/C backend y Angular por capas; no puente único navegador→Express→PostgreSQL.
L5 — Verificación independiente mvah1mm2-9-bzt4: 68 focales backend PASS, 28 Angular PASS, PostgreSQL 1 PASS; 3 probes propios FAIL, baseline 2 PASS. B1: ciclo anterior libera reserva mientras siguiente activo tras esperar historial. B2: consulta sin elegibles se declara completada por crudos y LinkedIn conserva totalElegibles/estado anteriores a idioma. Corregir sólo estos bloqueadores y agregar regresiones. Entrega y CI pendientes. Pruebas A/B/C por capas, no puente Angular→Express→PostgreSQL.
L4 — Diseño mínimo: conservar arrays/metadatos existentes de scraping con telemetría aditiva, resultado por fuente compartido al ingresar ofertas, PostgreSQL para últimas 20 ejecuciones y decisión cron; panel existente, sin correlacionar IA histórica. Apify requiere verificación de versión instalada, no prometer abort remoto sin confirmación. Una única PR expresamente solicitada; alcance multiárea probablemente supera 400 líneas y aumenta carga de auditoría, sin dividir la entrega contra la instrucción del usuario.

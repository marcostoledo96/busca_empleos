# #98 — Consulta pública de solo lectura
Rama: `feat/busco-trabajo-mcp`. Base: `bcfd7be3ba083ba941a15ac16a0a46bb2550f19a`. Sin autorización de commit ni entrega remota.

## Specs
- S1. «Corregí el GET con el cambio mínimo. Con preferencias presentes, preservá el contrato. Sin preferencias, es aceptable el error seguro de lectura estricta definido por el backend; no crees defaults.»
- S2. «El nuevo núcleo de consulta para MCP debe poder listar y obtener detalle público sin necesitar preferencias ni recalcular matching.»
- S3. «Conjunto candidato máximo de 200 filas.» «Aplicar los filtros seguros en SQL y completar filtro/deduplicación antes del límite final de cinco.»
- S4. «No sustituir publicación desconocida por fecha de extracción.» «Modalidad desconocida debe seguir desconocida.» «Ubicación desconocida no satisface Argentina; remoto tampoco demuestra que admita candidatos desde Argentina.»
- S5. «Devolvé únicamente datos públicos necesarios y el enlace original seguro. El detalle puede agregar descripción pública acotada.» «Las pruebas deben tener red externa bloqueada y datos ficticios.»
- S6. «Nunca publiques la rama antes de acreditar el aislamiento indicado debajo.» «No implementes el transporte MCP, la administración de claves, la búsqueda externa ni otra interfaz en esta entrega.»
- S7. «Prueba exigida: nuevos fixtures de URLs con `key`/`access_key`/`jwt` que devuelvan null o excluyan el aviso en `listar` y `obtenerDetalle`, más URL inocua permitida.»
- S8. «Aportar comprobación de configuración efectiva para el proyecto vinculado, sin secretos, sin desplegar ni consultar datos de producción.» «La evidencia focal puede ser el gate proporcional de #98 si Pi la documenta con SHA/entorno/barreras/comandos/salidas».
- S9. Gentle R3-001: «Add a synthetic routed-fragment fixture and assert exclusion through both methods.» La reproducción posterior detectó variantes con `=` y `&` en la ruta.

## Tasks
- T1 · S1, S5 · inline + verificación · RED → GREEN (2/2) · sin commit
- T2 · S2–S5 · RED → GREEN; 8 pruebas PostgreSQL y regresiones focales · hallazgos S3 y S5 corregidos y comprobados por relectura independiente · sin commit
- T3 · S5–S6 · candidato local y documentación verificados · sin commit
- T4 · S6 · bloqueado para publicación hasta acreditar Vercel, Railway y automatizaciones externas y contar con autorización explícita
- T5 · S7 · corrección local de F1; RED → GREEN PostgreSQL aislado (129 pasaron, 12 omitidas); relectura independiente favorable, sin ejecución independiente del candidato local
- T6 · S8 · F3 documentado para los blobs probados; Railway y Vercel acreditados, automatizaciones externas pendientes de comprobar
- T7 · S9 · regresión de fragmentos con rutas, RED/GREEN PostgreSQL aislado; revisión nativa anterior preservada

## Log
- L1. Solicitud de implementación de https://github.com/marcostoledo96/busca_empleos/issues/98 exclusivamente; #99 y #100 quedan fuera. El criterio completo está en la issue y en el encargo de esta sesión.
- L2. `master` remoto y local coinciden con la base de planificación. No había rama ni PR candidata; creada únicamente la rama local solicitada.
- L3. Jest aislado: 129 pasaron, 12 omitidas de preferencias histórica; 8 pruebas usaron PostgreSQL de solo lectura, con fixtures separados. Dos hallazgos del verificador se reprodujeron y quedaron corregidos. No se hizo ejecución independiente sobre el árbol sin commit.
- L4. CI no publica ni promueve; Vercel tiene bloqueo local exacto y falta acreditar raíz efectiva. Railway y exclusión externa de autoavance no acreditados. Sin commit, push ni PR en ese punto.
- L5. PR #101 Draft hacia `Version1.1`, BASE `bcfd7be3ba083ba941a15ac16a0a46bb2550f19a`, HEAD auditado `ab22356cbd3933bd0fecce8484db1d59c4b646b0`. [Auditoría fuente](https://github.com/marcostoledo96/busca_empleos/pull/101#issuecomment-7071074903). Usuario: «lee comentario de la pr, y arregla todo».
- L6. RED del `INSERT` con el controlador de base; RED de F1 con el servicio del HEAD auditado. GREEN local con los blobs identificados en `docs/consulta-publica.md`. GitHub no registró checks en la Draft y no se encontró un `pr_fix_complete` invocable en esta sesión.
- L7. `e62e1bb` corrige F1; `56c63dd` contiene la primera corrección de fragmentos, rechazada con `native_stop_required` en `review-2334bc165a89a8fa`. El usuario eligió dejar de usar RDD en este clon; el interruptor global quedó activo. La nueva corrección ordinaria no altera ese dictamen.

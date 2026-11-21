# #98 — Consulta pública de solo lectura
Rama: `feat/busco-trabajo-mcp`. Base: `bcfd7be3ba083ba941a15ac16a0a46bb2550f19a`. Sin autorización de commit ni entrega remota.

## Specs
- S1. «Corregí el GET con el cambio mínimo. Con preferencias presentes, preservá el contrato. Sin preferencias, es aceptable el error seguro de lectura estricta definido por el backend; no crees defaults.»
- S2. «El nuevo núcleo de consulta para MCP debe poder listar y obtener detalle público sin necesitar preferencias ni recalcular matching.»
- S3. «Conjunto candidato máximo de 200 filas.» «Aplicar los filtros seguros en SQL y completar filtro/deduplicación antes del límite final de cinco.»
- S4. «No sustituir publicación desconocida por fecha de extracción.» «Modalidad desconocida debe seguir desconocida.» «Ubicación desconocida no satisface Argentina; remoto tampoco demuestra que admita candidatos desde Argentina.»
- S5. «Devolvé únicamente datos públicos necesarios y el enlace original seguro. El detalle puede agregar descripción pública acotada.» «Las pruebas deben tener red externa bloqueada y datos ficticios.»
- S6. «Nunca publiques la rama antes de acreditar el aislamiento indicado debajo.» «No implementes el transporte MCP, la administración de claves, la búsqueda externa ni otra interfaz en esta entrega.»

## Tasks
- T1 · S1, S5 · inline + verificación · RED → GREEN (2/2) · sin commit
- T2 · S2–S5 · RED → GREEN; 8 pruebas PostgreSQL y regresiones focales · hallazgos S3 y S5 corregidos y comprobados por relectura independiente · sin commit
- T3 · S5–S6 · candidato local y documentación verificados · sin commit
- T4 · S6 · bloqueado para publicación hasta acreditar Vercel, Railway y automatizaciones externas y contar con autorización explícita

## Log
- L1. Solicitud de implementación de https://github.com/marcostoledo96/busca_empleos/issues/98 exclusivamente; #99 y #100 quedan fuera. El criterio completo está en la issue y en el encargo de esta sesión.
- L2. `master` remoto y local coinciden con la base de planificación. No había rama ni PR candidata; creada únicamente la rama local solicitada.
- L3. Jest aislado: 129 pasaron, 12 omitidas de preferencias histórica; 8 pruebas usaron PostgreSQL de solo lectura, con fixtures separados. Dos hallazgos del verificador se reprodujeron y quedaron corregidos. No se hizo ejecución independiente sobre el árbol sin commit.
- L4. CI no publica ni promueve; Vercel tiene bloqueo local exacto y falta acreditar raíz efectiva. Railway y exclusión externa de autoavance no acreditados. Sin commit, push ni PR.

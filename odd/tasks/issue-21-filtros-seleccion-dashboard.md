# Issue #21 — Filtros, selección y mensajes del dashboard
Base: `75d11f133e6456b091a65373d15448bc753c0f22`; rama: `fix/issue-21-filtros-seleccion-dashboard`; destino: `master`.
Entrega autorizada: commits convencionales en español, push y una única PR con `Closes #21`; sin merge, cierre, deploy manual, cron, BD real ni APIs pagas.

## Specs

### S1 — Selección por página
> Seleccionar esta página.
> Debe seleccionar únicamente las ofertas visibles en la página actual, después de aplicar el buscador y los filtros activos.
> El checkbox debe mostrar el estado real de selección de la página.
> La etiqueta accesible debe indicar el alcance: «Seleccionar ofertas de esta página».
> Si no existen ofertas visibles, no debe seleccionar nada.
> Si desmarco la selección de la página, no debe borrar inesperadamente selecciones ajenas cuando el comportamiento permita conservarlas.
> Cambiar un filtro no debe dejar una selección oculta que luego se ejecute silenciosamente.
> Cambiar de página debe mantener una semántica clara y segura.
> Ordenar las ofertas no debe provocar que una selección afecte IDs diferentes.
> La selección debe trabajar con IDs estables, no con posiciones del array.
> No agregues un sistema avanzado de selección persistente entre múltiples páginas.
> No implementes filtros paralelos que terminen dando resultados distintos entre el checkbox y la tabla.
> No deben seleccionarse ofertas de otra plataforma, otra pestaña o que no coincidan con el texto buscado.

### S2 — Reevaluación y regresión
> Máximo de 200 ofertas.
> Confirmación explícita.
> Bloqueo cuando la evaluación está ocupada.
> Selección por ID.
> Refresco sin perder estados manuales.
> Protección frente a solicitudes concurrentes.
> Preservalas.
> No modifiques reglas de matching ni criterios de reevaluación.
> Verificá el comportamiento de la selección en modo normal y en modo de reevaluación.
> Preservá:
> - Diseño general del dashboard.
> - Pestañas.
> - Tabla PrimeNG.
> - Cards mobile.
> - Estados de postulación.
> - Ordenamiento.
> - Filtro de plataformas.
> - Sincronización en segundo plano.
> - Datos de caché.
> - Reapariciones de #19.
> - Historial y resultados por fuente de #20.
> - Modo demo.
> - Accesibilidad por teclado.

### S3 — Postulación individual y detalle
> Actualmente existe actualización optimista:
> 1. Cambio el estado local.
> 2. Se envía la solicitud HTTP.
> 3. Si falla, se restaura el estado anterior.
> Ese comportamiento debe mantenerse.
> Después de una respuesta exitosa del backend, mostrale al usuario una confirmación breve.
> «Postulación actualizada: CV enviado».
> No presentes éxito antes de recibir la confirmación.
> Cuando falla la API o devuelve "exito: false":
> - Restaurá el estado anterior.
> - Mostrá un mensaje visible.
> - Explicá que el cambio no se guardó.
> - Conservá las demás ofertas sin modificaciones.
> - No confundas un error de red con una acción exitosa.
> Utilizá el mecanismo de notificaciones actual de la aplicación, como PrimeNG Toast o un aviso accesible equivalente.
> No crees una nueva infraestructura de notificaciones.
> Una respuesta antigua no debe sobrescribir una decisión posterior.
> Podés deshabilitar temporalmente el control mientras se guarda o utilizar el mecanismo de versiones existente, eligiendo la solución más sencilla.
> Mantené los eventos "postulacionPendiente" y las protecciones del dashboard ante respuestas tardías.
> Mostrá la confirmación o el error en un lugar accesible incluso después de cerrar el detalle.
> Reutilizá la misma política de feedback que la tabla para evitar comportamientos diferentes.
> Conservá el cambio optimista y su reversión segura.
> No modifiques el resto del diálogo ni el desglose de matching de #17.

### S4 — Acción masiva
> Antes de ejecutar:
> - Verificar que hay IDs seleccionados.
> - Verificar que existe un estado destino válido.
> - Mostrar claramente cuántas ofertas se afectarán.
> - Evitar incluir ofertas ocultas por filtros.
> Durante la ejecución:
> - Evitar envíos duplicados.
> - Mostrar estado de procesamiento.
> - No declarar éxito antes de que el backend confirme.
> Si tiene éxito:
> - Actualizar el estado visible.
> - Mostrar cantidad confirmada por el servidor.
> - Limpiar la selección cuando corresponda.
> - Refrescar las ofertas preservando los filtros.
> Si falla:
> - Mostrar un error visible.
> - No presentar los cambios como guardados.
> - Conservar una selección útil para volver a intentar, si continúa siendo válida.
> - No perder estados manuales confirmados previamente.
> Si el backend devuelve una cantidad menor que la solicitada, no muestres «todas actualizadas» sin verificarlo.
> Aprovechá el contrato existente. No cambies la API del backend si no es necesario.

### S5 — Mobile
> Nunca mostrar "PÁG 3/1".
> Nunca quedar con cards vacías si hay ofertas disponibles en otra página válida.
> Actualizar correctamente el estado del paginador.
> No resetear innecesariamente a la primera página en cada refresco de datos si la página actual continúa siendo válida.
> Mantener los controles navegables mediante teclado.
> No dejar selecciones invisibles que se ejecuten accidentalmente.
> Usá los computed signals y efectos existentes. No agregues otro sistema de paginación.
> Tengo 55 ofertas, con 20 por página.
> Estoy en la página 3.
> Cambio la plataforma y quedan solamente 15 ofertas.
> Resultado esperado: mostrar la página 1 con esas 15 ofertas.
> Tengo 45 ofertas.
> Estoy en la página 3.
> Después de una actualización quedan 35.
> Resultado esperado: ajustar automáticamente a una página válida.
> Filtro por «Angular» y quedan cero ofertas.
> Resultado esperado: mostrar un estado vacío adecuado, no un número de página imposible.

### S6 — Estados vacíos
> Cuando realmente no existen ofertas en el conjunto correspondiente y no hay filtros que expliquen la ausencia.
> Mostrá un mensaje informativo apropiado.
> Cuando existen ofertas, pero el buscador o el filtro activo no encuentra coincidencias.
> Mostrá:
> «No hay ofertas que coincidan con los filtros actuales».
> Incluí una acción para limpiar los filtros pertinentes.
> Si tengo ofertas guardadas, pero ninguna pertenece a una categoría específica, no me indiques necesariamente que debo ejecutar scraping nuevamente.
> Explicá simplemente que esa categoría no tiene ofertas disponibles.
> Si el backend falló y se están mostrando datos de caché, conservá los mensajes de sincronización actuales.
> No confundas error de red con búsqueda sin resultados.
> La acción «Limpiar filtros» debe restablecer los filtros realmente aplicados, incluidos los del componente padre cuando corresponda.
> Utilizá outputs de Angular cuando el filtro pertenezca al dashboard.

### S7 — Pruebas obligatorias
> Utilizá ofertas sintéticas y respuestas HTTP simuladas.
1. Con 100 ofertas y 7 visibles por el buscador, «Seleccionar esta página» selecciona solamente las visibles de la página actual.
2. Ofertas ocultas por un filtro no se incorporan silenciosamente a una acción.
3. Cambiar de plataforma no ejecuta acciones sobre selecciones ocultas.
4. Cambiar de pestaña mantiene una selección segura y coherente.
5. Ordenar ofertas no cambia los IDs seleccionados por índices.
6. Desmarcar la selección no afecta otras ofertas incorrectamente.
7. El checkbox indica correctamente selección completa, parcial y vacía.
8. Las selecciones de reevaluación siguen respetando confirmación y límite de 200.
9. Actualización HTTP exitosa confirma el nuevo estado.
10. "exito: false" muestra error y revierte.
11. HTTP 500 muestra error y revierte.
12. Error de red muestra error y revierte.
13. Los mensajes son visibles y accesibles.
14. Una respuesta tardía no sobrescribe una decisión posterior.
15. El mismo feedback funciona desde tabla y diálogo.
16. La acción envía únicamente los IDs seleccionados y permitidos.
17. El botón evita envíos duplicados.
18. Éxito confirmado actualiza ofertas y limpia selección apropiadamente.
19. Error HTTP conserva el estado correcto y muestra aviso.
20. "exito: false" se trata como fallo.
21. Una cantidad confirmada menor no se presenta como éxito total.
22. Los filtros no se pierden después de aplicar la acción.
23. Pasar de 55 a 15 ofertas mientras estoy en página 3 ajusta a página válida.
24. Pasar de 45 a 35 ajusta el índice correctamente.
25. Un filtro sin resultados no muestra páginas inexistentes.
26. El paginador muestra el número correcto.
27. La navegación por teclado continúa funcionando.
28. La actualización de datos no resetea innecesariamente una página válida.
29. Sin datos reales muestra el estado vacío apropiado.
30. Sin coincidencias con el buscador muestra un mensaje diferente.
31. Una pestaña vacía no recomienda scraping innecesariamente.
32. «Limpiar filtros» restablece los filtros realmente aplicados.
33. Un error de sincronización no se presenta como ausencia de ofertas.
34. La sincronización y los optimistic updates de #13 siguen funcionando.
35. La reevaluación seleccionada de #9 conserva sus protecciones.
36. Las descripciones manuales y resultados explicables de #17 siguen intactos.
37. Los errores técnicos de #18 no se confunden con rechazadas.
38. Las reapariciones de #19 no alteran selecciones por ID.
39. Los resultados e historial de #20 siguen visibles.
> Agregá pruebas DOM reales del componente Angular: no alcanza con llamar a "toggleSeleccionarTodas()" directamente.
> En especial, reproducí un filtro real de PrimeNG, cambiá la página y comprobá los IDs que finalmente recibe "accionMasiva".
> Para mobile, verificá el resultado visible con un viewport reducido cuando dispongas de navegador de pruebas.
> Filtrar ofertas → seleccionar las visibles → aplicar cambio masivo → backend simulado devuelve error → mensaje visible → conservar selección válida → reintentar → éxito confirmado.
> Página mobile 3 → cambio de plataforma → quedan 15 ofertas → página válida → cards visibles → mensaje correcto.

### S8 — Verificación y entrega
> Ejecutá:
> - Pruebas focales de "TablaOfertas".
> - Pruebas focales de "Dashboard".
> - Pruebas del diálogo "DetalleOferta" cuando corresponda.
> - Tests de "OfertasService" afectados.
> - Suite Angular completa.
> - Build Angular.
> - "git diff --check".
> Si no modificás backend, no introduzcas cambios de backend ni ejecuciones de PostgreSQL innecesarias.
> Separá PASS, FAIL, SKIPPED y NOT RUN.
> No implementes funcionalidades de #22, nuevas reglas de matching, scraping, cron, cambios de modelo DeepSeek ni infraestructura adicional.
> Solicitá una revisión técnica independiente mediante "gentle-ai-verify" o el agente disponible.
> Hacé commits convencionales en español.
> Publicá la misma rama de trabajo.
> Abrí una única PR hacia master incluyendo "Closes #21".
> Consultá la CI sin lanzar reruns manuales innecesarios.
> No hagas merge ni cierres #21.

### S9 — Conciliación de parciales B-01
> - **B-01 | P2 BLOQUEANTE — reintento parcial repite IDs ya actualizados.** Código: [dashboard.ts L469-L489](https://github.com/marcostoledo96/busca_empleos/blob/dbc462e16d18c681677cc80914793e6b3043a4d3/frontend/src/app/paginas/dashboard/dashboard.ts#L469-L489), [tabla-ofertas.ts L95-L112 y L441-L450](https://github.com/marcostoledo96/busca_empleos/blob/dbc462e16d18c681677cc80914793e6b3043a4d3/frontend/src/app/componentes/tabla-ofertas/tabla-ofertas.ts#L95-L112) y [SQL L1098-L1107](https://github.com/marcostoledo96/busca_empleos/blob/dbc462e16d18c681677cc80914793e6b3043a4d3/backend/src/modelos/oferta.js#L1098-L1107). La API responde `datos.actualizadas`, sin IDs. Con `0 < actualizadas < ids.length` se conserva la selección, se liberan guardas y se habilita reintento; `revalidarSeleccion` controla sólo IDs visibles, no su estado persistido. Escenario concreto: desde pestaña Postuladas, cambiar `cv_enviado` a `en_proceso` con éxito parcial. Los registros ya actualizados permanecen en Postuladas; el GET puede mantenerlos seleccionados y el siguiente PATCH los reenvía. El `UPDATE ... RETURNING id` también cuenta filas que ya tienen el destino. Impacto: reescritura innecesaria, posible pisado de un cambio posterior y confirmación engañosa de un reintento. Hallazgo por análisis estático del código y contrato; escenario aún no reproducido por este auditor en navegador.
> - **Corrección mínima/validación B-01:** bloquear el reintento durante conciliación del parcial; tras GET, reconstruir selección reintentable sólo con IDs aún válidos cuyo estado confirmado sea distinto del destino. Si no puede saberse con certeza, advertir y solicitar nueva confirmación del alcance, sin inferir éxitos por ID del contador. Agregar test DOM Angular + HTTP simulado con 3 seleccionadas de Postuladas, PATCH parcial `2/3`, GET con 2 ya `en_proceso` y 1 `cv_enviado`: verificar IDs exactos del segundo PATCH, sin repetir éxitos. Cubrir botón durante refresco, respuestas tardías y filtros/pestañas. No requiere ampliar el backend ni rediseñar.

### S10 — Evidencia por lote en PR41
> - **Pedido al implementador Pi o Antigravity:** tras CADA commit o lote nuevo, publicar en esta misma PR un comentario breve de entrega: HEAD SHA exacto, BASE relevante, cambios y hallazgos atendidos, comandos/pruebas realmente ejecutados con PASS/FAIL/SKIPPED/NOT RUN y cantidades existentes, logs/enlaces, entorno, alcance, pendientes y limitaciones. Asociar las pruebas al SHA probado; si difiere del nuevo HEAD, explicar delta y qué no fue revalidado. Sin secretos ni datos reales. Son declaraciones del implementador, no PASS de auditoría independiente; no supone activación automática de watchers o pruebas.

## Tasks
T1 | S1-S7 | delegated worker: tabla, selección, mobile, postulación individual y pruebas DOM | done | Focal 42 PASS, diff-check PASS. Primer runner TS2307 (0 tests, no RED funcional), primer run funcional40PASS/2FAIL por supuestos de tests corregidos; GREEN42. Commit de unidad 87a6cca6f130e857be12c0621d101a7b6fe0ae5a. Revisión independiente del PR slice conjunto en T3; assess native medium/reviewDue false, elevado a high para verificación por concurrencia.
T2 | S2-S4,S6-S8 | delegated worker: Dashboard/Detalle, toast compartido, bulk, integración, docs y tests servicio | done | RED13FAIL/91PASS/3SKIP → GREEN105PASS/3SKIP; parcial refresh RED1FAIL/104PASS → GREEN105. Suite365PASS/3SKIPPED; build y diff-checkPASS. Parent focal tabla42PASS. Commit de unidad 4c85e25670da6a25db357a240bb247b9fc216778. Assess native medium/reviewDuefalse, high para verificación de concurrencia; review independiente T3.
T3 | S1-S8 | independent verify + parent: suite/build, navegador, revisión nativa pertinente, corrección acotada, publicación y CI | done | Commits bc6f9cac2f95bb0bd6181719494868bfda47e8cd y9a9db241151a463d4daae903906e93150b8a91d8. PR41 abierta a master: https://github.com/marcostoledo96/busca_empleos/pull/41. CI38926903850 success sobre9a9db24: Angular368PASS/buildPASS, backend2365PASS154SKIP, DB195PASS. Local suite/build/diffcheckexit0; independiente147PASS3SKIP, falso hallazgo refutado; CSSRED1FAIL13PASS→GREEN14PASS; mobile390x844clamp/limpieza/tecladoPASS. Assess medium/reviewDuefalse. Supplementals/baseline NOT RUNerrno-122; sin merge/cierre/deploymanual.

T4 | S4,S7,S9 | delegated worker + parent: reproducir y corregir reintento parcial con pruebas DOM/HTTP y docs | done | Commit89f6fbef7dabcbf74bdedf54b3a7c507a50ba232, BASEdbc462e; B01reproducido→62PASSantesguardnull; guardfinalnull/204y64casoscompilados, localNOTRUNporChrome. ConfirmaciónfuncionalCI38939271667SUCCESS: Angular390PASS/buildPASS, unit2365PASS154SKIP, DB195PASS. Rechecknullindependienteporinspección, noAngularlocalPASSinventado.
T5 | S8-S10 | independent verify + parent: validación, publicación misma PR, comentarios por lote y CI | done | Lote89f6fbe publicadoenPR41misma rama, comentario6220960259conSHA/BASE/pruebasreales/límites yCI38939271667verde; buildlocal4.511s/diffPASS. Últimocambiosólodocumentalregistracierre; sepublicarácomentarioexplicandodelta yconsultaráCIHEADsinrerunmanual. Sinmerge/cierre/deploymanual.

## Log
L1 — Solicitud original de Marcos (apertura literal): «Actuá como desarrollador responsable de Busca Empleos. Implementá completamente la issue #21 utilizando obligatoriamente la metodología Gentle AI en Gentle Shell de Pi.» La solicitud completa está en el turno inicial; los requisitos y ejemplos literales se conservan en Specs. Issue completa leída vía gh el inicio: https://github.com/marcostoledo96/busca_empleos/issues/21.
L2 — Base remota verificada exactamente 75d11f133e6456b091a65373d15448bc753c0f22, PR40 integrada, sin PR abiertas. Árbol original con cambios ajenos intacto; worktree aislado dentro del repo. CodeGraph usado antes de búsquedas extensas; explore real realizó mapa del checkout correcto. RDD on global.
L3 — Diseño mínimo: conservar selección filteredValue/página y Set de IDs; invalidar selecciones al cambiar alcance/página/filtro. Clamp mobile al rango válido sin reset por cada refresh. Dashboard provee MessageService/Toast existente compartido con tabla y detalle. Guardas por ID y bulk, pendiente global entre hijos y protección de versiones existente. Sin API/backend nuevo. Resultado parcial informa conteo, refresca sin simular todos los IDs como confirmados.
L4 — Ruta delegated direct por dos unidades independientes con superficies disjuntas: tabla frente a padre/detalle. Contrato común acordado antes de escribir: tabla recibe accionMasivaEnCurso:boolean, accionMasivaConfirmada:number (incrementar sólo éxito completo), alcanceSeleccion:string (tab+plataforma), totalOfertas:number (global sin filtros), filtroPlataformaActivo:boolean, idsPostulacionPendiente:ReadonlySet<number>; emite limpiarFiltros:void. Salidas accionMasiva y postulacionPendiente existentes se conservan. Dashboard bloquea envíos duplicados y operaciones cruzadas por ID; tabla también conserva guarda local en tests standalone.
L5 — Una sola PR solicitada explícitamente, dividida en commits revisables; no chaining automático ni ceremonia SDD. El volumen de pruebas requerido puede superar 400 líneas y se informará, sin reducir pruebas ni golf de código.
L6 — Verificador independiente gentle-ai-verify: focal147PASS/3SKIPPED y probes12PASS/1FAIL inicialmente. Retiró el único hallazgo whitespace: selector global leía tab oculta; PrimeNG20.4 ignora búsqueda de espacios y no requiere cambiar producción. Dos pruebas nuevas verifican semántica real. Probes suplementarios/baseline NOT RUN por errno-122; no se inventa comparación dinámica. Una continuación worker falló antes de agent_settled por mismo error; inspección del diff confirmó que sólo dejó las dos pruebas ya corregidas. Parent final job2 suite/build/diff-check exit0.
L7 — Navegador Playwright real390x844, demo aislado localhost4221,55 ofertas sintéticas: página3/3 con15cards → plataforma LinkedIn15 → página1/1 con15cards y sin paginador imposible PASS. Buscador sin coincidencias: mensaje exacto+botón limpiar PASS. Clic limpiar FAIL por cajas inline host app-tabla-ofertas/p-tabpanel que interceptan puntero (no error de API). Diagnóstico elementsFromPoint demostró que display:block en host y sólo panel activo corrige hit-target y conserva paneleshidden displaynone. Regresión DOM RED1FAIL/13PASS → GREEN14PASS. CSS definitivo sólo hostTabla block y panelactivo block, inactivos ocultos conservados. Recheck browser sin CSS temporal PASS: clamp55→15, búsqueda0/mensaje, clicLimpiar real resetea plataforma+texto/55ofertas y Enter navega página3. Job7 suite/build/diffcheckfinal exit0 (build4.056s). Sin llamadas backend, APIs pagas ni cron.
L8 — PR41 creada una sola vez con Closes#21 y type:bug, base75d11f133e6456b091a65373d15448bc753c0f22/head9a9db241151a463d4daae903906e93150b8a91d8 verificados REST y remoto. CI38926903850 completa success, AngularTOTAL368SUCCESS, frontend buildPASS, backend2365PASS154SKIPPED y DB195PASS. Vercel automático/previewPASS; no despliegue manual. Avisos informativos CI por actionsNode20→24 y futura migraciónubuntu26, fuera del alcance#21. Último cambio únicamente documental registra esta evidencia; su HEAD y CI se verifican en PR/Engram sin recursión de commits.

L9 — Solicitud literal de Marcos: «arregla todo lo que comenta en el comentario de la pr».
L10 — Auditoría externa completa, comentario https://github.com/marcostoledo96/busca_empleos/pull/41#issuecomment-6219525133 (requisito de corrección y evidencia autorizado por L9):

PR-AUDIT-V1
VERDICT: NO APTO
REPOSITORY: marcostoledo96/busca_empleos
PR: 41
BASE: 75d11f133e6456b091a65373d15448bc753c0f22
HEAD: dbc462e16d18c681677cc80914793e6b3043a4d3
BRANCH: fix/issue-21-filtros-seleccion-dashboard
SCOPE: #21 — selección filtrada, mensajes y estados del dashboard; destino master
STATUS: abierta, no draft, no mergeada
FINDINGS:
- **B-01 | P2 BLOQUEANTE — reintento parcial repite IDs ya actualizados.** Código: [dashboard.ts L469-L489](https://github.com/marcostoledo96/busca_empleos/blob/dbc462e16d18c681677cc80914793e6b3043a4d3/frontend/src/app/paginas/dashboard/dashboard.ts#L469-L489), [tabla-ofertas.ts L95-L112 y L441-L450](https://github.com/marcostoledo96/busca_empleos/blob/dbc462e16d18c681677cc80914793e6b3043a4d3/frontend/src/app/componentes/tabla-ofertas/tabla-ofertas.ts#L95-L112) y [SQL L1098-L1107](https://github.com/marcostoledo96/busca_empleos/blob/dbc462e16d18c681677cc80914793e6b3043a4d3/backend/src/modelos/oferta.js#L1098-L1107). La API responde `datos.actualizadas`, sin IDs. Con `0 < actualizadas < ids.length` se conserva la selección, se liberan guardas y se habilita reintento; `revalidarSeleccion` controla sólo IDs visibles, no su estado persistido. Escenario concreto: desde pestaña Postuladas, cambiar `cv_enviado` a `en_proceso` con éxito parcial. Los registros ya actualizados permanecen en Postuladas; el GET puede mantenerlos seleccionados y el siguiente PATCH los reenvía. El `UPDATE ... RETURNING id` también cuenta filas que ya tienen el destino. Impacto: reescritura innecesaria, posible pisado de un cambio posterior y confirmación engañosa de un reintento. Hallazgo por análisis estático del código y contrato; escenario aún no reproducido por este auditor en navegador.
- **Corrección mínima/validación B-01:** bloquear el reintento durante conciliación del parcial; tras GET, reconstruir selección reintentable sólo con IDs aún válidos cuyo estado confirmado sea distinto del destino. Si no puede saberse con certeza, advertir y solicitar nueva confirmación del alcance, sin inferir éxitos por ID del contador. Agregar test DOM Angular + HTTP simulado con 3 seleccionadas de Postuladas, PATCH parcial `2/3`, GET con 2 ya `en_proceso` y 1 `cv_enviado`: verificar IDs exactos del segundo PATCH, sin repetir éxitos. Cubrir botón durante refresco, respuestas tardías y filtros/pestañas. No requiere ampliar el backend ni rediseñar.
- **Verificación de alcance:** revisé diff completo (14 archivos, +1206/-102), AGENTS.md, issue #21 y sus comentarios (ninguno), plan ODD, tabla, detalle, dashboard, specs y contrato real backend read-only. Primer HEAD `9a9db241...`; commit adicional `dbc462e...` cambia únicamente `odd/tasks/issue-21-filtros-seleccion-dashboard.md` (evidencia/CI), sin alterar runtime. Selección visible usa `filteredValue`/`first`/`rows` e IDs; hay guardas cruzadas por ID, rollback optimista, toast accesible, limpieza padre/hijo, clamp mobile y vacíos diferenciados. Sin otro bloqueo demostrado dentro de #21. La indicación histórica `main` de AGENTS no modifica el destino GitHub real `master`.
- **CI comprobada:** [run #97](https://github.com/marcostoledo96/busca_empleos/actions/runs/38928349199) SUCCESS, asociada al HEAD `dbc462e16d18c681677cc80914793e6b3043a4d3`; checkout CI del merge sintético `8f15f690fff16c97675347c1d4949deb3733be03` sobre BASE indicada. GitHub Actions Linux/Node 22, npm ci, build frontend OK; ChromeHeadless 155: **368 PASS/3 SKIPPED/0 FAIL**. Backend unit: **2365 PASS/154 SKIPPED**, DB CI aislada: **195 PASS**; Vercel success. Logs leídos, sin reruns manuales. `mergeable=true`/CI verde no resuelve B-01.
- **Separación de evidencia:** implementador declara focal **147 PASS/3 SKIPPED**, probes, `git diff --check`, build local y Playwright real mobile 390×844/55 ofertas sintéticas; son afirmaciones suyas. El test [dashboard/issue-21.spec.ts L196-L218](https://github.com/marcostoledo96/busca_empleos/blob/dbc462e16d18c681677cc80914793e6b3043a4d3/frontend/src/app/paginas/dashboard/issue-21.spec.ts#L196-L218) comprueba parcial que mueve éxitos fuera de Aprobadas, no parcial que los conserva en Postuladas. Probes suplementarios por `errno -122`: **NOT RUN**, sin atribución causal. Tres verticales opt-in: **SKIPPED**, no PASS. Auditor: **NOT RUN** pruebas/build/Playwright locales; no instalé dependencias. Producción, APIs pagas, scraping real, DeepSeek, cron, BD real y deploy manual **NOT RUN**.
- **Pedido al implementador Pi o Antigravity:** tras CADA commit o lote nuevo, publicar en esta misma PR un comentario breve de entrega: HEAD SHA exacto, BASE relevante, cambios y hallazgos atendidos, comandos/pruebas realmente ejecutados con PASS/FAIL/SKIPPED/NOT RUN y cantidades existentes, logs/enlaces, entorno, alcance, pendientes y limitaciones. Asociar las pruebas al SHA probado; si difiere del nuevo HEAD, explicar delta y qué no fue revalidado. Sin secretos ni datos reales. Son declaraciones del implementador, no PASS de auditoría independiente; no supone activación automática de watchers o pruebas.
- **DICTAMEN:** NO APTO hasta corregir y validar B-01. No se hizo merge, cierre de issue ni despliegue.

L11 — Continuación en misma rama/worktree limpios; HEADlocal/remoto/PR dbc462e16d18c681677cc80914793e6b3043a4d3 y origin/master75d11f133e6456b091a65373d15448bc753c0f22 revalidados. Ruta delegated direct para preparación/implementación frontend acotada; riesgo concurrencia requiere independent verify. Sin cambios backend ni otras funcionalidades. B-01 se reproduce antes de corregir; no se asume reproducido por análisis estático. Las escrituras de entrega continúan autorizadas en PR41 existente; no abrir otra PR ni hacer merge/cierre/deploymanual.

L12 — Verificador finalBLOCKED detectó GET200null/204trabado en acceso respuesta.datos. Parent agregó2regresiones y guardas respuesta?.datos/?.exito; intento REDjob13 compiló64tests peroChromecrasheó0ejecutados por erroresescrituracaché/GPU, sinREDfuncional niGREENfinal. BaselineIndexedDB8PASS2FAILmismoscasos; no causacuotademostrada.
L13 — Marcos eligió literalmente «Probar con temporales dentro del proyecto (recomendado)»: usar frontend/.angular/cache/pruebas-aisladas para temporales y ejecutar una vez focal/suite/build, luego recheck limitado. Job14fallóexit1: Angular elimina directorios de caché que no sean la versión vigente20.3.22; `@angular/build/src/utils/purge-cache.js` confirma limpieza de siblings. El orquestador eligió una ruta purgable, errorpropio de preparación. Focal no produjo prueba funcional; suite/build no llegaronainiciarse por redireccionesa logsdir eliminado. No retries ni migración automática. Sólo archivos sintéticos enignoredcache afectados, sinsecretos/códigoreal. Se solicita decisión fresca: nueva vía bajo caché vigente o publicar con prueba local pendiente y CI.

L14 — Tras límiteChromeSocketpathtoolong, Marcos eligió literalmente «Publicar en PR41 y verificar con CI». Commit89f6fbef7dabcbf74bdedf54b3a7c507a50ba232 publicado sobre dbc462e; comentario https://github.com/marcostoledo96/busca_empleos/pull/41#issuecomment-6220960259 registra límites. CI38939271667 success en ese HEAD: AngularTOTAL390SUCCESS/buildPASS, unit2365PASS154SKIPPED, DB195PASS; Vercel/PreviewCommentsautomáticoPASS. CeroFAILCI. Inspecciónindependientemvb89mi3-c-43ob confirma null/204guardatendida; AngularindependienteNOTRUN, no se atribuyePASSlocal. LosfalloslocalesIndexedDBtambiénbaselineyChromeentorno permanecenhistóricos, no se inventa causa de IndexedDB. La publicaciónnoestabaaprobaciónficticia: fue disposición explícita y ahoraCIconfirmafuncionalmente.

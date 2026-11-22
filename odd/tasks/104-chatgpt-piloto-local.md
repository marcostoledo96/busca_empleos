# #104 — Piloto local Sign in with ChatGPT
Base: `896752d4816f7303a4fcf4a9dbebdc61e5bc5f47`; destino: `integracion/openai-calibracion`.
Alcance activo: simulación de Fase A. B, C y publicación tienen puertas independientes.

## Specs

### S1

> ## Objetivo y prioridad
> **P1 · Viabilidad y piloto oficial personal en Ubuntu; salida alojada bloqueada.**
> Permitir que Busco Trabajo evalúe ofertas con el cupo de una suscripción ChatGPT elegible y prepare un borrador de CV/preferencias, sin API key de OpenAI Platform ni facturación API separada. La autenticación de la app sigue siendo Firebase; ChatGPT es únicamente una conexión del proveedor de IA.

### S2

> ## Dictamen de investigación al 22/11/2026
> 1. La documentación oficial describe **ChatGPT plan usage** como capacidad opcional de Sign in with ChatGPT para clientes open source/locales. Identidad, permiso para usar el plan, elegibilidad del usuario/workspace y disponibilidad efectiva de modelos son verificaciones distintas.
> 2. Para apps pagas o remotamente alojadas el overview remite al formulario de interés. **No hay evidencia de acceso aprobado para Busco Trabajo alojado.** Ser un repo público, tener un plan o una guía de VM no habilita Railway/Vercel. Manual alojado y cron alojado quedan bloqueados por separado.
> 3. No se ha consultado el catálogo de la cuenta ni realizado inferencia. El quickstart menciona Plus/Pro elegibles; no certificar el plan concreto del titular con información del chat.
> 4. El árbol no contiene LICENSE raíz; backend/package.json declara ISC. Verificar el encuadre open source/local aplicable, sin asignar licencias ni afirmar cumplimiento por ser público.
> 5. El piloto es manual/local. Un lote de 3–5 es una serie limitada de Responses individuales, **no OpenAI Batch API**. No hay aprobación de cron por esta investigación.
> 6. Settings → Usage permite gestionar plan y créditos por app: para respetar la decisión de Marcos, **confirmar personalmente créditos deshabilitados antes de cualquier inferencia real**. No añadir otra vía de cobro.
>
> Fuentes primarias (revalidar antes de implementar):
> - [Overview](https://developers.openai.com/siwc/token-sharing-open-source), [quickstart/elegibilidad](https://developers.openai.com/siwc/quickstart).
> - [Registro y consentimiento](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [cuentas, renovación, revocación y uso](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).
> - [Modelos e inferencia](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [límites de preview](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [errores](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery).
> - [Guía VM](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms), [formulario de interés](https://openai.com/form/sign-in-with-chatgpt-interest/). No enviar el formulario en nombre del titular.

### S3

> ## Entregas y puertas de avance
>
> ### A. Contrato y prueba local simulada, sin consumo
> - Registrar una matriz: local manual / local programado / alojado manual / alojado cron; qué permite la fuente, qué falta comprobar, evidencia y responsable. Solo local manual es candidato inicial.
> - Diseñar el cliente mínimo propio con acceso directo al Responses público. No introducir un proceso Codex app-server si el adaptador directo basta.
> - Proponer una configuración local explícita por tarea y entorno. Deshabilitada por defecto, sin activarse por presencia casual de un token; rechazar activación alojada/cron sin autorización verificable. Mantener intacto el proveedor productivo.
> - Implementar primero el flujo y contratos contra fixtures. No abrir OAuth real ni leer sesiones ajenas para probarlos. Preparar instrucciones para que el titular inicie el vínculo desde su Ubuntu.
>
> ### B. Validación real mínima, solamente tras autorización separada
> - Antes de cada prueba real presentar: entorno Ubuntu/DB aislada, textos sintéticos exactos a compartir, modelos candidatos, número máximo de peticiones, esfuerzo solicitado, qué métricas se podrán observar, efectos y cancelación. No prometer consumo de cuota exacto si no es observable.
> - Marcos inicia el flujo oficial y revisa consentimiento, cuenta/workspace, límite y créditos deshabilitados. No registrar cuenta ni consentir por él.
> - Consultar el catálogo autenticado oficial de esa cuenta; guardar solo evidencia sanitizada de slugs/capacidades/fecha. Preferencia: **Luna para evaluar; Sol para importar CV y proponer preferencias**. Si faltan, presentar alternativas con sus límites y pedir elección; nunca sustituir silenciosamente.
> - Tras permiso de consumo, una inferencia sintética completa por modelo elegido. Que aparezca en el catálogo no acredita inferencia. Confirmar parámetros, formato estructurado, validación de esquema y evento terminal.
> - Si falla elegibilidad, consentimiento o capacidad, registrar el bloqueo, conservar el trabajo simulado y avanzar calibración independiente. No compensar con claves, créditos ni producción.
>
> ### C. Adaptador funcional local, condicionado a B
> - Integrar evaluación y análisis de CV usando los servicios existentes; este alcance no promete producción. El lote piloto de 3–5 IDs explícitos y un CV sintético revisable requiere aprobación adicional/expresa de datos, cuota y efectos.
> - No llamar `POST /api/evaluacion/ejecutar` sin IDs: hoy evalúa todas las pendientes recientes. No usar reintento masivo, reset de pendientes, ciclo completo ni cron.
> - Mantener cuenta de proveedor separada y vinculada al usuario Firebase autorizado. La identidad de ChatGPT no crea ni reemplaza la sesión de Busco Trabajo.

### S4

> ## OAuth, almacenamiento y desconexión
> - Registro propio `dynamic_agent_client` inicial; persistir el `client_id` emitido y un `ext_agent_host_id` estable/opaco de ese host. Nunca reciclar credenciales Codex/Pi.
> - PKCE S256, state y nonce nuevos; callback loopback `127.0.0.1` (no `localhost`) idéntico en autorización/canje. Solicitar `openid profile email offline_access resource.invoke chatgpt.tokens.use.direct` y `resource=https://api.openai.com/v1`; validar firma/issuer/audience/expiración/nonce/identidad del ID token y scopes realmente concedidos. La vuelta del navegador no prueba por sí sola el consentimiento.
> - Reconsentimiento solo por elección explícita, con client_id emitido y scopes completos. No usar `force_reconsent=true` sin confirmación de OpenAI para esa integración; revalidar el mecanismo oficial vigente (`prompt=consent` en la guía consultada).
> - Registro por identidad verificada y client_id. Propuesta de almacenamiento: `~/.config/busco-trabajo/` fuera del repo, directorio 0700 y archivo 0600 o almacén protegido equivalente. Guardados atómicos, renovación serializada y reemplazo conjunto del token rotatorio y expiración. Ruta final documentada, sin volcar contenido.
> - Tokens exclusivamente en backend local; nada en Angular, localStorage, URLs de la app, Git, CI, telemetría, screenshots o chat. Redactar URLs OAuth con hints.
> - Desvincular detiene nuevas llamadas, cancela/ignora resultados tardíos según contrato, intenta revocación por discovery, borra tokens locales y conserva identificadores no secretos necesarios. Si revocación remota no se confirma, explicarlo y guiar a Settings; no fingir éxito.
> - Probar identidad distinta, callback repetido/state inválido, denegación, scope ausente, token expirado, renovación/rotación concurrente, revocación local/remota y fallo temporal de red. Un error de proveedor no debe devolver a Angular un HTTP 401 que expulse la sesión Firebase: mapear a error de dominio, conservando status/código/request-id upstream sanitizados.

### S5

> ## Contrato Responses y datos
> - Usar únicamente endpoint público soportado. Requests `store:false`, `stream:true`, `input` array; éxito solo con `response.completed` más validación semántica/esquema de servidor.
> - No copiar `max_output_tokens`, `temperature` ni otros parámetros no soportados del cliente API/DeepSeek. Verificar allowlist vigente; no introducir `background`, storage de conversaciones ni Files upload API. Reutilizar extracción local de texto para PDF/MD, revisión/minimización antes de enviar.
> - Verificar Structured Outputs/`text.format`/JSON Schema y esfuerzo para la modalidad y modelo exactos. Capacidad de API general no demuestra soporte SIWC. Si solo es posible JSON solicitado y validado en servidor, documentar la limitación sin anunciar cumplimiento estricto.
> - Un stream interrumpido, inválido, incompleto, timeout, denegación o cuota agotada es fallo de ejecución, **nunca rechazo laboral**. SDK sin reintentos implícitos en piloto; cualquier reintento explícito acotado respeta la misma intención y presupuesto, sin nuevo lote. Cuota/consentimiento/revocación detienen la ejecución sin retry de inferencia ni fallback.
> - Distinguir errores antes del stream (incluido cuerpo `detail`) y terminales `response.failed`/incomplete. Mantener código estructurado/request-id seguro, sin texto de CV/prompts/respuestas en logs.
> - Sol devuelve borrador editable con evidencia y campos desconocidos. No guardar CV ni preferencias al analizar, conectar o aceptar OAuth; aplicar solo tras revisión y acción explícita existente.
> - Conservar el último resultado válido también cuando sea “por confirmar”, decisiones manuales y postulaciones. Coordinar semántica con #105.
> - Extender identidad/firma de caché por proveedor, slug/modelo, versión de criterios/prompt/esquema y esfuerzo si afecta resultado; conservar hashes de perfil/oferta, separación de identidad autorizada y control de vigencia. Una entrada anterior de DeepSeek no satisface una inferencia pedida a ChatGPT. No llenar caché de éxito desde errores.

### S6

> ## Esfuerzo y comparación
> - Luna `medium` vs `high`; Sol `high` vs `xhigh` solo para casos complejos y si ambos niveles son admitidos por modelo y modalidad. Si no hay parámetro configurable, documentar esfuerzo no controlable; no inventar equivalencias.
> - Comparar primero modelos/esfuerzos con reglas fijas y luego reglas con modelo fijo según #105. Registrar completitud/esquema, corrección, falsos descartes/aprobaciones, latencia y cuota observada; cuotas no observables = no medido. No ejecutar matriz masiva para escoger.

### S7

> ## Pruebas y aceptación
> - [ ] Dictámenes local/alojado separados, elegibilidad/capacidades con fuentes y sin promesas de acceso.
> - [ ] Contratos simulados de OAuth/SSE/errores y canarios de no filtración; no endpoints ni secretos productivos.
> - [ ] PostgreSQL aislado: lotes acotados, selección, cache, reinicio/recuperación sin relanzar, cancelación y resultado anterior/manual/postulación preservados.
> - [ ] Navegador real local: Firebase/login/demo/sesión nueva siguen; vincular/desvincular solo proveedor; plan y modelo visibles; CV queda borrador; consentimiento/cuota no generan otra llamada. Separar Firebase mock/emulador PASS de Firebase real NO PROBADO cuando corresponda; no atribuir acceso real al harness sintético.
> - [ ] Evidencia real solo para los escenarios expresamente autorizados; fallos OAuth/cuota probados con fixtures, no agotar el plan adrede.
> - [ ] Guía para Marcos: conectar/desconectar, ubicación protegida, Usage/limite/créditos, modelos y límite de soporte. No API key Platform.
> - [ ] Alcance alojado sigue bloqueado; entrega a #106 diferencia preparado, simulado y realmente validado.

### S8

> ## Dependencias y exclusiones
> Puede avanzar en paralelo con #105 hasta tocar contratos compartidos; coordinar archivos y usar PRs pequeñas desde integradora. #106 integra la evidencia. #70/#73, #80/#86 y #103 se reutilizan; #91 conserva confirmaciones personales. No inferir habilidades, nivel de inglés ni años desde memorias o datos no autorizados.

### S9

> ## Flujo de trabajo y permisos comunes
> - Este backlog fue autorizado el 22/11/2026 para planificación. No autoriza ejecutar código, OAuth, inferencias, pruebas reales, merges ni deploys en la sesión de creación.
> - Base verificada: `master@896752d4816f7303a4fcf4a9dbebdc61e5bc5f47`, merge de #103; #102 cerrada. `integracion/openai-calibracion` ya existía exactamente en ese SHA: se conserva sin reset ni push directo.
> - Cada tramo parte de una **rama de trabajo nueva desde la integradora actualizada** y abre una o varias PR internas **hacia `integracion/openai-calibracion`**. Nunca hacia `master` individualmente ni usando la rama de #103/MCP. Cada interna se incorpora solo con las aprobaciones acordadas; una única PR acumulativa **Draft** de integradora a `master`, cuando haya cambios publicables. En esta planificación no se abre ninguna PR.
> - Aplicar `AGENTS.md`: permisos concretos para commits/push y efectos. Si faltan en la sesión ejecutora, completar candidato y pruebas seguros, y pedir aprobación de la publicación concreta. No sobrescribir trabajo ajeno, no force-push, no auto-merge; merge final, quitar Draft final y deploy requieren decisión explícita del titular.
> - **Antes de cualquier push/PR futura verificar los efectos automáticos de Railway/Vercel.** Railway leído sigue `master`; `frontend/vercel.json` en esta base no acredita bloqueo de previews. Si no se puede demostrar que publicar la rama no despliega, preparar el candidato local y resolver ese control con Marcos, sin push exploratorio ni cambiar ajustes de hosting por cuenta propia.
> - #98–#100 y PR #101 siguen en pausa (Draft hacia `Version1.1`); #88 y la reconciliación privada #91 quedan fuera. No reabrir trabajos cerrados ni inferir confirmaciones personales.
> - Agente: recomendar `xhigh` para arquitectura y auditoría final, `high` para implementación y pruebas, o nivel realmente disponible. Registrar modelo/esfuerzo usados, sin confundirlos con los modelos de la app.
> - Pruebas con checkout limpio sin `.env`, fixtures, proveedor simulado, PostgreSQL efímero exclusivo y red externa bloqueada. `ALLOW_DB_TESTS=false`/`NODE_ENV=test` no garantizan aislamiento; DeepSeek carga dotenv y el arranque puede reanudar automatizaciones. `db:migrate` puede escribir sin `--apply`.
> - No introducir API key de OpenAI Platform, fallback pago, compra de créditos, cookies, sesiones de Codex/Pi, automatización de chatgpt.com ni endpoints privados. No retirar DeepSeek ni modificar producción, variables, permisos, cron o datos.
> - Evidencia por entrega: SHA, entorno, versiones, comandos, exit code, resultados PASS/FAIL/OMITIDO/NO PROBADO y límites. Separar dictamen técnico, revisión Codex y permisos de integración: defecto material comprobado = No apto; comprobación obligatoria concreta faltante = Evidencia insuficiente; auditoría principal aprobada con Codex pendiente no es un defecto.

### S10 — Corrección de auditoría de la PR #107

> lee comentario de la pr y arreglalo. toma como lo de vercel que no generara problemas

Referencia: [PR-AUDIT-V1](https://github.com/marcostoledo96/busca_empleos/pull/107#issuecomment-7086058301), auditado `d8a5bae1e9422b4c318e8bd06e57fae98034e10f`.

## Tasks

- T1 — S3, S4, S7: OAuth, sesión, revocación y almacenamiento simulados; worker; corrección L4, 12/12 focales; `53136ca`.
- T2 — S3, S5, S6, S7: transporte público Responses y catálogo con simulación; worker + parent; corrección L4, 8/8 focales; `2da0d15`.
- T3 — S1–S9: verificación independiente, evidencia y guía local; parent + verifier; simulación apta para enviar a auditoría, publicación bloqueada por previews; se registra en la entrega documental.

- T4 — S10: corregir los hallazgos de Responses y desconexión, rectificar evidencia y remitir a reauditoría; parent + verifier; verificado; commit de corrección asociado a PR-AUDIT-V1.

## Log

### L1

Actuá como desarrollador senior y arquitecto técnico de Busco Trabajo. Trabajá en la issue https://github.com/marcostoledo96/busca_empleos/issues/104 y respetá sus criterios completos.

Repositorio: https://github.com/marcostoledo96/busca_empleos
Integradora: integracion/openai-calibracion
Base histórica verificada: 896752d4816f7303a4fcf4a9dbebdc61e5bc5f47, con #103 mergeada y #102 cerrada. Revalidá el estado actual; no asumas que ese sigue siendo el HEAD.

Usá xhigh para arquitectura y decisiones difíciles, high para implementación y pruebas, o los niveles realmente disponibles. Informá el modelo y esfuerzo utilizados.

## Objetivo y límites

Quiero un piloto oficial personal en Ubuntu que use mi suscripción de ChatGPT para evaluar ofertas con Luna y preparar borradores de CV/preferencias con Sol, sujeto a elegibilidad y disponibilidad real. Firebase sigue autenticando Busco Trabajo.

Implementá y verificá primero lo local simulado. No inicies OAuth real en mi nombre, no consumas cupo, no uses datos personales ni llames proveedores reales sin autorización específica. No modifiques producción, DeepSeek productivo, variables, permisos, cron ni despliegues. Railway/Vercel manual y cron siguen bloqueados por separado.

No uses API key de OpenAI Platform, créditos, fallback pago, cookies, sesiones de Codex/Pi, automatización de chatgpt.com ni endpoints privados.

## Preparación

Leé AGENTS.md, la issue completa, #105 y la Etapa 0 de #106. Revalidá estas fuentes oficiales y las relacionadas que enlazan:

https://developers.openai.com/siwc/token-sharing-open-source
https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations

Separá identidad, permiso de uso del plan, elegibilidad y modelo disponible. Verificá el encuadre open source/local sin asumirlo por ser un repositorio público ni agregar una licencia sin mi decisión.

Inspeccioná el proveedor DeepSeek, servicio-evaluacion, identidad-evaluacion, evaluacion-cache, análisis de CV, automatización y rutas actuales. Reutilizá la arquitectura y el borrador editable existentes.

## Fase A: implementación simulada

Prepará el cliente oficial mínimo propio y sus fixtures. Preferí Responses directo si alcanza; evitá agregar un proceso de agentes innecesario.

Implementá OAuth propio conforme la documentación: registro inicial, client_id emitido, host ID estable, PKCE, state, nonce, callback loopback y validación criptográfica de identidad y scopes. Las credenciales pertenecen a esta app.

Proponé almacenamiento protegido fuera del repo, por ejemplo ~/.config/busco-trabajo/, con directorio 0700, archivos 0600 o mecanismo equivalente, guardados atómicos y renovación serializada. Nada de tokens en Angular, localStorage, logs, Git, CI o chat.

Desvincular debe detener llamadas, tratar correctamente resultados tardíos, intentar revocación y limpiar tokens locales. Si no se confirma la revocación remota, informarlo y guiarme a Settings.

El adaptador debe cumplir el contrato vigente: store:false, stream:true, input array y éxito solo con response.completed más validación del servidor. No copies max_output_tokens ni otros parámetros no soportados. Verificá Structured Outputs y esfuerzo; no confundas soporte de la API general con esta modalidad.

Probá consentimiento denegado, scope ausente, expiración, refresh concurrente, revocación, cuota agotada antes y después de abrir el stream, errores de admisión, timeout, JSON inválido, salida incompleta y desconexión. No agotes cuota real para probar esos casos.

Un 401 del proveedor debe producir un error de dominio que conserve la sesión Firebase. No puede convertirse en una redirección al login por el interceptor de #103.

## Fase B: prueba real, con mi intervención

Cuando el candidato simulado esté listo, presentame una propuesta concreta: entorno, textos sintéticos exactos, modelos, número máximo de peticiones, esfuerzo, consumo observable, efectos y cancelación. Esperá autorización antes de iniciar cualquier inferencia.

Yo debo iniciar el vínculo oficial, revisar cuenta/workspace y consentimiento, y verificar en ChatGPT Settings → Usage que el uso de créditos esté deshabilitado.

Consultá después el catálogo de esa cuenta. Preferencias: Luna para ofertas y Sol para CV/preferencias. Si faltan, mostrame alternativas; no cambies de modelo silenciosamente.

Con permiso de consumo, confirmá cada modelo con una inferencia sintética terminada. Verificá parámetros y formato estructurado. Si falla elegibilidad o capacidad, dejá el bloqueo documentado y permití que #105 continúe.

## Fase C: integración funcional local condicionada

Solo si la fase anterior confirma el camino, integrá el proveedor local en la app. El piloto de 3–5 ofertas por IDs explícitos y cualquier CV requieren autorización de datos, cuota y efectos.

No llames evaluación con selección vacía: actualmente puede tomar todas las pendientes. No uses reintento masivo, ciclo completo, cron ni recuperación que relance trabajo automáticamente.

Separá caché por proveedor, modelo exacto, parámetros efectivos y versión de criterios, conservando identidad de oferta/perfil. No pases Luna/Sol por el normalizador de DeepSeek.

Preservá resultados válidos, incluidos “por confirmar”, decisiones manuales y postulaciones. Los fallos técnicos nunca son rechazos laborales. Sol devuelve un borrador editable; no guarda preferencias automáticamente.

## Pruebas y Git

Usá checkout limpio sin .env, proveedor simulado, red externa bloqueada y PostgreSQL efímero con datos ficticios. Las banderas NODE_ENV=test y ALLOW_DB_TESTS=false no bastan para aislar.

Ejecutá pruebas focales, suites relevantes y navegador real. Separá Firebase mock/emulador de Firebase real; no declares validado un servicio real por fixtures. Registrá SHA, comandos, entorno, exit codes y omisiones.

Creá una rama de trabajo desde la integradora actualizada. Prepará una o varias PR internas hacia integracion/openai-calibracion, sin push directo a ella. Antes de publicar, verificá los controles de previews de #106. AGENTS.md exige aprobación para commits/push: si no está concedida en esta sesión, completá el candidato y pedila sobre la publicación concreta.

Conservá una única PR acumulativa Draft de integradora a master cuando corresponda. No hagas merge, no quites su Draft ni despliegues. #98–#100/#101 siguen en pausa.

Entregá diff, pruebas, guía para conectar/desconectar y ubicación protegida, capacidades realmente confirmadas y bloqueos. Separá dictamen técnico, estado Codex y permisos para integrar.

### L2 — Base y ruta de verificación

Integradora revalidada en `896752d4816f7303a4fcf4a9dbebdc61e5bc5f47`; #103 MERGED, #102 CLOSED. No hay PR acumulativa abierta desde la integradora. Worktree nuevo en `.worktrees/issue-104`. `bwrap --unshare-net` funciona; el namespace tiene solo loopback activo y no tiene ruta por defecto. El intento con `unshare --user --map-root-user --net` falló en uid_map. Node 24.18.0. No se arrancó la aplicación ni se consultaron proveedores.

T1 en curso. T2 detectó que `.test.js` entraría en Jest; corregir el alcance a `.node-test.js` con invocación explícita, sin cambiar Jest. T3 tiene matriz y borrador de guía; verificación pendiente.

### L3 — Candidato local y pruebas

T1 y T2 implementadas. T2 tuvo un RED adicional (6/7) al reproducir que el parser de catálogo seguía la API Platform; GREEN 7/7 con `models`, `visibility`, `slug` y `display_name` según SIWC. T3: prueba combinada 16/16, incluye Chrome real 158.0.8127.36 y callback loopback simulado. Suite backend, checkout Git efímero escribible, 3973 aprobadas/166 omitidas, exit 0; ensayos previos con archive y montaje solo lectura fallaron. Interceptor Firebase: compiló con plantilla ficticia, pero el lanzador de Karma no inició Chrome por SUID (exit 1, sin casos). Revisión independiente pendiente; no hubo PostgreSQL, OpenAI ni Firebase reales.

### L4 — Dictamen independiente del primer candidato: no apto

Verificador `gpt-6.2-sol/high`: 15/15; estas pruebas no cubren los defectos materiales. Reabiertas T1 y T2.

- S4: configurar una desvinculación durante refresh, devolver refresh rotado y fallar validación JWKS/ID: revocar el nuevo token en memoria y no habilitar ni persistir credenciales no verificadas. Confirmar y probar qué pasa si la revocación falla.
- S4: dos desvinculaciones concurrentes de cuentas distintas no pueden compartir resultado. Rechazar la segunda de forma explícita y permitir acción posterior para esa cuenta. Mantener deduplicación solo para el mismo ID.
- S4: tras `invalid_grant` en el primer canje descartar el código y permitir autorización nueva con el cliente emitido de ese intento, sin elevarlo a registro verificado antes de validar identidad y scopes.
- S5: preservar la forma de admisión `detail` sin texto e incluir códigos upstream seguros como `invalid_api_key`, sin propagar HTTP 401.
- S6: rechazar un esfuerzo explícito no soportado antes de fetch; no ignorarlo ni anunciar soporte real.

### L5 — Resultado de la revisión del candidato corregido

T1 RED 8/12, GREEN 12/12. T2 RED 6/8, GREEN 8/8. Combinado de parent con Chromium: 21/21 exit 0 (Chrome 158.0.8127.36, Node 24.18.0, `bwrap --unshare-net`). Reverificación independiente: 20/20, exit 0, `gpt-6.2-sol/high`: cinco hallazgos resueltos, apto focalmente para la simulación. La última suite Jest aplicable ejecutada fue 3973 PASS, 166 omitidas; las correcciones solo tocaron archivos autónomos no descubiertos por Jest. El check de interceptor quedó pendiente de un lanzador Chrome compatible con el aislamiento. No hay dictamen Codex, DB efímera en uso, prueba Firebase real, permiso de inferencia, aptitud para integrar ni autorización de commit, push o PR. Riesgo item 2: OAuth y credenciales. La Fase B necesita encuadre y consentimiento personal; la Fase C sigue condicionada. No se modificaron CI ni hosting.

### L6 — Autorización permanente, condicionada a envío a auditoría

> quiero que cambies la politica, y hagas commit, push y pr de forma independiente cuando ya es apto para enviar a auditoria

Ubicación elegida por Marcos: `AGENTS.md` del repositorio junto con la #104. La regla autoriza preparar y publicar la rama de trabajo cuando esté lista para auditoría; los estados anteriores de commit sin autorización son históricos. No elimina los controles de previews de #106 ni las comprobaciones obligatorias que todavía faltan para el envío. No autoriza merge, deploy, force-push ni quitar Draft.

### L7 — Firebase simulado, commits locales y barrera de publicación

> hace todo eso

`npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/interceptores/auth.interceptor.spec.ts`: 10/10, exit 0, Node 22.22.1, Karma 6.4.4, Chrome 158. Archivo ficticio desde el ejemplo versionado, Chrome dentro de `bwrap` con red, PID, IPC y UTS aislados, sin home del host. No se probó Firebase real.

La política en `AGENTS.md` pasó revisión independiente. Se hicieron commits locales `53136ca` (OAuth, almacén, fixtures y Chromium; porción superior a ~400 líneas para mantener juntas las pruebas y el contrato OAuth) y `2da0d15` (Responses, catálogo y fixtures). La guía y la política cierran el candidato local. Para el envío, separar OAuth y Responses en porciones revisables hacia `integracion/openai-calibracion` sin partir código de sus pruebas; ninguna publicación hasta confirmar #106.

Railway: servicio `busca_empleos` de producción sigue `master`; la lectura no expone si PR Environments está habilitado. Vercel: el proyecto `busca-empleos` aparece al filtrar por repositorio; la lectura no expone el ajuste efectivo de previews o la exclusión de esta rama. Sin push, PR o cambios de configuración. OAuth real y Fases B/C siguen separados.

### L8 — Corrección posterior al envío

> lee comentario de la pr y arreglalo. toma como lo de vercel que no generara problemas

El titular confirmó que el despliegue observado de Vercel corresponde a un entorno separado de producción y acepta ese efecto en la PR #107. Rectificar la descripción: no estaba deshabilitado. No modificar hosting ni tomarlo como permiso general. Candidato auditado: `d8a5bae1e9422b4c318e8bd06e57fae98034e10f`. Hallazgos técnicos: rechazar `role=system` antes del transporte y desactivar la concesión local ante `subscription_sharing_invalid_user` confirmado sin tratar como revocación otros 401 ni borrar una autorización nueva. No ampliar Fase A.

### L9 — Evidencia del candidato corregido

RED: `node --test backend/piloto-chatgpt/{oauth,responses}.node-test.js` bajo `bwrap --unshare-net`, exit 1: 21 PASS y dos FAIL esperados (envío de system y segundo uso tras desconexión). GREEN, mismo aislamiento más Chrome real por fixture: `node --test backend/piloto-chatgpt/{oauth,responses}.node-test.js backend/piloto-chatgpt/oauth.browser-check.js`, exit 0: 24 PASS, sin omisiones. El 401 genérico no elimina credenciales y la respuesta tardía no borra una concesión nueva. Backend en checkout Git escribible con archivos del candidato superpuestos: `NODE_ENV=test ALLOW_DB_TESTS=false npm test -- --runInBand`, exit 0, 3973 PASS y 166 omitidas. Node 24.18.0. No se repitió Firebase mock (10/10 en el candidato anterior; frontend intacto). Sin OAuth real, cuota, PostgreSQL ni producción.


Revisión independiente final de S10: `gpt-6.2-sol/high`, Node 24.18.0, `bwrap --unshare-net`, 23/23, exit 0. Probes independientes del path SSE concurrente con refresh, errores no terminales y nueva vinculación: base 1/3 (exit 1 esperado), candidato 3/3 (exit 0). Sin bloqueantes en la corrección. La descripción original de #107 quedó rectificada vía REST: preview Vercel separado aprobado para esta PR; no se modificó configuración. CI de #106 y Codex no ejecutados en esta verificación.

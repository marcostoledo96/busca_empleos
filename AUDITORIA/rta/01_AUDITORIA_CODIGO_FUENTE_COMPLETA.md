# Auditoría mejorada sobre código fuente — Busca Empleos

**Fecha:** 27 de mayo de 2026  
**Alcance:** revisión estática del ZIP `busca_empleos.zip`, código backend, frontend, SQL, configuración y tests.  
**Stack auditado:** Node.js 22 + Express 5 + PostgreSQL + Angular 20 + Firebase Auth.

## Resumen ejecutivo

### Puntaje general: 78/100

El proyecto está bastante bien encaminado para un sistema personal/de aprendizaje: tiene separación por capas, auth server-side con Firebase, SQL parametrizado, rate limit en endpoints principales, tests relevantes, modo demo y una arquitectura entendible. La auditoría con código fuente confirma varias buenas decisiones que en la auditoría documental solo podían asumirse.

La principal mejora respecto de la auditoría anterior es que ahora hay evidencia directa de archivos y líneas. El hallazgo más importante no es del runtime de la app sino del proceso de entrega: el ZIP compartido incluyó secretos reales (`.env` y service account de Firebase). Aunque están ignorados por Git, al empaquetar el working tree quedaron dentro del archivo.

### Distribución de hallazgos

- 🔴 Críticos: 1
- 🟠 Altos: 3
- 🟡 Medios: 13
- 🟢 Bajos: 4

### Top 5 prioridades

1. **[H001] Rotar secretos y crear export seguro del proyecto.**
2. **[H002] Agregar rate limit al análisis/importación de CV con IA.**
3. **[H003] Blindar o eliminar endpoint de diagnóstico de persistencia.**
4. **[H008] Ordenar migraciones con runner y control de aplicadas.**
5. **[H012] Agregar paginación/lotes para ofertas y evaluación.**

## Qué cambió al revisar código real

La auditoría documental decía que faltaban certezas sobre SQL injection, auth y estructura. El código confirma que:

- Las queries principales usan parámetros `$1`, `$2`, etc.
- El `ORDER BY` dinámico usa whitelist.
- Firebase JWT se verifica server-side y además se restringe por `EMAIL_AUTORIZADO`.
- Helmet y CORS están configurados.
- Los endpoints costosos principales tienen rate limit.
- Hay tests backend y frontend más completos de lo que sugería una lectura rápida.

Pero también aparecen hallazgos que solo se ven con el código fuente:

- El ZIP incluye secretos ignorados por Git.
- El endpoint de importación de CV quedó fuera del rate limit.
- El diagnóstico de persistencia puede devolver `connectionString` si se habilita por error.
- La tabla de lotes de evaluación se escribe pero no se lee para rehidratar.
- La paginación todavía no existe y el dashboard carga todas las ofertas.

---

# Hallazgos detallados

## [H001] El ZIP compartido incluye secretos reales y credenciales operativas

**Severidad:** 🔴 CRÍTICO  
**Categoría:** Seguridad / DevOps  
**Archivos afectados:** `backend/.env`, `backend/firebase-service-account.json`, `frontend/src/environments/environment.ts`, `frontend/src/environments/environment.prod.ts`, `.gitignore`, `backend/.gitignore`

**Descripción:**  
El código fuente recibido incluye archivos ignorados por Git pero presentes en el paquete: `backend/.env`, `backend/firebase-service-account.json` y environments reales del frontend. `git status --ignored` los marca como ignorados, no versionados, pero el riesgo ya existe al comprimir/compartir el working tree completo. El service account contiene una clave privada de Firebase Admin y el `.env` contiene tokens/URLs/keys. No reproduzco valores por seguridad.

**Evidencia:**
- Los `.gitignore` ignoran estos archivos, pero el ZIP los incluyó igualmente: `.gitignore:9-17`, `backend/.gitignore:4-8`.
- El análisis confirmó presencia de `private_key` en `backend/firebase-service-account.json` y variables reales en `backend/.env` sin imprimir sus valores.

**Recomendación:**  
Rotar inmediatamente las credenciales expuestas, borrar los archivos sensibles del paquete compartido y crear un procedimiento seguro de exportación del proyecto que excluya `.env`, service accounts, `.git`, `node_modules`, coverage y environments reales.

**Plan de implementación:**
1. Revocar/regenerar Firebase Admin service account desde Firebase Console y reemplazar `FIREBASE_SERVICE_ACCOUNT_JSON` en Railway.
2. Regenerar `DEEPSEEK_API_KEY`, `APIFY_TOKEN`, `ADZUNA_APP_KEY`, `OPENCODE_GO_API_KEY` y cualquier credencial dentro de `backend/.env`.
3. Crear `scripts/exportar-proyecto-seguro.sh` o documentar `git archive --format=zip HEAD -o busca_empleos_safe.zip` para compartir solo archivos versionados.
4. Agregar una verificación pre-zip o pre-commit con patrones: `.env`, `firebase-service-account.json`, `BEGIN PRIVATE KEY`, `DATABASE_URL=`, `sk-`, `apify_api_`.
5. Verificar que un ZIP nuevo no contenga secretos con `zipinfo -1 archivo.zip | grep -Ei "env|service-account|private|node_modules|\.git"` y con `grep -R "BEGIN PRIVATE KEY" carpeta_exportada`.

**Cómo verificar:**
- Confirmar que las keys viejas ya no funcionan.
- `git status --ignored backend/.env backend/firebase-service-account.json frontend/src/environments/environment.ts frontend/src/environments/environment.prod.ts` debe mostrar solo ignorados localmente, nunca incluidos en paquetes.
- El próximo ZIP debe pesar mucho menos y no contener `.git`, `node_modules` ni credenciales.

---

## [H002] Endpoint de importar CV consume IA cara sin rate limit

**Severidad:** 🟠 ALTO  
**Categoría:** Seguridad / Costos / Backend  
**Archivos afectados:** `backend/src/app.js`, `backend/src/rutas/preferencias.js`, `backend/src/controladores/controlador-preferencias.js`

**Descripción:**  
`/api/preferencias/importar-cv/analizar` llama a DeepSeek con el modelo de importación, por defecto `deepseek-v4-pro`, pero `app.js` monta `/api/preferencias` sin `limitadorCostoso`. Está autenticado, pero si hay un bug del frontend, token comprometido o múltiples clicks, puede generar costo y latencia innecesaria.

**Evidencia:**
- `app.js:167-170` aplica rate limit a scraping/evaluación/automatización, pero no a preferencias.
- `rutas/preferencias.js:30-32` expone `GET`, `PUT` y `POST /importar-cv/analizar` bajo el mismo router.
- `controlador-preferencias.js:433-447` obtiene el modelo de importación y llama a `consultarDeepSeek`.

**Recomendación:**  
Aplicar rate limit específico al endpoint de importación de CV y bloqueo de concurrencia por usuario/proceso. Para este proyecto personal alcanza con 2 requests cada 5 minutos.

**Plan de implementación:**
1. En `backend/src/app.js`, crear `limitadorImportacionCv` con `windowMs: 5 * 60 * 1000` y `max: 2`.
2. Montar el rate limit en `POST /api/preferencias/importar-cv/analizar`. Opción simple: mover ese endpoint fuera del router y montarlo antes con limitador; opción ordenada: exportar router separado o aplicar middleware solo a esa ruta dentro de `rutas/preferencias.js`.
3. Agregar estado `analisisCvEnCurso` en memoria para evitar dos análisis simultáneos.
4. Agregar tests en `backend/tests/controladores/controlador-preferencias.test.js` para verificar 429 al superar el límite.

**Cómo verificar:**
- Ejecutar el test del controlador de preferencias.
- Probar tres uploads consecutivos: el tercero debe devolver 429.
- Verificar que `GET/PUT /api/preferencias` no queden innecesariamente bloqueados por el rate limit caro.

---

## [H003] El endpoint de diagnóstico puede exponer configuración interna si NODE_ENV está mal seteado

**Severidad:** 🟠 ALTO  
**Categoría:** Seguridad / Backend  
**Archivos afectados:** `backend/src/controladores/controlador-ofertas.js`, `backend/src/config/base-datos.js`, `backend/src/rutas/ofertas.js`

**Descripción:**  
`GET /api/ofertas/diagnostico/persistencia` devuelve configuración de conexión y datos internos de PostgreSQL cuando `NODE_ENV !== 'production'`. El modelo arma `configuracionConexion` con `connectionString: databaseUrlValida`; si `DATABASE_URL` contiene usuario/contraseña y `NODE_ENV` queda mal configurado en Railway, el endpoint autenticado podría exponer una URL sensible.

**Evidencia:**
- `controlador-ofertas.js:66-73` bloquea solo si `NODE_ENV === "production"`.
- `base-datos.js:106-121` conserva `connectionString` en la configuración interna.
- `base-datos.js:150-153` devuelve `configuracion`, `resumen` y `conexion`.

**Recomendación:**  
Eliminar el endpoint de producción por diseño o protegerlo con una variable explícita `HABILITAR_ENDPOINTS_DIAGNOSTICO=true` y sanitizar siempre la salida.

**Plan de implementación:**
1. En `controlador-ofertas.js`, reemplazar el check `NODE_ENV === production` por `process.env.HABILITAR_DIAGNOSTICO_PERSISTENCIA === "true"`.
2. En `base-datos.js`, no devolver `connectionString` completa. Devolver solo estrategia, host redacted, puerto, database name y flags booleanos.
3. Agregar test para asegurar que la respuesta nunca contiene `postgres://`, `postgresql://`, `@`, password ni `DATABASE_URL`.
4. Documentar que el diagnóstico solo se habilita localmente y de forma temporal.

**Cómo verificar:**
- Con `NODE_ENV=production`, debe responder 404.
- Con diagnóstico habilitado, la respuesta no debe contener credenciales ni URL completa.
- Buscar en logs/respuestas: `grep -R "postgresql://"` no debe aparecer en salidas de diagnóstico.

---

## [H004] La configuración de CORS tiene fallback permisivo si falta CORS_ORIGEN

**Severidad:** 🟡 MEDIO  
**Categoría:** Seguridad / Configuración  
**Archivos afectados:** `backend/src/app.js`, `backend/.env.example`

**Descripción:**  
Si `CORS_ORIGEN` no está configurado, el backend permite por defecto `http://localhost:4200` y `https://busca-empleos.vercel.app`. Para desarrollo es cómodo, pero en producción conviene fallar cerrado si falta una variable de seguridad. El proyecto personal reduce el impacto porque la API exige Firebase Auth, pero CORS debe ser explícito.

**Evidencia:**
- `app.js:68-78` define origenes desde env o usa fallback.
- `backend/.env.example:45-47` documenta `CORS_ORIGEN`.

**Recomendación:**  
En producción, exigir `CORS_ORIGEN` y abortar el arranque si no está. Mantener fallback solo en desarrollo/test.

**Plan de implementación:**
1. En `app.js`, si `NODE_ENV === "production"` y `origenesConfigurados.length === 0`, lanzar error al iniciar.
2. Mover los defaults a una rama `development/test`.
3. Agregar test de CORS para producción sin variable: debe fallar el boot o bloquear origins.
4. Actualizar `.env.example` aclarando que en producción `CORS_ORIGEN` es obligatorio.

**Cómo verificar:**
- `NODE_ENV=production CORS_ORIGEN=` debe fallar explícitamente.
- Preflight desde un origen no permitido no debe incluir `Access-Control-Allow-Origin`.

---

## [H005] Errores internos de preferencias se devuelven al cliente con mensaje real

**Severidad:** 🟡 MEDIO  
**Categoría:** Seguridad / Backend  
**Archivos afectados:** `backend/src/controladores/controlador-preferencias.js`, `backend/src/utils/middleware-errores.js`

**Descripción:**  
El `catch` de `PUT /api/preferencias` devuelve `Error interno al guardar: ${err.message}`. Esto puede revelar detalles internos de PostgreSQL, rutas, nombres de columnas o fallos de serialización. El middleware global ya tiene una política correcta de ocultar detalles en 500, pero este controlador la evita respondiendo manualmente.

**Evidencia:**
- `controlador-preferencias.js:398-403` responde al cliente con `err.message`.
- `middleware-errores.js:50-55` muestra una política más segura para 500.

**Recomendación:**  
No devolver `err.message` al cliente en errores 500. Loguear el detalle en servidor y responder un mensaje genérico.

**Plan de implementación:**
1. En `controlador-preferencias.js`, cambiar la respuesta por `error: "Error interno al guardar preferencias."`.
2. Mantener `console.error` con detalle interno solo del lado servidor.
3. Preferentemente quitar el try/catch manual y delegar al middleware global con `throw err` o `next(err)`.
4. Agregar test que simule error del modelo y verifique que no se filtra el mensaje real.

**Cómo verificar:**
- Forzar error del modelo y verificar que el response body no contiene nombres de tabla, columna, path ni stack trace.
- Los logs del servidor sí deben tener el detalle para depuración.

---

## [H006] Multer devuelve errores de tipo de archivo como 500 genérico

**Severidad:** 🟡 MEDIO  
**Categoría:** Backend / UX / Seguridad  
**Archivos afectados:** `backend/src/rutas/preferencias.js`, `backend/src/utils/middleware-errores.js`

**Descripción:**  
El filtro de Multer rechaza archivos que no son `.md` con `new Error(...)`, pero no asigna `statusCode`. El middleware global usa 500 por defecto. Resultado: un error de validación del usuario puede verse como error interno del servidor.

**Evidencia:**
- `rutas/preferencias.js:13-25` configura Multer y devuelve `new Error` sin status.
- `middleware-errores.js:48-55` usa 500 si el error no tiene `statusCode`.

**Recomendación:**  
Crear un error con `statusCode = 400` o agregar middleware específico para errores de Multer.

**Plan de implementación:**
1. En `rutas/preferencias.js`, crear `const error = new Error("Solo se permiten archivos Markdown (.md)"); error.statusCode = 400; return cb(error);`.
2. Manejar `MulterError` en `middleware-errores.js` para `LIMIT_FILE_SIZE` con 413 o 400.
3. Agregar tests para archivo `.pdf`, MIME inválido y archivo mayor a 1MB.

**Cómo verificar:**
- Subir `.pdf`: debe devolver 400 con mensaje claro.
- Subir archivo mayor a 1MB: debe devolver 413 o 400 controlado, no 500.

---

## [H007] No hay constraints CHECK en base de datos para estados y porcentajes

**Severidad:** 🟡 MEDIO  
**Categoría:** Base de datos / Integridad  
**Archivos afectados:** `backend/sql/crear-tablas.sql`, `backend/sql/migracion-002-postulacion-y-porcentaje.sql`, `backend/src/modelos/oferta.js`

**Descripción:**  
La API valida estados y porcentajes en varias rutas, pero la base permite valores inválidos porque las columnas son `VARCHAR`/`INTEGER` sin `CHECK`. Si un script, migración manual o bug escribe directo en BD, podrían aparecer estados fuera del dominio o `porcentaje_match` fuera de 0-100.

**Evidencia:**
- `crear-tablas.sql:37-50` define estados como `VARCHAR` sin checks.
- `crear-tablas.sql:45` define `porcentaje_match INTEGER` sin rango.
- `modelo/oferta.js:153-160` actualiza valores confiando en la capa de aplicación.

**Recomendación:**  
Agregar constraints de integridad en PostgreSQL para los dominios críticos.

**Plan de implementación:**
1. Crear migración nueva, por ejemplo `migracion-013-constraints-integridad.sql`.
2. Agregar `CHECK (estado_evaluacion IN ('pendiente', 'aprobada', 'rechazada'))`.
3. Agregar `CHECK (estado_postulacion IN ('no_postulado', 'cv_enviado', 'en_proceso', 'descartada'))`.
4. Agregar `CHECK (porcentaje_match IS NULL OR porcentaje_match BETWEEN 0 AND 100)` y `CHECK (score_previo IS NULL OR score_previo BETWEEN 0 AND 100)`.
5. Antes de aplicar, correr queries de limpieza para detectar datos existentes inválidos.

**Cómo verificar:**
- Intentar insertar/updatear un estado inválido debe fallar en PostgreSQL.
- Tests de modelo deben seguir pasando con valores válidos.

---

## [H008] Sistema de migraciones manual, con numeración duplicada y sin rollback

**Severidad:** 🟠 ALTO  
**Categoría:** Base de datos / DevOps  
**Archivos afectados:** `backend/sql/*.sql`, `docs/deploy.md`

**Descripción:**  
Las migraciones son scripts SQL manuales. Hay numeración duplicada (`migracion-008-*`, `migracion-009-*`, `migracion-010-*`) y no existe tabla de control de migraciones ni rollback. Para un proyecto personal es entendible, pero ya hay 15+ scripts y producción en Railway: el riesgo de aplicar fuera de orden o repetir cambios crece.

**Evidencia:**
- Archivos reales: `migracion-008-error-evaluacion.sql` y `migracion-008-preferencias-detalladas.sql`; `migracion-009-*` duplicado; `migracion-010-*` duplicado.
- La documentación de SQL indica ejecución manual con `psql`.

**Recomendación:**  
Adoptar una herramienta liviana de migraciones o, como mínimo, una tabla `schema_migrations` y un runner Node.js.

**Plan de implementación:**
1. Renombrar futuras migraciones con timestamp o número único: `20260527_001_constraints_integridad.sql`.
2. Crear tabla `schema_migrations(id text primary key, applied_at timestamp default now())`.
3. Crear `backend/scripts/migrar.js` que aplique scripts pendientes en orden dentro de transacción cuando sea posible.
4. Separar migraciones no transaccionales si alguna lo requiere.
5. Documentar comando único: `npm run db:migrate`.

**Cómo verificar:**
- En una DB vacía, correr migraciones una vez debe crear todo.
- Correr migraciones segunda vez debe decir “0 pendientes”.
- La tabla `schema_migrations` debe reflejar los scripts aplicados.

---

## [H009] La persistencia de lotes de evaluación está incompleta: se escribe pero no se usa para rehidratar

**Severidad:** 🟡 MEDIO  
**Categoría:** Backend / Arquitectura  
**Archivos afectados:** `backend/src/servicios/servicio-evaluacion.js`, `backend/src/modelos/evaluacion-lote.js`, `backend/sql/migracion-010-lotes-evaluacion.sql`

**Descripción:**  
El servicio crea y actualiza `evaluacion_lotes`, pero `obtenerProgresoEvaluacion()` devuelve solo el objeto en memoria. Si el proceso se reinicia, el frontend no puede recuperar el último lote desde BD, aunque la migración dice que ese era el objetivo.

**Evidencia:**
- `servicio-evaluacion.js:49-50` devuelve copia del progreso en memoria.
- `servicio-evaluacion.js:665-668` crea lote persistente.
- `evaluacion-lote.js:18-70` solo crea/actualiza/finaliza; no tiene función de lectura.

**Recomendación:**  
Agregar lectura del último lote activo/finalizado en `evaluacion-lote.js` y usarlo cuando no haya progreso activo en memoria.

**Plan de implementación:**
1. Agregar `obtenerUltimoLote()` y `obtenerLoteActivo()` en `backend/src/modelos/evaluacion-lote.js`.
2. Cambiar `obtenerProgresoEvaluacion()` para que pueda ser async o crear controlador async que combine memoria + BD.
3. Si hay lote `activo` antiguo tras reinicio, marcarlo `interrumpido` o mostrar estado “interrumpido por reinicio”.
4. Agregar tests de rehidratación simulando memoria vacía y lote activo en BD.

**Cómo verificar:**
- Crear lote activo manualmente, reiniciar proceso y consultar `/api/evaluacion/progreso`: debe informar último estado o interrumpido.
- La UI debe mostrar mensaje claro si la evaluación quedó a medias.

---

## [H010] Control de concurrencia de evaluación/automatización depende de memoria del proceso

**Severidad:** 🟡 MEDIO  
**Categoría:** Arquitectura / Backend  
**Archivos afectados:** `backend/src/servicios/servicio-evaluacion.js`, `backend/src/controladores/controlador-evaluacion.js`, `backend/src/servicios/servicio-automatizacion.js`

**Descripción:**  
El bloqueo de evaluación en curso usa variables `let` en memoria. En una sola instancia de Railway está bien, pero si hay reinicio, deploy, scaling horizontal o dos procesos, podrían ejecutarse evaluaciones/ciclos simultáneos y duplicar costo de APIs.

**Evidencia:**
- `servicio-evaluacion.js:32-43` define progreso y cancelación en memoria.
- `controlador-evaluacion.js:18-24` decide 409 mirando ese objeto en memoria.
- `servicio-evaluacion.js:633-645` reinicia el estado local al comenzar.

**Recomendación:**  
Usar lock persistente en PostgreSQL para operaciones caras: advisory lock o tabla de locks.

**Plan de implementación:**
1. En `evaluarOfertasPendientes`, tomar `pg_try_advisory_lock(hashtext('evaluacion_ofertas'))` antes de iniciar.
2. Liberar lock en `finally`.
3. Para automatización, usar otro lock `ciclo_completo`.
4. Si no obtiene lock, responder 409 con mensaje “ya hay un proceso en curso”.
5. Agregar test/integración para doble inicio concurrente.

**Cómo verificar:**
- Disparar dos `POST /api/evaluacion/ejecutar` casi simultáneos: uno debe iniciar y el otro devolver 409.
- Simular dos procesos si es posible o testear lock con dos conexiones PG.

---

## [H011] Scraping acepta parámetros externos sin validación fuerte

**Severidad:** 🟡 MEDIO  
**Categoría:** Backend / Validación  
**Archivos afectados:** `backend/src/controladores/controlador-scraping.js`

**Descripción:**  
Los endpoints de scraping calculan `maxResultados` con `Math.min(parseInt(...) || default, max)`, pero no aplican mínimo ni validan `terminos`/`ubicacion`. Un valor negativo puede pasar como `maxResultados`; arrays enormes o términos larguísimos pueden provocar requests innecesarios o errores aguas abajo. El body de 1MB limita el daño, pero falta validación de dominio.

**Evidencia:**
- `controlador-scraping.js:25-31`, `65-70`, `103-108`, `371-376`, `425-430`, `490-495` muestran el patrón actual.

**Recomendación:**  
Centralizar validación de opciones de scraping con mínimos, máximos y límites de longitud.

**Plan de implementación:**
1. Crear helper `validarOpcionesScraping(req.body, { defaultMax, maxPermitido })`.
2. Normalizar `maxResultados` con `Math.max(1, Math.min(valor, maxPermitido))` y rechazar si no es entero.
3. Validar `terminos`: array opcional, máximo 20 elementos, strings 1-80 caracteres.
4. Validar `ubicacion`: string opcional, máximo 80 caracteres.
5. Agregar tests para negativo, string inválido, array gigante y término vacío.

**Cómo verificar:**
- `maxResultados=-5` debe responder 400 o normalizar a 1 explícitamente.
- `terminos` con 1000 items debe responder 400.

---

## [H012] Listado de ofertas y evaluación pendiente no tienen paginación/límites

**Severidad:** 🟡 MEDIO  
**Categoría:** Performance / Backend / Frontend  
**Archivos afectados:** `backend/src/controladores/controlador-ofertas.js`, `backend/src/modelos/oferta.js`, `frontend/src/app/paginas/dashboard/dashboard.ts`

**Descripción:**  
`GET /api/ofertas` devuelve todas las ofertas y el dashboard las carga completas. Además, `obtenerOfertasPendientes()` trae todas las pendientes antes de evaluar. Hoy puede funcionar, pero con scraping semanal y varias plataformas la tabla crecerá y el payload/localStorage/evaluación se volverán pesados.

**Evidencia:**
- `controlador-ofertas.js:38-43` responde todo lo que devuelve el modelo.
- `modelo/oferta.js:106-108` hace `SELECT * FROM ofertas` sin `LIMIT`.
- `modelo/oferta.js:134-137` trae todas las pendientes.
- `dashboard.ts:137-160` carga todas las ofertas en una sola llamada.

**Recomendación:**  
Agregar paginación backend y procesamiento por lotes para evaluación.

**Plan de implementación:**
1. Agregar query params `limit` y `offset` o cursor a `GET /api/ofertas`.
2. Limitar `limit` a 100 o 200.
3. Modificar dashboard para pedir páginas o mantener “cargar más”.
4. Cambiar evaluación para procesar pendientes en lotes (`LIMIT 50`) y actualizar lote por tanda.
5. Agregar índices compuestos según filtros reales: por ejemplo `(estado_evaluacion, fecha_extraccion DESC)`.

**Cómo verificar:**
- Con 1000 ofertas, `GET /api/ofertas?limit=100` debe devolver solo 100.
- Dashboard debe seguir filtrando por tab sin congelarse.
- Evaluación debe poder procesar lotes sin cargar todo en memoria.

---

## [H013] Acción masiva no limita cantidad de IDs

**Severidad:** 🟡 MEDIO  
**Categoría:** Backend / UX / Performance  
**Archivos afectados:** `backend/src/controladores/controlador-ofertas.js`, `backend/src/modelos/oferta.js`, `frontend/src/app/componentes/tabla-ofertas/tabla-ofertas.ts`

**Descripción:**  
El endpoint bulk valida que `ids` sea un array no vacío de enteros positivos, pero no limita la cantidad. Con el límite de body de 1MB el impacto es acotado, pero se puede enviar una operación masiva muy grande por error.

**Evidencia:**
- `controlador-ofertas.js:168-181` valida array no vacío pero no máximo.
- `modelo/oferta.js:231-237` ejecuta `WHERE id = ANY($2::int[])`.
- `tabla-ofertas.ts:271-276` emite todos los IDs seleccionados.

**Recomendación:**  
Definir un máximo razonable por operación, por ejemplo 200 IDs, y reflejarlo en UI.

**Plan de implementación:**
1. En `actualizarPostulacionMasiva`, rechazar `ids.length > 200` con 400.
2. En `TablaOfertas`, impedir seleccionar/aplicar más de 200 o mostrar confirmación.
3. Agregar test del controlador con 201 IDs.
4. Opcional: devolver cantidad pedida y cantidad realmente actualizada para detectar IDs inexistentes.

**Cómo verificar:**
- PATCH con 201 IDs debe responder 400.
- PATCH con IDs válidos debe devolver `actualizadas` coherente.

---

## [H014] Cache de dashboard en localStorage no tiene TTL ni versión de esquema

**Severidad:** 🟡 MEDIO  
**Categoría:** Frontend / UX / Datos  
**Archivos afectados:** `frontend/src/app/servicios/persistencia-dashboard.service.ts`, `frontend/src/app/paginas/dashboard/dashboard.ts`

**Descripción:**  
El cache local mejora la UX si falla el backend, pero no expira y no tiene versión. Si cambia la forma de `Oferta`, filtros o lógica de tabs, se pueden mostrar datos viejos o incompatibles durante mucho tiempo.

**Evidencia:**
- `persistencia-dashboard.service.ts:13-33` guarda cache sin versión/TTL.
- `persistencia-dashboard.service.ts:36-61` valida forma mínima, no antigüedad.
- `dashboard.ts:241-253` restaura cache si existe.

**Recomendación:**  
Agregar `version` y TTL al cache; por ejemplo, expirar a las 24/48 horas.

**Plan de implementación:**
1. Modificar interface `CacheDashboard` agregando `version: 1`.
2. En `guardarCache`, guardar versión y fecha.
3. En `leerCache`, rechazar si versión no coincide o si `fechaGuardado` supera TTL.
4. Agregar tests para cache vencido y versión vieja.
5. Mostrar mensaje “cache vencido” si no se usa por antigüedad.

**Cómo verificar:**
- Cache con fecha de hace 7 días debe ignorarse.
- Cache con versión vieja debe limpiarse.

---

## [H015] Merge durante polling puede preservar estados locales ya revertidos o desactualizados

**Severidad:** 🟡 MEDIO  
**Categoría:** Frontend / Consistencia de datos  
**Archivos afectados:** `frontend/src/app/paginas/dashboard/dashboard.ts`, `frontend/src/app/componentes/tabla-ofertas/tabla-ofertas.ts`, `frontend/src/app/componentes/detalle-oferta/detalle-oferta.ts`

**Descripción:**  
Durante el polling de evaluación, el dashboard preserva el `estado_postulacion` local si difiere del backend para no pisar optimistic updates. Es una buena intención, pero no hay un registro de “actualizaciones pendientes”. Cualquier divergencia local/backend se preserva aunque ya no haya request pendiente.

**Evidencia:**
- `dashboard.ts:178-184` preserva local ante cualquier diferencia.
- `tabla-ofertas.ts:218-240` hace optimistic update y revierte/confirmar.
- `detalle-oferta.ts:121-143` repite patrón similar.

**Recomendación:**  
Trackear IDs con actualización optimista pendiente y preservar solo esos. Cuando la request confirma o revierte, quitar el ID del set.

**Plan de implementación:**
1. Crear signal/set `postulacionesPendientes` en dashboard o un servicio de estado.
2. Cuando `TablaOfertas` o `DetalleOferta` inician optimistic update, emitir `{id, pendiente: true}`.
3. Al confirmar/error, emitir `{id, pendiente: false}`.
4. En el merge de `onProgresoEvaluacion`, preservar local solo si el ID está pendiente.
5. Agregar test de merge: diferencia no pendiente debe aceptar backend.

**Cómo verificar:**
- Simular backend con estado diferente y sin pending: la UI debe adoptar backend.
- Simular pending real: la UI debe preservar local hasta confirmación.

---

## [H016] Timeout de foco del modal no se cancela al destruir/cerrar

**Severidad:** 🟢 BAJO  
**Categoría:** Frontend / Accesibilidad / Mantenibilidad  
**Archivos afectados:** `frontend/src/app/componentes/detalle-oferta/detalle-oferta.ts`

**Descripción:**  
El modal usa `setTimeout(() => this.moverFocoAlModal(), 100)` dentro de un `effect`. Si el componente se destruye/cierra rápido, el callback puede ejecutarse tarde. El impacto es bajo, pero puede causar foco inesperado o errores difíciles de reproducir.

**Evidencia:**
- `detalle-oferta.ts:44-51` agenda `setTimeout` sin cleanup.
- `detalle-oferta.ts` no implementa `OnDestroy`.

**Recomendación:**  
Guardar el ID del timeout y limpiarlo al cerrar/destruir. Alternativamente, usar APIs del dialog de PrimeNG si ofrecen callback post-render.

**Plan de implementación:**
1. Implementar `OnDestroy` en `DetalleOferta`.
2. Guardar `private focoTimeoutId: ReturnType<typeof setTimeout> | null`.
3. Antes de crear un nuevo timeout, limpiar el anterior.
4. En `ngOnDestroy`, limpiar timeout.
5. Agregar test de apertura/cierre rápido.

**Cómo verificar:**
- Abrir y cerrar modal rápidamente no debe mover foco luego del cierre.
- Tests de accesibilidad existentes deben seguir pasando.

---

## [H017] Servicios y componentes grandes concentran demasiada responsabilidad

**Severidad:** 🟡 MEDIO  
**Categoría:** Arquitectura / Mantenibilidad  
**Archivos afectados:** `backend/src/servicios/servicio-normalizacion.js`, `backend/src/servicios/servicio-scraping.js`, `backend/src/servicios/servicio-evaluacion.js`, `frontend/src/app/componentes/panel-control/panel-control.ts`, `frontend/src/app/paginas/preferencias/preferencias.ts`

**Descripción:**  
Hay archivos muy grandes: normalización ~1295 líneas, scraping ~1254, evaluación ~796, PanelControl ~846, Preferencias ~788. No es un bug funcional, pero dificulta revisar, testear y modificar sin regresiones. Para aprendizaje está bien haberlo construido así; para sostenerlo conviene dividir por plataforma/dominio.

**Evidencia:**
- Métricas del código fuente: `servicio-normalizacion.js` 1295 líneas, `servicio-scraping.js` 1254, `servicio-evaluacion.js` 796, `panel-control.ts` 846, `preferencias.ts` 788.

**Recomendación:**  
Refactor incremental sin reescritura: extraer módulos por plataforma y subcomponentes por tab.

**Plan de implementación:**
1. Backend: dividir `servicio-scraping.js` en `scrapers/linkedin.js`, `scrapers/computrabajo.js`, etc.
2. Backend: dividir `servicio-normalizacion.js` en `normalizadores/<plataforma>.js` + índice.
3. Frontend: dividir `PanelControl` en `ScrapingPanel`, `EvaluacionPanel`, `CronPanel`.
4. Frontend: dividir `Preferencias` por tabs o componentes standalone.
5. Mover validadores de preferencias a un módulo compartido testeable.

**Cómo verificar:**
- Los tests actuales deben seguir pasando después de cada extracción.
- Ningún archivo crítico debería superar ~400-500 líneas salvo casos justificados.

---

## [H018] Faltan tests en Dashboard, servicios HTTP frontend, scoring previo y modelos nuevos

**Severidad:** 🟡 MEDIO  
**Categoría:** Testing  
**Archivos afectados:** `frontend/src/app/paginas/dashboard/dashboard.ts`, `frontend/src/app/servicios/*.ts`, `backend/src/servicios/servicio-scoring-previo.js`, `backend/src/modelos/evaluacion-cache.js`, `backend/src/modelos/evaluacion-lote.js`

**Descripción:**  
Hay una base de tests buena, especialmente en servicios backend y componentes críticos, pero faltan piezas importantes: Dashboard no tiene `.spec.ts`; la mayoría de servicios HTTP Angular no tienen tests con `HttpTestingController`; `servicio-scoring-previo.js`, cache y lotes no tienen tests dedicados.

**Evidencia:**
- Archivos de test existentes no incluyen `dashboard.spec.ts` ni specs para servicios HTTP salvo `persistencia-dashboard.service.spec.ts`.
- Existe `servicio-scoring-previo.js` pero no `servicio-scoring-previo.test.js` en el árbol extraído.

**Recomendación:**  
Priorizar tests de lógica crítica y de contratos HTTP antes de agregar features nuevas.

**Plan de implementación:**
1. Crear `dashboard.spec.ts` cubriendo carga backend, fallback cache, modo demo, merge durante polling y acción masiva.
2. Crear specs de `OfertasService`, `ScrapingService`, `EvaluacionService`, `AutomatizacionService`, `PreferenciasService` con `HttpTestingController`.
3. Crear `servicio-scoring-previo.test.js` con matriz de tecnologías, exclusiones, seniority, inglés, años de experiencia.
4. Crear tests de `evaluacion-cache.js` para hash estable/cambio de preferencias.
5. Crear tests de `evaluacion-lote.js` para crear/actualizar/finalizar y lectura si se implementa H009.

**Cómo verificar:**
- `npm test` backend debe incluir scoring/cache/lotes.
- `ng test --watch=false --browsers=ChromeHeadless` debe incluir servicios HTTP y Dashboard.

---

## [H019] No hay pipeline CI/CD versionado para correr tests y checks antes de deploy

**Severidad:** 🟡 MEDIO  
**Categoría:** DevOps / Calidad  
**Archivos afectados:** `.github/workflows/*`, `backend/package.json`, `frontend/package.json`

**Descripción:**  
No encontré workflows de GitHub Actions u otro CI versionado. Railway/Vercel pueden deployar, pero falta una barrera automática que corra tests, syntax checks y build antes de integrar cambios.

**Evidencia:**
- No existe `.github/workflows` en el ZIP extraído.
- `backend/package.json` y `frontend/package.json` ya tienen scripts aprovechables.

**Recomendación:**  
Agregar un workflow mínimo para backend y frontend.

**Plan de implementación:**
1. Crear `.github/workflows/ci.yml`.
2. Job backend: `npm ci`, `npm test`.
3. Job frontend: `npm ci`, `npm run build`, `npm test -- --watch=false --browsers=ChromeHeadless` si el entorno lo permite.
4. Agregar `node --check` para backend si querés feedback rápido.
5. Opcional: artifact de coverage.

**Cómo verificar:**
- Abrir PR o push: el workflow debe correr y bloquear si falla build/test.
- Simular test roto para confirmar que CI falla.

---

## [H020] Drift de configuración IA: `.env.example` documenta OpenCode Go pero el código usa DeepSeek directo

**Severidad:** 🟢 BAJO  
**Categoría:** Documentación / Configuración  
**Archivos afectados:** `backend/.env.example`, `backend/src/config/deepseek.js`, `docs/evaluacion-ia.md`

**Descripción:**  
El `.env.example` incluye `OPENCODE_GO_API_KEY` como sección de IA, pero `backend/src/config/deepseek.js` usa `DEEPSEEK_API_KEY` y endpoint directo de DeepSeek. Esto no rompe si el `.env` real tiene ambas, pero confunde al instalar o auditar.

**Evidencia:**
- `.env.example:29-33` documenta OpenCode Go.
- `deepseek.js:18-28` usa URL y API key de DeepSeek directo.
- `docs/evaluacion-ia.md:7-10` habla de `DEEPSEEK_API_KEY`.

**Recomendación:**  
Unificar la documentación y variables reales. Si OpenCode Go ya no se usa, sacarlo del `.env.example`; si se quiere soportar, implementar selector de proveedor.

**Plan de implementación:**
1. Editar `.env.example`: reemplazar sección OpenCode Go por DeepSeek o agregar ambas con explicación clara.
2. Alinear `docs/evaluacion-ia.md` y `docs/deploy.md`.
3. Agregar validación de arranque que indique exactamente qué variable falta según proveedor.
4. Opcional: `IA_PROVIDER=deepseek|opencode_go` si querés flexibilidad real.

**Cómo verificar:**
- Instalación desde cero con `.env.example` debe dejar claro qué variable completar.
- Buscar `OPENCODE_GO_API_KEY` y `DEEPSEEK_API_KEY`: no deben contradecirse.

---

## [H021] Logs de backend son abundantes y pueden exponer metadatos operativos

**Severidad:** 🟢 BAJO  
**Categoría:** Observabilidad / Seguridad  
**Archivos afectados:** `backend/src/config/base-datos.js`, `backend/src/**/*.js`

**Descripción:**  
El proyecto usa muchos `console.log/warn/error` — detecté alrededor de 159 usos. Para desarrollo está perfecto, pero en producción conviene estructurar logs, controlar nivel y evitar metadatos de conexión o datos personales innecesarios.

**Evidencia:**
- `base-datos.js:123-128` loguea configuración detectada al conectar.
- Análisis estático encontró aproximadamente 159 usos de `console.*` en `backend/src` y `frontend/src`.

**Recomendación:**  
Centralizar logging con niveles y redacción de datos sensibles.

**Plan de implementación:**
1. Crear `backend/src/utils/logger.js` con niveles `debug/info/warn/error` según `LOG_LEVEL`.
2. Reemplazar logs de conexión por mensajes sin host/usuario si `NODE_ENV=production`.
3. Redactar URLs, tokens, emails y connection strings.
4. Agregar correlación simple por request si hace falta.
5. Documentar qué se loguea en producción.

**Cómo verificar:**
- Con `LOG_LEVEL=warn`, no deben salir logs informativos de scraping o conexión.
- Buscar en logs producción que no aparezcan connection strings ni emails completos.

---


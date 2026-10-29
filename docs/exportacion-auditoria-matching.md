# Exportación privada para auditar matching (#69)

Adapto `backend/tests/scripts/exportar-ofertas.js` para exportar las ofertas almacenadas completas, sin pasar por el dashboard ni modificar decisiones, porcentajes, prompts o reglas. **No exporté producción.** La muestra local es sintética; no prueba la corrección del evaluador ni el esquema de una base productiva.

## Archivos para adjuntar, después de una revisión local

La salida queda exclusivamente en `.qa-runtime/issue69/NOMBRE_NUEVO/`, excluida de Git:

| Archivo | Contenido |
| --- | --- |
| `busco-trabajo-auditoria-matching.jsonl` | Una oferta por línea, UTF-8, sin truncar descripciones. |
| `busco-trabajo-criterios-sanitizados.json` | Resumen allowlisted de criterios actuales, no del CV completo. |
| `resumen.json` | Marca de finalización, reconciliación SQL, agrupaciones y límites. |

Solo considero válida una entrega cuando `resumen.json` existe, `completo` es `true` y `total_sql` coincide con `total_exportado`. Los directorios nuevos son privados (`0700`), los archivos son `0600` y la creación es exclusiva: **no sobrescribo ni reanudo una salida existente**. Ante un fallo pueden quedar archivos privados parciales sin resumen; no deben adjuntarse ni reutilizarse. Uso otro nombre para el siguiente intento. No hay limpieza destructiva automática.

No publico estos archivos como adjuntos de issue/PR, logs, caché de CI ni artefactos públicos. `.gitignore` evita su agregado habitual, no protege frente a un agregado forzado o una carga manual de artefactos.

## Procedimiento autorizado, exclusivamente manual

1. Solicito autorización explícita sobre **servidor/IP o socket, puerto, base y usuario**. Prefiero un rol lector ya existente, con permisos SELECT sobre `ofertas` y `preferencias`; este procedimiento no crea roles ni cambia configuración. No uso automáticamente el destino del backend.
2. Confirmo con el responsable la identidad esperada. Para TCP uso una IP literal, no un hostname: comparo `inet_server_addr()` y `inet_server_port()` con los valores esperados. Un proxy/NAT con puerto distinto puede ser rechazado. Para Unix uso el directorio de socket autorizado, verifico dirección SQL nula y puerto configurado; esto identifica el punto local de conexión, no certifica criptográficamente un clúster remoto.
3. Si necesito contraseña, la ingreso con lectura oculta en mi terminal, sin incluirla en comandos, archivos o historial. No cargo `.env`, URLs de conexión ni configuración privada del proyecto. Por ejemplo, en Bash: `read -rs -p 'Contraseña del rol lector: ' PGPASSWORD; export PGPASSWORD; printf '\n'`. Si corresponde, el operador prepara TLS verificado en su entorno; no desactivo validación TLS. No utilizo archivos de credenciales implícitos: el cliente recibe contraseña explícita o cadena vacía.
4. Desde la raíz del worktree ejecuto el siguiente **modelo**, reemplazando únicamente identificadores de destino ya autorizados (la IP de documentación no es un destino real):

   ```bash
   env -u DATABASE_URL -u PGHOST -u PGPORT -u PGUSER -u PGDATABASE \
       NODE_ENV=test node backend/tests/scripts/exportar-ofertas.js \
       --autorizar --servidor 192.0.2.10 --puerto 5432 \
       --base BASE_AUTORIZADA --usuario ROL_LECTOR --salida auditoria-autorizada-01
   ```

5. Retiro la contraseña del entorno con `unset PGPASSWORD`. Verifico localmente el resumen y reviso todos los textos antes de adjuntar los tres archivos. No los imprimo en consola ni los publico en GitHub.

La ayuda pasiva está en `node backend/tests/scripts/exportar-ofertas.js --help`. Opciones públicas: `--autorizar`, `--servidor`, `--puerto`, `--base`, `--usuario`, `--salida`, `--sintetico` y `--help`. Todas las opciones de destino y el nombre nuevo de salida son obligatorios; `--sintetico` solo etiqueta el origen declarado, no inventa fixtures ni cambia la consulta. Rechazo opciones desconocidas, duplicadas y nombres de salida que permitan escapar del directorio dedicado.

Sin opt-in/destino válido rechazo antes de cargar `pg` o abrir conexión. Los mensajes de error son fijos, sin valores privados ni errores del driver:

- `Exportación rechazada: autorización o destino inválido.`
- `No pude completar la exportación. No comparta una salida sin resumen completo.`

Ambos terminan con código 1. La finalización válida informa únicamente `Exportación completa; revise los archivos privados antes de compartir.` y termina con código 0.

## Qué leo y qué no modifico

| Paso | SQL / garantía |
| --- | --- |
| Conectar | `default_transaction_read_only=on`, timeout SQL 120 s, lock timeout 5 s y conexión 10 s, enviados como opciones de arranque; el llamador no puede sobrescribirlos con `options` ni `connectionString`. No ejecuto SET, BEGIN, migraciones ni DDL/DML. |
| Verificar | SELECT de base/usuario, dirección/puerto y flags `default_transaction_read_only` y `transaction_read_only`; exijo ambos `on` antes de leer preferencias u ofertas. |
| Criterios | `SELECT to_jsonb(p) AS preferencias FROM preferencias p WHERE id = 1`; lectura sin creación por defecto. La salida usa el helper puro de perfil y una allowlist separada. No importo el modelo, el servicio CV ni configuración de aplicación. |
| Columnas | Un SELECT acotado a `pg_catalog.pg_attribute` y `to_regclass('ofertas')` identifica columnas de la relación resuelta por PostgreSQL. Solo uso los nombres constantes de la allowlist al construir la proyección; una columna ausente se proyecta como `NULL AS campo` y se informa, incluso sin filas. No selecciono `datos_crudos`. |
| Ofertas | Un SELECT con CTE materializado de los veintiún campos, `count(*)` y LEFT JOIN: el conteo y las filas pertenecen al mismo snapshot. Cero ofertas también produce conteo verificable. Ordeno por ID sin filtros de estado, fecha, postulación, vigencia o dashboard y sin LIMIT. |
| Escribir | Consumo eventos de filas y escribo JSONL progresivamente; no acumulo todo el dataset en memoria Node. PostgreSQL puede materializar/ordenar el conjunto. El resumen se emite al final y solo si reconcilié el conteo SQL. |

Cierro el cliente en `finally`, incluso si falla la conexión. No inicio scraping, API de IA, cron ni servidor de aplicación. El modo read-only no sustituye los permisos mínimos del rol ni protege contra funciones maliciosas del servidor: uso relaciones de aplicación confiables y SELECT sin funciones de escritura.

## Campos exactos de cada oferta

Conservo, cuando existen; lo ausente queda `null`:

```text
id, titulo, empresa, ubicacion, modalidad, descripcion, url, plataforma,
nivel_requerido, estado_evaluacion, porcentaje_match, razon_evaluacion,
explicacion_evaluacion, evaluacion_error_mensaje, fecha_evaluacion,
firma_criterios_evaluacion, fecha_publicacion, fecha_extraccion,
fecha_ultima_extraccion, origen_descripcion, descripcion_completitud
```

`fecha_extraccion` conserva la extracción inicial; `fecha_ultima_extraccion` conserva la última observación registrada. La migración 023 incorporó esta última y realizó backfill con la primera: no invento una observación posterior cuando ambas coinciden. Si la columna falta en el esquema, exporto null y lo informo; no uso fallback silencioso.

Agrego `vigencia_evaluacion`, `autoria_evaluacion` y `precision_fecha_evaluacion` como marcas de incertidumbre, sin cambiar el estado o el porcentaje guardados. Conservo porcentajes numéricos, cadenas numéricas inconsistentes y null, sin clamp ni nuevo veredicto.

La explicación conserva solo `cumplidos`, `no_cumplidos`, `por_confirmar` y `exclusiones`. Cada ítem conserva únicamente `requisito`, `tipo`, `evidencia_oferta`, `evidencia_perfil` y `explicacion`, todos como texto sanitizado o null. Descarto claves arbitrarias, objetos internos anidados y `reasoning_content` incluso dentro de un requisito.

El resumen incluye `version_esquema_exportacion = auditoria-matching-v1` (versión del formato exportado, no de migraciones de la base), `exportado_en` en ISO UTC y `campos_ausentes` (columnas no disponibles, distinto de valores null almacenados). La inspección de columnas y la lectura ocurren en SELECT separados: cambios concurrentes de esquema pueden hacer fallar la exportación, nunca autorizan migraciones ni una salida marcada completa con conteo incorrecto.

El resumen agrupa estados `aprobada`, `rechazada`, `pendiente` y `otros`, sin perder los valores desconocidos de las filas. Cuenta errores técnicos por separado del estado conservado; `REEVALUACION_SOLICITADA` se cuenta aparte, no como fallo del proveedor. También incluye los contadores de vigencia `actual`, `anterior` y `desconocida`. El total no representa el último ciclo de 182 decisiones.

## Perfil actual y límites históricos

El resumen separado conserva roles objetivo (`rol`, `prioridad`, `aliases`), tecnologías detalladas (`nombre`, `nivel`), stack legacy sin nivel, experiencia (nivel/años), modalidades, zonas, idiomas (`espanol`, `reading`, `writing`, `speaking`, `listening`, `regla` y fallback legacy) y exclusiones obligatorias/adicionales. Omito las evidencias narrativas del perfil, nombre, CV, perfil profesional completo, notas, fechas y estados personales de postulación. Las tecnologías persistidas no son una certificación nueva de experiencia: respeto el límite de confirmación histórica documentado en evaluación.

**No exporto `prompt_personalizado`, ni siquiera sanitizado.** `criterios_adicionales_ia` informa solamente `activos` y `detalle = omitido_privacidad_no_reconstruible`. Marco `instrucciones_efectivas_completas = false`: el resumen estructurado no es el prompt efectivo completo. Los criterios personalizados activos pueden cambiar las instrucciones y sus detalles permanecen desconocidos para el auditor; no los deduzco de las preferencias estructuradas.

Incluyo la política incorporada de prioridad IA, separada del match, basada en el módulo puro `detector-prioridad-ia.js`, versión `prioridad-ia-v1`: Claude Code, Codex, OpenCode, GitHub Copilot, ChatGPT, IA/AI generativa, LLM, prompt engineering y Next.js. Ignoro menciones negadas; son dos puntos por categoría, máximo seis y hasta tres evidencias. Informo si está activo el orden priorizado y su máximo configurado. No es un bonus fijo al porcentaje ni una habilidad acreditada y nunca compensa exclusiones. No cambio ni ejecuto el evaluador.

**Limitación de vigencia:** en este alcance dejo `firma_actual: null` y todas las filas con vigencia `desconocida`. El helper canónico de firma importa `config/deepseek.js`, que carga dotenv al importar. No lo ejecuto ni duplico su algoritmo, y no firmo un resumen sanitizado como si fuera el perfil efectivo completo. Por eso tampoco llamo «anterior» a una firma diferente de una firma actual no comprobada. Para distinguir actual/anterior correctamente hace falta separar ese helper de la carga de entorno en un alcance posterior autorizado. Conservo la firma almacenada intacta si es SHA-256 canónica.

La tabla conserva solo el resultado más reciente por oferta, no un ledger de todas sus decisiones. No recupero evaluaciones reemplazadas, borradas o reseteadas, ni invierto un hash para reconstruir preferencias anteriores. Las preferencias actuales son una lectura separada, no un snapshot histórico asociado a cada evaluación.

La migración 005 rellenó `fecha_evaluacion` con `fecha_extraccion` sin dejar una marca por fila. Exporto la fecha almacenada con `precision_fecha_evaluacion = no_verificable_puede_incluir_backfill` (o `ausente`), nunca como timestamp original preciso.

La autoría IA/regla determinística no está persistida de forma fiable en estos campos: `autoria_evaluacion = no_persistida`. Una razón o una exclusión no prueban autoría. El auditor puede señalar falsos positivos/negativos candidatos, comparar requisitos y score y proponer gravedad/confianza y regresiones; debe mantener ambiguos como ambiguos. No puede atribuir cada fallo a DeepSeek sin evidencia adicional.

## Sanitización y riesgo residual (item 2)

Aplico allowlists y sanitización a todos los textos exportados, incluidos empresa, razón, error y evidencias estructuradas. Quito correos, teléfonos y secretos etiquetados (`token`, claves API, autorización, cookies, contraseña/Bearer). Quito el valor del secreto, no el resto de la línea: `token: SECRETO; Java obligatorio, Senior 5+ años` conserva las exclusiones. Preservo ID, firma hexadecimal y score numérico/inconsistente sin confundirlos con teléfonos. Redacto coincidencias del nombre completo conocido del propietario (al menos dos palabras y seis caracteres, sin distinguir mayúsculas, con límites Unicode) después de aplicar las allowlists; no exporto ni imprimo ese nombre. Las URLs aceptadas son HTTP(S) con hostname público aparente: retiro userinfo, tracking, parámetros sensibles y fragmento; preservo identificadores numéricos en paths y la allowlist estrecha de `jk` para ofertas Indeed. Rechazo esquemas inseguros, IPs literales, nombres locales y rutas con señales de contacto/secretos. No preservo parámetros de proveedores desconocidos: los enlaces que dependan de ellos requieren revisión local. No resuelvo DNS ni certifico la accesibilidad pública de un host.

**No es un detector universal de datos personales.** Nombres propios, direcciones postales, teléfonos locales sin etiqueta ni prefijo internacional, enlaces personales de mensajería, secretos sin etiqueta, texto ofuscado o URLs que resuelvan a redes privadas pueden requerir revisión humana. No interpreto cualquier secuencia numérica como teléfono: eso destruiría requisitos técnicos. El riesgo item 2 sigue siendo la guarda de destino y la sanitización; antes de compartir una exportación real debo revisarla localmente, sin recortar requisitos técnicos ni asumir anonimización perfecta.

## Evidencia y reproducción sintética

La fixture versionada contiene solo datos inventados. Los doce escenarios verifican: aprobación justificada, rechazo justificado, posible falso positivo por exclusión, posible falso negativo, falta de explicación, score inconsistente, error técnico, descripción ausente/parcial, evaluación antigua, histórico invisible, Unicode/descripción extensa y ausencia de filtraciones de los valores privados sintéticos. La descripción extensa tiene 5000 repeticiones y se compara completa.

- RED inicial sin opt-in y cinco regresiones del primer lote correctivo; Verify después reprodujo B1 (Basic/cookies), B2 (ISO técnico) y B3 (URLs públicas). El Worker guardó evidencia de **13 fallos y 32 pases antes de corregir**, seguida de 45 pases; su cierre de proceso falló, no sus cambios preservados.
- Comprobación final inline sobre el código corregido: **45 pruebas focales aprobadas**; suite completa **85 suites aprobadas, 10 omitidas; 2814 pruebas aprobadas, 159 omitidas; cero fallos**. Las omitidas requieren flags/entornos de integración que no habilité. Las dependencias provienen del lockfile, instaladas en un directorio local ignorado sin modificar dependencias de otros worktrees.
- B1: retiro esquema y credenciales de Authorization y las cookies consecutivas completas, conservando requisitos tras separadores. B2: preservo exactamente `ISO 27001 (2022)`; mantengo redacción de teléfono internacional o con contexto explícito. B3: conservo IDs numéricos públicos de paths y `jk` hexadecimal de 16 caracteres únicamente en `/viewjob` de `indeed.com`, `www.indeed.com` y `ar.indeed.com`; no conservo tracking ni secretos.
- Diferencial del Worker en VM con pg/dotenv/FS simulados: preservación exacta de UTF-8, ISO, LinkedIn e Indeed; eliminación de los secretos solicitados en el quinto caso. Sin archivos de baseline, lectura de entorno ni conexiones.
- PostgreSQL **18 real efímero** sobre el código corregido: **12 filas SQL = 12 líneas exportadas, 12 escenarios comprobados**, incluyendo B1–B3 en la fixture; columna sintética `fecha_publicacion` ausente como null y reportada, cero filas y destino incorrecto rechazado. Contadores antes/después: **3 bases, 68 tablas de catálogo, 4 esquemas y 17 roles**, sin cambios. Solo SELECT de aplicación; flags read-only verificados sin intentar INSERT.
- SHA-256 del exportador verificado: `0291a26d47cafb8d80481e684c26ef03c17d0ca3c2a78cf8d94a5a8d9a972aae`.
- Muestra vigente **solo sintética**: `.qa-runtime/issue69/salida-sintetica-corregida/`; caso vacío: `salida-sintetica-corregida-vacia/`. Las muestras `salida-sintetica/` y `salida-sintetica-final/` quedan **obsoletas**, preservadas sin sobrescritura ni eliminación. No generé dataset productivo.
- Docker no estaba disponible al retomar. Usé los binarios locales identificados por `pg_config --bindir` para inicializar **otro clúster desechable**, exclusivamente dentro de `.qa-runtime/issue69/pg-local-data`, sin tocar instancias existentes. Arranqué sin TCP (`listen_addresses=''`), con socket relativo `../socket`, autenticación local trust solo en el clúster aislado y rechazo de conexiones host. El padre del socket está protegido con 0700. La inicialización creó únicamente sus catálogos/configuración inicial propia; no ejecuté migraciones, DDL/DML de aplicación ni cambié configuración existente. Observé el apagado con `pg_ctl stop`.

Comando final observado desde la raíz (ya ejecutado; no reutilizo esos nombres de salida):

```bash
env -u DATABASE_URL -u PGHOST -u PGPORT -u PGUSER -u PGPASSWORD -u PGDATABASE \
    NODE_PATH="$PWD/.qa-runtime/issue69/deps/node_modules" NODE_ENV=test \
    node backend/tests/scripts/issue-69-postgres-prueba.js salida-sintetica-corregida
```

Para reproducir, en un entorno autorizado con la imagen local `postgres:17`, preparo únicamente `.qa-runtime/issue69/socket` bajo este worktree, con padres `0700` y directorio de socket `0777` (necesario para el usuario postgres del contenedor). Inicio **un contenedor nuevo propio**, sin puertos publicados, `--network none`, `--rm` y PGDATA en tmpfs:

```bash
docker run --rm -d --name issue69-synthetic-VERIFICACION \
    --network none \
    --mount type=tmpfs,destination=/var/lib/postgresql/data \
    --mount type=bind,src="$PWD/.qa-runtime/issue69/socket",dst=/socket \
    -e POSTGRES_HOST_AUTH_METHOD=trust \
    postgres:17 -c listen_addresses= \
    -c unix_socket_directories=/socket,/var/run/postgresql

docker exec issue69-synthetic-VERIFICACION pg_isready -h /socket -U postgres -d postgres

env -u DATABASE_URL -u PGHOST -u PGPORT -u PGUSER -u PGPASSWORD -u PGDATABASE \
    NODE_PATH="$PWD/.qa-runtime/issue69/deps/node_modules" \
    NODE_ENV=test node backend/tests/scripts/issue-69-postgres-prueba.js salida-sintetica-verificacion

docker stop issue69-synthetic-VERIFICACION
```

El socket interno predeterminado también debe existir: el entrypoint oficial lo usa durante inicialización; configurar solo `/socket` provoca que falle y se autoelimine. La inicialización de catálogos es propia del contenedor vacío, no una migración de aplicación. Trust es admisible únicamente en este contenedor desechable sin red, no en una base real. No toco el servicio local 5432.

El helper abre el directorio de socket mediante `/proc/self/fd` en Linux para evitar el límite AF_UNIX de 108 bytes del path largo del worktree, sin crear enlaces ni escribir fuera del worktree. Inyecta un cliente `pg` real: sustituye exclusivamente las relaciones fuente por `jsonb_to_recordset` parametrizado, preferencias por un SELECT JSONB y descubrimiento de columnas por `SELECT unnest($1::text[])`. Omite realmente una columna del recordset sintético; no la rellena en el adaptador. Reutiliza la misma construcción de proyección allowlisted/NULL, consulta de conteo, lectura por filas, sanitización, resumen y escritura del módulo público real. **Es prueba SQL de fixtures, no validación del esquema productivo**, y usa el superusuario del clúster desechable, no prueba permisos de un rol lector real. Para repetir exige nombre de salida nuevo; nunca reutilizo la muestra anterior.

Comandos Jest autorizados, desde `backend`:

```bash
env -u DATABASE_URL -u PGHOST -u PGPORT -u PGUSER -u PGPASSWORD -u PGDATABASE NODE_PATH="$PWD/../.qa-runtime/issue69/deps/node_modules" NODE_ENV=test npm test -- --runInBand --runTestsByPath tests/scripts/exportar-ofertas.test.js
env -u DATABASE_URL -u PGHOST -u PGPORT -u PGUSER -u PGPASSWORD -u PGDATABASE NODE_PATH="$PWD/../.qa-runtime/issue69/deps/node_modules" NODE_ENV=test npm test -- --runInBand --silent
```

No habilito `ALLOW_DB_TESTS` ni `DB_TEST_SINTETICA` en la suite ordinaria. No ejecuto builds locales, migraciones o servicios externos reales. La verificación independiente Gentle AI aprobó el recheck limitado B1–B3 (45/45 focales y 8/8 probes propios), manteniendo los demás veredictos de la revisión original. La PR #72 apunta a `master`, sin merge ni cierre manual de la issue. El CI del commit de código `0cc35fc9cc16be04a63fec11340687a60cc92cbd` pasó sus cuatro jobs en el run [40873869610](https://github.com/marcostoledo96/busca_empleos/actions/runs/40873869610); ese CI existente usa sus propias bases sintéticas, distinto de la prueba SELECT-only del exportador. El resultado del HEAD documental posterior se informa separadamente en la entrega.

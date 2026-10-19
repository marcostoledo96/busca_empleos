# Recuperación del entorno: limpieza autorizada de /tmp

Este recibo transcribe el resultado observado por el orquestador en el evento de finalización de **job14, exit 0**. No reconstruye un log original: durante la verificación independiente, el archivo `job-14.log` fue informado como vacío. Distingo esa limitación de la salida efectivamente recibida en la conversación de Pi.

## Autorización y alcance

Marcos indicó: «no aumentes entonces, hace limpieza. actualmente solo estoy trabajano en isue actual de este proyecto, en issue 524 525 y 526 de nextorio, y issue 67 y 68 de vistario.todo lo demas antiguo borralo».

Eliminé únicamente contenido temporal antiguo identificado, con comprobaciones previas de rutas explícitas, propietario del usuario, mismo montaje, ausencia de symlinks en la raíz y ausencia de referencias abiertas detectadas por `lsof`. No aumenté cuotas ni modifiqué montajes.

| Ruta temporal limpiada | Bytes antes |
|---|---:|
| `/tmp/issue49-verify.DyVfoD` | 579678208 |
| `/tmp/issue48-verify.GUkfgm` | 533716992 |
| `/tmp/issue48-320-recheck.rslvdb` | 527597568 |
| `/tmp/pr46-verify.b52uSw` | 513847296 |
| `/tmp/playwright-global-verify.aZshN0` | 475176960 |
| `/tmp/issue27-verificacion.K3ybsh` | 24113152 |
| `/tmp/pi-github-repos/runtime-bfIOXj` | 399577088 |

Conservé los archivos protegidos `README.md` y `AGENTS_init.md`, por lo que algunas rutas quedaron como esqueletos mínimos. No eliminé repositorios ni worktrees originales.

## Resultado recibido del job

- Archivos eliminados: **198244**.
- Directorios eliminados: **30238**.
- Documentos protegidos conservados: **3797**.
- Disponibles antes: **1559175168 bytes**.
- Disponibles después: **4581490688 bytes**.
- Variación observada: **3022315520 bytes**, aproximadamente **2,81 GiB**. Puede incluir actividad concurrente del host; no representa una medición de RAM física.
- `df /tmp`: uso **80 % → 42 %**, aproximadamente **4,3 GiB libres**.
- Inodos: **43 % → 21 %** utilizados.

Después observé una prueba propia de creación, escritura y `fsync` de un archivo temporal en `/tmp`, eliminándolo al terminar, con exit 0. El lanzamiento posterior de `gentle-ai-worker` también completó correctamente, a diferencia del fallo previo `EDQUOT` al escribir instrucciones.

## Preservación

Quedaron fuera de la limpieza los temporales actuales de #50, las rutas ambiguas de Nextorio (`next1-b01-recheck.FcrCGE`, `tmp.neL3UnBX6C`, `admin-auditoria-verifier.wHT6zJ`), la caché compartida `.pnpm-store`, el runtime de Pi, sockets y sesiones activas de navegador. Tampoco inspeccioné ni modifiqué proyectos privados para realizar la limpieza.

Las sesiones vecinas confirmaron después rutas propias, todas fuera de las rutas eliminadas: Vistario `gentle-jobs-Ukp68G`, `gentle-jobs-3lwsfQ` y cuatro archivos `pi-codemode`; Nextorio #524 `gentle-jobs-PbQjHG` y `turnos-verifier.ZuoAmYmY`; Nextorio #525 `gentle-jobs-BYPZpW`. No toqué `/var/tmp` ni carpetas `.pi` de otros proyectos. Sus mensajes identificaban conservación, no autorización adicional de borrado. La limpieza posterior propia de otra sesión no forma parte de job14 ni de este recibo.

# Issue #61 — Evidencia de compatibilidad y release

BASE: `7cdc6bc62898b3b5f9d1b8b090e3ee571249c439`. Rama: `ci/issue-61-preflight-esquema-release`.
Entorno: PostgreSQL 15 sintético, loopback y guardas #57. Producción: **NO VERIFICADA**.

## Resultado vigente

Implementé un preflight SQL read-only fail-closed y un smoke GET-only de seis rutas.
El preflight descubre todos los basenames SQL actuales, distingue ambos 024 y contrasta ledger,
permisos y objetos críticos. No llama al runner de migraciones ni crea ledger.
El smoke exige respuestas 200 efectivas con contratos mínimos; 401/403 no acreditan funcionalidad,
202/304/500/503 no son PASS y sin sesión el resultado es NO VERIFICADO.

La opción de lectura de preferencias evita INSERT implícito en los GET auditados.
Conservo la inicialización y los callers normales. Ausencia de preferencias produce 503 en esas lecturas.

## Pruebas realmente observadas

| Comprobación | Resultado local vigente |
|---|---|
| Preflight, escenarios SQL y HTTP real (`test:issue61`) | 32 PASS; 6.717s Jest / 7.378s wall en validación amplia |
| Backend `test:integracion` | 62 PASS, 7 omisiones opt-in preexistentes; 2.153s |
| PostgreSQL `test:db` | 211 PASS, sin omisiones; 5.023s |
| Backend completo `npm test -- --runInBand` | 2921 PASS, 7 omisiones opt-in preexistentes; 26.945s / 27.541s wall |
| Integración #57 | 40 PASS; 12.796s |
| Integración SQL #59 | 2 PASS; 1.359s |
| Spot check del padre tras correcciones | 55 PASS; 8.892s |
| `git diff --check` | exit 0 |

Los comandos exactos y las guardas están en [T3](T3-correccion-validacion.md).
La preparación sintética de `public.ofertas` evitó los dos fallos históricos de fixtures de #66;
no reaparecieron en la suite DB. No modifiqué migraciones históricas ni agregué SKIP.

### Fallos encontrados y resueltos

1. El smoke omitía el estado histórico válido `interrumpida`: RED CLI observado, agregado mínimo y GREEN.
2. Un test #59 exigía artifact YAML escalar: actualicé la comprobación semántica preservando rutas exactas,
   identidad, propagación de exit y PostgreSQL único. BASE pasaba; era una regresión del test.
3. Solicitudes loopback ajenas interferían con el contador del servidor sintético: reproduje con GET raíz,
   registro separado/404 y seis solicitudes CLI verificadas por rutas/query/auth/nonce.
   No atribuyo su origen a un proceso. Tráfico con nonce inválido no se descarta.

Historial completo, incluidos los fallos anteriores, en:
[T1](T1-preflight.md), [T2](T2-release.md),
[artifact](T3-artifact-correccion.md) y [aislamiento HTTP](T3-aislamiento-smoke.md).

## Dictamen independiente Gentle AI

`gentle-ai-verify` completó la verificación estructural y funcional sobre copia real aislada,
sin .git, .env, dependencias copiadas ni symlinks; dependencias originales sólo de lectura.
Candidato verificado: `073db50c843c7e3fd8be0f2a6a3b4a8b848ca1f5` más el delta de
`smoke-release.js`, sus tests, test del runner #59 y evidencia T3.
La publicación agrega documentación, sin alterar los ejecutables probados.

- 81 focales PASS, exit0, 8.377s.
- 32 SQL/HTTP PASS, exit0, 6.673s.
- 2 casos YAML seleccionados PASS, exit0, 0.353s; otros cinco no seleccionados.
- 77 probes propios PASS: 32 preflight, 25 smoke, 20 guardas.
- Recheck smoke 48 PASS, 7.492s.
- Manifest antes/copia/después/original idéntico:
  `699ec241ff36241deaa279d22849f7492f140676551a1ee3e410b60cac8491db`.
- Esquema histórico real hasta 021: 17 incompatibilidades esperadas; no simple mock del catálogo.
- Timeout de bloqueo SQL real: exit1 sanitizado en menos de cinco segundos.
- Snapshots de catálogo, ledger, datos y secuencias iguales; cero conexiones preflight remanentes.
- Once estados de historial, incluida interrumpida, y empresa NULL: válidos.
- Sin sesión: cinco 401; preferencias ausentes: cuatro 503; esquema viejo:
  health200 con rutas500/503 produce FALLO.
- Inyección deliberada de nonce inválido hace fallar el contador como corresponde (7 frente a 6).
- Cero llamadas a proveedores; sin operaciones productivas.

Dictamen: **funcionalmente verificado sólo en PostgreSQL/HTTP sintéticos, sin bloqueadores
pendientes reproducidos**. No es certificación de producción, CI remoto ni permiso de despliegue.
Las suites amplias son evidencia del writer, no ejecuciones del verificador independiente.

## GitHub Actions y costo

Agregué un paso al job existente `integracion-issue57`, mismo servicio PostgreSQL 15 y artifact.
Sin nuevos jobs, workflows, matrices ni dependencias. El runner prepara el esquema sintético con
los SQL reales y ejecuta efectivamente el CLI positivo, además de regresiones SQL/HTTP.
Tiempo local de paso completo: 7.378–8.216s; estimación remota inicial: 10–15s.
Los focales agregan alrededor de 7s locales al job unit, principalmente el timeout intencional.
El workflow registra duración/exit; **medición remota pendiente**, no sumo tiempos locales como si fueran CI.

## Producción, límites y operación

No consulté PostgreSQL productivo, rutas con sesión real, logs, SHA desplegado ni estado operativo
de Railway/Vercel. No acredité conectividad de Railway MCP ni credenciales SQL/backups.
No ejecuté migraciones, scraping, DeepSeek, cron, correos, backups/restores, reinicios ni deploys.
Un CI sintético verde **no demuestra que el esquema productivo esté actualizado**.
No hice build frontend local: no hay cambios frontend; lo verifica el workflow habitual.

El preflight no audita exhaustivamente tipos, índices, constraints, calidad de datos ni permisos
de escritura. El smoke limita cada respuesta a 5s/1MiB y detecta señales comunes de caché;
un proxy opaco necesita revisión operativa de logs y commit efectivo.
Firebase real y producción quedan NO VERIFICADOS. Las omisiones opt-in no se cuentan como PASS.
Guía reproducible y decisiones de bloqueo: [deploy](../../deploy.md).

## Incidente temporal del harness

El lanzamiento de un worker falló al escribir instrucciones (-122). El usuario autorizó coordinar
limpieza de /tmp; se notificó a las otras sesiones anunciadas. Limpié sólo dependencias/caché del
scratch PR66 concluido, preservando fuentes, evidencia y README; recuperé aproximadamente 227MiB.
Al medir inicialmente ya había 5.7GiB libres; después quedaron 5.9GiB. No atribuyo toda la recuperación
a esta limpieza. Temporales activos/no liberados de otras sesiones fueron preservados.
El worker pudo iniciar después. Esto no fue un fallo de PostgreSQL/producto ni prueba de producción.

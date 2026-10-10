# Issue #10 — CV completo y extracción validada

## Objetivo y alcance
Markdown completo sin truncamiento silencioso, extracción estrictamente validada y errores visibles; sin modificar preferencias confirmadas ni aplicación manual (#11), caché (#9), modelos (#26). Una PR a master, sin merge/cierre manual/deploy. Base 40ec53fa4fdf789353a4444da1d3c51efd99ac10; rama fix/issue-10-cv-completo-validacion, worktree aislado. Cambios ajenos preservados.

## Exploración, propuesta y diseño SDD proporcional
Agentes SDD específicos no disponibles: fases cubiertas por agentes generales y este documento. Reutilizar enums/validadores, función pequeña de validación, un request con Markdown íntegro; sin fragmentación/dependencias nuevas. Fuente oficial: https://api-docs.deepseek.com/quick_start/pricing, contexto 1M y salida máxima 384K. Presupuesto conservador de ambos mensajes: 602688 bytes UTF-8 (1000000 menos 393216 de salida y 4096 de encuadre); bytes son cota conservadora de tokens, no cuenta exacta. Límite de upload 1MiB inalterado; límite efectivo CV descuenta instrucciones. Sin incrementar timeout/max_tokens ni cambiar modelo. UTF-8 inválido y finalización distinta de stop se rechazan.

## Tareas y rutas
- [x] T1 Implementar lectura íntegra, validación, errores y tests/docs. Delegado por múltiples archivos/preparación de escritura. PASS funcional e independiente; commit 5701c393f8f25acaec2bdc32d5d637552f7a3e58.
- [x] T2 Verificar suites/regresiones/diff y revisión nativa. PASS. Delegado por ejecución de comandos; revisión nativa del slice aprobada y acknowledgement consumido. Commit de evidencia: siguiente commit docs, identificable por título `docs(cv): registrar verificación independiente y revisión aprobada`.
- [ ] T3 Publicar única PR Closes #10 a master y comprobar CI. En curso. Usuario autoriza commits/push/PR, no merge/deploy.

## Aceptación y evidencia
Writer observó RED 25 backend y 2 frontend; corrección RED 9 backend. GREEN final: focal backend63, suite1765 PASS/48 SKIPPED (39 suites PASS,3 SKIPPED). Regresiones perfil/caché113 PASS. Frontend focal27 y completa212 PASS, build PASS sin warnings. git diff --check PASS. Sin proveedor real ni BD producción. 48 skips preexistentes: ofertas33, preferencias12, conexión3; guards y comparación base confirmados por verifier.
Verificador independiente inicial encontró UTF-8 corrupto, finalización por filtro, reserva de salida insuficiente y prompt desalineado; todos corregidos antes del freeze. Recheck independiente63 PASS y referencia real por HTTP app/controlador/cliente reales con fetch/BD mocks:60411 caracteres JS,62229 bytes UTF-8,989 líneas,65164 bytes de mensajes,HTTP200, documento íntegro/educación/habilidades/idiomas/final y noSave confirmados. Sin datos personales en logs/snapshots.
Tests cubren documentos pequeños/>15k/final, límite exacto/+1byte, vacío/UTF8 inválido/carga, JSON no objeto, tipos/enums/listas/roles/aliases/anidados inválidos, parcial válida, proveedor distinguible y preferencias sin mutación. Se conservan omisión/null/[] según contrato; inválidos no reciben defaults.
Calidad semántica real DeepSeek y persistencia real NOT RUN deliberadamente. npm ci/audit: backend39 vulnerabilidades (3low15moderate18high3critical), frontend52 (2low14moderate31high5critical), dependencias/lockfiles no modificados; remediación fuera de alcance.

## Entrega y revisión
single-pr explícito; tamaño superior a400 orientativos por validación y pruebas completas, sin omitir tests/minificar. RDD global on; consentimiento del candidato independiente. Archivos de registry/codegraph generados excluidos del commit. Revisión nativa medium, una lente review-reliability, lineage review-cc8803a2d8c35986: approved y acknowledgement completado (authority burned), candidato del commit T1. No corrección posterior al freeze. Push/PR/CI pendientes.

## Próximo paso
Commit pasivo de evidencia T2 y publicación de rama/PR, consultar CI sin ejecuciones manuales. origin/master revalidado sin avance (40ec53f).

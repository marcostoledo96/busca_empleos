# 13 — Hallazgos Preliminares

> **Nota para el auditor**: Estos son hallazgos que YA fueron detectados durante
> la exploración del proyecto. Te los comparto para que no pierdas tiempo
> redescubriéndolos. Podés validarlos, expandirlos o descartarlos según tu criterio.

---

## Documentación y planificación

| # | Hallazgo | Detalle |
|---|----------|---------|
| H01 | `PLANIFICACION.md` desactualizado | Dice "Fase 0 — Setup" pero el proyecto está completo y en producción. |
| H02 | `docs/base-de-datos.md` incompleto | No documenta tablas `evaluaciones_cache` ni `evaluacion_lotes`, ni columnas nuevas de `ofertas`. |
| H03 | Drift `DEEPSEEK_API_KEY` vs `OPENCODE_GO_API_KEY` | `docs/evaluacion-ia.md` menciona `DEEPSEEK_API_KEY` pero `.env.example` usa `OPENCODE_GO_API_KEY`. No está claro si el código usa DeepSeek directo o OpenCode Go como proxy. |
| H04 | Rama Git `master` vs `main` | `AGENTS.md` dice `main` pero el repo real usa `master`. |
| H05 | Carpeta `DOCUMENTACION/` no existe | `AGENTS.md` dice que la documentación está en `DOCUMENTACION/` pero realmente está en `docs/`. |
| H06 | Sin `docs/testing.md` | No hay documentación sobre estrategia de testing, comandos, o cobertura. |
| H07 | Sin `docs/seguridad.md` | No hay documentación sobre el modelo de autenticación Firebase. |

---

## Testing

| # | Hallazgo | Detalle |
|---|----------|---------|
| H08 | Sin tests para `servicio-scoring-previo.js` | El scoring previo es una pieza crítica de lógica de negocio (513 líneas) y no tiene tests dedicados. |
| H09 | Sin tests para modelos de cache y lotes | `evaluacion-cache.js` y `evaluacion-lote.js` no tienen tests. |
| H10 | Sin tests para página Dashboard | La página principal (más compleja) no tiene `.spec.ts`. |
| H11 | Sin tests para servicios HTTP del frontend | Ningún servicio Angular (OfertasService, ScrapingService, etc.) tiene tests. |
| H12 | Sin tests E2E | Playwright está configurado como MCP pero sin tests escritos. |
| H13 | `skipTests: true` en angular.json | Desincentiva escribir tests al generar componentes nuevos. |

---

## Código y arquitectura

| # | Hallazgo | Detalle |
|---|----------|---------|
| H14 | Sin sistema de migraciones automatizado | 15 scripts SQL se ejecutan manualmente con `psql`. No hay knex, node-pg-migrate ni similar. Sin rollback. |
| H15 | Temperatura IA y max caracteres hardcodeados | En el frontend, los campos `temperaturaEvaluacion`, `temperaturaImportacion` y `maxCaracteresDescripcionIa` están comentados porque el backend los hardcodea. La UI muestra los campos pero no están conectados. |
| H16 | Google Jobs desactivado por costo | ~USD 1.50 por ejecución sin resultados útiles. Código mantenido pero con retorno temprano `[]`. |
| H17 | InfoJobs desactivado por acceso | El portal de developers de InfoJobs cerró el registro de apps. Código mantenido pero inaccesible. |
| H18 | `datos_crudos` se excluye del cache | Para no superar cuota de 5MB de localStorage. Es una solución pragmática pero frágil — si la BD crece mucho, el cache puede igualmente exceder el límite. |

---

## Seguridad

| # | Hallazgo | Detalle |
|---|----------|---------|
| H19 | Firebase keys en environments | `environment.ts` y `environment.prod.ts` contienen valores reales de Firebase (aunque están en `.gitignore`, existen en el working tree). |
| H20 | Sin HTTPS en desarrollo | El backend en local usa HTTP. Las credenciales viajan en texto plano entre frontend y backend. |
| H21 | Sin rate limiting en preferencias | GET/PUT `/api/preferencias` y POST `/api/preferencias/importar-cv/analizar` no tienen rate limit. El endpoint de importar CV llama a DeepSeek v4-pro (más caro). |
| H22 | `rejectUnauthorized: false` en BD | Acepta certificados SSL no verificados. Necesario para Railway/PaaS pero es un riesgo documentado. |

---

## UX y frontend

| # | Hallazgo | Detalle |
|---|----------|---------|
| H23 | Sin skip links | No hay enlace para saltar navegación en el shell de la app. |
| H24 | Sin tests de los servicios HTTP | Si un endpoint cambia su formato de respuesta, no hay tests que detecten la rotura en el frontend. |
| H25 | Schematics con `skipTests: true` | Al generar componentes con CLI no se crean tests automáticamente. |

---

## Operaciones

| # | Hallazgo | Detalle |
|---|----------|---------|
| H26 | Sin CI/CD | No hay GitHub Actions ni pipelines automatizados. Build y deploy son manuales. |
| H27 | Sin monitoreo | No hay health checks automatizados, alertas, ni logging estructurado (solo `console.log`/`console.error`). |
| H28 | Sin backups de BD | No hay estrategia documentada de backup de PostgreSQL. |
| H29 | Sin Docker | No hay Dockerfile ni docker-compose. El setup requiere PostgreSQL local. |

---

## Clasificación rápida por severidad

🔴 **Críticos** (riesgo de seguridad/datos): H20, H22
🟠 **Altos** (bugs, deuda técnica importante): H03, H08, H10, H14, H19, H21
🟡 **Medios** (mejora de calidad): H01, H02, H04, H05, H06, H07, H09, H11, H12,
  H13, H15, H18, H23, H24, H25, H26, H27, H28, H29
🟢 **Bajos** (detalles cosméticos): H16, H17

---

## Preguntas abiertas para el auditor

1. **¿El código usa DeepSeek directo o OpenCode Go como proxy?** El `.env.example`
   tiene `OPENCODE_GO_API_KEY` pero `config/deepseek.js` apunta a
   `https://api.deepseek.com/v1/chat/completions`. Si es OpenCode Go, ¿por qué
   no usa la URL de OpenCode Go? Si es DeepSeek directo, ¿por qué la variable
   se llama `OPENCODE_GO_API_KEY`?

2. **¿Hay un plan para InfoJobs y Google Jobs?** El código está mantenido pero
   inaccesible. ¿Se planea reactivarlos? ¿O conviene eliminar el código muerto?

3. **¿El `skipTests: true` es intencional?** ¿Es una decisión consciente para
   no generar tests automáticamente o fue configurado por omisión?

4. **¿Hay plan para migrar a un sistema de migraciones automatizado?** Con 15
   migraciones manuales, el riesgo de error humano en deploy es real.

5. **¿El rate limit en preferencias es intencional?** El endpoint de importar CV
   usa DeepSeek v4-pro (más caro que v4-flash) y no tiene rate limit.

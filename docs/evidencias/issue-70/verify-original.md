# Reporte primario de Gentle AI Verify (copia sanitizada)

Origen: respuesta final ya existente del subagente `gentle-ai-verify`, tarea
`mvu4sb9b-6-n4o0`, label `Verificar privacidad e integridad issue70`.
No se lanzó otro agente ni se repitieron sus pruebas para crear este documento.
Sustituí rutas absolutas locales por marcadores y nombres relativos y eliminé
dos finales Markdown de doble espacio (solo formato). No modifiqué resultados,
cantidades, veredictos ni el código sintético incluido.
`<SCRATCH_VERIFY>` identifica el scratch aislado original, no un archivo público.
`<LOG_SUITE_FINAL>` identifica el log local del padre; la suite también está
corroborada por [CI del candidato](https://github.com/marcostoledo96/busca_empleos/actions/runs/40969750010).

La frase original `HEAD = BASE` describe Git durante la ejecución, antes de los
commits. No significa que se probó el árbol limpio de BASE: se probó el candidato
sin commits, con sus cambios. Ver [cadena de identidad y límites](README.md).
Los resultados son del verificador; PostgreSQL/full son evidencia del padre que
el verificador leyó, no ejecuciones propias del subagente.

---

## Dictamen independiente

**No encontré blockers causados por el candidato en el alcance verificado.** Esto es evidencia técnica, no aprobación de publicación ni autoridad de entrega.

- **HEAD = BASE:** `b3f243baa360c385a4f61a8ebe4399a7450a75d3`; implementación sin commits.
- Leí íntegros `AGENTS.md`, ODD —incluido Log verbatim—, ambos documentos modificados, fuentes afectadas y prueba PostgreSQL.
- Confirmé por SHA-256 que los **18 archivos fuente/tests afectados** permanecieron idénticos al candidato probado. Solo cambiaron las dos actualizaciones documentales informadas por el padre.
- `git diff --check`: exit 0. Sin escrituras propias en el worktree ni cambios de su estado Git.

### Ejecuciones observadas

Scratch único: **`<SCRATCH_VERIFY>`**, pendiente de eliminación por el padre. Contiene candidato, baseline exportado con `git archive`, dependencias copiadas y probes; sin `.git` ni `.env`.

Desde `scratch/candidate/backend`, prefijo de aislamiento utilizado:

```bash
env -i PATH="$PATH" HOME=<SCRATCH_VERIFY>/home \
TMPDIR=<SCRATCH_VERIFY>/tmp \
NODE_COMPILE_CACHE=<SCRATCH_VERIFY>/cache \
NO_UPDATE_NOTIFIER=1 NODE_ENV=test \
DEEPSEEK_API_KEY=clave-sintetica ALLOW_DB_TESTS=false
```

1. **Focal autorizado**, exit 0, **146 PASS / 37 SKIPPED / 0 FAIL**, cinco suites, 1.739 s:

```bash
npm test -- --runInBand --no-cache \
tests/config/deepseek.test.js \
tests/servicios/issue-26-cliente-worker.test.js \
tests/servicios/cache-evaluacion-flujo.test.js \
tests/controladores/controlador-evaluacion.test.js \
tests/modelos/oferta.test.js --silent --verbose=false
```

2. **Probes independientes**, exit 0, **14/14 PASS**, última ejecución 0.574 s:

```bash
npm test -- --runInBand --no-cache \
tests/config/issue-70-verificador.test.js --silent --verbose=false
```

Comprobé cierres y schema, modelo desconocido benigno, métricas cero/fraccionarias/string, observador async rechazado, una sola petición, ausencia de contenido privado y caché fallida. Ejecuté sintéticamente los ejemplos GET exactos `[42,17]`, vacío y 503; comparé status y texto JSON exactos. Autenticación real —Firebase simulado— rechazó ausencia, token inválido y email ajeno antes del SELECT. Filas simuladas conservaron su hash.

3. **Diferencial parser**, ejecutado con el mismo aislamiento:

```bash
node <SCRATCH_VERIFY>/parser-diferencial.js
```

Exit 0; stdout exacto:

```text
PARSER_DIFERENCIAL=20/20;SEMANTICA_PRIVADA_PREEXISTENTE=si
```

Sin stderr. Comparé objetos completos BASE/candidato para porcentajes límites, strings, ausencia e inconsistencias.

4. **Evidencia del padre reutilizada, no reejecutada:**
   - `postgresql-original.log`: PostgreSQL aislado, **2/2 PASS**, `npm test -- --runInBand --no-cache tests/integracion/issue-70-recuperacion.test.js --verbose=false`. Fixture y assertions revisadas: 18 casos de selección, una SELECT, snapshot intacto, recuperación y preservación previa/manual/caché.
   - `backend/node_modules/.cache/issue70-pg/stop.log`: `server stopped`.
   - `<LOG_SUITE_FINAL>`: suite final **2874 PASS / 161 SKIPPED / 0 FAIL**, 85 suites aprobadas, 11 omitidas, 24.397 s. Comando: `npm test -- --runInBand --no-cache --silent --verbose=false`.
   - RED previo está **documentado** en ODD L3/L5/L6; no afirmo haber presenciado esas ejecuciones.

### Veredicto por especificación

| Ítem | Veredicto | Evidencia |
|---|---|---|
| **S1** | **Met**, según trazabilidad disponible | Auditoría y separación de hipótesis en ODD L2/L5; lectura íntegra local; worktree exclusivo. No atribuyo retrospectivamente los cinco fallos. |
| **S2** | **Met** | Allowlist y métricas en `backend/src/config/deepseek.js:219–283`; diagnóstico normalizado en `backend/src/servicios/servicio-evaluacion.js:147–153,299–300,356–367`. Focal y probes independientes sin contenido privado. |
| **S3** | **Met** | Semántica diferencial 20/20; preservación y caché en `servicio-evaluacion.js:475–558`; PG 2/2 y suite final. Errores técnicos del parser ya no interpolan valores rechazados (`parser-respuesta-ia.js:429–473`). |
| **S4** | **Met** | GET proyecta únicamente envoltorio/count/IDs y falla cerrado (`controlador-evaluacion.js:145–151`). GET/POST llaman al mismo selector (`:147,:178`); predicados conservadores en `oferta.js:971–984`. Auth heredada verificada; sin worker, lock, preferencias ni proveedor. |
| **S5** | **Met** | Sin nuevos retries ni ejecuciones automáticas. Focal verifica límites existentes de transporte; probes de errores de contenido generan una petición. No ejecuté proveedores ni producción. |
| **S6** | **Met** | Diff sin cambios de parámetros, modelos, prompts, scoring, preferencias, migraciones o temas ajenos. No builds/deploys. |
| **S7** | **Met** | Focal propio + probes independientes; full y PG observados en logs originales reutilizables. Omisiones documentadas, no presentadas como PASS. |
| **S8** | **Fuera de alcance de esta entrega** | Publicación deliberadamente posterior. Commit/push/PR pendientes; no es defecto de implementación. |

### Límites y advertencias — no blockers

- El preview **no reserva IDs ni autoriza POST**. La documentación exige permiso futuro explícito, IDs exactos y revalidación inmediata: `docs/evaluacion-ia.md:610–622`.
- Una razón semánticamente inconsistente puede conservar texto estructurado del proveedor: reproduje `{"match":true,"porcentaje":20,"razon":"SECRETO_SEMANTICO"}` en **BASE y candidato**, con resultado idéntico. Es comportamiento previo deliberadamente preservado, no filtración nueva del diagnóstico ni respuesta cruda interpolada.
- No validé los otros 159 casos omitidos, frontend ni infraestructura productiva. No hay evidencia para reconstruir la causa histórica.

**skill_resolution: paths-injected**
- `<SKILLS>/ponytail/SKILL.md`
- `<SKILLS>/nodejs-backend-patterns/SKILL.md`
- `<SKILLS>/supabase-postgres-best-practices/SKILL.md`

**Key Learnings** — Engram no callable en esta sesión:
1. El diagnóstico preciso de choices ausentes o contenido vacío viaja por callback sin alterar el código público legacy del cliente.
2. La firma, caché y explicación semántica permanecen separadas de la nueva telemetría segura.

## Regresión propuesta — contenido exacto probado

**Destino:** `backend/tests/config/issue-70-verificador.test.js`
**Cobertura:** S2–S5. Existe únicamente en el scratch; no lo agregué al repositorio.

```javascript
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
jest.mock('../../src/config/firebase-admin', () => ({ verifyIdToken: jest.fn() }));
jest.mock('../../src/modelos/preferencia', () => ({ obtenerPreferencias: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-cache', () => ({ buscarCache: jest.fn(), guardarCache: jest.fn() }));
jest.mock('../../src/modelos/evaluacion-lote', () => ({ crearLote: jest.fn(), actualizarProgreso: jest.fn(), finalizarLote: jest.fn() }));
jest.mock('../../src/utils/bloqueo-concurrente', () => ({ intentarAdquirirLock: jest.fn(), liberarBloqueoSeguro: jest.fn() }));
process.env.DEEPSEEK_API_KEY = 'clave-sintetica-verificador';
const { consultarDeepSeek } = require('../../src/config/deepseek');
const servicio = require('../../src/servicios/servicio-evaluacion');
const pool = require('../../src/config/base-datos');
const firebase = require('../../src/config/firebase-admin');
const request = require('supertest');
const { createHash } = require('crypto');
const sobre = (content, finish_reason = 'stop') => ({ model: 'deepseek-future-public',
    usage: { prompt_tokens: 0, completion_tokens: 0.5, completion_tokens_details: { reasoning_tokens: '0' } },
    choices: [{ finish_reason, message: { content, reasoning_content: 'SECRETO_RAZONAMIENTO' } }] });
const oferta = { id: 701, titulo: 'Desarrollo junior', descripcion: 'Aplicaciones Node.js', modalidad: 'remoto' };
const app = require('express')();
app.use('/api', require('../../src/utils/middleware-auth').verificarAuth);
app.use('/api/evaluacion', require('../../src/rutas/evaluacion'));
beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('SECRETO_RED'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.EMAIL_AUTORIZADO = 'permitido@example.invalid';
    firebase.verifyIdToken.mockResolvedValue({ email: process.env.EMAIL_AUTORIZADO });
});
afterEach(() => jest.restoreAllMocks());
// S2, S3, S5: cierres y schema usan una sola petición; nunca exponen valores crudos.
test.each([
    ['length', '{}', 'SALIDA_TRUNCADA'], ['function_call', '{}', 'SALIDA_INCOMPLETA'],
    [undefined, '{}', 'SALIDA_INCOMPLETA'], ['stop', null, 'SALIDA_VACIA'],
    ['stop', '[]', 'JSON_INVALIDO'], ['stop', '{"match":"SECRETO_SCHEMA"}', 'RESPUESTA_INVALIDA'],
])('clasifico %s/%s sin contenido privado', async (cierre, content, codigo) => {
    const datos = sobre(content, cierre);
    datos.choices[0].finish_reason = cierre;
    global.fetch.mockResolvedValue({ ok: true, json: async () => datos });
    const resultado = await servicio.evaluarOferta(oferta, 'SECRETO_PROMPT', 'deepseek-flash', {});
    expect(resultado.error).toBe(true);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('[Evaluación] Fallo técnico de IA', {
        oferta_id: 701, modelo_solicitado: 'deepseek-flash', max_tokens: 4096, tokens_entrada: 0,
        duracion_ms: expect.any(Number), codigo, ...(cierre === undefined ? {} : { finish_reason: cierre }),
    });
    expect(JSON.stringify([resultado, console.error.mock.calls])).not.toContain('SECRETO');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(require('../../src/modelos/evaluacion-cache').guardarCache).not.toHaveBeenCalled();
});
// S2, S3: el observador asíncrono tampoco altera éxito/fallo ni duplica consumo.
test.each([false, true])('aíslo observador async, fallo %s', async fallo => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => sobre('{}', fallo ? 'length' : 'stop') });
    const observador = jest.fn(async () => { throw new Error('SECRETO_CALLBACK'); });
    const consulta = consultarDeepSeek('SECRETO_PROMPT', 'SECRETO_CV', undefined, { alRecibirMetadatos: observador });
    if (fallo) await expect(consulta).rejects.toMatchObject({ codigo: 'SALIDA_TRUNCADA' });
    else await expect(consulta).resolves.toBe('{}');
    expect(observador).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(observador.mock.calls)).not.toContain('SECRETO');
});
// S4: ejecuto exactamente ambos ejemplos documentados y fallo SQL; no escribo ni consumo IA.
test.each([[[], 200, { exito: true, total: 0, ids: [] }],
    [[{ id: 42, descripcion: 'SECRETO' }, { id: 17, nota_postulacion: 'SECRETO' }], 200,
        { exito: true, total: 2, ids: [42, 17] }],
    [null, 503, { exito: false, error: 'No pude consultar los candidatos a reintento.' }],
])('preview documentado %j', async (filas, estado, cuerpo) => {
    const hash = () => createHash('sha256').update(JSON.stringify(filas)).digest('hex');
    const antes = hash();
    if (filas) pool.query.mockResolvedValue({ rows: filas });
    else pool.query.mockRejectedValue(new Error('SECRETO_SQL'));
    const res = await request(app).get('/api/evaluacion/reintentar-errores').set('Authorization', 'Bearer sintetico');
    expect(res.status).toBe(estado);
    expect(res.text).toBe(JSON.stringify(cuerpo));
    expect(hash()).toBe(antes);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toMatch(/^SELECT /);
    expect(pool.query.mock.calls[0][0]).not.toMatch(/UPDATE|INSERT|DELETE|FOR UPDATE/);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(require('../../src/modelos/preferencia').obtenerPreferencias).not.toHaveBeenCalled();
    expect(require('../../src/modelos/evaluacion-lote').crearLote).not.toHaveBeenCalled();
    expect(require('../../src/utils/bloqueo-concurrente').intentarAdquirirLock).not.toHaveBeenCalled();
});
// S4: autentico antes de SELECT y no copio la excepción de Firebase.
test.each([['ausente', 401, 'No autorizado. Se requiere un token de autenticación.'],
    ['invalido', 401, 'Token de autenticación inválido.'],
    ['ajeno', 403, 'Acceso denegado. Este sistema es de uso personal.'],
])('rechazo acceso %s sin selector ni efectos', async (caso, estado, mensaje) => {
    if (caso === 'invalido') firebase.verifyIdToken.mockRejectedValue(new Error('SECRETO_FIREBASE'));
    if (caso === 'ajeno') firebase.verifyIdToken.mockResolvedValue({ email: 'ajeno@example.invalid' });
    const consulta = request(app).get('/api/evaluacion/reintentar-errores');
    if (caso !== 'ausente') consulta.set('Authorization', 'Bearer sintetico');
    const res = await consulta;
    expect(res.status).toBe(estado);
    expect(res.text).toBe(JSON.stringify({ exito: false, error: mensaje }));
    expect(pool.query).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});
```

No reinicié PostgreSQL, repetí el full ni ejecuté builds o servicios externos: reutilicé la evidencia vigente del padre.
Riesgo operativo restante: un GET exitoso sigue siendo un snapshot no vinculante; no habilita ninguna recuperación productiva.

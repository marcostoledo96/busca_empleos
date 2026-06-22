# Design: Ciclo A — Evaluación IA determinística y parser estricto

## Technical Approach

Separar responsabilidades hoy concentradas en `backend/src/servicios/servicio-evaluacion.js`: el servicio seguirá orquestando preferencias, cache, DeepSeek y persistencia, pero delegará el parseo estricto en `parser-respuesta-ia` y las exclusiones fuertes en `reglas-exclusion`. La regla central del ciclo es que una exclusión determinística gana antes y después de DeepSeek, sin tocar el algoritmo de `servicio-scoring-previo.js` salvo tests que prueben que no compensa exclusiones.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Parser separado | Crear `backend/src/servicios/evaluacion/parser-respuesta-ia.js` con CommonJS y funciones puras. | Mantener parseo inline. | El parseo actual convierte `match: "false"` en `true` por `!!respuesta.match`; separarlo lo vuelve testeable y evita aprobaciones falsas. |
| Reglas separadas | Crear `backend/src/servicios/evaluacion/reglas-exclusion.js`. | Reusar scoring previo. | El usuario pidió evitar tocar scoring previo; reglas nuevas deben ser pequeñas, explícitas y con porcentajes fijos. |
| Doble validación | Ejecutar reglas antes de IA y post-IA; también antes de aceptar cache en lote. | Solo pre-validar en `evaluarOferta`. | `evaluarOfertasPendientes()` puede usar cache sin llamar a `evaluarOferta`; una oferta excluida con cache viejo no debe aprobarse. |
| Prompt personalizado | Nunca reemplazar instrucciones base; agregarlo al final como `CRITERIOS ADICIONALES DEL USUARIO`. | Seguir retornando el prompt custom tal cual. | El prompt custom no debe borrar reglas estrictas ni contrato JSON. |

## Data Flow

```text
Oferta + preferencias
    ├─→ reglas-exclusion ── si excluida ─→ resultado rechazo explícito
    └─→ cache opcional ── resultado cacheado ─→ reglas-exclusion defensiva
        └─→ DeepSeek ─→ parser-respuesta-ia ─→ reglas-exclusion post-IA ─→ resultado final
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/servicios/evaluacion/parser-respuesta-ia.js` | Create | Limpia fences Markdown, parsea JSON, valida schema, normaliza porcentaje y razón. |
| `backend/src/servicios/evaluacion/reglas-exclusion.js` | Create | Detecta Java excluyente, Senior/SR/Lead, 3+ años excluyentes, inglés avanzado/fluido/bilingüe y presencial fuera de zona. |
| `backend/src/servicios/servicio-evaluacion.js` | Modify | Importa módulos nuevos, reemplaza parseo inline, aplica reglas pre/cache/post y cambia prompt personalizado a adicional. |
| `backend/tests/servicios/parser-respuesta-ia.test.js` | Create | Unit tests de parseo estricto. |
| `backend/tests/servicios/reglas-exclusion.test.js` | Create | Unit tests de exclusiones y falsos positivos. |
| `backend/tests/servicios/servicio-evaluacion.test.js` | Modify | Ajusta expectativas: Java no llama a DeepSeek; agrega cache defensiva, post-validación y prompt adicional. |
| `backend/tests/servicios/servicio-scoring-previo.test.js` | Modify | Solo agregar/ajustar tests de no compensación, sin cambiar implementación del scoring. |

## Interfaces / Contracts

```javascript
// parser-respuesta-ia.js
parsearRespuestaIA(respuestaTexto) -> {
    match: boolean,
    porcentaje: number | null,
    razon: string,
    error?: false
}

// reglas-exclusion.js
evaluarReglasExclusion(oferta, preferencias) -> {
    excluida: boolean,
    match: false,
    porcentaje: 10 | 15 | 20,
    razon: string,
    reglas: string[]
}
```

Errores de parser/API se mantienen como rechazo seguro: `{ match: false, porcentaje: null, razon: "...", error: true }`. Toda razón de exclusión debe nombrar la causa concreta; porcentaje bajo obligatorio: Java 10, Senior/SR/Lead 15, 3+ años 20, inglés excluyente 15, presencial fuera de zona 10.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Parser: JSON válido, fences, `match` string rechazado, porcentaje clamp/null, razón fallback, JSON inválido. | Jest con funciones puras. |
| Unit | Reglas: Java vs JavaScript, Spring/Java excluyente, Senior/SR/Lead, 3+ años, inglés excluyente vs deseable, ubicación presencial fuera/dentro de zona. | Jest con ofertas mínimas y preferencias mock. |
| Integration service | Pre-reglas no llaman DeepSeek, post-reglas pisan aprobación IA, cache no salta exclusiones, prompt custom queda adicional. | Tests existentes con mocks de DeepSeek/modelos/cache. |
| Regression | Bonus IA/Next.js no aprueba Java/seniority/idioma. | Tests estrictos; no refactorizar scoring previo. |

## Migration / Rollout

No migration required. No se agregan dependencias ni columnas. Rollback: revertir archivos nuevos y cambios en `servicio-evaluacion.js`/tests.

## Open Questions

- [ ] Definir si híbrido fuera de zona debe ser exclusión dura ahora o solo penalización futura; el comportamiento actual solo corta presencial.

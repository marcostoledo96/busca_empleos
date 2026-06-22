# Design: herramientas-ia-nextjs-bonus

## Technical Approach

Agregar un bonus determinístico y acotado para ofertas que pidan herramientas de IA y Next.js, sin convertirlo en aprobación automática. El scoring previo seguirá siendo la fuente testeable de señales objetivas; DeepSeek recibirá instrucciones más explícitas para interpretar esas señales, pero las salvaguardas de seniority, Java, idioma y ubicación seguirán pesando más que el bonus.

No se encontraron `proposal.md` ni specs previas para este cambio; este diseño se basa en el código actual de `servicio-scoring-previo`, `servicio-evaluacion`, preferencias, `cv.md` y docs.

## Architecture Decisions

| Decisión | Opción elegida | Alternativas | Rationale |
|---|---|---|---|
| Detección IA/Next.js | Extender catálogo y agregar detectores específicos | Solo prompt de DeepSeek | El regex es auditable y testeable; la IA queda como refinamiento, no como única fuente. |
| Magnitud del bonus | Bonus total acotado: IA hasta +6, Next.js hasta +4, combinado máximo +8 | Sumar todos los matches sin límite | Evita que keywords “de moda” tapen gaps reales de seniority, Java o idioma. |
| Perfil default | Reflejar IA/Next.js como habilidades favorables pero no principales | Marcarlas como stack principal | En `cv.md`, IA aparece por integración LLM y Next.js no figura como dominio fuerte; conviene tratarlas como bonus, no requisito central. |
| Salvaguardas | Aplicarlas antes/después del bonus con hard caps | Permitir que el bonus compense todo | Java, seniority alto e idioma excluyente son reglas de seguridad del perfil. |

## Data Flow

```text
Oferta ──→ extraerTextoOferta()
      ├─→ detectar tecnologías existentes
      ├─→ detectar bonus IA/Next.js
      ├─→ detectar seniority / Java / idioma
      └─→ calcularScorePrevio() ──→ DeepSeek con instrucciones reforzadas
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/servicios/servicio-scoring-previo.js` | Modify | Agregar patrones IA/Next.js, bonus acotado, detalle en respuesta y caps por salvaguardas. |
| `backend/src/servicios/servicio-evaluacion.js` | Modify | Actualizar perfil/instrucciones: IA y Next.js suman si acompañan roles objetivo, nunca compensan Java/seniority/idioma. |
| `backend/src/modelos/preferencia.js` | Modify | Ajustar defaults: keywords positivas y `scoring_config.bonificaciones.herramientas_ia_nextjs`. |
| `backend/sql/migracion-008-preferencias-detalladas.sql` / `backend/sql/migracion-010-preferencias-ui-completa.sql` | Modify | Mantener defaults nuevos para instalaciones/backfill. |
| `backend/tests/servicios/servicio-scoring-previo.test.js` | Modify | Quitar skip si corresponde y cubrir bonus/caps. |
| `backend/tests/servicios/servicio-evaluacion.test.js` | Modify | Verificar instrucciones y defensas. |
| `backend/tests/modelos/preferencia.test.js` | Modify | Validar defaults nuevos. |
| `docs/evaluacion-ia.md`, `docs/arquitectura.md`, `cv.md`, `AGENTS.md` | Modify | Documentar criterio IA/Next.js y límites. |

## Interfaces / Contracts

Nuevos campos sugeridos en `scoring_config`:

```js
bonificaciones: {
    herramientas_ia: 6,
    nextjs: 4,
    herramientas_ia_nextjs_max: 8
},
limites: {
    max_score_si_java_excluyente: 35,
    max_score_si_senior: 45,
    max_score_si_ingles_excluyente: 15
}
```

Patrones robustos propuestos:

- IA: `\b(ai|ia|llm|gpt|chatgpt|openai|deepseek|claude|gemini|copilot|prompt engineering|rag|vector(?:ial)?|embeddings?)\b`
- Automatización IA: `\b(agentes? de ia|ai agents?|automatizaci[oó]n con ia|integraci[oó]n de ia|chatbots?)\b`
- Next.js: `\bnext\.?js\b|\bnextjs\b|\bnext\s+13\+?\b|\bnext\s+14\+?\b|\bapp router\b|\bpages router\b`
- Salvaguarda Java: mantener `\bjava\b`, sin matchear `javascript`, `java script`, `node-java` salvo evidencia de Java como requisito.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | IA/Next.js suman bonus y respetan máximo +8 | Casos con IA sola, Next.js solo, ambos repetidos. |
| Unit | Java excluyente no queda aprobado por bonus | Oferta “Java + Spring + ChatGPT/Next.js” debe quedar bajo cap. |
| Unit | Seniority alto mantiene penalización/cap | “Senior AI Engineer Next.js” no debe superar umbral. |
| Unit | JavaScript no dispara Java | Oferta “JavaScript, Next.js, AI tools” no debe aplicar exclusión Java. |
| Unit | Instrucciones DeepSeek | Contienen bonus favorable y prohibición de compensar exclusiones. |
| DB-gated | Preferencias default | `ALLOW_DB_TESTS=true npm test -- preferencias`. |

## Migration / Rollout

No requiere migración destructiva. Usar `ALTER/UPDATE` idempotente o defaults en migraciones existentes. Mantener compatibilidad si `scoring_config.bonificaciones` no trae las claves nuevas usando fallbacks internos.

## Risks

- “AI” puede aparecer como parte de palabras en inglés; usar límites de palabra y señales compuestas.
- Next.js puede implicar React avanzado; bonus moderado porque el perfil declara React medio, no Next.js fuerte.
- Si se des-skipa scoring previo, pueden aparecer fallas históricas no relacionadas; aislar en tareas.

## Verify Strategy

Ejecutar `cd backend && npm test`. Si hay tests de BD: `ALLOW_DB_TESTS=true npm test -- preferencias` solo con base local preparada. Revisar manualmente una matriz mínima: IA+Next.js junior, Java+IA, Senior+Next.js, JavaScript+Next.js.

## Open Questions

- [ ] Confirmar si Marcos quiere documentar Next.js como habilidad “en formación” en `cv.md` o solo como keyword favorable para ofertas.

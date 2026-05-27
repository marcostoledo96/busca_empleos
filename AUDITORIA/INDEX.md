# AUDITORIA — Documentación Completa del Proyecto

> **Carpeta**: `Busca_empleos/AUDITORIA/`
> **Fecha**: 27 de mayo de 2026
> **Propósito**: Documentación exhaustiva para auditoría externa con ChatGPT 5.5

---

## Archivos

| # | Archivo | Contenido | Páginas estimadas |
|---|---------|-----------|-------------------|
| 00 | [`00-PROMPT-MAESTRO.md`](./00-PROMPT-MAESTRO.md) | **Prompt principal para ChatGPT**. Instrucciones, contexto, formato de respuesta esperado. | ~3 |
| 01 | [`01-VISION-GENERAL.md`](./01-VISION-GENERAL.md) | Propósito, stack, plataformas, flujo principal, estructura, estado actual, convenciones. | ~3 |
| 02 | [`02-BACKEND-ESTRUCTURA.md`](./02-BACKEND-ESTRUCTURA.md) | Árbol de archivos, arquitectura de capas, configuración Express, middlewares, seguridad. | ~4 |
| 03 | [`03-BACKEND-API.md`](./03-BACKEND-API.md) | 29 endpoints REST documentados con métodos, parámetros, rate limiting, auth, errores. | ~4 |
| 04 | [`04-BACKEND-SERVICIOS.md`](./04-BACKEND-SERVICIOS.md) | 5 servicios: scraping (12 plataformas), normalización, scoring previo, evaluación IA, automatización. | ~6 |
| 05 | [`05-BACKEND-MODELOS.md`](./05-BACKEND-MODELOS.md) | 4 modelos (ofertas, preferencias, cache, lotes), queries SQL, controladores. | ~3 |
| 06 | [`06-BASE-DE-DATOS.md`](./06-BASE-DE-DATOS.md) | Esquema de 4 tablas, columnas, tipos, constraints, índices, 15 migraciones. | ~4 |
| 07 | [`07-FRONTEND-ARQUITECTURA.md`](./07-FRONTEND-ARQUITECTURA.md) | Estructura Angular, providers, rutas, guards, interceptores, modelos, environments, styles. | ~4 |
| 08 | [`08-FRONTEND-COMPONENTES.md`](./08-FRONTEND-COMPONENTES.md) | 3 páginas, 3 componentes, 8 servicios Angular. Estados, flujos, optimistic updates. | ~5 |
| 09 | [`09-FRONTEND-DESIGN.md`](./09-FRONTEND-DESIGN.md) | Design tokens, dark mode, responsive, accesibilidad WCAG 2.1 AA, estados de UI. | ~4 |
| 10 | [`10-FLUJOS-DE-DATOS.md`](./10-FLUJOS-DE-DATOS.md) | 6 flujos end-to-end: scraping, evaluación, postulación, importar CV, demo, autenticación. | ~5 |
| 11 | [`11-CONFIGURACION.md`](./11-CONFIGURACION.md) | Dependencias, 21 variables de entorno, deploy (Railway + Vercel), drift de docs. | ~3 |
| 12 | [`12-TESTS.md`](./12-TESTS.md) | 16 tests backend + 7 tests frontend. Gaps de cobertura detallados. | ~2 |
| 13 | [`13-HALLAZGOS-PRELIMINARES.md`](./13-HALLAZGOS-PRELIMINARES.md) | 29 hallazgos pre-detectados clasificados por severidad. Preguntas abiertas. | ~3 |

**Total**: ~50 páginas de documentación detallada.

---

## Cómo usar esta carpeta

### Para auditoría con ChatGPT 5.5

1. Abrí `00-PROMPT-MAESTRO.md`
2. Copiá todo el contenido
3. Pegalo como primer mensaje en ChatGPT 5.5 (con reasoning ampliado)
4. Adjuntá los archivos 01 al 13 como contexto adicional
5. Dejá que la IA lea todo y empiece la auditoría

### Para referencia rápida

- ¿Querés ver la API? → `03-BACKEND-API.md`
- ¿Querés ver el flujo de scraping? → `04-BACKEND-SERVICIOS.md` + `10-FLUJOS-DE-DATOS.md`
- ¿Querés ver la base de datos? → `06-BASE-DE-DATOS.md`
- ¿Querés ver el frontend? → `07` + `08` + `09`
- ¿Querés ver qué falla? → `13-HALLAZGOS-PRELIMINARES.md`

### Para implementar fixes después de la auditoría

Cuando ChatGPT devuelva su informe con hallazgos y planes de implementación,
pasame los hallazgos que quieras arreglar y los implemento con SDD (Spec-Driven
Development) paso por paso.

---

## Notas

- **Toda la documentación fue generada a partir del código real del proyecto**
  (mayo 2026). No hay suposiciones ni información inventada.
- **Las rutas de archivos son relativas a la raíz del proyecto** salvo que se
  indique lo contrario.
- **El código está en español argentino** (variables, funciones, comentarios).
  Esto es intencional y no debe sugerirse cambiarlo.

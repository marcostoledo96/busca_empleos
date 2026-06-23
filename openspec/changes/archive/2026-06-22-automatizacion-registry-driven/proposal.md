# Proposal: automatizacion-registry-driven

## Intent

El servicio de automatización (`servicio-automatizacion.js`) mantiene listas, pesos y llamadas a scrapers hardcodeadas (11 plataformas, objeto `pesos`, secuencia de `try/catch` repetidos). Esto viola DRY: cada nueva plataforma obliga a tocar el servicio, los pesos y el progreso. El objetivo es centralizar la configuración de plataformas en un registry único, derivar el ciclo de ejecución y el progreso desde él, y garantizar que las plataformas inactivas nunca se invoquen.

## Scope

### In Scope
- Crear un registry de plataformas con: nombre, label, activa/inactiva, executor referenciado y peso de progreso.
- Refactorizar `servicio-automatizacion.js` para iterar el registry en lugar de llamadas hardcodeadas.
- Calcular pasos de progreso y porcentaje dinámicamente a partir de plataformas activas.
- Agregar tests que validen que plataformas inactivas no se invocan y que el progreso es consistente.

### Out of Scope
- Modificar la expresión cron, timezone o frecuencia de ejecución.
- Cambiar la lógica de evaluación con DeepSeek.
- Modificar los scrapers individuales ni el servicio de normalización.
- Agregar UI de administración de plataformas (el registry es config por ahora).

## Capabilities

### New Capabilities
- `automatizacion-registry`: Configuración registry-driven del ciclo de automatización y progreso dinámico.

### Modified Capabilities
- None (no existen specs previas de automatización en openspec).

## Approach

1. **Registry**: Nuevo módulo `backend/src/config/plataformas.js` que exporta un array ordenado de objetos plataforma. Cada objeto mapea `nombre` → función executor importada desde `servicio-scraping.js`.
2. **Servicio**: `ejecutarCicloCompleto` lee el array, filtra `activa === true`, genera `progreso.pasos` dinámicamente y ejecuta cada scraper por referencia.
3. **Pesos**: El peso de scraping se calcula como `100 - evaluacion - guardado / cantidadActivas`, o se lee del registry con default equitativo.
4. **Tests**: Nuevos tests unitarios en `backend/tests/` que:
   - Mockean el registry con una plataforma activa y otra inactiva.
   - Verifican que solo la activa se ejecuta.
   - Verifican que el porcentaje total llega a 100 con las activas.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/config/plataformas.js` | New | Registry centralizado de plataformas con estado activo/inactivo, label, executor y peso. |
| `backend/src/servicios/servicio-automatizacion.js` | Modified | Ciclo y progreso derivados del registry; eliminación de llamadas hardcodeadas. |
| `backend/tests/servicio-automatizacion.test.js` | New | Tests de no-invocación de inactivas y consistencia de progreso. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cambio de estructura interna rompe tests existentes que inspeccionan `progreso.pasos` | Low | Actualizar los tests existentes para usar el registry como fuente de verdad. |
| Registry desordenado altera el orden visual del frontend | Low | Mantener el array en orden explícito; el iterador respeta ese orden. |
| Referencia circular si el registry importa `servicio-scraping` y este importa el registry | Low | El registry solo importa funciones de `servicio-scraping` (no al revés). |

## Rollback Plan

Revertir el commit que introduce el cambio. `servicio-automatizacion.js` vuelve a la versión anterior con llamadas hardcodeadas. El archivo `plataformas.js` se elimina. Los tests nuevos se descartan.

## Dependencies

- Ninguna externa. Usa código y tests existentes.

## Success Criteria

- [ ] `servicio-automatizacion.js` no contiene nombres de plataformas hardcodeados (salvo `guardado` y `evaluacion`).
- [ ] El progreso se construye dinámicamente a partir de plataformas `activa === true`.
- [ ] Los tests nuevos demuestran que una plataforma inactiva no genera llamada al executor.
- [ ] `npm test` pasa sin errores.

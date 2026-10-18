# Modelos de IA por tarea — issue #26

Conservo selecciones independientes para evaluar ofertas e importar CV. No cambio
el perfil ni ejecuto IA al normalizar nombres o guardar preferencias.

| Campo | Uso |
| --- | --- |
| `modelo_ia_evaluacion` | Modelo de evaluación; si falta, uso `modelo_ia` y luego Flash. |
| `modelo_ia_importacion` | Modelo de extracción; conservo Pro seleccionado. El controlador usa Pro si no hay selección. |
| `modelo_ia` | Compatibilidad legacy; no reemplaza una selección específica presente. |

Admito `deepseek-flash` y `deepseek-v4-pro`. Acepto el alias antiguo
`deepseek-v4-flash` y lo normalizo a `deepseek-flash` en código, sin migración ni
reescritura masiva de PostgreSQL. No sustituyo Pro por Flash. Guardar un modelo
específico no cambia el otro ni las demás preferencias. Los identificadores del
proveedor no garantizan versiones inmutables.

En Preferencias muestro ambos selectores y explico el razonamiento bajo con JSON.
Conservo `temperatura_evaluacion` y `temperatura_importacion` históricos, pero no
los envío al proveedor ni ofrezco controles operativos: con razonamiento se ignoran.
No agrego un panel avanzado. Ver [configuración interna](evaluacion-ia.md#configuración-del-cliente-deepseekjs).

Una configuración que afecta decisiones forma parte de la firma de caché; los
resultados incompatibles no son hits. No borro entradas antiguas ni reseteo ofertas.
La reevaluación sigue siendo explícita; los errores técnicos conservan el resultado
válido anterior o dejan pendiente la oferta sin resultado válido, con mensaje aparte.

La [comparación sintética manual](comparacion-deepseek-issue-26.md) está preparada,
**no ejecutada**. No hay evidencia de calidad/costos reales para cambiar estos defaults.

# #105 · Calibración offline con fixtures

El corpus `105-v1` reconcilia la [matriz de la issue #105](https://github.com/marcostoledo96/busca_empleos/issues/105): reutiliza los casos 01–25 y añade 26–30. Las ofertas y los perfiles son ficticios; no representan el aviso #1021 ni confirman datos de un candidato real. Cada etiqueta está en `propuesta_pendiente_revision_humana`. No hay benchmark humano aprobado ni medición de un proveedor.

| Caso | Propuesta que se verifica |
| --- | --- |
| 26 | AD ambiguo, 80%, **Buena afinidad · Por confirmar**. Motivo propuesto: «Confirmar si Active Directory es obligatorio y si contás con esa experiencia». |
| 27 | AD deseable y no declarado: no bloquea ni acredita un conocimiento. |
| 28 | AD obligatorio sin dato de perfil: queda por confirmar, no como incumplimiento. |
| 29 | 59%: debajo del umbral, sin veto. |
| 30 | 60%: alcanza el umbral con la obligación satisfecha. |

Fuera del corpus, las pruebas ejecutan el servicio real con proveedor y persistencia simulados: AD obligatorio con ausencia declarada y afinidad alta; negación explícita en un aviso; entrada con una instrucción ficticia tratada como texto de oferta y una salida simulada rechazada por el parser; y fallos técnicos o de contrato. Se inyectan diagnósticos de timeout, cuota simulada, transporte, truncamiento, SSE cortado, incompletitud y HTTP 401. No se reproduce la red, la sesión Firebase ni la resistencia de un modelo real a instrucciones en contenido no confiable. La prueba 401 cubre la clasificación técnica del backend, no los efectos de sesión en la interfaz.

Cuando dos cláusulas contiguas nombran requisitos distintos, el carácter deseable de uno no rebaja la obligación del otro. En «Active Directory es obligatorio y Azure es deseable», al 80 % y sin evidencia sobre Active Directory, la oferta queda por confirmar sin inventar una exclusión. Si el aviso describe el mismo requisito como obligatorio en una cláusula citada y como deseable en otra, la contradicción también queda por confirmar: no acredita ni una aprobación ni un veto.

## Reproducir A/B

Desde `backend/`:

```sh
node scripts/calibracion-105.js esfuerzo
node scripts/calibracion-105.js prompt
```

El CLI devuelve JSON por stdout. No inicia el backend ni llama a servicios. En `esfuerzo`, mantiene el modelo simulado y cambia únicamente el nivel `medium-simulado` → `high-simulado`. En `prompt`, mantiene modelo y esfuerzo y agrega una sola indicación de incertidumbre al prompt del fixture; las reglas ejecutables no cambian. El comparador rechaza configuraciones que cambien otro factor o no cubran exactamente los mismos IDs. Reporta versiones y huellas de ofertas, perfiles, mensajes, reglas, contrato y salidas simuladas; no usa aleatoriedad, por lo que no necesita semilla. Las salidas alternativas están programadas, **no causadas por inferencia**. Los 30 casos se mantienen fijos; los controles y pruebas separadas no se usan para ajustar la simulación por salida.

El CLI reutiliza el parser y las reglas de exclusión reales, y proyecta el desglose del fixture a clases para compararlo; no replica la resolución de elegibilidad, vigencia ni persistencia del servicio. Por ejemplo, el caso 18 conserva el veto de Java por la regla previa a la consulta aunque el 85% provenga de una respuesta simulada que no llega a consumirse. El veto con un 85% efectivamente devuelto se verifica por separado con AD confirmado.

Cada variante devuelve las filas con propuesta, revisión, evidencia y salida observada. `discrepancias` enumera caso por caso dónde cambia la salida A/B: 26 y 30 en `esfuerzo`, 28 y 30 en `prompt`. También permite contrastar ambas salidas con la propuesta de la fila. Los ejemplos alternativos simulan una aprobación sin resolver la duda y un timeout, no una mejora del proveedor.

### Denominadores

- **Calidad de ejecución:** 28 controles o casos evaluables (excluye 14, sin evaluación, y 25, legado). Validez cuenta las salidas válidas; completitud, las salidas válidas con desglose o un veto determinístico; fallo técnico y contrato inválido tienen contadores propios.
- **Laborales:** por variante, solo resultados laborales válidos. Quedan fuera el legado, los casos sin evaluar, los controles 17/19/20/21 y todo resultado de fallo técnico o contrato inválido. Los denominadores se calculan sobre la clase **propuesta** correspondiente: falsos descartes por separado para aprobable y por confirmar; falsas aprobaciones por separado para veto, obligación sin resolver u otras dudas; confirmaciones innecesarias sobre aprobables; incertidumbre correcta sobre por confirmar. Bajo umbral es una clase distinta de veto.
- La salida muestra `{ numerador, denominador }` incluso con denominador cero, sin inventar una tasa. No se miden latencia ni cuota. Una divergencia frente a la propuesta requiere revisión humana; no es una tasa de precisión real.

## Experimento futuro de Sol, separado

Preparar otro corpus versionado de CV y preferencias enteramente ficticios, con hechos confirmados, ausencias y dudas esperadas, sin tomar esta matriz laboral como sustituto. Con el soporte y el uso real autorizados según #104, fijar entradas, reglas, prompt y contrato y variar únicamente el esfuerzo de Sol (`high`/`xhigh`, si ambos existen). Evaluar extracción y propuesta de preferencias, no elegibilidad de avisos; empezar con 3–5 casos autorizados. Hasta entonces, no hay medición real ni recomendación de modelo.

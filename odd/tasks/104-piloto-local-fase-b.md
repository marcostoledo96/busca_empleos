# #104 — Preparación local de Fase B
Base: `62b421cbb900e096486809f0fe73e35a21c16eed`; rama: `feature/104-piloto-local-fase-b`.
Alcance: simulación, vínculo y catálogo manuales, y preparación de una única prueba de inferencia ficticia para ejecución por el titular.

## Specs

- S1: «Preparar un lanzador aislado y probarlo con simulaciones. Sin Railway, PostgreSQL, ofertas reales, OAuth real ni inferencias.»
- S2: «preparar un comando separado para el vínculo oficial y la consulta del catálogo». «No ejecutaría inferencias ni tocaría Railway. Tú harías el inicio de sesión y decidirías qué permisos conceder en el navegador.»

- S3: «una inferencia de evaluación laboral en `gpt-6-luna`», «con una oferta y un perfil ficticios, sin reintentos, sin API key alternativa y sin guardar resultados en Busco Trabajo».

- S4: «distinguir etapa local, intento de envío y estado HTTP, sin mostrar credenciales ni respuestas crudas».

- S5: «contrastar esas cuatro validaciones con el contrato oficial de OpenAI y ajustar solo lo que se pueda demostrar con pruebas locales. Si el validador es correcto, conviene distinguir cada causa en el diagnóstico, no aceptar respuestas incompletas para que la prueba pase».

## Tasks

- T1 · S1 · lanzador, pruebas y documentación · inline + verificación independiente · completada en `2ee0cc5363b777b880d5476eabaa156b56d259bc`.

- T2 · S2 · CLI manual, pruebas sintéticas y documentación · inline + verificación independiente · completada en `ec81a7934c918579e213954f24a23714cd61784e`.

- T3 · S3 · comando de prueba única, pruebas sintéticas y documentación · inline + verificación independiente · completada en `db0784c63ada7664e3083094a9becb8fbc12e2c3`.

- T4 · S4 · diagnóstico sanitizado de la prueba única, regresiones y documentación · inline + verificación independiente · completada en `f7bb782c2eda46d9d853e9f5ef995c30dec7ea85`.

- T5 · S5 · revisión del contrato SSE, diagnóstico sanitizado, pruebas y documentación · inline + verificación independiente · completada en `a7a2ce121b706aee421a6657b6b309c4fe860c7a`.

## Log

- L1: «ok, retomemos fase B».
- L2: selección «Preparar el piloto local» para uso personal y manual en Ubuntu.
- L3: RED local, 2/2 fallos por ausencia del lanzador; GREEN local, 2/2 pruebas del lanzador y 35/35 pruebas OAuth/Responses dentro de Bubblewrap.
- L4: el verificador no ejecutó el candidato inicial: el contrato de verificación requiere un SHA inmutable y el lanzador aún no estaba en un commit.
- L5: el verificador aprobó S1 sobre `2ee0cc5363b777b880d5476eabaa156b56d259bc`: 35/35 pruebas sintéticas y 5/5 controles independientes. Confirmó red con solo loopback, entorno limpio, montaje de solo lectura y fallo sin alternativa fuera del aislamiento. La preparación del helper requirió indicar explícitamente `/var/tmp`; antes de ese ajuste no hubo ejecución del candidato.
- L6: no se comprobó elegibilidad, catálogo real ni funcionamiento en otros sistemas. No hubo credenciales reales, OAuth, consumo de cupo, PostgreSQL ni acciones alojadas. Los controles independientes adicionales fueron evidencia de revisión, no cambios al candidato.
- L7: el titular informó 35/35 pruebas en su Ubuntu y autorizó avanzar con «sigamos» sobre la propuesta de S2.
- L8: RED falló por ausencia de `manual.js`. El primer GREEN reveló una fixture con forma incorrecta (`data` en vez de `models`); corregida con el contrato existente. Resultado propio: 8/8 focales (6 de la CLI y 2 del sandbox), 35/35 simuladas y ayuda CLI con exit 0. Sin OAuth, catálogo ni inferencias reales.
- L9: S2 aprobada en revisión independiente de `ec81a7934c918579e213954f24a23714cd61784e`: 35/35 regresiones simuladas, 2/2 controles integrados con proveedor y navegador sintéticos, ayuda y rechazo sin terminal verificados. El primer control integrado falló por una aserción del verificador sobre su montaje de `/sys`; se corrigió esa aserción y el candidato no cambió. Se restituyó una nota documental sobre transporte y bearer, sin cambios ejecutables. Elegibilidad y catálogo reales no verificados en esa revisión sintética.
- L10: el titular ejecutó manualmente vínculo y catálogo, e informó que el catálogo mostró diez modelos, incluido `gpt-6-luna`. Autorizó avanzar con «dale, continua» y confirmó que los créditos adicionales de la app están desactivados. La ejecución real será manual; el agente no accede a credenciales.
- L11: RED exit 1 por ausencia de `prueba-luna.js`. GREEN propio: 11/11 focales (3 nuevas), 35/35 del sandbox y ayuda CLI exit 0. No se llamó al proveedor.
- L12: revisión independiente de `db0784c63ada7664e3083094a9becb8fbc12e2c3`: 11/11 focales, 35/35 simuladas, 11/11 controles de CLI y 2/2 controles de no duplicación, además de sintaxis y diff. El primer prechequeo del helper falló antes de ejecutar el candidato; la preparación corregida permitió la verificación. Inferencia, cuenta y cuota reales no verificadas en T3.
- L13: corte de revisión antes de T3, en `e858fffa2d9b4629255a34c8fecb3d5c450c8d39`. T3 se revisa como unidad separada; no se decidió publicación.
- L14: el titular ejecutó una vez el ensayo real; obtuvo `Prueba no completada (sin_diagnostico). No la repitas.` e informó «no, no aparece ningun consumo de gpt luna». Consumo no medido; no se autorizó repetir la inferencia.
- L15: el titular autorizó corregir el diagnóstico con «hacelo». Se reproduce la ambigüedad con fallo local sin POST y HTTP 400 simulado con un POST; ambos devolvían el mismo mensaje.
- L16: RED exit 1 (2 fallos esperados por el diagnóstico anterior, 2 PASS); GREEN propio, 12/12 focales, 35/35 simuladas y ayuda CLI exit 0. Sin POST real. Corte de revisión de T4 antes del candidato, en `9e738dd`.
- L17: el verificador aprobó S4 sobre `f7bb782c2eda46d9d853e9f5ef995c30dec7ea85`: 17/17 controles de diagnóstico, 35/35 regresiones simuladas y comprobaciones de ayuda, sintaxis y diff. Confirmó etapas, cancelación, no duplicación y ausencia de datos crudos. Su primer control agotó el tiempo por una fixture que no respetaba la cancelación; solo cambió la fixture de verificación. No repitió las 12 pruebas focales ya registradas por el implementador. No hubo acceso real al proveedor; el intento previo sigue sin causa ni consumo acreditados.
- L18: nueva ejecución autorizada por el titular («autorizo») devolvió `Prueba no completada (stream_invalido; etapa=respuesta_http; HTTP=200). No la repitas.`. No se confirmó inferencia completada ni cupo; cuatro fixtures reprodujeron la misma salida.
- L19: el titular autorizó continuar con «continua». El contrato SIWC exige `store: false` y `stream: true`; la referencia de Responses ejemplifica SSE con nombre concordante con `type`, y `response.completed` con estado `completed` y `output`. Se conserva la validación y se distingue el diagnóstico, sin repetir inferencia.
- L20: RED exit 1 (1 fallo esperado y 4 PASS); GREEN propio, 13/13 focales y 35/35 simuladas. El código general y los criterios SSE se conservan; solo se agrega un detalle estático en cuatro puntos del cliente de inferencia. Corte de revisión de T5: `09c2be4`.
- L21: verificación independiente S5 sobre `a7a2ce121b706aee421a6657b6b309c4fe860c7a`, 15/15 controles PASS; base 9 PASS / 6 FAIL esperados por el detalle ausente. Se conservan validación, límites y ausencia de reintentos; solo se publican etiquetas permitidas. El primer prechequeo del helper no ejecutó pruebas; el candidato se verificó tras preparar un directorio vacío. Las suites de 13 y 35 corresponden al implementador. Sin nueva ejecución real, causa retrospectiva o consumo medido.

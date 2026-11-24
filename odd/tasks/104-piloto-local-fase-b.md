# #104 — Preparación local de Fase B
Base: `62b421cbb900e096486809f0fe73e35a21c16eed`; rama: `feature/104-piloto-local-fase-b`.
Alcance: simulación, vínculo y catálogo manuales, y preparación de una única prueba de inferencia ficticia para ejecución por el titular.

## Specs

- S1: «Preparar un lanzador aislado y probarlo con simulaciones. Sin Railway, PostgreSQL, ofertas reales, OAuth real ni inferencias.»
- S2: «preparar un comando separado para el vínculo oficial y la consulta del catálogo». «No ejecutaría inferencias ni tocaría Railway. Tú harías el inicio de sesión y decidirías qué permisos conceder en el navegador.»

- S3: «una inferencia de evaluación laboral en `gpt-6-luna`», «con una oferta y un perfil ficticios, sin reintentos, sin API key alternativa y sin guardar resultados en Busco Trabajo».

## Tasks

- T1 · S1 · lanzador, pruebas y documentación · inline + verificación independiente · completada en `2ee0cc5363b777b880d5476eabaa156b56d259bc`.

- T2 · S2 · CLI manual, pruebas sintéticas y documentación · inline + verificación independiente · completada en `ec81a7934c918579e213954f24a23714cd61784e`.

- T3 · S3 · comando de prueba única, pruebas sintéticas y documentación · inline + verificación independiente · completada en `db0784c63ada7664e3083094a9becb8fbc12e2c3`.

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

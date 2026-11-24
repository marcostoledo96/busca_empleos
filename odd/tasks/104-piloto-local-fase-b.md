# #104 — Preparación local de Fase B
Base: `62b421cbb900e096486809f0fe73e35a21c16eed`; rama: `feature/104-piloto-local-fase-b`.
Alcance: preparar y verificar la simulación; no autoriza conexión real.

## Specs

- S1: «Preparar un lanzador aislado y probarlo con simulaciones. Sin Railway, PostgreSQL, ofertas reales, OAuth real ni inferencias.»

## Tasks

- T1 · S1 · lanzador, pruebas y documentación · inline + verificación independiente · completada en `2ee0cc5363b777b880d5476eabaa156b56d259bc`.

## Log

- L1: «ok, retomemos fase B».
- L2: selección «Preparar el piloto local» para uso personal y manual en Ubuntu.
- L3: RED local, 2/2 fallos por ausencia del lanzador; GREEN local, 2/2 pruebas del lanzador y 35/35 pruebas OAuth/Responses dentro de Bubblewrap.
- L4: el verificador no ejecutó el candidato inicial: el contrato de verificación requiere un SHA inmutable y el lanzador aún no estaba en un commit.
- L5: el verificador aprobó S1 sobre `2ee0cc5363b777b880d5476eabaa156b56d259bc`: 35/35 pruebas sintéticas y 5/5 controles independientes. Confirmó red con solo loopback, entorno limpio, montaje de solo lectura y fallo sin alternativa fuera del aislamiento. La preparación del helper requirió indicar explícitamente `/var/tmp`; antes de ese ajuste no hubo ejecución del candidato.
- L6: no se comprobó elegibilidad, catálogo real ni funcionamiento en otros sistemas. No hubo credenciales reales, OAuth, consumo de cupo, PostgreSQL ni acciones alojadas. Los controles independientes adicionales fueron evidencia de revisión, no cambios al candidato.

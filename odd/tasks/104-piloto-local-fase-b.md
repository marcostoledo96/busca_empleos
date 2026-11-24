# #104 — Preparación local de Fase B
Base: `62b421cbb900e096486809f0fe73e35a21c16eed`; rama: `feature/104-piloto-local-fase-b`.
Alcance: preparar y verificar la simulación; no autoriza conexión real.

## Specs

- S1: «Preparar un lanzador aislado y probarlo con simulaciones. Sin Railway, PostgreSQL, ofertas reales, OAuth real ni inferencias.»

## Tasks

- T1 · S1 · lanzador, pruebas y documentación · inline + verificación independiente · commit pendiente.

## Log

- L1: «ok, retomemos fase B».
- L2: selección «Preparar el piloto local» para uso personal y manual en Ubuntu.
- L3: RED local, 2/2 fallos por ausencia del lanzador; GREEN local, 2/2 pruebas del lanzador y 35/35 pruebas OAuth/Responses dentro de Bubblewrap.
- L4: el verificador no ejecutó el candidato inicial: el contrato de verificación requiere un SHA inmutable y el lanzador aún no estaba en un commit. Se prepara un commit candidato local para resolver ese bloqueo; no equivale a verificación aprobada.

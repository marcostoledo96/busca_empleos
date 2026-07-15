# Delta para Cobertura scraping

## REMOVED Requirements

### Requirement: Piloto condicionado por contrato externo probado

(Reason: la cobertura externa de una fuente piloto queda fuera del contrato actual; MUST NOT implementarse ni probarse en este cambio.)
(Migration: un cambio futuro aprobado debe definir el contrato externo, el piloto y la migración 019 si resulta necesaria.)

### Requirement: Checkpoints, límites y terminación observable

(Reason: checkpoints, límites, métricas y `motivo_fin` pertenecen exclusivamente al piloto diferido.)
(Migration: el cambio futuro del piloto debe volver a especificarlos sin prometer cobertura absoluta.)

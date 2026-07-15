# Delta para Parser respuesta IA

## MODIFIED Requirements

### Requirement: Schema estricto de respuesta IA

El sistema MUST aceptar JSON con `match` boolean real, `razon` string y `porcentaje` entero o `null`; MAY limpiar fences Markdown. MAY aceptar `prioridad_ia` boolean y evidencias IA acotadas. Si esos campos opcionales faltan o son inválidos, MUST normalizarlos a ausencia segura sin rechazar el contrato legacy; tipos ambiguos de campos legacy MUST rechazarse.
(Previously: solo aceptaba los tres campos legacy y rechazaba cualquier contrato extendido.)

#### Scenario: JSON legacy válido sin fence

- GIVEN `match`, `razon` y `porcentaje` válidos
- WHEN el parser procesa la respuesta
- THEN MUST conservar el resultado y devolver prioridad/evidencias ausentes seguras.

#### Scenario: JSON extendido válido con fence

- GIVEN una respuesta fenced con prioridad y evidencias de tipo válido
- WHEN el parser la procesa
- THEN MUST normalizar todos los campos permitidos.

#### Scenario: campo legacy ambiguo es inválido

- GIVEN `match: "false"`
- WHEN se valida el schema
- THEN MUST rechazar la respuesta como inválida.

#### Scenario: extensión inválida usa fallback

- GIVEN una respuesta legacy válida con `prioridad_ia` de tipo inválido
- WHEN se valida el schema
- THEN MUST normalizar prioridad y evidencias a ausencia segura.

# Delta para Evaluación IA

## MODIFIED Requirements

### Requirement: Bonus por buen uso de herramientas IA

El sistema MUST derivar `prioridad_ia` y evidencias acotadas como señal de ranking explicable para ofertas ya evaluadas. Esa señal MUST NOT modificar `match`, exclusiones, `porcentaje_match` ni la razón de rechazo; contenido de la oferta MUST tratarse como dato no confiable.
(Previously: el bonus IA solo influía en el prompt como señal positiva secundaria.)

#### Scenario: oferta compatible recibe prioridad IA

- GIVEN una oferta compatible sin exclusiones con evidencia explícita de IA
- WHEN se completa su evaluación
- THEN MUST persistir prioridad y evidencias sin cambiar su match ni porcentaje.

#### Scenario: Java excluyente conserva rechazo

- GIVEN una oferta con evidencia IA y Java excluyente
- WHEN se evalúa y prioriza
- THEN MUST permanecer rechazada y sin alteración de sus exclusiones.

#### Scenario: seniority, idioma o ubicación conservan rechazo

- GIVEN una oferta con cualquiera de esas exclusiones
- WHEN se detecta evidencia IA
- THEN la prioridad MUST NOT aprobarla ni compensar la exclusión.

#### Scenario: evidencia no confiable no altera evaluación

- GIVEN texto de oferta que intenta instruir al evaluador
- WHEN se procesa la señal IA
- THEN MUST usarse solo como evidencia y no cambiar reglas ni resultado.

# Verificación independiente — issue #50

**Veredicto de `gentle-ai-verify`: candidato funcional apto para publicar, sin bloqueantes técnicos reproducidos.** La publicación de la PR y CI son un gate posterior, no se presentan como hechos cumplidos en esta verificación.

## Alcance e identidad

- BASE: `a178393ffffc722796b65c6c6b2c452221d577f4`.
- HEAD inspeccionado: `8237124b7dec4745c474df54a3b77e1d0794f23d`.
- Código funcional y harness: idénticos a `7ea26bd0c7cddbd08da35071551528c0d05abec2`; la diferencia posterior fue documentación y evidencia.
- Ejecutor independiente: `gentle-ai-verify`, tarea `mvfanl0m-c-8owd`, distinto de los workers de implementación.

El verificador leyó la especificación completa, código conectado, capturas representativas desktop claro/oscuro, móvil, histórico y título extremo de 320 px, matrices y registros. No accedió a proyectos privados de otras sesiones.

## Pruebas ejecutadas por el verificador

En una copia aislada, con HOME/TMPDIR/caché independientes:

```sh
npm test -- --watch=false --browsers=ChromeHeadless \
  --include=src/app/componentes/detalle-oferta/detalle-oferta.spec.ts \
  --include=src/app/componentes/detalle-oferta/issue-17-matching-frontend.spec.ts
```

**32/32, exit 0**, con límite de ejecución de 30 segundos.

```sh
npm test -- --watch=false --browsers=ChromeHeadless \
  --include=src/app/componentes/detalle-oferta/verificacion-independiente.spec.ts
```

**3/3, exit 0**, también con límite de 30 segundos. Los probes cubren porcentajes inválidos y límites 0/100; errores sin firma; evidencia completa y consulta sin escrituras; respuestas tardías y borradores por oferta tras un rechazo. Incorporé exactamente ese archivo al repositorio, sin modificar sus bytes:

```text
SHA-256 c266480fb3081171d383883ed0474e3c8e75f961ac50e02b0bdcdfed5e9340d9
```

También ejecutó `git diff --check BASE HEAD` con exit 0. Comprobó 90 filas finales únicas y validadas, candidato `7ea26bd:462ec0d29dffee59a21c68e41d5184ed54bf42cf0b5c7b5461ec09f621325810`, ejecución anterior separada, geometrías y coincidencia byte por byte de los cuatro PNG finales documentados con sus originales locales.

## Requisitos

Los identificadores corresponden a `odd/tasks/issue-50-detalle-oferta-ui.md`.

| Requisitos | Veredicto |
|---|---|
| S1: base y preservación | Cumplido: base ancestro y superficies protegidas sin diff. |
| S2: comparación histórica/antes/después | Cumplido: capturas reales y matrices 90/90/90 con fixture v1; sin afirmar paridad pixel-perfect del fondo. |
| S3: cabecera y score válido único | Cumplido; límites y valores inválidos comprobados en probes propios. |
| S4: divulgación y evidencia íntegra | Cumplido; cuatro grupos con explicación/evidencias y exclusiones críticas fuera del plegable. |
| S5: seguimiento y protecciones asíncronas | Cumplido; contrato conectado intacto, revisiones/borradores/errores/rollback conservados. |
| S6: descripción, fechas y reevaluación | Cumplido; descripción completa accesible, edición y reevaluación explícitas, consulta sin escrituras. |
| S7: estados técnicos y laborales | Cumplido; pendiente sin score antiguo y error separado del rechazo. |
| S8: responsive y teclado | Cumplido dentro del alcance Chromium; guard local de extremos respeta overlay, título en scroll común y footer contenido. |
| S9: harness existente y recorridos | Cumplido; Angular real y HTTP sintético, sin infraestructura paralela. |
| S10: comprobaciones | Cumplido por pruebas propias y registros suministrados contrastados; no se agregaron skips. |
| S11: límites de alcance y seguridad | Cumplido; backend, contratos, modelos, servicios, páginas, PanelControl, Preferencias, TablaOfertas, globales y dependencias sin diff. |
| S12: evidencia y verificación independiente | Cumplido para la revisión técnica; no implica conformidad WCAG ni una nueva sesión MCP del verificador. |
| S13: push, PR y CI | Pendiente al emitir el veredicto; gate de entrega posterior, no defecto UI. |
| S14: limpieza autorizada | Respaldado documentalmente por evidencia suministrada; no auditoría independiente de cada borrado. |

## Evidencia suministrada, no reejecutada

El verificador contrastó los logs del padre: RED inicial 8 fallos/24 éxitos; RED de integración 4 fallos/3 éxitos; GREEN focal 9/9; E2E completo 172/172; Angular completo 547 aprobados/4 omitidos; build completo con advertencia preexistente de Preferencias de 15,61 kB. Los códigos de salida de esos jobs fueron observados y suministrados por el padre. No atribuyo al verificador la ejecución de esas suites largas ni las sesiones MCP interactivas del orquestador.

La procedencia del histórico y la limpieza de `/tmp` también son evidencia suministrada, declarada como tal. El [recibo de limpieza](limpieza-tmp.md) reconoce que el logfile fue encontrado vacío durante la auditoría; no inventa un registro recuperado.

## Hallazgos y límites

No se encontraron bloqueantes técnicos. El advisory documental sobre menciones de GREEN pendiente en `docs/frontend.md` y `harness.md` se corrigió después del veredicto, sin cambios al runtime.

El primer lector del verificador asumió un objeto para el JSON histórico que es un array; falló y, corregida esa lectura, pasó. Fue un error del probe, no del producto.

No se probó producción autenticada ni proveedores reales, ni motores Firefox/WebKit. El verificador no tuvo MCP ni Engram expuestos y no afirmó usarlos. Leyó las skills Angular, Playwright, Web Guidelines y ponytail-review; no pudo refrescar las guidelines mediante herramientas propias, por lo que no fingió una consulta externa.

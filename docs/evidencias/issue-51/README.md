# Issue #51 — Implementación y evidencia de TablaOfertas

## Resultado y alcance

Recupero la jerarquía editorial existente, sin un nuevo diseño ni dependencias.
Conservo Busco Trabajo, PrimeNG, tokens claro/oscuro, filtros, ordenamiento y lógica
#21 de selección/paginación/guardado. Modifico únicamente TablaOfertas como fuente
productiva. Dashboard, PanelControl, Preferencias y DetalleOferta quedan intactos.
La exploración y los renders históricos previos están en
[preparacion-historica.md](preparacion-historica.md).

Verificación del **working tree**, con HEAD de preparación
`ec5a68d402c85e9c995a8031165b8e7b2a0a8daf`, no de ese commit limpio ni de un SHA futuro.
[fuentes-verificadas.sha256](fuentes-verificadas.sha256) identifica los diez archivos
de fuente/tests cambiados que verificaron las suites finales. Después sólo agregué
esta documentación. La revisión independiente, Git y la entrega de la PR son del padre.

### Cambio visual y funcional

- Compacto paddings/ancho de columnas dentro de TablaOfertas, sin cambiar estilos globales.
  Título, empresa y ubicación ajustan texto extenso; fechas conservan contexto y tooltip.
  A 1024 px uso scroll interno de PrimeNG, no oculto plataforma, match ni fechas.
- Integro selección al encabezado de la tarjeta, con label de 44×44 px, sin una fila
  redundante de navegación. Mantengo el checkbox visual discreto y la selección resaltada.
  El nombre accesible original `Oferta: …` permanece compatible con #50.
- Conservo dos barras independientes sólo con selección. No altero su validación,
  confirmación, límites, bloqueo ni payload. No agrego una confirmación de postulación
  que no existía: reevaluación conserva su confirmación explícita y ambas acciones
  mantienen sus cancelaciones disponibles.
- Reutilizo un template local para evaluación, prioridad y vigencia. Oculto el score
  pendiente/solicitado, no finito o fuera de 0–100; rechazo alto no es verde. Ante error
  muestro contexto y diagnóstico desplegable, sin volcar una traza larga de entrada.
  Si hay firma previa o resultado histórico fechado independiente del fallo, rotulo
  `Resultado anterior conservado`; no lo presento como una evaluación nueva.
- Mantengo una sola apertura de detalle por tarjeta. Ignoro repetición de tecla y
  eventos de hijos; checkbox, selector y diagnóstico no abren el modal. Preservo
  overlay en body y retorno de foco tras Escape.

## Comparación equivalente y matriz real

Los pares `antes-equivalente-{ancho}-{tema}.png` /
`despues-equivalente-{ancho}-{tema}.png` usan exactamente:

- Angular integrado en `http://127.0.0.1:4351/?detalle=aprobada&tema={tema}`;
- fixture original `crearOfertasDetalle('aprobada')`, dos ofertas, pestaña Aprobadas;
- viewport nominal exacto, reloj fijo `2026-01-15T18:00:00Z`, scroll inicial 0;
- Chrome headless, reduced-motion, service workers bloqueados y recursos externos abortados;
- método `page.screenshot({ fullPage: true, animations: 'disabled' })` de `comparar.cjs`.

No sobrescribo las capturas iniciales del padre de ancho nominal menos 4 px; estos
pares nuevos sí tienen el ancho exacto. Inter/JetBrains y Material Symbols remotos
no cargan: se ven fallback y nombres de iconos, no una equivalencia pixel-perfect
con fuentes de producción. La altura de página puede crecer por el contenido; no
confundo el viewport con el tamaño full-page del PNG.

`antes-equivalente-medidas.json` y `despues-equivalente-medidas.json` contienen las
mediciones. En claro y oscuro los resultados de geometría coinciden:

| Viewport | Vista | Filas/cards ANTES (px) | DESPUÉS (px) | Overflow de página |
|---|---|---:|---:|---|
| 1440×900 | Tabla | 136.95 / 136.95 | 100.78 / 80.31 | No / No |
| 1024×768 | Tabla | 193.92 / 173.45 | 100.78 / 80.31 | No / No |
| 768×900 | Cards | 181.09 / 182.09 | 151.77 / 152.77 | No / No |
| 390×844 | Cards | 264.16 / 265.16 | 261.75 / 244.84 | No / No |
| 320×844 | Cards | 322.70 / 323.70 | 339.48 / 304.67 | No / No |

La primera tarjeta a 320 px **no es más baja**: selección al costado reduce ancho
de texto y ahora también conservo publicación aproximada. Priorizo información y
controles utilizables sobre una reducción artificial de altura. No recorto títulos
ni elimino fechas para mejorar ese número.

Inspeccioné manualmente los PNG de comparación desktop1440 claro, mobile390 oscuro,
mobile320 claro y tablet1024 oscuro, además de desktop histórico732. La tabla queda
más densa y conserva el carácter mono/bordes discretos; a1024 las columnas finales se
consultan con scroll **dentro** de tabla. Las tarjetas no solapan texto/selección.
No afirmo auditoría manual exhaustiva de cada imagen: el resto tiene comprobaciones
geométricas E2E. La referencia histórica es un componente aislado, no la página
integrada actual, y sólo orienta identidad/ritmo (ver sus limitaciones en T1).

### Fixture de riesgo separada

`?tabla=1` usa **56 ofertas**: 45 Angular junior en varias páginas más aprobación,
rechazo alto con exclusión Java, pendiente con97 viejo, error técnico sin score,
reevaluación fallida conservada, desactualizada en cola, histórica sin firma,
CV enviado, en proceso, descartada, sin compatibilidad y texto extremo sin espacios.
Fijo reloj y fechas recientes en octubre2026 para no invalidar reevaluaciones por
la antigüedad de la fixture comparativa de enero. Cada prueba tiene servidor sintético
independiente; registro método/ruta/cuerpo/IDs y simulo primer fallo bulk recuperable.

`matriz-extremos-{ancho}-{tema}.png` representa diez pruebas de la fixture nueva,
**no** una comparación con las imágenes ANTES aprobadas. Cubro los cinco tamaños y
ambos temas, texto completo, overflow de página ausente y scroll desktop contenido.

Los renders completos preexistentes de detalle/dashboard se mantienen sin nuevas
combinaciones de CI. Tras la autorización B sólo redirijo sus destinos:
`frontend/.angular/issue51-historico/{detalle,dashboard}/` para los renders locales,
`detalle/despues/` aquí para cuatro representantes y `matriz.json` (90/90 detalle).
No cambio ninguna assertion. No borro imágenes existentes ni otros artefactos.
El runner sigue usando `frontend/test-results/`, sin nuevas workflows.

## Recorridos mínimos S10 y preservación S5/S7

Los 26 casos nuevos de `frontend/e2e/tabla-ui.spec.ts`, más las regresiones existentes,
cubren estos veinte recorridos sin acceso a servicios reales:

| Recorridos | Evidencia |
|---|---|
| 1 Buscar desktop | Título, empresa, ubicación, mayúsculas, acentos y espacios mediante contains de PrimeNG |
| 2 Plataforma y pestaña | LinkedIn, cambio de categoría y selección invalidada |
| 3–5 Selección/página | Vacía/parcial/completa, 20 visibles, página final de5 e IDs1041–1045 |
| 6–7 Acciones masivas | Cancelar sin escritura, fallo y reintento PATCH, confirmación/cancelación de reevaluación POST y doble clic sin doble envío |
| 8–9 Tabla/detalle | Abrir desde botón, cerrar Escape y foco restaurado |
| 10–13 Cards | 390/320, Space en checkbox sin modal, selector por teclado/overlay en body, Escape y paginador a tercera página |
| 14 Limpiar | Sin coincidencias → limpiar filtros conserva comportamiento |
| 15 Estados | Sin datos, categoría vacía, filtro vacío, carga y error de sincronización |
| 16–18 Matriz | Títulos/empresas sin espacios, sin overflow global y ambos temas en cinco tamaños |
| 19 Sin escrituras | Registro de cuerpos vacío en navegación, selección, búsqueda y apertura/cierre |
| 20 Compatibilidad #50 | Modal real, datos conservados, teclado/foco y 90 renders de regresión originales |

Además pruebo refresco con selección estable y reducción de45 a15 mientras estoy en
página3: ajusto página, invalidación y desaparece el paginador sin POST/PATCH.
`issue-21.spec.ts` permanece intacto y pasa en la suite completa; conserva pruebas
para máximo200, IDs inválidos/históricos, bloqueos incompatibles, contains, orden,
rollback y páginas que dejan de existir. No inflo la matriz cruzando todos los estados
por todos los dispositivos.

## Verificación observada y fallas corregidas

Todos los comandos se ejecutaron en foreground. Los comandos npm parten de `frontend`.
No hay tests omitidos nuevos ni assertions existentes relajadas.

| Comando | Resultado observado |
|---|---|
| `npm test -- --watch=false --browsers=ChromeHeadless --include src/app/componentes/tabla-ofertas/tabla-ofertas.spec.ts` | RED exit1:10 fallas esperadas/16 éxitos. GREEN exit0:26/26 |
| `npm test -- --watch=false --browsers=ChromeHeadless --include src/app/componentes/tabla-ofertas/tabla-ofertas.spec.ts --include src/app/paginas/dashboard/reevaluacion-flujo.spec.ts` | Exit0:45/45, después de corregir contrato histórico fechado |
| `npm run test:e2e -- e2e/tabla-ui.spec.ts` | Final targeted exit0:26/26,50.3s |
| `npm run test:e2e -- e2e/detalle-capturas.spec.ts --grep '768\|390\|320'` | Exit0:54/54,1.2min, prueba focal de la corrección del nombre accesible |
| `npm test -- --watch=false --browsers=ChromeHeadless` | Final exit0:561 aprobados,4 omitidos heredados,565 declarados |
| `npm run test:e2e` | Final exit0:198/198,5.7min, sin omisiones ni retries |
| `npm run build` | Exit0;664.53kB inicial; warning de presupuesto de Preferencias descrito abajo |
| `git diff --check` | Exit0, sin salida |
| `node frontend/.angular/issue51-historico/comparar.cjs antes` | Exit0:10 capturas equivalentes previas |
| `node frontend/.angular/issue51-historico/comparar.cjs despues` | Exit0:10 capturas finales y medidas; una captura intermedia se regeneró al mejorar anchos desktop |

Intentos previos, **no** resultados del candidato final:

1. Primer focused E2E no descubrió tests por importar una fixture Angular desde el
   runner Node (JIT de HttpClient). Separé la fecha fija; no incorporé compilador al runner.
2. Focused25 tuvo6 fallas: esperaba selección antes del filtro diferido, copiaba un
   estado de sincronización equivocado y detectó texto fallback de chevron tapando
   el botón vecino a320px. Corregí esperas por DOM, texto observado y contención del icono.
   Luego24/25: el selector de plataforma también contaba badgeIA y metadata oculta;
   lo acoté a su columna. El nuevo caso de refresco completó los26 finales.
3. Primera suite Angular completa:559 éxitos,1 falla,4 omitidos. Una regresión existente
   exigía conservar el resultado anterior con `fecha_evaluacion` sin firma. Restauré
   ese contrato y añadí su regresión local, sin modificar el test anterior.
4. Primer E2E completo quedó interrumpido a300s durante el caso38/198, con timeouts
   móviles por el aria-label cambiado. No lo atribuí al ambiente: restauré `Oferta:`,
   probé54 móviles y recién repetí el completo con timeout de1200s (terminó en5.7min).
5. Antes de B, la suite automática escribió tres artefactos tracked de issue50.
   B redirigió exclusivamente las salidas para no repetir esa contaminación.
   **Queda al padre restaurar exactamente** `docs/evidencias/issue-50/despues/`:
   `aprobada-1440x900-claro.png`, `aprobada-1440x900-oscuro.png` y `matriz.json`.
   El worker no ejecuta git restore ni altera evidencia previa por otro medio.

### Omisiones heredadas exactas

Las fuentes son idénticas a HEAD; requieren harness vertical opt-in, no servicios
productivos accesibles a esta suite:

- `frontend/src/app/paginas/dashboard/issue-22-vertical.spec.ts:14`: selector describe/xdescribe;
  único caso en`:102`, «guardo la histórica por HTTP, sincronizo, recargo IndexedDB y
  cambio estado/reaparición sin perder día ni nota».
- `frontend/src/app/paginas/dashboard/busquedas-vertical.spec.ts:16`: selector describe/xdescribe;
  caso`:109`, «QA guardado → ciclo parcial real → omisiones explícitas → ofertas y refresco final»;
  bucle`:143–144`, dos casos «guardo preferencias → individual → oferta persistida → evento → DOM/conteos»
  y «guardo preferencias → ciclo 202/poll/evaluación → oferta persistida → evento → DOM/conteos».

### Inventario de warnings y errores de prueba

- Angular/Karma:404 de `/base/media/primeicons.{woff2,woff,ttf}`. No cambio imports,
  fuentes ni configuración Karma; también aparecieron en la ejecución anterior.
- Logs de error esperados por tests existentes: guardar descripción; preferencias500;
  sincronización/carga Dashboard500; fallback «sin cursor» en `dashboard.spec.ts:197`.
  Warnings de polling de ciclo/evaluación por429 seguidos provienen de pruebas de error.
  No son tests fallidos ni solicitudes a un backend real.
- Build: `src/app/paginas/preferencias/preferencias.css exceeded maximum budget`:
  presupuesto15.00kB, tamaño15.61kB, exceso610bytes. Esa fuente/configuración queda
  intacta; no hice un build limpio de la base para cuantificarlo por separado.
- Los warnings de instalación inflight/rimraf/glob/@primeng/themes/allow-scripts fueron
  informados por el padre como previos. No ejecuté instalación ni modifiqué dependencias.
- Sin warnings nuevos de build de TablaOfertas observados. No equiparo «sin fallas»
  a «sin mensajes de diagnóstico».

## Cobertura S# y límites de entrega

- **S1,S3,S4**: identidad conservada, tabla/cards adaptadas, controles y estados comprobados.
- **S5,S7**: lógica #21 preservada; regresiones y E2E de filtro/página/selección/refresco/bulk.
- **S6**: pendiente con97 oculto; rechazo88 no verde; error, cola, anterior y desconocida separados.
- **S8,S10**: recorrido integrado y veinte journeys anteriores, sin modificar fuentes de otras pantallas.
- **S11**: suites y build finales aprobados; cuatro omisiones heredadas explicitadas.
- **S12**: pares equivalentes, matriz extrema e historia con sus condiciones y limitaciones.
- **S13**: fuentes restringidas respetadas; pendiente sólo recuperación Git de tres artefactos
  generados, acción del padre. No hubo cambios de backend, matching, proveedores ni producción.
- **S2/S9** aportan contexto/matriz histórica previa y matriz integrada presente; **S14/S15**
  siguen en revisión independiente/entrega del padre. No declaro finalizada toda la issue ni la PR.

No usé Firebase, credenciales, DeepSeek, scrapers ni servicios reales. No probé Safari,
Firefox, lector de pantalla real, login autenticado ni un dispositivo físico. La revisión
MCP final del padre y la revisión independiente todavía deben contrastar esta evidencia.
No agregué dependencias, workflows ni un segundo framework E2E.

## Key Learnings

- La densidad desktop dependía de paddings globales `!important`: el override local evita
  cambiar el resto de la aplicación; no alcanza con bajar font-size en una clase débil.
- Un label real de44px preserva el checkbox visual de18px y sí amplía el área táctil;
  margin13px por sí solo no lo garantizaba.
- El nombre accesible puede ser un contrato compartido de tests y navegación: restaurarlo
  fue la solución mínima, no reescribir el helper de detalle.
- Esperar sólo las cards no alcanza: el filtro desktop oculto sigue siendo diferido y
  puede invalidar selección. Pruebo el DOM efectivo de PrimeNG, sin sleeps arbitrarios.
- Las capturas de otra issue pueden tener efectos laterales del runner: redirijo artefactos,
  nunca confundo un cambio de captura con un cambio en DetalleOferta.

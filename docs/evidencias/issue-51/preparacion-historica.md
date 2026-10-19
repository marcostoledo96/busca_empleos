# Issue #51 — Preparación histórica (T1)

## Alcance y condiciones

Inspeccioné los HTML/CSS completos con `git show` de `73284da5463c916772274456a48ecedd19c9a608` y `b6c102f42fa2`, además de sus componentes TypeScript y los estilos globales. Rendericé **TablaOfertas aislada**, no la aplicación histórica completa ni su Dashboard. No modifiqué el worktree histórico ni fuentes actuales.

Conservo Busco Trabajo, PrimeNG y la identidad The Silent Processor. Las recomendaciones genéricas de las skills no autorizan cambiar Inter, colores, tipografías o biblioteca.

### Harness local ignorado

- Ubicación: `frontend/.angular/issue51-historico/`; `.gitignore` interno con `*` (la regla existente sólo ignoraba `.angular/cache` y otros directorios puntuales, no todo `.angular`).
- Copié el componente, template, CSS y estilos globales de cada referencia desde objetos Git. HTML/CSS históricos sin ajustes. Estilos globales idénticos entre ambas referencias según `git diff`.
- Ajusté únicamente imports TypeScript: `Oferta` y configuración de plataformas apuntan a módulos actuales mediante `../../../src/app/...`; el servicio apunta a `../servicio-aislado`. Este adaptador DI rechaza escrituras, no importa configuración productiva ni inicializa servicios externos.
- Monté un contenedor de 1280px máximo, padding 24px/16px, análogo al harness E2E existente; sin Dashboard, tabs ni DetalleOferta. Cabecera agregada explícitamente como referencia aislada.
- Reutilicé Angular 20, PrimeNG/Aura y Playwright instalados, `crearOfertasDetalle('aprobada')` actual sin copiar ni alterar su contenido. Las versiones de dependencias **no son un lockfile histórico**. Sin segundo framework E2E.
- Servidor HTTP efímero en loopback, cerrado en `finally`; sin esperas artificiales ni polling de servidor. Navegador Chrome headless, movimiento reducido, service workers bloqueados y solicitudes externas abortadas.
- No cargué fuentes remotas: Inter/JetBrains Mono son familias declaradas con fallback local; Material Symbols se ve como texto (`location_on`, `open_in_new`). **No es una referencia pixel-perfect de fuentes/iconos históricos**. No atribuyo esa diferencia al código actual.

## Evidencia real y matriz

`historico-medidas.json` registra 20 renders: dos referencias × claro/oscuro × 1440×900, 1024×768, 768×900, 390×844 y 320×844. En esos casos, con estas dos ofertas aprobadas: cero excepciones de página, cero overflow horizontal de página. Esto no prueba textos extremos, overlays, muchas páginas ni otros estados históricos.

Ocho PNG `historico-{732,b6}-{1440,390}-{claro,oscuro}.png` conservan capturas representativas. Inspeccioné visualmente las referencias móviles claras de ambos commits, móvil oscuro 732 y desktop claro 732. Los otros PNG son capturas reales, no una auditoría manual exhaustiva.

Las capturas `antes-1440-claro.png` y `antes-390-claro.png` fueron provistas por el padre, no generadas por este trabajo. Sus tamaños PNG reales son **1436×1590 y 386×2238**, respectivamente: son full-page y difieren 4px del ancho nominal. No las sobrescribí. Para el ANTES/DESPUÉS final conviene fijar exactamente viewport, fuente, scroll, pestaña, datos y método de captura. **No comparar la altura total del componente aislado contra la página integrada como si fueran el mismo recorrido.**

`actual-diagnostico.json` agrega mediciones del Angular integrado real en `http://127.0.0.1:4351/?detalle=aprobada`, a 1440×900 y 390×844. Cero overflow de página para esa fixture. El diagnóstico adicional `diagnostico-actual-pendiente-390.png` es un recorte del listado visible (320×428), no una captura full-page ni una propuesta DESPUÉS.

## Diferencias concretas y tokens que conservo

| Aspecto | Histórico | Actual / orientación mínima |
|---|---|---|
| Superficies | Blanco `#fff`, bajo `#f8fafc`; oscuro `#131313`/`#1b1b1b` | Mantener tokens existentes, sin fondos nuevos ni sombras decorativas |
| Texto y bordes | Claro `#0f172a`/`#64748b`, borde `#e2e8f0`; oscuro `#e2e2e2`/`#c6c6c6`, borde `#474747` | Jerarquía por peso, agrupación y separadores, no por nuevas cajas |
| Radios y ritmo | 2/4/8px; sección 24px; transición 150ms | Mantener precisión editorial y reduced-motion |
| Tipografía | Título desktop 12.8px/500; móvil 12.8px/600, línea 1.3; empresa mono 11.2px; labels 10px; tags 9px | Ya comparte gran parte del CSS: no hace falta reescribirlo. Revisar legibilidad/contraste sin copiar ciegamente texto diminuto |
| Match | Desktop 16px; móvil 17.6px/700, `%` 10px; verde alto desde 70, rojo bajo de 40 | No confundir color de porcentaje con aprobación. Rechazo/exclusión debe conservar primacía semántica |
| Tarjetas | Lista continua sin gaps, borde 1px; padding móvil 12px; metadata gap 8px; footer gap 6px | Mantener lista compacta; reagrupar controles y metadatos, no borrar avisos |
| Altura móvil 390 | 732: 177.72/178.72px; b6: 161.09/178.72px | Actual integrado: 264.16/265.16px. Sólo comparación orientativa: contenedores, fuentes e información no idénticos |
| Densidad funcional | Sin selección móvil ni vigencia; fecha única; b6 sin IA visible | Actual agrega fila de selección de 44px, vigencia como bloque con márgenes 6.4px, reaparición y select desplazado. No recuperar densidad eliminando estas funciones |
| Desktop | 732: filas aprox. 92–105px en componente aislado, título/ubicación + empresa mono + tags discretos | Actual integrado: 136.95px ambas filas. Fecha de detección/reaparición/publicación ocupa varias líneas; vigencia suma altura |
| Responsive | Switch ≤768px. b6 mantiene tabla ancha en tablet; 732 oculta plataforma/match/fecha en 769–1024 y mueve metadata bajo título | Conservar contenido significativo y scroll interno si es necesario; no esconder porcentaje/avisos sin alternativa. `:deep` histórico no es una solución Angular válida para encapsulación |
| Paginación | b6: 10 elementos y todos los números; 732: 20 y ventana de 5 | No retroceder a b6: conservar 20, ventana acotada y validación de página actual |
| Selección | Históricos seleccionan `ofertas()` completas; mobile no permite selección individual | No copiar TypeScript histórico: revertiría protecciones #21. Conservar IDs visibles, filtros, invalidaciones, confirmaciones y bloqueos actuales |

La primera tarjeta 732 es más alta que b6 por el badge IA en el encabezado, que resta ancho al título. El orden visible también difiere: la fixture histórica mantiene el orden de entrada en mobile; Dashboard actual ordena las dos ofertas antes de entregarlas. Comparar por ID/título, no por posición.

## Cambios mínimos sugeridos para T2 (sin implementarlos)

1. Conservar CSS/base PrimeNG y reordenar solamente la información de TablaOfertas: título/empresa como núcleo, porcentaje válido compacto a la derecha, metadata secundaria agrupada, evaluación y seguimiento diferenciados. Incorporar selección en ese esquema manteniendo label táctil real de 44px, no una fila redundante de navegación. El `margin:13px` de un checkbox histórico de 18px no garantiza hit area de 44px.
2. Mantener ambos controles masivos contextuales, cuenta, cancelar y confirmación. No alterar helpers de selección/filtro/paginación/reevaluación por una captura más limpia.
3. Acotar ancho mínimo de hijos y permitir wrapping de título/empresa/ubicación/avisos sin espacios. No usar `overflow-x:hidden` para esconder información o recortar focus rings; en tablet limitar scroll a la región real `.p-datatable-table-container`. Confirmar en DOM los selectores, no copiar `:deep(.p-datatable-wrapper)` histórico.
4. Preservar fecha de detección, reaparición y publicación aproximada, agrupadas y con contexto accesible. Mantener errores críticos visibles en resumen, detalle diagnóstico accesible sin volcar trazas extensas.

### Matching y resultados antiguos: defecto reproducido

En Angular actual, `?detalle=pendiente`, pestaña PENDIENTES, muestra **97% verde + PENDIENTE + Sin evaluación**. La fixture trae porcentaje antiguo y estado pendiente. Lo capturé en `diagnostico-actual-pendiente-390.png`; no es una inferencia del código.

TablaOfertas hoy comprueba sólo `porcentaje_match !== null`; DetalleOferta ya dispone de `compatibilidadVigente`: valor finito 0–100, estado no pendiente, sin marcador `REEVALUACION_SOLICITADA`, y sin error técnico salvo firma de criterios conservada. Tomar esa regla como referencia para la presentación, sin tocar algoritmos de matching ni DetalleOferta. Agregar distinción explícita de vigencia `anterior`/`desconocida`: no convertir el porcentaje viejo en un resultado actual válido; si se muestra, rotularlo como anterior/desconocido y quitar énfasis de aprobación. La firma permite conservar evaluación anterior ante fallo, pero no transforma el error en una evaluación nueva.

Separar Error técnico de Rechazada, y evaluación anterior conservada de resultado nuevo. `textoVigencia` actual devuelve primero «Sin evaluación» para cualquier pendiente, por lo que puede ocultar contexto de desactualización. `etiquetaEvaluacion` del detalle distingue error técnico con pendiente o sin firma. Prioridad IA no aprueba una oferta y un 88% rechazado por Java sigue rechazado. Probar pendiente con 97, error sin porcentaje, reevaluación fallida con firma, marcador solicitado, vigencia anterior/desconocida y rechazo con exclusión.

### Teclado/foco móvil

Reproduje en el Angular integrado a 390px: foco en la primera tarjeta → Enter → diálogo → Escape. Al cerrar, `document.activeElement` vuelve a `ARTICLE.card-oferta`; **ese recorrido funciona**, no justifica modificar DetalleOferta.

Conservar `stopPropagation` tanto en clic como en keydown de checkbox/label y p-select (los históricos sólo lo hacen para click del select). Si se reorganiza la card, limitar la activación por Enter/Space al disparador de apertura, sin interceptar teclas de hijos ni ejecutar dos veces la acción. No agregar un segundo circuito de enlaces/tabulación dentro de la tarjeta. Mantener foco visible dentro del borde sin clipping, targets táctiles reales, overlay `appendTo="body"`, y retorno de foco al disparador que realmente abrió el modal. Probar Tab/Space en checkbox, Enter/Space en tarjeta, teclado de select y Escape desde overlay y modal; no considero esas pruebas completas con el único recorrido observado.

## Comandos y resultados observados

Todos en foreground, sin instalaciones, commits ni cambios de dependencias:

- `node frontend/.angular/issue51-historico/preparar.cjs`: exit 0; copias históricas y baseline SHA-256.
- `cd frontend/.angular/issue51-historico && node ../../node_modules/@angular/cli/bin/ng.js build 732`: exit 0; 3.30 MB, 3.532s; sin warnings observados.
- `cd frontend/.angular/issue51-historico && node ../../node_modules/@angular/cli/bin/ng.js build b6`: exit 0; 3.29 MB, 3.001s; sin warnings observados.
- `node frontend/.angular/issue51-historico/capturar.cjs`: exit 0; 8 capturas, 20 renders, cero excepciones y overflow para la fixture aprobada.
- `node frontend/.angular/issue51-historico/actual.cjs`: primer intento exit 1, strict locator `.cards-contenedor` resolvió cinco listas montadas. Corregí el diagnóstico para usar `:visible` y seleccionar la pestaña PENDIENTES; segundo intento exit 0, mediciones/foco/97% confirmados. No cambié el producto para hacer pasar el diagnóstico.
- `node frontend/.angular/issue51-historico/verificar.cjs`: exit 0; 140 fuentes tracked con SHA-256 idéntico y 11 PNG válidos presentes (2 previos, 8 históricos, 1 diagnóstico).
- `git diff --check`: exit 0, sin salida. `git diff --name-only`: sin salida; `git status --short` mantiene únicamente los directorios/archivo untracked de evidencia y ODD ya presentes, sin modificaciones tracked.

El primer `git check-ignore frontend/.angular/issue51-historico/prueba` dio exit 1 antes de crear el ignore interno; luego dio exit 0. No se borraron ni reemplazaron archivos ajenos.

## Cobertura y pendientes

Preparación de S1–S2 y S12; matriz histórica proporcional para S9; límites de S13 respetados; trabajo delegado y hallazgos para S14. No doy por satisfechas implementación ni matriz integrada final S3–S11, revisión independiente S14 ni entrega S15. CodeGraph fue realizado por la exploración previa informada por el padre; este worker no tuvo una herramienta CodeGraph disponible ni generó otro índice.

No corrí suites de aplicación ni build productivo: tarea de preparación sin cambios de comportamiento. No hay RED/GREEN aplicable al producto; el harness contiene asserts de dos ofertas por render, ausencia de excepciones y verificación de bytes. Squirrelscan no se instaló ni ejecutó.

## Key Learnings

- La identidad histórica ya sobrevive en gran parte del CSS actual; el crecimiento de altura viene principalmente de nueva información y controles que deben preservarse y reagruparse.
- b6 no es un baseline funcional seguro: 10 filas, paginador ilimitado y selección sobre el conjunto completo; 732 tampoco contiene las protecciones actuales de #21.
- El porcentaje pendiente antiguo es un defecto visible reproducible; copiar el estilo histórico sin corregir presentación mantendría ese problema.
- La comparación histórica es útil para jerarquía/densidad del componente, no para medir la altura total de la página ni prometer equivalencia tipográfica con fuentes remotas bloqueadas.

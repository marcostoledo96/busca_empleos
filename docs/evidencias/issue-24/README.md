# Evidencia sintética de impresión de la PR #44

## Archivos accesibles

- [CV corto: 1 página A4](cv-corto-sintetico.pdf).
- [CV largo: 5 páginas A4](cv-largo-sintetico.pdf).
- [Montaje de las seis páginas](paginas-a4-sinteticas.png), de izquierda a derecha: corto, largo 1–5. Para inspeccionar cortes o letra en detalle, usar el PDF original a tamaño real.

Son datos completamente ficticios de **Alex Ejemplo**, instituciones y empleadores sintéticos. No son el CV del propietario ni datos de producción. Los enlaces `localhost` son ejemplos, no destinos que deban estar disponibles para revisar el documento.

## Procedencia y alcance exactos

Publico los PDF originales de la verificación previa, sin regenerarlos ni atribuir al auditor una inspección que no realizó. Se obtuvieron con el código funcional de `6a6799009465e5ffc976a5bcd04b623a3b34f681`, conservado en el HEAD auditado `8e4b38b2b1ca13a337caf9ad959b44d04670952e` (los commits posteriores a ese cambio sólo modificaban ODD).

Método: App y Cv reales renderizados mediante Angular TestBed, dos GET simulados con datos sintéticos, selección y revisión por DOM; HTML inerte serializado con sus estilos de componente y CSS global del build. Playwright Chromium **155** con tema oscuro, `preferCSSPageSize: true`, A4 y encabezados/pies del navegador desactivados. No se enviaron datos a Firebase, DeepSeek, backend ni servicios de almacenamiento.

El ajuste B-01/P3 publicado junto a estos archivos afecta el bloqueo del botón/método de impresión durante una recarga y el aviso del editor. **No cambia el artículo imprimible ni su CSS.** Los PDF acreditan la geometría anterior que sigue sin cambios, no una nueva generación desde el SHA correctivo. El comportamiento nuevo se verifica con los tests de `cv.spec.ts` y la CI de ese SHA.

## Comprobaciones observadas

- Inspección visual del autor de las seis páginas: fondo blanco pese a tema oscuro, cuerpo de 11 pt, sin navegación/controles, primera página vacía ni superposición observada. Bloques largos fragmentados, breves conservados y títulos legibles.
- `pdfinfo`: A4, corto **1 página**, largo **5 páginas**, sin JavaScript.
- `pdftotext -layout`: **6/6 páginas con texto**, nombre al comienzo de la primera y marcador final en la última; **34/34** registros largos completos y en orden.
- `pdftotext -bbox`: texto dentro de márgenes horizontales de **17 mm** y verticales de **16 mm**, tolerancia de 1 punto. Se comprobó también en la revisión independiente anterior.
- Al publicar estos archivos volví a comprobar páginas, nombre, marcadores, los 34 registros y ausencia del shell/notas privadas en su texto. El montaje se creó desde los seis PNG originales, no desde una maqueta nueva.

No se probaron otros navegadores, el diálogo físico del sistema ni una sesión integrada con Firebase/backend/PostgreSQL desde el navegador. Esto no certifica un PDF arbitrario ni reemplaza la revisión humana del CV.

## Integridad de los PDF originales

SHA-256:

```text
af322718bafb73b23a0764612cc174e4891703d52cc899013df52809f0e2b9c2  cv-corto-sintetico.pdf
641306d6f64a44cb8fcf7dc3656131005c965d0e5760001e2d918c058d3636d5  cv-largo-sintetico.pdf
```

Para una comprobación propia: descargar los PDF, verificar `sha256sum`, abrirlos a tamaño real y ejecutar `pdfinfo`, `pdftotext -layout` o `pdftotext -bbox`. Los resultados del autor son evidencia entregada, no deben presentarse como ejecución propia de otro auditor.

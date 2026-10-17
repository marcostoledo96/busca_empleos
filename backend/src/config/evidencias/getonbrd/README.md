# Evidencia de búsqueda pública Get on Board

Conservo extractos literales acotados de documentación oficial para respaldar únicamente
la búsqueda personal de ofertas públicas publicadas mediante `GET /api/v0/search/jobs` en
`https://www.getonbrd.com`. No representan una autorización privada ni una aprobación de
un producto, redistribución, explotación comercial o volumen ilimitado.

## Procedencia verificable

`evidencia.json` registra por archivo la URL oficial, fecha UTC real de recuperación, tamaño
UTF-8 y SHA-256 de los **bytes conservados**. Los `.extracto.txt` son fragmentos literales
HTML/YAML/índice separados por saltos de línea; **no son páginas completas**, y sus hashes
no se presentan como hashes de las páginas originales. No guardo HTML masivo ni datos de ofertas.
Las fechas proceden del reloj UTC del entorno de recuperación, no de una fecha editorial.

| Extracto | Qué respalda |
| --- | --- |
| `manual.extracto.txt` | API pública abierta sin login, recursos publicados y búsqueda textual; distingue API privada. |
| `ayuda.extracto.txt` | Uso público para estudiar información visible del mercado laboral sin iniciar sesión. |
| `indice.extracto.txt` | Índice técnico oficial que referencia OpenAPI. |
| `openapi.extracto.txt` | Host productivo, sandbox oficial, distinción público/privado, ruta y parámetros; `per_page` máximo 120. |
| `terminos.extracto.txt` | Licencia limitada y revocable, límites/throttling y restricciones sobre copia, distribución y entrenamiento de modelos. |

Las URLs completas, fechas, tamaños y hashes están en el manifiesto, sin duplicarlos acá.
El texto no publica una cuota numérica de peticiones en los pasajes conservados. Los defaults
2 páginas/20 por página/40 ofertas son presupuestos defensivos locales, **no una cuota autorizada**.
No consta vencimiento documental; por eso el manifiesto no inventa `valid_until`. Si se incorpora
un vencimiento real, la guarda exige que sea una fecha válida y vigente.

## Alcance y restricciones

Uso solo búsqueda pública personal y acotada. Excluyo API privada, datos de postulantes,
aplicaciones, entrenamiento de modelos, redistribución comercial y scraping HTML masivo.
No interpreto los recursos públicos como permiso para cualquier uso. Los términos reservan
al proveedor la limitación o interrupción del acceso; ante HTTP 429 detengo sin reintentos.
Los documentos no acreditan una aprobación específica de futuras funciones del producto.
La evaluación normal existente de la app no se ejecutó durante esta verificación ni se presenta
como validada por el proveedor.

## Obtención y validación

Consulté únicamente las URLs documentales del manifiesto mediante GET. El cliente inicial
`urllib` recibió 403; `curl` con User-Agent de navegador pudo recuperar los documentos.
Hubo consultas documentales exploratorias y una extracción interrumpida antes de conservar
el manifiesto final; ninguna fue una consulta al endpoint de ofertas. No ejecuté smoke real.
La fuente sigue apagada salvo `GETONBRD_ENABLED=true`, independientemente de tener estos archivos.

Prueba offline de integridad y habilitación efectiva:

```sh
cd backend && npm test -- --runInBand tests/config/getonbrd-integracion.test.js
```

La guarda recalcula cada digest desde el archivo en disco. Archivo faltante o modificado implica
bloqueo, no un fallback al dominio sandbox ni una búsqueda vacía exitosa. Conservo este
directorio en `backend/src/config/evidencias/getonbrd/`: acompaña al runtime cuando el root de
despliegue es `backend`, sin copias externas ni pasos nuevos de empaquetado.

También puedo comprobar la guarda desde el root `backend`, sin iniciar Express, cron ni IA:

```sh
node -e "const { validarDestinoGetonbrd } = require('./src/config/getonbrd'); const resultado = validarDestinoGetonbrd({ habilitado: true }); console.log(JSON.stringify(resultado)); if (!resultado.permitido) process.exit(1);"
```

Esta comprobación local no hace solicitudes HTTP ni modifica la habilitación del proceso productivo.

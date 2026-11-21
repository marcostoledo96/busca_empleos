# Consulta pública de ofertas — #98

`backend/src/servicios/servicio-consulta-publica.js` exporta `crearConsultaPublica({ pool, reloj })`. Recibe un pool PostgreSQL inyectado; `reloj` es opcional y devuelve un `Date`. No inicia la aplicación, no agrega una ruta HTTP, no consulta preferencias y no recalcula matching.

- `listar({ texto, nivel, pais, modalidad, dias, limite })`: filtros opcionales. `texto` admite palabras alfanuméricas separadas por espacios, hasta 120 caracteres; todas deben aparecer como palabras en el título, sin distinguir mayúsculas. `nivel`: `trainee`, `junior`, `semi-senior` o `senior`, según el dato normalizado. `pais`: únicamente `Argentina`, respaldada explícitamente por la ubicación almacenada, no por la modalidad ni como prueba de elegibilidad. `modalidad`: `remoto`, `hibrido` o `presencial`. `dias`: entero de 1 a 30 (30 por defecto); `limite`: entero de 1 a 5 (5 por defecto). Se rechazan campos desconocidos.
- `obtenerDetalle(id)`: entero PostgreSQL positivo; devuelve `null` si no existe o no hay enlace público seguro. Agrega hasta 4000 caracteres de descripción pública. Devuelve `descripcion: null` si no está disponible o fue editada manualmente: no se presume que el texto anterior tenga procedencia verificable.

El listado usa publicación conocida en el intervalo UTC `(ahora − dias, ahora]`, sin sustituirla por detección. Lee hasta 200 candidatos ya filtrados por SQL, ordenados por publicación e ID descendentes, descarta enlaces no aptos y deduplica por identidad antes de aplicar `limite`. `alcance` indica la ventana, el límite de página, los candidatos examinados y el posible truncamiento (se alcanzó el tope de candidatos o quedaron ofertas únicas fuera de la página). Una lista vacía no asegura ausencia en toda la base.

La salida distingue publicación, primera y última detección; modalidad y vigencia del aviso pueden ser `desconocida`. Los enlaces HTTP(S) se devuelven, no se visitan. Se descartan si incluyen usuario, contraseña o parámetros reconocidos como credenciales en la consulta o el fragmento. No salen datos crudos, notas, historial, preferencias, archivos de perfil ni evaluaciones. El texto de la oferta sigue siendo dato no confiable. Los errores esperados son `FILTROS_INVALIDOS`, `ID_INVALIDO` y `LECTURA_NO_DISPONIBLE` (sin error interno).

## Prueba focal de lectura

`backend/tests/integracion/issue-98-lectura.test.js` se activa con `ISSUE98_SOCKET` apuntando a un socket de PostgreSQL exclusivo de la tarea, de la forma `/tmp/busca-issue98.XXXXXXXX/socket`. Si no se configura, Jest omite la suite. Usar un checkout limpio sin archivos de entorno, `NODE_ENV=test`, `DB_TEST_SINTETICA=true` y variables PG sintéticas. La preparación del esquema y los fixtures se hace por separado; las consultas medidas usan una sesión PostgreSQL de solo lectura e instrumentación de operaciones, incluida la ruta GET con modelos reales.

En Linux, ejecutar Jest en un namespace sin red (`bwrap --unshare-net`), con el socket de PostgreSQL como vínculo a un contenedor `--network none` con datos efímeros. Verificar que el namespace de Jest solo tenga loopback antes de ejecutar. Desde `backend/`, dentro de ese aislamiento:

```sh
node ./node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath \
  tests/integracion/issue-98-lectura.test.js \
  tests/controladores/controlador-ofertas.test.js \
  tests/servicios/servicio-identidad-ofertas.test.js
```

## Antes de publicar

- Confirmar la raíz efectiva de **cada** proyecto Vercel conectado. La raíz documentada es `frontend`; `frontend/vercel.json` bloquea exactamente `feat/busco-trabajo-mcp` sin modificar los headers. El primer commit debe contener el bloqueo en la raíz efectiva, sin reglas `true` superpuestas. No publicar una referencia remota antes de ese commit.
- En Railway, comprobar que ningún servicio configure un trigger para esa rama y que no puedan crearse PR Environments para esta PR, incluidos los de bots. Seguir `master` en producción no cierra ese control.
- Comprobar exclusión explícita de agentes y automatizaciones externas que puedan quitar Draft, habilitar auto-merge o fusionar. Con los controles acreditados y autorización de publicación, usar una sola PR acumulativa Draft hacia `master`, con auto-merge desactivado.

Esta entrega no expone el transporte ni la autenticación MCP (#99), ni agrega una búsqueda externa (#100).

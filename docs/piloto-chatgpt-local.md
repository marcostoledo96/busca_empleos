# Piloto local de ChatGPT: alcance y puertas de avance

La [issue #104](https://github.com/marcostoledo96/busca_empleos/issues/104) separa la simulación, la prueba con una cuenta real y la integración con Busco Trabajo. Firebase sigue siendo el único inicio de sesión de la app. El piloto no reemplaza DeepSeek, no arranca con el backend y no habilita ejecución automática.

| Escenario | Estado | Qué falta y quién lo verifica |
| --- | --- | --- |
| Ubuntu, manual | Candidato inicial; la simulación no acredita uso real | Marcos confirma condiciones y consentimiento. Luego se verifica el catálogo de la cuenta y, con permiso de consumo, cada inferencia. |
| Ubuntu, programado | Fuera del piloto | Acreditar soporte y condiciones para ejecución desatendida, presupuesto y consentimiento específico. |
| Railway/Vercel, manual | Bloqueado | Marcos debe contar con habilitación y condiciones aplicables de OpenAI para esta app alojada. La guía de VM no acredita esa habilitación. |
| Railway/Vercel, cron | Bloqueado por separado | Además de la habilitación alojada, acreditar ejecución desatendida y obtener permiso específico. |

El [alcance oficial](https://developers.openai.com/siwc/token-sharing-open-source) describe clientes open source/locales y remite las apps pagas o remotamente alojadas a un formulario de interés. No se envió el formulario. El repositorio es público pero no tiene `LICENSE` raíz; el ISC declarado por el paquete backend no demuestra una licencia para todo el proyecto. **No se ha acreditado el encuadre del proyecto ni se adopta una licencia en esta entrega.**

## Conexión y desconexión (solo después de habilitar la prueba real)

1. Iniciá vos el vínculo en Ubuntu. Usá el navegador del sistema, elegí la cuenta y el workspace, y revisá el consentimiento. La autorización vuelve al listener temporal en `127.0.0.1`, no a Angular.
2. En [ChatGPT Settings → Usage](https://chatgpt.com/settings/usage), confirmá el acceso de la app al plan, sus límites y **que los créditos estén deshabilitados**. Ni Firebase, ni la firma del ID token, ni un scope prueban por sí solos la elegibilidad o un modelo disponible.
3. Consultá el catálogo de esa cuenta. Elegí el slug publicado de Luna para ofertas y el de Sol para CV. Si no aparece alguno, frená y revisá alternativas sin sustituirlo automáticamente. El catálogo no demuestra que se pueda completar una inferencia.
4. Para desvincular, detené las solicitudes y cerrá la conexión local al proveedor sin cerrar Firebase. Se intenta revocar el refresh token y retirar los tokens locales. Si no se puede confirmar la revocación, desconectá la app en ChatGPT Settings. No copies los archivos protegidos a Git, al chat, a CI ni al hosting.

Ruta predeterminada del módulo local: `~/.config/busco-trabajo/sesion.json`, con directorio privado `0700`, archivo `0600` y reemplazo atómico. Los tokens no se muestran al navegador ni se almacenan en el frontend. El identificador opaco del host y la referencia de registro pueden sobrevivir a la desconexión sin reutilizar los tokens eliminados. Un solo proceso puede abrir el almacén; si un cierre abrupto deja `propietario.lock`, no vuelvas a vincular ni retires el lock hasta confirmar que no queda ningún proceso propietario. No hay recuperación automática.

No hay botón en Angular: los módulos `backend/piloto-chatgpt/oauth.js` y `responses.js` siguen sin montar en la aplicación. El comando manual documentado abajo usa su propio almacén, inyecta un transporte restringido y ejecuta el catálogo dentro de `sesion.conToken`, con el `AbortSignal` de la sesión. Los futuros llamadores también deben inyectar el transporte y no retener el bearer fuera de `conToken`. Ante `invalid_grant` en el canje inicial, `iniciarVinculo({ reintentar: true })` inicia una autorización nueva, solo por acción explícita, con el ID emitido retenido en memoria. Si otra cuenta se está desvinculando, esperá que termine y solicitá la desvinculación de la cuenta correspondiente: su resultado no se comparte entre cuentas.

## Propuesta para una validación real posterior — no autorizada ni ejecutada

- Ubuntu, proceso manual separado, perfil y ofertas enteramente ficticios. Sin rutas de evaluación, sin acceso a la base de la app, sin trabajos en segundo plano y sin escritura de resultados laborales. Si se usa PostgreSQL para el entorno de prueba, que sea efímero y exclusivo.
- Una consulta de catálogo (`GET /v1/models`) tras el vínculo personal. Después, como máximo **dos inferencias**, una por modelo, sin reintento automático ni fallback. Los intercambios OAuth y la verificación de identidad no son inferencias.
- **Luna:** `Oferta ficticia: Soporte IT Junior, presencial en CABA; Active Directory se menciona sin indicar si es obligatorio. Perfil ficticio: soporte básico, experiencia con Active Directory desconocida. Devolvé únicamente un objeto JSON con estado "por_confirmar" y motivo breve; no inventes experiencia.`
- **Sol:** `CV ficticio: un curso de SQL y tres meses de práctica con un proyecto de clase. No consta nivel de inglés ni modalidad preferida. Devolvé únicamente un objeto JSON con habilidades ["SQL"], ingles null y modalidad null. No guardes ni infieras preferencias.`
- Slugs exactos: pendientes del catálogo. Esfuerzo solicitado en la primera prueba: **omitido**, sin afirmar valor efectivo. El primer request no dará por supuesto `text.format` estricto; solicita JSON y lo valida en servidor. Si hace falta probar parámetros de esfuerzo o Structured Outputs, se define el request y se autoriza el consumo por separado; no se infiere soporte de otra modalidad.
- Observar latencia, evento terminal, validación local, código e ID de solicitud sanitizados, y el cambio visible en Usage si existe. Una diferencia de cuota no observable se registra como **no medida**. Cancelar interrumpe la espera y descarta resultados tardíos; no garantiza recuperar cuota ya consumida. Ante denegación, ineligibilidad, cuota, cancelación o fallo, no enviar la siguiente inferencia automáticamente.

## Ensayo manual aislado — preparación de Fase B

Desde la raíz del checkout, con Node.js y Bubblewrap (`bwrap`) disponibles:

```sh
sh backend/piloto-chatgpt/simulacion.sh
```

El lanzador no admite argumentos ni tiene modo real. Ejecuta las pruebas sintéticas de OAuth y Responses con loopback aislado, entorno limpio y almacenamiento temporal. Solo monta los archivos del piloto necesarios y las bibliotecas de ejecución en modo lectura; no monta el home ni el resto del repositorio. Si el sandbox no arranca, termina con error, sin ejecutar las pruebas fuera del aislamiento.

El ensayo no abre un navegador, no vincula una cuenta ni consulta modelos reales. Tampoco arranca Busco Trabajo, accede a PostgreSQL o consume cupo. Su resultado no acredita elegibilidad ni habilita producción.

## Vínculo personal y catálogo — comando manual

**No se ha ejecutado con una cuenta real.** Usar solo después de autorizar por separado el vínculo para un proyecto personal y local. Requiere Ubuntu, Node.js 24, una terminal interactiva y `xdg-open` para el navegador del sistema. Desde la raíz del repositorio:

```sh
node backend/piloto-chatgpt/manual.js --help
node backend/piloto-chatgpt/manual.js vincular
node backend/piloto-chatgpt/manual.js catalogo
```

`--help` no abre el almacén ni usa la red. `vincular` abre el consentimiento oficial; no imprime la URL ni inicia el catálogo. El titular elige la cuenta y los permisos en el navegador. `catalogo` consulta únicamente `GET /v1/models` y muestra los slugs y nombres visibles; si la sesión lo requiere, puede renovar la credencial. No hay comando de inferencia ni alternativa con API key. No compartir salidas de OAuth ni archivos de sesión.

El almacén de esta CLI es `~/.config/busco-trabajo-catalogo/`, distinto del almacén del módulo por defecto. Para retirar la conexión local, usar `node backend/piloto-chatgpt/manual.js desvincular`; si no se confirma la revocación remota, desconectar la app desde los ajustes de ChatGPT. El vínculo, la renovación y la revocación no modifican Firebase, Railway, DeepSeek ni datos de Busco Trabajo.

## Primera inferencia ficticia — GPT-6-Luna

Solo el titular, desde Ubuntu, después de vincular la cuenta, comprobar que el catálogo muestra `gpt-6-luna` y confirmar en **ChatGPT → Configuración → Uso** que los créditos adicionales de la app están desactivados:

```sh
node backend/piloto-chatgpt/prueba-luna.js --creditos-desactivados
```

El argumento declara esa confirmación humana; el comando no lee el ajuste en ChatGPT. Envía **un solo caso fijo y ficticio**, sin reintento, sin modelo alternativo ni API key. No recibe CV ni ofertas como entrada, no escribe en Busco Trabajo y no inicia el backend. Puede renovar la sesión de ChatGPT ya vinculada, si es necesario. En éxito muestra el modelo, el estado validado y ningún texto del proveedor. Ante error o cancelación, **no vuelvas a lanzarlo**: podría haberse consumido cupo aunque no se haya recibido una salida válida. Si el cambio de cupo no se observa en Uso, se registra como no medido.

## Verificación local de la Fase A

Base: `896752d4816f7303a4fcf4a9dbebdc61e5bc5f47`. Node `24.18.0`. Las pruebas usan datos ficticios y `bwrap --unshare-net` con solo loopback, sin ruta externa. No se arrancó el backend de la aplicación.

| Control | Resultado |
| --- | --- |
| `node --test backend/piloto-chatgpt/{oauth,responses}.node-test.js backend/piloto-chatgpt/oauth.browser-check.js` | Exit 0, 24 aprobadas tras la auditoría de #107: 14 OAuth, 9 Responses, 1 navegador. Incluye Chrome real: redirect simulado, callback real en loopback, consentimiento denegado, sin canje ni salida externa. El check de Chrome requiere Playwright ya instalado, `NODE_PATH` apuntando a sus dependencias de `frontend` y un ejecutable Chrome (`CHROME_BIN` o `/usr/bin/google-chrome`). |
| `NODE_ENV=test ALLOW_DB_TESTS=false npm test -- --runInBand` desde `backend/` | Exit 0, 3973 aprobadas, 166 omitidas (92 suites aprobadas, 11 omitidas), en checkout Git efímero escribible. Los dos ensayos previos fallaron por el entorno de prueba: `git archive` no daba `HEAD` y el montaje de solo lectura impedía a la suite de #59 crear su directorio de evidencia. |
| `npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/interceptores/auth.interceptor.spec.ts` | Exit 0, 10/10 con Firebase simulado (Node 22.22.1, Karma 6.4.4, Chrome 158). Se usó el `environment.ts.example` versionado. Los primeros intentos fallaron por configuración ausente y por el sandbox SUID del lanzador; el ensayo exitoso alojó Chrome en un `bwrap` externo con red, PID, IPC y UTS aislados, sin montar el home del host. |
| Revisión técnica independiente, `gpt-6.2-sol/high` | El primer candidato fue **no apto** por cinco defectos; la reverificación focal dio 20/20. Tras la auditoría de #107, la revisión independiente del diff de corrección dio 23/23 y 3/3 comprobaciones adicionales (exit 0). No es un dictamen de integración ni una revisión Codex. |
| PostgreSQL, lotes, vigencia/caché y editor de CV con proveedor nuevo | No ejecutados. El módulo simulado no monta rutas, no toca PostgreSQL y no está conectado al editor; esas comprobaciones corresponden a la integración condicionada de la Fase C. |
| OAuth, cuenta y catálogo OpenAI reales; inferencia; Firebase real | No probados. No se usaron credenciales, datos personales ni cupo. |

## Contrato y límites

[Responses directos](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference): `store: false`, `stream: true`, `input` como array y éxito solo con `response.completed` más validación del servidor. El esfuerzo y Structured Outputs no son configurables en esta fase: si el llamador pasa `reasoning` o `text`, se rechaza antes de enviar. Un fallo técnico no es una decisión laboral. Un HTTP 401 del proveedor queda como error de dominio con estado local 502. El diagnóstico conserva estado y, cuando son seguros, código e ID de solicitud upstream. Se distingue un cuerpo de admisión `detail` sin conservar su texto. El rol `system` se rechaza antes de llamar a Responses; para instrucciones usá un mensaje `developer`. El código `subscription_sharing_invalid_user` de Responses indica que no se pudo validar el contexto del suscriptor, no que la revocación esté confirmada. Se bloquea la credencial que falló y se conserva el diagnóstico; la siguiente operación explícita solo puede usar el proveedor tras renovar y validar la sesión. La inferencia rechazada no se reintenta. Un fallo temporal de JWKS deja la renovación rotada pendiente en el almacén privado, sin habilitar solicitudes hasta validarla. Un 401 genérico no borra la conexión y una respuesta tardía no afecta una vinculación nueva. Si el refresh confirma que el token renovable ya no es válido, hay que volver a vincular. No se usan endpoints privados, cookies, sesiones de otras apps, API key de OpenAI Platform ni fallback pago.

[Registro y consentimiento](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) · [Sesión y revocación](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions) · [Límites preview](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) · [Errores](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery).

**Publicación:** la [Etapa 0 de #106](https://github.com/marcostoledo96/busca_empleos/issues/106) es independiente. En la base revisada, CI no incluye PRs con destino a la integradora y `frontend/vercel.json` configura COOP, no un bloqueo de previews. La consulta de solo lectura confirmó que el backend de producción en Railway sigue `master`; tras abrir la PR no se observó un entorno efímero de Railway. Vercel generó un preview para la PR #107, que el titular identificó como un entorno separado de producción y autorizó para esta PR. No se cambiaron ajustes externos. Esta autorización puntual no reemplaza el control de previews de futuras PRs. La [calibración #105](https://github.com/marcostoledo96/busca_empleos/issues/105) puede continuar sin OAuth real ni cambios de caché, evaluación o CV de este piloto.

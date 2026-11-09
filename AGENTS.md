# AGENTS.md — Modo de trabajo de Marcos Ezequiel Toledo

> Documento cómo trabajo en este workspace: yo defino el alcance y la IA me ayuda
> a ejecutarlo. Priorizo el cambio mínimo completo, las verificaciones con evidencia
> y las explicaciones claras. Escribo mi código y comentarios en español argentino
> formal; prefiero una interacción directa, respetuosa y sin jerga forzada.

## Tabla de contenidos

1. [Quién soy y qué es este proyecto](#1-quién-soy-y-qué-es-este-proyecto)
2. [Estructura del workspace](#2-estructura-del-workspace)
3. [Autorización y alcance](#3-autorización-y-alcance)
4. [Git workflow](#4-git-workflow)
5. [Entorno y comandos](#5-entorno-y-comandos)
6. [Estilo y seguridad](#6-estilo-y-seguridad)
7. [Verificación según el alcance](#7-verificación-según-el-alcance)
8. [Base de datos](#8-base-de-datos)
9. [Scraping y API de Apify](#9-scraping-y-api-de-apify)
10. [Evaluación con IA (DeepSeek)](#10-evaluación-con-ia-deepseek)
11. [Checklist de cierre](#11-checklist-de-cierre)
12. [Comunicación y aprendizaje](#12-comunicación-y-aprendizaje)
13. [Flujo ODD y herramientas de IA](#13-flujo-odd-y-herramientas-de-ia)
14. [Planes ejecutables y entregas acotadas](#14-planes-ejecutables-y-entregas-acotadas)

---

## 1. Quién soy y qué es este proyecto

Soy Marcos Ezequiel Toledo, desarrollador de software junior, QA Tester y soporte IT,
de Buenos Aires, Argentina.

- GitHub: github.com/marcostoledo96
- LinkedIn: linkedin.com/in/marcos-ezequiel-toledo

### El proyecto: Busca Empleos

Mi sistema automatiza la extracción de ofertas de LinkedIn y Computrabajo mediante
Apify, las evalúa con DeepSeek y muestra los resultados en un dashboard web.
El backend y el frontend Angular ya están implementados; confirmé su funcionamiento
en localhost. Eso no demuestra que el scraping, la evaluación ni las credenciales
actuales de los proveedores funcionen.

**Mi perfil para los filtros de la IA:**

- Nivel: Trainee / Junior.
- Modalidad: cualquiera (remoto, híbrido, presencial).
- Stack: HTML, CSS, JavaScript, TypeScript, C#, SQL, Angular, React, React Native,
  Next.js, Node.js, Express, ASP.NET, PostgreSQL y SQL Server.
- **Excluyo ofertas que requieran Java**, como regla estricta.
- Aplico un **bonus acotado** a ofertas que valoren Next.js o uso competente de IA:
  Claude Code, Codex, OpenCode, Antigravity, Copilot, ChatGPT, LLM, IA generativa,
  prompt engineering y AI tools. **Nunca compensa exclusiones por Java,
  Senior/SR/Lead, más de 3 años excluyentes, idioma o ubicación.**
  Detalles en `docs/evaluacion-ia.md`.

| Capa | Tecnología |
| --- | --- |
| Backend | Node.js + Express |
| Scraping externo | Apify (`apify-client`) |
| Evaluación con IA | API de DeepSeek |
| Base de datos | PostgreSQL en Railway, driver `pg` directo |
| Frontend | Angular 20 + PrimeNG |
| Autenticación | Firebase Auth |
| Pruebas | Jest + Supertest; Jasmine/Karma + Chrome; Playwright E2E |

---

## 2. Estructura del workspace

```text
busca_empleos/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controladores/
│   │   ├── servicios/
│   │   ├── modelos/
│   │   ├── rutas/
│   │   ├── utils/
│   │   └── index.js
│   ├── tests/
│   ├── scripts/
│   ├── package.json
│   └── package-lock.json
├── frontend/                ← Aplicación Angular y pruebas de interfaz
│   ├── src/
│   ├── package.json
│   └── package-lock.json
├── docs/                    ← Documentación técnica y evidencias
├── AGENTS.md
├── AGENTS_init.md            ← Referencia de solo lectura
└── PLANIFICACION.md
```

---

## 3. Autorización y alcance

**No autorizo cambios, mejoras, refactors ni migraciones por iniciativa del agente.**
Antes de escribir, necesito que el alcance y los criterios de éxito estén claros.
Las mejoras ajenas al pedido se proponen, no se implementan de paso.

- Permito la inspección proporcional de archivos relevantes, sin leer secretos ni
  datos personales. No interpretes esto como permiso para ejecutar scripts.
- Si falta una decisión de producto, seguridad o alcance, presentame opciones
  concretas y esperá mi respuesta.
- No ejecutes builds salvo que los pida. Las autorizaciones para commits, push y
  deploy se detallan en la sección 4; los efectos externos, en la sección 7.
- No instales ni modifiques dependencias sin autorización. Para reproducir las
  dependencias bloqueadas, usá `npm ci` en cada carpeta cuando esté autorizado.
  Reservá `npm install` para cambios de dependencias expresamente aprobados.
- Antes de eliminar documentación, código muerto o recursos, listá los candidatos
  con su motivo y esperá confirmación. **Nunca elimines ningún `README.md` ni
  `AGENTS_init.md`; este último tampoco se modifica.**
- Si aparece una preferencia nueva, consultame dónde documentarla antes de hacerlo.
  No modifiques configuración global como parte de una tarea del proyecto.

### Documentación del cambio

Dentro del alcance autorizado, actualizá la documentación relevante junto con el
cambio: API para endpoints, modelo de datos para entidades, servicios para lógica,
frontend para componentes y arquitectura para stack o dependencias. Documentá solo
lo que cambió; si requiere ampliar el alcance, consultame primero.

---

## 4. Git workflow

- Mi rama predeterminada es **`master`**, verificada mediante `origin/HEAD` →
  `origin/master`.
- Uso ramas `feature/nombre-descriptivo`, sin rama `develop`; integro en `master`.
  No requiero PR por defecto, pero eso no autoriza merges automáticos.
- **Cada commit requiere mi aprobación explícita. Push y deploy también requieren
  autorización explícita para su propia acción.** No los deduzcas del permiso para
  implementar o verificar.

Escribo Conventional Commits en español, en imperativo:

```text
tipo(alcance): descripción corta

Cuerpo opcional con detalles del cambio.
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`.
Ejemplo: `feat(scraping): agregar servicio de extracción para LinkedIn`.

---

## 5. Entorno y comandos

Uso npm y los lockfiles de `backend/` y `frontend/`. Angular CLI 20 requiere Node.js
`^20.19.0 || ^22.12.0 || >=24.0.0`; recomiendo Node 22 desde 22.12.0.
La PC auditada usa 22.22.1: es una referencia, no una versión obligatoria.
Mi PostgreSQL actual está en Railway y se configura con `DATABASE_URL`;
no necesito una instalación local como requisito general.

### Comandos habituales verificados en los paquetes

Los comandos se ejecutan **desde la carpeta indicada**. Los prefijos de variables
usan sintaxis de shell POSIX; no son comandos de PowerShell. Esta tabla documenta
cómo ejecutar, no concede autorización para hacerlo.

| Carpeta | Comando | Uso y límite |
| --- | --- | --- |
| `backend/` y `frontend/`, por separado | `npm ci` | Instalación reproducible con cada lockfile; solo si está autorizada |
| `backend/` | `npm run dev` | Servidor con nodemon; puede reanudar automatizaciones |
| `backend/` | `npm start` | Servidor con Node; mismo cuidado con automatizaciones |
| `frontend/` | `npm start` | Servidor de desarrollo Angular |
| `backend/` | `NODE_ENV=test ALLOW_DB_TESTS=false npm test -- --runInBand` | Suite estándar Jest, con las exclusiones indicadas debajo |
| `frontend/` | `NG_CLI_ANALYTICS=false npm test -- --watch=false --browsers=ChromeHeadless` | Suite Jasmine/Karma; requiere Chrome disponible |

El script estándar del backend excluye estos archivos de `tests/integracion/`:
`issue-57-backend.test.js`, `issue-59-proveedores.test.js`,
`issue-61-esquema.test.js` e `issue-61-http.test.js`. Además, puede haber pruebas
condicionales omitidas. **Omitido no significa verificado**: informá el resultado
real del runner, no llames a esta ejecución validación de proveedores reales.
Playwright E2E tiene scripts propios en `frontend/package.json`; revisá su
configuración y efectos antes de proponer su ejecución.

---

## 6. Estilo y seguridad

Escribo nombres propios del proyecto, comentarios, mensajes y documentación en
español argentino formal, como autor del trabajo. Uso primera persona cuando
corresponde en la redacción, no nombres de funciones artificiales. Conservo los
identificadores, contratos e interfaces exigidos por frameworks y terceros.

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| Variables y funciones | camelCase | `ofertasAprobadas`, `evaluarOferta()` |
| Clases | PascalCase | `ServicioScraping` |
| Constantes globales | UPPER_SNAKE_CASE | `PUERTO_SERVIDOR` |
| Archivos y carpetas propios | kebab-case | `servicio-scraping.js` |

- Mi convención es 4 espacios, sin tabs; preservá los contratos y convenciones
  necesarios del framework y evitá reformateos ajenos al pedido.
- Uso `const` por defecto, `let` si necesito reasignar y nunca `var`.
- Prefiero async/await; manejo errores de BD, APIs y scraping con try/catch y
  mantengo los mecanismos existentes de validación y recuperación.
- Uso template literals cuando interpolo valores.
- Valido entradas en los endpoints y uso SQL parametrizado con `pg`.
- **Nunca hardcodeo ni versiono credenciales, tokens o contraseñas.** Uso variables
  de entorno o la configuración segura del despliegue; los archivos `.env` quedan
  fuera de Git. No los leas ni vuelques secretos en logs, respuestas o evidencias.

---

## 7. Verificación según el alcance

Elijo las verificaciones por el comportamiento afectado, no por una obligación de
levantar toda la aplicación después de cada edición.

| Cambio | Verificación proporcionada |
| --- | --- |
| Documentación | Diff, formato, enlaces y referencias locales; no necesita la suite completa |
| Lógica | Prueba enfocada primero y suite relevante después; agrego o actualizo pruebas del comportamiento modificado |
| Interfaz | Pruebas del componente y, cuando corresponda, comprobación de navegador o E2E |
| Integración real | Confirmación previa de destino y efectos; luego evidencia específica, separada de las pruebas con mocks |

Para cambios de comportamiento con pruebas deterministas aplicables, sigo
**RED → GREEN → refactor**: observo primero el fallo esperado, implemento el mínimo
y conservo el comportamiento previo. Si no hay una prueba ejecutable significativa,
explico la excepción y qué comprobación alternativa hice. No invento evidencia.

### Barreras para efectos externos

- Antes de pruebas que toquen una BD o proveedores reales, confirmá conmigo el
  destino, los datos afectados y los efectos. Las pruebas destructivas requieren
  **una BD aislada y exclusiva de pruebas y autorización explícita**.
- `ALLOW_DB_TESTS=false` solo controla las pruebas que respetan esa bandera;
  **no garantiza aislamiento de red**. `NODE_ENV=test` puede cambiar la carga o
  prioridad de dotenv; otros módulos todavía pueden cargar `.env`.
- Un intento anterior de aislamiento con `unshare` falló por `uid_map`. Si la
  barrera necesaria no está disponible, reportá el impedimento y proponé una
  alternativa segura para aprobar; no la quites por defecto para hacer pasar tests.
- El inicio del backend puede reanudar automatizaciones. Antes de ejecutarlo,
  verificá su alcance: puede producir escrituras o llamadas a proveedores.
- Migraciones, escrituras y llamadas pagas a Apify, DeepSeek u otros servicios
  requieren autorización explícita para sus efectos y destino. **`db:migrate`
  puede escribir incluso sin `--apply`; no lo trates como dry-run.**
- Una autorización previa de efectos sobre la BD vale para aquella tarea, no es
  permiso permanente. Tampoco supongas que Railway es una BD descartable.

---

## 8. Base de datos

Uso PostgreSQL en Railway mediante `DATABASE_URL`, con driver `pg`, sin ORM.
Mantengo las consultas parametrizadas; no concateno entradas en SQL.

```javascript
const resultado = await pool.query(
    'SELECT * FROM ofertas WHERE estado = $1',
    ['aprobada']
);
```

La conexión real, las migraciones y las pruebas con efectos siguen las barreras de
la sección 7; no necesito leer credenciales para explicar ni editar documentación.

---

## 9. Scraping y API de Apify

Uso `apify-client` para ejecutar Actors que extraen ofertas. El backend normaliza
los resultados antes de guardarlos. Configuro la autenticación mediante la variable
`APIFY_TOKEN`, sin exponer su valor.

Apify no garantiza ausencia de bloqueos de IP, restricciones del sitio ni fallos
del proveedor. Distingo una prueba con mocks de una extracción real; esta última
puede tener costo y persistir datos, por lo que requiere el alcance autorizado.

---

## 10. Evaluación con IA (DeepSeek)

Uso la API de DeepSeek, compatible con el formato de OpenAI, y la variable
`DEEPSEEK_API_KEY`. La evaluación recibe el texto de la oferta y mi perfil, y
devuelve si coincide y una razón breve del resultado. Respeto los filtros y el
bonus acotado de la sección 1; el detalle está en `docs/evaluacion-ia.md`.

Una evaluación real puede consumir saldo y escribir resultados. No la doy por
validada por el solo hecho de que el dashboard abra o los tests con mocks pasen.

---

## 11. Checklist de cierre

Antes de informar que terminé, compruebo lo que corresponda al alcance:

- [ ] El diff contiene solo cambios autorizados y conserva el trabajo previo.
- [ ] El formato, la seguridad, los contratos y el SQL parametrizado se preservan.
- [ ] Las pruebas nuevas o actualizadas cubren el comportamiento modificado.
- [ ] Informé comandos ejecutados y resultados: **pasó, falló u omitido**, con sus
      motivos y límites; no presenté omisiones como éxitos.
- [ ] Actualicé la documentación relevante dentro del alcance acordado.
- [ ] No hice builds, efectos externos ni acciones de Git sin la autorización
      correspondiente; no expuse secretos.
- [ ] Separé lo verificado en localhost de scraping, evaluación, BD y validez de
      credenciales reales. Dejé explícito lo que falta verificar.

No necesito iniciar el backend para cerrar cada cambio ni correr suites de código
por una edición exclusivamente documental.

---

## 12. Comunicación y aprendizaje

Estoy aprendiendo: explicame el **por qué** y el **para qué**, no solo el código.
Para un concepto no obvio, prefiero una analogía simple antes de la implementación.

- Hablame en español claro, directo y respetuoso; no fuerces regionalismos.
- Yo dirijo el alcance; la IA es una herramienta, no decide cambios por mí.
- Si hay alternativas relevantes, explicá sus costos y beneficios concretos.
- No afirmes sin evidencia. Si me equivoco, mostrame la prueba; si se equivoca el
  agente, que lo reconozca y lo corrija sin ocultar el resultado anterior.

---

## 13. Flujo ODD y herramientas de IA

### Un único flujo de trabajo

Uso ODD para mantener intención, decisiones y evidencia alineadas:

1. **Autorizar:** confirmar objetivo, límites, criterios de éxito y efectos permitidos.
2. **Explorar proporcionalmente:** leer lo necesario, preservar cambios existentes
   y cargar las skills pertinentes antes de implementar.
3. **Resolver decisiones:** consultar lo que requiera mi elección; no adivinar.
4. **Implementar el mínimo completo:** respetar la arquitectura y aplicar test-first
   cuando haya una prueba de comportamiento significativa.
5. **Verificar:** elegir controles adecuados al alcance y a las barreras de la sección 7.
6. **Reportar evidencia:** resumir cambios, resultados, omisiones y riesgos pendientes.

Un trabajo pequeño y entendido puede resolverse inline. Delego exploraciones amplias,
unidades sustanciales independientes o una verificación que necesite independencia.
No uso un umbral de archivos ni una obligación de delegar todo: primero consulto los
nombres y herramientas de subagentes realmente disponibles en la sesión, y les paso
alcance, contexto y criterios claros.

Los comandos antiguos `sdd-*` no están disponibles en el inventario auditado. Conservo
los principios de especificaciones, planificación y entregas verificables, sin exigir
`/sdd-new` ni inventar herramientas o instalar reemplazos.

### Herramientas: declaración no equivale a disponibilidad

En la sesión auditada se declararon estos MCP. Antes de usarlos descubro sus
herramientas invocables y permisos; instalado o declarado no significa que pueda
llamarlo. Prefiero documentación oficial o un MCP pertinente antes de inventar APIs.

| MCP | Uso previsto |
| --- | --- |
| Engram | Contexto persistente, si la asociación del proyecto y las herramientas funcionan |
| Context7 | Documentación de librerías |
| GitHub | Issues, código y colaboración; las escrituras requieren su alcance autorizado |
| Chrome DevTools | Inspección y diagnóstico del navegador |
| Playwright | Automatización y comprobaciones de navegador |
| MarkItDown | Conversión de documentos |
| Railway | Inspección de infraestructura; efectos y deploy requieren aprobación |
| Vercel | Inspección de despliegues; efectos y deploy requieren aprobación |
| Refero | Investigación de diseño de solo lectura, no exportación masiva |

No doy por expuestos Serena, Figma ni Microsoft Learn. CodeGraph está inicializado:
si sus herramientas están disponibles, lo uso para consultar símbolos y explorar
relaciones. Inicializado **no significa actualizado**; verifico la vigencia del
índice antes de confiar en él y no afirmo que se reindexó sin evidencia. Si falta,
propongo su inicialización dentro del alcance autorizado antes de ejecutarla.

### Skills disponibles

> **Uso este inventario para elegir skills, no para cargar todas a la vez.** Antes de
> trabajar, leo el `SKILL.md` correspondiente y respeto sus condiciones de activación.
> Tener una skill instalada no significa que esté expuesta en la sesión actual ni
> autoriza instalaciones, cambios, commits, migraciones o despliegues.

#### Alcance y rutas verificadas

En esta PC comprobé **57 familias de skills globales**: 25 generales, 13 de Gentle AI,
6 de Ponytail y 13 adicionales de Gemini. No encontré `SKILL.md` locales en el proyecto
(al excluir dependencias y artefactos generados). Los nombres equivalentes entre
agentes se agrupan por finalidad, sin afirmar que sus instrucciones sean idénticas.

| Origen | Ruta base; cada fila del catálogo agrega `<carpeta>/SKILL.md` |
| --- | --- |
| `PI` | `~/.pi/agent/skills/` — 25 entradas, enlaces a las mismas skills de `~/.agents/skills/`; no las cuento dos veces |
| `GP` | `~/.local/share/gentle-shell/install/prefix/lib/node_modules/gentle-pi/skills/` — 13 skills del paquete Gentle Pi |
| `PT` | `~/.pi/agent/npm/node_modules/@dietrichgebert/ponytail/skills/` — 6 skills de Ponytail |
| `GM` | `~/.gemini/skills/` — 57 archivos: copias de las 44 familias anteriores y 13 adicionales |

Las rutas son propias de esta PC: compruebo que existan al cambiar de equipo.
En la revisión no encontré skills en `~/.copilot/skills/`, `~/.config/opencode/skills/`,
`~/.claude/skills/` ni `~/.gemini/antigravity/skills/`.
Si agrego una skill local, reviso `.agents/skills/`, `.pi/skills/`, `.claude/skills/`,
`.copilot/skills/`, `.gemini/skills/`, `.opencode/skills/` y `skills/`; ante el mismo
nombre, priorizo la del proyecto cuando el agente la soporte.

#### Selección rápida para este proyecto

| Situación | Skills que considero primero |
| --- | --- |
| API Express lenta o esperas en proveedores | `api-and-backend-efficiency`; `database-performance` si la causa es PostgreSQL |
| Dashboard Angular lento | `frontend-perceived-performance`; `playwright-best-practices` para pruebas de navegador |
| Diseño de pantallas o propuestas visuales | `gentle-design`; `impeccable` para UX y `emil-design-eng` para detalles |
| Error visual, accesibilidad o sesión en navegador | Skills `GM` de diagnóstico, si puedo cargarlas y sus herramientas están disponibles |
| Revisión de un cambio | `ponytail-review`; `gentle-ai-judgment-day` solo para revisión adversarial solicitada |
| Documentación o instrucciones del proyecto | `gentle-ai-cognitive-doc-design`; `gentle-ai-skill-registry` si cambia el inventario |

#### Catálogo general: interfaz, rendimiento y pruebas (`PI`)

La carpeta coincide con el nombre de la skill en todas estas filas.
`pick-ui-library`, `prototype` y `review-animations` declaran
`disable-model-invocation: true`: requieren invocación explícita y no estaban
expuestas en el inventario de esta sesión de Pi, aunque sus archivos existen.

| Skill / carpeta | Cuándo la uso y para qué |
| --- | --- |
| `api-and-backend-efficiency` | Mido y optimizo API Node/Express, solicitudes duplicadas, paginación y esperas externas; sin agregar infraestructura sin evidencia |
| `database-performance` | Diagnostico consultas PostgreSQL lentas, índices y pool; no creo índices ni migraciones sin autorización |
| `frontend-perceived-performance` | Investigo lentitud en Angular, respuestas obsoletas, renders y carga de rutas; no para diseño visual |
| `playwright-best-practices` | Escribo o depuro pruebas E2E, mocks, autenticación, accesibilidad y escenarios de navegador |
| `security-best-practices` | Reviso seguridad o diseño seguro solo si se solicita explícitamente; JavaScript/TypeScript, Python o Go |
| `impeccable` | Diseño, reviso o mejoro UX, jerarquía, formularios, accesibilidad y comportamiento adaptable del dashboard |
| `design-taste-frontend` | Diseño o reviso sitios y páginas de producto con una dirección visual coherente, evitando resultados genéricos |
| `emil-design-eng` | Ajusto detalles de componentes, interacción, estados y pulido visual |
| `apple-design` | Trabajo sobre interfaces de estilo Apple, profundidad, materiales, tipografía e interacción física |
| `mobile-native` | Corrijo comportamiento web en móviles: viewport, áreas seguras, teclado, toques y desplazamiento; requiere comprobar hardware cuando corresponda |
| `break-ui` | Pruebo una interfaz con datos extremos y estados vacíos cuando se solicita buscar sus límites |
| `prototype` | Comparo varias versiones visuales mediante un selector, solo por petición explícita |
| `pick-ui-library` | Comparo bibliotecas para una necesidad concreta, solo por petición explícita; no implica instalar dependencias |
| `animate` | Implemento animaciones web con propósito, duración, curva e interrupción definidos |
| `animation-performance` | Diagnostico tirones y optimizo propiedades animadas, renderizado y presupuesto por cuadro |
| `animation-vocabulary` | Identifico el nombre técnico de un efecto descrito por el usuario; no implemento la animación |
| `choreograph` | Coordino secuencias de varios elementos, listas, entradas y cambios de vista |
| `gestures` | Implemento arrastre, swipe y paneles que siguen el gesto sin perder continuidad |
| `find-animation-opportunities` | Propongo dónde conviene animar y dónde no; revisión de solo lectura |
| `improve-animations` | Audito el movimiento existente y preparo propuestas de mejora; no aplico cambios |
| `review-animations` | Reviso la calidad de una animación o de su implementación, solo por invocación explícita |
| `remove-animations` | Quito movimiento innecesario cuando se solicita reducirlo; no agrego ni reajusto animaciones |
| `animate-expo` | Animo aplicaciones React Native/Expo; no corresponde al frontend Angular actual |
| `ask-sonner` | Configuro o depuro notificaciones de Sonner en React; no corresponde a PrimeNG/Angular |
| `write-swift` | Desarrollo o reviso Swift y su concurrencia; no corresponde al stack actual |

#### Catálogo de workflow y documentación (`GP`)

Uso el nombre exacto del frontmatter; la carpeta puede ser distinta.

| Skill | Carpeta | Cuándo la uso y para qué |
| --- | --- | --- |
| `gentle-ai` | `gentle-ai` | Aplico ODD, alcance, verificación y coordinación proporcionados al trabajo |
| `gentle-design` | `design` | Creo propuestas HTML, pantallas o sistema de diseño bajo `design/`; reviso el canvas antes de diseñar |
| `gentle-ai-cognitive-doc-design` | `cognitive-doc-design` | Redacto guías e instrucciones fáciles de recorrer y verificar |
| `gentle-ai-comment-writer` | `comment-writer` | Redacto comentarios de issues, PRs y colaboración con el idioma del contexto |
| `gentle-ai-issue-creation` | `issue-creation` | Preparo o clasifico bugs y solicitudes de features con evidencia del repositorio |
| `gentle-ai-branch-pr` | `branch-pr` | Preparo o creo una PR con las comprobaciones de issue y rama correspondientes |
| `gentle-ai-chained-pr` | `chained-pr` | Divido cambios grandes en PRs encadenadas o porciones revisables |
| `gentle-ai-work-unit-commits` | `work-unit-commits` | Planifico unidades revisables con comportamiento, pruebas y documentación juntos; no autoriza commits por sí sola |
| `gentle-ai-judgment-day` | `judgment-day` | Ejecuto la revisión adversarial doble cuando se solicita explícitamente |
| `gentle-ai-rdd-defect-workflow` | `rdd-defect-workflow` | Investigo problemas de RDD, autoridad, recibos y recuperación respetando el flujo nativo |
| `gentle-ai-skill-creator` | `skill-creator` | Creo una skill nueva o documento un patrón de uso de IA solicitado |
| `gentle-ai-skill-improver` | `skill-improver` | Audito o mejoro skills cuando esa es la tarea |
| `gentle-ai-skill-registry` | `skill-registry` | Actualizo el índice tras instalar, mover, quitar o modificar skills; mantengo `.atl/` como estado local |

Gemini tiene copias con nombres cortos como `chained-pr`, `cognitive-doc-design`,
`judgment-day`, `skill-creator`, `skill-improver`, `skill-registry` y `work-unit-commits`.
No sustituyo el nombre ni las instrucciones del paquete Pi por esas variantes sin
leer la copia que realmente voy a usar.

#### Catálogo de simplicidad y revisión (`PT`)

La carpeta coincide con el nombre de la skill.

| Skill / carpeta | Cuándo la uso y para qué |
| --- | --- |
| `ponytail` | Resuelvo tareas de código con el cambio mínimo completo, sin omitir validaciones ni pruebas necesarias |
| `ponytail-review` | Reviso un diff y su código conectado: corrección, seguridad, rendimiento y complejidad; solo lectura |
| `ponytail-audit` | Audito todo el repositorio y priorizo hallazgos; no modifico código |
| `ponytail-debt` | Enumero comentarios `shortcut:` y antiguos `ponytail:` como deuda documentada |
| `ponytail-gain` | Muestro los datos del benchmark de Ponytail, no métricas inventadas de este proyecto |
| `ponytail-help` | Consulto niveles, comandos y modo de uso de Ponytail |

#### Skills adicionales instaladas en Gemini (`GM`)

Estas skills existen en disco, pero no asumo que Pi las haya cargado. Antes de
usarlas, compruebo acceso al archivo y disponibilidad de las herramientas que piden.
No instalo CLIs ni cambio de agente automáticamente.

| Skill | Carpeta | Cuándo la uso y para qué |
| --- | --- | --- |
| `a11y-debugging` | `a11y-debugging` | Diagnostico semántica, ARIA, foco, teclado, contraste y áreas táctiles con Chrome DevTools |
| `chrome-devtools` | `chrome-devtools` | Inspecciono páginas, solicitudes y comportamiento del navegador mediante MCP |
| `chrome-devtools-cli` | `chrome-devtools-cli` | Automatizo Chrome desde comandos o scripts si la CLI requerida está disponible |
| `cookie-debugging` | `cookie-debugging` | Investigo cookies, sesiones, errores 401/403, SameSite y redirecciones de autenticación |
| `debug-optimize-lcp` | `debug-optimize-lcp` | Diagnostico carga visual lenta y Largest Contentful Paint con mediciones |
| `memory-leak-debugging` | `memory-leak-debugging` | Investigo consumo creciente de memoria, OOM y snapshots del heap en JavaScript/Node |
| `playwright-cli` | `playwright-cli` | Automatizo navegación y tareas de navegador desde Playwright CLI, si está instalada |
| `playwright-trace` | `playwright-trace` | Inspecciono trazas de Playwright: acciones, red, consola y capturas |
| `playwright-component-testing` | `playwright-component-testing` | Pruebo componentes React/Vue aislados con galería; no corresponde directamente a Angular |
| `troubleshooting` | `troubleshooting` | Diagnostico fallos de conexión, inicialización o navegación del MCP de Chrome DevTools |
| `gentle-ui-design` | `gentle-ui-design` | Diseño o reviso interfaces de producto y navegación adaptable según esa variante de Gentle AI |
| `gentle-ai-tui-design` | `tui-design` | Diseño o reviso interfaces de terminal; no para el dashboard Angular |
| `go-testing` | `go-testing` | Escribo pruebas de Go, teatest o golden files; no corresponde al stack actual |

#### Referencias anteriores no disponibles y mantenimiento

No encontré `sdd-*`, `frontend-design`, `web-design-guidelines` ni `find-skills` en
las ubicaciones revisadas. Las menciones a SDD en otras secciones describen el flujo
anterior: compruebo disponibilidad antes de invocarlo y no doy sus comandos por
instalados. No instalo reemplazos sin autorización.

Este catálogo registra nombres, rutas y ocasiones de uso; **`SKILL.md` sigue siendo
la fuente de instrucciones**. No copio sus reglas completas aquí ni trato las
condiciones de una skill como aplicables a tareas ajenas.
Para refrescar el índice local uso `/skill-registry:refresh` en Pi o
`gentle-ai skill-registry refresh --force` desde la terminal. `.atl/` no se versiona;
el índice puede omitir skills de paquetes y no sustituye esta comprobación de disco.

---

### Memoria persistente

Uso solo herramientas de memoria realmente disponibles. Engram tuvo fallos de
asociación con los identificadores `busca-empleos` y `busca_empleos`: ninguno queda
validado por este documento. Antes de buscar o guardar, resuelvo la asociación con
la configuración o sesión soportada, sin inventar un identificador ni modificar
archivos globales. Si no puedo resolverla, informo la limitación y continúo con el
contexto verificable de la tarea.

Cuando la memoria funcione, guardo solo conclusiones significativas y verificadas
del proyecto: decisiones, arquitectura, bugs o estado. No guardo secretos, datos
personales ni hipótesis como hechos, y no afirmo un guardado exitoso sin confirmación.
No doy por existentes herramientas `memory view`, rutas `/memories/repo/` o
`/memories/`, ni una carga o persistencia automática entre sesiones.

---

## 14. Planes ejecutables y entregas acotadas

Planifico independientemente del modelo que ejecute. Antes de entregar un plan,
verifico que pueda ejecutarse y revisarse con el contexto y las herramientas
disponibles. No supongo límites particulares de Opus, Sonnet u otro modelo.

Si el trabajo completo no cabe en una entrega entendible y verificable, lo divido
por unidades coherentes de comportamiento, dependencias o riesgo, no por un número
arbitrario de archivos o líneas. Cada entrega debe preservar un estado válido.

Cada plan incluye:

1. **Objetivo y especificación:** resultado esperado, alcance y exclusiones.
2. **Entregas numeradas:** contexto necesario, superficies autorizadas, tareas y
   criterios de aceptación de cada unidad.
3. **Dependencias y orden:** qué debe estar resuelto antes de empezar cada entrega.
4. **Verificación y checkpoint:** comandos adecuados, efectos que necesitan permiso,
   evidencia esperada y condición para avanzar o detenerse.

Si basta una sola entrega, lo indico con su alcance y verificación. Si hace falta
revisar el plan por un hallazgo, lo propongo antes de ampliar la implementación.

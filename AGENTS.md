# AGENTS.md — Modo de trabajo de Marcos Ezequiel Toledo

> Este archivo describe mi forma de trabajar en este workspace.
> Lo redacté para que cualquier agente de IA que opere acá entienda mi flujo,
> mis convenciones y mis reglas.
> **Código y comentarios**: en español argentino formal, en primera persona,
> como si lo hubiera hecho yo.
> **Interacción conmigo**: en español rioplatense informal (ver sección Personalidad).

## Tabla de contenidos

1. [Quién soy y qué es este proyecto](#1-quién-soy-y-qué-es-este-proyecto)
2. [Estructura del workspace](#2-estructura-del-workspace)
3. [Regla principal: no tomar la iniciativa](#3-regla-principal-no-tomar-la-iniciativa)
4. [Git workflow](#4-git-workflow)
5. [Entorno de desarrollo](#5-entorno-de-desarrollo)
6. [Estilo de código y convenciones](#6-estilo-de-código-y-convenciones)
7. [Testing](#7-testing)
8. [Base de datos](#8-base-de-datos)
9. [Scraping y API de Apify](#9-scraping-y-api-de-apify)
10. [Evaluación con IA (DeepSeek)](#10-evaluación-con-ia-deepseek)
11. [Checklist antes de dar por terminado un cambio](#11-checklist-antes-de-dar-por-terminado-un-cambio)
12. [Personalidad y tono del asistente](#12-personalidad-y-tono-del-asistente)
13. [Ecosistema de IA (Gentle AI)](#13-ecosistema-de-ia-gentle-ai)
14. [Flujo planificación (Opus) → ejecución (Sonnet)](#14-flujo-planificación-opus--ejecución-sonnet)

---

## 1. Quién soy y qué es este proyecto

Soy Marcos Ezequiel Toledo, desarrollador de software junior, QA Tester y soporte IT,
de Buenos Aires, Argentina.

- GitHub: github.com/marcostoledo96
- LinkedIn: linkedin.com/in/marcos-ezequiel-toledo

Estoy aprendiendo. Necesito que el agente me explique el **por qué** y el **para qué**
de cada decisión técnica, no solo el código. Cuando se use un patrón o término técnico
no obvio, explicarlo con una analogía simple.

### El proyecto: Busca Empleos

Un sistema automatizado de uso personal que:

1. Extrae ofertas de empleo de LinkedIn y Computrabajo usando la API de Apify.
2. Evalúa cada oferta con la API de DeepSeek para determinar si hace "match" con mi perfil.
3. Muestra los resultados aprobados en un dashboard web.

**Mi perfil para los filtros de la IA:**

- Nivel: Trainee / Junior.
- Modalidad: Cualquiera (Remoto, Híbrido, Presencial).
- Stack: HTML, CSS, JavaScript, TypeScript, C#, SQL, Angular, React, React Native, Node.js, Express, ASP.NET, PostgreSQL, SQL Server.
- **Excluir ofertas que requieran Java** (regla estricta).

**Stack del proyecto:**

| Capa               | Tecnología                     |
| ------------------- | ------------------------------ |
| Backend / Scraping  | Node.js + Express              |
| Scraping externo    | API de Apify (apify-client)    |
| IA                  | API de DeepSeek                |
| Base de datos       | PostgreSQL (driver pg directo) |
| Frontend            | Angular                        |

**Estado:** Proyecto nuevo, construyéndose desde cero paso a paso.

---

## 2. Estructura del workspace

```
Busca_empleos/
├── backend/
│   ├── src/
│   │   ├── config/          ← Configuración (BD, variables de entorno)
│   │   ├── controladores/   ← Controladores de rutas Express
│   │   ├── servicios/       ← Lógica de negocio (scraping, IA, ofertas)
│   │   ├── modelos/         ← Queries SQL y modelos de datos
│   │   ├── rutas/           ← Definición de rutas Express
│   │   ├── utils/           ← Utilidades comunes
│   │   └── index.js         ← Punto de entrada del servidor
│   ├── tests/               ← Tests con Jest
│   ├── .env.example         ← Variables de entorno de ejemplo
│   ├── .gitignore
│   └── package.json
├── frontend/                ← Se crea más adelante con Angular CLI
├── AGENTS.md                ← Este archivo
├── AGENTS_init.md           ← Guía de referencia (solo lectura)
└── PLANIFICACION.md         ← Hoja de ruta del proyecto
```

> `AGENTS_init.md` es solo lectura. No modificar.

---

## 3. Regla principal: no tomar la iniciativa

> No implementar ningún cambio, migración, refactorización ni mejora si Marcos
> no lo pidió explícitamente.

**Prohibido:**

- Refactorizar "de paso".
- Modificar archivos sin autorización.
- Agregar features por iniciativa propia.
- Hacer push/deploy.
- Buildear sin que lo pida.

**Permitido:**

- Leer y analizar cualquier archivo para entender el contexto.
- Sugerir mejoras como comentario (no como cambio).
- Hacer preguntas.
- Commits si Marcos lo pide.

### Optimización de contexto

Antes de eliminar archivos `.md`, bloques de código muerto o recursos del workspace:

1. Listar los candidatos a eliminar con la razón de cada uno.
2. Preguntarle a Marcos y **esperar confirmación explícita** antes de borrar.
3. **Nunca eliminar `README.md`** de ningún proyecto o subcarpeta.
4. No eliminar `AGENTS_init.md` — es referencia.

### Documentación automática de cambios

Al implementar cambios que afecten arquitectura o sistema, actualizar docs relevantes
**sin esperar que Marcos lo pida**:

- Endpoints nuevos o modificados → doc de API.
- Entidades o modelos nuevos → doc de modelo de datos.
- Servicios nuevos → doc de la capa correspondiente.
- Componentes y páginas → doc del frontend.
- Stack o dependencias → doc de arquitectura.

Solo agregar lo que cambió. No reescribir secciones completas.

### Detección de preferencias

Si se detecta una preferencia nueva (convención, patrón, decisión): señalarla,
preguntar dónde documentarla, esperar confirmación. No agregar sin preguntar.

---

## 4. Git workflow

- **Rama de producción:** `main`.
- **Ramas de feature:** `feature/nombre-descriptivo` (ej: `feature/scraping-linkedin`).
- **Sin rama develop:** al ser proyecto personal, las features se mergean directo a `main`.
- **PRs:** no requeridos (solo Marcos trabaja). Se puede mergear directo.

### Formato de commits

Conventional commits en español, modo imperativo:

```
tipo(alcance): descripción corta

Cuerpo opcional con detalles del cambio.
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`.

Ejemplo: `feat(scraping): agregar servicio de extracción para LinkedIn`

### Commits y deploy

El agente puede ejecutar `git commit` si Marcos lo pide.
**NUNCA** ejecutar `git push` ni ningún comando de deploy.
El push lo hace Marcos.

---

## 5. Entorno de desarrollo

- **Gestor de paquetes:** npm
- **Runtime:** Node.js v22.20.0
- **Base de datos:** PostgreSQL (instalación local)

### Comandos principales

```powershell
# Instalar dependencias
cd backend && npm install

# Iniciar servidor de desarrollo (con reinicio automático)
npm run dev

# Ejecutar tests
npm test

# Iniciar servidor sin reinicio automático
npm start
```

---

## 6. Estilo de código y convenciones

### Lenguaje del código

**Todo** en español argentino formal, primera persona: variables, funciones,
archivos, carpetas, comentarios, mensajes de error, logs.

### Naming y formato

| Elemento                | Convención   | Ejemplo                |
| ----------------------- | ------------ | ---------------------- |
| Variables               | camelCase    | `ofertasAprobadas`     |
| Funciones               | camelCase    | `evaluarOferta()`      |
| Clases / Constructores  | PascalCase   | `ServicioScraping`     |
| Constantes globales     | UPPER_SNAKE  | `PUERTO_SERVIDOR`      |
| Archivos                | kebab-case   | `servicio-scraping.js` |
| Carpetas                | kebab-case   | `controladores/`       |

### Indentación

4 espacios. Sin tabs. En todos los archivos de código.

### JavaScript

- `const` por defecto, `let` solo cuando sea necesario. Nunca `var`.
- Funciones async/await para operaciones asíncronas (no callbacks anidados).
- Manejo de errores con try/catch en operaciones de BD, API y scraping.
- Template literals para strings con variables: `` `Hola ${nombre}` ``.

### Seguridad

- **Nunca** hardcodear credenciales, API keys ni contraseñas en el código.
- Todas las credenciales van en `.env` (excluido de Git).
- Validar inputs en los endpoints antes de procesarlos.
- Usar consultas parametrizadas con `pg` (nunca concatenar SQL).

---

## 7. Testing

- **Framework:** Jest.
- **Ubicación:** `backend/tests/`.
- **Comando:** `npm test`.

Después de cada cambio:

- Correr la suite completa de tests.
- Agregar tests nuevos por cada servicio o función nueva.
- Resultado esperado: cero tests fallando.

---

## 8. Base de datos

- **Motor:** PostgreSQL (instalación local).
- **Driver:** `pg` (sin ORM — queries SQL directas).
- **Queries:** SQL directo con consultas parametrizadas.

```javascript
// CORRECTO — consulta parametrizada (previene SQL injection)
const resultado = await pool.query(
    'SELECT * FROM ofertas WHERE estado = $1',
    ['aprobada']
);

// INCORRECTO — nunca concatenar valores en la query
const resultado = await pool.query(
    `SELECT * FROM ofertas WHERE estado = '${estado}'`
);
```

---

## 9. Scraping y API de Apify

- **Librería:** `apify-client`.
- **Propósito:** Extraer ofertas de LinkedIn y Computrabajo sin riesgo de bloqueo de IP.
- **API key:** En variable de entorno `APIFY_TOKEN`.

Cada Actor de Apify se ejecuta, devuelve los resultados, y el backend los normaliza
antes de guardarlos en la base de datos.

---

## 10. Evaluación con IA (DeepSeek)

- **API:** DeepSeek (formato compatible con OpenAI).
- **API key:** En variable de entorno `DEEPSEEK_API_KEY`.
- **Propósito:** Evaluar si cada oferta extraída hace match con el perfil de Marcos.

La evaluación recibe el texto de la oferta y el perfil, y devuelve:

- Si matchea o no.
- Razón breve del match o rechazo.

---

## 11. Checklist antes de dar por terminado un cambio

Antes de reportar que un cambio está completo, verificar:

- [ ] El código ejecuta sin errores (`node src/index.js` o `npm run dev`).
- [ ] Los archivos modificados están formateados (indentación de 4 espacios).
- [ ] Los tests pasan (`npm test`).
- [ ] Se agregaron tests por cada servicio o función nueva.
- [ ] Las credenciales están en `.env`, no hardcodeadas.
- [ ] Las queries SQL usan parámetros (`$1`, `$2`), no concatenación.
- [ ] No se ejecutaron comandos de git ni de deploy sin autorización.
- [ ] Se actualizó la documentación relevante si hubo cambios de arquitectura.

---

## 12. Personalidad y tono del asistente

> Configurado con Gentle AI. Ver `gentle-ai.instructions.md` para personalidad completa.

### Interacción

- Idioma: español rioplatense informal.
- Expresiones: laburo, ponete las pilas, dale, bancá, ni en pedo, está piola, quilombo.
- Tono: directo, sin filtro, con autoridad técnica.
- Filosofía: conceptos antes que código. La IA es la herramienta, Marcos dirige.

### Nivel de experiencia de Marcos

Marcos es junior. Cuando se use un patrón o término técnico no obvio, explicarlo:
qué es, por qué se usa, qué problema resuelve. Una analogía simple vale más que
una definición técnica. No tirar código sin contexto.

### Código y comentarios

El código, comentarios y nombres se escriben en español argentino formal,
primera persona, como si los hubiera escrito Marcos. Esto no cambia.

### Reglas de verificación

- Nunca afirmar sin verificar. Ante la duda, decir "dejame verificar".
- Si Marcos está equivocado, explicar por qué con evidencia técnica.
- Si el agente se equivocó, reconocerlo con pruebas.
- Proponer alternativas con tradeoffs cuando sea relevante.

---

## 13. Ecosistema de IA (Gentle AI)

> **REGLA CENTRAL:** El agente orquestador NO lee código fuente, NO escribe código,
> NO analiza arquitectura inline. Delega TODO eso a subagentes o fases SDD.
> Hacerlo inline infla la ventana de contexto, causa compactación y pérdida de estado.

---

### Protocolo de inicio de conversación (OBLIGATORIO)

Ante CUALQUIER pedido técnico no trivial, ejecutar en este orden:

1. **Buscar en Engram** — `mem_search(query: "{tema}", project: "busca-empleos")`
   para recuperar contexto previo. Si hay resultados relevantes:
   `mem_get_observation(id: ...)` para leer el contenido completo.
2. **Verificar skills aplicables** — Antes de escribir código, confirmar qué skills
   aplican. Cargarlas ANTES de cualquier implementación.
3. **Evaluar si necesita subagente** — Si la tarea implica leer más de 2-3 archivos
   o explorar el codebase, delegar al subagente `Explore` en lugar de hacerlo inline.

---

### Protocolo de cierre (OBLIGATORIO cuando hay descubrimientos)

Al terminar una tarea con conocimiento nuevo, guardar en Engram:

- `project: "busca-empleos"`, `scope: "project"`
- `type: "architecture" | "decision" | "bug" | "state"`

También actualizar archivos de repo memory si corresponde.

---

### Reglas de delegación (Team Agents Lite)

| Tipo de tarea                                   | Qué hacer                                              |
| ----------------------------------------------- | ------------------------------------------------------ |
| Pregunta puntual de código o concepto           | El orquestador responde directamente                   |
| Fix de 1 archivo, < 50 líneas                   | Delegar a subagente o hacer inline con skills cargadas |
| Explorar el codebase para entender algo         | **SIEMPRE** delegar al subagente `Explore`             |
| Feature que toca 2+ archivos                    | `/sdd-new nombre-del-cambio`                           |
| Feature que toca backend + frontend             | `/sdd-new` y dividir implementación en prompts         |
| Análisis de arquitectura o decisiones de diseño | Delegar a subagente o fase `sdd-explore`               |

**Anti-patrón a evitar:** Leer 5 archivos seguidos en el hilo principal
para "entender el contexto". Eso es trabajo de exploración → subagente.

---

### MCP Servers disponibles (9 activos)

> **REGLA:** Antes de recurrir a una búsqueda web genérica o inventar una API,
> verificar si algún MCP ya provee esa información.

#### Siempre activos (usar en cada sesión)

| MCP            | Qué hace                          | Cuándo usarlo                     | Herramientas clave                   |
| -------------- | --------------------------------- | --------------------------------- | ------------------------------------ |
| Engram         | Memoria persistente entre sesiones | Siempre al inicio y cierre       | mem_save, mem_search, mem_context    |
| Context7 (UPS) | Docs actualizadas de librerías   | Antes de usar una API de librería | get-library-docs, resolve-library-id |
| GitHub         | Issues, PRs, code search          | Git workflow, buscar código       | search_code, create_pull_request     |

#### Bajo demanda (usar cuando el contexto lo requiere)

| MCP             | Qué hace                        | Cuándo usarlo                      | Herramientas clave                 |
| --------------- | ------------------------------- | ---------------------------------- | ---------------------------------- |
| Chrome DevTools | Debugging de navegador          | Inspeccionar el frontend           | take_screenshot, evaluate_script   |
| Playwright      | Automatización y testing visual | Testing E2E, navegar páginas       | browser_navigate, browser_snapshot |
| Serena          | Análisis semántico de código    | Buscar símbolos, refactoring       | find_symbol, get_symbols_overview  |
| MarkItDown      | Convertir archivos a Markdown   | Procesar PDFs, DOCX, imágenes     | convert_to_markdown                |
| Microsoft Learn | Docs oficiales Microsoft/Azure  | Dudas sobre .NET, Azure, SQL Server | microsoft_docs_search, docs_fetch |

#### Diseño (cuando se trabaja con UI desde herramientas de diseño)

| MCP   | Qué hace                          | Cuándo usarlo                      | Herramientas clave                 |
| ----- | --------------------------------- | ---------------------------------- | ---------------------------------- |
| Figma | Contexto de diseños, screenshots  | Implementar UI desde diseño Figma  | get_design_context, get_screenshot |

---

### Engram — Convención de este proyecto

```
project: "busca-empleos"
scope: "project"
type: "architecture" | "decision" | "bug" | "state"
```

Guardar: decisiones arquitectónicas, bugs resueltos, estado de features, convenciones.

---

### SDD — Cuándo usar

| Escenario                                  | Usar SDD? |
| ------------------------------------------ | --------- |
| Feature nueva que toca 2+ archivos         | SÍ        |
| Refactorización que afecta una capa entera | SÍ        |
| Fix puntual de bug en 1 archivo            | NO        |
| Cambio de estilo menor (CSS, texto)        | NO        |
| Integración de nuevo Actor de Apify        | SÍ        |

---

### Skills disponibles

> **REGLA:** Antes de escribir CUALQUIER línea de código, verificar estas tablas
> y cargar las skills que apliquen.

#### Skills de proyecto

No hay skills de proyecto configuradas. A medida que el proyecto crezca,
se pueden crear en `.agents/skills/`.

#### Skills SDD — Spec-Driven Development (`~/.copilot/skills/`)

| Fase             | Skill       | Cuándo se invoca                                    |
| ---------------- | ----------- | --------------------------------------------------- |
| Inicializar SDD  | sdd-init    | `/sdd-init` — detecta stack, bootstraps persistence |
| Explorar idea    | sdd-explore | `/sdd-explore <tema>` — investiga antes de commit   |
| Propuesta        | sdd-propose | Crear propuesta con alcance y enfoque               |
| Especificación   | sdd-spec    | Escribir specs con requisitos y escenarios          |
| Diseño técnico   | sdd-design  | Decisiones de arquitectura y approach               |
| Tareas           | sdd-tasks   | Dividir en checklist de implementación              |
| Implementar      | sdd-apply   | Escribir código siguiendo specs y diseño            |
| Verificar        | sdd-verify  | Validar implementación contra specs                 |
| Archivar         | sdd-archive | Cerrar cambio y persistir estado final              |

#### Skills de workflow (`~/.copilot/skills/`)

| Contexto                         | Skill          | Para qué                                   |
| -------------------------------- | -------------- | ------------------------------------------ |
| Crear un Pull Request            | branch-pr      | Workflow de PR con issue-first enforcement  |
| Reportar bug o pedir feature     | issue-creation | Crear issues en GitHub con formato estándar |
| Review adversarial de código     | judgment-day   | Doble review paralelo con jueces ciegos    |
| Crear una nueva skill de IA      | skill-creator  | Documentar patrones para agentes           |

#### Skills de diseño y auditoría (`~/.agents/skills/`)

| Contexto                    | Skill                 | Para qué                                  |
| --------------------------- | --------------------- | ----------------------------------------- |
| Crear UI web con calidad    | frontend-design       | Interfaces production-grade, no genéricas |
| Auditar accesibilidad/UX    | web-design-guidelines | Review contra Web Interface Guidelines    |
| Buscar skills instalables   | find-skills           | Descubrir skills nuevas para instalar     |

---

### Memoria persistente (3 capas)

| Capa                               | Alcance                        | Contenido                               | Cómo acceder                      |
| ---------------------------------- | ------------------------------ | --------------------------------------- | --------------------------------- |
| **Engram**                         | Cross-session, cross-workspace | Decisiones, bugs, estado, convenciones  | mem_save, mem_search, mem_context |
| **Repo memory** (/memories/repo/)  | Workspace actual, persistente  | Hallazgos técnicos, auditorías, gotchas | memory tool (view/create)         |
| **User memory** (/memories/)       | Global, todas las sessions     | Preferencias, patrones recurrentes      | se carga automáticamente          |

Archivos repo memory activos: ninguno (proyecto nuevo).
Usar `memory view /memories/repo/` para detalle.

---

### Sub-agentes disponibles

| Agente  | Tipo      | Cuándo usarlo                                        |
| ------- | --------- | ---------------------------------------------------- |
| Explore | Read-only | Explorar codebase, buscar patrones, entender flujos  |

Niveles de uso:

- `quick` — Buscar un dato puntual (1-2 archivos).
- `medium` — Entender un módulo o flujo (3-5 archivos).
- `thorough` — Exploración completa de un área del codebase (6+ archivos).

---

### Gentle AI

Configurado a nivel global. Aprovecha Team Agents Lite, Engram, SDD, Skills,
y MCP servers. Las reglas de delegación aplican SIEMPRE.

---

### Commits y deploy

El agente puede ejecutar `git commit` si Marcos lo pide.
**NUNCA** ejecutar `git push` ni ningún comando de deploy.
El push lo hace Marcos.

---

## 14. Flujo planificación (Opus) → ejecución (Sonnet)

Marcos trabaja con **dos modelos** en un flujo secuencial:

1. **Planificación con Claude Opus** — Analiza el problema, investiga el codebase,
   diseña la solución y genera un plan de implementación detallado.
2. **Ejecución con Claude Sonnet** — Recibe el plan y lo implementa escribiendo código.

### El problema

Sonnet tiene un **límite de longitud de respuesta**. Si el plan requiere implementar
demasiado en un solo prompt, Sonnet se corta a mitad de camino.

### Regla obligatoria para el planificador

> **Antes de entregar el plan final, evaluar si la ejecución cabe en un solo prompt
> o necesita dividirse en varios.**

### Criterios para dividir en múltiples prompts

Dividir cuando se cumpla **cualquiera** de estas condiciones:

| Señal de alerta                  | Umbral                    |
| -------------------------------- | ------------------------- |
| Archivos a crear/modificar      | Más de 3 archivos         |
| Líneas de código nuevo estimadas | Más de ~200 líneas       |
| Capas del stack involucradas     | Backend + Frontend juntos |
| Componentes visuales complejos   | Más de 2 nuevos          |
| Tareas lógicamente independientes | Más de 1 sin dependencias |
| Servicios + entidades + UI      | Siempre dividir por capa  |

**Regla de oro:** Si tenés dudas de si cabe en un prompt, **dividilo**.

### Cómo estructurar los prompts divididos

Cuando el planificador detecta que hay que dividir:

1. **Resumen ejecutivo** — Qué se va a hacer en total.
2. **Prompts numerados** — Cada uno autocontenido:
   - `Prompt 1 de N: [descripción corta]`
   - Contexto necesario
   - Tareas específicas
   - Criterio de éxito
3. **Orden de ejecución** — Dependencias entre prompts.
4. **Checkpoint entre prompts** — Qué verificar antes de avanzar.

Si cabe en un solo prompt, indicar:

> **Evaluación de división:** Este cambio cabe en un solo prompt de ejecución.
> Archivos a tocar: N. Líneas estimadas: ~X.

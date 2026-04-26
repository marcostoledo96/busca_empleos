# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Building Node.js servers, REST APIs, GraphQL backends, or microservices architectures | nodejs-backend-patterns | C:\Users\Marcos\.agents\skills\nodejs-backend-patterns\SKILL.md |
| Writing, reviewing, or optimizing Postgres queries, schema designs, or database configurations | supabase-postgres-best-practices | C:\Users\Marcos\.agents\skills\supabase-postgres-best-practices\SKILL.md |
| Encountering any bug, test failure, or unexpected behavior, before proposing fixes | systematic-debugging | C:\Users\Marcos\.agents\skills\systematic-debugging\SKILL.md |
| Building web components, pages, artifacts, posters, or applications with high design quality | frontend-design | C:\Users\Marcos\.agents\skills\frontend-design\SKILL.md |
| Reviewing UI code for Web Interface Guidelines compliance | web-design-guidelines | C:\Users\Marcos\.agents\skills\web-design-guidelines\SKILL.md |
| Polish, finishing touches, pre-launch review, or going from good to great | polish | C:\Users\Marcos\.agents\skills\polish\SKILL.md |
| Writing Playwright tests, fixing flaky tests, debugging failures, configuring CI/CD, etc. | playwright-best-practices | C:\Users\Marcos\.agents\skills\playwright-best-practices\SKILL.md |
| Implementing complex type logic, creating type utilities, or ensuring compile-time type safety in TypeScript | typescript-advanced-types | C:\Users\Marcos\.agents\skills\typescript-advanced-types\SKILL.md |
| Creating component libraries, implementing design systems, or standardizing UI patterns with Tailwind CSS v4 | tailwind-design-system | C:\Users\Marcos\.agents\skills\tailwind-design-system\SKILL.md |
| Planning, building, creating, designing, implementing, reviewing, fixing, improving, optimizing UI/UX code | ui-ux-pro-max | C:\Users\Marcos\.agents\skills\ui-ux-pro-max\SKILL.md |
| Search, scrape, and interact with the web via the Firecrawl CLI | firecrawl | C:\Users\Marcos\.agents\skills\firecrawl\SKILL.md |
| Discovering and installing agent skills when the user asks "how do I do X", "find a skill for X" | find-skills | C:\Users\Marcos\.agents\skills\find-skills\SKILL.md |
| Creating high-quality software documentation guided by the Diátaxis framework | documentation-writer | C:\Users\Marcos\.agents\skills\documentation-writer\SKILL.md |
| Deploying applications and websites to Vercel | deploy-to-vercel | C:\Users\Marcos\.agents\skills\deploy-to-vercel\SKILL.md |
| Running technical quality checks across accessibility, performance, theming, responsive design, and anti-patterns | audit | C:\Users\Marcos\.agents\skills\audit\SKILL.md |
| Auditing websites for SEO, performance, security, technical, content, and 15+ categories with squirrelscan CLI | audit-website | C:\Users\Marcos\.agents\skills\audit-website\SKILL.md |
| Creating GitHub issues (bug reports or feature requests) with issue-first enforcement | issue-creation | C:\Users\Marcos\.config\opencode\skills\issue-creation\SKILL.md |
| Creating pull requests with issue-first enforcement and branch naming conventions | branch-pr | C:\Users\Marcos\.config\opencode\skills\branch-pr\SKILL.md |
| Parallel adversarial review with two independent blind judges | judgment-day | C:\Users\Marcos\.config\opencode\skills\judgment-day\SKILL.md |
| Creating new AI agent skills following the Agent Skills spec | skill-creator | C:\Users\Marcos\.config\opencode\skills\skill-creator\SKILL.md |
| Initialize Spec-Driven Development context (sdd-init) | sdd-init | C:\Users\Marcos\.config\opencode\skills\sdd-init\SKILL.md |
| Explore and investigate ideas before committing to a change (sdd-explore) | sdd-explore | C:\Users\Marcos\.config\opencode\skills\sdd-explore\SKILL.md |
| Create a change proposal with intent, scope, and approach (sdd-propose) | sdd-propose | C:\Users\Marcos\.config\opencode\skills\sdd-propose\SKILL.md |
| Write specifications with requirements and scenarios (sdd-spec) | sdd-spec | C:\Users\Marcos\.config\opencode\skills\sdd-spec\SKILL.md |
| Create technical design document with architecture decisions (sdd-design) | sdd-design | C:\Users\Marcos\.config\opencode\skills\sdd-design\SKILL.md |
| Break down a change into an implementation task checklist (sdd-tasks) | sdd-tasks | C:\Users\Marcos\.config\opencode\skills\sdd-tasks\SKILL.md |
| Implement tasks from the change, writing actual code (sdd-apply) | sdd-apply | C:\Users\Marcos\.config\opencode\skills\sdd-apply\SKILL.md |
| Validate that implementation matches specs, design, and tasks (sdd-verify) | sdd-verify | C:\Users\Marcos\.config\opencode\skills\sdd-verify\SKILL.md |
| Sync delta specs to main specs and archive a completed change (sdd-archive) | sdd-archive | C:\Users\Marcos\.config\opencode\skills\sdd-archive\SKILL.md |
| Guided end-to-end walkthrough of the SDD workflow (sdd-onboard) | sdd-onboard | C:\Users\Marcos\.config\opencode\skills\sdd-onboard\SKILL.md |

## Compact Rules

### nodejs-backend-patterns
- Usar Express con helmet, cors, compression para seguridad y performance
- Separar en capas: rutas → controladores → servicios → modelos
- Middleware de errores centralizado con 4 parámetros (err, req, res, next)
- Validar inputs en endpoints antes de procesar
- Preferir async/await, evitar callbacks anidados
- Consultas parametrizadas con pg (nunca concatenar SQL)

### supabase-postgres-best-practices
- Siempre usar consultas parametrizadas con $1, $2
- Crear índices sobre columnas de filtro frecuente
- Evitar SELECT * en tablas grandes
- Usar transacciones para operaciones múltiples
- Usar pool de conexiones, no conexiones individuales por request

### systematic-debugging
- NUNCA proponer fix sin investigar root cause primero
- Fase 1: Reproducir → Aislar → Hipótesis → Verificar
- Solo después de confirmar root cause, proponer fix

### frontend-design
- Crear UI production-grade con estilos distintivos, no genéricos
- Tipografía, color, motion y layout intencionales
- Evitar estéticas "AI slop" (fondos purple gradient, Inter por defecto)

### web-design-guidelines
- Revisar contra guidelines de Vercel (fetch URL raw antes de cada review)
- Priorizar accesibilidad, contraste, foco visible y navegación por teclado

### polish
- Revisar alignment, spacing, consistencia y microdetalles antes de shippear
- Alinear con design system existente; si no hay, seguir convenciones del repo
- Marcar TODOs para issues conocidos que no se arreglan en esta pasada

### playwright-best-practices
- E2E testing con Page Object Model para reusabilidad
- Usar locadores estables (data-testid, roles), no XPath ni selectores frágiles
- Anotaciones @smoke, @fast, @critical para filtrar en CI
- Usar fixtures para setup/teardown global

### typescript-advanced-types
- Usar generics para componentes y funciones reutilizables
- Preferir tipos estrictos; evitar `any`
- Usar template literal types y mapped types cuando aportan claridad

### tailwind-design-system
- Tailwind v4: `@import "tailwindcss"`, config en CSS con `@theme`
- Definir design tokens con `@theme { --color-*: value }`
- Dark mode con `@custom-variant dark (&:where(.dark, .dark *))`

### ui-ux-pro-max
- Aplicar decisiones de UI/UX basadas en guidelines y patrones
- Incluir accesibilidad (a11y), animaciones con propósito, responsive
- Priorizar claridad visual y flujo de usuario sobre adornos

### firecrawl
- Scraping y crawling de webs vía CLI de Firecrawl
- Credenciales en `FIRECRAWL_API_KEY` (nunca hardcodeadas)
- Usar Markdown output optimizado para contextos de LLM

### find-skills
- Buscar skills con `npx skills find [query]`
- Instalar con `npx skills add <package>`
- Usar `npx skills check` para verificar updates

### documentation-writer
- Framework Diátaxis: tutoriales, how-to, referencia, explicación
- Escribir docs claras, centradas en el usuario y su objetivo
- Proponer estructura antes de escribir contenido completo

### deploy-to-vercel
- Deploy como preview por defecto (no production salvo que se pida)
- Vincular proyecto a Vercel para git-push deploys automáticos
- Verificar `vercel whoami` y git remote antes de deploy

### audit
- Auditar a11y, performance, theming, responsive, anti-patterns
- Score 0-4 por dimensión; reportar issues con severidad P0-P3
- No aplicar fixes en la pasada de audit; solo documentar

### audit-website
- Auditar sitio con `squirrelscan` CLI (230+ reglas, 21 categorías)
- Requiere squirrel CLI instalado y en PATH
- Devuelve health score y actionable recommendations

### issue-creation
- Issues deben usar template (bug report o feature request)
- Cada issue recibe `status:needs-review` automáticamente
- Requiere `status:approved` por maintainer antes de abrir PR

### branch-pr
- PRs deben linkear un issue con `status:approved`
- Un solo label `type:*` por PR
- Verificar que checks automáticos pasen antes de mergear

### judgment-day
- Review adversarial paralelo con dos jueces independientes
- Iterar hasta que ambos aprueben o se alcancen 2 iteraciones máximo
- Aplicar fixes y re-evaluar; escalar si no converge

### skill-creator
- Crear skills en `skills/{nombre}/SKILL.md`
- Incluir frontmatter con `name`, `description`, triggers
- Reglas compactas y ejemplos accionables, sin fluff

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| AGENTS.md | C:\Users\Marcos\Desktop\Busca_empleos\AGENTS.md | Index — references AGENTS_init.md, PLANIFICACION.md |
| AGENTS_init.md | C:\Users\Marcos\Desktop\Busca_empleos\AGENTS_init.md | Referenced by AGENTS.md — solo lectura, no modificar |
| PLANIFICACION.md | C:\Users\Marcos\Desktop\Busca_empleos\PLANIFICACION.md | Referenced by AGENTS.md — hoja de ruta del proyecto |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.

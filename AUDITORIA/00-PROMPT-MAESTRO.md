# Prompt Maestro — Auditoría de Busca Empleos

> **Instrucciones para ChatGPT (GPT 5.5 con reasoning ampliado):**
> Copiá este archivo entero y pegalo como primer mensaje. Luego adjuntá los archivos
> de documentación del proyecto (del 01 al 13) como contexto adicional.
> El prompt está diseñado para que la IA entienda TODO el proyecto antes de auditar.

---

## INSTRUCCIONES PARA LA IA AUDITORA

### Tu rol

Sos un auditor técnico senior especializado en proyectos full-stack (Node.js + Angular + PostgreSQL).
Tu tarea es analizar el proyecto **Busca Empleos** en profundidad y producir un informe
de auditoría con hallazgos, recomendaciones y planes de acción.

### Reglas fundamentales

1. **NO asumas.** Si algo no está claro en la documentación o necesitás más contexto
   para evaluar correctamente, **preguntame**. Podés hacer todas las preguntas que
   quieras antes de emitir un juicio. Prefiero 10 preguntas y un análisis certero
   que un análisis basado en suposiciones.

2. **Sé específico.** Cada hallazgo debe referenciar archivos, líneas de código,
   o configuraciones concretas. Nada de "mejorar el rendimiento" sin decir
   exactamente qué, dónde y cómo.

3. **Priorizá por impacto.** Clasificá cada hallazgo como:
   - 🔴 **CRÍTICO**: riesgo de seguridad, pérdida de datos, costo económico alto
   - 🟠 **ALTO**: bug funcional, mala experiencia de usuario, deuda técnica importante
   - 🟡 **MEDIO**: mejora de calidad, mantenibilidad, performance
   - 🟢 **BAJO**: detalles cosméticos, documentación, sugerencias

4. **Planificá paso por paso.** Si detectás algo que necesita reparación, no solo
   digas "hay que arreglar X". Detallá:
   - Archivos a modificar
   - Cambios específicos (qué agregar, quitar o modificar)
   - Orden de implementación
   - Riesgos o efectos secundarios
   - Cómo verificar que quedó bien

5. **El código y comentarios están en español.** No sugieras cambiar el idioma
   del código — es una decisión deliberada del proyecto.

6. **El proyecto es personal y de aprendizaje.** Algunas decisiones pueden no
   ser "best practice" de enterprise pero son conscientes por simplicidad o
   aprendizaje. Si detectás algo así, señalalo como "decisión consciente" en vez
   de "error".

---

## CONTEXTO DEL PROYECTO

### Qué es Busca Empleos

Un sistema automatizado de uso personal que:
1. Extrae ofertas de empleo de **12 plataformas** (LinkedIn, Computrabajo, Indeed,
   Bumeran, Glassdoor, GetOnBrd, Jooble, Remotive, RemoteOK, InfoJobs, Adzuna,
   Google Jobs) usando la API de Apify y scraping directo.
2. Evalúa cada oferta con **DeepSeek v4 flash** (vía OpenCode Go) para determinar
   si hace "match" con el perfil del usuario.
3. Aplica un **sistema de scoring previo determinístico** (sin IA) para filtrar
   ofertas claramente no compatibles y ahorrar llamadas a la API.
4. Muestra los resultados en un **dashboard web** hecho en Angular 20 con PrimeNG.

### Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 22 + Express 5 |
| Base de datos | PostgreSQL (driver `pg` directo, sin ORM) |
| Evaluación IA | DeepSeek v4 flash (vía API compatible con OpenAI) |
| Scraping externo | Apify (apify-client) + fetch nativo + Cheerio |
| Frontend | Angular 20 (standalone) + PrimeNG 20 + tema Aura |
| Autenticación | Firebase Auth (Google sign-in) con JWT verification |
| Deploy | Railway (backend) + Vercel (frontend) |
| Automatización | node-cron (ciclo semanal de scraping + evaluación) |

### Perfil del usuario (para filtros de IA)

- **Nivel**: Trainee / Junior
- **Modalidad**: Cualquiera (Remoto, Híbrido, Presencial, pero prefiere remoto)
- **Idioma**: Español nativo, Inglés básico
- **Stack principal**: HTML, CSS, JavaScript, TypeScript, C#, SQL, Angular, React,
  React Native, Node.js, Express, ASP.NET, PostgreSQL, SQL Server
- **Exclusiones estrictas**: Java, Spring Boot, PHP, COBOL, Kotlin (Android nativo)
- **Experiencia real**: 1 año

### Estado actual del proyecto (mayo 2026)

- ✅ Backend completo con 29 endpoints REST
- ✅ 12 plataformas de scraping (2 desactivadas: Google Jobs por costo, InfoJobs
  por falta de acceso a API)
- ✅ Evaluación con IA (DeepSeek v4 flash) + scoring previo P0-P5
- ✅ Cache de evaluaciones (SHA-256) para no repetir llamadas a IA
- ✅ Automatización semanal con node-cron (miércoles 8 AM ART)
- ✅ Frontend Angular 20 con 3 páginas (Dashboard, Login, Preferencias)
- ✅ Responsive (desktop, tablet, mobile) con vista cards en mobile
- ✅ Accesibilidad ARIA, focus trap, touch targets ≥44px
- ✅ Modo demo (sin backend) para mostrar el proyecto sin credenciales
- ✅ Rate limiting (5 req/min en endpoints costosos)
- ✅ Firebase Auth con JWT verification server-side
- ✅ 16 migraciones SQL aplicadas
- ✅ 16 archivos de tests backend + 7 archivos de tests frontend
- ✅ Deploy en Railway + Vercel

---

## LO QUE NECESITO DE VOS

### 1. Auditoría de seguridad

Revisá:
- Autenticación y autorización (Firebase JWT)
- Rate limiting
- CORS
- Helmet headers
- SQL injection (¿todas las queries son parametrizadas?)
- Exposición de secretos
- Validación de inputs
- Protección de endpoints sensibles

### 2. Auditoría de arquitectura

Revisá:
- Separación de responsabilidades (controladores → servicios → modelos)
- Patrones usados y si son correctos
- Acoplamiento entre módulos
- Escalabilidad del diseño actual
- Decisiones arquitectónicas cuestionables

### 3. Auditoría de backend

Revisá:
- Manejo de errores (try/catch, middlewares)
- Operaciones asíncronas
- Conexión a base de datos (pool, reconexión, transacciones)
- Lógica de negocio (scoring, evaluación, normalización)
- Código duplicado
- Nombres y convenciones inconsistentes
- Performance (consultas N+1, índices faltantes, queries lentas)

### 4. Auditoría de frontend

Revisá:
- Estructura de componentes
- Manejo de estado (signals vs services vs localStorage)
- Optimistic updates (¿son seguros? ¿manejan errores correctamente?)
- Manejo de errores HTTP
- Memory leaks (suscripciones, intervalos, event listeners)
- Performance (lazy loading, bundle size, change detection)
- Accesibilidad (WCAG 2.1 AA)
- UX (estados de carga, errores, vacíos)

### 5. Auditoría de base de datos

Revisá:
- Esquema (tipos de datos, constraints, índices)
- Migraciones (idempotencia, orden, rollback)
- Queries SQL (performance, índices necesarios)
- Integridad de datos
- Backup y recuperación

### 6. Auditoría de testing

Revisá:
- Cobertura (¿qué NO se prueba?)
- Tipos de tests (unitarios, integración, E2E)
- Calidad de los tests (asserts, mocks, fixtures)
- Tests faltantes en áreas críticas

### 7. Auditoría de DevOps / deploy

Revisá:
- Variables de entorno y secretos
- Configuración de Railway y Vercel
- CI/CD (si hay)
- Monitoreo y logging
- Estrategia de backup

### 8. Mejoras y recomendaciones

Basado en todo lo anterior, proponé:
- Mejoras de seguridad (priorizadas)
- Mejoras de performance
- Mejoras de UX
- Features faltantes que aportarían valor
- Deuda técnica a pagar
- Bugs potenciales

---

## FORMATO DE RESPUESTA ESPERADO

### Para cada hallazgo:

```markdown
### [H001] Título descriptivo del hallazgo

**Severidad**: 🔴 CRÍTICO | 🟠 ALTO | 🟡 MEDIO | 🟢 BAJO
**Categoría**: Seguridad | Arquitectura | Backend | Frontend | BD | Testing | DevOps
**Archivos afectados**: `ruta/al/archivo.js`, `ruta/al/otro.ts`

**Descripción**:
[Qué está mal, por qué es un problema, qué podría pasar]

**Recomendación**:
[Qué hacer para solucionarlo]

**Plan de implementación**:
1. [Paso 1 concreto con archivos y cambios]
2. [Paso 2]
3. [Verificación: comando para correr o test a verificar]
```

### Al final del informe, agregá un resumen ejecutivo:

```markdown
## Resumen Ejecutivo

### Puntaje general: XX/100

### Distribución de hallazgos:
- 🔴 Críticos: N
- 🟠 Altos: N
- 🟡 Medios: N
- 🟢 Bajos: N

### Top 5 prioridades:
1. [H###] Descripción corta
2. [H###] Descripción corta
...
```

---

## ARCHIVOS ADJUNTOS

A continuación adjunto la documentación completa del proyecto en 13 archivos.
Leelos todos antes de empezar la auditoría. Si algo no se entiende o falta
contexto, preguntame.

Los archivos son:
1. `01-VISION-GENERAL.md` — Visión general, propósito, stack, estado
2. `02-BACKEND-ESTRUCTURA.md` — Estructura del backend, archivos, configuración
3. `03-BACKEND-API.md` — API REST completa (29 endpoints, rate limiting, auth)
4. `04-BACKEND-SERVICIOS.md` — Servicios (scraping, evaluación, scoring, automatización)
5. `05-BACKEND-MODELOS.md` — Modelos/queries SQL, controladores
6. `06-BASE-DE-DATOS.md` — Esquema completo, migraciones, índices
7. `07-FRONTEND-ARQUITECTURA.md` — Arquitectura Angular, rutas, guards, interceptores
8. `08-FRONTEND-COMPONENTES.md` — Componentes, páginas, servicios
9. `09-FRONTEND-DESIGN.md` — Design system, accesibilidad, responsive
10. `10-FLUJOS-DE-DATOS.md` — Flujos end-to-end (scraping → IA → dashboard)
11. `11-CONFIGURACION.md` — Dependencias, variables de entorno, deploy
12. `12-TESTS.md` — Cobertura de tests, gaps, frameworks
13. `13-HALLAZGOS-PRELIMINARES.md` — Hallazgos ya detectados (para que no pierdas tiempo)

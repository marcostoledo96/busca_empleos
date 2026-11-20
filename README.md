# Busco Trabajo — AI Job Scraper

Plataforma personal para automatizar la búsqueda de empleo IT. Una API REST y un dashboard Angular centralizan la extracción, la evaluación y el seguimiento de ofertas. El [estado vigente y los pendientes](PLANIFICACION.md#estado-vigente) se distinguen del plan inicial.

## 🚀 Características principales

1. **Búsqueda automatizada** — El [registro de plataformas](backend/src/config/plataformas.js) indica qué fuentes están configuradas y cuáles figuran como activas. Algunas usan Apify; otras, como Computrabajo, usan extracción directa. Una fuente activa en el registro no implica que pueda ejecutarse: depende del entorno y del proveedor. Apify no garantiza ausencia de bloqueos ni de fallos.
2. **Evaluación de ofertas** — Compara los requisitos con el perfil confirmado. Las reglas determinísticas pueden resolver una exclusión y la caché puede reutilizar un resultado sin una nueva consulta a DeepSeek.
3. **Dashboard de gestión** — Permite buscar y filtrar ofertas, consultar el historial de búsquedas, dar seguimiento a postulaciones y revisar la importación del CV.

## 💻 Tech Stack

| Capa | Tecnología |
|------|-----------|
| **Backend** | Node.js + Express 5 |
| **Base de datos** | PostgreSQL en Railway (driver `pg`, consultas parametrizadas) |
| **Scraping** | Apify (`apify-client`) y mecanismos específicos por fuente |
| **Inteligencia Artificial** | DeepSeek API |
| **Autenticación** | Firebase Auth (JWT) |
| **Frontend** | Angular 20 + PrimeNG |
| **Testing** | Jest + Supertest (Backend) / Jasmine + Karma (Frontend) |

## 📁 Estructura del proyecto

```text
busca_empleos/
├── backend/       ← API REST en Node.js + Express (Scraping, IA, Auth, DB)
│   ├── src/       ← Controladores, Servicios, Modelos y Rutas
│   ├── sql/       ← Scripts de migración y definición de tablas
│   └── tests/     ← Suite de pruebas unitarias e integración (Jest)
├── frontend/      ← SPA en Angular (Dashboard Interactivo)
└── docs/          ← Documentación técnica del proyecto
```

## ⚙️ Entorno e inicio

Se recomienda Node.js 22 desde la versión 22.12.0. PostgreSQL local no es un
requisito general: el backend se conecta a la base del entorno mediante
`DATABASE_URL`. Las credenciales de Firebase y de los proveedores se configuran
solo para el entorno autorizado; no se incluyen credenciales de producción en
archivos versionados ni en ejemplos.

Se permite inspeccionar los archivos pertinentes sin acceder a secretos ni datos
personales. Esta guía no autoriza instalar dependencias, ejecutar comandos con
efectos ni publicar cambios; se aplican los límites de [AGENTS.md](AGENTS.md).

| Carpeta | Comando (solo con autorización) | Uso |
|---------|---------------------------------|-----|
| `backend/` y `frontend/`, por separado | `npm ci` | Instala las dependencias del lockfile de cada carpeta. |
| `backend/` | `npm run dev` o `npm start` | Inicia el backend; puede reanudar automatizaciones, escribir datos o llamar a proveedores. |
| `frontend/` | `npm start` | Inicia el servidor de desarrollo Angular. |

### Base de datos y despliegue

El runner canónico se invoca desde `backend/` con `npm run db:migrate`
(`npm run db:migrate:apply` para aplicar pendientes). **Incluso sin `--apply`
puede escribir** al crear `schema_migrations`; no es una simulación ni una
inspección de solo lectura. Antes de ejecutarlo, se requiere aprobación explícita
para el destino y los efectos, según [AGENTS.md](AGENTS.md#7-verificación-según-el-alcance).
Consultar el [runner de migraciones](docs/base-de-datos.md#runner-de-migraciones)
y la [guía de despliegue](docs/deploy.md#4-ejecutar-las-migraciones-sql). No usar
la instalación inicial sobre una base existente; para producción, seguir el
procedimiento de reconciliación indicado en la guía.

## Transición de dominio (registro histórico)

En la [transición de marca y dominio](docs/deploy.md#transición-de-marca-y-dominio--issue-27)
se definió **https://busco-trabajo.vercel.app** como dirección final y
https://busca-empleos.vercel.app como alias del mismo proyecto Vercel. La guía
separa la confirmación humana del acceso y del recorrido en Firebase de los
controles HTTP independientes. Ese registro no verifica un despliegue nuevo.

## 📚 Documentación técnica

| Documento | Contenido |
|-----------|-----------|
| [docs/arquitectura.md](docs/arquitectura.md) | Visión general del sistema |
| [docs/api-rest.md](docs/api-rest.md) | Referencia completa de endpoints |
| [docs/base-de-datos.md](docs/base-de-datos.md) | Esquema de tablas y modelos |
| [docs/scraping.md](docs/scraping.md) | Integración de fuentes y extracción |
| [docs/evaluacion-ia.md](docs/evaluacion-ia.md) | Lógica de evaluación con DeepSeek |
| [docs/frontend.md](docs/frontend.md) | Componentes y páginas del dashboard |

## 🧪 Tests

Para una ejecución autorizada, consultar los comandos por carpeta, las exclusiones
predeterminadas del script del backend y las posibles omisiones en
[AGENTS.md](AGENTS.md#5-entorno-y-comandos). `ALLOW_DB_TESTS=false` no garantiza
el aislamiento de red. Las pruebas que puedan tocar una base o un proveedor real
requieren confirmación previa del destino, los datos afectados y los efectos.

## 👤 Autor

**Marcos Ezequiel Toledo** — Desarrollador de software Junior, QA Tester y Soporte IT.

- 🌐 Portfolio: [marcostoledo.cv](https://www.marcostoledo.cv)
- GitHub: [github.com/marcostoledo96](https://github.com/marcostoledo96)
- LinkedIn: [linkedin.com/in/marcos-ezequiel-toledo](https://linkedin.com/in/marcos-ezequiel-toledo)

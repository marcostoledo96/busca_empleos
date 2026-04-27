# Busca Empleos — AI Job Scraper

Plataforma full-stack personal para automatizar la búsqueda activa de empleo IT. El sistema extrae periódicamente cientos de ofertas laborales de múltiples portales, las filtra mediante Inteligencia Artificial (DeepSeek) comparándolas con un perfil técnico configurado, y centraliza los resultados en un dashboard interactivo.

## 🚀 Características principales

1. **Scraping automatizado** — Extrae ofertas de LinkedIn, Computrabajo, Indeed, Bumeran, Glassdoor y GetOnBrd sin riesgo de bloqueo IP, utilizando la API de Apify.
2. **Evaluación semántica con IA** — Cada oferta es analizada por DeepSeek, que compara los requisitos técnicos y la experiencia solicitada con el perfil del candidato. Descarta falsos positivos (ej. QA de laboratorio vs. QA de software) y roles fuera del sector IT.
3. **Dashboard de gestión** — Interfaz web en Angular para visualizar, filtrar, buscar y hacer seguimiento a las postulaciones aprobadas.

## 💻 Tech Stack

| Capa | Tecnología |
|------|-----------|
| **Backend** | Node.js + Express 5 |
| **Base de datos** | PostgreSQL (driver `pg`, consultas parametrizadas) |
| **Scraping** | Apify API (`apify-client`) |
| **Inteligencia Artificial** | DeepSeek API |
| **Autenticación** | Firebase Auth (JWT) |
| **Frontend** | Angular 20 + PrimeNG |
| **Testing** | Jest + Supertest (Backend) / Jasmine + Karma (Frontend) |

## 📁 Estructura del proyecto

```text
Busca_empleos/
├── backend/       ← API REST en Node.js + Express (Scraping, IA, Auth, DB)
│   ├── src/       ← Controladores, Servicios, Modelos y Rutas
│   ├── sql/       ← Scripts de migración y definición de tablas
│   └── tests/     ← Suite de pruebas unitarias e integración (Jest)
├── frontend/      ← SPA en Angular (Dashboard Interactivo)
└── docs/          ← Documentación técnica del proyecto
```

## ⚙️ Requisitos previos

- Node.js v22+
- PostgreSQL instalado y corriendo localmente
- Cuenta en [Apify](https://apify.com/) con token de API
- Cuenta en [DeepSeek](https://platform.deepseek.com/) con API key
- Proyecto en Firebase (para autenticación)

## 📦 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/marcostoledo96/busca-empleos.git
cd busca-empleos
```

### 2. Configurar el backend

```bash
cd backend
npm install
cp .env.example .env
```

Editar `.env` con las credenciales reales (ver `.env.example` para referencia).

Descargar el archivo de credenciales del Service Account de Firebase desde:
`Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada`

Guardarlo como `backend/firebase-service-account.json`.

Crear la base de datos:

```bash
# Conectarse a PostgreSQL y ejecutar los scripts en orden:
psql -U postgres -f sql/crear-tablas.sql
psql -U postgres -f sql/migracion-002-postulacion-y-porcentaje.sql
psql -U postgres -f sql/migracion-003-preferencias.sql
psql -U postgres -f sql/migracion-007-modelo-deepseek-v4-flash.sql
```

Iniciar el servidor:

```bash
npm run dev       # Desarrollo (nodemon)
npm start         # Producción
```

### 3. Configurar el frontend

```bash
cd frontend
npm install
```

El frontend espera el backend en `http://localhost:3000`. Si usás otro puerto, actualizar `frontend/src/environments/environment.ts`.

```bash
ng serve          # Inicia en http://localhost:4200
```

## 📚 Documentación técnica

| Documento | Contenido |
|-----------|-----------|
| [docs/arquitectura.md](docs/arquitectura.md) | Visión general del sistema |
| [docs/api-rest.md](docs/api-rest.md) | Referencia completa de endpoints |
| [docs/base-de-datos.md](docs/base-de-datos.md) | Esquema de tablas y modelos |
| [docs/scraping.md](docs/scraping.md) | Configuración de actores de Apify |
| [docs/evaluacion-ia.md](docs/evaluacion-ia.md) | Lógica de evaluación con DeepSeek |
| [docs/frontend.md](docs/frontend.md) | Componentes y páginas del dashboard |

## 🧪 Tests

```bash
# Backend (desde backend/)
npm test

# Tests de modelos (requieren BD activa)
npm run test:modelos
```

## 👤 Autor

**Marcos Ezequiel Toledo** — Desarrollador de software Junior, QA Tester y Soporte IT.

- 🌐 Portfolio: [marcostoledo.cv](https://www.marcostoledo.cv)
- GitHub: [github.com/marcostoledo96](https://github.com/marcostoledo96)
- LinkedIn: [linkedin.com/in/marcos-ezequiel-toledo](https://linkedin.com/in/marcos-ezequiel-toledo)

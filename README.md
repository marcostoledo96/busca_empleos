# Busca Empleos

Sistema automatizado de búsqueda y evaluación de ofertas de trabajo. Extrae ofertas de múltiples plataformas usando la API de Apify, las evalúa con IA (DeepSeek) y muestra los resultados aprobados en un dashboard web.

## ¿Qué hace?

1. **Scraping** — Extrae ofertas de LinkedIn, Computrabajo, Indeed, Bumeran, Glassdoor y GetOnBrd a través de la API de Apify.
2. **Evaluación con IA** — Envía cada oferta a DeepSeek, que la compara contra un perfil profesional configurado y decide si hace match o no.
3. **Dashboard** — Interfaz web en Angular para visualizar, filtrar y gestionar las ofertas aprobadas.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express 5 |
| Base de datos | PostgreSQL (queries directas con `pg`) |
| Scraping | API de Apify (`apify-client`) |
| Evaluación IA | API de DeepSeek |
| Autenticación | Firebase Auth (JWT) |
| Frontend | Angular 20 + PrimeNG |
| Testing | Jest + Supertest (backend) / Jasmine + Karma (frontend) |

## Estructura del proyecto

```
Busca_empleos/
├── backend/       ← API REST en Node.js + Express
├── frontend/      ← SPA en Angular
└── docs/          ← Documentación técnica del proyecto
```

## Requisitos previos

- Node.js v22+
- PostgreSQL instalado y corriendo localmente
- Cuenta en [Apify](https://apify.com/) con token de API
- Cuenta en [DeepSeek](https://platform.deepseek.com/) con API key
- Proyecto en Firebase (para autenticación)

## Instalación

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

## Documentación técnica

| Documento | Contenido |
|-----------|-----------|
| [docs/arquitectura.md](docs/arquitectura.md) | Visión general del sistema |
| [docs/api-rest.md](docs/api-rest.md) | Referencia completa de endpoints |
| [docs/base-de-datos.md](docs/base-de-datos.md) | Esquema de tablas y modelos |
| [docs/scraping.md](docs/scraping.md) | Configuración de actores de Apify |
| [docs/evaluacion-ia.md](docs/evaluacion-ia.md) | Lógica de evaluación con DeepSeek |
| [docs/frontend.md](docs/frontend.md) | Componentes y páginas del dashboard |

## Tests

```bash
# Backend (desde backend/)
npm test

# Tests de modelos (requieren BD activa)
npm run test:modelos
```

## Autor

**Marcos Ezequiel Toledo** — Desarrollador de software junior, QA Tester y soporte IT.

- GitHub: [github.com/marcostoledo96](https://github.com/marcostoledo96)
- LinkedIn: [linkedin.com/in/marcos-ezequiel-toledo](https://linkedin.com/in/marcos-ezequiel-toledo)

# 11 — Configuración: Dependencias, Variables y Deploy

## Backend: Dependencias (package.json)

### Producción
| Paquete | Versión | Uso |
|---------|---------|-----|
| `apify-client` | ^2.22.3 | Actor de Apify para scraping |
| `cheerio` | ^1.2.0 | Parsing HTML en scraping directo (Computrabajo) |
| `cors` | ^2.8.6 | CORS para frontend Angular |
| `dotenv` | ^17.3.1 | Variables de entorno |
| `express` | ^5.2.1 | Servidor HTTP |
| `express-rate-limit` | ^8.3.2 | Rate limiting en endpoints costosos |
| `firebase-admin` | ^13.7.0 | Verificación JWT de Firebase Auth |
| `helmet` | ^8.1.0 | Headers de seguridad HTTP |
| `multer` | ^2.1.1 | Upload de archivos (CV Markdown) |
| `node-cron` | ^4.2.1 | Cron jobs para automatización |
| `pg` | ^8.20.0 | Driver PostgreSQL |

### Desarrollo
| Paquete | Versión | Uso |
|---------|---------|-----|
| `jest` | ^30.3.0 | Framework de tests |
| `nodemon` | ^3.1.14 | Recarga automática |
| `supertest` | ^7.2.2 | Testing de endpoints HTTP |

### Scripts npm
| Script | Comando |
|--------|---------|
| `start` | `node src/index.js` |
| `dev` | `nodemon src/index.js` |
| `test` | `jest --verbose` |
| `test:modelos` | `jest tests/modelos --verbose --runInBand` |
| `test:integracion` | `jest tests/integracion --verbose --runInBand` |
| `diagnostico:infojobs` | `node scripts/diagnostico-infojobs.js` |

---

## Frontend: Dependencias (package.json)

### Producción
| Paquete | Versión | Uso |
|---------|---------|-----|
| `@angular/common` | ^20.3.0 | Pipes, i18n, DOM |
| `@angular/compiler` | ^20.3.0 | Compilación AOT |
| `@angular/core` | ^20.3.0 | Framework core |
| `@angular/fire` | ^20.0.1 | Firebase Auth |
| `@angular/forms` | ^20.3.0 | Template-driven forms |
| `@angular/platform-browser` | ^20.3.0 | Bootstrap browser |
| `@angular/router` | ^20.3.0 | Enrutamiento |
| `@primeng/themes` | ^20.4.0 | Temas PrimeNG |
| `firebase` | ^11.10.0 | SDK Firebase |
| `primeicons` | ^7.0.0 | Iconos PrimeNG |
| `primeng` | ^20.4.0 | UI Components |
| `rxjs` | ~7.8.0 | Programación reactiva |
| `tslib` | ^2.3.0 | Runtime TS |
| `zone.js` | ~0.15.0 | Change detection |

### Desarrollo
| Paquete | Versión |
|---------|---------|
| `@angular-devkit/build-angular` | ^20.3.7 |
| `@angular/cli` | ^20.3.7 |
| `@angular/build` | ^20.3.7 |
| `jasmine-core` | ~5.9.0 |
| `karma` | ~6.4.0 |
| `karma-chrome-launcher` | ~3.2.0 |
| `karma-coverage` | ~2.2.0 |
| `karma-jasmine` | ~5.1.0 |
| `karma-jasmine-html-reporter` | ~2.1.0 |
| `typescript` | ~5.9.2 |

### Angular CLI config
- Builder: `@angular/build:application` (Vite-based)
- Budgets: initial bundle warning 1MB, error 2MB
- Component styles: warning 10kB, error 20kB
- Output hashing: `all` en producción
- Schematics: `skipTests: true` (no genera .spec.ts al crear componentes nuevos)

---

## Variables de Entorno

### Backend (.env.example)

**Base de datos (6 variables)**:
`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE`

**APIs externas (5 variables)**:
`APIFY_TOKEN`, `JOOBLE_API_KEY`, `INFOJOBS_CLIENT_ID`, `INFOJOBS_CLIENT_SECRET`,
`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`

**IA (1 variable)**:
`OPENCODE_GO_API_KEY`

**Servidor (5 variables)**:
`NODE_ENV`, `PUERTO`, `PORT`, `POSTGRES_MAX_INTENTOS_CONEXION`,
`POSTGRES_ESPERA_REINTENTO_MS`

**Seguridad (2 variables)**:
`CORS_ORIGEN`, `EMAIL_AUTORIZADO`

**Firebase (2 variables)**:
`FIREBASE_SERVICE_ACCOUNT_PATH`, `FIREBASE_SERVICE_ACCOUNT_JSON`

**Total**: 21 variables

### Variables requeridas vs opcionales

| Requeridas (sin ellas no funciona) | Opcionales |
|------------------------------------|------------|
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | `PGSSLMODE` |
| `APIFY_TOKEN` | `PUERTO` (default 3000) |
| `OPENCODE_GO_API_KEY` | `POSTGRES_MAX_INTENTOS_CONEXION` |
| `EMAIL_AUTORIZADO` | `POSTGRES_ESPERA_REINTENTO_MS` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` o `FIREBASE_SERVICE_ACCOUNT_JSON` | `JOOBLE_API_KEY` |
| `NODE_ENV` | `INFOJOBS_CLIENT_ID` / `INFOJOBS_CLIENT_SECRET` |
| | `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` |
| | `CORS_ORIGEN` |

### Seguridad de secretos
- `.env` en `.gitignore` ✅
- `firebase-service-account.json` en `.gitignore` ✅
- `frontend/src/environments/environment.ts` y `.prod.ts` en `.gitignore` ✅
- `cv.md` y archivos `.pdf`/`.docx` en `docs/` en `.gitignore` ✅
- **Riesgo**: `environment.ts` y `environment.prod.ts` contienen valores reales de
  Firebase en el working tree (aunque no versionados)

---

## Deploy

### Backend → Railway
- **URL**: `https://busca-empleos-production.up.railway.app`
- **Build**: `npm install`
- **Start**: `npm start`
- **Variables**: Se configuran en el dashboard de Railway
- **BD**: Railway inyecta `DATABASE_URL` automáticamente
- **Health check**: `GET /api/salud`
- **SSL**: Auto-detectado por `base-datos.js`

### Frontend → Vercel
- **URL**: `https://busca-empleos.vercel.app`
- **Build**: `npm run build`
- **Output**: `dist/frontend/browser`
- **SPA fallback**: Configurado en Vercel (`vercel.json` o dashboard)
- **Environment**: `environment.prod.ts` reemplaza `environment.ts` en build

### CI/CD
- **No hay CI/CD automatizado** (no GitHub Actions, no pipelines)
- Deploy manual desde CLI: `vercel --prod` y push a Railway

---

## Drift de documentación detectado

| Archivo | Dice | Realidad |
|---------|------|----------|
| `docs/evaluacion-ia.md` | `DEEPSEEK_API_KEY` | `.env.example` tiene `OPENCODE_GO_API_KEY` |
| `PLANIFICACION.md` | "Fase 0 — Setup" | Proyecto completo y en producción |
| `AGENTS.md` | Rama `main` | El repo usa `master` |
| `AGENTS.md` | Carpeta `DOCUMENTACION/` | La documentación está en `docs/` |
| `docs/base-de-datos.md` | Schema base | Faltan tablas `evaluaciones_cache`, `evaluacion_lotes` |

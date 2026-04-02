# Guía de Deploy — Busca Empleos

Backend en **Railway** (Node.js + PostgreSQL), frontend en **Vercel** (Angular).

Con el plan de $5 de Railway podés correr el servidor Node.js Y la base de datos PostgreSQL
en el mismo proyecto — sin cold starts, sin terceros extra, todo en un solo lugar.

---

## Índice

1. [Prerequisitos](#1-prerequisitos)
2. [Crear el proyecto en Railway](#2-crear-el-proyecto-en-railway)
3. [Agregar la base de datos PostgreSQL](#3-agregar-la-base-de-datos-postgresql)
4. [Ejecutar las migraciones SQL](#4-ejecutar-las-migraciones-sql)
5. [Configurar Firebase service account](#5-configurar-firebase-service-account)
6. [Configurar el servicio de backend](#6-configurar-el-servicio-de-backend)
7. [Deploy del frontend en Vercel](#7-deploy-del-frontend-en-vercel)
8. [Post-deploy: conectar todo](#8-post-deploy-conectar-todo)
9. [Variables de entorno — referencia completa](#9-variables-de-entorno--referencia-completa)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisitos

Antes de empezar, tenés que tener:

- [ ] Cuenta en [Railway](https://railway.app) — plan $5/mes activo
- [ ] Cuenta en [Vercel](https://vercel.com) — hosting frontend gratuito
- [ ] El repositorio del proyecto pusheado a GitHub
- [ ] Token de Apify (`APIFY_TOKEN`) — [apify.com](https://apify.com)
- [ ] API key de DeepSeek (`DEEPSEEK_API_KEY`) — [platform.deepseek.com](https://platform.deepseek.com)
- [ ] Proyecto Firebase con autenticación configurada

---

## 2. Crear el proyecto en Railway

1. Ir a [railway.app](https://railway.app) → **New Project**
2. Seleccionar **Deploy from GitHub repo**
3. Buscar y seleccionar el repositorio `Busca_empleos`
4. Railway crea el servicio del backend automáticamente

Todavía **no hacer deploy** — primero hay que agregar la base de datos y configurar las variables.

---

## 3. Agregar la base de datos PostgreSQL

Railway te permite agregar un servicio PostgreSQL dentro del mismo proyecto, sin cuentas externas.

### 3.1 Agregar el servicio

1. En el proyecto de Railway → hacer clic en **New** (dentro del mismo proyecto)
2. Seleccionar **Database** → **Add PostgreSQL**
3. Railway crea el servicio de base de datos en segundos

### 3.2 Conectar la BD al backend

Railway inyecta `DATABASE_URL` automáticamente cuando los dos servicios (backend y PostgreSQL)
están en el mismo proyecto. Para asegurarse:

1. Hacer clic en el servicio del **backend** → pestaña **Variables**
2. Buscar si ya aparece `DATABASE_URL` en la lista de variables disponibles
3. Si no aparece, hacer clic en **Add Reference** y seleccionar la variable
   `DATABASE_URL` del servicio PostgreSQL

> **¿Por qué funciona sin configuración manual?**
> Railway detecta los servicios del mismo proyecto y comparte las variables entre ellos.
> El backend ya lee `DATABASE_URL` automáticamente (ver `backend/src/config/base-datos.js`).

### 3.2.1 Revisar `PGDATA` antes del primer deploy

Si en los logs del servicio PostgreSQL aparece este error:

```text
PGDATA variable does not start with the expected volume mount path, expected to start with /var/lib/postgresql/data
```

el problema no está en Node.js: el contenedor de PostgreSQL no puede arrancar porque
`PGDATA` quedó apuntando fuera del volumen que Railway monta para persistencia.

Para corregirlo:

1. Entrar al servicio **PostgreSQL** → pestaña **Variables**.
2. Buscar `PGDATA`.
3. Si tiene un valor personalizado, hacer una de estas dos cosas:
    - borrar la variable para que Railway use el valor por defecto, o
    - setearla a una ruta válida que empiece con `/var/lib/postgresql/data`, por ejemplo:
       ```text
       /var/lib/postgresql/data/pgdata
       ```
4. Guardar y redesplegar el servicio PostgreSQL.

Hasta que PostgreSQL no arranque bien, el backend siempre va a fallar al conectar.

### 3.3 Obtener la DATABASE_URL (para las migraciones)

1. En el proyecto de Railway → hacer clic en el servicio **PostgreSQL**
2. Ir a la pestaña **Variables**
3. Copiar el valor de `DATABASE_URL` — lo vas a necesitar en el paso 4

---

## 4. Ejecutar las migraciones SQL

La base de datos arranca vacía. Hay que crear las tablas ejecutando los scripts SQL
en este **orden obligatorio**:

| Orden | Archivo | Qué crea |
|-------|---------|----------|
| 1° | `backend/sql/crear-tablas.sql` | Tabla `ofertas` con todos sus índices |
| 2° | `backend/sql/migracion-002-postulacion-y-porcentaje.sql` | Columnas de postulación y porcentaje match |
| 3° | `backend/sql/migracion-003-preferencias.sql` | Tabla `preferencias` con datos iniciales |

### Cómo ejecutar desde el editor web de Railway

1. Hacer clic en el servicio **PostgreSQL** → pestaña **Query**
2. Abrir el archivo `backend/sql/crear-tablas.sql` en VS Code
3. Copiar todo el contenido → pegarlo en el editor de Railway → clic en **Run Query**
4. Repetir con `migracion-002-postulacion-y-porcentaje.sql`
5. Repetir con `migracion-003-preferencias.sql`

Para verificar que las tablas existen, ejecutar en el mismo editor:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

Deberías ver `ofertas` y `preferencias` en la lista.

---

## 5. Configurar Firebase service account

El backend necesita verificar los tokens JWT de Firebase. Para eso usa un JSON
con credenciales que generás en la consola de Firebase.

### 5.1 Obtener el JSON

1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Seleccionar tu proyecto (`busca-empleo-a4fbe`)
3. Ir a **Configuración del proyecto** (ícono de engranaje) → pestaña **Cuentas de servicio**
4. Hacer clic en **Generar nueva clave privada** → confirmar → se descarga un `.json`

### 5.2 Preparar el valor para la variable de entorno

El contenido del JSON descargado va COMPLETO en la variable `FIREBASE_SERVICE_ACCOUNT_JSON`.

1. Abrir el archivo `.json` descargado con cualquier editor de texto
2. Copiar TODO el contenido (empieza con `{` y termina con `}`)
3. Guardarlo aparte — lo vas a pegar en Railway en el paso 6.1

> **Importante:** el JSON tiene saltos de línea en la private key (`\n`).
> Pegarlo tal cual sin modificarlo. Railway lo maneja correctamente.

---

## 6. Configurar el servicio de backend

### 6.1 Configurar variables de entorno

En el servicio del backend → pestaña **Variables** → agregar con **New Variable**:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `PUERTO` | `3000` |
| `PGSSLMODE` | `require` |
| `POSTGRES_MAX_INTENTOS_CONEXION` | `10` |
| `POSTGRES_ESPERA_REINTENTO_MS` | `3000` |
| `EMAIL_AUTORIZADO` | Tu email de Firebase |
| `CORS_ORIGEN` | `https://REEMPLAZAR-CON-URL-VERCEL.vercel.app` (actualizar en paso 8) |
| `APIFY_TOKEN` | `apify_api_...` |
| `DEEPSEEK_API_KEY` | `sk-...` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | El JSON completo del paso 5.2 |

> **`DATABASE_URL` no la agregues manualmente** — Railway la inyecta automáticamente
> desde el servicio PostgreSQL del mismo proyecto (ver paso 3.2).

> **Ojo:** `DATABASE_URL` no es solo el host. Tiene que ser una URL completa del estilo
> `postgresql://usuario:password@host:5432/base_de_datos`. Si ponés algo como
> `postgres-production-261f.up.railway.app`, el backend la considera inválida y hace fallback
> a las variables `PG*`.

> **`PGSSLMODE=require` es una red de seguridad**: si Railway no expone bien `NODE_ENV`
> o si en algún redeploy cambia el entorno, el backend igual va a forzar SSL para PostgreSQL.

> **Usá referencia de Railway para `DATABASE_URL` siempre que puedas.**
> Copiar `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` y `PGDATABASE` a mano funciona,
> pero te deja más expuesto a drift entre servicios. Si el backend tiene `DATABASE_URL`,
> esa estrategia pasa a ser la fuente de verdad.

### 6.2 Configurar el root directory y los comandos

En el servicio del backend → pestaña **Settings**:

| Campo | Valor |
|-------|-------|
| **Root Directory** | `backend` |
| **Build Command** | `npm install` |
| **Start Command** | `node src/index.js` |

### 6.3 Generar el dominio público

Railway no expone el servicio automáticamente. Hay que generar la URL pública:

1. En el servicio del backend → pestaña **Settings**
2. Bajar hasta la sección **Networking** → **Public Networking**
3. Hacer clic en **Generate Domain**
4. Railway genera una URL del tipo:
   ```
   https://busca-empleos-production.up.railway.app
   ```
5. Copiar y guardar esta URL — la vas a necesitar en los pasos 7 y 8.

### 6.4 Hacer el deploy

1. En el servicio del backend → pestaña **Deployments**
2. Hacer clic en **Deploy Now**
3. Seguir los logs en tiempo real — el proceso tarda 1-2 minutos

### 6.5 Verificar el health check

Una vez que los logs muestren `Servidor escuchando en el puerto 3000`, abrir en el navegador:

```
https://busca-empleos-production.up.railway.app/api/salud
```

Debería responder:

```json
{
  "estado": "ok",
  "entorno": "production"
}
```

---

## 7. Deploy del frontend en Vercel

Los archivos de entorno (`environment.ts`, `environment.prod.ts`) **no están trackeados en git**
para evitar exponer la Firebase API Key. En su lugar, Vercel lee las variables de entorno
y el script `frontend/scripts/generar-env.js` genera el archivo `environment.prod.ts`
automáticamente antes de que Angular compile.

### 7.1 Configurar variables de entorno en Vercel

Antes de conectar el repositorio, definir las variables de entorno que va a leer el script:

| Variable de Vercel | Valor |
|-------------------|-------|
| `API_URL` | `https://busca-empleos-production.up.railway.app/api` |
| `FIREBASE_API_KEY` | La API key del proyecto Firebase |
| `FIREBASE_AUTH_DOMAIN` | `busca-empleo-a4fbe.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | `busca-empleo-a4fbe` |
| `FIREBASE_STORAGE_BUCKET` | `busca-empleo-a4fbe.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | `962113157150` |
| `FIREBASE_APP_ID` | `1:962113157150:web:028053b8e4c576dcad560f` |

> Los valores de Firebase los encontrás en Firebase Console →
> Configuración del proyecto → General → "Your apps" → Web app → `firebaseConfig`.

### 7.2 Conectar el repositorio en Vercel

1. Ir a [vercel.com](https://vercel.com) → **New Project**
2. Importar el repositorio `Busca_empleos` desde GitHub
3. Configurar:

| Campo | Valor |
|-------|-------|
| **Framework Preset** | Angular |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist/frontend/browser` |
| **Install Command** | `npm install` |

4. Agregar las variables de entorno del paso 7.1 en la sección **Environment Variables**
5. Hacer clic en **Deploy**

> **¿Por qué `dist/frontend/browser`?**
> Angular 17+ genera los archivos estáticos en esa subcarpeta, no en `dist/frontend`.

> **¿Por qué funciona sin `environment.prod.ts` en git?**
> Antes de que Angular compile, `npm run build` ejecuta el script `prebuild`,
> que genera `environment.prod.ts` desde las variables de Vercel del paso 7.1.

---

## 8. Post-deploy: conectar todo

### 8.1 Actualizar CORS en Railway

Ahora que tenés la URL real de Vercel, actualizá `CORS_ORIGEN` en Railway:

1. Railway → tu proyecto → servicio del backend → pestaña **Variables**
2. Editar `CORS_ORIGEN`:
   ```
   CORS_ORIGEN=https://busca-empleos.vercel.app
   ```
3. Guardar — Railway reinicia el servicio automáticamente.

### 8.2 Autorizar el dominio de Vercel en Firebase

Firebase Authentication rechaza logins desde dominios no autorizados.

1. Ir a [Firebase Console](https://console.firebase.google.com) → tu proyecto
2. **Authentication** → pestaña **Settings** → sección **Authorized domains**
3. Hacer clic en **Add domain**
4. Agregar el dominio de Vercel sin `https://`: `busca-empleos.vercel.app`

### 8.3 Checklist de verificación final

- [ ] `GET https://busca-empleos-production.up.railway.app/api/salud` responde `{ "estado": "ok" }`
- [ ] Login en el frontend funciona (Firebase auth)
- [ ] El dashboard carga y muestra las ofertas (token JWT se envía correctamente)
- [ ] Ejecutar un scraping manual (consume Apify, verificar que no hay error 500)
- [ ] Ejecutar una evaluación manual (consume DeepSeek, verificar que no hay error 500)
- [ ] La tabla de ofertas muestra los resultados

---

## 9. Variables de entorno — referencia completa

### Backend (Railway — pestaña Variables del servicio backend)

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | *(inyectada automáticamente por Railway)* | URL de la BD PostgreSQL del mismo proyecto |
| `NODE_ENV` | `production` | Marca el backend como entorno productivo |
| `PGSSLMODE` | `require` | Fuerza SSL aunque `NODE_ENV` no llegue correctamente |
| `POSTGRES_MAX_INTENTOS_CONEXION` | `10` | Reintentos de conexión al arrancar el backend |
| `POSTGRES_ESPERA_REINTENTO_MS` | `3000` | Espera entre reintentos al arrancar |
| `PUERTO` | `3000` | Puerto del servidor Express |
| `EMAIL_AUTORIZADO` | `marcos@gmail.com` | Solo este email puede usar la app |
| `CORS_ORIGEN` | `https://app.vercel.app` | URL del frontend en Vercel |
| `APIFY_TOKEN` | `apify_api_...` | Token de la cuenta en apify.com |
| `DEEPSEEK_API_KEY` | `sk-...` | API key de platform.deepseek.com |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account"...}` | JSON completo del service account |

### Frontend (Vercel — sección Environment Variables)

Estas variables las lee `frontend/scripts/generar-env.js` durante el build.
**No van en el código fuente ni en git.**

| Variable | Descripción |
|----------|-------------|
| `API_URL` | URL completa del backend en Railway (con `/api` al final) |
| `FIREBASE_API_KEY` | API key del proyecto Firebase |
| `FIREBASE_AUTH_DOMAIN` | Dominio de autenticación Firebase |
| `FIREBASE_PROJECT_ID` | ID del proyecto Firebase |
| `FIREBASE_STORAGE_BUCKET` | Bucket de almacenamiento Firebase |
| `FIREBASE_MESSAGING_SENDER_ID` | ID de mensajería Firebase |
| `FIREBASE_APP_ID` | ID de la app web en Firebase |

---

## 10. Troubleshooting

### El backend no arranca en Railway

Los logs se ven en: Railway → tu proyecto → servicio backend → pestaña **Deployments** → clic en el deployment activo.

- `"No pude iniciar el backend porque falló la conexión a PostgreSQL"` → revisar en este orden:
   1. que el servicio PostgreSQL esté realmente levantado;
   2. que `DATABASE_URL` esté referenciada en el backend;
   3. que el backend tenga `PGSSLMODE=require` o, como mínimo, `NODE_ENV=production`.
- `getaddrinfo ENOTFOUND base` → `DATABASE_URL` suele estar mal formada. En Railway no pegues un host a mano: agregá una **Reference** a `DATABASE_URL` del servicio PostgreSQL, o eliminá la variable inválida para que el backend use `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` y `PGDATABASE`.
- Si PostgreSQL tarda unos segundos en recuperarse después del deploy, el backend ahora reintenta la conexión varias veces antes de abortar. Si aun así cae, el problema ya no es timing sino configuración real de acceso.
- `"PGDATA variable does not start with the expected volume mount path"` en el servicio PostgreSQL → el problema está en la configuración de Railway del servicio de base, no en el código del backend. Corregir `PGDATA` como en el paso 3.2.1 y redesplegar PostgreSQL primero.
- `"FIREBASE_SERVICE_ACCOUNT_JSON tiene un formato JSON inválido"` → el JSON pegado en la variable de entorno tiene escapes incorrectos. Copiar el contenido del archivo `.json` directamente, sin modificarlo.
- `"El servidor no puede arrancar sin la configuración de Firebase Admin"` → falta `FIREBASE_SERVICE_ACCOUNT_JSON` en las variables de entorno del backend.

### El build de Vercel falla — "Cannot find module './environments/environment.prod.ts'"

El script `generar-env.js` no pudo crear el archivo porque falta una variable de entorno.

1. En Vercel → tu proyecto → **Settings** → **Environment Variables**
2. Verificar que están todas las variables listadas en el paso 7.1
3. Redesplegar desde: Vercel → **Deployments** → botón **Redeploy**

### El frontend no puede hacer requests al backend (CORS error)

**Síntoma:** en la consola del navegador aparece `Access-Control-Allow-Origin`.

- Verificar que `CORS_ORIGEN` en Railway tiene exactamente la URL de Vercel (sin barra al final, con `https://`).
- El backend deja pasar el preflight `OPTIONS` sin token, pero el origin igual tiene que estar autorizado.
- Después de cambiar la variable, esperar que Railway termine de reiniciar el servicio.

### El login no funciona (Firebase error)

**Síntoma:** error al hacer login en la pantalla de login del frontend.

- Verificar que el dominio de Vercel está en **Authorized domains** en Firebase Console → Authentication → Settings (ver paso 8.2).

### El dashboard da 401 después de loguearme

**Síntoma:** el login funciona pero las llamadas a la API devuelven 401.

- Verificar que `EMAIL_AUTORIZADO` en Railway tiene exactamente el mismo email que usás para loguearte en Firebase.

### Las tablas no existen en la BD

**Síntoma:** el backend arranca pero los endpoints devuelven error 500 con "relation does not exist".

- Verificar que las migraciones se ejecutaron en Railway en el orden correcto (crear-tablas → migracion-002 → migracion-003).
- En el servicio PostgreSQL → pestaña **Query** → ejecutar:
  ```sql
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
  ```
  Deberías ver `ofertas` y `preferencias`.

### Railway dice "No start command found"

- Verificar en Railway → servicio backend → **Settings** → **Start Command** que dice `node src/index.js`.
- Si quedó vacío, editarlo manualmente desde el dashboard.
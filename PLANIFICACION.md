# PLANIFICACION.md — Hoja de ruta del proyecto Busca Empleos

## Resumen del proyecto

Sistema automatizado que extrae ofertas de empleo de LinkedIn y Computrabajo,
las evalúa con IA (DeepSeek) contra mi perfil, y muestra las aprobadas
en un dashboard web.

---

## Fases de desarrollo

### Fase 0 — Setup del proyecto

**Objetivo:** Tener el proyecto inicializado con todas las herramientas listas.

**Tareas:**

1. Crear estructura de carpetas del backend.
2. Inicializar el proyecto con `npm init`.
3. Instalar dependencias de producción (express, pg, apify-client, dotenv, cors).
4. Instalar dependencias de desarrollo (jest, nodemon).
5. Configurar `.gitignore` y `.env.example`.
6. Configurar scripts en `package.json` (start, dev, test).
7. Instalar y configurar PostgreSQL localmente.
8. Inicializar Git y hacer primer commit.

**Entregable:** Proyecto con estructura lista, `npm run dev` funcionando
(servidor Express básico) y PostgreSQL accesible.

---

### Fase 1 — Base de datos

**Objetivo:** Tener la tabla de ofertas creada y un módulo de conexión funcionando.

**Dependencia:** Fase 0.

**Tareas:**

1. Crear el módulo de conexión a PostgreSQL (`src/config/base-datos.js`).
2. Diseñar el esquema de la tabla `ofertas`:
   - id, titulo, empresa, ubicacion, modalidad, descripcion, url, plataforma,
     estado_evaluacion, razon_evaluacion, fecha_extraccion.
3. Crear el script SQL para la tabla.
4. Crear el modelo `src/modelos/oferta.js` con funciones de inserción y consulta.
5. Escribir tests para el módulo de conexión y las queries.

**Entregable:** Tabla creada en PostgreSQL, módulo de conexión funcionando, tests pasando.

---

### Fase 2 — Scraping con Apify

**Objetivo:** Poder extraer ofertas de LinkedIn y Computrabajo y guardarlas en la BD.

**Dependencia:** Fases 0 + 1.

**Tareas:**

1. Crear `src/config/apify.js` con la configuración del cliente Apify.
2. Crear `src/servicios/servicio-scraping.js` con funciones para ejecutar Actors.
3. Implementar extracción de LinkedIn (buscar el Actor adecuado en Apify Store).
4. Implementar extracción de Computrabajo.
5. Normalizar los datos de ambas plataformas a un formato unificado.
6. Guardar las ofertas normalizadas en la base de datos.
7. Escribir tests para los servicios de scraping.

**Entregable:** Ejecutar scraping manualmente desde un script, ver ofertas en la BD.

---

### Fase 3 — Evaluación con IA (DeepSeek)

**Objetivo:** Evaluar cada oferta contra mi perfil y marcar si es match o no.

**Dependencia:** Fases 1 + 2.

**Tareas:**

1. Crear `src/config/deepseek.js` con la configuración del cliente HTTP.
2. Crear `src/servicios/servicio-evaluacion.js`.
3. Diseñar el prompt que recibe la oferta y el perfil, devuelve match/no-match con razón.
4. Implementar la lógica: tomar ofertas sin evaluar, enviarlas a DeepSeek, guardar resultado.
5. Manejar rate limits y errores de la API.
6. Escribir tests.

**Entregable:** Ofertas evaluadas automáticamente con resultado y razón en la BD.

---

### Fase 4 — API REST

**Objetivo:** Exponer endpoints para que el frontend consuma los datos.

**Dependencia:** Fases 1, 2 y 3.

**Tareas:**

1. Configurar Express en `src/index.js` con middleware (cors, json, manejo de errores).
2. Crear rutas:
   - `GET /api/ofertas` — Listar ofertas (con filtros: estado, plataforma).
   - `GET /api/ofertas/:id` — Detalle de una oferta.
   - `POST /api/scraping/ejecutar` — Disparar un scraping manualmente.
   - `POST /api/evaluacion/ejecutar` — Disparar evaluación manualmente.
   - `GET /api/estadisticas` — Resumen (total, aprobadas, rechazadas).
3. Crear controladores para cada grupo de rutas.
4. Implementar middleware de manejo de errores centralizado.
5. Escribir tests para los endpoints.

**Entregable:** API REST funcional, probada con curl o Postman.

---

### Fase 5 — Frontend (Angular)

**Objetivo:** Dashboard web para ver las ofertas aprobadas y gestionar el scraping.

**Dependencia:** Fase 4.

**Tareas:**

1. Crear el proyecto Angular con `ng new frontend`.
2. Configurar servicio HTTP para consumir la API del backend.
3. Crear página principal: lista de ofertas aprobadas con detalles.
4. Crear panel de control: botones para ejecutar scraping y evaluación.
5. Crear vista de estadísticas.
6. Estilizar con CSS.
7. Escribir tests de componentes.

**Entregable:** Dashboard funcional conectado al backend.

---

### Fase 6 — Automatización

**Objetivo:** Que el scraping y la evaluación corran solos periódicamente.

**Dependencia:** Fases 2, 3 y 4.

**Tareas:**

1. Implementar un cron/scheduler (node-cron o similar) en el backend.
2. Configurar frecuencia (ej: cada 12 horas).
3. Ejecutar scraping → evaluación → log de resultados.
4. Manejo de errores: si falla el cron, logear y reintentar.
5. Escribir tests.

**Entregable:** El sistema extrae y evalúa ofertas automáticamente.

---

### Fase 7 — Polish y cierre

**Objetivo:** Pulir, documentar y dejar el proyecto presentable.

**Dependencia:** Todas las fases anteriores.

**Tareas:**

1. Crear `README.md` con descripción, setup, uso y screenshots.
2. Revisar seguridad: variables de entorno, queries parametrizadas, validación de inputs.
3. Dockerizar (opcional): `docker-compose.yml` para levantar backend + PostgreSQL.
4. Revisión general de código y limpieza.

**Entregable:** Proyecto completo, documentado y funcional.

---

## Orden de implementación visual

```
Fase 0 (Setup) → Fase 1 (BD) → Fase 2 (Scraping) → Fase 3 (IA)
                                                          ↓
                                                     Fase 4 (API)
                                                          ↓
                                              Fase 5 (Frontend) + Fase 6 (Cron)
                                                          ↓
                                                     Fase 7 (Polish)
```

---

## Fase actual

> **Estamos en: Fase 0 — Setup del proyecto.**

# Prompt para OpenCode — Corrección de auditoría por código fuente

Actuá como desarrollador senior full-stack. Vas a corregir hallazgos de auditoría del proyecto **Busca Empleos**.

## Reglas

1. No reescribas el proyecto completo.
2. Hacé cambios por fases.
3. Antes de tocar una fase, inspeccioná los archivos reales.
4. Después de cada fase, corré tests o checks relevantes.
5. El código y comentarios deben seguir en español.
6. No imprimas secretos ni valores de `.env`.
7. Si encontrás que un hallazgo ya está corregido, documentalo y pasá al siguiente.

## Fase inicial obligatoria

Primero revisá estos archivos:

- `backend/src/app.js`
- `backend/src/rutas/preferencias.js`
- `backend/src/controladores/controlador-preferencias.js`
- `backend/src/controladores/controlador-ofertas.js`
- `backend/src/config/base-datos.js`
- `backend/src/servicios/servicio-evaluacion.js`
- `backend/src/modelos/evaluacion-lote.js`
- `frontend/src/app/servicios/persistencia-dashboard.service.ts`
- `frontend/src/app/paginas/dashboard/dashboard.ts`
- `frontend/src/app/componentes/detalle-oferta/detalle-oferta.ts`

## Orden de trabajo

### 1. Seguridad inmediata

Corregí:

- Rate limit faltante en `POST /api/preferencias/importar-cv/analizar`.
- Diagnóstico de persistencia protegido por variable explícita y salida sanitizada.
- Error interno de preferencias sin filtrar `err.message` al cliente.
- Errores de Multer con status 400/413.
- CORS fail-closed en producción.

### 2. Integridad de datos

Agregá migración nueva con constraints CHECK para estados y porcentajes.

### 3. Evaluación y concurrencia

- Implementá lectura de último lote en `evaluacion-lote.js`.
- Rehidratá progreso desde BD cuando memoria esté vacía.
- Agregá lock persistente o advisory lock para evitar evaluaciones simultáneas.

### 4. Performance

- Agregá paginación a `GET /api/ofertas`.
- Limitá bulk update a máximo 200 IDs.
- Prepará evaluación por lotes si hay muchas pendientes.

### 5. Frontend

- Agregá TTL/version al cache de dashboard.
- Corregí merge de optimistic updates usando set de IDs pendientes.
- Limpiá timeout del foco en `DetalleOferta`.

### 6. Tests

Agregá tests mínimos para cada cambio. No cierres la tarea sin indicar qué tests corriste.

## Formato de respuesta esperado

Para cada fase respondé:

```markdown
## Fase X completada

### Archivos modificados
- ...

### Cambios realizados
- ...

### Tests/checks ejecutados
- ...

### Riesgos o pendientes
- ...
```

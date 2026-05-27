# Checklist de verificación post-auditoría — Busca Empleos

## Seguridad

- [ ] Firebase Admin service account rotado.
- [ ] API keys del `.env` rotadas.
- [ ] ZIP seguro generado con `git archive` o script equivalente.
- [ ] El ZIP no contiene `.env`.
- [ ] El ZIP no contiene `firebase-service-account.json`.
- [ ] El ZIP no contiene `.git`.
- [ ] El ZIP no contiene `node_modules`.
- [ ] `POST /api/preferencias/importar-cv/analizar` tiene rate limit.
- [ ] Diagnóstico de persistencia deshabilitado por defecto.
- [ ] Diagnóstico no devuelve connection string ni credenciales.
- [ ] Errores 500 no devuelven `err.message` al cliente.
- [ ] Multer devuelve 400/413 para errores de usuario.
- [ ] CORS exige `CORS_ORIGEN` en producción.

## Base de datos

- [ ] Hay constraints CHECK para `estado_evaluacion`.
- [ ] Hay constraints CHECK para `estado_postulacion`.
- [ ] Hay constraints CHECK para `porcentaje_match`.
- [ ] Hay constraints CHECK para `score_previo`.
- [ ] Existe tabla `schema_migrations` o herramienta equivalente.
- [ ] Las migraciones nuevas tienen numeración única.
- [ ] Hay comando único para migrar.

## Backend

- [ ] `GET /api/ofertas` soporta `limit` y `offset` o cursor.
- [ ] `GET /api/ofertas` limita el máximo de registros por request.
- [ ] Evaluación no carga indefinidamente todas las pendientes.
- [ ] Evaluación/ciclo completo tienen lock persistente o advisory lock.
- [ ] `evaluacion_lotes` se puede leer para rehidratar progreso.
- [ ] Bulk update limita cantidad máxima de IDs.
- [ ] Validación de scraping rechaza maxResultados negativos y términos excesivos.

## Frontend

- [ ] Cache de dashboard tiene versión.
- [ ] Cache de dashboard tiene TTL.
- [ ] Merge de polling preserva solo optimistic updates pendientes.
- [ ] Timeout de foco del modal se limpia al destruir/cerrar.
- [ ] UI muestra error claro si backend no sincroniza.

## Testing

- [ ] Tests de rate limit de importación CV.
- [ ] Tests de diagnóstico sanitizado.
- [ ] Tests de constraints o modelos con valores inválidos.
- [ ] Tests de `servicio-scoring-previo.js`.
- [ ] Tests de `evaluacion-cache.js`.
- [ ] Tests de `evaluacion-lote.js`.
- [ ] `dashboard.spec.ts` creado.
- [ ] Servicios HTTP Angular testeados con `HttpTestingController`.
- [ ] CI ejecuta backend tests.
- [ ] CI ejecuta frontend build/tests.

## Documentación

- [ ] `.env.example` alinea DeepSeek/OpenCode Go.
- [ ] `docs/evaluacion-ia.md` refleja proveedor real.
- [ ] `docs/deploy.md` incluye export seguro y rotación de secretos.
- [ ] `docs/seguridad.md` documenta Firebase Auth + email autorizado + rate limits.
- [ ] `docs/testing.md` documenta comandos y cobertura esperada.

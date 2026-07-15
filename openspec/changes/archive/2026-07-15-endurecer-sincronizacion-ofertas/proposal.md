# Propuesta: Endurecer sincronización de ofertas

## Intención

Resolver el issue aprobado #1: la cancelación deja activa la petición HTTP, los cursores se invalidan al reiniciar y fallos PostgreSQL se presentan como errores del cliente.

## Alcance

### Incluido
- Abortar la petición activa al cancelar, conservar el último cursor confirmado, marcar la sesión `cancelada` y omitir el fallback legacy.
- Exigir `CURSOR_SINCRONIZACION_SECRETO` en producción; permitir fallback efímero solo en test/desarrollo con warning.
- Mantener `400` para límite/cursor inválido, `409` para snapshot invalidado y delegar errores operativos inesperados al `500` global.
- Agregar tests backend/frontend y actualizar configuración y documentación.

### Fuera de alcance
- Cifrado del cursor, expiración o sesiones persistentes.
- Nuevos endpoints, tablas, migraciones u otros portales.

## Capacidades

### Capacidades nuevas
Ninguna.

### Capacidades modificadas
- `sincronizacion-ofertas`: cancelación HTTP efectiva, política del secreto de firma y clasificación pública de errores.

## Enfoque

Cancelar el `Observable` activo; Angular aborta una petición `HttpClient` al desuscribirse. Distinguir esa salida de un fallo para preservar el estado confirmado sin ejecutar el listado legacy. Resolver el secreto al iniciar el módulo según ambiente y advertir el fallback permitido. En el controlador, usar una whitelist de errores de contrato y propagar el resto al middleware global.

## Áreas afectadas

| Área | Impacto | Descripción |
|---|---|---|
| `frontend/src/app/paginas/dashboard/` | Modificada | Cancelación, estado y pruebas. |
| `backend/src/modelos/oferta.js` | Modificada | Política del secreto y estabilidad de cursores. |
| `backend/src/controladores/controlador-ofertas.js` | Modificada | Contrato `400/409/500`. |
| `backend/tests/`, `frontend/src/app/servicios/` | Modificada | Cobertura de aborto, reinicio y errores. |
| `backend/.env.example`, `docs/`, `openspec/specs/` | Modificada | Configuración y contratos operativos. |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Cancelación tardía afecta una reanudación | Media | Aislar y cerrar el control por sesión. |
| Producción sin secreto no inicia | Media | Fallo temprano y variable documentada. |
| Error interno filtra detalles | Baja | Respuesta genérica del middleware `500`. |

## Plan de rollback

Revertir código y documentación; no hay migraciones. Si cambia el secreto, descartar el cursor pendiente y reiniciar la sincronización.

## Dependencias

- Cancelación de Angular `HttpClient` y middleware global de Express.
- Entrega `single-pr`, presupuesto de revisión: 2000 líneas.

## Criterios de éxito

- [ ] Cancelar aborta la petición pendiente, conserva el cursor confirmado y no activa fallback legacy.
- [ ] Cursores sobreviven reinicios con el mismo secreto; producción rechaza configuración ausente y test/dev advierte su fallback.
- [ ] Errores de contrato responden `400/409`; fallos PostgreSQL inesperados responden `500`.
- [ ] Tests backend/frontend, build y documentación pasan la verificación.

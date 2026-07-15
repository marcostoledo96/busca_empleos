# Delta para Persistencia

## ADDED Requirements

### Requirement: Persistencia aditiva y cacheada de prioridad IA

La migración 018 MUST agregar, sin borrar ni reescribir datos existentes, los campos necesarios para prioridad IA, evidencias y versión de política de caché. Un backfill MUST ofrecer `dry-run` sin escrituras, limitar candidatos a la ventana fija de 30 días al inicio de su ejecución y MUST NOT leer ni escribir ofertas históricas fuera de esa ventana. MUST preservar `match`, exclusiones y porcentaje. Desactivar la prioridad MUST ser rollback funcional sin eliminar columnas ni filas.

#### Scenario: backfill de prueba

- GIVEN ofertas dentro de la ventana de 30 días y ejecución `dry-run`
- WHEN se calcula prioridad IA
- THEN MUST informar cambios potenciales sin persistirlos ni alterar evaluación.

#### Scenario: backfill excluye ofertas históricas

- GIVEN ofertas dentro y fuera de la ventana fija de 30 días
- WHEN se ejecuta el backfill en cualquier modo
- THEN MUST procesar solo las recientes y no modificar las históricas.

#### Scenario: política de caché cambia

- GIVEN una evaluación cacheada bajo otra versión de prioridad
- WHEN se consulta con política nueva
- THEN MUST evitar reutilizar una prioridad obsoleta y preservar el resultado de match.

#### Scenario: migración repetible y segura

- GIVEN la migración 018 fue aplicada parcialmente o completa
- WHEN se vuelve a ejecutar en una base de prueba
- THEN MUST finalizar sin pérdida de filas ni comandos destructivos.

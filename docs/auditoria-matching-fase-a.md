# Auditoría independiente de matching — Fase A (#75)

Preparo el método y lo compruebo con ejemplos inventados; **no audité ofertas reales**.
No conecto BD, ejecuto proveedores, reconstruyo historial ni modifico matching.
La Fase B sigue pendiente de autorización explícita. El alcance es preparación y comprobación offline.

## Recorrido y mapa vigente

Primero compruebo integridad; después leo cada oferta sin adoptar su explicación como verdad.
Contrasto evidencia, requisitos obligatorios/deseables, decisión y score; registro dudas antes de concluir.
Este mapa describe código actual inspeccionado, no demuestra qué versión evaluó una fila histórica.
Todas las rutas siguientes son relativas a la raíz; no importo estos módulos desde la auditoría.

| Etapa | Fuente comprobada | Contrato relevante |
| --- | --- | --- |
| Perfil efectivo | `backend/src/servicios/evaluacion/perfil-efectivo.js:13` | Detalle persistido prevalece sobre legacy; `[]` no repuebla habilidades. Roles buscados no acreditan experiencia. Defaults históricos no prueban confirmación humana. |
| Prompts | `backend/src/servicios/evaluacion/entradas-evaluacion.js:27`, `:53` | Perfil, instrucciones y oferta/completitud; criterios privados complementan, no reemplazan hechos. |
| Exclusiones | `backend/src/servicios/evaluacion/reglas-exclusion.js:162`, `:253`, `:337`, `:362`, `:539` | Java contextual, sujeto del seniority, experiencia exigida, idioma y geografía. Híbrido no se excluye determinísticamente por esa defensa. |
| Orquestación | `backend/src/servicios/servicio-evaluacion.js:146`, `:195`, `:278`, `:313` | Defensas antes del hit de caché; consulta solo si corresponde; parser y postvalidación. No toda decisión procede del proveedor. |
| Score y explicación | `backend/src/servicios/evaluacion/parser-respuesta-ia.js:41`, `:104`, `:329`, `:423` | No hay clamp silencioso: rango inválido → null/invalidez; cadenas numéricas se convierten y se redondean. Coherencia con umbral 60 y exclusiones justificadas. |
| Firma/caché | `backend/src/servicios/evaluacion/identidad-evaluacion.js:18`, `:30`, `:46`, `:58`; `backend/src/servicios/servicio-evaluacion.js:174` | Firma mensajes/modelo/configuración/versiones; identidad incluye fuentes crudas. No cachea éxitos inválidos. Hash no reversible ni certificado histórico. |
| Persistencia | `backend/src/servicios/servicio-evaluacion.js:470`, `:557`; `backend/src/modelos/oferta.js:1006`, `:1189` | UPDATE antes de confirmar caché; fallo técnico puede conservar decisión previa y agregar error; sin éxito previo queda pendiente. |
| Ranking IA | `backend/src/servicios/evaluacion/detector-prioridad-ia.js:32` | Prioridad separada, no recalculo ni sumo puntos al match. |
| Exportación | `backend/tests/scripts/exportar-ofertas.js:29`, `:157`, `:193` | Reutilizo `exportarOfertas` sin cambios: snapshot de filas/conteo, 21 campos más 3 marcas de incertidumbre, sin filtros del dashboard. |

Prevalece este código sobre las secciones legacy de [evaluación](evaluacion-ia.md) que todavía hablan de clamp o bonus.
La discrepancia documental no prueba un fallo histórico. Una causa candidata es **hipótesis**, nunca autoría DeepSeek demostrada.
El JSONL omite `datos_crudos`: si una defensa pudo usar evidencia no exportada, registro esa limitación.

## Clasificación manual y evidencia

Asigno una categoría principal; anoto hallazgos secundarios sin contar dos veces la oferta.
Nunca ejecuto las reglas del producto para fabricar una segunda decisión automática.

| Categoría | Criterio de adjudicación |
| --- | --- |
| `decision_correcta` | Decisión respaldada por requisitos y hechos disponibles, sin contradicción relevante; acoto la conclusión a esa evidencia. |
| `posible_falso_positivo` | Aprobación con exclusión obligatoria explícita o incumplimiento sustancial demostrado. |
| `posible_falso_negativo` | Rechazo apoyado solamente en mención opcional/negada, mentor o requisito atribuido sin sustento. |
| `inconsistencia` | Decisión/score/desglose/razón se contradicen o score es inválido; rechazo ≥60 puede ser coherente si hay exclusión obligatoria evidenciada. |
| `error_tecnico` | Fallo de evaluación explícito; no equivale a rechazo laboral ni demuestra causa del proveedor. |
| `informacion_insuficiente` | Texto parcial/ausente, perfil o explicación faltante, condición ambigua: no convierto silencio en incumplimiento. Pendiente sin error no es fallo técnico. |

Registro **otro eje independiente** `historia = verificable | historicamente_no_verificable`, con motivo.
Con estos tres archivos la autoría es `no_persistida`, la vigencia `desconocida` y la fecha puede ser backfill.
Puedo señalar una contradicción textual con confianza alta y mantener historia no verificable.
No deduzco criterios pasados ni hit/miss de caché de firmas, fechas o razones; no hay ledger de decisiones.
Los criterios exportados son actuales e incompletos (`instrucciones_efectivas_completas=false`); no los atribuyo al pasado.

- **Gravedad:** alta si una exclusión fuerte parece aprobada o hay pérdida/corrupción de cobertura; media si rechazo/score/explicación puede perjudicar la revisión; baja si solo falta detalle sin impacto demostrado. No uso gravedad para inventar certeza.
- **Confianza:** alta con citas directas, contexto completo y comparación suficiente; media con indicios claros pero contexto limitado; baja con ambigüedad, omisiones o hechos no confirmados. Explico qué evidencia falta.
- **Lectura contextual:** Java ≠ JavaScript; Senior requerido ≠ mentor senior. `3+`, `>3`, mínimo/al menos 3 o cantidades mayores se interpretan como experiencia excluyente del candidato, no trayectoria empresarial; **3 años sin calificador no excluye automáticamente**, tampoco 5 deseables.
- **Idioma/geografía:** inglés obligatorio incluso genérico ≠ valorado/negado. Remoto no garantiza permiso mundial: verifico residencia requerida; presencial depende de zonas guardadas; ubicación desconocida conserva incertidumbre. Tecnologías opcionales no justifican solas rechazo. Negaciones y contrastes tienen alcance local.

## Matriz reutilizable y lotes exhaustivos

Copio esta fila en un archivo **privado**, una por ID, sin cambiar datos almacenados:

| ID | Decisión almacenada | Porcentaje (valor/tipo) | Requisitos (obligatorio/deseable/desconocido) | Evidencia textual y campo | Reglas aplicables/referencia vigente | Explicación almacenada | Hallazgo principal/secundarios | Gravedad | Confianza y fundamento | Historia y límite | Lote / estado de revisión |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <ID exacto> | <sin reinterpretar> | <sin clamp> | <por completar> | <cita o ausencia> | <por completar> | <texto o null> | <por completar> | <por completar> | <por completar> | <por completar> | <pendiente> |

1. Congelo la entrega privada y registro localmente versión de formato/fecha, tamaños y SHA-256 de los tres archivos. No publico contenido ni perfil.
2. Decodifico **cada archivo con UTF-8 estricto** (bytes inválidos detienen la revisión), parseo cada línea JSONL y los dos JSON; exijo resumen completo, esquema y 24 claves por fila. Null almacenado no es clave omitida; `campos_ausentes` documenta columnas ausentes.
3. Reconcilio total SQL/exportado/líneas, grupos de estado, errores técnicos, solicitudes de reevaluación y vigencia. Después verifico IDs exactos, únicos y cobertura: conteos iguales solos no bastan. Un duplicado más una omisión conserva el total.
4. Ordeno por ID y divido por **posición en la lista**, en lotes de 50 (el ensayo usa 5); nunca por intervalos numéricos ni suponiendo IDs consecutivos. Registro lista exacta de IDs por lote y versión de entrega.
5. Incluyo TODOS los IDs: aprobados, rechazados, pendientes, errores, desconocidos, antiguos y ocultos por dashboard/postulación. Marco cada fila pendiente/revisada; no muestreo ni limito a recientes.
6. Al cerrar, la unión de IDs revisados debe ser idéntica al manifiesto inicial, intersecciones entre lotes vacías y cero filas pendientes. Reconcilio categorías principales con total, historia por separado. Reporto incertidumbre, no una tasa de exactitud sin verdad-terreno validada.

El conjunto exportado define la cobertura offline; sin inventario fuente independiente autorizado no puedo probar que representa toda la BD real.
Si el exportador conserva duplicados o un score inválido, **los señalo**, no afirmo que los rechaza: preserva el estado almacenado.
Si no reconcilia el conteo, no genera resumen completo; nunca uso parciales para conclusiones semánticas.

## Ensayo sintético y reproducción

`backend/tests/fixtures/auditoria-matching-fase-a.js` contiene 19 ejemplos de adjudicación manual, **no resultados del evaluador ni gold truth**.
Cubren Java/JS, senior/mentor, 3/3+/experiencia deseable, inglés obligatorio/valorado/negado, residencia remota/presencial, opcionales, parcial/ausente, explicación contradictoria, score inválido, pendiente/error, Unicode e historia desconocida.
`backend/tests/scripts/auditoria-matching-fase-a.test.js` usa cliente inyectado y `pg.Query` simulado, compara artefactos públicos y preservación de entradas, no importa servidor ni proveedor.
Los archivos transitorios son sintéticos en directorios temporales propios con teardown; las corrupciones se ensayan en memoria.
Reutilizo `obtenerCasos` y las regresiones #69 para sanitización de identidad, prompt, secretos, allowlists, URL, Unicode extenso, permisos y cero filas; no duplico esos casos.

Desde la raíz, con dependencias instaladas normalmente, los comandos focales equivalentes son:

```bash
env -i PATH="$PATH" NODE_ENV=test backend/node_modules/.bin/jest --config '{"rootDir":"./backend","testEnvironment":"node"}' --runInBand --no-cache --runTestsByPath backend/tests/scripts/auditoria-matching-fase-a.test.js
env -i PATH="$PATH" NODE_ENV=test backend/node_modules/.bin/jest --config '{"rootDir":"./backend","testEnvironment":"node"}' --runInBand --no-cache --runTestsByPath backend/tests/scripts/exportar-ofertas.test.js
```

El entorno vacío elimina PG/DATABASE_URL y claves de proveedores; no cargo `.env`. Si faltan dependencias locales, el padre puede usar su Jest absoluto y `NODE_PATH` autorizado, manteniendo `rootDir` en este backend.
La documentación pasiva no tiene RED; el worker observó el helper de integridad local con stub: 10 FAIL/2 PASS y luego 12 PASS. Regresión #69: 70 PASS. Estos pases no prueban matching productivo ni SQL real.

### Resultado de verificación de Fase A

- **PASS:** Gentle AI Verify independiente: 82 pruebas focales (12 nuevas + 70 del exportador), dos probes propios y ausencia de cambios de fuentes durante la ejecución. Su primer probe tuvo un literal esperado mal ordenado; corrigió solo su comprobador temporal y obtuvo 2 PASS, no fue un defecto del candidato.
- **PASS:** seis suites de contratos de matching, 631 pruebas (reglas, explicación con IA simulada, entradas, parser, perfil e identidad).
- **FAIL inicial de entorno, resuelto:** primera ejecución con dependencias compartidas: 85 suites PASS, una FAIL, 11 SKIPPED; 2868 pruebas PASS, 161 SKIPPED. Faltaba `pdf-parse`. Con autorización explícita instalé el lockfile exclusivamente en este worktree con `npm --prefix backend ci --ignore-scripts --no-audit --no-fund`; no cambié dependencias ajenas, manifiesto ni lockfile.
- **PASS final completo:** `npm --prefix backend test -- --runInBand --no-cache --silent`, con `env -i`, PATH, HOME aislado y `NODE_ENV=test`: 86 suites PASS, 11 SKIPPED; **2903 pruebas PASS, 161 SKIPPED, cero fallos**, exit 0.
- **SKIPPED:** suites condicionadas por flags/entornos de integración; no habilité BD reales ni integraciones.
- **NOT RUN:** producción, auditoría semántica real, PostgreSQL real, servicios pagos, build y deploy. No son evidencia pendiente que autorice ejecutarlos en esta fase.
- **PENDING:** auditoría semántica real de Fase B, sin dataset ni autorización. La preparación sintética no la sustituye.

## Fase B: autorización privada pendiente

1. Solicito permiso explícito **para recibir y analizar offline los tres archivos**, alcance de todos los IDs y canal privado acordado, ubicación privada, acceso, retención y eliminación posterior autorizada. No subo datasets, matriz, CV o perfil a GitHub, PR, logs ni artefactos CI.
2. Si todavía no existen, el operador necesita **otra autorización de lectura/exportación**, con destino/rol lector exactos; sigue [el procedimiento existente #69](exportacion-auditoria-matching.md#procedimiento-autorizado-exclusivamente-manual). No ejecuto exportación ni consultas como parte de esta Fase A.
3. El operador revisa localmente la sanitización heurística sin truncar evidencia técnica y entrega únicamente `busco-trabajo-auditoria-matching.jsonl`, `busco-trabajo-criterios-sanitizados.json` y `resumen.json`, con manifiesto privado. No envía credenciales ni prompt/CV completos.
4. Con autorización de recepción/análisis confirmada, verifico integridad y recorro los lotes/matriz anteriores. Ante entrega incompleta/corrupta me detengo y solicito una nueva entrega; no reparo datos silenciosamente. Publico solo método y conclusiones agregadas expresamente aprobadas, nunca citas/IDs privados por defecto.
5. Presento candidatos a hallazgo y límites históricos para revisión humana. Auditar no autoriza reevaluar, resetear, consultar DeepSeek, cambiar reglas, recuperar caché ni escribir en BD; cada acción futura requiere alcance/IDs y autorización propios.

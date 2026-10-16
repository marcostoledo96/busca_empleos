# Funciones históricas de identidad 023/024

## Procedencia e integridad

Extraigo las cuatro definiciones originales del commit completo
`7d504ec17de9051f735bd58ebf3bd28ef713055c` de
`marcostoledo96/busca_empleos`, antes de la reparación conservadora de PR39.
No reconstruyo ni simplifico su comportamiento.

| Archivo en ese commit | Líneas originales, inclusivas | SHA-256 del archivo completo |
| --- | --- | --- |
| `backend/sql/migracion-023-identidad-y-reapariciones.sql` | 17–166, 168–316, 319–461, 463–603 | `fb80e9503c6593138730584f5e34415d02f235647486a16b0174e5f1ffe3fc62` |
| `backend/sql/migracion-024-reparar-identidades-canonicas.sql` | 14–163, 165–313, 316–458, 460–600 | `d35eca20807cc71f3d57385a9470375b36c977952c9a44edde9a9ff5ace2e036` |

Las definiciones de ambas migraciones son **idénticas byte a byte**. Conservo una
sola copia en `identidad-legacy-023-024.sql`, sin duplicar migraciones completas.
Excluyo DDL de tablas/índices, backfills `DO $$`, DML de perfiles y comentarios
externos a las funciones. Mantengo íntegros los comentarios dentro de cada función.

| Función | Bytes, sin separador final | SHA-256 de la definición |
| --- | ---: | --- |
| `fn_url_decode_023` | 6763 | `a1ca2aa19878a600a8fe44ee295811900894d218659e59470d0811544d23e890` |
| `fn_url_encode_form_023` | 6187 | `4e33d736c4f102333b59be3c9e876d86606bba9e9599483f9241868a7cb2170f` |
| `fn_canonizar_url_023` | 6391 | `e951508ff773376beba642e7ed55e1584e3c9f9c5867106aa4774f332e24a155` |
| `fn_obtener_identidad_canonica_023` | 6674 | `c7c2766bb6d2129cf7650f09d926a662474ebb1492282fd073046e2dbeae6ee3` |

El fixture completo tiene 26022 bytes UTF-8, LF, y SHA-256
`f7a2e52e030941951aff72dcc3660e7f43381aff5c9ac59a327ee428f246aa84`.
Jest comprueba este hash incluso cuando las pruebas de BD están deshabilitadas.

## Extracción durante autoría, no durante Jest

Para verificar la procedencia uso `git show SHA:ruta` únicamente durante la autoría.
Sobre los bytes de cada archivo selecciono, en orden, cada coincidencia de la
expresión Python `rb'CREATE OR REPLACE FUNCTION .*?\n\$\$;'` con `re.S`.
Cada bloque comienza en `CREATE OR REPLACE FUNCTION` y termina después del `;`
de su cierre `$$;`, sin incluir el salto posterior. Verifico que hay exactamente
cuatro bloques y que las dos listas son iguales. Construyo los bytes finales con
`b'\n\n'.join(bloques) + b'\n'`; verifico tamaños y hashes anteriores.

Durante la ejecución leo únicamente el fixture versionado con `fs.readFileSync`.
No necesito Git instalado, `.git`, objetos históricos, red ni cambios en checkout/CI.
El hash detecta alteraciones accidentales; la procedencia se contrasta con los
archivos originales durante autoría, no se descarga ni se verifica remotamente en CI.

## Upgrade que pruebo

En PostgreSQL sintético creo un esquema transaccional aislado, sin `public` en
`search_path`. Copio sólo la estructura de `ofertas` con sus dos UNIQUE y agrego
una columna `notas` para representar instalaciones extendidas. Creo el ledger
con SQL 014 y registro 023/024 exitosas; instalo exclusivamente las funciones
históricas del fixture. No ejecuto sus antiguos backfills inseguros.

La preparación está en un hook separado: cualquier fallo informa explícitamente
que falló la preparación histórica. Antes del upgrade verifico la salida legacy
para `?jk=%41BC123`, ambos UNIQUE y el ledger sin 025. Selecciono las migraciones
pendientes según los registros exitosos: debe quedar únicamente 025.

Uso dos filas históricas con IDs nativos y URLs cruzadas, datos crudos
contradictorios, fechas distintas, postulación, descripción manual y notas.
Aplico sólo 025 y registro su éxito en la misma transacción; compruebo que sólo
cambian las URLs según las identidades preservadas, sin fusionar filas ni alterar
las columnas o registros previos. Repito 025 y comparo también `ctid` (además de
`xmin`): dentro de una misma transacción `xmin` solo no detectaría reescrituras.
Finalmente hago rollback de todo el esquema de prueba.

Esta prueba SQL no invoca el runner original ni carga archivos de entorno. Para
la columna extendida `notas`, sin operación específica del modelo, consulto SQL;
los casos existentes del circuito normalización → modelo → reaparición mantienen
las verificaciones a través de las operaciones públicas del modelo. Conservo
además la cobertura existente de instalación nueva 023/024/025.

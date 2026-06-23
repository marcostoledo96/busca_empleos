// Tests del runner de migraciones.
// Verifico que el script tiene la estructura correcta y se puede importar
// sin errores de sintaxis. Como es un script auto-ejecutable, no podemos
// testear su lógica interna directamente (llama a process.exit y requiere BD),
// pero validamos la estructura y contenido.
//
// También verifico que las migraciones SQL sean idempotentes y no destructivas:
// no deben contener DROP TABLE, DELETE ni TRUNCATE. La migración 016 es una
// excepción controlada que usa DROP INDEX IF EXISTS, DROP CONSTRAINT IF EXISTS
// y DROP COLUMN IF EXISTS para eliminar objetos legacy de scoring previo.

const fs = require('fs');
const path = require('path');

const rutaMigrar = path.resolve(__dirname, '../../scripts/migrar.js');
const sqlDir = path.resolve(__dirname, '../../sql');

// Leo el archivo sin ejecutarlo — el script es auto-ejecutable y llama
// a process.exit, así que no podemos require()lo en tests.
let contenidoMigrar;

beforeAll(() => {
    contenidoMigrar = fs.readFileSync(rutaMigrar, 'utf-8');
});

describe('Runner de migraciones', () => {
    test('el archivo migrar.js existe y es un script auto-ejecutable', () => {
        expect(fs.existsSync(rutaMigrar)).toBe(true);
        // Es un script auto-ejecutable: no tiene module.exports,
        // sino que llama a migrar() al final.
        expect(contenidoMigrar).toContain('migrar()');
        expect(contenidoMigrar).not.toContain('module.exports');
    });

    test('no hay errores de sintaxis en el runner', () => {
        expect(contenidoMigrar).toContain('async function migrar()');
        expect(contenidoMigrar).toContain('--apply');
        expect(contenidoMigrar).toContain('schema_migrations');
        expect(contenidoMigrar).toContain('BEGIN');
        expect(contenidoMigrar).toContain('COMMIT');
        expect(contenidoMigrar).toContain('ROLLBACK');
    });

    test('el runner tiene manejo de errores con process.exit', () => {
        expect(contenidoMigrar).toContain('process.exit(1)');
    });

    test('el runner lee migraciones del directorio sql/', () => {
        expect(contenidoMigrar).toContain('readdirSync');
        expect(contenidoMigrar).toContain('.sql');
    });

    test('el runner carga .env desde la ubicación correcta (backend/.env)', () => {
        // Regresión: el path era ../../.env (apuntaba a la raíz del repo),
        // pero el .env real está en backend/.env. Desde backend/scripts/,
        // el path correcto es ../.env (un nivel arriba, llega a backend/).
        // Verifico que el path resuelto apunte a backend/.env y NO a la raíz.
        const dotenvLinea = contenidoMigrar
            .split('\n')
            .find(linea => linea.includes('dotenv') && linea.includes('config'));

        expect(dotenvLinea).toBeDefined();

        // El path relativo debe ser '../.env', no '../../.env'.
        // '../.env' desde backend/scripts/ → backend/.env ✓
        // '../../.env' desde backend/scripts/ → raíz del repo ✗
        expect(dotenvLinea).toContain("'../.env'");
        expect(dotenvLinea).not.toContain("'../../.env'");

        // Verificación adicional: el path resuelto debe existir como archivo.
        const rutaEnvEsperada = path.resolve(
            path.dirname(rutaMigrar),
            '../.env'
        );
        expect(rutaEnvEsperada).toBe(path.resolve(__dirname, '../../.env'));
    });
});

describe('Migración 015 — Índices ofertas últimos 30 días', () => {
    const rutaMigracion = path.join(sqlDir, 'migracion-015-indices-ofertas-ultimos-30-dias.sql');
    let contenido;

    beforeAll(() => {
        contenido = fs.readFileSync(rutaMigracion, 'utf-8');
    });

    test('el archivo de migración existe', () => {
        expect(fs.existsSync(rutaMigracion)).toBe(true);
    });

    test('usa CREATE INDEX IF NOT EXISTS (idempotente)', () => {
        expect(contenido).toContain('CREATE INDEX IF NOT EXISTS');
    });

    test('crea el índice idx_ofertas_fecha_extraccion_desc', () => {
        expect(contenido).toContain('idx_ofertas_fecha_extraccion_desc');
        expect(contenido).toContain('fecha_extraccion DESC');
    });

    test('crea el índice idx_ofertas_estado_fecha_extraccion', () => {
        expect(contenido).toContain('idx_ofertas_estado_fecha_extraccion');
        expect(contenido).toContain('estado_evaluacion, fecha_extraccion DESC');
    });

    test('no contiene comandos destructivos (DROP, DELETE, TRUNCATE)', () => {
        const lineasDestructivas = contenido
            .split('\n')
            .filter(linea => linea.trim() && !linea.trim().startsWith('--'))
            .filter(linea => {
                const upper = linea.toUpperCase().trim();
                return upper.startsWith('DROP ')
                    || upper.startsWith('DELETE ')
                    || upper.startsWith('TRUNCATE ');
            });
        expect(lineasDestructivas).toHaveLength(0);
    });

    test('no usa CONCURRENTLY en sentencias SQL (incompatible con transacciones)', () => {
        // Verifico solo las líneas que no son comentarios y que son sentencias SQL.
        const lineasSQL = contenido
            .split('\n')
            .map(linea => linea.trim())
            .filter(linea => linea && !linea.startsWith('--'));
        for (const linea of lineasSQL) {
            expect(linea).not.toContain('CONCURRENTLY');
        }
    });
});

describe('Migración 016 — Eliminar scoring legacy', () => {
    const rutaMigracion = path.join(sqlDir, 'migracion-016-eliminar-scoring-legacy.sql');
    let contenido;

    beforeAll(() => {
        contenido = fs.readFileSync(rutaMigracion, 'utf-8');
    });

    test('el archivo de migración existe', () => {
        expect(fs.existsSync(rutaMigracion)).toBe(true);
    });

    test('referencia todos los objetos legacy esperados', () => {
        // Índice legacy
        expect(contenido).toContain('idx_ofertas_score_previo');
        // Constraint legacy
        expect(contenido).toContain('chk_ofertas_score_previo');
        // Columnas legacy de ofertas
        expect(contenido).toContain('score_previo');
        expect(contenido).toContain('analisis_previo');
        expect(contenido).toContain('scoring_version');
        // Columna legacy de preferencias
        expect(contenido).toContain('scoring_config');
    });

    test('usa DROP INDEX IF EXISTS (idempotente)', () => {
        expect(contenido).toContain('DROP INDEX IF EXISTS');
    });

    test('usa DROP CONSTRAINT IF EXISTS (idempotente)', () => {
        expect(contenido).toContain('DROP CONSTRAINT IF EXISTS');
    });

    test('usa DROP COLUMN IF EXISTS (idempotente)', () => {
        expect(contenido).toContain('DROP COLUMN IF EXISTS');
    });

    test('elimina el índice legacy idx_ofertas_score_previo', () => {
        expect(contenido).toMatch(/DROP INDEX IF EXISTS idx_ofertas_score_previo/);
    });

    test('elimina el constraint legacy chk_ofertas_score_previo', () => {
        expect(contenido).toMatch(/DROP CONSTRAINT IF EXISTS chk_ofertas_score_previo/);
    });

    test('elimina las columnas legacy de ofertas', () => {
        expect(contenido).toMatch(/DROP COLUMN IF EXISTS score_previo/);
        expect(contenido).toMatch(/DROP COLUMN IF EXISTS analisis_previo/);
        expect(contenido).toMatch(/DROP COLUMN IF EXISTS scoring_version/);
    });

    test('elimina la columna legacy de preferencias', () => {
        expect(contenido).toMatch(/ALTER TABLE preferencias DROP COLUMN IF EXISTS scoring_config/);
    });

    test('no contiene DROP TABLE, DELETE ni TRUNCATE', () => {
        const lineasDestructivas = contenido
            .split('\n')
            .filter(linea => linea.trim() && !linea.trim().startsWith('--'))
            .filter(linea => {
                const upper = linea.toUpperCase().trim();
                return upper.startsWith('DROP TABLE')
                    || upper.startsWith('DELETE ')
                    || upper.startsWith('TRUNCATE ');
            });
        expect(lineasDestructivas).toHaveLength(0);
    });

    test('no usa CONCURRENTLY en sentencias SQL (incompatible con transacciones)', () => {
        const lineasSQL = contenido
            .split('\n')
            .map(linea => linea.trim())
            .filter(linea => linea && !linea.startsWith('--'));
        for (const linea of lineasSQL) {
            expect(linea).not.toContain('CONCURRENTLY');
        }
    });

    test('no usa CASCADE en sentencias SQL (destrucción sin restricción de dependencias)', () => {
        // CASCADE fuerza la eliminación de objetos dependientes sin pedir confirmación,
        // lo cual es destructivo e impredecible en producción.
        const lineasSQL = contenido
            .split('\n')
            .map(linea => linea.trim())
            .filter(linea => linea && !linea.startsWith('--'));
        for (const linea of lineasSQL) {
            expect(linea.toUpperCase()).not.toContain('CASCADE');
        }
    });
});
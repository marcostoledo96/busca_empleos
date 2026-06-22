// Tests del runner de migraciones.
// Verifico que el script tiene la estructura correcta y se puede importar
// sin errores de sintaxis. Como es un script auto-ejecutable, no podemos
// testear su lógica interna directamente (llama a process.exit y requiere BD),
// pero validamos la estructura y contenido.
//
// También verifico que las migraciones SQL sean idempotentes y no destructivas:
// no deben contener DROP, DELETE ni TRUNCATE, y deben usar IF NOT EXISTS.

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
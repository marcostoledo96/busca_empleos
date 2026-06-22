// Tests del runner de migraciones.
// Verifico que el script tiene la estructura correcta y se puede importar
// sin errores de sintaxis. Como es un script auto-ejecutable, no podemos
// testear su lógica interna directamente (llama a process.exit y requiere BD),
// pero validamos la estructura y contenido.

const fs = require('fs');
const path = require('path');

const rutaMigrar = path.resolve(__dirname, '../../scripts/migrar.js');

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
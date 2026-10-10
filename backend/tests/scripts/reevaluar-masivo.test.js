const { spawnSync } = require('node:child_process');
const path = require('node:path');

const rutaScript = path.join(__dirname, 'reevaluar-masivo.js');

// Bloqueo toda dependencia antes de cargar el script: nunca accedo a .env, BD o IA.
describe('Script legacy de reevaluación masiva deshabilitado', () => {
    test.each(['ejecucion', 'importacion'])('%s falla antes de cargar dependencias', (modo) => {
        const resultado = spawnSync(process.execPath, ['-e', `
            const Module = require('node:module');
            const cargar = Module._load;
            const ruta = ${JSON.stringify(rutaScript)};
            Module._load = function (nombre, ...argumentos) {
                if (nombre === ruta) return cargar.call(this, nombre, ...argumentos);
                throw new Error('DEPENDENCIA_BLOQUEADA: ' + nombre);
            };
            if (${JSON.stringify(modo)} === 'ejecucion') {
                process.argv[1] = ruta;
                Module.runMain();
            } else {
                require(ruta);
            }
        `], {
            env: { NODE_ENV: 'test', ALLOW_DB_TESTS: 'false' },
            encoding: 'utf8',
            timeout: 5000,
        });

        expect(resultado.error).toBeUndefined();
        expect(resultado.status).toBe(1);
        expect(resultado.stderr).toContain('Reevaluación masiva legacy deshabilitada');
        expect(resultado.stderr).toContain('dashboard');
        expect(resultado.stderr).toContain('POST /api/evaluacion/ejecutar');
        expect(resultado.stderr).toContain('{"ids":[5,6]}');
        expect(resultado.stderr).not.toContain('DEPENDENCIA_BLOQUEADA');
        expect(resultado.stdout).toBe('');
    });
});

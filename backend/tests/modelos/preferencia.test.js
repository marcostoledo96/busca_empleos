// Tests para el modelo de preferencias.
// Corren contra la base de datos REAL (mismo patrón que oferta.test.js).
//
// La tabla preferencias es de una sola fila (id = 1).
// Estos tests verifican que la lectura y actualización funcionan correctamente.
//
// ⚠️  IMPORTANTE: estos tests hacen TRUNCATE sobre la tabla preferencias.
// Solo corren si ALLOW_DB_TESTS=true está activo. Ver instrucciones en oferta.test.js.

const pool = require('../../src/config/base-datos');
const modeloPreferencia = require('../../src/modelos/preferencia');

// Si no está el flag, todos los tests de este archivo se marcan como 'skipped'.
const contexto = process.env.ALLOW_DB_TESTS === 'true' ? describe : describe.skip;

contexto('Modelo de preferencias — lectura y actualización', () => {
    // Antes de cada test, limpio la tabla y creo la fila por defecto.
    // Uso los mismos valores que la migración-003 para ser consistente.
    beforeEach(async () => {
        await pool.query('TRUNCATE TABLE preferencias RESTART IDENTITY');
        await pool.query(`
            INSERT INTO preferencias (
                id, nombre, nivel_experiencia, perfil_profesional,
                stack_tecnologico, modalidad_aceptada, zonas_preferidas,
                terminos_busqueda, reglas_exclusion, modelo_ia
            ) VALUES (
                1, 'Marcos Ezequiel Toledo', 'junior',
                'Desarrollador de software junior, QA Tester y soporte IT.',
                ARRAY['JavaScript', 'TypeScript', 'Angular'],
                'cualquiera',
                ARRAY['CABA', 'GBA Oeste'],
                ARRAY['tester', 'qa', 'frontend'],
                ARRAY['Java'],
                'deepseek-chat'
            )
        `);
    });

    // Al terminar todos los tests, limpio y cierro el pool.
    afterAll(async () => {
        await pool.query('TRUNCATE TABLE preferencias RESTART IDENTITY');
        await pool.end();
    });

    // === obtenerPreferencias() ===

    describe('obtenerPreferencias()', () => {
        test('debería retornar las preferencias con todos los campos', async () => {
            const prefs = await modeloPreferencia.obtenerPreferencias();

            expect(prefs).not.toBeNull();
            expect(prefs.id).toBe(1);
            expect(prefs.nombre).toBe('Marcos Ezequiel Toledo');
            expect(prefs.nivel_experiencia).toBe('junior');
            expect(prefs.perfil_profesional).toBe('Desarrollador de software junior, QA Tester y soporte IT.');
            expect(prefs.modalidad_aceptada).toBe('cualquiera');
            expect(prefs.modelo_ia).toBe('deepseek-chat');
            expect(prefs.usar_prompt_personalizado).toBe(false);
        });

        test('debería retornar arrays nativos de JavaScript para campos TEXT[]', async () => {
            const prefs = await modeloPreferencia.obtenerPreferencias();

            // El driver pg convierte TEXT[] de PostgreSQL a arrays de JS automáticamente.
            expect(Array.isArray(prefs.stack_tecnologico)).toBe(true);
            expect(prefs.stack_tecnologico).toEqual(['JavaScript', 'TypeScript', 'Angular']);

            expect(Array.isArray(prefs.zonas_preferidas)).toBe(true);
            expect(prefs.zonas_preferidas).toEqual(['CABA', 'GBA Oeste']);

            expect(Array.isArray(prefs.terminos_busqueda)).toBe(true);
            expect(prefs.terminos_busqueda).toEqual(['tester', 'qa', 'frontend']);

            expect(Array.isArray(prefs.reglas_exclusion)).toBe(true);
            expect(prefs.reglas_exclusion).toEqual(['Java']);
        });

        test('debería autocrearse si la tabla está vacía', async () => {
            await pool.query('TRUNCATE TABLE preferencias RESTART IDENTITY');

            const prefs = await modeloPreferencia.obtenerPreferencias();

            expect(prefs).not.toBeNull();
            expect(prefs.id).toBe(1);
            expect(prefs.nombre).toBe('Marcos Ezequiel Toledo');
            expect(prefs.nivel_experiencia).toBe('junior');
        });
    });

    // === actualizarPreferencias() ===

    describe('actualizarPreferencias()', () => {
        test('debería actualizar solo los campos enviados sin tocar los demás', async () => {
            const prefs = await modeloPreferencia.actualizarPreferencias({
                nombre: 'Marcos Toledo',
                nivel_experiencia: 'semi-senior',
            });

            // Los campos que actualicé.
            expect(prefs.nombre).toBe('Marcos Toledo');
            expect(prefs.nivel_experiencia).toBe('semi-senior');

            // Los campos que NO actualicé deben mantener su valor original.
            expect(prefs.perfil_profesional).toBe('Desarrollador de software junior, QA Tester y soporte IT.');
            expect(prefs.stack_tecnologico).toEqual(['JavaScript', 'TypeScript', 'Angular']);
            expect(prefs.modelo_ia).toBe('deepseek-chat');
        });

        test('debería actualizar arrays correctamente', async () => {
            const prefs = await modeloPreferencia.actualizarPreferencias({
                stack_tecnologico: ['React', 'Node.js', 'PostgreSQL'],
                terminos_busqueda: ['react', 'nodejs', 'backend'],
                reglas_exclusion: ['Java', 'Kotlin'],
                zonas_preferidas: ['CABA'],
            });

            expect(prefs.stack_tecnologico).toEqual(['React', 'Node.js', 'PostgreSQL']);
            expect(prefs.terminos_busqueda).toEqual(['react', 'nodejs', 'backend']);
            expect(prefs.reglas_exclusion).toEqual(['Java', 'Kotlin']);
            expect(prefs.zonas_preferidas).toEqual(['CABA']);
        });

        test('debería actualizar el prompt personalizado y su toggle', async () => {
            const promptCustom = 'Evaluá si la oferta requiere Angular o React.';

            const prefs = await modeloPreferencia.actualizarPreferencias({
                prompt_personalizado: promptCustom,
                usar_prompt_personalizado: true,
            });

            expect(prefs.prompt_personalizado).toBe(promptCustom);
            expect(prefs.usar_prompt_personalizado).toBe(true);
        });

        test('debería actualizar fecha_actualizacion automáticamente', async () => {
            const antes = await modeloPreferencia.obtenerPreferencias();

            // Espero un poquito para que el timestamp sea distinto.
            await new Promise((resolve) => setTimeout(resolve, 50));

            const despues = await modeloPreferencia.actualizarPreferencias({
                nombre: 'Nombre actualizado',
            });

            expect(despues.fecha_actualizacion.getTime())
                .toBeGreaterThan(antes.fecha_actualizacion.getTime());
        });

        test('debería ignorar campos no permitidos (como id o fecha_creacion)', async () => {
            const prefs = await modeloPreferencia.actualizarPreferencias({
                id: 999,
                fecha_creacion: '2020-01-01',
                nombre: 'Test seguridad',
            });

            // El id y fecha_creacion no deben cambiar.
            expect(prefs.id).toBe(1);
            expect(prefs.nombre).toBe('Test seguridad');
        });

        test('debería retornar las preferencias actuales si no se envían campos', async () => {
            const prefs = await modeloPreferencia.actualizarPreferencias({});

            // Sin campos para actualizar, retorna lo que hay.
            expect(prefs).not.toBeNull();
            expect(prefs.nombre).toBe('Marcos Ezequiel Toledo');
        });

        test('debería cambiar el modelo de IA correctamente', async () => {
            const prefs = await modeloPreferencia.actualizarPreferencias({
                modelo_ia: 'deepseek-reasoner',
            });

            expect(prefs.modelo_ia).toBe('deepseek-reasoner');
        });
    });
});

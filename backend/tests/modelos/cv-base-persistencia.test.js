const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { asegurarBaseDeDatosDeTest } = require('../helpers/test-db-guard');
jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
const pool = require('../../src/config/base-datos');
const modelo = require('../../src/modelos/cv-base');

const permitido = process.env.ALLOW_DB_TESTS === 'true'
    && process.env.NODE_ENV === 'test'
    && (process.env.PGDATABASE || '').endsWith('_test')
    && ['localhost', '127.0.0.1', '/var/run/postgresql'].includes(process.env.PGHOST);

(permitido ? describe : describe.skip)('CV base — persistencia aislada', () => {
    let cliente;
    beforeAll(async () => {
        // No cargo dotenv ni DATABASE_URL: uso únicamente el destino local de CI.
        cliente = new Client({ host: process.env.PGHOST, port: process.env.PGPORT,
            user: process.env.PGUSER, password: process.env.PGPASSWORD,
            database: process.env.PGDATABASE, ssl: false });
        await cliente.connect();
        await asegurarBaseDeDatosDeTest(cliente);
        await cliente.query('BEGIN');
        await cliente.query('CREATE TEMP TABLE aislamiento_cv_base (id INTEGER)');
        await cliente.query('SET LOCAL search_path TO pg_temp');
        pool.query.mockImplementation((...args) => cliente.query(...args));
    });
    afterAll(async () => {
        if (cliente) {
            await cliente.query('ROLLBACK');
            await cliente.end();
        }
    });
    test('migro dos veces, preservo preferencias y contenido y recupero fecha de BD', async () => {
        await cliente.query('CREATE TABLE preferencias (id INTEGER, perfil TEXT)');
        await cliente.query("INSERT INTO preferencias VALUES (1, 'Perfil sintético confirmado')");
        const migracion = fs.readFileSync(path.resolve(__dirname, '../../sql/migracion-020-cv-base.sql'), 'utf8');
        await cliente.query(migracion);
        expect(await modelo.obtenerCvBase()).toEqual({ cv_base: null, cv_base_actualizado_en: null });
        const texto = '# Sintético\r\n  ñ 😀\t\n';
        const guardado = await modelo.guardarCvBase(texto);
        expect(guardado.cv_base).toBe(texto);
        expect(guardado.cv_base_actualizado_en).toBeInstanceOf(Date);
        await cliente.query(migracion);
        expect(await modelo.obtenerCvBase()).toEqual(guardado);
        expect((await cliente.query('SELECT * FROM preferencias')).rows).toEqual([{ id: 1, perfil: 'Perfil sintético confirmado' }]);
        const vacio = await modelo.guardarCvBase('');
        expect(await modelo.obtenerCvBase()).toEqual(vacio);
        expect(vacio.cv_base).toBe('');
        expect(vacio.cv_base_actualizado_en.getTime()).toBeGreaterThanOrEqual(guardado.cv_base_actualizado_en.getTime());
    });
});

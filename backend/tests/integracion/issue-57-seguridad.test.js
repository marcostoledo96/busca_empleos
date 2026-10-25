const { validarEntorno } = require('../helpers/issue-57-entorno');

const entorno = {
    NODE_ENV: 'test', DB_TEST_SINTETICA: 'true', PGHOST: '127.0.0.1', PGPORT: '55457',
    PGDATABASE: 'busca_empleos_issue57_test', PGUSER: 'busca_empleos_test',
    PGPASSWORD: 'sintetica_issue57', PGSSLMODE: 'disable',
};

describe('Issue #57 — cierro el acceso antes de cualquier escritura', () => {
    test('acepto exclusivamente la conexión sintética autorizada', () => {
        expect(() => validarEntorno(entorno)).not.toThrow();
    });
    test.each([
        ['NODE_ENV', 'production'], ['DB_TEST_SINTETICA', 'false'], ['PGHOST', 'remoto.invalid'],
        ['PGPORT', '5432'], ['PGDATABASE', 'busca_empleos'], ['PGUSER', 'otro'],
        ['PGPASSWORD', 'otra'], ['PGSSLMODE', 'require'], ['DATABASE_URL', 'postgres://prohibida.invalid'],
        ['PGSERVICE', 'servicio'], ['PGSERVICEFILE', '/prohibido'], ['PGOPTIONS', '-c search_path=public'],
        ['APIFY_TOKEN', 'credencial-no-sintetica'], ['SMTP_PASS', 'prohibida'],
        ['FIREBASE_SERVICE_ACCOUNT_JSON', '{"project_id":"proyecto-ficticio"}'],
        ['FIREBASE_SERVICE_ACCOUNT_PATH', '/ficticio/cuenta-inexistente.json'],
    ])('rechazo %s sin modificar las variables heredadas', (clave, valor) => {
        const candidato = { ...entorno, [clave]: valor };
        const antes = { ...candidato };
        expect(() => validarEntorno(candidato)).toThrow('Entorno issue57 no permitido.');
        expect(candidato).toEqual(antes);
    });
});

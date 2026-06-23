// Guardián de seguridad para tests destructivos contra la base de datos.
// Verifica en TIEMPO DE EJECUCIÓN que la conexión activa del pool apunte
// a una base de datos cuyo nombre termine en "_test".
//
// ¿Por qué? Porque las variables de entorno (PGDATABASE, NODE_ENV) pueden
// mentir: si DATABASE_URL está configurada y apunta a la BD de producción,
// el pool se conecta a producción sin importar lo que diga PGDATABASE.
// Este guardián consulta `SELECT current_database()` ANTES de cada TRUNCATE
// y lanza un error descriptivo si el nombre de la BD no termina en "_test".
//
// Uso:
//   const { asegurarBaseDeDatosDeTest } = require('../helpers/test-db-guard');
//   await asegurarBaseDeDatosDeTest(pool);

/**
 * Verifica que la conexión activa del pool apunte a una base de datos
// cuyo nombre termine en "_test". Lanza un error si no es así.
 *
 * @param {import('pg').Pool} pool - Pool de conexiones a PostgreSQL.
 * @returns {Promise<string>} El nombre de la base de datos verificada.
 * @throws {Error} Si la base de datos no termina en "_test".
 */
async function asegurarBaseDeDatosDeTest(pool) {
    const resultado = await pool.query('SELECT current_database() AS db');
    const nombreBaseDeDatos = resultado.rows[0].db;

    if (!nombreBaseDeDatos.endsWith('_test')) {
        throw new Error(
            `Tests destructivos bloqueados: la base de datos activa es "${nombreBaseDeDatos}", ` +
            `que no termina en "_test". ` +
            `Esto significa que los tests están conectados a una base de datos que NO es de test, ` +
            `y ejecutar TRUNCATE destruiría datos reales. ` +
            `Para permitir los tests, asegurate de que PGDATABASE o DATABASE_URL ` +
            `apunten a una base de datos cuyo nombre termine en "_test" ` +
            `(por ejemplo: "busca_empleos_test"). ` +
            `Si usás DATABASE_URL, verificá que el nombre de la BD en la URL termine en "_test".`
        );
    }

    return nombreBaseDeDatos;
}

module.exports = { asegurarBaseDeDatosDeTest };
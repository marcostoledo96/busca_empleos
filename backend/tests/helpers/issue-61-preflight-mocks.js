const { EventEmitter } = require('events');
function crearPoolSimulado(contratos) {
    const consulta = jest.fn(async sql => {
        if (sql.includes('current_schema()')) return { rows: [{ esquema: 'public', solo_lectura: 'on' }] };
        if (sql.includes('pg_catalog.pg_class')) return { rows: Object.entries(contratos).flatMap(([tabla, columnas]) =>
            columnas.map(columna => ({ tabla, columna, relkind: 'r', tipo: columna === 'exitoso' ? 'boolean' : 'text' }))) };
        if (sql.includes('bool_and')) return { rows: [] };
        return { rows: [] };
    });
    const cliente = Object.assign(new EventEmitter(), { query: consulta, release: jest.fn() });
    const pool = { connect: jest.fn(async () => cliente), end: jest.fn(async () => {}), on: jest.fn() };
    return { cliente, pool };
}
module.exports = { crearPoolSimulado };

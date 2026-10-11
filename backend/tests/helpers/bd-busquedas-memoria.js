// Simulo solamente las consultas de este recorrido; rechazo SQL no contemplado.
function crearAdaptadorBusqueda() {
    let preferencias = { id: 1, terminos_busqueda: ['anterior'], zonas_preferidas: [] };
    const ofertas = [];
    return {
        ofertas,
        obtenerPreferencias: () => preferencias,
        query: jest.fn(async (sql, valores = []) => {
            if (/SELECT \* FROM preferencias/.test(sql)) return { rows: [{ ...preferencias }] };
            if (/UPDATE preferencias SET backup_preferencias/.test(sql)) return { rows: [] };
            if (/UPDATE preferencias\s+SET/.test(sql)) {
                for (const coincidencia of sql.matchAll(/(terminos_busqueda|zonas_preferidas) = \$(\d+)/g)) {
                    preferencias[coincidencia[1]] = valores[Number(coincidencia[2]) - 1];
                }
                return { rows: [{ ...preferencias }] };
            }
            if (/INSERT INTO ofertas/.test(sql)) {
                if (ofertas.some(oferta => oferta.url === valores[5])) return { rows: [] };
                const campos = ['titulo', 'empresa', 'ubicacion', 'modalidad', 'descripcion', 'url', 'plataforma', 'nivel_requerido', 'salario_min', 'salario_max', 'moneda', 'fecha_publicacion', 'datos_crudos'];
                const oferta = Object.fromEntries(campos.map((campo, indice) => [campo, valores[indice]]));
                Object.assign(oferta, { id: ofertas.length + 1, fecha_extraccion: new Date().toISOString(), estado_evaluacion: 'pendiente' });
                ofertas.push(oferta);
                return { rows: [oferta] };
            }
            if (/SELECT COUNT\(\*\)::integer AS total FROM ofertas/.test(sql)) return { rows: [{ total: ofertas.length }] };
            if (/SELECT \* FROM ofertas/.test(sql)) return { rows: [...ofertas] };
            throw new Error(`Consulta no contemplada en el adaptador: ${sql}`);
        }),
    };
}
module.exports = { crearAdaptadorBusqueda };

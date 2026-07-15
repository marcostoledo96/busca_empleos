const MS_DIA = 24 * 60 * 60 * 1000;

function crearOfertaGetonbrd({ id, url, publicadaHaceDias = 1, titulo = 'Desarrollador frontend junior' } = {}) {
    return {
        id: id || 'oferta-fixture',
        attributes: {
            title: titulo,
            description: 'Oferta de prueba para el piloto seguro.',
            remote_modality: 'fully_remote',
            countries: ['AR'],
            published_at: Math.floor((Date.now() - publicadaHaceDias * MS_DIA) / 1000),
        },
        relationships: { seniority: { data: { id: 2 } } },
        links: { public_url: url || `https://fixture.getonbrd.test/jobs/${id || 'oferta-fixture'}` },
    };
}

function crearRespuestaGetonbrd(data, totalPages = 1) {
    return {
        ok: true,
        status: 200,
        json: async () => ({ data, meta: { total_pages: totalPages } }),
    };
}

const PAGINAS_GETONBRD = {
    paginaConDuplicadaYVencida: crearRespuestaGetonbrd([
        crearOfertaGetonbrd({ id: 'reciente', url: 'https://fixture.getonbrd.test/jobs/reciente/' }),
        crearOfertaGetonbrd({ id: 'duplicada', url: 'https://fixture.getonbrd.test/jobs/reciente#detalle' }),
        crearOfertaGetonbrd({ id: 'vencida', publicadaHaceDias: 31 }),
        { id: 'invalida', attributes: {} },
    ], 2),
    paginaVacia: crearRespuestaGetonbrd([], 2),
    errorHttp: { ok: false, status: 503, json: async () => ({}) },
    timeout: (_url, { signal }) => new Promise((_, rechazar) => {
        signal.addEventListener('abort', () => rechazar(new Error('Timeout de fixture')), { once: true });
    }),
};

module.exports = { crearOfertaGetonbrd, crearRespuestaGetonbrd, PAGINAS_GETONBRD };

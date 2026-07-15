const { ejecutarScrapingGetonbrd } = require('../../src/servicios/servicio-scraping');
const { DESTINO_SANDBOX, DESTINO_PRODUCCION } = require('../../src/config/getonbrd');
const { PAGINAS_GETONBRD, crearRespuestaGetonbrd, crearOfertaGetonbrd } = require('../fixtures/getonbrd/paginas');

describe('Piloto seguro de GetOnBrd', () => {
    test('bloquea producción antes de invocar al cliente', async () => {
        const cliente = jest.fn();
        const resultado = await ejecutarScrapingGetonbrd({ destino: DESTINO_PRODUCCION, cliente });

        expect(resultado).toMatchObject({ estado: 'bloqueado', motivo_terminacion: 'politica_destino' });
        expect(cliente).not.toHaveBeenCalled();
    });

    test('normaliza, deduplica por URL canónica y filtra la ventana de 30 días', async () => {
        const cliente = jest.fn()
            .mockResolvedValueOnce(PAGINAS_GETONBRD.paginaConDuplicadaYVencida)
            .mockResolvedValueOnce(PAGINAS_GETONBRD.paginaVacia);

        const resultado = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente,
            terminos: ['qa'],
            ahora: new Date(),
        });

        expect(resultado.run_id).toEqual(expect.any(String));
        expect(resultado.ofertas).toHaveLength(1);
        expect(resultado.ofertas[0].url).toBe('https://fixture.getonbrd.test/jobs/reciente');
        expect(resultado.metricas).toMatchObject({ dentro_ventana: 1, fuera_ventana: 1, duplicadas_intra_run: 1, invalidas: 1 });
        expect(resultado.motivo_terminacion).toBe('pagina_vacia');
        expect(resultado.checkpoint).toMatchObject({ pagina_confirmada: 2, pagina_siguiente: 3 });
    });

    test('continúa con el término siguiente cuando una página está vacía', async () => {
        const cliente = jest.fn()
            .mockResolvedValueOnce(PAGINAS_GETONBRD.paginaVacia)
            .mockResolvedValueOnce(crearRespuestaGetonbrd([crearOfertaGetonbrd({ id: 'segunda' })], 1));

        const resultado = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente,
            terminos: ['sin-resultados', 'qa'],
        });

        expect(cliente).toHaveBeenCalledTimes(2);
        expect(resultado.ofertas).toHaveLength(1);
        expect(resultado).toMatchObject({
            estado: 'completado',
            motivo_terminacion: 'paginas_agotadas',
            metricas: { requests: 2, paginas: 2, recibidas: 1, normalizadas: 1, dentro_ventana: 1 },
            checkpoint: { termino_indice: 1, termino: 'qa', pagina_confirmada: 1, pagina_siguiente: 2 },
        });
    });

    test('conserva el último checkpoint ante cancelación, timeout y error HTTP', async () => {
        const cancelador = new AbortController();
        const checkpoints = [];
        const cliente = jest.fn()
            .mockImplementationOnce(async () => {
                cancelador.abort();
                return crearRespuestaGetonbrd([crearOfertaGetonbrd({ id: 'primera' })], 2);
            });

        const cancelado = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente,
            signal: cancelador.signal,
            terminos: ['qa'],
            alConfirmarCheckpoint: checkpoint => checkpoints.push(checkpoint),
        });
        const http = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente: jest.fn().mockResolvedValue(PAGINAS_GETONBRD.errorHttp),
            terminos: ['qa'],
        });
        const timeout = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente: PAGINAS_GETONBRD.timeout,
            terminos: ['qa'],
            timeoutMs: 1,
        });

        expect(cancelado).toMatchObject({ estado: 'cancelado', motivo_terminacion: 'cancelacion', checkpoint: { pagina_confirmada: 0 } });
        expect(checkpoints).toHaveLength(0);
        expect(http).toMatchObject({ estado: 'parcial', motivo_terminacion: 'error_http', checkpoint: { pagina_confirmada: 0 } });
        expect(timeout).toMatchObject({ estado: 'parcial', motivo_terminacion: 'timeout', checkpoint: { pagina_confirmada: 0 } });
    });

    test('respeta los techos de páginas e ítems y reanuda desde el checkpoint confirmado', async () => {
        const pagina = crearRespuestaGetonbrd([crearOfertaGetonbrd({ id: 'a' })], 99);
        const resultado = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente: jest.fn().mockResolvedValue(pagina),
            terminos: ['qa'],
            limitePaginas: 1,
            checkpointInicial: { termino_indice: 0, termino: 'qa', pagina_confirmada: 4, pagina_siguiente: 5 },
        });

        expect(resultado.motivo_terminacion).toBe('limite_paginas');
        expect(resultado.checkpoint).toMatchObject({ pagina_confirmada: 5, pagina_siguiente: 6 });
    });

    test('reanuda una página de 120 ítems desde el offset exacto sin saltos ni duplicados', async () => {
        const items = Array.from({ length: 120 }, (_, indice) => crearOfertaGetonbrd({ id: `oferta-${indice}` }));
        const pagina = crearRespuestaGetonbrd(items, 1);
        const primeraCorrida = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente: jest.fn().mockResolvedValue(pagina),
            terminos: ['qa'],
            maxResultados: 1,
        });
        const segundaCorrida = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente: jest.fn().mockResolvedValue(pagina),
            terminos: ['qa'],
            maxResultados: 120,
            checkpointInicial: primeraCorrida.checkpoint,
        });
        const urls = [...primeraCorrida.ofertas, ...segundaCorrida.ofertas].map(oferta => oferta.url);

        expect(primeraCorrida.checkpoint).toMatchObject({ pagina_confirmada: 0, pagina_siguiente: 1, item_offset: 1 });
        expect(segundaCorrida.checkpoint).toMatchObject({ pagina_confirmada: 1, pagina_siguiente: 2, item_offset: 0 });
        expect(urls).toHaveLength(120);
        expect(new Set(urls).size).toBe(120);
    });

    test('aplica limitePaginas como techo global entre términos', async () => {
        const cliente = jest.fn().mockResolvedValue(crearRespuestaGetonbrd([], 2));

        const resultado = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente,
            terminos: ['qa', 'frontend'],
            limitePaginas: 1,
        });

        expect(cliente).toHaveBeenCalledTimes(1);
        expect(resultado.motivo_terminacion).toBe('limite_paginas');
    });

    test('mantiene timeout durante respuesta.json y conserva el checkpoint', async () => {
        const respuesta = {
            ok: true,
            json: jest.fn(() => new Promise(() => {})),
        };

        const resultado = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente: jest.fn().mockResolvedValue(respuesta),
            terminos: ['qa'],
            timeoutMs: 1,
        });

        expect(resultado).toMatchObject({
            estado: 'parcial',
            motivo_terminacion: 'timeout',
            checkpoint: { pagina_confirmada: 0, pagina_siguiente: 1, item_offset: 0 },
        });
    });

    test('una oferta vencida no bloquea otra vigente con la misma URL', async () => {
        const url = 'https://fixture.getonbrd.test/jobs/repetida';
        const vencida = crearOfertaGetonbrd({ id: 'vencida', url, publicadaHaceDias: 31 });
        const vigente = crearOfertaGetonbrd({ id: 'vigente', url, publicadaHaceDias: 1 });

        const resultado = await ejecutarScrapingGetonbrd({
            destino: DESTINO_SANDBOX,
            cliente: jest.fn().mockResolvedValue(crearRespuestaGetonbrd([vencida, vigente], 1)),
            terminos: ['qa'],
        });

        expect(resultado.ofertas).toHaveLength(1);
        expect(resultado.ofertas[0].url).toBe(url);
        expect(resultado.metricas).toMatchObject({ fuera_ventana: 1, dentro_ventana: 1, duplicadas_intra_run: 0 });
    });
});

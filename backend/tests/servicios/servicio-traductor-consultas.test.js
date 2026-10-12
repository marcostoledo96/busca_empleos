const {
    sanitizarTermino,
    esTerminoUtilizable,
    obtenerEquivalencias,
    obtenerEquivalenciasSugeridas,
    contieneToken,
    traducirParaLinkedin,
    traducirParaBumeran,
    traducirParaIndeed,
    traducirParaJooble,
    traducirParaAdzuna,
    traducirParaComputrabajo,
    traducirParaRemotive,
    traducirParaRemoteOK,
} = require('../../src/servicios/servicio-traductor-consultas');

describe('Servicio traductor de consultas laborales', () => {
    describe('Preservación de siglas y términos técnicos', () => {
        test('QA no desaparece y es utilizable', () => {
            expect(esTerminoUtilizable('QA')).toBe(true);
            expect(sanitizarTermino('  QA  ')).toBe('QA');
        });

        test('IT conserva su significado', () => {
            expect(esTerminoUtilizable('IT')).toBe(true);
            expect(esTerminoUtilizable('soporte IT')).toBe(true);
        });

        test('C# preserva su símbolo # y es utilizable', () => {
            expect(esTerminoUtilizable('C#')).toBe(true);
            expect(sanitizarTermino('C#')).toBe('C#');
        });

        test('.NET preserva su punto', () => {
            expect(esTerminoUtilizable('.NET')).toBe(true);
            expect(sanitizarTermino('.NET')).toBe('.NET');
        });

        test('frases completas como soporte IT y full stack node no se fragmentan', () => {
            expect(sanitizarTermino('  soporte   IT  ')).toBe('soporte IT');
            expect(sanitizarTermino('full stack node')).toBe('full stack node');
        });

        test('términos solo con signos destructivos no son utilizables', () => {
            expect(esTerminoUtilizable('###')).toBe(false);
            expect(esTerminoUtilizable('???')).toBe(false);
            expect(esTerminoUtilizable('')).toBe(false);
        });
    });

    describe('Equivalencias pequeñas y acotadas', () => {
        test('equivalencias de QA manual, soporte IT, Angular, C# y .NET', () => {
            expect(obtenerEquivalencias('qa manual')).toContain('tester manual');
            expect(obtenerEquivalencias('soporte it')).toEqual(expect.arrayContaining(['mesa de ayuda', 'help desk']));
            expect(obtenerEquivalencias('frontend angular')).toContain('desarrollador angular');
            expect(obtenerEquivalencias('angular')).toContain('frontend angular');
            expect(obtenerEquivalencias('c#')).toEqual(expect.arrayContaining(['c sharp', '.net']));
            expect(obtenerEquivalencias('.net')).toEqual(expect.arrayContaining(['c#', 'c sharp']));
        });

        test('contieneToken detecta tokens con caracteres especiales como # y .', () => {
            expect(contieneToken('c#', 'c#')).toBe(true);
            expect(contieneToken('desarrollador c# junior', 'c#')).toBe(true);
            expect(contieneToken('lenguaje c', 'c#')).toBe(false);
            expect(contieneToken('.net', '.net')).toBe(true);
            expect(contieneToken('backend .net core', '.net')).toBe(true);
            expect(contieneToken('internet', '.net')).toBe(false);
        });

        test('obtenerEquivalenciasSugeridas retorna sugerencias solo para términos reconocidos', () => {
            const sugerencias = obtenerEquivalenciasSugeridas(['C#', 'QA manual', 'desconocido']);
            expect(sugerencias['C#']).toEqual(expect.arrayContaining(['c sharp', '.net']));
            expect(sugerencias['QA manual']).toEqual(['tester manual']);
            expect(sugerencias['desconocido']).toBeUndefined();
        });

        test('no inventa equivalencias para términos sin mapeo explícito', () => {
            expect(obtenerEquivalencias('secretario médico')).toEqual([]);
            expect(obtenerEquivalencias('random tech')).toEqual([]);
        });
    });

    describe('Traducción para Bumeran', () => {
        test('genera URLs válidas para QA, IT y C# sin truncar por hash', () => {
            const { urls, consultas, equivalencias } = traducirParaBumeran(['QA', 'IT', 'C#']);
            expect(urls).toHaveLength(3);
            expect(urls).toContain('https://www.bumeran.com.ar/empleos-busqueda-qa.html');
            expect(urls).toContain('https://www.bumeran.com.ar/empleos-busqueda-it.html');
            expect(urls).toContain('https://www.bumeran.com.ar/empleos-busqueda-c-sharp.html');
            expect(equivalencias['C#']).toBe('c-sharp');
            expect(consultas).toContain('c-sharp');
        });

        test('preserva frases con guiones en Bumeran', () => {
            const { urls } = traducirParaBumeran(['soporte IT', 'mesa de ayuda', 'full stack node']);
            expect(urls).toContain('https://www.bumeran.com.ar/empleos-busqueda-soporte-it.html');
            expect(urls).toContain('https://www.bumeran.com.ar/empleos-busqueda-mesa-de-ayuda.html');
            expect(urls).toContain('https://www.bumeran.com.ar/empleos-busqueda-full-stack-node.html');
        });

        test('descarta términos puramente inválidos como ###', () => {
            const { urls } = traducirParaBumeran(['###']);
            expect(urls).toHaveLength(0);
        });
    });

    describe('Traducción para Indeed', () => {
        test('preserva frases completas con comillas y siglas sin comillas unidas por OR', () => {
            const { query, terminosProcesados } = traducirParaIndeed(['QA', 'soporte IT', 'C#']);
            expect(terminosProcesados).toEqual(['QA', '"soporte IT"', 'C#']);
            expect(query).toBe('QA OR "soporte IT" OR C#');
        });

        test('no divide full stack node en full y stack independientes', () => {
            const { query } = traducirParaIndeed(['full stack node']);
            expect(query).toBe('"full stack node"');
            expect(query).not.toContain('full OR stack');
        });
    });

    describe('Traducción para Jooble y Adzuna', () => {
        test('Jooble conserva frases íntegras', () => {
            const { consultas } = traducirParaJooble(['soporte IT', 'QA manual', 'C#']);
            expect(consultas).toEqual(['soporte IT', 'QA manual', 'C#']);
        });

        test('Adzuna preserva frases con comillas en what', () => {
            const { consultas } = traducirParaAdzuna(['soporte IT', 'QA', 'C#']);
            expect(consultas).toEqual(['"soporte IT"', 'QA', 'C#']);
        });
    });

    describe('Traducción para Remotive', () => {
        test('mapea QA a categoría qa', () => {
            const { categorias, compatible } = traducirParaRemotive(['QA', 'QA tester']);
            expect(categorias).toContain('qa');
            expect(compatible).toBe(true);
        });

        test('mapea soporte IT a customer-service', () => {
            const { categorias, compatible } = traducirParaRemotive(['soporte IT', 'help desk']);
            expect(categorias).toContain('customer-service');
            expect(compatible).toBe(true);
        });

        test('mapea desarrollo a software-dev', () => {
            const { categorias, compatible } = traducirParaRemotive(['frontend angular', 'C#']);
            expect(categorias).toContain('software-dev');
            expect(compatible).toBe(true);
        });

        test('mapea C#, .NET y full stack aislados a software-dev sin considerarlos incompatibles', () => {
            const resCSharp = traducirParaRemotive(['C#']);
            expect(resCSharp.compatible).toBe(true);
            expect(resCSharp.categorias).toEqual(['software-dev']);

            const resDotNet = traducirParaRemotive(['.NET']);
            expect(resDotNet.compatible).toBe(true);
            expect(resDotNet.categorias).toEqual(['software-dev']);

            const resFullStack = traducirParaRemotive(['full stack']);
            expect(resFullStack.compatible).toBe(true);
            expect(resFullStack.categorias).toEqual(['software-dev']);
        });

        test('informa limitación cuando no hay categoría compatible', () => {
            const { compatible, advertencias } = traducirParaRemotive(['secretario médico']);
            expect(compatible).toBe(false);
            expect(advertencias[0]).toMatch(/no dispone de categoría/i);
        });
    });

    describe('Traducción para RemoteOK', () => {
        test('mapea términos a tags válidos de RemoteOK', () => {
            const { tags, compatible } = traducirParaRemoteOK(['QA', 'soporte IT', 'C#', 'Angular']);
            expect(tags).toContain('qa');
            expect(tags).toContain('support');
            expect(tags).toContain('csharp');
            expect(tags).toContain('angular');
            expect(compatible).toBe(true);
        });

        test('mapea full stack, full stack node, C# y .NET a sus respectivos tags', () => {
            const resFullStack = traducirParaRemoteOK(['full stack']);
            expect(resFullStack.compatible).toBe(true);
            expect(resFullStack.tags).toContain('fullstack');

            const resFullStackNode = traducirParaRemoteOK(['full stack node']);
            expect(resFullStackNode.compatible).toBe(true);
            expect(resFullStackNode.tags).toContain('fullstack');
            expect(resFullStackNode.tags).toContain('node');

            const resCSharp = traducirParaRemoteOK(['C#']);
            expect(resCSharp.compatible).toBe(true);
            expect(resCSharp.tags).toContain('csharp');

            const resDotNet = traducirParaRemoteOK(['.NET']);
            expect(resDotNet.compatible).toBe(true);
            expect(resDotNet.tags).toEqual(expect.arrayContaining(['net', 'dotnet']));
        });

        test('informa limitación cuando un término no tiene tag compatible', () => {
            const { compatible, advertencias } = traducirParaRemoteOK(['secretario médico']);
            expect(compatible).toBe(false);
            expect(advertencias[0]).toMatch(/no dispone de etiquetas/i);
        });
    });

    describe('Equivalencias aplicadas vs no aplicadas', () => {
        test('LinkedIn, Indeed, Jooble y Adzuna no mutan términos y reportan equivalencias vacías', () => {
            expect(traducirParaLinkedin(['QA manual']).equivalencias).toEqual({});
            expect(traducirParaIndeed(['QA manual']).equivalencias).toEqual({});
            expect(traducirParaJooble(['QA manual']).equivalencias).toEqual({});
            expect(traducirParaAdzuna(['QA manual']).equivalencias).toEqual({});
        });

        test('Bumeran y Computrabajo reportan equivalencias aplicadas solo cuando transforman C# a c-sharp', () => {
            const resBumeran = traducirParaBumeran(['C#']);
            expect(resBumeran.equivalencias['C#']).toBe('c-sharp');

            const resComputrabajo = traducirParaComputrabajo(['C#']);
            expect(resComputrabajo.equivalencias['C#']).toBe('c-sharp');

            const resComputrabajoSinMutacion = traducirParaComputrabajo(['QA']);
            expect(resComputrabajoSinMutacion.equivalencias).toEqual({});
        });
    });
});

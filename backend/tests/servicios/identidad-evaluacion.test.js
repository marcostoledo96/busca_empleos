jest.mock('dotenv', () => ({ config: jest.fn() }));
const identidad = require('../../src/servicios/evaluacion/identidad-evaluacion');
const entradas = require('../../src/servicios/evaluacion/entradas-evaluacion');
const proveedor = require('../../src/config/deepseek');
const prefs = { nombre: 'Perfil sintético', stack_tecnologico: ['TypeScript'], modelo_ia: 'deepseek-v4-flash' };
const oferta = { titulo: 'Desarrollo junior', descripcion: 'TypeScript' };

test('ordeno objetos recursivamente sin ordenar arrays ni perder null, cero o vacíos', () => {
    expect(identidad.serializarCanonico({ z: 0, a: { y: null, b: [] } })).toBe('{"a":{"b":[],"y":null},"z":0}');
    expect(identidad.crearHash({ a: ['X', 'Y'] })).not.toBe(identidad.crearHash({ a: ['Y', 'X'] }));
});

test('la firma usa instrucciones finales reales y configuración efectiva sin secretos', () => {
    const actual = identidad.construirIdentidadEvaluacion(oferta, prefs);
    expect(actual.criterios.mensaje_sistema).toBe(entradas.construirInstruccionesDesdePreferencias(prefs));
    expect(actual.criterios.proveedor).toEqual(proveedor.CONFIGURACION_DECISION);
    expect(actual.criterios.modelo).toBe('deepseek-flash');
    expect(actual.oferta.mensaje_usuario).toBe(entradas.construirPromptEvaluacion(oferta));
    expect(JSON.stringify(actual)).not.toMatch(/API_KEY|Authorization|Bearer/);
});

test('alias y modelo canónico comparten firma, Pro no y temperatura inerte no afecta', () => {
    const firma = identidad.crearFirmaCriterios(prefs);
    expect(identidad.crearFirmaCriterios({ ...prefs, modelo_ia: 'deepseek-flash' })).toBe(firma);
    expect(identidad.crearFirmaCriterios({ ...prefs, modelo_ia: 'deepseek-v4-pro' })).not.toBe(firma);
    expect(identidad.crearFirmaCriterios({ ...prefs, temperatura_evaluacion: 0.9 })).toBe(firma);
    expect(actualesSinOperativos()).not.toMatch(/timeout|usage|duracion|API_KEY/);
    function actualesSinOperativos() { return JSON.stringify(identidad.construirCriteriosEvaluacion(prefs)); }
});

test.each([
    { thinking: { type: 'disabled' } }, { reasoning_effort: 'high' },
    { max_tokens: 8192 }, { response_format: { type: 'text' } },
])('configuración efectiva distinta genera firma distinta: %j', cambio => {
    let firmaNueva;
    jest.isolateModules(() => {
        jest.doMock('../../src/config/deepseek', () => ({ ...proveedor,
            CONFIGURACION_DECISION: { ...proveedor.CONFIGURACION_DECISION, ...cambio },
        }));
        firmaNueva = require('../../src/servicios/evaluacion/identidad-evaluacion').crearFirmaCriterios(prefs);
    });
    jest.dontMock('../../src/config/deepseek');
    expect(firmaNueva).not.toBe(identidad.crearFirmaCriterios(prefs));
});

test('v11 invalida decisiones v10 incluso con instrucciones explícitas idénticas', () => {
    const opciones = { instrucciones: 'Sistema sintético explícito' };
    const actual = identidad.construirIdentidadEvaluacion(oferta, prefs, opciones);
    const anterior = identidad.construirIdentidadEvaluacion(oferta, prefs, { ...opciones, version: 'evaluacion-v10' });
    expect(actual.criterios.version).toBe('evaluacion-v11');
    expect(actual.firma_criterios_evaluacion).not.toBe(anterior.firma_criterios_evaluacion);
});

test('versionar reglas provoca miss sin modificar mensajes reales', () => {
    const actual = identidad.construirIdentidadEvaluacion(oferta, prefs);
    const nueva = identidad.construirIdentidadEvaluacion(oferta, prefs, { version: 'contrato-prueba-v2' });
    expect(nueva.criterios.mensaje_sistema).toBe(actual.criterios.mensaje_sistema);
    expect(nueva.firma_criterios_evaluacion).not.toBe(actual.firma_criterios_evaluacion);
});

test('orden equivalente de objetos produce mensajes y firmas equivalentes', () => {
    const una = { ...prefs, tecnologias_detalle: [{ nombre: 'TypeScript', nivel: 'basico', evidencia: 'Proyecto sintético' }] };
    const otra = { tecnologias_detalle: [{ evidencia: 'Proyecto sintético', nivel: 'basico', nombre: 'TypeScript' }], ...prefs };
    expect(identidad.construirIdentidadEvaluacion(oferta, una)).toEqual(identidad.construirIdentidadEvaluacion(oferta, otra));
});

test('firma legacy ausente es desconocida, distinta anterior, igual actual; errores nunca actual', () => {
    const fila = { estado_evaluacion: 'aprobada', firma_criterios_evaluacion: 'firma' };
    expect(identidad.obtenerVigenciaEvaluacion(fila, 'firma')).toBe('actual');
    expect(identidad.obtenerVigenciaEvaluacion(fila, 'otra')).toBe('anterior');
    expect(identidad.obtenerVigenciaEvaluacion({ ...fila, firma_criterios_evaluacion: null }, 'firma')).toBe('desconocida');
    expect(identidad.obtenerVigenciaEvaluacion({ ...fila, evaluacion_error_mensaje: 'Error' }, 'firma')).toBe('desconocida');
    expect(identidad.obtenerVigenciaEvaluacion({ ...fila, estado_evaluacion: 'pendiente' }, 'firma')).toBe('desconocida');
    expect(identidad.obtenerVigenciaEvaluacion(fila, null)).toBe('desconocida');
});

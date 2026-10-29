const { spawnSync } = require('child_process');
const path = require('path');

const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');
const { exportarOfertas, SQL_IDENTIDAD, SQL_PREFERENCIAS, SQL_OFERTAS, SQL_COLUMNAS, CAMPOS } = require('./exportar-ofertas');
const { obtenerCasos, verificarSalida } = require('./issue-69-postgres-prueba');
const ruta = path.resolve(__dirname, 'exportar-ofertas.js');
let directorio;
const opciones = { autorizar: true, servidor: '192.0.2.1', puerto: 5432, base: 'sintetica', usuario: 'lector', salida: 'prueba', sintetico: true };

beforeEach(() => { directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'issue69-')); });
afterEach(() => { fs.rmSync(directorio, { recursive: true, force: true }); });

function prepararCliente(datos = obtenerCasos(), cambios = {}) {
    const consultas = [];
    const cliente = {
        connect: jest.fn(async () => {}), end: jest.fn(async () => {}),
        query: jest.fn(consulta => {
            const sql = typeof consulta === 'string' ? consulta : consulta.text;
            consultas.push(sql);
            if (sql === SQL_IDENTIDAD) return Promise.resolve({ rows: [{ base: opciones.base, usuario: opciones.usuario, servidor: opciones.servidor,
                puerto: 5432, solo_lectura: 'on', transaccion_solo_lectura: 'on', ...cambios }] });
            if (sql === SQL_PREFERENCIAS) return Promise.resolve({ rows: [{ preferencias: datos.preferencias }] });
            if (sql === SQL_COLUMNAS) return Promise.resolve({ rows: CAMPOS.filter(campo => !(datos.columnas_ausentes || []).includes(campo)).map(columna => ({ columna })) });
            const emisor = new EventEmitter();
            process.nextTick(() => {
                const filas = datos.ofertas.length ? datos.ofertas : [null];
                for (const oferta of filas) {
                    const proyectada = oferta && { ...oferta };
                    for (const campo of datos.columnas_ausentes || []) {
                        if (sql.includes(`NULL AS ${campo}`) && proyectada) proyectada[campo] = null;
                    }
                    emisor.emit('row', { total_sql: datos.total_sql ?? String(datos.ofertas.length), oferta: proyectada });
                }
                emisor.emit('end');
            });
            return emisor;
        }),
    };
    return { cliente, consultas, dependencias: { crearCliente: () => cliente, directorioSalida: directorio } };
}

test('conservo los doce escenarios, todas las filas y descripción UTF-8 extensa, sin datos privados', async () => {
    const datos = obtenerCasos();
    const original = JSON.stringify(datos);
    const { dependencias, consultas } = prepararCliente(datos);
    const resumen = await exportarOfertas(opciones, dependencias);
    expect(verificarSalida(path.join(directorio, 'prueba'), datos.ofertas).escenarios).toBe(12);
    expect(resumen.tipo).toBe('sintetico_no_productivo');
    expect(JSON.stringify(datos)).toBe(original);
    expect(consultas).toEqual([SQL_IDENTIDAD, SQL_PREFERENCIAS, SQL_COLUMNAS, SQL_OFERTAS]);
    expect(SQL_OFERTAS).not.toMatch(/WHERE|LIMIT|182|postulacion/);
    const fila = JSON.parse(fs.readFileSync(path.join(directorio, 'prueba/busco-trabajo-auditoria-matching.jsonl'), 'utf8').split('\n')[0]);
    expect(Object.keys(fila)).toEqual([...CAMPOS, 'vigencia_evaluacion', 'autoria_evaluacion', 'precision_fecha_evaluacion']);
});

test.each(['base', 'usuario', 'servidor', 'puerto', 'solo_lectura', 'transaccion_solo_lectura'])('rechazo identidad o seguridad incorrecta: %s, sin leer ofertas ni crear salida', async campo => {
    const { cliente, dependencias, consultas } = prepararCliente(undefined, { [campo]: 'incorrecto' });
    await expect(exportarOfertas(opciones, dependencias)).rejects.toThrow('Exportación rechazada: autorización o destino inválido.');
    expect(consultas).toEqual([SQL_IDENTIDAD]);
    expect(cliente.end).toHaveBeenCalledTimes(1);
    expect(fs.readdirSync(directorio)).toEqual([]);
});

test.each([{ autorizar: false }, { salida: '../escape' }, { puerto: 0 }, { base: '' }])('rechazo opciones antes de construir cliente', async cambio => {
    const crearCliente = jest.fn();
    await expect(exportarOfertas({ ...opciones, ...cambio }, { crearCliente, directorioSalida: directorio })).rejects.toThrow('Exportación rechazada');
    expect(crearCliente).not.toHaveBeenCalled();
    expect(fs.readdirSync(directorio)).toEqual([]);
});

test.each([
    { servidor: 'db.example.test' }, { servidor: 'localhost' },
    { servidor: '' }, { servidor: '   ' }, { servidor: ' 192.0.2.1' },
    { servidor: '192.0.2.999' }, { servidor: '192.0.2' }, { servidor: '2001:db8:::1' },
    { servidor: '[::1]' }, { servidor: 'postgres://192.0.2.1' }, { servidor: '192.0.2.1,192.0.2.2' },
    { servidor: 'socket/relativo' }, { servidor: '//socket' }, { servidor: '/socket/../otro' },
    { servidor: '/socket/./otro' }, { servidor: '/socket//otro' }, { servidor: '/socket/' },
    { servidor: '/socket\u0000otro' }, { servidor: '/socket\notro' }, { servidor: '/socket\u007fotro' },
    { servidor: '/socket', autorizar: false },
])('rechazo destino inválido antes de crear cliente: %j', async cambio => {
    const entrada = { ...opciones, ...cambio };
    const original = { ...entrada };
    const { cliente, dependencias } = prepararCliente();
    const crearCliente = jest.fn(() => cliente);
    await expect(exportarOfertas(entrada, { ...dependencias, crearCliente }))
        .rejects.toThrow(/^Exportación rechazada: autorización o destino inválido\.$/);
    expect(crearCliente).not.toHaveBeenCalled();
    expect(cliente.connect).not.toHaveBeenCalled();
    expect(cliente.query).not.toHaveBeenCalled();
    expect(cliente.end).not.toHaveBeenCalled();
    expect(entrada).toEqual(original);
    expect(fs.readdirSync(directorio)).toEqual([]);
});

test.each(['192.0.2.1', '2001:db8::1', '/var/run/postgresql', '/proc/self/fd/42'])
('acepto destino literal o socket autorizado sin modificarlo: %s', async servidor => {
    const entrada = { ...opciones, servidor };
    const original = { ...entrada };
    const { cliente, dependencias, consultas } = prepararCliente(undefined, {
        servidor: servidor.startsWith('/') ? null : servidor,
        ...(servidor.startsWith('/') ? { puerto: null, puerto_configurado: '5432' } : {}),
    });
    const crearCliente = jest.fn(() => cliente);
    const resumen = await exportarOfertas(entrada, { ...dependencias, crearCliente });
    expect(crearCliente).toHaveBeenCalledTimes(1);
    expect(crearCliente).toHaveBeenCalledWith(original);
    expect(cliente.connect).toHaveBeenCalledTimes(1);
    expect(cliente.end).toHaveBeenCalledTimes(1);
    expect(consultas).toEqual([SQL_IDENTIDAD, SQL_PREFERENCIAS, SQL_COLUMNAS, SQL_OFERTAS]);
    expect(resumen.completo).toBe(true);
    expect(resumen.total_sql).toBe(String(resumen.total_exportado));
    expect(entrada).toEqual(original);
});

test('reconcilio cero filas y preferencias ausentes sin inventar criterios', async () => {
    const { dependencias } = prepararCliente({ ofertas: [], preferencias: null });
    const resumen = await exportarOfertas(opciones, dependencias);
    expect(resumen.total_sql).toBe('0');
    expect(resumen.total_exportado).toBe(0);
    expect(fs.readFileSync(path.join(directorio, 'prueba/busco-trabajo-auditoria-matching.jsonl'), 'utf8')).toBe('');
    expect(JSON.parse(fs.readFileSync(path.join(directorio, 'prueba/busco-trabajo-criterios-sanitizados.json'), 'utf8'))).toEqual({ disponible: false, firma_actual: null });
});

test('no publico resumen completo si el conteo SQL no coincide; no sobrescribo ni reanudo parciales', async () => {
    const datos = obtenerCasos();
    datos.total_sql = '13';
    const { dependencias } = prepararCliente(datos);
    await expect(exportarOfertas(opciones, dependencias)).rejects.toThrow('No pude completar');
    const salida = path.join(directorio, 'prueba');
    expect(fs.existsSync(path.join(salida, 'resumen.json'))).toBe(false);
    const antes = fs.readFileSync(path.join(salida, 'busco-trabajo-auditoria-matching.jsonl'));
    await expect(exportarOfertas(opciones, dependencias)).rejects.toThrow('No pude completar');
    expect(fs.readFileSync(path.join(salida, 'busco-trabajo-auditoria-matching.jsonl')).equals(antes)).toBe(true);
});

test.each(['file:///etc/passwd', 'javascript:alert(1)', 'http://127.0.0.1/privado', 'http://192.168.1.1/', 'http://localhost/', 'http://[::1]/'])('no exporto URL insegura %s', async url => {
    const datos = { ofertas: [{ id: 1, url, descripcion: url }], preferencias: null };
    await exportarOfertas(opciones, prepararCliente(datos).dependencias);
    const fila = JSON.parse(fs.readFileSync(path.join(directorio, 'prueba/busco-trabajo-auditoria-matching.jsonl'), 'utf8'));
    expect(fila.url).toBeNull();
    expect(fila.descripcion).not.toBe(url);
});

test('conservo firma hexadecimal y porcentaje inconsistente sin confundirlos con teléfonos', async () => {
    const firma = '1234567890abcdef'.repeat(4);
    const datos = { ofertas: [{ id: 1, firma_criterios_evaluacion: firma, porcentaje_match: '123456789' }], preferencias: null };
    await exportarOfertas(opciones, prepararCliente(datos).dependencias);
    const fila = JSON.parse(fs.readFileSync(path.join(directorio, 'prueba/busco-trabajo-auditoria-matching.jsonl'), 'utf8'));
    expect(fila.firma_criterios_evaluacion).toBe(firma);
    expect(fila.porcentaje_match).toBe('123456789');
});

test('proyecto columnas ausentes como null, preservo última extracción y reporto esquema sin perder conteos', async () => {
    const datos = { ofertas: [{ id: 1, fecha_extraccion: '2020-01-01T00:00:00Z', fecha_ultima_extraccion: '2026-01-01T00:00:00Z', origen_descripcion: 'no disponible en esquema' }], preferencias: null, columnas_ausentes: ['origen_descripcion'] };
    const { dependencias, consultas } = prepararCliente(datos);
    const resumen = await exportarOfertas(opciones, dependencias);
    const fila = JSON.parse(fs.readFileSync(path.join(directorio, 'prueba/busco-trabajo-auditoria-matching.jsonl'), 'utf8'));
    expect(fila.fecha_ultima_extraccion).toBe('2026-01-01T00:00:00Z');
    expect(fila.fecha_extraccion).toBe('2020-01-01T00:00:00Z');
    expect(fila.origen_descripcion).toBeNull();
    expect(resumen.campos_ausentes).toEqual(['origen_descripcion']);
    expect(resumen.version_esquema_exportacion).toBe('auditoria-matching-v1');
    expect(new Date(resumen.exportado_en).toISOString()).toBe(resumen.exportado_en);
    expect(resumen.total_sql).toBe('1');
    expect(resumen.total_exportado).toBe(1);
    expect(consultas).toHaveLength(4);
    expect(consultas[3]).toContain('NULL AS origen_descripcion');
    expect(consultas[3]).not.toContain('datos_crudos');
});

test('reporto campos ausentes también con cero ofertas', async () => {
    const { dependencias } = prepararCliente({ ofertas: [], preferencias: null, columnas_ausentes: ['fecha_ultima_extraccion'] });
    const resumen = await exportarOfertas(opciones, dependencias);
    expect(resumen.campos_ausentes).toEqual(['fecha_ultima_extraccion']);
    expect(resumen.total_sql).toBe('0');
    expect(resumen.total_exportado).toBe(0);
});

test('quito secretos etiquetados sin borrar requisitos técnicos posteriores en la misma línea', async () => {
    const texto = 'token: SECRETO; Java obligatorio, Senior 5+ años; api_key="OTRO_SECRETO", C# .NET 3+ años';
    const datos = { ofertas: [{ id: 1, descripcion: texto, razon_evaluacion: texto }], preferencias: null };
    await exportarOfertas(opciones, prepararCliente(datos).dependencias);
    const fila = JSON.parse(fs.readFileSync(path.join(directorio, 'prueba/busco-trabajo-auditoria-matching.jsonl'), 'utf8'));
    for (const campo of ['descripcion', 'razon_evaluacion']) {
        expect(fila[campo]).not.toContain('SECRETO');
        expect(fila[campo]).toContain('Java obligatorio, Senior 5+ años');
        expect(fila[campo]).toContain('C# .NET 3+ años');
    }
});

test.each([
    ['Basic', 'Authorization: Basic dXNlcjpwYXNz', '[secreto omitido]'],
    ['cookies múltiples', 'Cookie: session=PRIVATE_SESSION; refresh=PRIVATE_REFRESH', '[secreto omitido]'],
    ['Basic con requisitos', 'Authorization: Basic dXNlcjpwYXNz; Java obligatorio, Senior 5+ años', '[secreto omitido]; Java obligatorio, Senior 5+ años'],
    ['Bearer con requisitos', 'Authorization: Bearer PRIVATE_BEARER; C# y .NET', '[secreto omitido]; C# y .NET'],
    ['Digest con parámetros', 'Authorization: Digest username="PRIVATE_USER", realm="PRIVATE_REALM", response="PRIVATE_RESPONSE"; Java obligatorio', '[secreto omitido]; Java obligatorio'],
    ['esquema propio', 'Authorization: CustomScheme PRIVATE_CUSTOM; C# y .NET', '[secreto omitido]; C# y .NET'],
    ['cookies con requisitos', 'Cookie: session=PRIVATE_SESSION; refresh=PRIVATE_REFRESH; Java obligatorio, Senior 5+ años', '[secreto omitido]; Java obligatorio, Senior 5+ años'],
])('B1 quito cabecera %s completa sin borrar requisitos posteriores', async (_nombre, texto, esperado) => {
    const datos = { ofertas: [{ id: 1, descripcion: texto, razon_evaluacion: texto,
        explicacion_evaluacion: { cumplidos: [{ requisito: texto }] } }], preferencias: null };
    const { dependencias, cliente } = prepararCliente(datos);
    const resumen = await exportarOfertas(opciones, dependencias);
    const salida = path.join(directorio, 'prueba');
    const contenido = fs.readdirSync(salida).map(archivo => fs.readFileSync(path.join(salida, archivo), 'utf8')).join('');
    expect(/PRIVATE_|dXNlcjpwYXNz/.test(contenido)).toBe(false);
    const fila = JSON.parse(fs.readFileSync(path.join(salida, 'busco-trabajo-auditoria-matching.jsonl'), 'utf8'));
    expect(fila.descripcion).toBe(esperado);
    expect(fila.razon_evaluacion).toBe(esperado);
    expect(fila.explicacion_evaluacion.cumplidos[0].requisito).toBe(esperado);
    expect(resumen.total_sql).toBe('1');
    expect(resumen.total_exportado).toBe(1);
    expect(cliente.end).toHaveBeenCalledTimes(1);
});

test.each([
    ['Requiere experiencia ISO 27001 (2022), C# y .NET', 'Requiere experiencia ISO 27001 (2022), C# y .NET'],
    ['Requiere experiencia ISO 27001 (2022), C# y .NET. Teléfono: +54 11 5555 1234', 'Requiere experiencia ISO 27001 (2022), C# y .NET. Teléfono: [teléfono omitido]'],
    ['Experiencia 3-5 años, SQL Server 2022, .NET 8.0 y 100000 usuarios; áéíóú ñ 🚀', 'Experiencia 3-5 años, SQL Server 2022, .NET 8.0 y 100000 usuarios; áéíóú ñ 🚀'],
])('B2 preservo íntegros estándares, versiones y rangos técnicos', async (texto, esperado) => {
    const datos = { ofertas: [{ id: 1, descripcion: texto }], preferencias: null };
    await exportarOfertas(opciones, prepararCliente(datos).dependencias);
    const fila = JSON.parse(fs.readFileSync(path.join(directorio, 'prueba/busco-trabajo-auditoria-matching.jsonl'), 'utf8'));
    expect(fila.descripcion).toBe(esperado);
});

test.each([
    ['https://www.linkedin.com/jobs/view/4398123456/', 'https://www.linkedin.com/jobs/view/4398123456/'],
    ['https://ar.indeed.com/viewjob?jk=abcdef0123456789', 'https://ar.indeed.com/viewjob?jk=abcdef0123456789'],
    ['https://usuario:PRIVATE_PASSWORD@ar.indeed.com/viewjob?jk=abcdef0123456789&token=PRIVATE_TOKEN&utm_source=PRIVATE_TRACKING#PRIVATE_FRAGMENT', 'https://ar.indeed.com/viewjob?jk=abcdef0123456789'],
    ['https://www.bumeran.com.ar/empleos/desarrollo-1234567890.html', 'https://www.bumeran.com.ar/empleos/desarrollo-1234567890.html'],
])('B3 conservo identidad pública de la oferta en campo URL y descripción', async (url, esperado) => {
    const datos = { ofertas: [{ id: 1, url, descripcion: `Oferta: ${url}` }], preferencias: null };
    await exportarOfertas(opciones, prepararCliente(datos).dependencias);
    const contenido = fs.readFileSync(path.join(directorio, 'prueba/busco-trabajo-auditoria-matching.jsonl'), 'utf8');
    const fila = JSON.parse(contenido);
    expect(fila.url).toBe(esperado);
    expect(fila.descripcion).toBe(`Oferta: ${esperado}`);
    expect(contenido.includes('PRIVATE_')).toBe(false);
});

test.each([
    'https://ar.indeed.com.evil.example/viewjob?jk=abcdef0123456789&token=PRIVATE_TOKEN',
    'https://ar.indeed.com/viewjob?jk=PRIVATE_TOKEN',
    'https://empleos.example/viewjob?jk=abcdef0123456789',
])('B3 no conservo queries fuera de host, clave y formato público autorizados', async url => {
    const datos = { ofertas: [{ id: 1, url, descripcion: url }], preferencias: null };
    await exportarOfertas(opciones, prepararCliente(datos).dependencias);
    const fila = JSON.parse(fs.readFileSync(path.join(directorio, 'prueba/busco-trabajo-auditoria-matching.jsonl'), 'utf8'));
    expect(new URL(fila.url).search).toBe('');
    expect(fila.descripcion).toBe(fila.url);
});

test('omito prompt y evidencia narrativa del perfil y redacto nombre conocido en todos los textos', async () => {
    const datos = obtenerCasos();
    datos.preferencias = structuredClone(datos.preferencias);
    datos.preferencias.nombre = 'Persona Sintética Reservada';
    datos.preferencias.prompt_personalizado = 'CV_COMPLETO_NO_EXPORTAR Persona Sintética Reservada';
    datos.preferencias.tecnologias_detalle[0].evidencia = 'CV_COMPLETO_NO_EXPORTAR';
    datos.preferencias.roles_objetivo_detalle[0].evidencia = 'CV_COMPLETO_NO_EXPORTAR';
    datos.ofertas[0].empresa = 'Persona Sintética Reservada';
    datos.ofertas[0].explicacion_evaluacion.cumplidos[0].evidencia_perfil = 'Proyecto de Persona Sintética Reservada';
    await exportarOfertas(opciones, prepararCliente(datos).dependencias);
    const salida = path.join(directorio, 'prueba');
    const contenido = fs.readdirSync(salida).map(archivo => fs.readFileSync(path.join(salida, archivo), 'utf8')).join('');
    expect(contenido.includes('CV_COMPLETO_NO_EXPORTAR')).toBe(false);
    expect(contenido.includes('Persona Sintética Reservada')).toBe(false);
    const criterios = JSON.parse(fs.readFileSync(path.join(salida, 'busco-trabajo-criterios-sanitizados.json'), 'utf8'));
    expect(criterios.criterios_adicionales_ia).toEqual({ activos: true, detalle: 'omitido_privacidad_no_reconstruible' });
    expect(criterios.instrucciones_efectivas_completas).toBe(false);
    expect(criterios.prioridad_ia.version).toBe('prioridad-ia-v1');
    expect(criterios.prioridad_ia.modifica_match).toBe(false);
    expect(criterios.prioridad_ia.no_compensa_exclusiones).toBe(true);
    expect(criterios.prioridad_ia.seniales).toContain('Next.js');
    expect(criterios.prioridad_ia.seniales).toContain('Claude Code');
    expect(criterios.tecnologias_comprobadas[0]).not.toHaveProperty('evidencia');
    expect(criterios.roles_objetivo[0]).not.toHaveProperty('evidencia');
});

test('cierro el cliente aun cuando connect falla sin leer datos ni crear salida', async () => {
    const { cliente, dependencias, consultas } = prepararCliente();
    cliente.connect.mockRejectedValue(new Error('NO_IMPRIMIR'));
    await expect(exportarOfertas(opciones, dependencias)).rejects.toThrow('No pude completar la exportación. No comparta una salida sin resumen completo.');
    expect(cliente.end).toHaveBeenCalledTimes(1);
    expect(consultas).toEqual([]);
    expect(fs.readdirSync(directorio)).toEqual([]);
});

test('opciones del llamador no pueden anular flags read-only ni destino', async () => {
    const pg = require('pg');
    const cerrar = jest.spyOn(pg.Client.prototype, 'end').mockResolvedValue();
    const conectar = jest.spyOn(pg.Client.prototype, 'connect').mockRejectedValue(new Error('SECRETO_NO_LOGUEAR'));
    const recibido = [];
    conectar.mockImplementation(function () {
        recibido.push(this.connectionParameters);
        return Promise.reject(new Error('SECRETO_NO_LOGUEAR'));
    });
    try {
        await expect(exportarOfertas({ ...opciones, options: '-c default_transaction_read_only=off', connectionString: 'postgres://invalido' })).rejects.toThrow('No pude completar');
        expect(recibido[0].options).toContain('default_transaction_read_only=on');
        expect(recibido[0].host).toBe(opciones.servidor);
    } finally { conectar.mockRestore(); cerrar.mockRestore(); }
});

test('CLI ayuda e importación son pasivas; opciones desconocidas no filtran valores', () => {
    const entorno = { PATH: process.env.PATH };
    const ayuda = spawnSync(process.execPath, [ruta, '--help'], { encoding: 'utf8', env: entorno });
    expect(ayuda.status).toBe(0);
    expect(ayuda.stdout).toContain('--autorizar');
    expect(ayuda.stderr).toBe('');
    const rechazo = spawnSync(process.execPath, [ruta, '--privado', 'NO_IMPRIMIR'], { encoding: 'utf8', env: entorno });
    expect(rechazo.status).toBe(1);
    expect(rechazo.stdout).toBe('');
    expect(rechazo.stderr).toBe('Exportación rechazada: autorización o destino inválido.\n');
});

test('rechazo sin autorización antes de cargar pg, dotenv o abrir una conexión', () => {
    const programa = `
        const Module = require('module');
        const cargar = Module._load;
        Module._load = function(nombre, ...argumentos) {
            if (['pg', 'dotenv'].includes(nombre)) throw new Error('DEPENDENCIA_PREMATURA');
            return cargar.call(this, nombre, ...argumentos);
        };
        process.argv = ['node', ${JSON.stringify(ruta)}];
        require(${JSON.stringify(ruta)}).ejecutarCli?.([]);
    `;
    const resultado = spawnSync(process.execPath, ['-e', programa], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    expect(resultado.status).toBe(1);
    expect(resultado.stdout).toBe('');
    expect(resultado.stderr).toBe('Exportación rechazada: autorización o destino inválido.\n');
});

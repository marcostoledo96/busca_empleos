const { createHash, createPublicKey, randomBytes, verify } = require('node:crypto');
const { createServer } = require('node:http');
const { setTimeout: esperar } = require('node:timers/promises');
const { abrirAlmacen, errorDominio } = require('./almacen');

const EMISOR = 'https://auth.openai.com';
const RECURSO = 'https://api.openai.com/v1';
const CALLBACK = '/auth/callback';
const DINAMICO = 'dynamic_agent_client';
const ALCANCE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const AJUSTES = 'https://chatgpt.com/settings/usage';
const REFRESH_INVALIDOS = new Set(['invalid_grant', 'invalid_refresh_token', 'token_expired',
    'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused']);

const interrumpida = () => errorDominio('sesion-interrumpida', 'La sesión se interrumpió.');
const texto = (valor) => typeof valor === 'string' && valor.length > 0;
const clienteValido = (valor) => texto(valor) && /^oaiapp_[A-Za-z0-9_-]+$/.test(valor);
const opaco = () => randomBytes(32).toString('base64url');
const habilitado = (registro) => ALCANCE.split(' ').every((permiso) => registro.scopes?.includes(permiso));
const datosRegistro = ({ clientId, sujeto }) => ({ clientId, sujeto });
const publico = (registro) => ({ ...datosRegistro(registro), habilitado: habilitado(registro) });
const decodificar = (pieza) => JSON.parse(Buffer.from(pieza, 'base64url').toString('utf8'));

function endpoint(valor) {
    const url = new URL(valor);
    if (url.origin !== EMISOR || url.username || url.password || url.hash || url.search) throw new Error();
    return url.href;
}

function validarIdToken(token, claves, clientId, nonce, ahora, renovacion = false) {
    try {
        const piezas = token.split('.');
        if (piezas.length !== 3 || !piezas.every((pieza) => /^[A-Za-z0-9_-]+$/.test(pieza))) throw new Error();
        const [cabecera, cuerpo, firma] = piezas;
        const encabezado = decodificar(cabecera);
        if (encabezado.alg !== 'RS256' || !texto(encabezado.kid) || encabezado.crit !== undefined) throw new Error();
        const candidatas = claves.keys.filter((clave) => clave.kid === encabezado.kid && clave.kty === 'RSA' &&
            (!clave.use || clave.use === 'sig') && (!clave.alg || clave.alg === 'RS256') &&
            (!clave.key_ops || clave.key_ops.includes('verify')));
        if (candidatas.length !== 1) throw new Error();
        const clave = createPublicKey({ key: candidatas[0], format: 'jwk' });
        if (clave.asymmetricKeyDetails.modulusLength < 2048 ||
            !verify('RSA-SHA256', Buffer.from(`${cabecera}.${cuerpo}`), clave, Buffer.from(firma, 'base64url'))) throw new Error();
        const datos = decodificar(cuerpo);
        const audiencia = Array.isArray(datos.aud) ? datos.aud : [datos.aud];
        if (datos.iss !== EMISOR || !audiencia.includes(clientId) || !audiencia.every(texto) ||
            ((audiencia.length > 1 || datos.azp !== undefined) && datos.azp !== clientId) ||
            !Number.isFinite(datos.exp) || datos.exp <= ahora / 1000 ||
            (datos.nbf !== undefined && (!Number.isFinite(datos.nbf) || datos.nbf > ahora / 1000)) ||
            ((!renovacion || datos.nonce !== undefined) && datos.nonce !== nonce) || !texto(datos.sub)) throw new Error();
        return datos.sub;
    } catch { throw errorDominio('id-token-invalido', 'No se pudo validar la identidad del proveedor.'); }
}

function credenciales(datos, ahora, scopesAnteriores) {
    const scopes = typeof datos?.scope === 'string' ? datos.scope.trim().split(/\s+/).filter(Boolean) :
        datos?.scope === undefined ? scopesAnteriores : undefined;
    const expira = ahora + datos?.expires_in * 1000;
    if (!scopes || (scopes.includes('offline_access') && !texto(datos.refresh_token)) ||
        !texto(datos.access_token) || datos.token_type?.toLowerCase?.() !== 'bearer' ||
        !Number.isSafeInteger(datos.expires_in) || datos.expires_in <= 0 || !Number.isSafeInteger(expira)) {
        throw errorDominio('tokens-invalidos', 'Respuesta de credenciales inválida.');
    }
    return { accessToken: datos.access_token, refreshToken: datos.refresh_token, expira, scopes };
}

function abrirSesion({ modo, directorio, fetch, ahora = Date.now } = {}) {
    if (modo !== 'local-manual') throw errorDominio('modo-no-autorizado', 'Solo se permite el piloto local manual.');
    if (typeof fetch !== 'function') throw errorDominio('fetch-requerido', 'Se requiere un transporte inyectado.');
    const almacen = abrirAlmacen(directorio);
    let estado;
    try { estado = almacen.leer(); } catch (error) { almacen.cerrar(); throw error; }
    let guardadoHost = false;
    let cola = Promise.resolve();
    let generacion = 0;
    let intento;
    let clientePorReintentar;
    let cierre;
    let desconexion;
    let falloAlmacen;
    const operaciones = new Set();

    async function solicitar(url, formulario, sinCuerpo = false) {
        const opciones = { redirect: 'error', signal: AbortSignal.timeout(10000) };
        if (formulario) Object.assign(opciones, { method: 'POST', body: new URLSearchParams(formulario) });
        let respuesta;
        try { respuesta = await fetch(url, opciones); } catch {
            throw errorDominio('red-oauth', 'No se pudo contactar al proveedor OAuth.');
        }
        if (respuesta.status === 200 && sinCuerpo) return;
        const datos = await respuesta.json().catch(() => null);
        if (respuesta.status !== 200) {
            const codigo = typeof datos?.error === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(datos.error) ? datos.error : undefined;
            const id = respuesta.headers.get('x-request-id');
            throw Object.assign(errorDominio('oauth-proveedor', 'El proveedor rechazó la solicitud OAuth.'), {
                statusUpstream: respuesta.status, codigoUpstream: codigo,
                requestId: /^req_[A-Za-z0-9_-]{1,80}$/.test(id) ? id : undefined
            });
        }
        return datos;
    }

    async function discovery() {
        const datos = await solicitar(`${EMISOR}/.well-known/openid-configuration`);
        try {
            if (datos.issuer !== EMISOR) throw new Error();
            return { token: endpoint(datos.token_endpoint), jwks: endpoint(datos.jwks_uri), revocar: endpoint(datos.revocation_endpoint) };
        } catch { throw errorDominio('discovery-invalido', 'Los metadatos de OpenAI no son válidos.'); }
    }

    function enSerie(tarea) {
        const resultado = cola.then(tarea);
        cola = resultado.catch(() => {});
        return resultado;
    }

    function comprobar(version) {
        if (version !== generacion || cierre || desconexion) throw interrumpida();
        if (falloAlmacen) throw falloAlmacen;
    }

    function persistir(nuevo) {
        try { almacen.guardar(nuevo); } catch (error) { falloAlmacen = error; throw error; }
        estado = nuevo;
        guardadoHost = true;
    }

    function buscar(clientId) { return estado.registros.find((registro) => registro.clientId === clientId); }

    function actualizar(registro, activo = estado.activo) {
        persistir({ ...estado, activo, registros: [...estado.registros.filter(({ clientId }) => clientId !== registro.clientId), registro] });
    }

    function invalidarOperaciones() {
        generacion++;
        for (const operacion of operaciones) operacion.abort(interrumpida());
    }

    function interrumpir() {
        clientePorReintentar = undefined;
        invalidarOperaciones();
        intento?.cancelar();
    }

    async function iniciarVinculo({ clientId, reconsentir = false, reintentar = false } = {}) {
        const version = generacion;
        comprobar(version);
        if (intento) throw errorDominio('vinculo-en-curso', 'Ya hay una vinculación en curso.');
        const previo = buscar(clientId);
        if ((clientId !== undefined && !previo) || (reconsentir && !previo) || typeof reconsentir !== 'boolean') {
            throw errorDominio('cliente-invalido', 'La vinculación requiere un cliente registrado válido.');
        }
        if (typeof reintentar !== 'boolean' || (reintentar && (clientId !== undefined || !clientePorReintentar))) {
            throw errorDominio('reintento-no-disponible', 'No hay un registro inicial pendiente para reintentar.');
        }
        const clienteAutorizacion = previo?.clientId ?? (reintentar ? clientePorReintentar : undefined);
        if (!guardadoHost) persistir(estado);
        const state = opaco();
        const nonce = opaco();
        const verificador = opaco();
        const resultado = Promise.withResolvers();
        resultado.promise.catch(() => {});
        let usado = false;
        let redireccion;
        let tiempo;

        function detener() {
            usado = true;
            clearTimeout(tiempo);
            servidor.close();
        }

        function terminar(error) {
            detener();
            if (intento === pendiente) intento = undefined;
            resultado.reject(error);
        }

        const escucha = Promise.withResolvers();
        const pendiente = { cancelar: () => {
            const error = interrumpida();
            escucha.reject(error);
            terminar(error);
        } };
        const servidor = createServer((req, res) => {
            function responder(status, mensaje) {
                res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
                    'Referrer-Policy': 'no-referrer', Connection: 'close' });
                res.end(mensaje);
            }
            const invalida = () => responder(400, 'Solicitud local inválida.');
            if (usado || !redireccion || req.method !== 'GET' || req.headers.host !== new URL(redireccion).host ||
                !(req.url === CALLBACK || req.url.startsWith(`${CALLBACK}?`))) return invalida();
            const params = new URL(req.url, redireccion).searchParams;
            if (params.getAll('state').length !== 1 || params.get('state') !== state ||
                ['code', 'client_id', 'error'].some((campo) => params.getAll(campo).length > 1)) return invalida();
            responder(200, 'Volvé a la aplicación para comprobar la conexión.');
            detener();
            const codigo = params.get('code');
            const recibido = params.get('client_id');
            const emitido = clienteAutorizacion ?? recibido;
            enSerie(async () => {
                comprobar(version);
                if (params.has('error')) throw params.get('error') === 'access_denied' ?
                    errorDominio('consentimiento-denegado', 'No se concedió el consentimiento.') :
                    errorDominio('autorizacion-rechazada', 'El proveedor no completó la autorización.');
                if (!clienteValido(emitido) || (recibido !== null && recibido !== emitido) || !texto(codigo)) {
                    throw errorDominio('cliente-invalido', 'La redirección no corresponde al cliente esperado.');
                }
                const registrado = buscar(emitido);
                if (!previo && registrado) throw errorDominio('cliente-invalido', 'El cliente emitido ya está registrado.');
                const rutas = await discovery();
                comprobar(version);
                let datos;
                try {
                    datos = await solicitar(rutas.token, { grant_type: 'authorization_code', client_id: emitido,
                        code: codigo, code_verifier: verificador, redirect_uri: redireccion, resource: RECURSO });
                    comprobar(version);
                    const cred = credenciales(datos, ahora());
                    const sujeto = validarIdToken(datos.id_token, await solicitar(rutas.jwks), emitido, nonce, ahora());
                    comprobar(version);
                    if (previo && sujeto !== previo.sujeto) throw errorDominio('identidad-distinta', 'La identidad no coincide con la cuenta seleccionada.');
                    const registro = { clientId: emitido, sujeto, idToken: datos.id_token, ...cred };
                    const cambioDeCuenta = estado.activo !== null && estado.activo !== emitido;
                    actualizar(registro, emitido);
                    if (cambioDeCuenta) invalidarOperaciones();
                    return publico(registro);
                } catch (error) {
                    if (!previo && version === generacion && error.codigoUpstream === 'invalid_grant') {
                        clientePorReintentar = emitido;
                    }
                    if (pendiente.revocarAlCancelar) {
                        pendiente.revocacion = texto(datos?.refresh_token) && await revocar({
                            clientId: emitido, refreshToken: datos.refresh_token
                        });
                    }
                    throw error;
                }
            }).then((registro) => {
                if (intento === pendiente) intento = undefined;
                resultado.resolve(registro);
            }, terminar);
        });
        intento = pendiente;
        servidor.once('error', () => escucha.reject(errorDominio('loopback-no-disponible', 'No se pudo abrir la escucha local.')));
        servidor.listen(0, '127.0.0.1', escucha.resolve);
        try {
            await escucha.promise;
            comprobar(version);
        } catch (error) { terminar(error); throw error; }
        redireccion = `http://127.0.0.1:${servidor.address().port}${CALLBACK}`;
        clientePorReintentar = undefined;
        tiempo = setTimeout(() => terminar(errorDominio('vinculo-expirado', 'La vinculación local expiró.')), 180000);
        tiempo.unref();
        const url = new URL(`${EMISOR}/api/accounts/authorize`);
        url.search = new URLSearchParams({ client_id: clienteAutorizacion ?? DINAMICO, response_type: 'code',
            redirect_uri: redireccion, scope: ALCANCE, resource: RECURSO, ext_agent_host_id: estado.hostId, state, nonce,
            code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verificador).digest('base64url') });
        if (!clienteAutorizacion) url.searchParams.set('agent_name_hint', 'Busca Empleos');
        if (reconsentir) url.searchParams.set('prompt', 'consent');
        return { url: url.href, resultado: resultado.promise };
    }

    async function renovar(registro, version) {
        const rutas = await discovery();
        comprobar(version);
        let datos;
        try {
            datos = await solicitar(rutas.token, { grant_type: 'refresh_token', client_id: registro.clientId,
                refresh_token: registro.refreshToken, resource: RECURSO });
        } catch (error) {
            if (REFRESH_INVALIDOS.has(error.codigoUpstream)) actualizar(datosRegistro(registro), null);
            throw error;
        }
        let nuevo;
        try {
            const cred = credenciales(datos, ahora(), registro.scopes);
            if (!texto(cred.refreshToken)) throw errorDominio('tokens-invalidos', 'Falta el refresh token rotado.');
            nuevo = { ...registro, ...cred };
            if (datos.id_token !== undefined) {
                const nonce = decodificar(registro.idToken.split('.')[1]).nonce;
                const sujeto = validarIdToken(datos.id_token, await solicitar(rutas.jwks), registro.clientId, nonce, ahora(), true);
                if (sujeto !== registro.sujeto) throw errorDominio('identidad-distinta', 'La identidad no coincide con la cuenta seleccionada.');
            }
        } catch (error) {
            // El token rotado no es una credencial verificada; conservarlo solo para la revocación en curso.
            if (desconexion?.clientId === registro.clientId && texto(datos?.refresh_token)) {
                desconexion.refreshPendiente = datos.refresh_token;
            }
            actualizar(datosRegistro(registro), null);
            throw error;
        }
        // La desvinculación en cola necesita el último refresh token, aunque ya no admita operaciones.
        actualizar(nuevo);
        return nuevo;
    }

    async function conToken(operacion) {
        const version = generacion;
        comprobar(version);
        const registro = await enSerie(async () => {
            comprobar(version);
            let actual = buscar(estado.activo);
            if (!actual?.accessToken) throw errorDominio('sin-sesion', 'No hay una sesión conectada.');
            if (!habilitado(actual)) throw errorDominio('alcance-insuficiente', 'ChatGPT no concedió todos los permisos requeridos.');
            if (actual.expira - ahora() <= 60000) actual = await renovar(actual, version);
            if (!habilitado(actual)) throw errorDominio('alcance-insuficiente', 'ChatGPT no concedió todos los permisos requeridos.');
            return actual;
        });
        comprobar(version);
        const control = new AbortController();
        operaciones.add(control);
        try {
            const resultado = await operacion({ token: registro.accessToken, signal: control.signal });
            comprobar(version);
            return resultado;
        } catch (error) { comprobar(version); throw error; } finally { operaciones.delete(control); }
    }

    async function revocar(registro) {
        for (let vuelta = 0; vuelta < 2; vuelta++) {
            try {
                const rutas = await discovery();
                await solicitar(rutas.revocar, { token: registro.refreshToken, token_type_hint: 'refresh_token', client_id: registro.clientId }, true);
                return true;
            } catch (error) {
                if (vuelta || (error.codigo !== 'red-oauth' && !(error.statusUpstream >= 500))) break;
                await esperar(100);
            }
        }
        return false;
    }

    function desvincular(clientId = estado.activo) {
        if (desconexion) {
            if (desconexion.clientId === clientId) return desconexion.resultado;
            throw errorDominio('desvinculacion-en-curso', 'Esperá a que termine la desvinculación de la otra cuenta.');
        }
        comprobar(generacion);
        const pendiente = intento;
        if (pendiente) pendiente.revocarAlCancelar = true;
        // Bloquea la reentrada desde listeners de abort antes de notificarlos.
        const actual = { clientId };
        actual.resultado = enSerie(async () => {
            const registro = buscar(clientId);
            const refreshToken = actual.refreshPendiente ?? registro?.refreshToken;
            const revocacion = refreshToken ? await revocar({ clientId, refreshToken }) : pendiente?.revocacion === true;
            if (registro?.accessToken || registro?.idToken || registro?.refreshToken) {
                actualizar(datosRegistro(registro), estado.activo === clientId ? null : estado.activo);
            }
            const revocacionRemotaConfirmada = revocacion && pendiente?.revocacion !== false;
            return revocacionRemotaConfirmada ? { revocacionRemotaConfirmada } : { revocacionRemotaConfirmada, ajustes: AJUSTES };
        }).finally(() => {
            actual.refreshPendiente = undefined;
            desconexion = undefined;
        });
        desconexion = actual;
        interrumpir();
        return actual.resultado;
    }

    function cerrar() {
        if (!cierre) {
            cierre = enSerie(() => {
                if (falloAlmacen) throw falloAlmacen;
                almacen.cerrar();
            });
            interrumpir();
        }
        return cierre;
    }

    return { iniciarVinculo, conToken, desvincular, cerrar, registros: () => {
        comprobar(generacion);
        return { activo: estado.activo, registros: estado.registros.map(publico) };
    } };
}

module.exports = { abrirSesion };

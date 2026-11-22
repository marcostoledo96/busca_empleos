const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { homedir } = require('node:os');
const { dirname, join, resolve } = require('node:path');

function errorDominio(codigo, mensaje) {
    return Object.assign(new Error(mensaje), { codigo });
}

const inseguro = () => errorDominio('almacen-inseguro', 'El directorio de sesión debe ser privado y estar fuera del repositorio.');
const uid = () => process.getuid();

function verificarPadres(ruta) {
    const info = fs.lstatSync(ruta);
    const padre = dirname(ruta);
    if (!info.isDirectory() || (padre !== ruta && info.uid !== uid() && info.uid !== 0) ||
        ((info.mode & 0o022) && !(info.mode & 0o1000)) || fs.existsSync(join(ruta, '.git'))) throw inseguro();
    if (padre !== ruta) verificarPadres(padre);
}

function abrirAlmacen(directorio = join(homedir(), '.config', 'busco-trabajo')) {
    const ruta = resolve(directorio);
    const archivo = join(ruta, 'sesion.json');
    const bloqueo = join(ruta, 'propietario.lock');
    try {
        const padre = dirname(ruta);
        if (!fs.existsSync(padre)) {
            verificarPadres(dirname(padre));
            fs.mkdirSync(padre, { mode: 0o700 });
        }
        verificarPadres(padre);
        try { fs.mkdirSync(ruta, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
        const info = fs.lstatSync(ruta);
        if (!info.isDirectory() || info.uid !== uid() || (info.mode & 0o777) !== 0o700 || fs.existsSync(join(ruta, '.git'))) throw inseguro();
    } catch { throw inseguro(); }

    try {
        fs.closeSync(fs.openSync(bloqueo, 'wx', 0o600));
    } catch (error) {
        if (error.code === 'EEXIST') throw errorDominio('almacen-ocupado', 'Otro proceso posee la sesión, o quedó un bloqueo tras un cierre abrupto.');
        throw inseguro();
    }

    function leer() {
        let descriptor;
        try {
            descriptor = fs.openSync(archivo, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        } catch (error) {
            if (error.code === 'ENOENT') return { hostId: `urn:uuid:${randomUUID()}`, activo: null, registros: [] };
            throw inseguro();
        }
        try {
            const info = fs.fstatSync(descriptor);
            if (!info.isFile() || info.nlink !== 1 || info.uid !== uid() || (info.mode & 0o777) !== 0o600) throw inseguro();
            const datos = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
            if (!/^urn:uuid:[a-f0-9-]{36}$/.test(datos.hostId) || !Array.isArray(datos.registros) ||
                !datos.registros.every(({ clientId, sujeto }) => typeof clientId === 'string' && typeof sujeto === 'string') ||
                (datos.activo !== null && !datos.registros.some(({ clientId }) => clientId === datos.activo))) throw inseguro();
            return datos;
        } catch { throw inseguro(); } finally { fs.closeSync(descriptor); }
    }

    function guardar(datos) {
        const temporal = join(ruta, `.sesion-${randomUUID()}`);
        let creado = false;
        try {
            const descriptor = fs.openSync(temporal, 'wx', 0o600);
            creado = true;
            try {
                fs.writeFileSync(descriptor, JSON.stringify(datos), 'utf8');
                fs.fsyncSync(descriptor);
            } finally { fs.closeSync(descriptor); }
            fs.renameSync(temporal, archivo);
            creado = false;
            const directorio = fs.openSync(ruta, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
            try { fs.fsyncSync(directorio); } finally { fs.closeSync(directorio); }
        } catch {
            if (creado) fs.unlinkSync(temporal);
            throw errorDominio('almacen-no-disponible', 'No se pudo guardar la sesión de forma segura.');
        }
    }

    return { leer, guardar, cerrar: () => fs.unlinkSync(bloqueo) };
}

module.exports = { abrirAlmacen, errorDominio };

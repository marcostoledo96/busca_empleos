// Inicialización del SDK Firebase Admin.
//
// ¿Qué es Firebase Admin y por qué lo necesita el backend?
// El SDK del frontend (Angular) genera un JWT token cuando el usuario se loguea.
// Ese token dice "soy este usuario, firmado por Firebase".
// Pero cualquiera podría fabricar un token falso y mandarlo.
//
// Firebase Admin es la contraparte del servidor: verifica que el token
// fue firmado REALMENTE por Firebase (con la clave privada del proyecto).
// Sin esto, el backend no puede confiar en ningún token.
//
// Dos estrategias de configuración:
//
// Desarrollo local:
//   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
//   Se lee el JSON desde el archivo (gitignoreado).
//
// Producción (Railway, Render, etc.):
//   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":...}
//   El JSON completo va como variable de entorno (los PaaS no permiten subir archivos).
//   Para obtener el valor: Firebase Console → Configuración del proyecto →
//   Cuentas de servicio → Generar nueva clave privada → copiar el JSON completo.

const path = require('path');
const admin = require('firebase-admin');

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Estrategia de producción: el JSON viene completo como variable de entorno.
    // Railway y otros PaaS no permiten subir archivos sueltos al contenedor,
    // así que la forma estándar es pasar el JSON stringificado como env var.
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
        throw new Error(
            'FIREBASE_SERVICE_ACCOUNT_JSON tiene un formato JSON inválido. ' +
            'Verificá que el valor sea el JSON completo del service account sin escapado adicional.'
        );
    }
} else {
    // Estrategia de desarrollo: se lee desde el archivo local (gitignoreado).
    const rutaServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!rutaServiceAccount) {
        throw new Error(
            'Configurá FIREBASE_SERVICE_ACCOUNT_JSON (producción) o ' +
            'FIREBASE_SERVICE_ACCOUNT_PATH (desarrollo) en .env. ' +
            'El servidor no puede arrancar sin la configuración de Firebase Admin.'
        );
    }

    // Resolvemos la ruta relativa a la raíz del proyecto (backend/).
    // Usamos __dirname (backend/src/config/) + '../..' para llegar a backend/,
    // sin importar desde qué directorio se invoque el proceso.
    const rutaAbsoluta = path.resolve(__dirname, '../..', rutaServiceAccount);

    try {
        serviceAccount = require(rutaAbsoluta);
    } catch {
        throw new Error(
            `No se pudo leer el archivo del service account en: ${rutaAbsoluta}. ` +
            'Verificá que el archivo existe y que FIREBASE_SERVICE_ACCOUNT_PATH es correcta.'
        );
    }
}

// Inicializamos la app de Firebase Admin una sola vez.
// Si ya fue inicializada (ej: en tests con múltiples imports), no la reiniciamos.
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

// Exportamos el objeto auth para usarlo en el middleware de verificación.
module.exports = admin.auth();

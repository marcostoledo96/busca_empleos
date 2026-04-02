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
// ¿Por qué leer el service account desde un archivo en lugar de env vars?
// El JSON tiene ~13 campos incluyendo una private key RSA de 2KB.
// Meterlo todo en env vars sería engorroso y propenso a errores de parsing.
// El archivo gitignoreado es el enfoque estándar para uso local y de servidor.

const path = require('path');
const admin = require('firebase-admin');

// Ruta al JSON del service account — viene de la variable de entorno.
// Ej: "./firebase-service-account.json" (relativo a la raíz del backend)
const rutaServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!rutaServiceAccount) {
    throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_PATH no está definida en .env. ' +
        'El servidor no puede arrancar sin la configuración de Firebase Admin.'
    );
}

// Resolvemos la ruta relativa a la raíz del proyecto (backend/).
// Usamos __dirname (backend/src/config/) + '../..' para llegar a backend/,
// sin importar desde qué directorio se invoque el proceso.
// Esto es más robusto que process.cwd(), que depende del directorio de trabajo.
const rutaAbsoluta = path.resolve(__dirname, '../..', rutaServiceAccount);

let serviceAccount;
try {
    serviceAccount = require(rutaAbsoluta);
} catch {
    throw new Error(
        `No se pudo leer el archivo del service account en: ${rutaAbsoluta}. ` +
        'Verificá que el archivo existe y que FIREBASE_SERVICE_ACCOUNT_PATH es correcta.'
    );
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

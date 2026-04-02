// Middleware de autenticación — verifica el JWT de Firebase en cada request.
//
// ¿Cómo funciona el flujo completo?
// 1. Angular hace login con Google → Firebase devuelve un JWT token.
// 2. El interceptor HTTP de Angular adjunta ese token en el header:
//    Authorization: Bearer eyJhbGciOi...
// 3. Este middleware extrae el token, lo manda a Firebase Admin para verificar.
// 4. Firebase confirma que el token es válido y no fue alterado.
// 5. Además verificamos que el email sea el autorizado (solo vos podés entrar).
// 6. Si todo está bien, `next()` deja pasar al controlador de la ruta.
//
// Si algo falla → respondemos con el código HTTP apropiado y cortamos el request.

const firebaseAuth = require('../config/firebase-admin');

/**
 * Middleware que protege rutas verificando el JWT de Firebase.
 * Uso en app.js: `app.use('/api', verificarAuth, rutasX)`
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function verificarAuth(req, res, next) {
    // El preflight CORS (OPTIONS) no lleva token. Si lo bloqueo acá,
    // el navegador ni siquiera llega a enviar el request real.
    if (req.method === 'OPTIONS') {
        return next();
    }

    // Extraemos el token del header Authorization: "Bearer <token>"
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            exito: false,
            error: 'No autorizado. Se requiere un token de autenticación.',
        });
    }

    const token = authHeader.slice(7); // Removemos "Bearer " (7 caracteres)

    try {
        // verifyIdToken:
        // 1. Verifica la firma criptográfica del token (no fue alterado).
        // 2. Verifica que no expiró (los JWT de Firebase duran 1 hora).
        // 3. Verifica que pertenece a ESTE proyecto de Firebase.
        const tokenDecodificado = await firebaseAuth.verifyIdToken(token);

        // Capa extra de seguridad: aunque el token sea válido de Firebase,
        // solo aceptamos el email específico configurado en .env.
        // Si alguien más consigue un token Firebase de este proyecto, no entra.
        const emailAutorizado = process.env.EMAIL_AUTORIZADO;

        if (!emailAutorizado) {
            console.error('[AUTH] EMAIL_AUTORIZADO no está definido en .env');
            return res.status(500).json({
                exito: false,
                error: 'Error de configuración del servidor.',
            });
        }

        if (tokenDecodificado.email !== emailAutorizado) {
            return res.status(403).json({
                exito: false,
                error: 'Acceso denegado. Este sistema es de uso personal.',
            });
        }

        // Adjuntamos el usuario decodificado al request por si algún controlador
        // necesita saber quién está autenticado (uid, email, nombre, etc.).
        req.usuario = tokenDecodificado;

        next();
    } catch (err) {
        // Firebase Admin lanza errores específicos:
        // - auth/id-token-expired: el token venció (> 1 hora)
        // - auth/id-token-revoked: el usuario cerró sesión en todos los dispositivos
        // - auth/argument-error: el token está malformado
        const esTokenVencido = err.code === 'auth/id-token-expired';

        return res.status(401).json({
            exito: false,
            error: esTokenVencido
                ? 'El token expiró. Iniciá sesión nuevamente.'
                : 'Token de autenticación inválido.',
        });
    }
}

module.exports = { verificarAuth };

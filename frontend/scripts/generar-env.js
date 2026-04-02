/**
 * Script de pre-build para Vercel.
 * Lee las variables de entorno de Vercel y genera el archivo
 * `environment.prod.ts` antes de que Angular compile.
 *
 * Este script se ejecuta automáticamente con `npm run build` (via "prebuild").
 * Si no estamos en Vercel, el script se cancela sin hacer nada.
 */

const fs = require('fs');
const path = require('path');

// Solo ejecutar en el entorno de Vercel (detectado por la variable VERCEL=1)
if (!process.env.VERCEL) {
    console.log('ℹ  No estamos en Vercel — se omite la generación de environment.prod.ts.');
    process.exit(0);
}

const variablesRequeridas = [
    'API_URL',
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
];

const faltantes = variablesRequeridas.filter((v) => !process.env[v]);

if (faltantes.length > 0) {
    console.error('✗ Faltan variables de entorno en Vercel:');
    faltantes.forEach((v) => console.error(`  - ${v}`));
    console.error('  Configurarlas en: Vercel → tu proyecto → Settings → Environment Variables');
    process.exit(1);
}

const contenido = `// Archivo generado automáticamente por scripts/generar-env.js en el proceso de build.
// No editar manualmente. No commitear a git.
export const environment = {
    produccion: true,
    nodo: 'VERCEL',
    urlApi: '${process.env.API_URL}',
    firebaseConfig: {
        apiKey: '${process.env.FIREBASE_API_KEY}',
        authDomain: '${process.env.FIREBASE_AUTH_DOMAIN}',
        projectId: '${process.env.FIREBASE_PROJECT_ID}',
        storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET}',
        messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID}',
        appId: '${process.env.FIREBASE_APP_ID}'
    }
};
`;

const environmentsDir = path.join(__dirname, '../src/environments');
const targetFileProd = path.join(environmentsDir, 'environment.prod.ts');
const targetFileBase = path.join(environmentsDir, 'environment.ts');

if (!fs.existsSync(environmentsDir)) {
    fs.mkdirSync(environmentsDir, { recursive: true });
}

// Generamos ambos archivos con el mismo contenido para que las importaciones no fallen
fs.writeFileSync(targetFileProd, contenido, 'utf8');
fs.writeFileSync(targetFileBase, contenido, 'utf8');

console.log('✓ environment.prod.ts y environment.ts generados correctamente desde variables de entorno de Vercel.');

// Diagnóstico local de la integración InfoJobs.
//
// ¿Para qué sirve este script?
// -----------------------------
// Permite verificar LOCALMENTE si la API real de InfoJobs responde,
// qué shape devuelve y cuántos resultados trae — sin necesidad de deploy.
//
// Solo corre si existen INFOJOBS_CLIENT_ID e INFOJOBS_CLIENT_SECRET
// en el entorno o en el archivo .env del backend.
//
// ¿Cómo ejecutarlo?
//   cd backend
//   node scripts/diagnostico-infojobs.js
//
// O con un término de búsqueda específico:
//   TERMINO="angular junior" node scripts/diagnostico-infojobs.js
//
// ¿Qué muestra?
//   - Estado HTTP de la respuesta.
//   - Cantidad de ofertas devueltas.
//   - Shape clave del primer item (teleworking, title, link).
//   - Si el normalizador procesa el item correctamente.
//
// IMPORTANTE: Este script NO forma parte de `npm test`.
// Su propósito es el diagnóstico manual antes/después de deploy.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { normalizarLote } = require('../src/servicios/servicio-normalizacion');

// --- Configuración ---

const clientId = process.env.INFOJOBS_CLIENT_ID;
const clientSecret = process.env.INFOJOBS_CLIENT_SECRET;
const termino = process.env.TERMINO || 'frontend junior';
const maxResults = 3; // Pido pocos resultados para no gastar cuota.

// --- Verifico credenciales antes de continuar ---

if (!clientId || !clientSecret) {
    console.log('');
    console.log('⚠️  Diagnóstico InfoJobs: SALTADO (sin credenciales)');
    console.log('');
    console.log('Para ejecutar este diagnóstico necesitás definir en tu .env:');
    console.log('  INFOJOBS_CLIENT_ID=<tu client id>');
    console.log('  INFOJOBS_CLIENT_SECRET=<tu client secret>');
    console.log('');
    console.log('Si no tenés credenciales, podés solicitarlas en:');
    console.log('  https://developer.infojobs.net');
    console.log('');
    process.exit(0);
}

// --- Función principal de diagnóstico ---

async function ejecutarDiagnostico() {
    console.log('');
    console.log('=== Diagnóstico InfoJobs ===');
    console.log(`Término: "${termino}"`);
    console.log(`Max resultados: ${maxResults}`);
    console.log('');

    // Construyo el header de autenticación HTTP Basic.
    const credenciales = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const headers = {
        'Authorization': `Basic ${credenciales}`,
        'Content-Type': 'application/json',
    };

    // Construyo la URL con el filtro de remoto puro.
    const params = new URLSearchParams({
        q: termino,
        teleworking: 'solo-teletrabajo',
        maxResults: String(maxResults),
    });

    const url = `https://api.infojobs.net/api/9/offer?${params.toString()}`;

    console.log(`URL: ${url}`);
    console.log('');

    try {
        const respuesta = await fetch(url, { headers });

        console.log(`HTTP Status: ${respuesta.status} ${respuesta.statusText}`);
        console.log('');

        if (!respuesta.ok) {
            if (respuesta.status === 401) {
                console.error('❌ Credenciales inválidas. Verificá INFOJOBS_CLIENT_ID y INFOJOBS_CLIENT_SECRET.');
            } else if (respuesta.status === 403) {
                console.error('❌ Acceso denegado. Verificá que tu app tenga el scope correcto en InfoJobs Developer.');
            } else if (respuesta.status === 429) {
                console.error('❌ Rate limit excedido. Esperá unos minutos antes de volver a ejecutar.');
            } else {
                console.error(`❌ Error HTTP ${respuesta.status}. Revisá los logs de la API.`);
            }
            process.exit(1);
        }

        const json = await respuesta.json();

        // Verifico qué propiedad trae la respuesta (offers vs items).
        const tieneOffers = Array.isArray(json.offers);
        const tieneItems = Array.isArray(json.items);
        const ofertas = tieneOffers ? json.offers : (tieneItems ? json.items : []);

        console.log(`Shape de la respuesta:`);
        console.log(`  - Propiedad "offers": ${tieneOffers} (${tieneOffers ? json.offers.length : '—'} items)`);
        console.log(`  - Propiedad "items":  ${tieneItems} (${tieneItems ? json.items.length : '—'} items)`);
        console.log(`  - Total de ofertas en respuesta: ${ofertas.length}`);
        console.log('');

        if (ofertas.length === 0) {
            console.log('ℹ️  La API no devolvió resultados para este término con filtro remoto puro.');
            console.log('   Probá con otro término o verificá que haya ofertas disponibles.');
            process.exit(0);
        }

        // Muestro el shape del primer item para diagnóstico.
        const primerItem = ofertas[0];
        console.log('Shape clave del primer item:');
        console.log(`  title:        ${primerItem.title}`);
        console.log(`  link:         ${primerItem.link}`);
        console.log(`  teleworking:  ${JSON.stringify(primerItem.teleworking)}`);
        console.log(`  author.name:  ${primerItem.author?.name}`);
        console.log(`  city:         ${JSON.stringify(primerItem.city)}`);
        console.log(`  province:     ${JSON.stringify(primerItem.province)}`);
        console.log('');

        // Intento normalizar el primer item con el código real (vía normalizarLote).
        // normalizarLote() llama internamente a normalizarOfertaInfojobs().
        console.log('Resultado de normalizarLote() sobre el primer item:');
        try {
            const normalizadas = normalizarLote([primerItem], 'infojobs');
            if (normalizadas.length === 0) {
                console.log('  ⚠️  El normalizador descartó la oferta (no es remoto puro o le falta URL).');
                console.log('     Esto puede indicar que el filtro funcionó correctamente.');
            } else {
                const normalizada = normalizadas[0];
                console.log('  ✅ Normalización exitosa:');
                console.log(`     titulo:    ${normalizada.titulo}`);
                console.log(`     empresa:   ${normalizada.empresa}`);
                console.log(`     ubicacion: ${normalizada.ubicacion}`);
                console.log(`     modalidad: ${normalizada.modalidad}`);
                console.log(`     plataforma:${normalizada.plataforma}`);
                console.log(`     url:       ${normalizada.url}`);
            }
        } catch (errorNorm) {
            console.log(`  ❌ Error inesperado en normalización: ${errorNorm.message}`);
            console.log('     Esto puede indicar que el shape real de la API cambió.');
        }

        console.log('');
        console.log('=== Diagnóstico completado ===');
        console.log('');

    } catch (error) {
        console.error(`❌ Error de red: ${error.message}`);
        console.error('   Verificá tu conexión a internet.');
        process.exit(1);
    }
}

ejecutarDiagnostico();

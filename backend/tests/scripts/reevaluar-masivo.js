// Script para reevaluar de forma masiva TODAS las ofertas con el nuevo prompt.
// Ideal para usar luego de haber ajustado la lógica de la IA.
//
// ¿Cómo funciona?
// 1. Pone TODAS las ofertas de la tabla (incluso las ya evaluadas) en estado 'pendiente'.
// 2. Llama al servicio de evaluación, que va a procesar lote a lote todas
//    las ofertas que encuentre pendientes.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = require('pg');
const pool = new Pool();

// Importamos el servicio que tiene la lógica de llamar a la IA
const servicioEvaluacion = require('../../src/servicios/servicio-evaluacion');

async function reevaluarMasivo() {
    console.log('🔄 Iniciando script de reevaluación masiva...');

    try {
        console.log('📝 Paso 1: Reseteando todas las ofertas a estado "pendiente"...');
        // Vaciamos todas las evaluaciones anteriores
        const resultadoUpdate = await pool.query(`
            UPDATE ofertas 
            SET estado_evaluacion = 'pendiente', 
                razon_evaluacion = NULL, 
                porcentaje_match = NULL
        `);
        console.log(`   Se formatearon ${resultadoUpdate.rowCount} ofertas.`);

        console.log('🧠 Paso 2: Llamando a DeepSeek para evaluar (esto puede tardar varios minutos y consumir tokens de API)...');
        
        // Acá llamamos a la función principal que procesa todas las pendientes.
        // Va a usar el prompt de la base de datos + el perfil actualizado
        // que recién modificamos en el archivo servicio-evaluacion.js.
        const resumen = await servicioEvaluacion.evaluarOfertasPendientes();
        
        console.log('\n✅ Proceso completado exitosamente.');
        console.log('📊 Resumen de la re-evaluación:');
        console.log(`   - Aprobadas encontradas: ${resumen.aprobadas}`);
        console.log(`   - Rechazadas: ${resumen.rechazadas}`);
        console.log(`   - Errores de API: ${resumen.errores}`);

    } catch (error) {
        console.error('❌ Error durante la reevaluación masiva:', error.message);
    } finally {
        // Cerramos el pool sí o sí para que no quede el script colgado
        await pool.end();
    }
}

reevaluarMasivo();

// Script de exportación de ofertas a JSON.
// Vuelca TODAS las ofertas de la base de datos a un archivo en disco.
//
// Uso:
//   node backend/tests/scripts/exportar-ofertas.js
//
// Genera: backend/tests/scripts/ofertas-exportadas.json
// Ese archivo lo usa el agente de IA para analizar las evaluaciones.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool();

async function exportarOfertas() {
    console.log('Conectando a la base de datos...');

    const resultado = await pool.query(`
        SELECT
            id,
            titulo,
            empresa,
            ubicacion,
            modalidad,
            descripcion,
            url,
            plataforma,
            nivel_requerido,
            salario_min,
            salario_max,
            moneda,
            estado_evaluacion,
            razon_evaluacion,
            porcentaje_match,
            estado_postulacion,
            fecha_publicacion,
            fecha_extraccion
        FROM ofertas
        ORDER BY id ASC
    `);

    const total = resultado.rows.length;
    console.log(`Total de ofertas encontradas: ${total}`);

    const outputPath = path.resolve(__dirname, 'ofertas-exportadas.json');
    fs.writeFileSync(outputPath, JSON.stringify(resultado.rows, null, 2), 'utf-8');

    console.log(`Archivo generado en: ${outputPath}`);

    // Resumen por estado de evaluación para dar un pantallazo rápido.
    const resumen = resultado.rows.reduce((acc, oferta) => {
        const estado = oferta.estado_evaluacion || 'sin_estado';
        acc[estado] = (acc[estado] || 0) + 1;
        return acc;
    }, {});

    console.log('\nResumen por estado de evaluación:');
    for (const [estado, cantidad] of Object.entries(resumen)) {
        console.log(`  ${estado}: ${cantidad}`);
    }

    await pool.end();
}

exportarOfertas().catch((error) => {
    console.error('Error al exportar ofertas:', error.message);
    process.exit(1);
});

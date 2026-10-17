// Genero únicamente documentos sintéticos con offsets PDF calculados en bytes.
function crearPdf(paginas = ['Nombre: Persona Sintetica']) {
    const objetos = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${paginas.map((_, indice) => `${4 + indice * 2} 0 R`).join(' ')}] /Count ${paginas.length} >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    for (const [indice, texto] of paginas.entries()) {
        const lineas = texto.split('\n').map(linea => linea.replace(/([\\()])/g, '\\$1'));
        // Con 75 caracteres y 50 líneas, mantengo el texto dentro de la página a 12 puntos.
        const contenido = texto ? `BT /F1 12 Tf 14 TL 50 750 Td ${lineas.map(linea => `(${linea}) Tj T*`).join('\n')} ET` : '';
        objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + indice * 2} 0 R >>`);
        objetos.push(`<< /Length ${Buffer.byteLength(contenido)} >>\nstream\n${contenido}\nendstream`);
    }
    let documento = '%PDF-1.7\n';
    const offsets = [0];
    objetos.forEach((objeto, indice) => {
        offsets.push(Buffer.byteLength(documento));
        documento += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
    });
    const inicioTabla = Buffer.byteLength(documento);
    documento += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
    documento += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    documento += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${inicioTabla}\n%%EOF\n`;
    return Buffer.from(documento);
}

module.exports = { crearPdf };

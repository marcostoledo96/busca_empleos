// Comparto la política de idioma existente antes de persistir, sin cambiar matching ni deduplicación.
const { detectarIdioma } = require('./servicio-normalizacion');

function filtrarOfertasPorIdioma(ofertas) {
    return ofertas.filter(oferta => detectarIdioma(oferta.titulo, oferta.descripcion) !== 'en');
}

module.exports = { filtrarOfertasPorIdioma };

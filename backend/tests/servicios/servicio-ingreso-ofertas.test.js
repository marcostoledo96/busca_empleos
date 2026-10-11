const { filtrarOfertasPorIdioma } = require('../../src/servicios/servicio-ingreso-ofertas');
const { detectarIdioma } = require('../../src/servicios/servicio-normalizacion');

test('comparto detectarIdioma sin agregar exclusiones de matching al ingreso', () => {
    const ofertas = [
        { titulo: 'Soporte técnico', descripcion: 'Buscamos una persona para nuestro equipo. Las tareas incluyen la asistencia de los usuarios y la resolución de problemas.' },
        { titulo: 'Software engineer', descripcion: 'We are looking for a software engineer to join our team. You will work with our customers and you should have experience with the tools.' },
        { titulo: 'Desarrollador Java senior', descripcion: 'Buscamos un desarrollador para nuestro equipo de sistemas con experiencia en Java.' },
        { titulo: null, descripcion: null },
    ];
    const originales = JSON.stringify(ofertas);
    expect(filtrarOfertasPorIdioma(ofertas)).toEqual(ofertas.filter(oferta => detectarIdioma(oferta.titulo, oferta.descripcion) !== 'en'));
    expect(filtrarOfertasPorIdioma(ofertas)).toContain(ofertas[2]);
    expect(filtrarOfertasPorIdioma(ofertas)).not.toContain(ofertas[1]);
    expect(JSON.stringify(ofertas)).toBe(originales);
    expect(filtrarOfertasPorIdioma([])).toEqual([]);
});

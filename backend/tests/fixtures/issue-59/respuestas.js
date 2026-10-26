// Uso contratos crudos de cada API; el servicio y su normalizador permanecen reales.
function respuestas(ahora = Date.now()) {
    const fecha = new Date(ahora).toISOString();
    const descripcion = 'Buscamos desarrollador junior para nuestro equipo de trabajo en español. Ofrecemos capacitación y acompañamiento.';
    return {
        remotive: { id: 5901, title: 'Desarrollador Junior', company_name: 'Empresa sintética',
            url: 'https://remotive.com/remote-jobs/software-dev/5901', publication_date: fecha,
            candidate_required_location: 'Worldwide', description: descripcion },
        remoteok: { id: '5901', position: 'Desarrollador Junior', company: 'Empresa sintética',
            url: 'https://remoteok.com/remote-jobs/5901', date: fecha, tags: ['angular'], description: descripcion },
        jooble: { id: '5901', title: 'Desarrollador Junior', company: 'Empresa sintética',
            link: 'https://jooble.org/desc/5901', updated: fecha, location: 'Remote', snippet: descripcion },
        adzuna: { id: '5901', title: 'Desarrollador Junior remoto', company: { display_name: 'Empresa sintética' },
            redirect_url: 'https://www.adzuna.com/es/jobs/details/5901', created: fecha,
            location: { display_name: 'Madrid, España' }, description: `${descripcion} Trabajo 100% remoto.`,
            salary_min: 20000, salary_max: 30000 },
    };
}
module.exports = { respuestas };

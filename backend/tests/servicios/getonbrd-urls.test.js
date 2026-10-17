jest.mock('../../src/config/base-datos', () => ({ query: jest.fn() }));
const { _normalizarUrlGetonbrd: normalizarUrl } = require('../../src/servicios/servicio-scraping');

describe('Valido los enlaces públicos de GetOnBrd sin consultar la red', () => {
    test.each([
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'http://www.getonbrd.com/jobs/13',
        'https://attacker.example/jobs/13',
        'https://www.getonbrd.com.attacker.example/jobs/13',
        'https://otro.getonbrd.com/jobs/13',
        'https://www.getonbrd.com.ar/jobs/13',
        'https://api-doc.getonbrd.com/jobs/13',
        'https://sandbox.getonbrd.dev/jobs/13',
        'https://fixture.getonbrd.test/jobs/13',
        'https://usuario:clave@www.getonbrd.com/jobs/13',
        'https://usuario@www.getonbrd.com/jobs/13',
        'https://www.getonbrd.com:444/jobs/13',
        '/jobs/13',
        'no es una URL',
    ])('descarto el enlace no permitido %s', url => {
        expect(normalizarUrl(url)).toBeNull();
    });

    test.each([
        ['https://www.getonbrd.com/jobs/13', 'https://www.getonbrd.com/jobs/13'],
        ['https://www.getonbrd.com/jobs/13/#detalle', 'https://www.getonbrd.com/jobs/13'],
        ['https://www.getonbrd.com:443/jobs/13/?ref=busqueda#detalle', 'https://www.getonbrd.com/jobs/13?ref=busqueda'],
    ])('conservo la identidad canónica del enlace HTTPS permitido %s', (url, esperada) => {
        expect(normalizarUrl(url)).toBe(esperada);
    });
});

const { decodificarCvBase } = require('../../src/utils/validacion-cv-base');

test.each(['', '\uFEFF# Sintético\r\n\t ñ 😀  ', '\uFFFD'])('conservo texto UTF-8 válido exactamente', texto => {
    expect(decodificarCvBase(Buffer.from(texto))).toBe(texto);
});

test.each([[0xff], [0xc0, 0xaf], [0xed, 0xa0, 0x80], [0xf0, 0x9f], [0x00]])('rechazo bytes inválidos o NUL sin reemplazo', bytes => {
    expect(() => decodificarCvBase(Buffer.from(bytes))).toThrow();
});

test('cuento bytes, no caracteres', () => {
    expect(decodificarCvBase(Buffer.from('😀'.repeat(262144))).length).toBe(524288);
    expect(() => decodificarCvBase(Buffer.from(`${'😀'.repeat(262144)}a`))).toThrow('1048576');
});

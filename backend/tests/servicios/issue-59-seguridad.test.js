const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Cargo el guard explícitamente en otro proceso: no dependo del entorno de Jest ni altero sus sockets.
test('issue59: bloqueo archivos privados y sockets externos antes del transporte', () => {
    const resultado = spawnSync(process.execPath, ['--require', path.resolve(__dirname, '../helpers/issue-59-seguridad.js'), '-e', `
        const assert = require('node:assert/strict');
        const fs = require('node:fs');
        const net = require('node:net');
        assert.throws(() => fs.readFileSync('/issue59-inexistente/.env'), /Bloqueé la lectura de variables privadas en issue59/);
        const socket = new net.Socket();
        try {
            assert.throws(() => socket.connect({ host: '192.0.2.1', port: 443 }), /Bloqueé un destino de red no autorizado en issue59/);
            assert.equal(socket.connecting, false);
        } finally { socket.destroy(); }
        console.log('Guard issue59: archivos privados y red externa bloqueados.');
    `], { env: { NODE_ENV: 'test' }, encoding: 'utf8', timeout: 10000 });
    expect(resultado.error).toBeUndefined();
    expect(resultado.status).toBe(0);
    expect(resultado.stdout).toBe('Guard issue59: archivos privados y red externa bloqueados.\n');
    expect(resultado.stderr).toBe('');
});

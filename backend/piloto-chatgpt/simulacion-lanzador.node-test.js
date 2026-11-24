const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { existsSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

function preparar(t) {
    const directorio = mkdtempSync(join(tmpdir(), 'piloto-lanzador-'));
    t.after(() => rmSync(directorio, { recursive: true, force: true }));
    const marcaBwrap = join(directorio, 'bwrap-ejecutado');
    const marcaNode = join(directorio, 'node-ejecutado');
    writeFileSync(join(directorio, 'bwrap'), `#!/bin/sh\n: > "$MARCA_BWRAP"\nexit 47\n`, { mode: 0o700 });
    writeFileSync(join(directorio, 'node'), `#!/bin/sh\n: > "$MARCA_NODE"\nexit 0\n`, { mode: 0o700 });
    return {
        marcaBwrap,
        marcaNode,
        ejecutar: (...args) => spawnSync('/bin/sh', [join(__dirname, 'simulacion.sh'), ...args], {
            encoding: 'utf8',
            env: { PATH: `${directorio}:/usr/bin:/bin`, MARCA_BWRAP: marcaBwrap, MARCA_NODE: marcaNode },
        }),
    };
}

test('el lanzador no ejecuta Node fuera del sandbox si bwrap falla', t => {
    const { ejecutar, marcaBwrap, marcaNode } = preparar(t);
    const resultado = ejecutar();
    assert.equal(resultado.status, 47);
    assert.equal(resultado.stdout, '');
    assert.equal(resultado.stderr, '');
    assert.equal(existsSync(marcaBwrap), true);
    assert.equal(existsSync(marcaNode), false);
});

test('el lanzador rechaza argumentos antes de ejecutar bwrap o Node', t => {
    const { ejecutar, marcaBwrap, marcaNode } = preparar(t);
    const resultado = ejecutar('--real');
    assert.equal(resultado.status, 2);
    assert.equal(resultado.stdout, '');
    assert.equal(resultado.stderr, 'Uso: sh backend/piloto-chatgpt/simulacion.sh\n');
    assert.equal(existsSync(marcaBwrap), false);
    assert.equal(existsSync(marcaNode), false);
});

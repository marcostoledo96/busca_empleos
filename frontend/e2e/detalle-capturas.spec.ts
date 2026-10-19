import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, copyFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { abrirDetallePrincipal, comprobarGeometriaDetalle } from './detalle-pagina';

// La suite ordinaria nunca pisa el ANTES: esa captura requiere autorización explícita por entorno.
const fase = process.env['EVIDENCIA50'] || 'despues';
if (fase !== 'despues') throw new Error('Sólo genero DESPUÉS: preservo ANTES y el histórico ya capturados.');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const candidato = `${head}:${createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--', 'frontend/src', 'frontend/e2e'], { encoding: 'utf8', cwd: resolve(__dirname, '../..') }))
    .update(readFileSync(resolve(__dirname, 'detalle-ui.spec.ts'))).digest('hex')}`;
const destino = resolve(__dirname, '../.angular/issue51-historico/detalle', fase);
const documentadas = resolve(__dirname, '../../docs/evidencias/issue-51/B01/detalle', fase);
const escenarios = ['aprobada', 'rechazada', 'pendiente', 'error', 'reevaluacion-fallida', 'desactualizada', 'historica', 'postulada', 'textos-largos'];
const representantes = new Set([
    'aprobada-1440x900-claro', 'aprobada-1440x900-oscuro',
    'aprobada-390x844-claro', 'rechazada-320x844-claro',
]);
const matriz: Record<string, unknown>[] = [];
const tamanos = [
    { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 900 },
    { width: 390, height: 844 }, { width: 320, height: 844 },
];

test.beforeEach(async ({ context, page }) => {
    await context.route('**/*', ruta => new URL(ruta.request().url()).origin === 'http://127.0.0.1:4350'
        ? ruta.continue() : ruta.abort());
    await page.clock.setFixedTime(new Date('2026-01-15T18:00:00.000Z'));
});

test.afterAll(() => {
    mkdirSync(documentadas, { recursive: true });
    const archivo = resolve(documentadas, 'matriz.json');
    const anterior = existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : null;
    const mismoCandidato = anterior?.candidato === candidato;
    const clave = (fila: Record<string, any>) => `${fila.escenario}/${fila.tema}/${fila.viewport.width}x${fila.viewport.height}`;
    const fusionadas = new Map<string, Record<string, unknown>>();
    if (mismoCandidato) for (const fila of anterior.casos) fusionadas.set(clave(fila), fila);
    for (const fila of matriz) fusionadas.set(clave(fila), fila);
    // Conservo evidencia previa sin contar candidatos distintos como éxitos de esta revisión.
    const ejecucionesAnteriores = mismoCandidato ? anterior.ejecucionesAnteriores || []
        : anterior ? [...(anterior.ejecucionesAnteriores || []), { ...anterior, ejecucionesAnteriores: undefined }] : [];
    writeFileSync(archivo, JSON.stringify({
        fase, head, candidato, fixture: 'detalle-fixture-v1', reloj: '2026-01-15T18:00:00.000Z',
        casosEsperados: escenarios.length * 2 * tamanos.length,
        casosCapturados: [...fusionadas.values()].filter(fila => fila['validado'] === true).length,
        casos: [...fusionadas.values()], ejecucionesAnteriores,
    }) + '\n');
});

for (const escenario of escenarios) {
    for (const tema of ['claro', 'oscuro']) {
        for (const viewport of tamanos) {
            test(`captura ${fase} ${escenario} ${tema} ${viewport.width} @detalle-captura`, async ({ page }, testInfo) => {
                const fila: Record<string, unknown> = { escenario, ofertaId: 501, tema, viewport, head, candidato, validado: false };
                matriz.push(fila);
                await page.setViewportSize(viewport);
                const url = `/?detalle=${escenario}&tema=${tema}`;
                await page.goto(url);
                const dialogo = await abrirDetallePrincipal(page, escenario);
                await page.evaluate(() => document.fonts.ready);
                mkdirSync(destino, { recursive: true });
                const nombre = `${escenario}-${viewport.width}x${viewport.height}-${tema}`;
                await page.screenshot({ path: resolve(destino, `${nombre}.png`), animations: 'disabled' });
                await testInfo.attach(nombre, { path: resolve(destino, `${nombre}.png`), contentType: 'image/png' });
                expect(testInfo.attachments).toContainEqual(expect.objectContaining({ name: nombre, contentType: 'image/png', path: expect.stringContaining(testInfo.outputDir) }));
                const tieneScore = ['aprobada', 'rechazada', 'reevaluacion-fallida', 'historica', 'postulada', 'textos-largos'].includes(escenario);
                await expect(dialogo.locator('.tag-match')).toHaveCount(tieneScore ? 1 : 0);
                const medidas = await comprobarGeometriaDetalle(dialogo, page, true);
                const representante = representantes.has(nombre);
                if (representante) {
                    mkdirSync(documentadas, { recursive: true });
                    copyFileSync(resolve(destino, `${nombre}.png`), resolve(documentadas, `${nombre}.png`));
                }
                Object.assign(fila, { url, validado: true,
                    capturaLocal: `frontend/.angular/issue51-historico/detalle/${fase}/${nombre}.png`,
                    capturaDocumentada: representante ? `${nombre}.png` : null, medidas });
                console.log(JSON.stringify({ fase, head, escenario, tema, viewport, captura: `${nombre}.png` }));
            });
        }
    }
}

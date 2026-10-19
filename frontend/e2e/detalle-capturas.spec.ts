import { test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { abrirDetallePrincipal } from './detalle-pagina';

// La suite ordinaria nunca pisa el ANTES: esa captura requiere autorización explícita por entorno.
const fase = process.env['EVIDENCIA50'] || 'despues';
if (!['antes', 'despues'].includes(fase)) throw new Error('EVIDENCIA50 debe ser antes o despues; no implementé un render histórico.');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const destino = resolve(__dirname, '../.angular/evidencia-50', fase);
const documentadas = resolve(__dirname, '../../docs/evidencias/issue-50', fase);
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
    writeFileSync(resolve(documentadas, 'matriz.json'), JSON.stringify({
        fase, head, fixture: 'detalle-fixture-v1', reloj: '2026-01-15T18:00:00.000Z',
        casosEsperados: escenarios.length * 2 * tamanos.length, casosCapturados: matriz.length, casos: matriz,
    }) + '\n');
});

for (const escenario of escenarios) {
    for (const tema of ['claro', 'oscuro']) {
        for (const viewport of tamanos) {
            test(`captura ${fase} ${escenario} ${tema} ${viewport.width} @detalle-captura`, async ({ page }) => {
                await page.setViewportSize(viewport);
                const url = `/?detalle=${escenario}&tema=${tema}`;
                await page.goto(url);
                const dialogo = await abrirDetallePrincipal(page, escenario);
                await page.evaluate(() => document.fonts.ready);
                mkdirSync(destino, { recursive: true });
                const nombre = `${escenario}-${viewport.width}x${viewport.height}-${tema}`;
                await page.screenshot({ path: resolve(destino, `${nombre}.png`), animations: 'disabled' });
                // Registro, no corrijo ni oculto defectos del ANTES; la matriz DESPUÉS agrega assertions en T3.
                const medidas = await dialogo.evaluate(elemento => ({
                    dialogo: elemento.getBoundingClientRect().toJSON(),
                    overflowPagina: document.documentElement.scrollWidth > innerWidth,
                    overflowDialogo: elemento.scrollWidth > elemento.clientWidth,
                    contenido: Array.from(elemento.querySelectorAll('.p-dialog-content'), item => ({
                        altoVisible: item.clientHeight, altoTotal: item.scrollHeight,
                        anchoVisible: item.clientWidth, anchoTotal: item.scrollWidth,
                    })),
                }));
                const representante = representantes.has(nombre);
                if (representante) {
                    mkdirSync(documentadas, { recursive: true });
                    copyFileSync(resolve(destino, `${nombre}.png`), resolve(documentadas, `${nombre}.png`));
                }
                matriz.push({ escenario, ofertaId: 501, tema, viewport, url,
                    capturaLocal: `frontend/.angular/evidencia-50/${fase}/${nombre}.png`,
                    capturaDocumentada: representante ? `${nombre}.png` : null, medidas });
                console.log(JSON.stringify({ fase, head, escenario, tema, viewport, captura: `${nombre}.png` }));
            });
        }
    }
}

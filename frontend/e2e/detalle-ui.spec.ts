import { test, expect, Page, Locator } from '@playwright/test';
import { abrirDetallePrincipal, comprobarGeometriaDetalle } from './detalle-pagina';

const titulo = 'Frontend Angular junior · oferta sintética';
const segundo = 'Segunda oferta sintética para comprobar borradores independientes';
const nota = (dialogo: Locator) => dialogo.getByLabel('Nota de seguimiento', { exact: true });
const fecha = (dialogo: Locator) => dialogo.getByLabel('Fecha de envío, si se conoce');
const guardar = (dialogo: Locator) => dialogo.getByRole('button', { name: 'Guardar seguimiento', exact: true });
const cerrar = (dialogo: Locator) => dialogo.getByRole('button', { name: 'Cerrar detalle de oferta', exact: true });
const editor = (dialogo: Locator) => dialogo.getByRole('textbox', { name: 'Editor de descripción de la oferta' });
const guardarDescripcion = (dialogo: Locator) => dialogo.getByRole('button', { name: 'Guardar descripción', exact: true });
const registro = (page: Page) => page.getByLabel('Llamadas simuladas');
const escrituras = async (page: Page) => ((await registro(page).textContent()) || '').split('\n').filter(linea => /^(POST|PATCH) /.test(linea));

async function iniciar(page: Page, escenario = 'aprobada', parametros = '') {
    await page.goto(`/?detalle=${escenario}${parametros}`);
    await page.getByText('Registro del fixture', { exact: true }).click();
    return abrirDetallePrincipal(page, escenario);
}

async function abrirSegunda(page: Page) {
    await page.getByRole('tab', { name: /APROBADAS/ }).click();
    await page.getByRole('button', { name: `Ver detalle de ${segundo}`, exact: true }).click();
    return page.getByRole('dialog');
}

async function desplegarPorTeclado(dialogo: Locator, texto: string) {
    const resumen = dialogo.locator('summary').filter({ hasText: texto });
    await resumen.focus();
    await resumen.press('Enter');
    await expect(resumen.locator('..')).toHaveAttribute('open', '');
    return resumen;
}

test.beforeEach(async ({ context, page }) => {
    await context.route('**/*', ruta => new URL(ruta.request().url()).origin === 'http://127.0.0.1:4350'
        ? ruta.continue() : ruta.abort());
    await page.clock.setFixedTime(new Date('2026-01-15T18:00:00.000Z'));
});

test('foco de descripción: el inicio pendiente respeta el teclado sin abrir otra pestaña @detalle-ui', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-01-15T18:00:00.000Z') });
    await page.goto('/?detalle=aprobada');
    await page.getByText('Registro del fixture', { exact: true }).click();
    await page.clock.pauseAt(new Date('2026-01-15T18:01:00.000Z'));
    const dialogo = await abrirDetallePrincipal(page, 'aprobada');
    const resumen = dialogo.locator('summary').filter({ hasText: 'Leer descripción completa' });
    await resumen.focus();
    await expect(resumen).toBeFocused();
    await page.clock.runFor(100);
    await expect.soft(resumen).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.soft(resumen.locator('..')).toHaveAttribute('open', '');
    expect(page.context().pages()).toHaveLength(1);
    expect(await escrituras(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(page.getByRole('button', { name: `Ver detalle de ${titulo}`, exact: true })).toBeFocused();
});

test('cabecera inicial, enlace seguro único y cierre con retorno de foco @detalle-ui', async ({ page }) => {
    const dialogo = await iniciar(page);
    await expect(dialogo.getByRole('heading', { name: titulo, exact: true })).toBeVisible();
    for (const [icono, texto] of [['business', 'Laboratorio sintético del Sur'],
        ['location_on', 'Buenos Aires, Argentina'], ['computer', 'Híbrido']]) {
        const metadato = dialogo.locator('.detalle-meta .meta-item').filter({ hasText: texto });
        await expect(metadato).toHaveCount(1);
        await expect(metadato).toHaveText(new RegExp(`^\\s*${icono}\\s*${texto}\\s*$`));
        await expect(metadato).toBeVisible();
    }
    await expect(dialogo.getByText('APROBADA', { exact: true })).toBeVisible();
    await expect(dialogo.getByText('Compatibilidad estimada: 84%', { exact: true })).toHaveCount(1);
    const enlace = dialogo.getByRole('link', { name: 'Abrir oferta en página original' });
    await expect(enlace).toHaveCount(1);
    await expect(enlace).toHaveAttribute('href', 'https://example.invalid/ofertas/501');
    await expect(enlace).toHaveAttribute('target', '_blank');
    await expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(enlace).toBeFocused();
    await expect(dialogo.locator('.p-dialog-content')).toHaveJSProperty('scrollTop', 0);
    for (let paso = 0; paso < 8; paso++) {
        await page.keyboard.press('Tab');
        await expect.poll(() => dialogo.evaluate(elemento => elemento.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    const disparador = page.getByRole('button', { name: `Ver detalle de ${titulo}`, exact: true });
    await expect(disparador).toBeFocused();
    await abrirDetallePrincipal(page, 'aprobada');
    await cerrar(dialogo).click();
    await expect(dialogo).toBeHidden();
    await expect(disparador).toBeFocused();
    expect(await escrituras(page)).toEqual([]);
    expect(page.context().pages()).toHaveLength(1);
});

test('exclusión crítica visible y evidencia completa operable por teclado @detalle-ui', async ({ page }) => {
    const dialogo = await iniciar(page, 'rechazada');
    const plegable = dialogo.locator('.seccion-matching details');
    await expect(plegable).toHaveCount(1);
    await expect(plegable).not.toHaveAttribute('open', '');
    await expect(dialogo.getByRole('alert')).toContainText('Java obligatorio');
    await expect(dialogo.getByRole('alert')).toBeVisible();
    await expect(dialogo.getByRole('alert').locator('xpath=ancestor::details')).toHaveCount(0);
    await expect(dialogo.getByText('Desarrollo de interfaces Angular y TypeScript.', { exact: false })).toBeHidden();
    const resumen = await desplegarPorTeclado(dialogo, 'Ver desglose y evidencias del matching');
    for (const texto of ['A favor del match (1)', 'En contra del match', 'Por confirmar (1)',
        'Desarrollo de interfaces Angular y TypeScript.', 'Proyecto sintético con componentes y formularios Angular.',
        'Valoramos Docker, sin carácter excluyente.', 'No declaro experiencia con Docker.',
        'Horario a acordar con el equipo.', 'Disponibilidad no confirmada.',
        'Java es requisito obligatorio para el puesto.', 'No declaro Java; lo excluyo explícitamente.']) {
        await expect(plegable.getByText(texto, { exact: false })).toBeVisible();
    }
    await resumen.press('Space');
    await expect(plegable).not.toHaveAttribute('open', '');
    await expect(dialogo.getByRole('alert')).toBeVisible();
    await cerrar(dialogo).click();
    expect(await escrituras(page)).toEqual([]);
});

for (const [escenario, mensaje, score] of [
    ['pendiente', 'Evaluación desactualizada — pendiente de reevaluación', false],
    ['error', 'Evaluación no completada (fallo técnico)', false],
    ['reevaluacion-fallida', 'Se conserva la evaluación anterior válida.', true],
    ['desactualizada', 'Evaluación desactualizada — pendiente de reevaluación', false],
    ['historica', 'Esta evaluación histórica no cuenta con desglose estructurado detallado.', true],
] as const) {
    test(`estado ${escenario}: aviso único sin confundir rechazo @detalle-ui`, async ({ page }) => {
        const dialogo = await iniciar(page, escenario);
        await expect(dialogo.getByText(mensaje, { exact: false })).toHaveCount(1);
        await expect(dialogo.getByText(mensaje, { exact: false })).toBeVisible();
        await expect(dialogo.locator('.tag-match')).toHaveCount(score ? 1 : 0);
        await expect(dialogo.locator('.tag-detalle[data-estado="rechazada"]')).toHaveCount(0);
        if (escenario === 'error') await expect(dialogo.getByText('ERROR TÉCNICO', { exact: true })).toBeVisible();
        if (escenario === 'reevaluacion-fallida') await expect(dialogo).not.toContainText('Evaluación desactualizada');
        if (escenario === 'historica') await expect(dialogo.locator('summary', { hasText: 'Ver desglose' })).toHaveCount(0);
        await cerrar(dialogo).click();
        expect(await escrituras(page)).toEqual([]);
    });
}

for (const [escenario, requisito, razon] of [
    ['confirmacion', 'Residencia en provincia Delta', 'Pendiente de confirmación: Residencia en provincia Delta. Afinidad técnica estimada: 91%.'],
    ['sin-descripcion', 'Descripción de la oferta', 'Pendiente de confirmación: falta la descripción de la oferta.'],
]) {
    test(`#80 ${escenario}: confirmación actual sin falso error o evaluación anterior @issue80`, async ({ page }) => {
        await page.goto(`/?detalle=${escenario}`);
        await page.getByText('Registro del fixture', { exact: true }).click();
        await page.getByRole('tab', { name: /PENDIENTES/ }).click();
        const dialogo = await abrirDetallePrincipal(page, 'pendiente');
        await expect(dialogo.getByText('Elegibilidad pendiente de confirmación', { exact: true })).toBeVisible();
        await expect(dialogo.locator('.detalle-razon')).toContainText(razon);
        await expect(dialogo).not.toContainText('Motivo de la evaluación anterior');
        await expect(dialogo).not.toContainText('Evaluación desactualizada');
        await expect(dialogo.locator('.tag-detalle[data-estado="error"]')).toHaveCount(0);
        await expect(dialogo.locator('.tag-detalle[data-estado="pendiente"]')).toHaveText('PENDIENTE');
        await expect(dialogo.locator('.tag-match')).toHaveCount(0);
        await desplegarPorTeclado(dialogo, 'Ver desglose y evidencias del matching');
        const pendientes = dialogo.locator('.desglose-por-confirmar');
        await expect(pendientes).toContainText(requisito);
        await expect(pendientes).toBeVisible();
        await cerrar(dialogo).click();
        expect(await escrituras(page)).toEqual([]);
    });
}

for (const falla of [false, true]) {
    test(`selector overlay: ${falla ? 'rollback HTTP' : 'estado confirmado'} independiente del matching @detalle-ui`, async ({ page }) => {
        const dialogo = await iniciar(page, 'aprobada', falla ? '&errorDetalle=postulacion' : '');
        const selector = dialogo.getByRole('combobox', { name: 'Estado manual actual' });
        await selector.focus();
        await selector.press('Space');
        await expect(page.getByRole('option', { name: 'CV enviado', exact: true })).toBeVisible();
        await page.getByRole('option', { name: 'CV enviado', exact: true }).click();
        await expect(dialogo).toBeHidden();
        await expect(page.getByText(falla ? 'Postulación no guardada' : 'Postulación guardada', { exact: true })).toBeVisible();
        await page.getByRole('tab', { name: falla ? /APROBADAS/ : /POSTULADAS/ }).click();
        await page.getByRole('button', { name: `Ver detalle de ${titulo}`, exact: true }).click();
        await expect(dialogo).toBeVisible();
        await expect(selector).toContainText(falla ? 'No postulado' : 'CV enviado');
        await expect(dialogo.getByText('APROBADA', { exact: true })).toBeVisible();
        await expect(dialogo.getByText('Compatibilidad estimada: 84%', { exact: true })).toBeVisible();
        await cerrar(dialogo).click();
        expect(await escrituras(page)).toEqual(['PATCH /ofertas/501/postulacion']);
    });
}

test('fecha y nota: guardado explícito, carga, éxito y persistencia por interfaz @detalle-ui', async ({ page }) => {
    const dialogo = await iniciar(page, 'aprobada', '&demoraDetalle=900');
    await fecha(dialogo).fill('2026-01-14');
    await nota(dialogo).fill('Seguimiento sintético confirmado');
    expect(await escrituras(page)).toEqual([]);
    await guardar(dialogo).click();
    await expect(dialogo.getByText('Guardando seguimiento…', { exact: true })).toBeVisible();
    await expect(guardar(dialogo)).toBeDisabled();
    await expect(dialogo.getByText('Seguimiento guardado.', { exact: true })).toBeVisible();
    await cerrar(dialogo).click();
    await abrirDetallePrincipal(page, 'aprobada');
    await expect(fecha(dialogo)).toHaveValue('2026-01-14');
    await expect(nota(dialogo)).toHaveValue('Seguimiento sintético confirmado');
    await cerrar(dialogo).click();
    expect(await escrituras(page)).toEqual(['PATCH /ofertas/501/seguimiento']);
});

for (const error of ['seguimiento', 'validacion-seguimiento']) {
    test(`seguimiento ${error}: error accesible conserva borrador y otra oferta @detalle-ui`, async ({ page }) => {
        const dialogo = await iniciar(page, 'aprobada', `&errorDetalle=${error}`);
        await fecha(dialogo).fill('2026-01-14');
        await nota(dialogo).fill('Borrador que no debo perder');
        await guardar(dialogo).click();
        await expect(dialogo.getByRole('alert')).toHaveText('No pude guardar el seguimiento. Conservé el borrador; intentá nuevamente.');
        await expect(guardar(dialogo)).toBeEnabled();
        await cerrar(dialogo).click();
        await abrirSegunda(page);
        await expect(nota(dialogo)).toHaveValue('');
        await expect(fecha(dialogo)).toHaveValue('');
        await nota(dialogo).fill('Borrador independiente 502');
        await cerrar(dialogo).click();
        await abrirDetallePrincipal(page, 'aprobada');
        await expect(nota(dialogo)).toHaveValue('Borrador que no debo perder');
        await expect(fecha(dialogo)).toHaveValue('2026-01-14');
        await cerrar(dialogo).click();
        await abrirSegunda(page);
        await expect(nota(dialogo)).toHaveValue('Borrador independiente 502');
        await cerrar(dialogo).click();
        expect(await escrituras(page)).toEqual(['PATCH /ofertas/501/seguimiento']);
    });
}

test('nota Unicode: límite 4000 y rechazo local de 4001 sin escritura @detalle-ui', async ({ page }) => {
    const dialogo = await iniciar(page);
    await nota(dialogo).fill('🙂'.repeat(4001));
    await expect(dialogo.getByText('4001 / 4000 caracteres Unicode. Vacío elimina la nota.', { exact: true })).toBeVisible();
    await expect(guardar(dialogo)).toBeDisabled();
    expect(await escrituras(page)).toEqual([]);
    await nota(dialogo).fill('🙂'.repeat(4000));
    await expect(guardar(dialogo)).toBeEnabled();
    await guardar(dialogo).click();
    await expect(dialogo.getByText('Seguimiento guardado.', { exact: true })).toBeVisible();
    await expect(nota(dialogo)).toHaveValue('🙂'.repeat(4000));
    await cerrar(dialogo).click();
    expect(await escrituras(page)).toEqual(['PATCH /ofertas/501/seguimiento']);
});

test('revisión asíncrona: escribir y cambiar de oferta durante guardado no pierde borradores @detalle-ui', async ({ page }) => {
    const dialogo = await iniciar(page, 'aprobada', '&demoraDetalle=900,50');
    await nota(dialogo).fill('Primera revisión enviada');
    await guardar(dialogo).click();
    await expect(guardar(dialogo)).toBeDisabled();
    await nota(dialogo).fill('Segunda revisión sin guardar');
    await cerrar(dialogo).click();
    await abrirSegunda(page);
    await nota(dialogo).fill('Nota propia de la segunda oferta');
    await cerrar(dialogo).click();
    await abrirDetallePrincipal(page, 'aprobada');
    await expect(guardar(dialogo)).toBeEnabled();
    await expect(nota(dialogo)).toHaveValue('Segunda revisión sin guardar');
    await expect(dialogo.getByText('Seguimiento guardado.', { exact: true })).toHaveCount(0);
    await guardar(dialogo).click();
    await expect(dialogo.getByText('Seguimiento guardado.', { exact: true })).toBeVisible();
    await cerrar(dialogo).click();
    await abrirSegunda(page);
    await expect(nota(dialogo)).toHaveValue('Nota propia de la segunda oferta');
    await cerrar(dialogo).click();
    expect(await escrituras(page)).toEqual(['PATCH /ofertas/501/seguimiento', 'PATCH /ofertas/501/seguimiento']);
});

test('descripción: expandir, cancelar, límites y guardar sin reevaluación automática @detalle-ui', async ({ page }) => {
    const dialogo = await iniciar(page, 'aprobada', '&demoraDetalle=900');
    await desplegarPorTeclado(dialogo, 'Leer descripción completa');
    const original = await dialogo.locator('.detalle-descripcion').innerText();
    await expect(dialogo.getByLabel('Descripción completa', { exact: true })).toBeVisible();
    await dialogo.getByRole('button', { name: 'Completar o editar descripción' }).click();
    await editor(dialogo).fill('No guardar esta edición sintética');
    await dialogo.getByRole('button', { name: 'Cancelar edición de descripción' }).click();
    await desplegarPorTeclado(dialogo, 'Leer descripción completa');
    await expect(dialogo.locator('.detalle-descripcion')).toHaveText(original);
    expect(await escrituras(page)).toEqual([]);
    await dialogo.getByRole('button', { name: 'Completar o editar descripción' }).click();
    for (const texto of ['', 'x'.repeat(19), 'x'.repeat(50001)]) {
        await editor(dialogo).fill(texto);
        await expect(guardarDescripcion(dialogo)).toBeDisabled();
    }
    for (const texto of ['x'.repeat(20), 'x'.repeat(50000)]) {
        await editor(dialogo).fill(texto);
        await expect(guardarDescripcion(dialogo)).toBeEnabled();
    }
    const nueva = 'Descripción manual sintética válida. '.repeat(100);
    await editor(dialogo).fill(nueva);
    await guardarDescripcion(dialogo).click();
    await expect(editor(dialogo)).toBeDisabled();
    await expect(guardarDescripcion(dialogo)).toContainText('Guardando...');
    await expect(editor(dialogo)).toHaveCount(0);
    await expect(dialogo.getByLabel('Descripción completada manualmente', { exact: true })).toBeVisible();
    await expect(dialogo.locator('.tag-match')).toHaveCount(0);
    await desplegarPorTeclado(dialogo, 'Leer descripción completa');
    await expect(dialogo.locator('.detalle-descripcion')).toHaveText(nueva.trim());
    await desplegarPorTeclado(dialogo, 'Datos del aviso y fechas');
    for (const texto of ['Primera detección:', 'Última detección:', 'Publicada (aprox):', 'Descripción modificada:']) {
        await expect(dialogo.getByText(texto, { exact: false })).toBeVisible();
    }
    await cerrar(dialogo).click();
    expect(await escrituras(page)).toEqual(['PATCH /ofertas/501/descripcion']);
    await abrirDetallePrincipal(page, 'pendiente');
    await dialogo.getByRole('button', { name: 'Reevaluar oferta', exact: true }).click();
    await expect(dialogo.getByRole('button', { name: 'Reevaluar oferta', exact: true })).toBeDisabled();
    await expect(dialogo.getByText('Reevaluación solicitada correctamente', { exact: true })).toBeVisible();
    await cerrar(dialogo).click();
    expect(await escrituras(page)).toEqual(['PATCH /ofertas/501/descripcion', 'POST /evaluacion/ejecutar']);
});

for (const error of ['descripcion', 'validacion-descripcion']) {
    test(`descripción ${error}: conserva texto original y edición recuperable @detalle-ui`, async ({ page }) => {
        const dialogo = await iniciar(page, 'aprobada', `&errorDetalle=${error}`);
        await dialogo.getByRole('button', { name: 'Completar o editar descripción' }).click();
        const original = await editor(dialogo).inputValue();
        const borrador = 'Edición sintética válida que el servidor rechazará.';
        await editor(dialogo).fill(borrador);
        await guardarDescripcion(dialogo).click();
        await expect(dialogo.getByRole('alert')).toContainText(error === 'descripcion'
            ? 'No pude guardar descripcion: error HTTP sintético.' : 'Validación sintética de descripcion: revisá los datos.');
        await expect(editor(dialogo)).toHaveValue(borrador);
        await expect(guardarDescripcion(dialogo)).toBeEnabled();
        await dialogo.getByRole('button', { name: 'Cancelar edición de descripción' }).click();
        await desplegarPorTeclado(dialogo, 'Leer descripción completa');
        await expect(dialogo.locator('.detalle-descripcion')).toHaveText(original);
        await cerrar(dialogo).click();
        expect(await escrituras(page)).toEqual(['PATCH /ofertas/501/descripcion']);
    });
}

test('reevaluación HTTP fallida: informa error sin inventar evaluación completada @detalle-ui', async ({ page }) => {
    const dialogo = await iniciar(page, 'historica', '&errorDetalle=reevaluacion');
    await dialogo.getByRole('button', { name: 'Reevaluar oferta', exact: true }).click();
    await expect(dialogo.getByText('Error al solicitar la reevaluación', { exact: true })).toBeVisible();
    await expect(dialogo.getByText('APROBADA', { exact: true })).toBeVisible();
    await expect(dialogo.getByText('Compatibilidad estimada: 84%', { exact: true })).toHaveCount(1);
    await expect(dialogo.getByRole('button', { name: 'Reevaluar oferta', exact: true })).toBeEnabled();
    await cerrar(dialogo).click();
    expect(await escrituras(page)).toEqual(['POST /evaluacion/ejecutar']);
});

for (const sentido of ['retroceso', 'avance'] as const) {
    test(`límites de Tab ${sentido}: primer y último control permanecen en el modal @detalle-ui @detalle-red`, async ({ page }) => {
        const dialogo = await iniciar(page);
        const primero = dialogo.getByRole('link', { name: 'Abrir oferta en página original' });
        const ultimo = cerrar(dialogo);
        await expect(primero).toBeFocused();
        if (sentido === 'retroceso') {
            await primero.press('Shift+Tab');
            await expect(ultimo).toBeFocused();
            await ultimo.press('Tab');
            await expect(primero).toBeFocused();
        } else {
            await ultimo.focus();
            await ultimo.press('Tab');
            await expect(primero).toBeFocused();
            await primero.press('Shift+Tab');
            await expect(ultimo).toBeFocused();
        }
        await page.keyboard.press('Escape');
        await expect(dialogo).toBeHidden();
        await expect(page.getByRole('button', { name: `Ver detalle de ${titulo}`, exact: true })).toBeFocused();
        expect(await escrituras(page)).toEqual([]);
    });
}

test('overlay por teclado: Escape cierra selector antes que diálogo y conserva estado @detalle-ui @detalle-red', async ({ page }) => {
    const dialogo = await iniciar(page);
    const selector = dialogo.getByRole('combobox', { name: 'Estado manual actual' });
    await selector.focus();
    await selector.press('Space');
    await expect(selector).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('option', { name: 'CV enviado', exact: true })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option', { name: 'CV enviado', exact: true })).toBeHidden();
    await expect(selector).toHaveAttribute('aria-expanded', 'false');
    await expect(dialogo).toBeVisible();
    await expect(selector).toBeFocused();
    await expect(selector).toContainText('No postulado');
    expect(await escrituras(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(page.getByRole('button', { name: `Ver detalle de ${titulo}`, exact: true })).toBeFocused();
    expect(await escrituras(page)).toEqual([]);
});

for (const tema of ['claro', 'oscuro']) {
    test(`footer íntegro y contenido utilizable con cabecera larga 320 ${tema} @detalle-ui @detalle-red`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 844 });
        const dialogo = await iniciar(page, 'textos-largos', `&tema=${tema}&extremosDetalle=1`);
        await comprobarGeometriaDetalle(dialogo, page, true);
        await expect(cerrar(dialogo)).toBeInViewport({ ratio: 1 });
        await cerrar(dialogo).click();
        expect(await escrituras(page)).toEqual([]);
    });

    test(`título largo legible completo mediante scroll interno 320 ${tema} @detalle-ui @detalle-red`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 844 });
        const dialogo = await iniciar(page, 'textos-largos', `&tema=${tema}`);
        const encabezado = dialogo.getByRole('heading', { name: /^Frontend sintética/ });
        const scrollPaginaInicial = await page.evaluate(() => document.documentElement.scrollTop);
        await expect(encabezado).toHaveText(`Frontend sintética ${'AccesibilidadSinEspacios'.repeat(12)}`);
        for (const extremo of ['inicio', 'fin'] as const) {
            const medidas = await encabezado.evaluate((elemento, extremo) => {
                elemento.scrollIntoView({ block: extremo === 'inicio' ? 'start' : 'end', behavior: 'instant' });
                elemento.scrollTop = extremo === 'inicio' ? 0 : elemento.scrollHeight;
                const texto = elemento.firstChild!;
                const longitud = texto.textContent!.length;
                const rango = document.createRange();
                rango.setStart(texto, extremo === 'inicio' ? 0 : longitud - 1);
                rango.setEnd(texto, extremo === 'inicio' ? 1 : longitud);
                let arriba = 0;
                let abajo = innerHeight;
                let izquierda = 0;
                let derecha = innerWidth;
                for (let ancestro: HTMLElement | null = elemento; ancestro; ancestro = ancestro.parentElement) {
                    const estilo = getComputedStyle(ancestro);
                    const rect = ancestro.getBoundingClientRect();
                    if (/(auto|scroll|hidden|clip)/.test(estilo.overflowY)) {
                        arriba = Math.max(arriba, rect.top);
                        abajo = Math.min(abajo, rect.bottom);
                    }
                    if (/(auto|scroll|hidden|clip)/.test(estilo.overflowX)) {
                        izquierda = Math.max(izquierda, rect.left);
                        derecha = Math.min(derecha, rect.right);
                    }
                }
                return { caracter: rango.getBoundingClientRect().toJSON(), arriba, abajo, izquierda, derecha,
                    scrollPagina: document.documentElement.scrollTop };
            }, extremo);
            expect(medidas.caracter.height).toBeGreaterThan(0);
            expect(medidas.caracter.width).toBeGreaterThan(0);
            expect(medidas.caracter.top).toBeGreaterThanOrEqual(medidas.arriba - 1);
            expect(medidas.caracter.bottom).toBeLessThanOrEqual(medidas.abajo + 1);
            expect(medidas.caracter.left).toBeGreaterThanOrEqual(medidas.izquierda - 1);
            expect(medidas.caracter.right).toBeLessThanOrEqual(medidas.derecha + 1);
            expect(medidas.scrollPagina).toBe(scrollPaginaInicial);
        }
        await cerrar(dialogo).click();
        expect(await escrituras(page)).toEqual([]);
    });
}

for (const tema of ['claro', 'oscuro']) {
    for (const ancho of [320, 390]) {
        test(`textos extremos ${tema} ${ancho}: scroll íntegro y controles sin solapar @detalle-ui`, async ({ page }) => {
            await page.setViewportSize({ width: ancho, height: 844 });
            const dialogo = await iniciar(page, 'textos-largos', `&tema=${tema}&extremosDetalle=1`);
            await expect(dialogo.getByRole('link', { name: 'Abrir oferta en página original' })).toHaveAttribute('href', /RutaSinEspacios/);
            await expect(nota(dialogo)).toHaveValue('NotaSinEspacios'.repeat(200));
            await comprobarGeometriaDetalle(dialogo, page);
            await cerrar(dialogo).click();
            expect(await escrituras(page)).toEqual([]);
        });
    }
}

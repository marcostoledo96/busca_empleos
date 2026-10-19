import { expect, Page, Locator } from '@playwright/test';

export async function abrirDetallePrincipal(page: Page, escenario: string) {
    if (['rechazada', 'pendiente', 'error', 'desactualizada'].includes(escenario)) {
        await page.getByRole('tab', { name: escenario === 'rechazada' ? /RECHAZADAS/ : /PENDIENTES/ }).click();
    } else if (escenario === 'postulada') {
        await page.getByRole('tab', { name: /POSTULADAS/ }).click();
    }
    // Identifico la oferta 501 por su título único, nunca por la posición ordenada de la lista.
    const titulo = escenario === 'textos-largos' ? 'Frontend sintética' : 'Frontend Angular junior · oferta sintética';
    if (page.viewportSize()!.width <= 768) {
        await page.getByRole('listitem', { name: new RegExp(`^Oferta: ${titulo}`) }).click();
    } else {
        await page.getByRole('button', { name: new RegExp(`^Ver detalle de ${titulo}`) }).click();
    }
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(titulo);
    await expect(dialogo).not.toContainText('Segunda oferta sintética para comprobar borradores independientes');
    if (escenario === 'pendiente') await expect(dialogo).not.toContainText('97%');
    if (escenario === 'error') await expect(dialogo).toContainText('fallo técnico');
    if (escenario === 'reevaluacion-fallida') await expect(dialogo).toContainText('Se conserva la evaluación anterior válida');
    if (escenario === 'rechazada') await expect(dialogo).toContainText('Java obligatorio');
    if (escenario === 'aprobada') await expect(dialogo).toContainText('Compatibilidad estimada: 84%');
    if (escenario === 'desactualizada') await expect(dialogo).toContainText('Evaluación desactualizada');
    if (escenario === 'historica') await expect(dialogo).toContainText('Esta evaluación histórica no cuenta con desglose');
    if (escenario === 'postulada') {
        await expect(dialogo.getByRole('combobox', { name: 'Estado manual actual' })).toContainText('CV enviado');
        await expect(dialogo.getByLabel('Nota de seguimiento', { exact: true })).toHaveValue('Envié un CV sintético. Pendiente de respuesta; no realicé una postulación real.');
    }
    if (escenario === 'textos-largos') await expect(dialogo).toContainText('IdentificadorSinEspacios'.repeat(40));
    return dialogo;
}

export async function comprobarGeometriaDetalle(dialogo: Locator, page: Page, comprobarInicio = false) {
    const contenido = dialogo.locator('.p-dialog-content');
    if (comprobarInicio) await expect(contenido).toHaveJSProperty('scrollTop', 0);
    const medir = () => dialogo.evaluate(elemento => {
        const contenido = elemento.querySelector('.p-dialog-content')!;
        const footer = elemento.querySelector('.p-dialog-footer')!;
        return {
            dialogo: elemento.getBoundingClientRect().toJSON(),
            overflowPagina: document.documentElement.scrollWidth > innerWidth,
            overflowDialogo: elemento.scrollWidth > elemento.clientWidth,
            overflowContenido: contenido.scrollWidth > contenido.clientWidth,
            contenido: { rect: contenido.getBoundingClientRect().toJSON(), scrollTop: contenido.scrollTop,
                altoVisible: contenido.clientHeight, altoTotal: contenido.scrollHeight },
            footer: footer.getBoundingClientRect().toJSON(),
        };
    });
    const inicial = await medir();
    const viewport = page.viewportSize()!;
    const comprobarLimites = (medidas: typeof inicial) => {
        expect(medidas.overflowPagina).toBe(false);
        expect(medidas.overflowDialogo).toBe(false);
        expect(medidas.overflowContenido).toBe(false);
        expect(medidas.dialogo.left).toBeGreaterThanOrEqual(-1);
        expect(medidas.dialogo.top).toBeGreaterThanOrEqual(-1);
        expect(medidas.dialogo.right).toBeLessThanOrEqual(viewport.width + 1);
        expect(medidas.dialogo.bottom).toBeLessThanOrEqual(viewport.height + 1);
        expect(medidas.footer.left).toBeGreaterThanOrEqual(Math.max(0, medidas.dialogo.left) - 1);
        expect(medidas.footer.top).toBeGreaterThanOrEqual(Math.max(0, medidas.dialogo.top) - 1);
        expect(medidas.footer.right).toBeLessThanOrEqual(Math.min(viewport.width, medidas.dialogo.right) + 1);
        expect(medidas.footer.bottom).toBeLessThanOrEqual(Math.min(viewport.height, medidas.dialogo.bottom) + 1);
        // Exijo espacio para operar, no sólo un scroll técnicamente existente de pocos píxeles.
        expect(medidas.contenido.altoVisible).toBeGreaterThanOrEqual(160);
        expect(medidas.contenido.rect.top).toBeGreaterThanOrEqual(medidas.dialogo.top - 1);
        expect(medidas.contenido.rect.bottom).toBeLessThanOrEqual(medidas.footer.top + 1);
    };
    comprobarLimites(inicial);
    // Expando contenido real con teclado; no cambio clases, alturas ni estilos para hacer pasar la prueba.
    for (const resumen of await dialogo.locator('summary').all()) {
        if (await resumen.locator('..').getAttribute('open') === null) {
            await resumen.focus();
            await resumen.press('Enter');
        }
        await expect(resumen.locator('..')).toHaveAttribute('open', '');
    }
    await contenido.evaluate(elemento => { elemento.scrollTop = elemento.scrollHeight; });
    await expect.poll(async () => contenido.evaluate(elemento =>
        Math.abs(elemento.scrollHeight - elemento.clientHeight - elemento.scrollTop))).toBeLessThanOrEqual(1);
    const final = await medir();
    comprobarLimites(final);
    const ultimo = dialogo.locator('.metadatos-oferta');
    const rectUltimo = await ultimo.boundingBox();
    expect(rectUltimo).not.toBeNull();
    expect(rectUltimo!.y + rectUltimo!.height).toBeLessThanOrEqual(final.contenido.rect.bottom + 1);
    const guardar = dialogo.getByRole('button', { name: 'Guardar seguimiento', exact: true });
    await guardar.scrollIntoViewIfNeeded();
    const rectGuardar = await guardar.boundingBox();
    expect(rectGuardar).not.toBeNull();
    expect(rectGuardar!.y).toBeGreaterThanOrEqual(final.contenido.rect.top - 1);
    expect(rectGuardar!.y + rectGuardar!.height).toBeLessThanOrEqual(final.footer.top + 1);
    await expect(guardar).toBeInViewport();
    return { inicial, final, controlSeguimiento: rectGuardar, ultimoContenido: rectUltimo };
}

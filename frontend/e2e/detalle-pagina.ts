import { expect, Page } from '@playwright/test';

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

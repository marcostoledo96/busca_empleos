import { test, expect, Page } from '@playwright/test';

async function abrirEditor(pagina: Page) {
    await pagina.getByRole('tab', { name: 'IMPORTAR CV', exact: true }).click();
    await pagina.getByText('Consultar y editar CV base', { exact: true }).click();
}

const origen = 'http://127.0.0.1:4350';

test.beforeEach(async ({ context, page }) => {
    const escapes: string[] = [];
    // Bloqueo y registro incluso intentos al backend local, no solamente dominios externos.
    await context.route('**/*', ruta => {
        const url = new URL(ruta.request().url());
        // El index compartido referencia fuentes remotas: respondo CSS vacío sin hacer red.
        if (url.origin === 'https://fonts.googleapis.com') return ruta.fulfill({ contentType: 'text/css', body: '' });
        if (url.origin !== origen || url.pathname.startsWith('/api/')) {
            escapes.push(url.href);
            return ruta.abort();
        }
        return ruta.continue();
    });
    await page.exposeFunction('consultarEscapes', () => escapes);
});

test.afterEach(async ({ page }) => {
    const escapes = await page.evaluate(() =>
        (window as unknown as { consultarEscapes: () => Promise<string[]> }).consultarEscapes());
    expect(escapes, 'No deben existir intentos de red productiva').toEqual([]);
});

test('conservo la entrada Dashboard del harness', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'OFERTAS_DISPONIBLES' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Preferencias de búsqueda' })).toHaveCount(0);
});

test('cargo Preferencias reales con perfil confirmado y sin análisis automático', async ({ page }, testInfo) => {
    const diagnostico: string[] = [];
    const errores: string[] = [];
    page.on('pageerror', error => {
        errores.push(error.message);
        diagnostico.push(`pageerror: ${error.stack}`);
    });
    page.on('console', mensaje => diagnostico.push(`console ${mensaje.type()}: ${mensaje.text()}`));
    page.on('requestfailed', solicitud => diagnostico.push(`red: ${solicitud.url()} ${solicitud.failure()?.errorText}`));
    page.on('response', respuesta => {
        if (respuesta.request().resourceType() === 'script') diagnostico.push(`script ${respuesta.status()}: ${respuesta.url()}`);
    });
    try {
        await page.goto('/preferencias');
        await expect(page.getByRole('heading', { name: 'Preferencias de búsqueda', exact: true })).toBeVisible();
        await abrirEditor(page);
        await expect(page.getByLabel('Texto del CV en Markdown')).toHaveValue(/CV sintético/);
        await page.getByRole('tab', { name: 'PERFIL', exact: true }).click();
        await expect(page.getByLabel('Nombre completo')).toHaveValue('Candidatura sintética');
        const registro = page.getByLabel('Llamadas simuladas');
        await expect(registro).toHaveText('GET /preferencias\nGET /preferencias/cv-base');
        await page.getByRole('tab', { name: 'TECNOLOGÍAS', exact: true }).click();
        await page.getByRole('tab', { name: 'ROLES', exact: true }).click();
        await expect(registro).toHaveText('GET /preferencias\nGET /preferencias/cv-base');
        expect(errores).toEqual([]);
    } finally {
        await testInfo.attach('montaje-preferencias', { body: diagnostico.join('\n'), contentType: 'text/plain' });
        if (errores.length) console.log(diagnostico.join('\n'));
    }
});

test('protejo la navegación real y guardo únicamente el CV solicitado', async ({ page }) => {
    await page.goto('/preferencias');
    await abrirEditor(page);
    const editor = page.getByLabel('Texto del CV en Markdown');
    await editor.fill('# CV sintético editado');
    page.once('dialog', dialogo => dialogo.dismiss());
    await page.getByRole('link', { name: 'Salir de Preferencias (fixture)' }).click();
    await expect(page).toHaveURL(/\/preferencias$/);
    await expect(editor).toHaveValue('# CV sintético editado');
    await page.getByRole('button', { name: 'Guardar CV base', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Guardado correctamente' })).toBeVisible();
    await page.getByRole('link', { name: 'Salir de Preferencias (fixture)' }).click();
    await expect(page).toHaveURL(/\/salida$/);
    await page.getByRole('link', { name: 'Volver a Preferencias (fixture)' }).click();
    await abrirEditor(page);
    await expect(editor).toHaveValue('# CV sintético editado');
    await expect(page.getByLabel('Llamadas simuladas')).not.toContainText('/analizar');
});

for (const formato of ['pdf', 'md']) {
    test(`extraigo ${formato} y analizo solamente por acciones explícitas`, async ({ page }) => {
        await page.goto('/preferencias');
        await page.getByRole('tab', { name: 'IMPORTAR CV', exact: true }).click();
        const registro = page.getByLabel('Llamadas simuladas');
        await page.getByLabel('Documento del CV (.pdf o .md)').setInputFiles({
            name: `cv-sintetico.${formato}`, mimeType: formato === 'pdf' ? 'application/pdf' : 'text/markdown',
            buffer: Buffer.from('Documento sintético: el fixture simula su extracción.'),
        });
        await expect(registro).not.toContainText('/importar-cv/');
        await page.getByRole('button', { name: 'Extraer texto sin IA', exact: true }).click();
        await expect(page.getByLabel('Borrador temporal: corregir o pegar texto del CV')).toHaveValue(/CV sintético extraído/);
        await expect(registro).not.toContainText('/analizar');
        await page.getByRole('button', { name: 'Analizar este texto con IA', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Borrador revisable del CV' })).toBeVisible();
        await expect(page.locator('#cv-nombre')).toHaveValue('Candidatura propuesta por análisis sintético');
        await expect(registro).toHaveText('GET /preferencias\nGET /preferencias/cv-base\nPOST /preferencias/importar-cv/extraer-texto\nPOST /preferencias/importar-cv/analizar');
        await abrirEditor(page);
        await expect(page.getByLabel('Texto del CV en Markdown')).toHaveValue(/# CV sintético\n/);
    });
}

test('simulo el error de guardado sin perder el texto ni persistirlo', async ({ page }) => {
    await page.goto('/preferencias?error=cv-guardar');
    await abrirEditor(page);
    const editor = page.getByLabel('Texto del CV en Markdown');
    await editor.fill('# Borrador que conservo');
    await page.getByRole('button', { name: 'Guardar CV base', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'No pude guardar el CV base' })).toBeVisible();
    await expect(editor).toHaveValue('# Borrador que conservo');
    page.once('dialog', dialogo => dialogo.accept());
    await page.getByRole('link', { name: 'Salir de Preferencias (fixture)' }).click();
    await page.getByRole('link', { name: 'Volver a Preferencias (fixture)' }).click();
    await abrirEditor(page);
    await expect(editor).toHaveValue(/CV sintético/);
});

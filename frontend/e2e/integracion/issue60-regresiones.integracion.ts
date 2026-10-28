import { test, expect } from '@playwright/test';

for (const ancho of [320, 360, 1440]) {
    test(`shell sin fuente remota conserva blancos de interacción ${ancho}`, async ({ page, context }, info) => {
        await context.route('**/*', ruta => {
            if (new URL(ruta.request().url()).origin === 'http://127.0.0.1:4357') return ruta.continue();
            throw new Error(`Red externa inesperada: ${ruta.request().url()}`);
        });
        await page.setViewportSize({ width: ancho, height: 900 });
        await page.goto('/preferencias?tema=oscuro');
        await expect(page.getByRole('heading', { name: 'Preferencias de búsqueda', exact: true })).toBeVisible();
        // Reproduzco la ausencia de Material Symbols sin depender de una descarga de Google.
        await page.addStyleTag({ content: '.material-symbols-outlined { font-family: monospace !important; }' });
        const guardar = page.getByRole('button', { name: 'Guardar preferencias', exact: true });
        await expect(guardar).toHaveText('GUARDAR PREFERENCIAS');
        await expect(guardar.locator('.pi-save[aria-hidden="true"]')).toHaveCount(1);
        if (ancho < 768) await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
        const enlaces = page.locator('.sidebar-enlace');
        await expect(enlaces.nth(0)).toHaveText('DASHBOARD');
        await expect(enlaces.nth(1)).toHaveText('PREFERENCIAS');
        await expect(enlaces.nth(0).locator('.pi-th-large[aria-hidden="true"]')).toHaveCount(1);
        await expect(enlaces.nth(1).locator('.pi-cog[aria-hidden="true"]')).toHaveCount(1);
        await page.screenshot({ path: `../docs/evidencias/issue-60/capturas/issue60-audit-sidebar-${ancho}.png` });
        if (ancho < 768) await page.keyboard.press('Escape');
        await guardar.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `../docs/evidencias/issue-60/capturas/issue60-audit-guardar-${ancho}.png` });
        await page.evaluate(() => scrollTo(0, 0));
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.fonts.check('20px primeicons'))).toBe(true);
        const geometria = await page.locator('.topbar').evaluate(barra => ({
            titulo: barra.querySelector('.topbar-seccion')!.getBoundingClientRect().toJSON(),
            controles: [...barra.querySelectorAll<HTMLElement>('.topbar-btn')].map(boton => {
                const r = boton.getBoundingClientRect();
                return { nombre: boton.getAttribute('aria-label'), ...r.toJSON(),
                    centroRecibe: boton.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
                    iconoContenido: [...boton.children].every(icono => {
                        const i = icono.getBoundingClientRect();
                        return i.left >= r.left && i.right <= r.right;
                    }) };
            }),
        }));
        await info.attach('geometria-sin-fuente', { body: JSON.stringify(geometria, null, 4), contentType: 'application/json' });
        console.log(JSON.stringify({ ancho, geometria }));
        expect(geometria.titulo.right).toBeLessThanOrEqual(geometria.controles[0].x);
        for (const boton of geometria.controles) {
            expect(boton.x + boton.width).toBeLessThanOrEqual(ancho);
            expect(boton.width).toBeGreaterThanOrEqual(44);
            expect(boton.centroRecibe).toBe(true);
            expect(boton.iconoContenido).toBe(true);
        }
        const tema = page.getByRole('button', { name: 'Cambiar tema visual' });
        await tema.click();
        await expect(page.locator('html')).not.toHaveClass(/dark/);
        await expect(tema.locator('.pi-moon')).toBeVisible();
        await tema.focus();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'Configuración de preferencias' })).toBeFocused();
        await page.keyboard.press('Tab');
        const salir = page.getByRole('button', { name: 'Cerrar sesión', exact: true });
        await expect(salir).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByRole('link', { name: 'Configuración de preferencias' })).toBeFocused();
        await expect(page.locator('.topbar-seccion')).toHaveText('PREFERENCIAS');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`shell-${ancho}.png`), fullPage: false });
        await salir.click();
        await expect(page).toHaveURL(/\/login$/);
    });
}

import { Component, inject } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ChildrenOutletContexts, provideRouter, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { App } from '../src/app/app';
import { routes } from '../src/app/app.routes';
import { Dashboard } from '../src/app/paginas/dashboard/dashboard';
import { authInterceptor } from '../src/app/interceptores/auth.interceptor';

// Limito el doble del SDK a esta entrada efímera; conservo guardas, servicio y shell reales.
if (location.origin !== 'http://127.0.0.1:4357') throw new Error('Entrada de integración limitada a loopback:4357.');
const parametros = new URLSearchParams(location.search);
if (parametros.has('tema')) localStorage.setItem('busca-empleos.tema', parametros.get('tema') === 'oscuro' ? 'dark' : 'light');
const oyentes = new Set<(usuario: unknown) => void>();
const usuario = () => ({ uid: 'persona-ficticia-57', email: 'persona-issue57@example.invalid',
    getIdToken: async () => sessionStorage.getItem('issue60-token') || 'issue57-token-ficticio' });
const authSintetica = {
    app: { name: 'issue60-sintetica' },
    currentUser: sessionStorage.getItem('issue60-sesion') === 'cerrada' ? null : usuario(),
    onIdTokenChanged(siguiente: (valor: unknown) => void) {
        oyentes.add(siguiente);
        queueMicrotask(() => siguiente(this.currentUser));
        return () => oyentes.delete(siguiente);
    },
    async signOut() {
        this.currentUser = null;
        sessionStorage.setItem('issue60-sesion', 'cerrada');
        oyentes.forEach(siguiente => siguiente(null));
    },
    _popupRedirectResolver: {
        async _initialize() {
            return {
                registerConsumer(operacion: { resolve: (valor: unknown) => void; onError: (error: unknown) => void }) {
                    if (sessionStorage.getItem('issue60-popup') === 'error') {
                        operacion.onError({ code: 'auth/network-request-failed' });
                        return;
                    }
                    authSintetica.currentUser = usuario();
                    sessionStorage.setItem('issue60-sesion', 'abierta');
                    oyentes.forEach(siguiente => siguiente(authSintetica.currentUser));
                    operacion.resolve({ user: authSintetica.currentUser });
                },
                unregisterConsumer() {},
            };
        },
        async _openPopup() { return { window: { closed: false }, close() {} }; },
        async _originValidation() {},
        _isIframeWebStorageSupported(_auth: unknown, siguiente: (valor: boolean) => void) { siguiente(true); },
    },
};

@Component({
    selector: 'app-integracion',
    imports: [App],
    template: `<app-root />
        @if (router.url === '/' || router.url.startsWith('/?')) {
            <button class="actualizacion-integrada" type="button" (click)="actualizar()">Actualizar listado integrado</button>
        }`,
    styles: `.actualizacion-integrada { display: block; margin: 16px 16px 80px; }
        @media (min-width: 769px) { .actualizacion-integrada { margin-left: 280px; } }`,
})
class AplicacionIntegrada {
    readonly router = inject(Router);
    private readonly contextos = inject(ChildrenOutletContexts);
    actualizar() {
        const pagina = this.contextos.getContext('primary')?.outlet?.component;
        if (!pagina || !('cargarDatos' in pagina)) throw new Error('No encontré el Dashboard en el outlet real.');
        (pagina as Dashboard).cargarDatos();
    }
}

document.querySelector('app-root')!.appendChild(document.createElement('app-integracion'));
bootstrapApplication(AplicacionIntegrada, { providers: [
    provideRouter(routes),
    provideNoopAnimations(),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.dark' } } }),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: Auth, useValue: authSintetica },
] }).catch(error => { console.error(error); throw error; });

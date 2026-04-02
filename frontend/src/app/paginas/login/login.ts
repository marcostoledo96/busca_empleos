import { Component, inject, signal, DOCUMENT } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Component({
    selector: 'app-login',
    imports: [],
    templateUrl: './login.html',
    styleUrl: './login.css'
})
export class Login {
    private readonly auth = inject(Auth);
    private readonly router = inject(Router);
    private readonly documento = inject(DOCUMENT);

    readonly cargando = signal(false);
    readonly error = signal<string | null>(null);

    // Expone el estado del tema para el toggle dentro de la página de login.
    // Lee directamente del <html> para ser consistente con App.
    get esModoOscuro(): boolean {
        return this.documento.documentElement.classList.contains('dark');
    }

    toggleTema(): void {
        const html = this.documento.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('busca-empleos.tema', 'light');
        } else {
            html.classList.add('dark');
            localStorage.setItem('busca-empleos.tema', 'dark');
        }
    }

    async autenticarConGoogle(): Promise<void> {
        this.cargando.set(true);
        this.error.set(null);

        try {
            const proveedor = new GoogleAuthProvider();
            await signInWithPopup(this.auth, proveedor);
            // El AuthGuard del Prompt 2 ya detectará que hay sesión activa.
            // Por ahora redirigimos directo al dashboard.
            await this.router.navigateByUrl('/');
        } catch (err: unknown) {
            // El código 'auth/popup-closed-by-user' no es un error real: el usuario
            // cerró el popup sin completar. No mostramos mensaje en ese caso.
            const codigoError = (err as { code?: string }).code ?? '';
            if (codigoError !== 'auth/popup-closed-by-user') {
                this.error.set('AUTHENTICATION_FAILED — intentalo de nuevo');
            }
        } finally {
            this.cargando.set(false);
        }
    }
}

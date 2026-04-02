// Servicio de autenticación — gestiona el ciclo de vida de la sesión con Firebase.
//
// ¿Por qué un servicio separado y no usar Firebase directamente en el componente?
// Porque centralizar la lógica de auth acá significa que cualquier componente
// o guard puede saber "¿hay alguien logueado?" sin duplicar código.
// Es la regla del "single responsibility": este servicio sabe TODO sobre auth,
// y nadie más tiene que saber cómo funciona por dentro.

import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { from, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly auth = inject(Auth);
    private readonly router = inject(Router);

    // Observable del usuario actual.
    // Emite el usuario cuando se loguea, y `null` cuando se desloguea.
    // Angular Fire lo mantiene sincronizado con Firebase automáticamente.
    readonly usuarioActual$ = user(this.auth);

    // Abre el popup de Google y espera que el usuario elija su cuenta.
    // Devuelve una Promise: el caller puede usar async/await con ella.
    loginConGoogle(): Promise<void> {
        const proveedor = new GoogleAuthProvider();
        return signInWithPopup(this.auth, proveedor).then(() => undefined);
    }

    // Cierra la sesión en Firebase y redirige al login.
    logout(): Observable<void> {
        return from(
            signOut(this.auth).then(() => {
                this.router.navigateByUrl('/login');
            })
        );
    }

    // Obtiene el JWT token del usuario actual para mandarlo al backend.
    // El token expira cada hora — Firebase lo renueva automáticamente con `forceRefresh: false`.
    // El interceptor HTTP lo llama en cada request protegido.
    obtenerToken(): Promise<string | null> {
        const usuarioActual = this.auth.currentUser;
        if (!usuarioActual) return Promise.resolve(null);
        return usuarioActual.getIdToken();
    }
}

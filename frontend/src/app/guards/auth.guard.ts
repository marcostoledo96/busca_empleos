// Guard de autenticación — protege las rutas que requieren sesión activa.
//
// ¿Qué es un Guard? Es como el portero de un boliche: antes de dejarte
// entrar a una ruta, verifica si tenés el "ticket" (sesión de Firebase).
// Si no estás logueado, te redirige al login. Si sí, te deja pasar.
//
// Usamos la función `inject()` dentro del guard funcional (Angular 15+).
// Es más simple que la clase tradicional y hace exactamente lo mismo.

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { map, take } from 'rxjs';
import { user } from '@angular/fire/auth';
import { DemoService } from '../servicios/demo.service';

export const authGuard: CanActivateFn = () => {
    // En modo demo no se requiere sesión de Firebase: el invitado pasa directamente.
    if (inject(DemoService).esModoDemo()) {
        return true;
    }

    const auth = inject(Auth);
    const router = inject(Router);

    // `user()` emite el usuario actual y luego sigue emitiendo cambios.
    // `take(1)` toma solo el primer valor — no queremos una suscripción eterna.
    return user(auth).pipe(
        take(1),
        map(usuarioActual => {
            if (usuarioActual) {
                // Hay sesión activa: dejamos pasar.
                return true;
            }
            // No hay sesión: redirigimos al login.
            return router.createUrlTree(['/login']);
        })
    );
};

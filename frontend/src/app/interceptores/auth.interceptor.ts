// Interceptor HTTP de autenticación — agrega el Bearer token a cada request.
//
// ¿Qué es un interceptor? Es un middleware del cliente HTTP de Angular:
// cada vez que un servicio hace una llamada al backend con HttpClient,
// ESTE código se ejecuta primero y puede modificar el request.
// Lo usamos para agregar el header: Authorization: Bearer <token_firebase>
//
// Sin esto, el backend rechazaría todas las llamadas con 401 Unauthorized
// porque no sabría quién hace el request.
//
// ¿Por qué async? Porque `obtenerToken()` hace una llamada asíncrona a Firebase
// para obtener (y si es necesario renovar) el JWT. Necesitamos esperar ese token
// antes de dejar salir el request.

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../servicios/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);

    return from(authService.obtenerToken()).pipe(
        switchMap(token => {
            // Si hay token, clonamos el request y le agregamos el header.
            // Clonamos porque los requests de Angular son inmutables.
            if (token) {
                const requestConToken = req.clone({
                    setHeaders: {
                        Authorization: `Bearer ${token}`
                    }
                });
                return next(requestConToken);
            }
            // Sin token (usuario no logueado), dejamos pasar el request sin modificar.
            // El backend responderá 401 y el guard redirigirá al login.
            return next(req);
        })
    );
};

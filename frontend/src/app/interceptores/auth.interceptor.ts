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

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../servicios/auth.service';
import { DemoService } from '../servicios/demo.service';

// Evito disparar múltiples redirecciones simultáneas ante ráfagas de 401 por cada Router activo.
const redireccionEnCursoPorRouter = new WeakMap<Router, boolean>();

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const demoService = inject(DemoService);
    const router = inject(Router);

    return from(authService.obtenerToken()).pipe(
        switchMap(token => {
            // Si hay token, clonamos el request y le agregamos el header.
            // Clonamos porque los requests de Angular son inmutables.
            const solicitud = token
                ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
                : req;

            return next(solicitud).pipe(
                catchError((error: unknown) => {
                    if (
                        error instanceof HttpErrorResponse &&
                        error.status === 401 &&
                        !demoService.esModoDemo() &&
                        !router.url.startsWith('/login') &&
                        !redireccionEnCursoPorRouter.get(router)
                    ) {
                        redireccionEnCursoPorRouter.set(router, true);
                        void Promise.resolve(
                            router.navigate(['/login'], {
                                queryParams: { motivo: 'sesion-expirada' },
                                replaceUrl: true,
                            })
                        ).finally(() => {
                            redireccionEnCursoPorRouter.set(router, false);
                        });
                    }
                    return throwError(() => error);
                })
            );
        })
    );
};

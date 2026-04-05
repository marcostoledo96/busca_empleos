// Servicio de Modo Demo — gestiona el estado de la sesión de invitado.
//
// ¿Qué hace?
// Cuando un reclutador hace clic en "Entrar como invitado", este servicio activa
// un flag que le dice a toda la app que está en modo demo. En ese modo:
//   - El auth guard deja pasar sin necesidad de Firebase
//   - El dashboard carga datos mock en vez de consultarle al backend
//   - Todas las acciones que disparan requests al backend están bloqueadas
//
// ¿Por qué sessionStorage y no localStorage?
// sessionStorage vive solo mientras la pestaña está abierta. Si el reclutador
// cierra la pestaña, la próxima vez que entre ve el login normal, no el modo demo.
// Con localStorage quedaría "atrapado" en demo hasta que lo limpiara manualmente.

import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Oferta, Estadisticas } from '../modelos/oferta.model';
import { OFERTAS_DEMO, ESTADISTICAS_DEMO } from '../datos/ofertas-demo';

const CLAVE_SESION = 'busca-empleos.modo-demo';

@Injectable({
    providedIn: 'root'
})
export class DemoService {

    private readonly router = inject(Router);

    // Inicializa el signal leyendo sessionStorage para sobrevivir un F5.
    readonly esModoDemo = signal<boolean>(
        typeof sessionStorage !== 'undefined' && sessionStorage.getItem(CLAVE_SESION) === 'true'
    );

    // Activa el modo demo, guarda el flag en sesión y navega al dashboard.
    activarDemo(): void {
        sessionStorage.setItem(CLAVE_SESION, 'true');
        this.esModoDemo.set(true);
        this.router.navigateByUrl('/');
    }

    // Desactiva el modo demo, limpia el flag y vuelve al login.
    desactivarDemo(): void {
        sessionStorage.removeItem(CLAVE_SESION);
        this.esModoDemo.set(false);
        this.router.navigateByUrl('/login');
    }

    // Devuelve la lista de ofertas de ejemplo.
    obtenerOfertasDemo(): Oferta[] {
        return OFERTAS_DEMO;
    }

    // Devuelve las estadísticas calculadas de las ofertas de ejemplo.
    obtenerEstadisticasDemo(): Estadisticas {
        return ESTADISTICAS_DEMO;
    }
}

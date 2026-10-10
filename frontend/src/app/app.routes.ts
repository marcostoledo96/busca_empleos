import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { cambiosCvGuard } from './guards/cambios-cv.guard';

export const routes: Routes = [
    {
        path: '',
        canActivate: [authGuard],
        loadComponent: () => import('./paginas/dashboard/dashboard').then(m => m.Dashboard)
    },
    {
        path: 'preferencias',
        canActivate: [authGuard],
        canDeactivate: [cambiosCvGuard],
        loadComponent: () => import('./paginas/preferencias/preferencias').then(m => m.Preferencias)
    },
    {
        path: 'login',
        loadComponent: () => import('./paginas/login/login').then(m => m.Login)
    },
    {
        path: '**',
        redirectTo: 'login'
    }
];

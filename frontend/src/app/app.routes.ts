import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { cambiosCvGuard } from './guards/cambios-cv.guard';
import { cambiosCvImprimibleGuard } from './guards/cambios-cv-imprimible.guard';

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
        path: 'cv',
        canActivate: [authGuard],
        canDeactivate: [cambiosCvImprimibleGuard],
        loadComponent: () => import('./paginas/cv/cv').then(m => m.Cv)
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

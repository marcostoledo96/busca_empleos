import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./paginas/dashboard/dashboard').then(m => m.Dashboard)
    },
    {
        path: 'preferencias',
        loadComponent: () => import('./paginas/preferencias/preferencias').then(m => m.Preferencias)
    },
    {
        path: '**',
        redirectTo: ''
    }
];

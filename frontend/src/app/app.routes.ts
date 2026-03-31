import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./paginas/dashboard/dashboard').then(m => m.Dashboard)
    },
    {
        path: '**',
        redirectTo: ''
    }
];

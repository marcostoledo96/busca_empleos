import { CanDeactivateFn } from '@angular/router';
import { Preferencias } from '../paginas/preferencias/preferencias';

export const cambiosCvGuard: CanDeactivateFn<Preferencias> = componente =>
    (!componente.cambiosSinGuardar && !componente.cambiosCvPendientes && !componente.guardandoCvBase()) ||
    window.confirm('Hay cambios de preferencias o del CV base sin confirmar. ¿Salir y descartarlos?');

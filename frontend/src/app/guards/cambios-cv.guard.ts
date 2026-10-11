import { CanDeactivateFn } from '@angular/router';
import { Preferencias } from '../paginas/preferencias/preferencias';

export const cambiosCvGuard: CanDeactivateFn<Preferencias> = componente =>
    (!componente.cambiosCvPendientes && !componente.guardandoCvBase()) ||
    window.confirm('Hay cambios del CV base sin confirmar. ¿Salir y descartarlos?');

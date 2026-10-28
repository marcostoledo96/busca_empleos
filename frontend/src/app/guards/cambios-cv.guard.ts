import { CanDeactivateFn } from '@angular/router';
import { Preferencias } from '../paginas/preferencias/preferencias';

export const cambiosCvGuard: CanDeactivateFn<Preferencias> = componente =>
    (!componente.cambiosSinGuardar && !componente.cambiosCvPendientes && !componente.cambiosImportacionPendientes && !componente.guardandoCvBase()) ||
    window.confirm('Hay cambios de preferencias, del CV base o de la revisión de importación sin confirmar. ¿Salir y descartarlos?');

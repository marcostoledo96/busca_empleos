import { CanDeactivateFn } from '@angular/router';
import type { Cv } from '../paginas/cv/cv';

export const cambiosCvImprimibleGuard: CanDeactivateFn<Cv> = componente => componente.confirmarSalida();

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = authService.currentUserValue;
  const expectedRole = route.data['role'];

  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  if (expectedRole && user.role !== expectedRole) {
    router.navigate(['/login']); // O a una página de "No Autorizado"
    return false;
  }

  return true;
};
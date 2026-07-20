import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService, UserContext } from './auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data?.['roles'] as Array<UserContext['rol']> | undefined;
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  if (authService.hasAnyRole(allowedRoles)) {
    return true;
  }

  return router.navigate(['/']);
};
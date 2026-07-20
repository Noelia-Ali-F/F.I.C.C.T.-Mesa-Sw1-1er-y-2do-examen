import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const user = authService.currentUser();

  if (user) {
    let headersConfig: Record<string, string> = {
      Authorization: `Bearer ${user.token}`
    };

    if (user.username) headersConfig['X-Usuario'] = user.username;
    if (user.rol) headersConfig['X-Rol'] = user.rol;
    if (user.departamento) headersConfig['X-Departamento'] = user.departamento;

    const cloned = req.clone({
      setHeaders: headersConfig
    });
    return next(cloned);
  }

  return next(req);
};

import { Injectable, inject, signal } from '@angular/core';
import { AutenticacinService } from '../api/api/autenticacin.service';
import { map, Observable, tap } from 'rxjs';

export interface UserContext {
  username: string;
  nombreCompleto?: string;
  rol: 'SOLICITANTE' | 'REVISOR' | 'ADMINISTRADOR';
  departamento: string;
  token?: string;
  avatarUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authApi = inject(AutenticacinService);

  currentUser = signal<UserContext | null>(null);

  constructor() {
    const saved = localStorage.getItem('WORKFLOW_SYS_USER');
    if (saved) {
      try {
        this.currentUser.set(JSON.parse(saved));
      } catch {
        localStorage.removeItem('WORKFLOW_SYS_USER');
      }
    }
  }

  login(credentials: { username: string, password: string }): Observable<UserContext> {
    const username = (credentials.username || '').trim();
    const password = (credentials.password || '').trim();

    if (!username || !password) {
      throw new Error('Usuario y contraseña son obligatorios');
    }

    return this.authApi.login({ username, password }).pipe(
      map((response) => {
        if (!response.exito || !response.datos) {
          throw new Error(response.mensaje || 'Respuesta de login inválida');
        }

        const payload = response.datos;
        const ctx: UserContext = {
          username: payload.username || username,
          nombreCompleto: payload.nombreCompleto || '',
          rol: (payload.rol as UserContext['rol']) || 'SOLICITANTE',
          departamento: payload.departamento || 'Sin Departamento',
          token: payload.token || '',
          avatarUrl: (payload as any).avatarUrl || ''
        };

        return ctx;
      }),
      tap((ctx) => {
        this.currentUser.set(ctx);
        localStorage.setItem('WORKFLOW_SYS_USER', JSON.stringify(ctx));
      })
    );
  }

  logout() {
    this.currentUser.set(null);
    localStorage.removeItem('WORKFLOW_SYS_USER');
  }

  /** Call this after admin updates their own avatar to keep the session in sync */
  updateCurrentUser(patch: Partial<Pick<UserContext, 'avatarUrl' | 'nombreCompleto'>>) {
    const current = this.currentUser();
    if (!current) return;
    const updated: UserContext = { ...current, ...patch };
    this.currentUser.set(updated);
    localStorage.setItem('WORKFLOW_SYS_USER', JSON.stringify(updated));
  }

  hasAnyRole(roles: Array<UserContext['rol']>): boolean {
    const current = this.currentUser();
    return !!current && roles.includes(current.rol);
  }

  isSolicitante(): boolean {
    return this.currentUser()?.rol === 'SOLICITANTE';
  }

  isRevisor(): boolean {
    return this.currentUser()?.rol === 'REVISOR';
  }

  isAdministrador(): boolean {
    return this.currentUser()?.rol === 'ADMINISTRADOR';
  }

  getValidAvatar(url: string | undefined | null): string {
    if (!url || typeof url !== 'string') return '/icons/default-avatar.png';
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed.toLowerCase().includes('randomuser') || trimmed.toLowerCase().includes('ui-avatars') || trimmed.toLowerCase().includes('dicebear')) {
      return '/icons/default-avatar.png';
    }
    return trimmed;
  }
}

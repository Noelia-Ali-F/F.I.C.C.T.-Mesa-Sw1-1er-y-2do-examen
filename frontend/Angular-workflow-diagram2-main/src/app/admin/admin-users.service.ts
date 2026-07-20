import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { BASE_PATH } from '../api/variables';

interface ApiResponse<T> {
  exito?: boolean;
  mensaje?: string;
  datos?: T;
}

export type RolUsuario = 'SOLICITANTE' | 'REVISOR' | 'ADMINISTRADOR';

export interface AdminUser {
  id: string;
  username: string;
  nombreCompleto: string;
  rol: RolUsuario;
  departamento?: string;
  fechaCreacion?: string;
  avatarUrl?: string;
}

export interface CrearAdminUserRequest {
  username: string;
  password: string;
  nombreCompleto: string;
  rol: RolUsuario;
  departamento?: string;
  avatarUrl?: string;
}

export interface ActualizarAdminUserRequest {
  nombreCompleto: string;
  rol: RolUsuario;
  departamento?: string;
  password?: string;
  avatarUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminUsersService {
  private endpoint: string;

  constructor(
    private http: HttpClient,
    @Inject(BASE_PATH) private basePath: string
  ) {
    this.endpoint = `${this.basePath}/api/v1/admin/usuarios`;
  }

  listarUsuarios(): Observable<AdminUser[]> {
    return this.http
      .get<ApiResponse<AdminUser[]>>(this.endpoint)
      .pipe(map((res) => res.datos || []));
  }

  crearUsuario(request: CrearAdminUserRequest): Observable<AdminUser> {
    return this.http
      .post<ApiResponse<AdminUser>>(this.endpoint, request)
      .pipe(map((res) => this.unwrapOne(res, 'No se pudo crear el usuario')));
  }

  actualizarUsuario(id: string, request: ActualizarAdminUserRequest): Observable<AdminUser> {
    return this.http
      .put<ApiResponse<AdminUser>>(`${this.endpoint}/${id}`, request)
      .pipe(map((res) => this.unwrapOne(res, 'No se pudo actualizar el usuario')));
  }

  eliminarUsuario(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<Record<string, string>>>(`${this.endpoint}/${id}`)
      .pipe(map(() => void 0));
  }

  subirAvatar(id: string, archivo: File): Observable<AdminUser> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    
    return this.http
      .post<ApiResponse<AdminUser>>(`${this.endpoint}/${id}/avatar`, formData)
      .pipe(map((res) => this.unwrapOne(res, 'No se pudo subir el avatar')));
  }


  private unwrapOne<T>(res: ApiResponse<T>, fallbackMessage: string): T {
    if (!res.datos) {
      throw new Error(res.mensaje || fallbackMessage);
    }
    return res.datos;
  }
}
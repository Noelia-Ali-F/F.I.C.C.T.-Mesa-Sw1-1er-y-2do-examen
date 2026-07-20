import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { BASE_PATH } from '../api/variables';

interface ApiResponse<T> {
  exito?: boolean;
  mensaje?: string;
  datos?: T;
}

export interface Departamento {
  id: string;
  nombre: string;
  descripcion?: string;
  creadoPor?: string;
  activo: boolean;
  fechaCreacion?: string;
}

export interface CrearDepartamentoRequest {
  nombre: string;
  descripcion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminDepartamentosService {
  private endpoint: string;

  constructor(
    private http: HttpClient,
    @Inject(BASE_PATH) private basePath: string
  ) {
    this.endpoint = `${this.basePath}/api/v1/departamentos`;
  }

  listarDepartamentos(): Observable<Departamento[]> {
    return this.http
      .get<ApiResponse<Departamento[]>>(this.endpoint)
      .pipe(map((res) => res.datos || []));
  }

  crearDepartamento(request: CrearDepartamentoRequest): Observable<Departamento> {
    return this.http
      .post<ApiResponse<Departamento>>(this.endpoint, request)
      .pipe(map((res) => this.unwrap(res, 'No se pudo crear el departamento')));
  }

  actualizarDepartamento(id: string, request: CrearDepartamentoRequest): Observable<Departamento> {
    return this.http
      .put<ApiResponse<Departamento>>(`${this.endpoint}/${id}`, request)
      .pipe(map((res) => this.unwrap(res, 'No se pudo actualizar el departamento')));
  }


  eliminarDepartamento(id: string): Observable<{ accion: string; nombre: string; mensaje: string; totalTareas: string }> {
    return this.http
      .delete<ApiResponse<Record<string, string>>>(`${this.endpoint}/${id}`)
      .pipe(map((res) => res.datos as any));
  }

  reactivarDepartamento(id: string): Observable<Departamento> {
    return this.http
      .patch<ApiResponse<Departamento>>(`${this.endpoint}/${id}/reactivar`, {})
      .pipe(map((res) => this.unwrap(res, 'No se pudo reactivar el departamento')));
  }

  private unwrap<T>(res: ApiResponse<T>, fallback: string): T {
    if (!res.datos) throw new Error(res.mensaje || fallback);
    return res.datos;
  }
}

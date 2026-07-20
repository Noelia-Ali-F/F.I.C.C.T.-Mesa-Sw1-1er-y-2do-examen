import { Inject, Injectable, Optional } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_PATH } from '../variables';
import { Configuration } from '../configuration';
import { BaseService } from '../api.base.service';

export interface Reporte {
  id?: string;
  titulo: string;
  descripcion: string;
  tipo?: string;
  contenidoHtml: string;
  creadoPor?: string;
  fechaCreacion?: string;
  totalSolicitudes: number;
  aprobadas: number;
  vencidas: number;
  tasaCierre: number;
  tasaRiesgo: number;
}

/**
 * Servicio de integración con el backend para guardar e interactuar con reportes almacenados en MongoDB.
 */
@Injectable({
  providedIn: 'root'
})
export class ReporteService extends BaseService {

  constructor(
    protected httpClient: HttpClient,
    @Optional() @Inject(BASE_PATH) basePath: string | string[],
    @Optional() configuration?: Configuration
  ) {
    super(basePath, configuration);
  }

  /**
   * Obtener todos los reportes persistidos en la BD.
   */
  public listarTodos(): Observable<any> {
    const headers = this.defaultHeaders;
    const { basePath } = this.configuration;
    return this.httpClient.get<any>(`${basePath}/api/v1/reportes`, { headers });
  }

  /**
   * Buscar un reporte por su ID único.
   */
  public obtenerPorId(id: string): Observable<any> {
    const headers = this.defaultHeaders;
    const { basePath } = this.configuration;
    return this.httpClient.get<any>(`${basePath}/api/v1/reportes/${id}`, { headers });
  }

  /**
   * Almacenar un nuevo reporte generado por IA o TensorFlow.
   */
  public guardarReporte(reporte: Reporte, usuario: string): Observable<any> {
    const headers = this.defaultHeaders.set('X-Usuario', usuario);
    const { basePath } = this.configuration;
    return this.httpClient.post<any>(`${basePath}/api/v1/reportes`, reporte, { headers });
  }

  /**
   * Eliminar físicamente un reporte de la BD.
   */
  public eliminarReporte(id: string): Observable<any> {
    const headers = this.defaultHeaders;
    const { basePath } = this.configuration;
    return this.httpClient.delete<any>(`${basePath}/api/v1/reportes/${id}`, { headers });
  }
}

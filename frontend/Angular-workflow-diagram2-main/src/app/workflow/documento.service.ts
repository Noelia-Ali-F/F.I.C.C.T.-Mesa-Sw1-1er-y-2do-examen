import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { BASE_PATH } from '../api/variables';
import { AuthService } from '../auth/auth.service';

export interface VersionDocumento {
  version: number;
  nombreAlmacenado?: string;
  nombreOriginal: string;
  tipoContenido: string;
  tamanoBytes: number;
  subidoPor: string;
  fechaSubida: string;
  comentarioCambio: string;
  contenidoColaborativoSnapshot?: string;
}

export interface Documento {
  id: string;
  solicitudId: string;
  policyKey?: string;
  tareaId?: string;
  taskInstanceId?: string;
  categoria?: string;
  formato?: 'TEXT' | 'SPREADSHEET' | 'FILE';
  estado?: string;
  aprobadoPor?: string;
  fechaDecision?: string;
  observacionDecision?: string;
  historialDecisiones?: Array<{ estadoAnterior: string; estadoNuevo: string; usuario: string; rol: string; observacion?: string; fecha: string }>;
  departamentoPropietario?: string;
  nombre: string;
  descripcion: string;
  tipo: 'FILE' | 'COLLABORATIVE';
  versionActual: number;
  creadoPor: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  bloqueadoPor?: string | null;
  bloqueadoAt?: string | null;
  contenidoColaborativo?: string;
  versiones: VersionDocumento[];
}

export interface ArchivoDetallado {
  id: string;
  nombreOriginal: string;
  nombreAlmacenado: string;
  tipoContenido: string;
  tamanoBytes: number;
  subidoPor: string;
  fechaSubida: string;
  origenTipo: 'SOLICITUD' | 'DOCUMENTO';
  origenNombre: string;
  solicitudId?: string;
  documentoId?: string;
}

interface ApiResponse<T> {
  exito?: boolean;
  mensaje?: string;
  datos?: T;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentoService {
  constructor(
    private http: HttpClient,
    private authService: AuthService,
    @Inject(BASE_PATH) private basePath: string
  ) {}

  private getHeaders(): HttpHeaders {
    const user = this.authService.currentUser();
    return new HttpHeaders({
      'X-Usuario': user?.username || 'anonimo'
    });
  }

  listarPorSolicitud(solicitudId: string): Observable<Documento[]> {
    return this.http
      .get<ApiResponse<Documento[]>>(`${this.basePath}/api/v1/documentos/solicitud/${solicitudId}`)
      .pipe(map(res => res.datos || []));
  }

  listarPorTarea(tareaId: string): Observable<Documento[]> {
    return this.http
      .get<ApiResponse<Documento[]>>(`${this.basePath}/api/v1/documentos/tarea/${tareaId}`)
      .pipe(map(res => res.datos || []));
  }

  obtenerPorId(id: string): Observable<Documento> {
    return this.http
      .get<ApiResponse<Documento>>(`${this.basePath}/api/v1/documentos/${id}`)
      .pipe(map(res => {
        if (!res.datos) throw new Error(res.mensaje || 'Error al obtener documento');
        return res.datos;
      }));
  }

  crearDocumentoArchivo(solicitudId: string, nombre: string, descripcion: string, archivo: File): Observable<Documento> {
    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('descripcion', descripcion);
    formData.append('archivo', archivo);

    return this.http
      .post<ApiResponse<Documento>>(`${this.basePath}/api/v1/documentos/solicitud/${solicitudId}/archivo`, formData, {
        headers: this.getHeaders()
      })
      .pipe(map(res => {
        if (!res.datos) throw new Error(res.mensaje || 'Error al crear documento');
        return res.datos;
      }));
  }

  crearDocumentoColaborativo(
    solicitudId: string,
    nombre: string,
    descripcion: string,
    contenido: string = '',
    contexto: { policyKey?: string; tareaId?: string; taskInstanceId?: string; categoria?: string; formato?: 'TEXT' | 'SPREADSHEET' } = {}
  ): Observable<Documento> {
    return this.http
      .post<ApiResponse<Documento>>(`${this.basePath}/api/v1/documentos/solicitud/${solicitudId}/colaborativo`, null, {
        params: { nombre, descripcion, contenido, ...contexto },
        headers: this.getHeaders()
      })
      .pipe(map(res => {
        if (!res.datos) throw new Error(res.mensaje || 'Error al crear documento colaborativo');
        return res.datos;
      }));
  }

  listarPorPolitica(policyKey: string): Observable<Documento[]> {
    return this.http
      .get<ApiResponse<Documento[]>>(`${this.basePath}/api/v1/documentos/politica/${policyKey}`)
      .pipe(map(res => res.datos || []));
  }

  subirNuevaVersion(id: string, archivo: File, comentario: string): Observable<Documento> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('comentario', comentario);

    return this.http
      .post<ApiResponse<Documento>>(`${this.basePath}/api/v1/documentos/${id}/version`, formData, {
        headers: this.getHeaders()
      })
      .pipe(map(res => {
        if (!res.datos) throw new Error(res.mensaje || 'Error al subir versión');
        return res.datos;
      }));
  }

  guardarSnapshot(id: string, comentario: string): Observable<Documento> {
    return this.http
      .post<ApiResponse<Documento>>(`${this.basePath}/api/v1/documentos/${id}/snapshot`, null, {
        params: { comentario },
        headers: this.getHeaders()
      })
      .pipe(map(res => {
        if (!res.datos) throw new Error(res.mensaje || 'Error al crear snapshot');
        return res.datos;
      }));
  }

  restaurarVersion(id: string, version: number, comentario: string): Observable<Documento> {
    return this.http.post<ApiResponse<Documento>>(
      `${this.basePath}/api/v1/documentos/${id}/restaurar/${version}`, null,
      { params: { comentario } }
    ).pipe(map(res => {
      if (!res.datos) throw new Error(res.mensaje || 'Error al restaurar versión');
      return res.datos;
    }));
  }

  decidirAprobacion(id: string, accion: 'ENVIAR' | 'APROBAR' | 'RECHAZAR', observacion: string): Observable<Documento> {
    return this.http.post<ApiResponse<Documento>>(
      `${this.basePath}/api/v1/documentos/${id}/aprobacion`, null,
      { params: { accion, observacion } }
    ).pipe(map(res => {
      if (!res.datos) throw new Error(res.mensaje || 'Error al actualizar aprobación');
      return res.datos;
    }));
  }

  actualizarContenido(id: string, contenido: string): Observable<Documento> {
    return this.http
      .put<ApiResponse<Documento>>(`${this.basePath}/api/v1/documentos/${id}/contenido`, contenido, {
        headers: this.getHeaders().set('Content-Type', 'text/plain')
      })
      .pipe(map(res => {
        if (!res.datos) throw new Error(res.mensaje || 'Error al guardar contenido');
        return res.datos;
      }));
  }

  bloquearDocumento(id: string): Observable<Documento> {
    return this.http
      .patch<ApiResponse<Documento>>(`${this.basePath}/api/v1/documentos/${id}/bloquear`, null, {
        headers: this.getHeaders()
      })
      .pipe(map(res => {
        if (!res.datos) throw new Error(res.mensaje || 'Error al bloquear documento');
        return res.datos;
      }));
  }

  desbloquearDocumento(id: string): Observable<Documento> {
    return this.http
      .patch<ApiResponse<Documento>>(`${this.basePath}/api/v1/documentos/${id}/desbloquear`, null, {
        headers: this.getHeaders()
      })
      .pipe(map(res => {
        if (!res.datos) throw new Error(res.mensaje || 'Error al desbloquear documento');
        return res.datos;
      }));
  }

  eliminarDocumento(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.basePath}/api/v1/documentos/${id}`, {
        headers: this.getHeaders()
      })
      .pipe(map(() => void 0));
  }

  asociarASolicitud(id: string, solicitudId?: string, tareaId?: string): Observable<Documento> {
    let params: any = {};
    if (solicitudId) params.solicitudId = solicitudId;
    if (tareaId) params.tareaId = tareaId;

    return this.http
      .patch<ApiResponse<Documento>>(`${this.basePath}/api/v1/documentos/${id}/asociar`, null, {
        params,
        headers: this.getHeaders()
      })
      .pipe(map(res => {
        if (!res.datos) throw new Error(res.mensaje || 'Error al asociar documento');
        return res.datos;
      }));
  }

  buscarDocumentos(query: string): Observable<Documento[]> {
    return this.http
      .get<ApiResponse<Documento[]>>(`${this.basePath}/api/v1/documentos/buscar`, {
        params: { query }
      })
      .pipe(map(res => res.datos || []));
  }

  listarTodos(): Observable<Documento[]> {
    return this.http
      .get<ApiResponse<Documento[]>>(`${this.basePath}/api/v1/documentos`)
      .pipe(map(res => res.datos || []));
  }

  listarTodosLosArchivos(): Observable<ArchivoDetallado[]> {
    return this.http
      .get<ApiResponse<ArchivoDetallado[]>>(`${this.basePath}/api/v1/archivos/todos`)
      .pipe(map(res => res.datos || []));
  }

  archivoUrl(nombreAlmacenado?: string | null, download = false): string {
    if (!nombreAlmacenado) return '';
    const token = this.authService.currentUser()?.token || '';
    const params = new URLSearchParams({ access_token: token });
    if (download) params.set('download', 'true');
    return `${this.basePath}/api/v1/archivos/${encodeURIComponent(nombreAlmacenado)}?${params.toString()}`;
  }
}

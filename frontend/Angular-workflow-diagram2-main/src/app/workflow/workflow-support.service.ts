import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of } from 'rxjs';
import { SolicitudResponse } from '../api/model/solicitudResponse';
import { BASE_PATH } from '../api/variables';
import { AuthService } from '../auth/auth.service';

// Definición local de ApiResponse si no se encuentra el archivo exacto del generador
export interface ApiResponse<T> {
  exito: boolean;
  mensaje: string;
  datos: T;
  timestamp: string;
}

export interface PresenciaUsuario {
  username: string;
  nombreCompleto: string;
  rol: string;
  depto: string;
  departamento?: string;
  avatarUrl?: string;
  x: number;
  y: number;
  lastSeen: number;
}

export interface PresenciaResumen {
  count: number;
  totalOnlineVisible: number;
  totalOnlineSistema: number;
  usuariosOnline: PresenciaUsuario[];
  usuarios: PresenciaUsuario[];
  generadoEn?: string | null;
}

export interface ReasignacionRecomendacion {
  departamentoSugerido: string;
  probabilidadExito: number;
  razon: string;
  tiempoEstimadoMinutos: number;
  colaPendiente?: Record<string, number>;
}

export interface PrediccionIA {
  solicitudId: string;
  probabilidadExito: number;
  riesgoRetraso: number;
  tiempoEstimadoMinutos: number;
  recomendacionPrioridad: string;
  anomaliasDetectadas: string[];
  insightsModel: string;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowSupportService {
  private http = inject(HttpClient);
  private basePath = inject(BASE_PATH);
  private authService = inject(AuthService);

  presenciaResumen = signal<PresenciaResumen | null>(null);

  obtenerAnalisisPredictivo(solicitudId: string): Observable<PrediccionIA> {
    return this.http
      .get<ApiResponse<PrediccionIA>>(`${this.basePath}/api/v1/ia/prediccion/solicitud/${solicitudId}`)
      .pipe(map(res => res.datos));
  }

  actualizarResumenLocal() {
    this.obtenerResumenPresencia().subscribe(res => {
      this.presenciaResumen.set(res);
    });
  }

  obtenerDiagramaCalles(): Observable<Record<string, SolicitudResponse[]>> {
    return this.http
      .get<ApiResponse<Record<string, SolicitudResponse[]>>>(`${this.basePath}/api/v1/workflows/diagrama/calles`)
      .pipe(
        map((res) => {
          if (!res.datos) {
            return {};
          }
          return res.datos;
        })
      );
  }

  obtenerRecomendacionReasignacion(solicitudId: string): Observable<ReasignacionRecomendacion> {
    return this.http
      .get<ApiResponse<ReasignacionRecomendacion>>(`${this.basePath}/api/v1/workflows/${solicitudId}/recomendacion-reasignacion`)
      .pipe(
        map((res) => {
          if (!res.datos) {
            throw new Error(res.mensaje || 'No se pudo obtener la recomendacion');
          }
          return res.datos;
        })
      );
  }

  registrarHeartbeatPresencia(): Observable<void> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.basePath}/api/v1/presencia/heartbeat`, {})
      .pipe(map(() => void 0));
  }

  cerrarSesionPresencia(): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.basePath}/api/v1/presencia/heartbeat`)
      .pipe(map(() => void 0));
  }

  obtenerResumenPresencia(): Observable<PresenciaResumen> {
    return this.http
      .get<ApiResponse<PresenciaResumen>>(`${this.basePath}/api/v1/presencia/resumen`)
      .pipe(
        map((res) => {
          if (!res.datos) {
            throw new Error(res.mensaje || 'No se pudo obtener el resumen de presencia');
          }
          return res.datos;
        })
      );
  }

  // ─── BPMN Diagram Persistence ──────────────────────────────────────────

  cargarDiagramaBpmn(): Observable<any | null> {
    return this.http
      .get<ApiResponse<any>>(`${this.basePath}/api/v1/bpmn/diagrama`)
      .pipe(map((res) => res.datos ?? null));
  }

  guardarDiagramaBpmn(xml: string, comentario?: string): Observable<any> {
    return this.http
      .put<ApiResponse<any>>(`${this.basePath}/api/v1/bpmn/diagrama`, { xml, comentario })
      .pipe(
        map((res) => {
          if (!res.datos) {
            throw new Error(res.mensaje || 'No se pudo guardar el diagrama');
          }
          return res.datos;
        })
      );
  }

  // ─── Workflow Definition Persistence ──────────────────────────────────

  listarWorkflowDefinitions(): Observable<any[]> {
    return this.http
      .get<ApiResponse<any[]>>(`${this.basePath}/api/v1/bpmn/definitions`)
      .pipe(map((res) => res.datos || []));
  }

  obtenerWorkflowDefinition(key: string): Observable<any> {
    return this.http
      .get<ApiResponse<any>>(`${this.basePath}/api/v1/bpmn/definitions/${key}`)
      .pipe(map((res) => res.datos));
  }

  guardarWorkflowDefinition(defPayload: any, usuario: string, departamento: string): Observable<any> {
    return this.http
      .post<ApiResponse<any>>(`${this.basePath}/api/v1/bpmn/definitions`, defPayload, {
        headers: {
          'X-Usuario': usuario || 'anonimo',
          'X-Departamento': departamento || ''
        }
      })
      .pipe(
        map((res) => {
          if (!res.datos) {
            throw new Error(res.mensaje || 'No se pudo guardar la definicion de workflow');
          }
          return res.datos;
        })
      );
  }

  asociarProcesoBpm(solicitudId: string, workflowDefinitionId: string, tareaId: string, tareaNombre: string): Observable<any> {
    return this.http
      .patch<ApiResponse<any>>(`${this.basePath}/api/v1/workflows/${solicitudId}/bpm-proceso`, null, {
        params: { workflowDefinitionId, tareaId, tareaNombre }
      })
      .pipe(map(res => res.datos));
  }

  cambiarTareaBpm(solicitudId: string, flowId: string, tareaId: string, tareaNombre: string): Observable<any> {
    return this.http
      .patch<ApiResponse<any>>(`${this.basePath}/api/v1/workflows/${solicitudId}/bpm-tarea`, null, {
        params: { flowId, tareaId, tareaNombre }
      })
      .pipe(map(res => res.datos));
  }

  emitirEventoColaborativo(policyKey: string, tipo: string, payload: any): Observable<void> {
    return this.http
      .post<ApiResponse<string>>(`${this.basePath}/api/v1/bpmn/colaboracion`, { tipo, payload }, { params: { policyKey } })
      .pipe(map(() => void 0));
  }

  suscribirEventosBpmn(policyKey: string): { events$: Observable<any>, close: () => void } {
    const token = this.authService.currentUser()?.token || '';
    const query = new URLSearchParams({ policyKey, access_token: token });
    const eventSource = new EventSource(`${this.basePath}/api/v1/bpmn/eventos?${query.toString()}`);
    const events$ = new Observable<any>(observer => {
      const forwardEvent = (type: string, event: MessageEvent<string>) => {
        try {
          observer.next({
            type,
            data: JSON.parse(event.data)
          });
        } catch (e) {
          observer.error(e);
        }
      };

      eventSource.addEventListener('CONNECTED', (event) => forwardEvent('CONNECTED', event as MessageEvent<string>));
      eventSource.addEventListener('DIAGRAM_UPDATED', (event) => forwardEvent('DIAGRAM_UPDATED', event as MessageEvent<string>));
      eventSource.addEventListener('COLABORACION', (event) => forwardEvent('COLABORACION', event as MessageEvent<string>));
      eventSource.onerror = (error) => {
        eventSource.close();
        observer.error(error);
      };
      return () => eventSource.close();
    });
    return { events$, close: () => eventSource.close() };
  }

  obtenerCatalogoDepartamentos(): Observable<string[]> {
    return this.http
      .get<ApiResponse<any[]>>(`${this.basePath}/api/v1/departamentos`)
      .pipe(map((res) => (res.datos || []).map((d: any) => d.nombre)));
  }

  resetSeed(): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.basePath}/api/v1/bpmn/definitions/reset-seed`, null);
  }
}

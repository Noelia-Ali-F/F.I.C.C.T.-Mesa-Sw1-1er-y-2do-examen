import { Injectable, Injector } from '@angular/core';
import { initializeModel } from 'ng-diagram';
import {
  EstadoWorkflow,
  ESTADO_POR_NODO_ID,
  ESTADO_VISUAL_CONFIG,
  TRANSICIONES_POR_ARISTA,
  DESCRIPCION_ESTADO,
  TransicionFlujo,
  DetalleEstado,
  DetalleTransicion,
  WorkflowNodeData
} from '../models/workflow.models';

/**
 * Centralizes all diagram model construction logic.
 * Keeps the dashboard component lean and focused on orchestration.
 */
@Injectable({
  providedIn: 'root'
})
export class WorkflowDiagramService {

  /**
   * Build the ng-diagram model from workflow statistics.
   */
  buildModel(stats: Record<string, any>, injector: Injector) {
    const counts = stats?.['porEstado'] || stats || {};

    const pendCount = counts['PENDIENTE'] || 0;
    const revCount = counts['EN_REVISION'] || 0;
    const appCount = counts['APROBADO'] || 0;
    const rejCount = counts['RECHAZADO'] || 0;

    return initializeModel({
      nodes: [
        {
          id: 'n-pendiente',
          position: { x: 80, y: 180 }, // Carril 1
          type: 'workflow-state',
          data: {
            label: 'PENDIENTE',
            estado: 'PENDIENTE',
            count: pendCount,
            color: ESTADO_VISUAL_CONFIG.PENDIENTE.color,
            iconPath: ESTADO_VISUAL_CONFIG.PENDIENTE.iconPath
          } as WorkflowNodeData
        },
        {
          id: 'n-revision',
          position: { x: 420, y: 180 }, // Carril 2
          type: 'workflow-state',
          data: {
            label: 'EN REVISION',
            estado: 'EN_REVISION',
            count: revCount,
            color: ESTADO_VISUAL_CONFIG.EN_REVISION.color,
            iconPath: ESTADO_VISUAL_CONFIG.EN_REVISION.iconPath
          } as WorkflowNodeData
        },
        {
          id: 'n-aprobado',
          position: { x: 760, y: 80 }, // Carril 3 arriba
          type: 'workflow-state',
          data: {
            label: 'APROBADO',
            estado: 'APROBADO',
            count: appCount,
            color: ESTADO_VISUAL_CONFIG.APROBADO.color,
            iconPath: ESTADO_VISUAL_CONFIG.APROBADO.iconPath
          } as WorkflowNodeData
        },
        {
          id: 'n-rechazado',
          position: { x: 760, y: 280 }, // Carril 3 abajo
          type: 'workflow-state',
          data: {
            label: 'RECHAZADO',
            estado: 'RECHAZADO',
            count: rejCount,
            color: ESTADO_VISUAL_CONFIG.RECHAZADO.color,
            iconPath: ESTADO_VISUAL_CONFIG.RECHAZADO.iconPath
          } as WorkflowNodeData
        }
      ],
      edges: [
        {
          id: 't-pendiente-revision',
          source: 'n-pendiente',
          sourcePort: 'port-right',
          targetPort: 'port-left',
          target: 'n-revision',
          routing: 'orthogonal',
          data: {}
        },
        {
          id: 't-revision-aprobado',
          source: 'n-revision',
          sourcePort: 'port-right',
          targetPort: 'port-left',
          target: 'n-aprobado',
          routing: 'orthogonal',
          data: {}
        },
        {
          id: 't-revision-rechazado',
          source: 'n-revision',
          sourcePort: 'port-right',
          targetPort: 'port-left',
          target: 'n-rechazado',
          routing: 'orthogonal',
          data: {}
        }
      ]
    }, injector);
  }

  /** Resolve the workflow state for a selected node ID */
  getEstadoForNode(nodeId: string): EstadoWorkflow | null {
    return ESTADO_POR_NODO_ID[nodeId] ?? null;
  }

  /** Resolve the transition metadata for a selected edge ID */
  getTransicionForEdge(edgeId: string): TransicionFlujo | null {
    return TRANSICIONES_POR_ARISTA[edgeId] ?? null;
  }

  /** Build detail info for a selected state */
  buildDetalleEstado(estado: EstadoWorkflow, contadores: Record<EstadoWorkflow, number>): DetalleEstado {
    return {
      estado,
      etiqueta: this.etiquetaEstado(estado),
      total: contadores[estado],
      descripcion: DESCRIPCION_ESTADO[estado]
    };
  }

  /** Build detail info for a selected transition */
  buildDetalleTransicion(transicion: TransicionFlujo, contadores: Record<EstadoWorkflow, number>): DetalleTransicion {
    return {
      ...transicion,
      etiquetaDesde: this.etiquetaEstado(transicion.desde),
      etiquetaHacia: this.etiquetaEstado(transicion.hacia),
      totalDestino: contadores[transicion.hacia]
    };
  }

  /** Format state enum to display label */
  etiquetaEstado(estado: EstadoWorkflow): string {
    return estado.replace('_', ' ');
  }
}

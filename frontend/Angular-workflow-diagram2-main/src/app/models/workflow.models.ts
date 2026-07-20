/**
 * Shared workflow types used across diagram, inspector, and dashboard components.
 */

export type EstadoWorkflow = 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO';
export type EstadoSla = 'EN_TIEMPO' | 'POR_VENCER' | 'VENCIDO' | 'CERRADO';

export interface TransicionFlujo {
  id: string;
  desde: EstadoWorkflow;
  hacia: EstadoWorkflow;
  titulo: string;
  descripcion: string;
}

export interface DetalleEstado {
  estado: EstadoWorkflow;
  etiqueta: string;
  total: number;
  descripcion: string;
}

export interface DetalleTransicion extends TransicionFlujo {
  etiquetaDesde: string;
  etiquetaHacia: string;
  totalDestino: number;
}

export interface WorkflowNodeData {
  label: string;
  estado: EstadoWorkflow;
  count: number;
  color: string;
  iconPath: string;
}

/** Map node IDs to workflow states */
export const ESTADO_POR_NODO_ID: Record<string, EstadoWorkflow> = {
  'n-pendiente': 'PENDIENTE',
  'n-revision': 'EN_REVISION',
  'n-aprobado': 'APROBADO',
  'n-rechazado': 'RECHAZADO'
};

/** Descriptive strings for each workflow state */
export const DESCRIPCION_ESTADO: Record<EstadoWorkflow, string> = {
  PENDIENTE: 'Solicitud registrada, esperando asignacion inicial para analisis.',
  EN_REVISION: 'Caso en evaluacion activa por el departamento responsable.',
  APROBADO: 'Flujo validado y cerrado con resultado favorable.',
  RECHAZADO: 'Flujo finalizado con observaciones y resultado no favorable.'
};

/** Transition metadata keyed by edge ID */
export const TRANSICIONES_POR_ARISTA: Record<string, TransicionFlujo> = {
  't-pendiente-revision': {
    id: 't-pendiente-revision',
    desde: 'PENDIENTE',
    hacia: 'EN_REVISION',
    titulo: 'Ingreso a revision',
    descripcion: 'El caso deja la bandeja de espera y entra a evaluacion departamental.'
  },
  't-revision-aprobado': {
    id: 't-revision-aprobado',
    desde: 'EN_REVISION',
    hacia: 'APROBADO',
    titulo: 'Cierre aprobado',
    descripcion: 'El analisis confirma cumplimiento y la solicitud se da por finalizada.'
  },
  't-revision-rechazado': {
    id: 't-revision-rechazado',
    desde: 'EN_REVISION',
    hacia: 'RECHAZADO',
    titulo: 'Cierre rechazado',
    descripcion: 'La validacion detecta observaciones y se cierra con rechazo.'
  }
};

/** Visual configuration per state */
export const ESTADO_VISUAL_CONFIG: Record<EstadoWorkflow, { color: string; bgColor: string; iconPath: string }> = {
  PENDIENTE: {
    color: 'var(--theme-slate-500)',
    bgColor: '#f1f5f9',
    iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  EN_REVISION: {
    color: '#2563eb',
    bgColor: '#eff6ff',
    iconPath: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
  },
  APROBADO: {
    color: '#16a34a',
    bgColor: '#f0fdf4',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
  },
  RECHAZADO: {
    color: '#dc2626',
    bgColor: '#fef2f2',
    iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
  }
};

export type EstadoWorkflow = 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'BLOQUEADO' | 'SLA_CRITICO';

export interface BpmnSelectionInfo {
  id: string;
  name: string;
  type: string;
  estado?: EstadoWorkflow;
}

export interface CollaboratorCursor {
  username: string;
  x: number;
  y: number;
  name?: string;
  rol?: string;
  depto?: string;
  lastSeen: number;
}

export interface KpiCard {
  label: string;
  estado: EstadoWorkflow;
  count: number;
  bg: string;
}

export interface NodeMetrics {
  total: number;
  slaCritico: number;
  slaPorVencer: number;
  urgentes: number;
  promedioMinutos: number;
  promedioLabel: string;
}

export type DrillDownTab = 'solicitudes' | 'backlog' | 'documentos' | 'usuarios' | 'tiempos' | 'formularios';

export interface FormFieldDefinition {
  name: string;        // ID técnico del campo (ej: "monto_solicitado")
  label: string;       // Etiqueta para el usuario (ej: "Monto Solicitado")
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'table';
  required: boolean;
  placeholder?: string;
  options?: string;     // Para tipo select, separado por comas
  columns?: string;     // Para tipo table, nombres separados por comas
  validation?: string;  // Regex o regla simple
}

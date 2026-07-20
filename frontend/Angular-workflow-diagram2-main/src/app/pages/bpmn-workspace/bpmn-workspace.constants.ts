import { EstadoWorkflow, KpiCard } from './bpmn-workspace.models';

export const BPMN_DEFAULT_KPIS: KpiCard[] = [
  { label: 'Pendientes', estado: 'PENDIENTE', count: 0, bg: 'bg-amber-50' },
  { label: 'En Revisión', estado: 'EN_REVISION', count: 0, bg: 'bg-blue-50' },
  { label: 'Aprobadas', estado: 'APROBADO', count: 0, bg: 'bg-green-50' },
  { label: 'Rechazadas', estado: 'RECHAZADO', count: 0, bg: 'bg-red-50' }
];

export const BPMN_ESTADO_ELEMENT_MAP: Record<EstadoWorkflow, string> = {
  PENDIENTE: 'Activity_Pendiente',
  EN_REVISION: 'Activity_Revision',
  APROBADO: 'Activity_Aprobado',
  RECHAZADO: 'Activity_Rechazado',
  BLOQUEADO: '',
  SLA_CRITICO: ''
};

export const BPMN_PRIORITY_WEIGHT: Record<string, number> = {
  URGENTE: 1,
  ALTA: 2,
  MEDIA: 3,
  BAJA: 4
};

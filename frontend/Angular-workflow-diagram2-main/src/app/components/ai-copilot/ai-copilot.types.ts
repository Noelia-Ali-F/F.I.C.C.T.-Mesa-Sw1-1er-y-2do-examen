/**
 * AI Copilot — Shared Types & Interfaces
 * Centralized type definitions for the AI Copilot subsystem.
 */

/** Severity levels for AI-generated insights */
export type InsightSeverity = 'critical' | 'warning' | 'info' | 'success';

/** Categories for AI insight classification */
export type InsightCategory = 'bottleneck' | 'sla_risk' | 'workload' | 'optimization' | 'anomaly' | 'suggestion';

/** An AI-generated proactive insight card */
export interface AiInsight {
  id: string;
  severity: InsightSeverity;
  category: InsightCategory;
  title: string;
  description: string;
  metric?: string;
  actionLabel?: string;
  actionCommand?: string;
  timestamp: Date;
  dismissed?: boolean;
}

/** System health pulse computed from workflow data */
export interface SystemPulse {
  overallScore: number;        // 0-100, overall system health
  slaCompliance: number;       // 0-100 percentage
  throughputRate: number;      // requests processed per hour (estimated)
  bottleneckRisk: number;      // 0-100 risk score
  activeLoad: number;          // total active (non-resolved) solicitudes
  urgentCount: number;         // URGENTE priority items
  overdueCount: number;        // VENCIDO SLA items
  atRiskCount: number;         // POR_VENCER SLA items
  onlineCollaborators: number; // users currently online
  departmentCount: number;     // active departments
  trend: 'improving' | 'stable' | 'degrading';
}

/** Lane/department statistics for AI analysis */
export interface LaneStats {
  departamento: string;
  total: number;
  pendientes: number;
  enRevision: number;
  aprobados: number;
  rechazados: number;
  urgentes: number;
  vencidos: number;
  porVencer: number;
  colaboradores: number;
}

/** Chat message in the copilot mini-chat */
export interface CopilotChatMessage {
  id: string;
  text: string;
  isAi: boolean;
  time: Date;
  intent?: string;
  kind: 'normal' | 'error' | 'success' | 'thinking';
}

/** Quick action for one-click AI operations */
export interface QuickAction {
  id: string;
  icon: string;
  label: string;
  command: string;
  color: string;
  description: string;
}

/** Events emitted by the copilot to the parent */
export interface CopilotEvent {
  type: 'navigate' | 'focus_lane' | 'focus_node' | 'refresh' | 'action_executed';
  payload?: any;
}

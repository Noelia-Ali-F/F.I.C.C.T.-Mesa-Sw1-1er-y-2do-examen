import { inject, Injectable } from '@angular/core';
import { SolicitudResponse } from '../../api/model/solicitudResponse';
import { PresenciaResumen, PresenciaUsuario } from '../../workflow/workflow-support.service';
import {
  AiInsight,
  InsightSeverity,
  InsightCategory,
  SystemPulse,
  LaneStats,
  QuickAction
} from './ai-copilot.types';

/**
 * AI Copilot Service
 * 
 * Computes proactive intelligence from workflow data:
 * - System health pulse scoring
 * - Automated insight generation (bottlenecks, SLA risks, anomalies)
 * - Quick action recommendations based on role
 * - Lane-level analytics
 * 
 * This is a pure computation service — no HTTP calls. 
 * It analyzes data already fetched by the parent component.
 */
@Injectable({ providedIn: 'root' })
export class AiCopilotService {

  /**
   * Compute the System Health Pulse from raw workflow data.
   */
  computeSystemPulse(
    callesData: Record<string, SolicitudResponse[]>,
    presencia: PresenciaResumen | null,
    previousScore?: number
  ): SystemPulse {
    const allSolicitudes = Object.values(callesData).flat();
    const total = allSolicitudes.length;

    if (total === 0) {
      return this.emptyPulse(presencia);
    }

    const urgentCount = allSolicitudes.filter(s => s.prioridad === 'URGENTE').length;
    const overdueCount = allSolicitudes.filter(s => s.estadoSla === 'VENCIDO').length;
    const atRiskCount = allSolicitudes.filter(s => s.estadoSla === 'POR_VENCER').length;
    const activeCount = allSolicitudes.filter(s =>
      s.estado === 'PENDIENTE' || s.estado === 'EN_REVISION'
    ).length;
    const resolvedCount = allSolicitudes.filter(s =>
      s.estado === 'APROBADO' || s.estado === 'RECHAZADO'
    ).length;

    // SLA compliance: percentage of items NOT overdue
    const slaCompliance = total > 0
      ? Math.round(((total - overdueCount) / total) * 100)
      : 100;

    // Bottleneck risk: high if too many pending vs. resolved
    const pendingRatio = activeCount / Math.max(total, 1);
    const urgentRatio = urgentCount / Math.max(total, 1);
    const bottleneckRisk = Math.min(100, Math.round(
      (pendingRatio * 60) + (urgentRatio * 30) + (overdueCount > 0 ? 10 : 0)
    ));

    // Overall score: weighted composite
    const overallScore = Math.max(0, Math.min(100, Math.round(
      (slaCompliance * 0.4) +
      ((100 - bottleneckRisk) * 0.3) +
      ((resolvedCount / Math.max(total, 1)) * 100 * 0.3)
    )));

    // Throughput estimate (resolved items as rate)
    const throughputRate = resolvedCount;

    // Trend detection
    let trend: SystemPulse['trend'] = 'stable';
    if (previousScore !== undefined) {
      if (overallScore > previousScore + 3) trend = 'improving';
      else if (overallScore < previousScore - 3) trend = 'degrading';
    }

    return {
      overallScore,
      slaCompliance,
      throughputRate,
      bottleneckRisk,
      activeLoad: activeCount,
      urgentCount,
      overdueCount,
      atRiskCount,
      onlineCollaborators: presencia?.totalOnlineVisible ?? 0,
      departmentCount: Object.keys(callesData).length,
      trend
    };
  }

  /**
   * Compute per-department lane statistics.
   */
  computeLaneStats(
    callesData: Record<string, SolicitudResponse[]>,
    presencia: PresenciaResumen | null
  ): LaneStats[] {
    return Object.entries(callesData).map(([dept, solicitudes]) => {
      const colaboradores = (presencia?.usuariosOnline ?? [])
        .filter((u: PresenciaUsuario) => this.normalize(u.depto) === this.normalize(dept)).length;

      return {
        departamento: dept,
        total: solicitudes.length,
        pendientes: this.countByField(solicitudes, 'estado', 'PENDIENTE'),
        enRevision: this.countByField(solicitudes, 'estado', 'EN_REVISION'),
        aprobados: this.countByField(solicitudes, 'estado', 'APROBADO'),
        rechazados: this.countByField(solicitudes, 'estado', 'RECHAZADO'),
        urgentes: this.countByField(solicitudes, 'prioridad', 'URGENTE'),
        vencidos: this.countByField(solicitudes, 'estadoSla', 'VENCIDO'),
        porVencer: this.countByField(solicitudes, 'estadoSla', 'POR_VENCER'),
        colaboradores
      };
    }).sort((a, b) => {
      // Sort by risk: vencidos first, then urgentes, then total
      const riskA = (a.vencidos * 100) + (a.urgentes * 10) + a.pendientes;
      const riskB = (b.vencidos * 100) + (b.urgentes * 10) + b.pendientes;
      return riskB - riskA;
    });
  }

  /**
   * Generate proactive AI insights from current workflow state.
   * These are locally computed heuristics — no LLM call needed.
   */
  generateInsights(
    pulse: SystemPulse,
    lanes: LaneStats[]
  ): AiInsight[] {
    const insights: AiInsight[] = [];
    const now = new Date();

    // 1. Critical: Overdue SLA items
    if (pulse.overdueCount > 0) {
      insights.push({
        id: 'sla_overdue',
        severity: 'critical',
        category: 'sla_risk',
        title: `${pulse.overdueCount} solicitud${pulse.overdueCount > 1 ? 'es' : ''} con SLA vencido`,
        description: 'Hay items que han superado su tiempo de atención. Requieren acción inmediata para evitar escalar.',
        metric: `${pulse.overdueCount} VENCIDOS`,
        actionLabel: 'Escalar urgentes',
        actionCommand: 'escalar urgentes',
        timestamp: now
      });
    }

    // 2. Warning: At-risk SLA items
    if (pulse.atRiskCount > 2) {
      insights.push({
        id: 'sla_at_risk',
        severity: 'warning',
        category: 'sla_risk',
        title: `${pulse.atRiskCount} solicitudes por vencer`,
        description: 'Múltiples solicitudes están próximas a vencer su SLA. Considera redistribuir la carga.',
        metric: `${pulse.atRiskCount} POR VENCER`,
        actionLabel: 'Analizar vencimientos',
        actionCommand: 'analizar vencimientos cercanos',
        timestamp: now
      });
    }

    // 3. Bottleneck detection per department
    const bottleneckLanes = lanes.filter(l => l.pendientes > 3 && l.colaboradores < 2);
    for (const lane of bottleneckLanes) {
      insights.push({
        id: `bottleneck_${lane.departamento}`,
        severity: 'warning',
        category: 'bottleneck',
        title: `Cuello de botella en ${lane.departamento}`,
        description: `${lane.pendientes} pendientes con solo ${lane.colaboradores} colaborador${lane.colaboradores !== 1 ? 'es' : ''} activo${lane.colaboradores !== 1 ? 's' : ''}. Riesgo de retraso.`,
        metric: `${lane.pendientes}P / ${lane.colaboradores}C`,
        actionLabel: 'Optimizar cola',
        actionCommand: `analizar cola de ${lane.departamento}`,
        timestamp: now
      });
    }

    // 4. Workload imbalance detection
    if (lanes.length >= 2) {
      const maxLoad = Math.max(...lanes.map(l => l.pendientes + l.enRevision));
      const minLoad = Math.min(...lanes.map(l => l.pendientes + l.enRevision));
      if (maxLoad > 0 && maxLoad > minLoad * 3) {
        const overloaded = lanes.find(l => (l.pendientes + l.enRevision) === maxLoad);
        if (overloaded) {
          insights.push({
            id: 'workload_imbalance',
            severity: 'info',
            category: 'workload',
            title: 'Desbalance de carga detectado',
            description: `${overloaded.departamento} tiene ${maxLoad} tareas activas vs mínimo ${minLoad} en otros departamentos.`,
            metric: `${maxLoad}:${minLoad} ratio`,
            actionLabel: 'Sugerir redistribución',
            actionCommand: 'sugerir optimizaciones de flujo',
            timestamp: now
          });
        }
      }
    }

    // 5. Urgent items alert
    if (pulse.urgentCount > 0) {
      insights.push({
        id: 'urgent_items',
        severity: pulse.urgentCount > 3 ? 'critical' : 'warning',
        category: 'optimization',
        title: `${pulse.urgentCount} tarea${pulse.urgentCount > 1 ? 's' : ''} urgente${pulse.urgentCount > 1 ? 's' : ''} activa${pulse.urgentCount > 1 ? 's' : ''}`,
        description: 'Las tareas urgentes requieren atención prioritaria. La IA puede ayudar a priorizar y reasignar.',
        metric: `${pulse.urgentCount} URGENTES`,
        actionLabel: 'Priorizar urgentes',
        actionCommand: 'mis solicitudes urgentes',
        timestamp: now
      });
    }

    // 6. Success: Good system health
    if (pulse.overallScore >= 85 && pulse.overdueCount === 0) {
      insights.push({
        id: 'system_healthy',
        severity: 'success',
        category: 'suggestion',
        title: 'Sistema operando óptimamente',
        description: `Score de salud: ${pulse.overallScore}/100. Sin SLA vencidos. Buen throughput.`,
        metric: `${pulse.overallScore}%`,
        timestamp: now
      });
    }

    // 7. Low collaborator warning
    if (pulse.activeLoad > 5 && pulse.onlineCollaborators < 2) {
      insights.push({
        id: 'low_collaborators',
        severity: 'warning',
        category: 'anomaly',
        title: 'Pocos colaboradores activos',
        description: `${pulse.activeLoad} tareas activas pero solo ${pulse.onlineCollaborators} colaborador${pulse.onlineCollaborators !== 1 ? 'es' : ''} online. Riesgo de cuello de botella.`,
        metric: `${pulse.onlineCollaborators} ONLINE`,
        timestamp: now
      });
    }

    return insights.sort((a, b) => {
      const severityOrder: Record<InsightSeverity, number> = {
        critical: 0, warning: 1, info: 2, success: 3
      };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Get role-based quick actions for the copilot.
   */
  getQuickActions(role?: string): QuickAction[] {
    const base: QuickAction[] = [
      {
        id: 'system_scan',
        icon: '[SYS]',
        label: 'SCAN GLOBAL',
        command: 'resumen del sistema completo',
        color: 'violet',
        description: 'Análisis completo del estado del sistema'
      },
      {
        id: 'detect_bottleneck',
        icon: '[SRC]',
        label: 'DETECTAR CUELLOS',
        command: 'identificar cuellos de botella',
        color: 'amber',
        description: 'Identificar departamentos sobrecargados'
      }
    ];

    if (role === 'ADMINISTRADOR' || role === 'REVISOR') {
      base.push(
        {
          id: 'escalate_urgent',
          icon: '[URG]',
          label: 'ESCALAR URGENTES',
          command: 'escalar urgentes',
          color: 'red',
          description: 'Escalar todas las tareas urgentes'
        },
        {
          id: 'optimize_flow',
          icon: '[OPT]',
          label: 'OPTIMIZAR FLUJO',
          command: 'sugerir optimizaciones de flujo',
          color: 'emerald',
          description: 'Sugerencias de redistribución inteligente'
        },
        {
          id: 'sla_analysis',
          icon: '[SLA]',
          label: 'ANÁLISIS SLA',
          command: 'analizar vencimientos cercanos',
          color: 'blue',
          description: 'Revisar solicitudes próximas a vencer'
        }
      );
    }

    if (role === 'ADMINISTRADOR') {
      base.push({
        id: 'auto_distribute',
        icon: '[AUT]',
        label: 'AUTO-DISTRIBUIR',
        command: 'distribuir carga de trabajo equitativamente entre departamentos',
        color: 'cyan',
        description: 'IA redistribuye la carga automáticamente'
      });
    }

    return base;
  }

  // ── Helpers ─────────────────────────────────────────────

  private emptyPulse(presencia: PresenciaResumen | null): SystemPulse {
    return {
      overallScore: 100,
      slaCompliance: 100,
      throughputRate: 0,
      bottleneckRisk: 0,
      activeLoad: 0,
      urgentCount: 0,
      overdueCount: 0,
      atRiskCount: 0,
      onlineCollaborators: presencia?.totalOnlineVisible ?? 0,
      departmentCount: 0,
      trend: 'stable'
    };
  }

  private countByField(items: SolicitudResponse[], field: keyof SolicitudResponse, value: string): number {
    return items.filter(i => (i as any)[field] === value).length;
  }

  private normalize(text?: string | null): string {
    return (text ?? '').trim().toLowerCase();
  }
}

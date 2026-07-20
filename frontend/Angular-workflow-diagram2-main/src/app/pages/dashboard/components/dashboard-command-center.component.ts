import { Component, OnInit, inject, computed, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ActivityStream, WorkspaceEvent } from '../../../runtime/activity-stream.service';
import { PresenceEngine, PeerPresence } from '../../../runtime/presence-engine.service';
import { AttentionEngine } from '../../../runtime/attention-engine.service';
import { DependencyResolver } from '../../../runtime/dependency-resolver.service';
import { WorkspaceMemory } from '../../../runtime/workspace-memory.service';
import { OperationalPrioritizationEngine } from '../../../runtime/operational-prioritization-engine.service';
import { WorkspaceRuntimeCoordinator } from '../../../runtime/workspace-runtime-coordinator.service';

interface ScenarioStep {
  label: string;
  message: string;
  actor: string;
  action: () => void;
  metrics: { slaCompliance: number; workloadDensity: number; activeProcesses: number };
}

@Component({
  selector: 'app-dashboard-command-center',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './dashboard-command-center.component.html',
  styleUrl: './dashboard-command-center.component.css'
})
export class DashboardCommandCenterComponent implements OnInit, OnDestroy {
  public activity = inject(ActivityStream);
  public presence = inject(PresenceEngine);
  public attention = inject(AttentionEngine);
  public dependencies = inject(DependencyResolver);
  public memory = inject(WorkspaceMemory);
  public prioritization = inject(OperationalPrioritizationEngine);
  private coordinator = inject(WorkspaceRuntimeCoordinator);

  private mockEventTimer: any;

  // Active department summary metrics
  public departmentHealth = signal({
    slaCompliance: 96.8,
    workloadDensity: 74,
    activeProcesses: 8,
    complianceRisk: 'LOW'
  });

  // Dynamic user-selectable operational roles
  public currentRole = signal<'Analyst' | 'Supervisor' | 'Compliance' | 'Director' | 'Auditor'>('Director');

  // Pre-configured storytelling scenarios for evaluator demos
  public currentScenarioName = signal<string>('');
  public currentScenarioStepIndex = signal<number>(-1);
  public activeScenarioSteps = signal<ScenarioStep[]>([]);
  public isSimulating = computed(() => this.currentScenarioStepIndex() !== -1);

  // Active node selection for visual graph inspector
  public selectedGraphNode = signal<any | null>(null);
  private nodePositions = signal<Record<string, { x: number; y: number }>>({});
  private dragState = signal<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
  } | null>(null);

  // Narrative simulation decks
  private hrScenarioSteps: ScenarioStep[] = [
    {
      label: 'RRHH inicia reclutamiento',
      message: 'Solicitud abierta para contratación de Director de Tecnología',
      actor: 'RRHH.Talent',
      action: () => {
        this.memory.updateGraphNode({ id: 'task-hr-hire', type: 'TASK', title: 'Talent Acquisition Request: Director TI', state: 'ACTIVE' });
      },
      metrics: { slaCompliance: 98.2, workloadDensity: 78, activeProcesses: 9 }
    },
    {
      label: 'Generación del contrato',
      message: 'Borrador de propuesta contractual cargada en el repositorio DMS',
      actor: 'Legal.Advisor',
      action: () => {
        this.memory.updateGraphNode({ id: 'doc-hr-contract', type: 'DOCUMENT', title: 'Propuesta Contrato Director TI v1.0', state: 'PUBLISHED' });
        this.memory.addGraphEdge({ source: 'task-hr-hire', target: 'doc-hr-contract', type: 'VALIDATES' });
      },
      metrics: { slaCompliance: 98.2, workloadDensity: 80, activeProcesses: 9 }
    },
    {
      label: 'Violación de políticas',
      message: 'Fallo de cumplimiento: Contrato carece de cláusula de confidencialidad estándar',
      actor: 'System.Audit',
      action: () => {
        this.memory.updateGraphNode({ id: 'doc-hr-contract', type: 'DOCUMENT', title: 'Propuesta Contrato Director TI v1.0', state: 'BLOCKED' });
        this.memory.addGraphEdge({ source: 'task-hr-hire', target: 'doc-hr-contract', type: 'BLOCKED_BY' });
      },
      metrics: { slaCompliance: 92.5, workloadDensity: 84, activeProcesses: 9 }
    },
    {
      label: 'SLA entra en riesgo',
      message: 'Riesgo Crítico de SLA detectado: Aprobación pendiente excede 4 horas de margen',
      actor: 'System.Monitor',
      action: () => {
        this.memory.updateGraphNode({ id: 'task-hr-hire', type: 'TASK', title: 'Talent Acquisition Request: Director TI', state: 'SLA_CRITICAL' });
      },
      metrics: { slaCompliance: 76.4, workloadDensity: 84, activeProcesses: 9 }
    },
    {
      label: 'Firma y resolución',
      message: 'Supervisor aprueba cláusula y firma digitalmente. SLA restablecido',
      actor: 'Supervisor.M',
      action: () => {
        this.memory.updateGraphNode({ id: 'task-hr-hire', type: 'TASK', title: 'Talent Acquisition Request: Director TI', state: 'ACTIVE' });
        this.memory.updateGraphNode({ id: 'doc-hr-contract', type: 'DOCUMENT', title: 'Propuesta Contrato Director TI v1.0', state: 'PUBLISHED' });
        this.memory.removeGraphEdge('task-hr-hire', 'doc-hr-contract', 'BLOCKED_BY');
      },
      metrics: { slaCompliance: 97.5, workloadDensity: 74, activeProcesses: 8 }
    }
  ];

  private financeScenarioSteps: ScenarioStep[] = [
    {
      label: 'Requisición de hardware',
      message: 'Infraestructura solicita compra urgente de servidores de contingencia',
      actor: 'Infra.Sys',
      action: () => {
        this.memory.updateGraphNode({ id: 'task-servers', type: 'TASK', title: 'Adquisición Servidores de Redundancia', state: 'ACTIVE' });
      },
      metrics: { slaCompliance: 96.8, workloadDensity: 78, activeProcesses: 9 }
    },
    {
      label: 'Bloqueo por firma',
      message: 'Proceso detenido: Esperando firma mancomunada de Contraloría',
      actor: 'Finance.Dept',
      action: () => {
        this.memory.updateGraphNode({ id: 'task-servers', type: 'TASK', title: 'Adquisición Servidores de Redundancia', state: 'BLOCKED' });
        this.memory.updateGraphNode({ id: 'doc-hardware-budget', type: 'DOCUMENT', title: 'hardware_budget_quotes.xlsx', state: 'BLOCKED' });
        this.memory.addGraphEdge({ source: 'task-servers', target: 'doc-hardware-budget', type: 'BLOCKED_BY' });
      },
      metrics: { slaCompliance: 84.1, workloadDensity: 82, activeProcesses: 9 }
    },
    {
      label: 'Liberación de bloqueo',
      message: 'Director autoriza presupuesto manualmente sobrepasando el límite de departamento',
      actor: 'Director.Gen',
      action: () => {
        this.memory.updateGraphNode({ id: 'task-servers', type: 'TASK', title: 'Adquisición Servidores de Redundancia', state: 'ACTIVE' });
        this.memory.removeGraphEdge('task-servers', 'doc-hardware-budget', 'BLOCKED_BY');
        this.memory.updateGraphNode({ id: 'doc-hardware-budget', type: 'DOCUMENT', title: 'hardware_budget_quotes.xlsx', state: 'PUBLISHED' });
      },
      metrics: { slaCompliance: 95.8, workloadDensity: 75, activeProcesses: 8 }
    }
  ];

  private complianceScenarioSteps: ScenarioStep[] = [
    {
      label: 'Auditoría de red externa',
      message: 'Oficial de Seguridad inicia auditoría general sobre accesos remotos',
      actor: 'Compliance.Off',
      action: () => {
        this.memory.updateGraphNode({ id: 'task-sec-audit', type: 'TASK', title: 'SecOps Penetration Test Audit', state: 'ACTIVE' });
      },
      metrics: { slaCompliance: 96.8, workloadDensity: 76, activeProcesses: 9 }
    },
    {
      label: 'Violación IP pública',
      message: 'Alerta de política: Esquema de subred expone IPs de producción',
      actor: 'System.Audit',
      action: () => {
        this.memory.updateGraphNode({ id: 'task-sec-audit', type: 'TASK', title: 'SecOps Penetration Test Audit', state: 'BLOCKED' });
        this.memory.updateGraphNode({ id: 'doc-schema-audit', type: 'DOCUMENT', title: 'DMZ Production Schema v1.0', state: 'BLOCKED' });
        this.memory.addGraphEdge({ source: 'task-sec-audit', target: 'doc-schema-audit', type: 'BLOCKED_BY' });
      },
      metrics: { slaCompliance: 78.5, workloadDensity: 80, activeProcesses: 9 }
    },
    {
      label: 'Versión corregida',
      message: 'Ingeniero sube arquitectura DMZ v2 segura. Cumplimiento de política exitoso',
      actor: 'Sec.Architect',
      action: () => {
        this.memory.updateGraphNode({ id: 'task-sec-audit', type: 'TASK', title: 'SecOps Penetration Test Audit', state: 'ACTIVE' });
        this.memory.removeGraphEdge('task-sec-audit', 'doc-schema-audit', 'BLOCKED_BY');
        this.memory.updateGraphNode({ id: 'doc-schema-audit', type: 'DOCUMENT', title: 'DMZ Production Schema v2.0', state: 'PUBLISHED' });
      },
      metrics: { slaCompliance: 98.1, workloadDensity: 74, activeProcesses: 8 }
    }
  ];

  ngOnInit() {
    this.seedEcosystemData();
    this.startMockOperationalStream();
  }

  ngOnDestroy() {
    if (this.mockEventTimer) {
      clearInterval(this.mockEventTimer);
    }
  }

  // Switch role and update view permissions dynamically
  public switchRole(role: any) {
    this.currentRole.set(role);
    console.log('[Role Intelligence] Switch active contextual workspace view to:', role);
  }

  // Simulator Engine Methods
  public startScenario(type: 'RRHH' | 'FINANZAS' | 'COMPLIANCE') {
    this.resetSimulation();
    if (type === 'RRHH') {
      this.currentScenarioName.set('Escenario RRHH: Contratación Talentos');
      this.activeScenarioSteps.set(this.hrScenarioSteps);
    } else if (type === 'FINANZAS') {
      this.currentScenarioName.set('Escenario Finanzas: Adquisiciones Críticas');
      this.activeScenarioSteps.set(this.financeScenarioSteps);
    } else {
      this.currentScenarioName.set('Escenario Compliance: Auditoría de Seguridad');
      this.activeScenarioSteps.set(this.complianceScenarioSteps);
    }
    this.currentScenarioStepIndex.set(0);
    this.executeScenarioStep(0);
  }

  public advanceScenario() {
    const nextIdx = this.currentScenarioStepIndex() + 1;
    if (nextIdx < this.activeScenarioSteps().length) {
      this.currentScenarioStepIndex.set(nextIdx);
      this.executeScenarioStep(nextIdx);
    } else {
      // Completed scenario
      this.currentScenarioStepIndex.set(-1);
      this.currentScenarioName.set('');
      this.activeScenarioSteps.set([]);
    }
  }

  public resetSimulation() {
    this.currentScenarioStepIndex.set(-1);
    this.currentScenarioName.set('');
    this.activeScenarioSteps.set([]);
    this.seedEcosystemData();
    this.departmentHealth.set({
      slaCompliance: 96.8,
      workloadDensity: 74,
      activeProcesses: 8,
      complianceRisk: 'LOW'
    });
  }

  private executeScenarioStep(idx: number) {
    const step = this.activeScenarioSteps()[idx];
    if (!step) return;

    // Apply mutation action to WorkspaceMemory Graph
    step.action();

    // Trigger Reactive Coordinator processIncomingEvent
    const simEvent: WorkspaceEvent = {
      eventId: 'evt-sim-' + Date.now(),
      eventType: 'ScenarioSimulationStepEvent',
      actor: step.actor,
      message: step.message,
      timestamp: Date.now(),
      metadata: { priority: step.metrics.slaCompliance < 80 ? 'CRITICAL' : 'HIGH' }
    };
    this.coordinator.processIncomingEvent(simEvent);

    // Mutate overall metrics to reflect story status
    this.departmentHealth.set({
      slaCompliance: step.metrics.slaCompliance,
      workloadDensity: step.metrics.workloadDensity,
      activeProcesses: step.metrics.activeProcesses,
      complianceRisk: step.metrics.slaCompliance < 85 ? 'HIGH' : 'LOW'
    });
  }

  private seedEcosystemData() {
    this.nodePositions.set({});
    // Seed initial nodes in Workspace Memory to construct a live Operational Graph
    this.memory.loadInitialGraph({
      nodes: [
        { id: 'task-vendor', type: 'TASK', title: 'Vendor SLA Agreement Validation', state: 'SLA_CRITICAL' },
        { id: 'task-security', type: 'TASK', title: 'SecOps Audit Review', state: 'SLA_CRITICAL' },
        { id: 'task-procurement', type: 'TASK', title: 'Procurement Strategy drafting', state: 'BLOCKED' },
        { id: 'doc-contract', type: 'DOCUMENT', title: 'Corporate Contract SLA v3', state: 'REJECTED_BY_POLICY' },
        { id: 'doc-security-policy', type: 'DOCUMENT', title: 'Security Architecture Schema', state: 'PUBLISHED' },
        { id: 'doc-sla-spec', type: 'DOCUMENT', title: 'SLA Technical Specifications', state: 'DRAFT' }
      ],
      edges: [
        { source: 'task-procurement', target: 'doc-contract', type: 'BLOCKED_BY' },
        { source: 'task-vendor', target: 'doc-sla-spec', type: 'BLOCKED_BY' }
      ]
    });

    // Seed mock active peers
    const mockPeers = new Map<string, PeerPresence>();
    mockPeers.set('maria', {
      username: 'Maria.Reyes',
      activePath: '/documentos/editar/doc-contract',
      elementIdFocus: 'signature-pad',
      cursor: { x: 420, y: 310 },
      lastInteraction: Date.now()
    });
    mockPeers.set('rene', {
      username: 'Rene.H',
      activePath: '/bpmn-workspace',
      elementIdFocus: 'node-activity-revision',
      cursor: { x: 890, y: 150 },
      lastInteraction: Date.now()
    });
    mockPeers.set('finance_officer', {
      username: 'Finance.Dept',
      activePath: '/documentos',
      elementIdFocus: 'dms-list-panel',
      cursor: { x: 120, y: 560 },
      lastInteraction: Date.now()
    });
    this.presence.activePeers.set(mockPeers);

    // Seed mock events in Activity Stream
    this.activity.clearStream();
    this.activity.pushEvent({
      eventId: 'evt-1',
      eventType: 'DocumentUploadedEvent',
      actor: 'Maria.Reyes',
      message: 'Subió una nueva versión del contrato: Corporate Contract SLA v3',
      timestamp: Date.now() - 15 * 60 * 1000,
      metadata: { priority: 'LOW' }
    });
    this.activity.pushEvent({
      eventId: 'evt-2',
      eventType: 'ApprovalApprovedEvent',
      actor: 'Rene.H',
      message: 'Aprobó la política de seguridad departamental con firma criptográfica',
      timestamp: Date.now() - 10 * 60 * 1000,
      metadata: { priority: 'HIGH' }
    });
    this.activity.pushEvent({
      eventId: 'evt-3',
      eventType: 'PolicyViolationDetectedEvent',
      actor: 'System.Audit',
      message: 'Violación de políticas detectada: Contrato SLA v3 carece de anexo financiero obligatorio',
      timestamp: Date.now() - 5 * 60 * 1000,
      metadata: { priority: 'CRITICAL' }
    });
  }

  private startMockOperationalStream() {
    const mockEvents = [
      {
        eventType: 'TaskDependencyBlockedEvent',
        actor: 'Finance.Dept',
        message: 'Flujo de adquisiciones bloqueado: Esperando firma digital de Finanzas',
        metadata: { priority: 'HIGH', taskId: 'task-procurement', title: 'Procurement Strategy drafting', targetId: 'doc-contract', blockType: 'BLOCKED_BY' }
      },
      {
        eventType: 'SLAViolationDetectedEvent',
        actor: 'System.Monitor',
        message: 'Riesgo Crítico de SLA: Vendor SLA Agreement expira en 32 minutos',
        metadata: { priority: 'CRITICAL', taskId: 'task-vendor' }
      },
      {
        eventType: 'DocumentVersionPublishedEvent',
        actor: 'Maria.Reyes',
        message: 'Nueva versión de especificaciones publicada: SLA Technical Specifications v1.0',
        metadata: { priority: 'LOW', documentId: 'doc-sla-spec', title: 'SLA Technical Specifications' }
      }
    ];

    let index = 0;
    this.mockEventTimer = setInterval(() => {
      // Do not run mock stream while evaluator scenario simulation is executing
      if (this.isSimulating()) return;

      const template = mockEvents[index % mockEvents.length];
      const event: WorkspaceEvent = {
        eventId: 'evt-dyn-' + Date.now(),
        eventType: template.eventType,
        actor: template.actor,
        message: template.message,
        timestamp: Date.now(),
        metadata: template.metadata
      };

      this.coordinator.processIncomingEvent(event);
      index++;
    }, 15000);
  }

  // Computed layout for visual tree hierarchy graph
  public visualNodes = computed(() => {
    const graph = this.memory.graphCache();
    const nodes = graph.nodes;
    const overrides = this.nodePositions();

    let taskCount = 0;
    let docCount = 0;
    let otherCount = 0;

    return nodes.map((node) => {
      let x = 120;
      let y = 60;

      // Group nodes into distinct columns depending on domain category
      if (node.type === 'TASK') {
        x = 120;
        y = 60 + taskCount * 130;
        taskCount++;
      } else if (node.type === 'DOCUMENT') {
        x = 460;
        y = 60 + docCount * 130;
        docCount++;
      } else {
        x = 760;
        y = 60 + otherCount * 130;
        otherCount++;
      }

      return {
        ...node,
        x: overrides[node.id]?.x ?? x,
        y: overrides[node.id]?.y ?? y
      };
    });
  });

  // Computed edges mapping matching calculated coordinates
  public visualEdges = computed(() => {
    const vNodes = this.visualNodes();
    const edges = this.memory.graphCache().edges;

    return edges.map((edge) => {
      const srcNode = vNodes.find(n => n.id === edge.source);
      const tgtNode = vNodes.find(n => n.id === edge.target);

      return {
        ...edge,
        x1: (srcNode?.x || 0) + 110, // Anchor right side of rect
        y1: (srcNode?.y || 0) + 30,  // Anchor middle height
        x2: (tgtNode?.x || 0),       // Anchor left side of rect
        y2: (tgtNode?.y || 0) + 30
      };
    }).filter(e => e.x1 !== 110 && e.x2 !== 0);
  });

  public selectNode(node: any) {
    this.selectedGraphNode.set(node);
  }

  public isDraggingNode(nodeId: string): boolean {
    return this.dragState()?.nodeId === nodeId;
  }

  private getGraphPoint(event: PointerEvent, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  public onGraphPointerDown(node: any, event: PointerEvent) {
    const svg = (event.currentTarget as SVGGElement | null)?.ownerSVGElement;
    if (!svg) return;

    const point = this.getGraphPoint(event, svg);
    const startX = node?.x ?? 0;
    const startY = node?.y ?? 0;

    this.dragState.set({
      nodeId: node.id,
      offsetX: point.x - startX,
      offsetY: point.y - startY,
      startX,
      startY,
      hasMoved: false
    });

    (event.currentTarget as SVGGElement).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  public onGraphPointerMove(event: PointerEvent) {
    const drag = this.dragState();
    if (!drag) return;

    const svg = event.currentTarget as SVGSVGElement | null;
    if (!svg) return;

    const point = this.getGraphPoint(event, svg);
    const rawX = point.x - drag.offsetX;
    const rawY = point.y - drag.offsetY;

    const maxX = Math.max(0, svg.clientWidth - 200);
    const maxY = Math.max(0, svg.clientHeight - 60);
    const nextX = Math.min(Math.max(0, rawX), maxX);
    const nextY = Math.min(Math.max(0, rawY), maxY);

    const moved = Math.abs(nextX - drag.startX) > 3 || Math.abs(nextY - drag.startY) > 3;
    if (!drag.hasMoved && !moved) {
      return;
    }

    if (!drag.hasMoved && moved) {
      this.dragState.set({ ...drag, hasMoved: true });
    }

    this.nodePositions.update(current => ({
      ...current,
      [drag.nodeId]: { x: nextX, y: nextY }
    }));

    event.preventDefault();
  }

  public onGraphPointerUp(event: PointerEvent) {
    const drag = this.dragState();
    if (!drag) return;

    if (!drag.hasMoved) {
      const node = this.visualNodes().find(item => item.id === drag.nodeId);
      if (node) {
        this.selectNode(node);
      }
    }

    this.dragState.set(null);
    event.preventDefault();
  }

  // Helper properties computed dynamically
  public activeBlockedFlows = computed(() => {
    const graph = this.memory.graphCache();
    return graph.nodes
      .filter(n => n.type === 'TASK' && n.state === 'BLOCKED')
      .map(task => {
        const blocker = this.dependencies.isTaskBlocked(task.id);
        return {
          taskName: task.title,
          blockedBy: blocker.reason || 'Esperando firma o aprobación'
        };
      });
  });

  public activePeersList = computed(() => {
    return Array.from(this.presence.activePeers().values());
  });

  public getPeerActivityLabel(peer: PeerPresence): string {
    if (peer.activePath.includes('editar')) return 'Editando borrador online';
    if (peer.activePath.includes('bpmn-workspace')) return 'Modelando flujo operacional';
    return 'Navegando el repositorio';
  }

  public getEventPriorityClass(priority?: string): string {
    if (priority === 'CRITICAL') return 'priority-critical';
    if (priority === 'HIGH') return 'priority-high';
    return 'priority-low';
  }

  // Human-friendly event type mapping for presentations
  public getFriendlyEventType(type: string): string {
    if (type === 'DocumentUploadedEvent') return 'Documento Cargado';
    if (type === 'ApprovalApprovedEvent') return 'Firma Digital Registrada';
    if (type === 'PolicyViolationDetectedEvent') return 'Fallo de Cumplimiento (Compliance)';
    if (type === 'TaskDependencyBlockedEvent') return 'Dependencia Bloqueada';
    if (type === 'SLAViolationDetectedEvent') return 'Acuerdo de Nivel de Servicio Comprometido';
    if (type === 'DocumentVersionPublishedEvent') return 'Nueva Versión Publicada';
    if (type === 'ScenarioSimulationStepEvent') return 'Escenario Simulado';
    return 'Evento de Proceso';
  }
}

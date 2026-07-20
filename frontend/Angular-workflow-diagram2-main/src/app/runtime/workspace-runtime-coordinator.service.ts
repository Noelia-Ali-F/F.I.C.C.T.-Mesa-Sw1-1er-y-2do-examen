import { Injectable, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BASE_PATH } from '../api/variables';
import { ActivityStream, WorkspaceEvent } from './activity-stream.service';
import { WorkspaceMemory } from './workspace-memory.service';
import { DependencyResolver } from './dependency-resolver.service';
import { AttentionEngine } from './attention-engine.service';
import { NotificationOrchestrator } from './notification-orchestrator.service';
import { OperationalPrioritizationEngine } from './operational-prioritization-engine.service';
import { WorkflowDepartamentalService } from '../api/api/workflowDepartamental.service';
import { SolicitudResponse } from '../api/model/solicitudResponse';
import { catchError, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class WorkspaceRuntimeCoordinator {
  private http = inject(HttpClient);
  private basePath = inject(BASE_PATH);
  private activity = inject(ActivityStream);
  private memory = inject(WorkspaceMemory);
  private dependencies = inject(DependencyResolver);
  private attention = inject(AttentionEngine);
  private notifications = inject(NotificationOrchestrator);
  private priorityEngine = inject(OperationalPrioritizationEngine);
  private workflowApi = inject(WorkflowDepartamentalService);
  private auth = inject(AuthService);

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        this.initializeFromBackend();
      }
    });
  }

  /**
   * Initializes the operational graph and events list directly from the backend APIs.
   * This bridges the live MongoDB database with our high-speed client memory loop!
   */
  public initializeFromBackend(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    console.log('[Central Coordinator] Synchronizing live context and Event Backbone from Spring Boot Backend...');
    
    // 1. Fetch persistent graph from MongoDB
    this.memory.fetchGraphFromBackend();

    // 2. Fetch persistent events from MongoDB Event Backbone
    this.http.get<WorkspaceEvent[]>(`${this.basePath}/api/runtime/events`)
      .pipe(catchError(err => {
        console.warn('[Central Coordinator] Failed to fetch events from Event Backbone, fallback to stream', err);
        return of([]);
      }))
      .subscribe(events => {
        if (events && events.length > 0) {
          this.activity.clearStream();
          // Load events to client-side stream cache
          events.reverse().forEach(evt => this.activity.pushEvent(evt));
          console.log('[Central Coordinator] Loaded audit timeline logs from Event Backbone. Count:', events.length);
        }
      });

    // 3. Sync workflow tickets list to populate graph nodes dynamically
    const request$ = user.rol === 'SOLICITANTE'
      ? this.workflowApi.listarPorUsuario(user.username)
      : this.workflowApi.listarTodas();

    request$.subscribe({
      next: (res) => {
        const list: SolicitudResponse[] = (res as any).datos || res || [];
        
        list.forEach((sol) => {
          if (!sol.id || !sol.titulo) return;

          let state = 'ACTIVE';
          if (sol.estadoSla === 'VENCIDO' || sol.estadoSla === 'POR_VENCER') {
            state = 'SLA_CRITICAL';
          } else if (sol.estado === 'RECHAZADO') {
            state = 'BLOCKED';
          }

          this.memory.updateGraphNode({
            id: sol.id,
            type: 'TASK',
            title: sol.titulo,
            state: state
          });

          if (state === 'SLA_CRITICAL') {
            this.notifications.dispatchAlert(
              `Riesgo de SLA detectado para: ${sol.titulo}`,
              'CRITICAL',
              sol.id
            );
          }

          if (sol.archivosAdjuntos && sol.archivosAdjuntos.length > 0) {
            sol.archivosAdjuntos.forEach((adj) => {
              if (adj.id && adj.nombreOriginal) {
                this.memory.updateGraphNode({
                  id: adj.id,
                  type: 'DOCUMENT',
                  title: adj.nombreOriginal,
                  state: 'PUBLISHED'
                });

                this.memory.addGraphEdge({
                  source: sol.id!,
                  target: adj.id,
                  type: 'VALIDATES'
                });
              }
            });
          }
        });
      },
      error: (err) => {
        console.warn('[Central Coordinator] Failed to synchronize operational context from backend', err);
      }
    });
  }

  /**
   * Orchestrates the reactive cascade across all sub-engines upon receiving a new event
   */
  public processIncomingEvent(event: WorkspaceEvent): void {
    console.log('[Central Coordinator] Dispatching event:', event.eventType);

    // 1. Log to the in-memory Activity Stream for historical feed views
    this.activity.pushEvent(event);

    // 2. Persist to MongoDB central Event Backbone
    this.http.post<WorkspaceEvent>(`${this.basePath}/api/runtime/event`, event)
      .pipe(catchError(err => {
        console.warn('[Central Coordinator] Event Backbone persistence failed:', event.eventId, err);
        return of(null);
      }))
      .subscribe();

    // 3. Perform graph cache mutations in Workspace Memory
    this.applyEventToGraphCache(event);

    // 4. Trace immediate structural blockages using the Dependency Resolver
    const impactedNodeIds = this.resolveImpactedDependencies(event);

    // 5. Trigger context-aware notifications and system-level alerts
    this.notifications.dispatchAlert(
      event.message,
      event.metadata?.priority || 'LOW',
      event.metadata?.targetTaskId
    );
    
    // 6. Force background prioritization computation to update UI backlogs
    this.priorityEngine.getPrioritizedTaskStream();
  }

  private applyEventToGraphCache(event: WorkspaceEvent): void {
    if (event.eventType === 'DocumentVersionPublishedEvent') {
      this.memory.updateGraphNode({
        id: event.metadata.documentId,
        type: 'DOCUMENT',
        title: event.metadata.title,
        state: 'PUBLISHED'
      });
    } else if (event.eventType === 'TaskDependencyBlockedEvent') {
      this.memory.updateGraphNode({
        id: event.metadata.taskId,
        type: 'TASK',
        title: event.metadata.title,
        state: 'BLOCKED'
      });
      if (event.metadata.targetId && event.metadata.blockType) {
        this.memory.addGraphEdge({
          source: event.metadata.taskId,
          target: event.metadata.targetId,
          type: 'BLOCKED_BY'
        });
      }
    } else if (event.eventType === 'TaskDependencyResolvedEvent') {
      this.memory.updateGraphNode({
        id: event.metadata.taskId,
        type: 'TASK',
        title: event.metadata.title,
        state: 'ACTIVE'
      });
      if (event.metadata.targetId) {
        this.memory.removeGraphEdge(event.metadata.taskId, event.metadata.targetId, 'BLOCKED_BY');
      }
    }
  }

  private resolveImpactedDependencies(event: WorkspaceEvent): string[] {
    const impacted: string[] = [];
    if (event.metadata?.taskId) {
      const status = this.dependencies.isTaskBlocked(event.metadata.taskId);
      if (status.blocked) {
        impacted.push(event.metadata.taskId);
      }
    }
    return impacted;
  }
}

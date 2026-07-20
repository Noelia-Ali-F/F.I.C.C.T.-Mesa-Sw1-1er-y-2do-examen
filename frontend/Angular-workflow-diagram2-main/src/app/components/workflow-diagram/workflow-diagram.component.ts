import { Component, effect, inject, Injector, input, output, signal, untracked } from '@angular/core';
import { NgDiagramComponent, NgDiagramNodeTemplateMap, SelectionGestureEndedEvent, provideNgDiagram, initializeModel } from 'ng-diagram';
import { WorkflowNodeComponent } from '../workflow-node/workflow-node.component';
import { WorkflowDiagramService } from '../../workflow/workflow-diagram.service';

/**
 * Encapsulates the ng-diagram canvas, grid overlay, and custom node registration.
 * Owns provideNgDiagram() and builds the model internally with its own injector.
 * Delegates selection events to the parent via output signals.
 */
@Component({
  selector: 'app-workflow-diagram',
  standalone: true,
  imports: [NgDiagramComponent],
  providers: [provideNgDiagram()],
  template: `
    <div class="wf-diagram-shell">
      <div class="wf-grid-overlay"></div>
      
      <!-- Visual Swimlanes -->
      <div class="wf-swimlanes">
        <div class="swimlane">
          <div class="swimlane-header text-slate-550 bg-slate-50 border-b border-slate-200/60">L1: COLA INGRESO (SOLICITANTE)</div>
        </div>
        <div class="swimlane border-x border-slate-200/65 border-dashed">
          <div class="swimlane-header text-teal-700 bg-teal-50/30 border-b border-slate-200/60">L2: REVISIÓN DEPARTAMENTO</div>
        </div>
        <div class="swimlane">
          <div class="swimlane-header text-amber-700 bg-amber-50/30 border-b border-slate-200/60">L3: RESOLUCIÓN FINAL</div>
        </div>
      </div>

      <ng-diagram
        [model]="diagramModel()"
        [config]="config()"
        [nodeTemplateMap]="nodeTemplateMap"
        (selectionGestureEnded)="onSelectionEnded($event)" />
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      height: 480px;
    }

    .wf-diagram-shell {
      position: relative;
      width: 100%;
      height: 100%;
      border: 1px solid var(--theme-element-border-color);
      background: #ffffff;
      box-shadow: var(--theme-shadow-sm);
      border-radius: 1.25rem;
      overflow: hidden;
      display: block;
    }

    .wf-grid-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(148, 163, 184, 0.28) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 163, 184, 0.28) 1px, transparent 1px);
      background-size: 18px 18px;
      opacity: 0.4;
      z-index: 1;
    }

    .wf-swimlanes {
      position: absolute;
      inset: 0;
      display: flex;
      z-index: 0;
      pointer-events: none;
    }

    .swimlane {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .swimlane-header {
      width: 100%;
      padding: 0.5rem 1rem;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-align: center;
      font-family: monospace;
    }

    /* Poner ng-diagram por encima de las lanes para que intercepte clicks */
    ng-diagram {
      position: absolute;
      inset: 0;
      z-index: 2;
      width: 100%;
      height: 100%;
    }

    /* ---- ng-diagram theme overrides ---- */
    :host ::ng-deep ng-diagram {
      --ngd-node-border-radius: 0;
      --ngd-node-border-size: 0;
      --ngd-node-border-color: transparent;
      --ngd-node-border-color-hover: transparent;
      --ngd-node-background-color: transparent;
      --ngd-selected-node-box-shadow: none;
      --ngd-default-edge-stroke: #2563eb;
      --ngd-default-edge-stroke-hover: #1d4ed8;
      --ngd-default-edge-stroke-selected: #1d4ed8;
      --ngd-box-selection-border-color: #2563eb;
      --ngd-box-selection-background: rgba(37, 99, 235, 0.12);
      --ngd-background-dot-color: rgba(15, 23, 42, 0.35);
    }

    :host ::ng-deep ng-diagram-base-edge path {
      stroke-width: 2.4px;
    }

    :host ::ng-deep ng-diagram-base-edge.selected path {
      stroke: #1d4ed8;
    }

    @media (max-width: 1279px) {
      :host {
        height: 380px;
      }
    }

    @media (max-width: 640px) {
      :host {
        height: 340px;
      }
    }
  `]
})
export class WorkflowDiagramComponent {
  private injector = inject(Injector);
  private diagramService = inject(WorkflowDiagramService);

  /** Raw stats data from backend — when set, triggers model rebuild */
  stats = input<Record<string, any> | null>(null);
  config = input<any>({});

  selectionEnded = output<SelectionGestureEndedEvent>();

  /** Start with an empty model so ng-diagram always has something to render */
  diagramModel = signal<any>(initializeModel());

  /** Register the custom workflow node template */
  nodeTemplateMap = new NgDiagramNodeTemplateMap([
    ['workflow-state', WorkflowNodeComponent]
  ]);

  private lastStatsJson = '';

  constructor() {
    effect(() => {
      const s = this.stats();
      if (s && Object.keys(s).length > 0) {
        const currentJson = JSON.stringify(s);
        if (currentJson === this.lastStatsJson) return;

        untracked(() => {
          this.lastStatsJson = currentJson;
          this.diagramModel.set(
            this.diagramService.buildModel(s, this.injector)
          );
        });
      }
    });
  }

  onSelectionEnded(event: SelectionGestureEndedEvent) {
    this.selectionEnded.emit(event);
  }
}

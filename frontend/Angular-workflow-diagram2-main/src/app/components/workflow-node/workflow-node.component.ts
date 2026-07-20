import { Component, computed, input } from '@angular/core';
import { NgDiagramNodeTemplate, NgDiagramPortComponent, SimpleNode } from 'ng-diagram';
import { WorkflowNodeData } from '../../models/workflow.models';

/**
 * Custom ng-diagram node for workflow state visualization.
 * Implements NgDiagramNodeTemplate to replace the default node with
 * a rich, state-aware visual that includes icon, label, and counter.
 */
@Component({
  selector: 'app-workflow-node',
  standalone: true,
  imports: [NgDiagramPortComponent],
  template: `
    <div class="wf-node" [style.--node-accent]="nodeData().color">
      <!-- Gradient/Glow background for selected states -->
      <div class="wf-node__glow"></div>
      
      <div class="wf-node__layout">
        <!-- Icon Section -->
        <div class="wf-node__icon-section" [style.background]="nodeData().color + '15'" [style.color]="nodeData().color">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path [attr.d]="nodeData().iconPath" />
          </svg>
        </div>

        <!-- Info Section -->
        <div class="wf-node__info">
          <span class="wf-node__label">{{ nodeData().label }}</span>
          <span class="wf-node__sublabel">Estado del flujo</span>
        </div>

        <!-- Count Section -->
        <div class="wf-node__count-section">
          <span class="wf-node__count-val">{{ nodeData().count }}</span>
          <span class="wf-node__count-lbl">Casos</span>
        </div>
      </div>
      <div class="wf-node__status-bar" [style.background]="nodeData().color"></div>
    </div>

    <ng-diagram-port id="port-left" type="both" side="left" />
    <ng-diagram-port id="port-right" type="both" side="right" />
  `,
  styles: [`
    :host {
      display: block;
    }

    .wf-node {
      position: relative;
      min-width: 14.5rem;
      border: 1px solid color-mix(in srgb, var(--node-accent, var(--theme-slate-500)) 30%, rgba(255, 255, 255, 0.9));
      border-radius: 1.15rem;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(16px);
      box-shadow: 0 10px 25px -10px color-mix(in srgb, var(--node-accent, #1e293b) 15%, rgba(15, 23, 42, 0.15)), inset 0 1px 0 rgba(255, 255, 255, 1);
      transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
      cursor: pointer;
    }

    .wf-node__glow {
      position: absolute;
      inset: 0;
      background: radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--node-accent) 15%, transparent) 0%, transparent 80%);
      opacity: 0;
      transition: opacity 300ms ease;
      pointer-events: none;
    }

    .wf-node:hover {
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 16px 35px -12px color-mix(in srgb, var(--node-accent, #2563eb) 30%, rgba(15, 23, 42, 0.2)), inset 0 1px 0 rgba(255, 255, 255, 1);
      background: rgba(255, 255, 255, 0.9);
      border-color: color-mix(in srgb, var(--node-accent, #2563eb) 50%, transparent);
    }
    .wf-node:hover .wf-node__glow {
      opacity: 1;
    }

    :host-context(.ng-diagram-node-selected) .wf-node {
      border-width: 2px;
      border-color: var(--node-accent, #2563eb);
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--node-accent, #2563eb) 15%, transparent), 0 20px 40px -16px color-mix(in srgb, var(--node-accent, #2563eb) 40%, rgba(15, 23, 42, 0.4));
      transform: translateY(-2px) scale(1.03);
    }
    :host-context(.ng-diagram-node-selected) .wf-node__glow {
      opacity: 1;
      background: radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--node-accent) 25%, transparent) 0%, transparent 90%);
    }

    .wf-node__layout {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      padding: 0.65rem 0.85rem;
      gap: 0.75rem;
    }

    .wf-node__icon-section {
      width: 2.15rem;
      height: 2.15rem;
      border-radius: 0.65rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1px solid color-mix(in srgb, var(--node-accent) 20%, transparent);
    }

    .wf-node__icon-section svg {
      width: 1.1rem;
      height: 1.1rem;
    }

    .wf-node__info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      gap: 0.1rem;
    }

    .wf-node__label {
      font-size: 0.68rem;
      font-weight: 800;
      color: var(--theme-border-text-color);
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .wf-node__sublabel {
      font-size: 0.5rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
    }

    .wf-node__count-section {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      padding-left: 0.75rem;
      border-left: 1px dashed rgba(203, 213, 225, 0.6);
    }

    .wf-node__count-val {
      font-size: 1.25rem;
      font-weight: 900;
      color: var(--node-accent, #0f172a);
      line-height: 1;
    }

    .wf-node__count-lbl {
      font-size: 0.45rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      margin-top: 0.15rem;
    }

    .wf-node__status-bar {
      height: 3px;
      width: 100%;
      opacity: 0.8;
      position: absolute;
      bottom: 0;
      left: 0;
    }
  `]
})
export class WorkflowNodeComponent implements NgDiagramNodeTemplate<WorkflowNodeData> {
  node = input.required<SimpleNode<WorkflowNodeData>>();

  nodeData = computed(() => this.node().data);
}

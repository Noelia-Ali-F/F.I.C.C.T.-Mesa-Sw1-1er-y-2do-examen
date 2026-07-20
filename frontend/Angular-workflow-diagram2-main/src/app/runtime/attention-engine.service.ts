import { Injectable, computed, inject } from '@angular/core';
import { WorkspaceMemory } from './workspace-memory.service';

@Injectable({
  providedIn: 'root'
})
export class AttentionEngine {
  private memory = inject(WorkspaceMemory);

  // Computes active nodes in the local environment that require human intervention
  public attentionTargets = computed(() => {
    const graph = this.memory.graphCache();
    return graph.nodes.filter(node => {
      // Direct attention markers on SLA risk states or policy rejections
      if (node.type === 'TASK' && (node.state === 'SLA_CRITICAL' || node.state === 'BLOCKED')) {
        return true;
      }
      if (node.type === 'DOCUMENT' && node.state === 'REJECTED_BY_POLICY') {
        return true;
      }
      return false;
    });
  });

  public activeUrgentAlertsCount = computed(() => this.attentionTargets().length);
}

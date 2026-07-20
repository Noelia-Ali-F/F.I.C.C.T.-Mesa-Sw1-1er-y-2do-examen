import { Injectable, inject } from '@angular/core';
import { WorkspaceMemory, GraphNode } from './workspace-memory.service';

@Injectable({
  providedIn: 'root'
})
export class OperationalPrioritizationEngine {
  private memory = inject(WorkspaceMemory);

  /**
   * Sorts active tasks dynamically based on computed dependency weight and SLA constraints
   */
  public getPrioritizedTaskStream(): (GraphNode & { priorityScore: number })[] {
    const graph = this.memory.graphCache();
    return graph.nodes
      .filter(n => n.type === 'TASK')
      .map(task => ({
        ...task,
        priorityScore: this.calculateOperationalScore(task)
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }

  private calculateOperationalScore(task: GraphNode): number {
    let score = 0;
    if (task.state === 'SLA_CRITICAL') score += 50;
    if (task.state === 'BLOCKED') score += 30;
    
    // Add additional weights depending on outbound blocking dependencies in the Graph Cache
    const blockingEdges = this.memory.graphCache().edges.filter(e => e.source === task.id && e.type === 'BLOCKED_BY');
    score += blockingEdges.length * 15;
    
    return score;
  }
}

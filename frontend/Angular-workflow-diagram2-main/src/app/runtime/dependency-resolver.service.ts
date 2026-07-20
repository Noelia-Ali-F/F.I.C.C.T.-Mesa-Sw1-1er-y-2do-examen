import { Injectable, inject } from '@angular/core';
import { WorkspaceMemory } from './workspace-memory.service';

@Injectable({
  providedIn: 'root'
})
export class DependencyResolver {
  private memory = inject(WorkspaceMemory);

  /**
   * Evaluates if a task is currently blocked by outward document signatures or policy audits
   */
  public isTaskBlocked(taskId: string): { blocked: boolean; blockingNodeId?: string; reason?: string } {
    const graph = this.memory.graphCache();
    const taskNode = graph.nodes.find(n => n.id === taskId);
    if (!taskNode) return { blocked: false };

    // Inspect direct outgoing blocker edges in the Graph Cache
    const blockEdge = graph.edges.find(e => e.source === taskId && e.type === 'BLOCKED_BY');
    if (blockEdge) {
      const blockingNode = graph.nodes.find(n => n.id === blockEdge.target);
      return {
        blocked: true,
        blockingNodeId: blockEdge.target,
        reason: `Blocked by validation gate on: ${blockingNode?.title || 'External asset'}`
      };
    }

    return { blocked: false };
  }

  /**
   * Tracks recursive dependencies to find structural bottlenecks
   */
  public findStructuralBottlenecks(startNodeId: string): string[] {
    const graph = this.memory.graphCache();
    const visited = new Set<string>();
    const path: string[] = [];

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const outgoing = graph.edges.filter(e => e.source === nodeId);
      for (const edge of outgoing) {
        path.push(edge.target);
        traverse(edge.target);
      }
    };

    traverse(startNodeId);
    return path;
  }
}

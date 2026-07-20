import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BASE_PATH } from '../api/variables';
import { catchError, of } from 'rxjs';

export interface GraphNode {
  id: string;
  type: 'TASK' | 'DOCUMENT' | 'USER' | 'DEPARTMENT' | 'POLICY';
  title: string;
  state: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'CREATES' | 'REQUIRES' | 'VALIDATES' | 'BLOCKED_BY';
}

export interface WorkspaceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

@Injectable({
  providedIn: 'root'
})
export class WorkspaceMemory {
  private http = inject(HttpClient);
  private basePath = inject(BASE_PATH);

  // Client-side Graph Cache representation
  public graphCache = signal<WorkspaceGraph>({ nodes: [], edges: [] });

  /**
   * Fetch the persisted knowledge graph from the backend MongoDB.
   */
  public fetchGraphFromBackend() {
    this.http.get<WorkspaceGraph>(`${this.basePath}/api/runtime/graph`)
      .pipe(
        catchError(err => {
          console.warn('[WorkspaceMemory] Failed to load persisted graph from MongoDB, using mock fallback', err);
          return of({ nodes: [], edges: [] });
        })
      )
      .subscribe(graph => {
        if (graph && graph.nodes) {
          this.graphCache.set(graph);
          console.log('[WorkspaceMemory] Graph loaded and synchronized from MongoDB. Total nodes:', graph.nodes.length);
        }
      });
  }

  public updateGraphNode(node: GraphNode) {
    // 1. Optimistic Client-Side Update
    this.graphCache.update(current => {
      const idx = current.nodes.findIndex(n => n.id === node.id);
      const updatedNodes = [...current.nodes];
      if (idx !== -1) {
        updatedNodes[idx] = { ...updatedNodes[idx], ...node };
      } else {
        updatedNodes.push(node);
      }
      return { ...current, nodes: updatedNodes };
    });

    // 2. Persistent Backend Synchronization
    this.http.post<WorkspaceGraph>(`${this.basePath}/api/runtime/graph/node`, node)
      .pipe(catchError(err => {
        console.warn('[WorkspaceMemory] Direct persistence failed for node:', node.id, err);
        return of(null);
      }))
      .subscribe();
  }

  public removeGraphNode(nodeId: string) {
    this.graphCache.update(current => ({
      nodes: current.nodes.filter(n => n.id !== nodeId),
      edges: current.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    }));

    this.http.delete<WorkspaceGraph>(`${this.basePath}/api/runtime/graph/node/${nodeId}`)
      .pipe(catchError(err => {
        console.warn('[WorkspaceMemory] Node deletion persistence failed:', nodeId, err);
        return of(null);
      }))
      .subscribe();
  }

  public addGraphEdge(edge: GraphEdge) {
    this.graphCache.update(current => {
      const exists = current.edges.some(e => e.source === edge.source && e.target === edge.target && e.type === edge.type);
      if (exists) return current;
      return {
        ...current,
        edges: [...current.edges, edge]
      };
    });

    this.http.post<WorkspaceGraph>(`${this.basePath}/api/runtime/graph/edge`, edge)
      .pipe(catchError(err => {
        console.warn('[WorkspaceMemory] Edge addition persistence failed:', edge, err);
        return of(null);
      }))
      .subscribe();
  }

  public removeGraphEdge(source: string, target: string, type: string) {
    this.graphCache.update(current => ({
      ...current,
      edges: current.edges.filter(e => !(e.source === source && e.target === target && e.type === type))
    }));

    this.http.post<WorkspaceGraph>(`${this.basePath}/api/runtime/graph/edge/remove`, { source, target, type })
      .pipe(catchError(err => {
        console.warn('[WorkspaceMemory] Edge removal persistence failed:', source, target, err);
        return of(null);
      }))
      .subscribe();
  }

  public loadInitialGraph(graph: WorkspaceGraph) {
    this.graphCache.set(graph);
  }

  public resetGraphOnBackend() {
    this.http.post<WorkspaceGraph>(`${this.basePath}/api/runtime/graph/reset`, {})
      .subscribe(graph => {
        if (graph) {
          this.graphCache.set(graph);
          console.log('[WorkspaceMemory] Graph reset and initialized on MongoDB');
        }
      });
  }
}

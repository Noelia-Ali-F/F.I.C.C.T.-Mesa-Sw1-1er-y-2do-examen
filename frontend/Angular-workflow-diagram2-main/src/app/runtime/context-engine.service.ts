import { Injectable, signal, computed } from '@angular/core';

export interface OperationalContext {
  organizationId: string;
  departmentId: string;
  processId?: string;
  taskId?: string;
  documentId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContextEngine {
  // Current active cognitive focus of the user in the Workspace
  public currentContext = signal<OperationalContext | null>(null);

  // Computed helper signals to optimize change detection across the UI
  public isInProcessContext = computed(() => !!this.currentContext()?.processId);
  public activeTaskId = computed(() => this.currentContext()?.taskId);
  public activeDepartmentId = computed(() => this.currentContext()?.departmentId);

  public setContext(newContext: OperationalContext) {
    console.log('[ContextEngine] Context locked:', newContext);
    this.currentContext.set(newContext);
  }

  public clearContext() {
    console.log('[ContextEngine] Context released');
    this.currentContext.set(null);
  }
}

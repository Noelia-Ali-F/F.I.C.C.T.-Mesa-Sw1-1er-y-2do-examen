import { Injectable, inject } from '@angular/core';
import { ContextEngine } from './context-engine.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationOrchestrator {
  private context = inject(ContextEngine);

  public dispatchAlert(message: string, priority: 'LOW' | 'HIGH' | 'CRITICAL', contextScope?: string) {
    const currentScope = this.context.currentContext()?.taskId;

    // Filter notification based on cognitive focus
    if (contextScope && currentScope === contextScope && priority !== 'CRITICAL') {
      // User is currently looking at this context. Post as inline micro-notification
      console.log(`[Context-Inline Alert] ${message}`);
    } else {
      // Trigger systemic interruption
      this.triggerPushNotification(message, priority);
    }
  }

  private triggerPushNotification(msg: string, priority: string) {
    console.log(`[Notification Orchestrator] [${priority}] Dispatching: ${msg}`);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Ecosistema Operacional', { body: msg });
    }
  }
}

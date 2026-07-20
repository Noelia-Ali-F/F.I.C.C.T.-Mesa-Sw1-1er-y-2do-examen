import { Injectable, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { WorkflowSupportService } from '../workflow/workflow-support.service';

@Injectable({
  providedIn: 'root'
})
export class LiveCollaborationBus {
  private workflowSupport = inject(WorkflowSupportService);
  private messageSubjects = new Map<string, Subject<any>>();
  private sseSub: any;

  constructor() {
    this.initSseStream();
  }

  private initSseStream() {
    try {
      const { events$ } = this.workflowSupport.suscribirEventosBpmn('system-presence');
      this.sseSub = events$.subscribe({
        next: (event) => {
          this.routeIncomingSseEvent(event);
        },
        error: (err) => {
          console.warn('[CollabBus] SSE Stream error, auto-reconnecting...', err);
          setTimeout(() => this.initSseStream(), 5000);
        }
      });
    } catch (e) {
      console.error('[CollabBus] Failed to initialize SSE stream', e);
    }
  }

  private routeIncomingSseEvent(event: { type: string; data: any }) {
    // Route incoming events to the appropriate internal subjects based on their type
    const topic = `/topic/${event.type.toLowerCase()}`;
    const subject = this.messageSubjects.get(topic);
    if (subject) {
      subject.next(event.data);
    }
  }

  public subscribeToTopic(topic: string, callback: (msg: any) => void): Observable<any> {
    if (!this.messageSubjects.has(topic)) {
      this.messageSubjects.set(topic, new Subject<any>());
    }
    const subject = this.messageSubjects.get(topic)!;
    subject.subscribe(callback);
    return subject.asObservable();
  }

  public publish(destination: string, payload: any): void {
    // Leverage the backend collaboration REST emitter to broadcast SSE
    this.workflowSupport.emitirEventoColaborativo('system-presence', destination, payload).subscribe({
      error: (e) => console.error('[CollabBus] Publish failed', e)
    });
  }
}

import { Injectable, signal } from '@angular/core';

export interface WorkspaceEvent {
  eventId: string;
  eventType: string;
  actor: string;
  message: string;
  timestamp: number;
  metadata: any;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityStream {
  public liveEvents = signal<WorkspaceEvent[]>([]);

  public pushEvent(event: WorkspaceEvent) {
    this.liveEvents.update(current => [event, ...current.slice(0, 99)]); // Keep last 100 entries in cache
  }

  public clearStream() {
    this.liveEvents.set([]);
  }
}

import { Injectable, signal, inject } from '@angular/core';
import { LiveCollaborationBus } from './live-collaboration-bus.service';

export interface PeerPresence {
  username: string;
  activePath: string;
  elementIdFocus?: string;
  cursor: { x: number; y: number };
  lastInteraction: number;
}

@Injectable({
  providedIn: 'root'
})
export class PresenceEngine {
  private collabBus = inject(LiveCollaborationBus);
  
  // Stores presence map for all peer sessions currently connected to this scope
  public activePeers = signal<Map<string, PeerPresence>>(new Map());

  constructor() {
    // Intercept SSE / WebSocket presence broadcasts
    this.collabBus.subscribeToTopic('/topic/colaboracion', (message: any) => {
      if (message && message.evento) {
        this.handlePeerPresenceUpdate(message);
      }
    });
  }

  public publishMyFocus(path: string, elementId?: string) {
    this.collabBus.publish('PRESENCE_FOCUS', {
      activePath: path,
      elementIdFocus: elementId,
      timestamp: Date.now()
    });
  }

  public publishMyCursor(x: number, y: number) {
    this.collabBus.publish('PRESENCE_CURSOR', { x, y });
  }

  private handlePeerPresenceUpdate(msg: any) {
    const username = msg.usuario || 'anonimo';
    const payload = msg.evento?.payload || {};
    const type = msg.evento?.tipo;

    this.activePeers.update(peers => {
      const newPeers = new Map(peers);
      const existing: PeerPresence = newPeers.get(username) || {
        username,
        activePath: '',
        elementIdFocus: undefined,
        cursor: { x: 0, y: 0 },
        lastInteraction: Date.now()
      };

      if (type === 'PRESENCE_FOCUS') {
        existing.activePath = payload.activePath;
        existing.elementIdFocus = payload.elementIdFocus;
      } else if (type === 'PRESENCE_CURSOR') {
        existing.cursor = { x: payload.x, y: payload.y };
      }

      existing.lastInteraction = Date.now();
      newPeers.set(username, existing);
      return newPeers;
    });
  }
}

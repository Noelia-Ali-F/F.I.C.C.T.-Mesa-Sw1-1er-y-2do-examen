import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { firstValueFrom } from 'rxjs';
import { BASE_PATH } from '../api/variables';
import { firebaseConfig, firebaseVapidKey } from './firebase.config';

@Injectable({
  providedIn: 'root'
})
export class FcmService {
  private readonly statusSignal = signal<PushStatus>('unknown');
  readonly status = this.statusSignal.asReadonly();

  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);
  private readonly app = initializeApp(firebaseConfig);
  private readonly messagingPromise = isSupported().then((supported) =>
    supported ? getMessaging(this.app) : null
  );

  async refreshStatus(usuarioId: string): Promise<void> {
    if (!usuarioId) return;

    const messaging = await this.messagingPromise;
    if (!messaging || !('Notification' in window) || !('serviceWorker' in navigator)) {
      this.statusSignal.set('unavailable');
      return;
    }

    if (Notification.permission === 'denied') {
      this.statusSignal.set('blocked');
      return;
    }

    if (Notification.permission !== 'granted') {
      this.statusSignal.set('disabled');
      return;
    }

    this.statusSignal.set('checking');

    try {
      const enabled = await this.isRegisteredOnServer(usuarioId);
      this.statusSignal.set(enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.warn('[FCM] No se pudo verificar estado en servidor.', error);
      this.statusSignal.set('disabled');
    }
  }

  async registerForUser(usuarioId: string): Promise<void> {
    if (!usuarioId) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'denied') {
        this.statusSignal.set('blocked');
        return;
      }
      if (permission !== 'granted') {
        this.statusSignal.set('disabled');
        return;
      }

      const messaging = await this.messagingPromise;
      if (!messaging) {
        this.statusSignal.set('unavailable');
        return;
      }

      const swRegistration = await this.getOrRegisterServiceWorker();
      if (!swRegistration) {
        this.statusSignal.set('disabled');
        return;
      }

      const token = await getToken(messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: swRegistration
      });

      if (!token) {
        this.statusSignal.set('disabled');
        return;
      }

      await firstValueFrom(
        this.http.post(`${this.basePath}/api/v1/notifications/register-token`, {
          usuarioId,
          token,
          platform: 'web'
        })
      );

      localStorage.setItem(this.getStorageKey(usuarioId), token);
      this.statusSignal.set('enabled');
    } catch (error) {
      console.warn('[FCM] No se pudo registrar el token.', error);
      this.statusSignal.set('disabled');
    }
  }

  async unregisterForUser(usuarioId: string): Promise<void> {
    if (!usuarioId) return;

    const token = localStorage.getItem(this.getStorageKey(usuarioId));
    if (!token) {
      this.statusSignal.set('disabled');
      return;
    }

    try {
      await firstValueFrom(
        this.http.delete(`${this.basePath}/api/v1/notifications/unregister-token`, {
          params: { token }
        })
      );
    } catch (error) {
      console.warn('[FCM] No se pudo desregistrar el token.', error);
    } finally {
      localStorage.removeItem(this.getStorageKey(usuarioId));
      this.statusSignal.set('disabled');
    }
  }

  private async isRegisteredOnServer(usuarioId: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.get<{ enabled?: boolean }>(`${this.basePath}/api/v1/notifications/status`, {
        params: { usuarioId }
      })
    );

    return !!response?.enabled;
  }

  private getStorageKey(usuarioId: string): string {
    return `WORKFLOW_FCM_TOKEN_${usuarioId}`;
  }

  private async getOrRegisterServiceWorker() {
    const scope = '/firebase-cloud-messaging-push-scope';
    const existing = await navigator.serviceWorker.getRegistration(scope);
    if (existing) return existing;

    return navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope });
  }
}

export type PushStatus = 'unknown' | 'checking' | 'enabled' | 'disabled' | 'blocked' | 'unavailable';

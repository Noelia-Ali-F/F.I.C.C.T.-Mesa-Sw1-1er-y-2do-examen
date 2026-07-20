import { Component, ElementRef, HostListener, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FcmService, PushStatus } from '../../../notifications/fcm.service';
import { AuthService } from '../../../auth/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: Date;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
}

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="relative inline-block text-left" (click)="$event.stopPropagation()">
      <!-- Toggle button with svelte round style -->
      <button
        (click)="toggleDropdown()"
        class="relative flex items-center justify-center w-10 h-10 bg-slate-100/80 hover:bg-slate-200/50 border border-slate-200/40 hover:border-slate-200/80 rounded-full transition-all cursor-pointer"
        [class.bg-teal-50]="status() === 'enabled'"
        aria-label="Alertas del sistema"
      >
        <mat-icon class="text-slate-700 text-[1.25rem]" fontSet="material-symbols-rounded">
          {{ status() === 'enabled' ? 'notifications_active' : 'notifications' }}
        </mat-icon>
        
        <!-- Unread badge -->
        @if (unreadCount() > 0) {
          <span class="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-teal-600 text-[8px] font-extrabold text-white ring-2 ring-white">
            {{ unreadCount() }}
          </span>
        }
      </button>

      <!-- Dropdown Panel -->
      @if (isOpen()) {
        <div class="absolute left-0 bottom-full mb-3 w-80 sm:w-96 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xl z-[100] animate-fade-in">
          
          <!-- Dropdown Header -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <mat-icon fontSet="material-symbols-rounded" class="text-teal-600 !text-base">notifications</mat-icon>
              Notificaciones
            </h3>
            @if (unreadCount() > 0) {
              <button
                (click)="markAllAsRead()"
                class="text-[10px] font-bold text-teal-600 hover:text-teal-700 hover:underline transition cursor-pointer"
              >
                Marcar todo como leído
              </button>
            }
          </div>

          <!-- FCM Service Push Permission Status Section -->
          <div class="mt-3 p-3.5 bg-slate-50/50 border border-slate-200/60 rounded-xl flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                Alertas Push:
              </span>
              <span [class]="getStatusBadgeClass()">
                {{ getStatusLabel() }}
              </span>
            </div>
            
            <p class="text-[10px] text-slate-500 leading-relaxed">
              {{ getStatusDescription() }}
            </p>

            @if (status() === 'disabled' || status() === 'unknown') {
              <button
                (click)="activarNotificaciones()"
                class="w-full mt-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold rounded-full transition shadow-sm cursor-pointer"
              >
                Activar alertas push
              </button>
            } @else if (status() === 'enabled') {
              <button
                (click)="desactivarNotificaciones()"
                class="w-full mt-1 px-4 py-2 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 text-[10px] font-bold rounded-full transition cursor-pointer"
              >
                Desactivar alertas
              </button>
            }
          </div>

          <!-- Notification Items List -->
          <div class="mt-4 max-h-[260px] overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin">
            @if (notifications().length === 0) {
              <div class="py-8 text-center text-slate-450">
                <mat-icon class="text-slate-350 text-3xl h-10 w-10 mx-auto" fontSet="material-symbols-rounded">inbox</mat-icon>
                <p class="text-[10px] font-semibold text-slate-400 mt-2">No tienes notificaciones en este momento.</p>
              </div>
            } @else {
              @for (item of notifications(); track item.id) {
                <div
                  (click)="clickNotification(item)"
                  class="group relative p-3 border border-slate-100 hover:border-teal-200/50 hover:bg-teal-50/10 rounded-xl transition cursor-pointer flex gap-2.5 items-start"
                  [class.bg-teal-50/20]="!item.read"
                  [class.bg-white]="item.read"
                >

                  <!-- Details -->
                  <div class="flex-1 min-w-0">
                    <p class="text-[11px] font-bold text-slate-800 leading-snug break-words">
                      {{ item.title }}
                    </p>
                    <p class="text-[10px] text-slate-550 leading-relaxed mt-1 break-words">
                      {{ item.body }}
                    </p>
                    <span class="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-1.5">
                      {{ formatTime(item.time) }}
                    </span>
                  </div>

                  <!-- Dot indicator for unread -->
                  @if (!item.read) {
                    <span class="shrink-0 w-2 h-2 bg-teal-600 rounded-full ring-4 ring-teal-50/50 mt-1.5"></span>
                  }
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .scrollbar-thin::-webkit-scrollbar {
      width: 4px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
      background: #f1f5f9;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
      background: #94a3b8;
      border-radius: 2px;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class NotificationCenterComponent implements OnInit {
  private readonly fcmService = inject(FcmService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  isOpen = signal(false);
  status = computed(() => this.fcmService.status());

  // List of active notifications
  notifications = signal<NotificationItem[]>([]);
  unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  constructor() {
    // Poll/check FCM status when user context shifts
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.fcmService.refreshStatus(user.username).catch(() => { });
        this.loadSampleNotifications(user.rol);
      } else {
        this.notifications.set([]);
      }
    });
  }

  ngOnInit() {
    // Handle outside clicks to close dropdown
    if (typeof window !== 'undefined') {
      window.addEventListener('click', () => this.isOpen.set(false));
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    this.isOpen.set(false);
  }

  toggleDropdown() {
    this.isOpen.update(o => !o);
  }

  activarNotificaciones() {
    const user = this.authService.currentUser();
    if (!user) return;
    this.fcmService.registerForUser(user.username).then(() => {
      // Add success notification
      this.addSystemNotification(
        'Alerta del Sistema',
        '¡Notificaciones Push activadas con éxito! Recibirás alertas sobre solicitudes y flujos.',
        'success'
      );
    });
  }

  desactivarNotificaciones() {
    const user = this.authService.currentUser();
    if (!user) return;
    this.fcmService.unregisterForUser(user.username).then(() => {
      this.addSystemNotification(
        'Alerta del Sistema',
        'Se han desactivado las notificaciones Push web para este equipo.',
        'warning'
      );
    });
  }

  markAllAsRead() {
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
  }

  clickNotification(item: NotificationItem) {
    this.notifications.update(list => list.map(n => n.id === item.id ? { ...n, read: true } : n));
    this.isOpen.set(false);
    if (item.link) {
      this.router.navigateByUrl(item.link);
    }
  }

  private addSystemNotification(title: string, body: string, type: 'info' | 'success' | 'warning' | 'error') {
    const newItem: NotificationItem = {
      id: `sys-${Date.now()}`,
      title,
      body,
      time: new Date(),
      read: false,
      type
    };
    this.notifications.update(list => [newItem, ...list]);
  }

  private loadSampleNotifications(rol: string) {
    // Generate helpful, premium simulated contextual alerts to populate the dashboard center
    const now = new Date();
    const list: NotificationItem[] = [
      {
        id: '1',
        title: 'Workflow BPMN Actualizado',
        body: 'El revisor técnico ha publicado la versión 4 del Procurement Workflow.',
        time: new Date(now.getTime() - 1000 * 60 * 15), // 15 mins ago
        read: false,
        type: 'success',
        link: '/bpmn-workspace'
      },
      {
        id: '2',
        title: 'Alerta de SLA Crítica',
        body: 'La solicitud de adquisición #WF-2026-92 está por expirar en el departamento de Finanzas.',
        time: new Date(now.getTime() - 1000 * 60 * 120), // 2 hours ago
        read: false,
        type: 'warning',
        link: '/'
      }
    ];

    if (rol === 'REVISOR' || rol === 'ADMINISTRADOR') {
      list.push({
        id: '3',
        title: 'Nueva Solicitud Pendiente',
        body: 'Se ha creado la solicitud #WF-2026-104 en Finanzas y espera tu revisión.',
        time: new Date(now.getTime() - 1000 * 60 * 300), // 5 hours ago
        read: true,
        type: 'info',
        link: '/'
      });
    }

    this.notifications.set(list);
  }

  // Formatting helpers
  formatTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return date.toLocaleDateString();
  }

  getStatusBadgeClass(): string {
    const st = this.status();
    const base = 'px-2 py-0.5 border font-mono text-[8px] font-extrabold uppercase rounded ';
    switch (st) {
      case 'enabled': return base + 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'disabled': return base + 'bg-amber-100 text-amber-800 border-amber-300';
      case 'blocked': return base + 'bg-red-100 text-red-800 border-red-300';
      case 'checking': return base + 'bg-teal-100 text-teal-800 border-teal-300 animate-pulse';
      case 'unavailable': return base + 'bg-slate-200 text-slate-600 border-slate-300';
      default: return base + 'bg-slate-100 text-slate-500 border-slate-300';
    }
  }

  getStatusLabel(): string {
    const st = this.status();
    switch (st) {
      case 'enabled': return 'Activo';
      case 'disabled': return 'Inactivo';
      case 'blocked': return 'Bloqueado';
      case 'checking': return 'Sincronizando';
      case 'unavailable': return 'No soportado';
      default: return 'Desconectado';
    }
  }

  getStatusDescription(): string {
    const st = this.status();
    switch (st) {
      case 'enabled': return 'Recibirás notificaciones push instantáneas en tu navegador en segundo plano.';
      case 'disabled': return 'Las alertas push están inactivas en este equipo. Haz clic abajo para activarlas.';
      case 'blocked': return 'Has denegado el permiso en tu navegador. Por favor reinícialo para activar.';
      case 'checking': return 'Verificando estado del token con el hub de notificaciones de Google Cloud...';
      case 'unavailable': return 'Tu navegador o entorno local no soporta Service Workers o Web Push de Firebase.';
      default: return 'No se pudo sincronizar el estado con el servidor de notificaciones local.';
    }
  }

  getTypeIconClass(type: string): string {
    switch (type) {
      case 'success': return 'bg-emerald-100 border-emerald-500 text-emerald-800';
      case 'warning': return 'bg-amber-100 border-amber-500 text-amber-800';
      case 'error': return 'bg-rose-100 border-rose-500 text-rose-800';
      default: return 'bg-sky-100 border-sky-500 text-sky-800';
    }
  }

  getTypeIconName(type: string): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'info';
    }
  }
}

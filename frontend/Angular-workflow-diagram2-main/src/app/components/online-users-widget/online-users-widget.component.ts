import { Component, computed, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BASE_PATH } from '../../api/variables';
import { AuthService } from '../../auth/auth.service';

export interface OnlineUser {
  username: string;
  nombreCompleto: string;
  rol: string;
  departamento: string;
  avatarUrl?: string;
  ultimoLatido?: string;
}

/**
 * Presence widget shown inside the global dock.
 * Supports hover and click to expand user details.
 */
@Component({
  selector: 'app-online-users-widget',
  imports: [MatIconModule],
  template: `
    <div
      class="relative flex flex-col items-end"
      (mouseenter)="expanded.set(true)"
      (mouseleave)="expanded.set(false)"
    >
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-slate-700 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.88)] transition hover:border-teal-300 hover:text-teal-700"
        (click)="toggleExpanded()"
        [attr.aria-expanded]="expanded()"
        aria-label="Mostrar usuarios online"
      >
        <div class="hidden sm:flex -space-x-2" aria-hidden="true">
          @for (user of visibleAvatars(); track user.username) {
            <div
              class="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_10px_18px_-14px_rgba(15,23,42,0.72)]"
              [title]="user.nombreCompleto"
              [style.z-index]="10 - $index"
            >
              @if (resolveAvatarUrl(user); as avatar) {
                <img [src]="avatar" [alt]="user.nombreCompleto" class="h-full w-full object-cover" />
              } @else {
                <span class="text-[10px] font-bold uppercase text-teal-700 bg-teal-50 w-full h-full flex items-center justify-center">{{ getInitials(user.nombreCompleto) }}</span>
              }
              <span class="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white bg-teal-500"></span>
            </div>
          }
        </div>

        @if (overflowCount() > 0) {
          <span class="hidden sm:inline-flex rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
            +{{ overflowCount() }}
          </span>
        }

        <span class="inline-flex items-center gap-1.5 rounded-full border border-teal-300 bg-teal-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-700">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-200 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-teal-700"></span>
          </span>
          {{ totalOnline() }} online
        </span>

        <mat-icon
          fontSet="material-symbols-rounded"
          class="hidden sm:inline-flex text-[18px] transition-transform"
          [class.rotate-180]="expanded()"
          aria-hidden="true">expand_more</mat-icon>
      </button>

      <section
        class="absolute top-[calc(100%+0.55rem)] right-0 w-[min(20.5rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_-34px_rgba(15,23,42,0.85)] transition-all duration-200 origin-top-right z-[500]"
        [class.opacity-0]="!expanded()"
        [class.translate-y-1]="!expanded()"
        [class.pointer-events-none]="!expanded()"
        role="dialog"
        aria-label="Lista de usuarios online"
      >
        <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3.5 py-3 text-slate-900">
          <div class="flex items-center gap-2.5">
            <mat-icon fontSet="material-symbols-rounded" class="text-[18px] text-teal-700" aria-hidden="true">groups</mat-icon>
            <span class="text-[11px] font-semibold tracking-[0.14em] uppercase">Usuarios online</span>
          </div>
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:border-slate-400 hover:text-slate-800"
            (click)="expanded.set(false)"
            aria-label="Cerrar panel de usuarios">
            <mat-icon fontSet="material-symbols-rounded" class="text-[16px]" aria-hidden="true">close</mat-icon>
          </button>
        </div>

        <div class="max-h-60 overflow-y-auto bg-slate-50">
          <div class="flex flex-col">
            @for (user of users(); track user.username) {
              <div class="group flex items-center gap-3 border-b border-slate-200 bg-white/90 p-3 transition-colors hover:bg-white">
                <div class="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-100 transition-transform group-hover:-translate-y-0.5">
                  @if (resolveAvatarUrl(user); as avatar) {
                    <img [src]="avatar" [alt]="user.nombreCompleto" class="h-full w-full object-cover" />
                  } @else {
                    <span class="text-[9px] font-bold uppercase text-teal-700 bg-teal-50 w-full h-full flex items-center justify-center">{{ getInitials(user.nombreCompleto) }}</span>
                  }
                  <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-teal-500"></span>
                </div>
                <div class="flex min-w-0 flex-col">
                  <span class="truncate text-[11px] font-semibold text-slate-900">{{ user.nombreCompleto }}</span>
                  <span class="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500">{{ user.rol }} · {{ user.departamento }}</span>
                </div>
              </div>
            } @empty {
              <div class="p-6 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Sin usuarios conectados
              </div>
            }
          </div>
        </div>
      </section>
    </div>
  `
})
export class OnlineUsersWidgetComponent {
  authService = inject(AuthService);
  basePath = inject(BASE_PATH);
  users = input<OnlineUser[]>([]);
  totalOnline = input<number>(0);

  expanded = signal(false);

  private readonly MAX_VISIBLE_AVATARS = 4;

  visibleAvatars = computed(() =>
    this.users().slice(0, this.MAX_VISIBLE_AVATARS)
  );

  overflowCount = computed(() =>
    Math.max(0, this.users().length - this.MAX_VISIBLE_AVATARS)
  );

  toggleExpanded() {
    this.expanded.update((current) => !current);
  }

  resolveAvatarUrl(user: OnlineUser): string | null {
    const avatar = this.authService.getValidAvatar(user.avatarUrl);
    if (!avatar) {
      return null;
    }
    return (avatar.startsWith('http') || avatar.startsWith('/icons/')) ? avatar : this.basePath + avatar;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}

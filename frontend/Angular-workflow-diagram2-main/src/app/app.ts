import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ChatWidgetComponent } from './components/chat-widget/chat-widget.component';
import { PwaInstallBannerComponent } from './components/pwa-install-banner/pwa-install-banner.component';
import { OnlineUsersWidgetComponent, OnlineUser } from './components/online-users-widget/online-users-widget.component';
import { AuthService } from './auth/auth.service';
import { WorkflowSupportService, PresenciaUsuario } from './workflow/workflow-support.service';
import { BASE_PATH } from './api/variables';
import { MatIconModule } from '@angular/material/icon';

type SidebarRoute = {
  label: string;
  route: string;
  icon: string;
  badge?: string;
  roles?: Array<'SOLICITANTE' | 'REVISOR' | 'ADMINISTRADOR'>;
};

import { NotificationCenterComponent } from './shared/components/notification-center/notification-center.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, ChatWidgetComponent, OnlineUsersWidgetComponent, PwaInstallBannerComponent, MatIconModule, NotificationCenterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  private static readonly FULL_BLEED_ROUTES = ['/mapa-avanzado', '/bpmn-workspace', '/documentos/editar'];
  private static readonly CHAT_WIDGET_HIDDEN_ROUTES = ['/mapa-avanzado', '/asistente', '/documentos/editar'];
  private static readonly ONLINE_WIDGET_HIDDEN_ROUTES = ['/mapa-avanzado', '/asistente', '/bpmn-workspace', '/documentos/editar'];
  private static readonly SIDEBAR_COMPACT_STORAGE_KEY = 'WF_SIDEBAR_COMPACT';
  private static readonly PRIMARY_ITEMS: SidebarRoute[] = [
    { label: 'Inicio', route: '/', icon: 'space_dashboard' },
    { label: 'Solicitudes', route: '/solicitudes', icon: 'inbox' },
    { label: 'Informes', route: '/informes', icon: 'analytics' },
    { label: 'Carpetas', route: '/carpetas', icon: 'folder' },
    { label: 'DMS', route: '/documentos', icon: 'description' },
    { label: 'Archivos', route: '/archivos', icon: 'cloud' },
  ];

  private static readonly TOOLS_ITEMS: SidebarRoute[] = [
    { label: 'Asistente IA', route: '/asistente', icon: 'smart_toy' },
    { label: 'Mapa de flujo', route: '/mapa-avanzado', icon: 'alt_route' },
    { label: 'Modo Técnico', route: '/bpmn-workspace', icon: 'hub' },
  ];

  authService = inject(AuthService);
  router = inject(Router);
  basePath = inject(BASE_PATH);
  private workflowSupportService = inject(WorkflowSupportService);
  private presenceHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly resizeHandler = () => this.syncViewportMode();

  protected readonly title = signal('workflow-frontend-angular');
  private readonly _isFullBleed = signal(false);
  isFullBleedRoute = this._isFullBleed.asReadonly();
  private readonly currentUrl = signal('/');
  private readonly isDesktopViewport = signal(false);
  isDesktopLayout = this.isDesktopViewport.asReadonly();

  sidebarOpen = signal(true);
  sidebarCompact = signal(false);
  profileMenuOpen = signal(false);

  primaryNavItems = computed(() => {
    const role = this.authService.currentUser()?.rol;
    return App.PRIMARY_ITEMS.filter(item => {
      return !item.roles || (!!role && item.roles.includes(role));
    });
  });

  toolsNavItems = computed(() => {
    const role = this.authService.currentUser()?.rol;
    return App.TOOLS_ITEMS.filter(item => {
      return !item.roles || (!!role && item.roles.includes(role));
    });
  });

  currentRouteTitle = computed(() => this.resolveRouteTitle(this.currentUrl()));

  isStandaloneRoute = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/bpmn-workspace') || url.startsWith('/documentos/editar');
  });

  showChatWidget = computed(() => {
    if (!this.authService.currentUser()) {
      return false;
    }

    const url = this.currentUrl();
    return !App.CHAT_WIDGET_HIDDEN_ROUTES.some(route => url.startsWith(route));
  });

  showOnlineUsersWidget = computed(() => {
    if (!this.authService.currentUser()) {
      return false;
    }

    const url = this.currentUrl();
    return !App.ONLINE_WIDGET_HIDDEN_ROUTES.some(route => url.startsWith(route));
  });

  showWidgetDock = computed(() => this.showChatWidget() || this.showOnlineUsersWidget());

  // Cache buster estático cargado en el inicio de la app para forzar recarga de avatares modificados sin causar loops de detección
  public readonly cacheBuster = new Date().getTime();

  onlineUsersForWidget = computed<OnlineUser[]>(() => {
    const res = this.workflowSupportService.presenciaResumen();
    const visibles = res?.usuariosOnline ?? [];
    
    return visibles.map((u: any): OnlineUser => {
      return {
        username: u.username,
        nombreCompleto: u.nombreCompleto,
        rol: u.rol,
        departamento: u.depto || u.departamento,
        avatarUrl: u.avatarUrl || undefined,
        ultimoLatido: u.lastSeen ? String(u.lastSeen) : undefined
      } as OnlineUser;
    });
  });

  totalOnlineSistema = computed(() => {
    return this.workflowSupportService.presenciaResumen()?.totalOnlineSistema ?? 0;
  });

  constructor() {
    this.currentUrl.set(this.normalizeUrl(this.router.url));

    if (typeof window !== 'undefined') {
      this.sidebarCompact.set(
        window.localStorage.getItem(App.SIDEBAR_COMPACT_STORAGE_KEY) === '1'
      );
    }

    this.syncViewportMode();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resizeHandler);
    }

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      const normalizedUrl = this.normalizeUrl(e.urlAfterRedirects);
      this.currentUrl.set(normalizedUrl);
      this._isFullBleed.set(
        App.FULL_BLEED_ROUTES.some(r => normalizedUrl.startsWith(r))
      );

      if (!this.isDesktopViewport()) {
        this.sidebarOpen.set(false);
      }
      this.profileMenuOpen.set(false);
    });

    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.iniciarHeartbeatPresencia();
      } else {
        this.detenerHeartbeatPresencia();
      }
    });
  }

  toggleSidebar() {
    this.sidebarOpen.update(current => !current);
  }

  toggleSidebarCompact() {
    this.sidebarCompact.update(current => !current);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(App.SIDEBAR_COMPACT_STORAGE_KEY, this.sidebarCompact() ? '1' : '0');
    }
  }

  closeSidebar() {
    if (!this.isDesktopViewport()) {
      this.sidebarOpen.set(false);
    }
  }

  toggleProfileMenu() {
    this.profileMenuOpen.update(current => !current);
  }

  closeProfileMenu() {
    this.profileMenuOpen.set(false);
  }

  isRouteActive(path: string): boolean {
    const current = this.currentUrl();
    if (path === '/') return current === '/';
    return current.startsWith(path);
  }

  logout() {
    this.detenerHeartbeatPresencia();

    this.workflowSupportService.cerrarSesionPresencia().subscribe({
      next: () => this.finalizarLogout(),
      error: () => this.finalizarLogout()
    });
  }

  ngOnDestroy() {
    this.detenerHeartbeatPresencia();

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  private iniciarHeartbeatPresencia() {
    if (this.presenceHeartbeatTimer) {
      return;
    }

    this.enviarHeartbeatPresencia();
    this.workflowSupportService.actualizarResumenLocal();
    
    this.presenceHeartbeatTimer = setInterval(() => {
      this.enviarHeartbeatPresencia();
      this.workflowSupportService.actualizarResumenLocal();
    }, 25000);
  }

  private detenerHeartbeatPresencia() {
    if (!this.presenceHeartbeatTimer) {
      return;
    }

    clearInterval(this.presenceHeartbeatTimer);
    this.presenceHeartbeatTimer = null;
  }

  private enviarHeartbeatPresencia() {
    this.workflowSupportService.registrarHeartbeatPresencia().subscribe({
      error: () => {
        // Silencioso para no interrumpir UX si hay latencia temporal.
      }
    });
  }

  private syncViewportMode() {
    if (typeof window === 'undefined') {
      return;
    }

    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    this.isDesktopViewport.set(desktop);

    if (desktop) {
      this.sidebarOpen.set(true);
    }
  }

  private normalizeUrl(url: string): string {
    const cleanUrl = url.split('?')[0].split('#')[0].trim();
    return cleanUrl || '/';
  }

  private resolveRouteTitle(url: string): string {
    if (url === '/') return 'Panel principal';
    if (url.startsWith('/informes')) return 'Informes operativos';
    if (url.startsWith('/crear')) return 'Nueva solicitud';
    if (url.startsWith('/documentos')) return 'Gestión Documental (DMS)';
    if (url.startsWith('/carpetas')) return 'Explorador de Carpetas';
    if (url.startsWith('/archivos')) return 'Todos los Archivos (Bucket)';
    if (url.startsWith('/detalle/')) return 'Detalle de solicitud';
    if (url.startsWith('/usuarios')) return 'Gestion de usuarios';
    if (url.startsWith('/departamentos')) return 'Gestion de departamentos';
    if (url.startsWith('/asistente')) return 'Asistente inteligente';
    if (url.startsWith('/mapa-avanzado')) return 'Mapa de flujo';


    if (url.startsWith('/login')) return 'Acceso';
    return 'Workflow';
  }

  private finalizarLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

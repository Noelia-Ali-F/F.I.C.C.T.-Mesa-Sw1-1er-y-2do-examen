import { Component, HostListener, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-pwa-install-banner',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (showBanner()) {
      <!-- Mobile: Bottom sheet. Desktop: Toast at bottom-right -->
      <div class="fixed z-[999] pwa-banner-position animate-fade-in-up">
        <div class="bg-white/95 backdrop-blur-md border border-slate-200/80 p-4.5 rounded-3xl shadow-2xl flex flex-col gap-3.5 transition-all">
          
          <!-- Header -->
          <div class="flex items-center justify-between gap-3.5">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 bg-teal-50 border border-teal-100 rounded-xl text-teal-700 flex items-center justify-center shadow-sm">
                <mat-icon fontSet="material-symbols-rounded" class="!text-lg">install_desktop</mat-icon>
              </div>
              <div class="text-left">
                <h3 class="text-xs font-black text-slate-800 tracking-tight">
                  Instalar Workflow App
                </h3>
                
                <!-- Pulsing live indicator -->
                <div class="flex items-center gap-1 mt-0.5">
                  <span class="relative flex h-1.5 w-1.5">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span class="text-[8px] font-bold text-slate-400 uppercase tracking-widest">PWA Soportada</span>
                </div>
              </div>
            </div>
            
            <button (click)="dismiss()" class="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center cursor-pointer border-none" aria-label="Cerrar banner">
              <mat-icon fontSet="material-symbols-rounded" class="!text-sm">close</mat-icon>
            </button>
          </div>
          
          <!-- Description -->
          <p class="text-[10.5px] font-semibold text-slate-500 leading-relaxed text-left">
            Agrega la plataforma a tu pantalla de inicio para disfrutar de acceso instantáneo sin navegador, notificaciones en segundo plano y rendimiento nativo optimizado.
          </p>

          <!-- Action Buttons -->
          <div class="flex gap-2">
            <button (click)="install()" class="flex-1 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 text-[10.5px] font-black rounded-xl transition cursor-pointer shadow-md shadow-teal-600/15 border-none">
              <mat-icon fontSet="material-symbols-rounded" class="!text-xs text-teal-150">download</mat-icon>
              <span>Instalar ahora</span>
            </button>
            
            <button (click)="dismiss()" class="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 text-[10.5px] font-extrabold rounded-xl transition cursor-pointer">
              Más tarde
            </button>
          </div>
          
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    
    /* Mobile: full-width bottom sheet overlay */
    .pwa-banner-position {
      bottom: 0;
      left: 0;
      right: 0;
      padding: 16px;
    }
    
    /* Desktop: bottom-right float toast */
    @media (min-width: 640px) {
      .pwa-banner-position {
        bottom: 24px;
        right: 24px;
        left: auto;
        padding: 0;
        max-width: 350px;
      }
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(24px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .animate-fade-in-up {
      animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class PwaInstallBannerComponent implements OnInit {
  private deferredPrompt: any;
  showBanner = signal(false);
  isIos = signal(false);

  ngOnInit() {
    // Delay slightly to ensure reliable detection
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.localStorage.getItem('WF_PWA_BANNER_DISMISSED') === '1') {
        return; // Manually dismissed by user
      }

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone);
      if (isStandalone) {
        return; // Ya está instalada
      }

      const ua = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(ua);
      const isMobile = /mobile|android/.test(ua);

      if (isIosDevice) {
        this.isIos.set(true);
        this.showBanner.set(true);
      } else if (isMobile) {
        // En Android a veces el evento tarda o no se dispara en modo debug
        // Mostramos el banner manualmente si es móvil y no está instalada
        this.showBanner.set(true);
      }
    }, 1500);
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onbeforeinstallprompt(e: Event) {
    if (typeof window !== 'undefined' && window.localStorage.getItem('WF_PWA_BANNER_DISMISSED') === '1') {
      return;
    }
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    this.deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    this.showBanner.set(true);
  }

  install() {
    if (this.isIos()) {
      // iOS no soporta el prompt programático, indicamos al usuario qué hacer
      alert('Para instalar en iOS: Toca el icono de "Compartir" en la barra inferior de tu navegador Safari y selecciona "Añadir a la pantalla de inicio".');
      return;
    }

    // Hide the app provided install promotion
    this.showBanner.set(false);
    // Show the install prompt
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      this.deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        this.deferredPrompt = null;
      });
    } else {
      // Si el botón se pulsó por el fallback (sin evento) y estamos en Android
      alert('Para instalar la aplicación, abre el menú de opciones de tu navegador (los tres puntos arriba a la derecha) y selecciona "Instalar aplicación" o "Añadir a la pantalla principal".');
    }
  }

  dismiss() {
    this.showBanner.set(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('WF_PWA_BANNER_DISMISSED', '1');
    }
  }
}

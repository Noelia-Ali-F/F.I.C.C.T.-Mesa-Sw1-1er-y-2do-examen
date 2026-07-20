import { Component, HostListener, Inject, PLATFORM_ID, signal, OnInit, isDevMode } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-install-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="showBanner()"
         @fadeSlideUp
         class="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-[100]">
      <div class="bg-white/90 rounded-2xl shadow-2xl border border-teal-100/50 overflow-hidden backdrop-blur-md">
        <!-- Accent line -->
        <div class="h-1 w-full bg-gradient-to-r from-teal-400 to-cyan-500"></div>
        
        <div class="p-4 flex items-center gap-4">
          <!-- Icon App -->
          <div class="w-12 h-12 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl flex-shrink-0 flex items-center justify-center border border-teal-100/60 shadow-sm">
            <span class="material-symbols-rounded text-teal-600 text-2xl drop-shadow-sm">install_mobile</span>
          </div>

          <!-- Text content -->
          <div class="flex-1 min-w-0">
            <h4 class="text-[15px] font-extrabold text-slate-800 mb-0.5 truncate tracking-tight">Workflow Hub App</h4>
            <p class="text-[13px] text-slate-500 leading-snug font-medium">Instala la aplicación para un acceso ultra rápido y mejor experiencia.</p>
          </div>

          <!-- Actions -->
          <div class="flex flex-col items-end gap-1.5 flex-shrink-0 ml-1">
            <button (click)="installApp()" 
                    class="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 transition-all duration-300 text-white text-[13px] font-bold py-1.5 px-5 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
              Instalar
            </button>
            <button (click)="dismiss()" 
                    class="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors px-2 py-1">
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  animations: [
    trigger('fadeSlideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translate(-50%, 20px) scale(0.95)' }),
        animate('500ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translate(-50%, 0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, transform: 'translate(-50%, 20px) scale(0.95)' }))
      ])
    ])
  ]
})
export class InstallBannerComponent implements OnInit {
  showBanner = signal(false);
  deferredPrompt: any;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // 🐛 DEBUG: En modo local (desarrollo), mostramos el banner a los 2 segundos para ver el diseño
      if (isDevMode() && !localStorage.getItem('pwa-banner-dismissed')) {
        setTimeout(() => this.showBanner.set(true), 2000);
      }
    }
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onbeforeinstallprompt(e: Event) {
    if (isPlatformBrowser(this.platformId)) {
      e.preventDefault();
      this.deferredPrompt = e;
      
      const isDismissed = localStorage.getItem('pwa-banner-dismissed');
      if (!isDismissed) {
        this.showBanner.set(true);
      }
    }
  }

  async installApp() {
    if (!this.deferredPrompt) {
      // Si estamos en entorno de desarrollo y no hay evento real, simplemente lo ocultamos con una alerta
      if (isDevMode()) {
        alert('✨ [Modo Dev] El diseño se ve genial. La instalación real requerirá PWA en producción (GCP).');
        this.showBanner.set(false);
      }
      return;
    }
    
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    
    this.deferredPrompt = null;
    this.showBanner.set(false);
  }

  dismiss() {
    this.showBanner.set(false);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('pwa-banner-dismissed', 'true');
    }
  }
}

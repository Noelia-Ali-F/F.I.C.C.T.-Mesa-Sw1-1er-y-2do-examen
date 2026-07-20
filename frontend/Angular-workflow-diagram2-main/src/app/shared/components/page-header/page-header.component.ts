import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * PageHeaderComponent — Unified page header banner used across all routed pages.
 *
 * Usage:
 * ```html
 * <app-page-header
 *   title="Buzón Operativo"
 *   subtitle="Bandeja de Trámites y Expedientes Activos"
 *   icon="mail"
 *   eyebrow="Monitoreo Central"
 *   gradientClasses="from-teal-500 via-emerald-400 to-amber-400"
 * >
 *   <!-- Project actions into the right slot -->
 *   <button class="...">Action</button>
 * </app-page-header>
 * ```
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <header
      class="relative overflow-hidden bg-white/95 border border-slate-200/50 rounded-3xl p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 animate-fade-in backdrop-blur-md"
    >
      <!-- Gradient accent bar -->
      <div
        class="absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r"
        [class]="gradientClasses()"
      ></div>

      <div class="flex items-center gap-3 sm:gap-5 min-w-0">
        <!-- Icon box with glowing background -->
        @if (icon()) {
          <div
            class="h-10 w-10 sm:h-13 sm:w-13 border rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 hover:scale-105"
            [class]="iconBoxClasses()"
          >
            <mat-icon
              fontSet="material-symbols-rounded"
              class="!text-lg sm:!text-2xl font-bold"
              aria-hidden="true"
            >{{ icon() }}</mat-icon>
          </div>
        }

        <div class="min-w-0">
          <h1 class="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight truncate leading-none">
            {{ title() }}
          </h1>
          @if (subtitle() || eyebrow()) {
            <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 sm:mt-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
              @if (eyebrow()) {
                <span class="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">{{ eyebrow() }}</span>
                @if (subtitle()) {
                  <span class="h-1 w-1 bg-slate-300 rounded-full"></span>
                }
              }
              @if (subtitle()) {
                <span class="text-slate-500 font-medium normal-case tracking-normal text-[10px] sm:text-[11px]">{{ subtitle() }}</span>
              }
            </p>
          }
        </div>
      </div>

      <!-- Right-side actions slot -->
      <div class="flex items-center flex-wrap gap-2 sm:gap-3 shrink-0">
        <ng-content />
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class PageHeaderComponent {
  /** Page title (h1) */
  title = input.required<string>();

  /** Subtitle text shown below the title */
  subtitle = input<string>('');

  /** Short eyebrow text shown before the subtitle (e.g. "Monitoreo Central") */
  eyebrow = input<string>('');

  /** Material icon name for the left icon box */
  icon = input<string>('');

  /** Tailwind gradient classes for the top accent bar */
  gradientClasses = input<string>('from-teal-500 via-emerald-400 to-amber-400');

  /** Tailwind classes for the icon container (bg, border, text color) */
  iconBoxClasses = input<string>('bg-teal-50 border-teal-100 text-teal-700');
}

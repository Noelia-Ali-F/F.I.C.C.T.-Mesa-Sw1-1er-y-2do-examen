import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * PageSectionComponent — Reusable visual container wrapper (card/panel)
 * with a standardized elegant header, consistent spacing, and slot projection.
 */
@Component({
  selector: 'app-page-section',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-3xl shadow-[0_4px_24px_rgba(15,23,42,0.015)] overflow-hidden flex flex-col transition-all duration-300 hover:shadow-[0_12px_36px_rgba(15,23,42,0.03)] hover:border-slate-200 hover:translate-y-[-1px]">
      <!-- Section Header -->
      <header class="px-6 py-4.5 border-b border-slate-100/60 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          @if (icon()) {
            <mat-icon
              fontSet="material-symbols-rounded"
              class="!text-teal-600 !w-5 !h-5 !text-[20px] shrink-0"
              aria-hidden="true"
            >{{ icon() }}</mat-icon>
          }
          <div class="min-w-0">
            <h3 class="text-sm font-extrabold text-slate-800 tracking-tight m-0 truncate">
              {{ title() }}
            </h3>
            @if (subtitle()) {
              <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 m-0 truncate">
                {{ subtitle() }}
              </p>
            }
          </div>
        </div>

        @if (badgeText()) {
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border shrink-0"
            [class]="badgeClass() || 'bg-slate-50 border-slate-200/50 text-slate-500'"
          >
            {{ badgeText() }}
          </span>
        }
      </header>

      <!-- Section Body -->
      <div class="p-6 flex-1 min-w-0">
        <ng-content />
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class PageSectionComponent {
  /** Section Title */
  title = input.required<string>();

  /** Subtitle/Hint text shown below title */
  subtitle = input<string>('');

  /** Optional badge text displayed on the right of the header */
  badgeText = input<string>('');

  /** Custom CSS classes for the badge container */
  badgeClass = input<string>('');

  /** Optional Material Icon name for the section */
  icon = input<string>('');
}

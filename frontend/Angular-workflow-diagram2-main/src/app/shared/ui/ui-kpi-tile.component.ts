import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ui-kpi-tile',
  standalone: true,
  imports: [NgClass, MatIconModule],
  template: `
    <article class="ui-kpi-tile" [ngClass]="tileClass">
      <div class="ui-kpi-tile__head">
        <span class="ui-kpi-tile__label">{{ label }}</span>
        @if (icon) {
          <mat-icon class="ui-kpi-tile__icon" fontSet="material-symbols-rounded" aria-hidden="true">{{ icon }}</mat-icon>
        }
      </div>
      <span class="ui-kpi-tile__value">{{ value }}</span>
    </article>
  `,
  styles: [`
    .ui-kpi-tile {
      position: relative;
      overflow: hidden;
      padding: 1.2rem;
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.82);
      border-radius: 1.05rem;
      box-shadow: 0 10px 20px -12px rgba(15, 23, 42, 0.1);
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }

    .ui-kpi-tile:hover {
      transform: translateY(-2px);
      box-shadow: 0 18px 28px -14px rgba(15, 23, 42, 0.15);
    }

    .ui-kpi-tile::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: #e2e8f0;
      opacity: 0.6;
    }

    .ui-kpi-tile--teal::before {
      background: var(--wf-gradient-primary);
      opacity: 1;
    }

    .ui-kpi-tile--danger::before {
      background: #f87171;
      opacity: 1;
    }

    .ui-kpi-tile--warning::before {
      background: #fb923c;
      opacity: 1;
    }

    .ui-kpi-tile__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .ui-kpi-tile__label {
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--theme-slate-500);
    }

    .ui-kpi-tile__icon {
      width: 1rem;
      height: 1rem;
      font-size: 1rem;
      line-height: 1rem;
      color: #94a3b8;
    }

    .ui-kpi-tile__value {
      font-size: 1.8rem;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
  `]
})
export class UiKpiTileComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = 0;
  @Input() icon = '';
  @Input() tone: 'default' | 'teal' | 'danger' | 'warning' = 'default';

  get tileClass(): string {
    if (this.tone === 'teal') return 'ui-kpi-tile--teal';
    if (this.tone === 'danger') return 'ui-kpi-tile--danger';
    if (this.tone === 'warning') return 'ui-kpi-tile--warning';
    return '';
  }
}

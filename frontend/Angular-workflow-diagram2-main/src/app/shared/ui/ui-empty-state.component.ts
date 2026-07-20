import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-empty-state',
  standalone: true,
  template: `
    <div class="ui-empty-state">
      {{ message }}
    </div>
  `,
  styles: [`
    .ui-empty-state {
      margin: 0.25rem;
      border-radius: 0.95rem;
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      color: var(--theme-slate-500);
      font-size: 0.8rem;
      font-weight: 600;
      text-align: center;
      padding: 1rem;
    }
  `]
})
export class UiEmptyStateComponent {
  @Input() message = 'Sin datos disponibles';
}

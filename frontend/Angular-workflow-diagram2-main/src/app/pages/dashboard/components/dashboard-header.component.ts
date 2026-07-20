import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiKpiTileComponent } from '../../../shared/ui';

type DashboardView = 'OPERATIVO' | 'REGISTROS';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  imports: [RouterLink, UiKpiTileComponent],
  templateUrl: './dashboard-header.component.html',
  styleUrl: './dashboard-header.component.css'
})
export class DashboardHeaderComponent {
  @Input() role = '';
  @Input() departamento = '';
  @Input() canCreate = false;

  @Input() totalSolicitudes = 0;
  @Input() slaCritico = 0;
  @Input() totalUrgentes = 0;
  @Input() onlineVisible = 0;

  @Input() tasaCierre = 0;
  @Input() solicitudesEnRiesgo = 0;
  @Input() promedioEventos = 0;

  @Input() activeView: DashboardView = 'OPERATIVO';

  @Output() viewChanged = new EventEmitter<DashboardView>();
}

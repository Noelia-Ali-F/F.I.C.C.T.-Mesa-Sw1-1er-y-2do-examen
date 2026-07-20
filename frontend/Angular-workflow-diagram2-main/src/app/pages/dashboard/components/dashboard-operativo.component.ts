import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SelectionGestureEndedEvent } from 'ng-diagram';
import { WorkflowDiagramComponent } from '../../../components/workflow-diagram/workflow-diagram.component';
import { EstadoWorkflow } from '../../../models/workflow.models';
import { PageSectionComponent } from '../../../shared/components/page-section/page-section.component';

@Component({
  selector: 'app-dashboard-operativo',
  standalone: true,
  imports: [WorkflowDiagramComponent, PageSectionComponent],
  templateUrl: './dashboard-operativo.component.html',
  styleUrl: './dashboard-operativo.component.css'
})
export class DashboardOperativoComponent {
  @Input() estadosFlujo: EstadoWorkflow[] = [];
  @Input() contadoresEstado: Record<EstadoWorkflow, number> = {
    PENDIENTE: 0,
    EN_REVISION: 0,
    APROBADO: 0,
    RECHAZADO: 0
  };
  @Input() filtroEstado: EstadoWorkflow | null = null;
  @Input() stats: Record<string, any> = {};
  @Input() diagramConfig: any = {};

  @Output() estadoToggled = new EventEmitter<EstadoWorkflow>();
  @Output() selectionEnded = new EventEmitter<SelectionGestureEndedEvent>();

  etiquetaEstado(estado: EstadoWorkflow): string {
    const labels: Record<EstadoWorkflow, string> = {
      PENDIENTE: 'Pendiente',
      EN_REVISION: 'En revision',
      APROBADO: 'Aprobado',
      RECHAZADO: 'Rechazado'
    };
    return labels[estado];
  }
}

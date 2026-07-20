import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SolicitudResponse } from '../../../api/model/solicitudResponse';
import { EstadoSla, EstadoWorkflow } from '../../../models/workflow.models';
import { PresenciaUsuario } from '../../../workflow/workflow-support.service';
import { UiEmptyStateComponent } from '../../../shared/ui';
import { PageSectionComponent } from '../../../shared/components/page-section/page-section.component';

export interface DepartamentoCarga {
  departamento: string;
  total: number;
  urgentes: number;
}

import { AuthService } from '../../../auth/auth.service';
import { BASE_PATH } from '../../../api/variables';

@Component({
  selector: 'app-dashboard-registros',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, PageSectionComponent, UiEmptyStateComponent],
  templateUrl: './dashboard-registros.component.html',
  styleUrl: './dashboard-registros.component.css'
})
export class DashboardRegistrosComponent {
  authService = inject(AuthService);
  basePath = inject(BASE_PATH);
  @Input() solicitudes: SolicitudResponse[] = [];
  @Input() searchControl = new FormControl<string | null>('');

  @Input() estadosFlujo: EstadoWorkflow[] = [];
  @Input() estadosSlaFiltro: EstadoSla[] = [];
  @Input() estadosSlaVisibles: EstadoSla[] = [];

  @Input() filtroEstado: EstadoWorkflow | null = null;
  @Input() filtroSla: EstadoSla | null = null;

  @Input() contadoresSla: Record<EstadoSla, number> = {
    VENCIDO: 0,
    POR_VENCER: 0,
    EN_TIEMPO: 0,
    CERRADO: 0
  };

  @Input() registrosCriticos: SolicitudResponse[] = [];
  @Input() topDepartamentos: DepartamentoCarga[] = [];
  @Input() maxCargaDepartamentos = 0;
  @Input() usuariosOnlineVisibles: PresenciaUsuario[] = [];
  @Input() presenciaGeneradoEn: string | null = null;

  @Output() buscarRequested = new EventEmitter<void>();
  @Output() limpiarBusquedaRequested = new EventEmitter<void>();
  @Output() estadoToggled = new EventEmitter<EstadoWorkflow>();
  @Output() slaToggled = new EventEmitter<EstadoSla>();
  @Output() limpiarFiltrosRequested = new EventEmitter<void>();

  etiquetaEstado(estado: EstadoWorkflow): string {
    const labels: Record<EstadoWorkflow, string> = {
      PENDIENTE: 'Pendiente',
      EN_REVISION: 'En revision',
      APROBADO: 'Aprobado',
      RECHAZADO: 'Rechazado'
    };
    return labels[estado];
  }

  etiquetaSla(estadoSla?: string): string {
    if (!estadoSla) return 'SIN_SLA';
    return estadoSla.replace('_', ' ');
  }

  claseBadgeSla(estadoSla?: string): string {
    switch (estadoSla as EstadoSla | undefined) {
      case 'VENCIDO':
        return 'wf-badge-red';
      case 'POR_VENCER':
        return 'wf-badge-amber';
      case 'EN_TIEMPO':
        return 'wf-badge-teal';
      case 'CERRADO':
        return 'wf-badge-slate';
      default:
        return 'wf-badge-slate';
    }
  }

  hayBusquedaActiva(): boolean {
    const valor = this.searchControl.value;
    return typeof valor === 'string' && valor.trim().length > 0;
  }

  porcentajeCargaDepartamento(total: number): number {
    if (this.maxCargaDepartamentos <= 0) {
      return 0;
    }
    return Math.round((total / this.maxCargaDepartamentos) * 100);
  }

  inicialesUsuario(nombre?: string): string {
    if (!nombre) {
      return '?';
    }

    return nombre
      .split(' ')
      .map((parte) => parte.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}

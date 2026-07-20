import {
  Component, input, output, computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { NgClass } from '@angular/common';

export interface NodeData {
  id: string;
  codigo: string;
  titulo: string;
  estado: string;
  prioridad: string;
  usuarioCreador: string;
  usuarioAsignado: string | null;
  departamento: string;
  estadoSla?: string | null;
  minutosRestantesSla?: number | null;
  fechaActualizacion?: string | null;
}

const PRIORIDAD_COLORS: Record<string, string> = {
  URGENTE: 'bg-rose-50 text-rose-700 border border-rose-100/70',
  ALTA: 'bg-amber-50 text-amber-700 border border-amber-100/70',
  MEDIA: 'bg-indigo-50 text-indigo-700 border border-indigo-100/70',
  BAJA: 'bg-slate-50 text-slate-600 border border-slate-200/70',
};

@Component({
  selector: 'app-workflow-node',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="group node-card w-full h-full flex flex-col border bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 select-none cursor-pointer overflow-hidden"
         [class.border-teal-500]="selected()"
         [class.ring-4]="selected()"
         [class.ring-teal-550/15]="selected()"
         [class.shadow-md]="selected()"
         [class.scale-[1.01]]="selected()"
         [ngClass]="[!selected() ? cardClass() : '']"
         [attr.title]="tooltipText()"
         (click)="onNodeClick()">
      
      <!-- Top Accent Bar (Gives a premium visual cue depending on state) -->
      <div class="h-1 w-full" [ngClass]="accentBarClass()"></div>

      <!-- Header -->
      <div class="px-3.5 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 group-hover:bg-slate-100/60 transition-colors">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="w-1.5 h-1.5 rounded-full" [ngClass]="bulletStateClass()"></span>
          <span class="font-mono text-[9px] font-black text-slate-500 tracking-wider truncate">{{ data().codigo }}</span>
        </div>
        <span class="text-[8px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 transition-transform"
              [ngClass]="prioridadClass()">{{ data().prioridad }}</span>
      </div>

      <!-- Body -->
      <div class="flex-1 px-3.5 py-2.5 flex flex-col justify-between gap-2 overflow-hidden">
        <p class="text-[11px] font-bold text-slate-800 leading-snug line-clamp-2 group-hover:text-emerald-500 transition-colors">
          {{ data().titulo }}
        </p>
        
        <div class="flex items-center justify-between border-t border-slate-50 pt-2 mt-auto">
          <span class="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                [ngClass]="estadoClass()">{{ data().estado }}</span>
          
          <span class="text-[9px] font-bold text-slate-400 truncate max-w-[80px] ml-2 text-right" 
                [attr.title]="data().usuarioAsignado || data().usuarioCreador">
            {{ data().usuarioAsignado || data().usuarioCreador }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
})
export class WorkflowNodeComponent {
  selected = input<boolean>(false);
  data = input<NodeData>({
    id: '',
    codigo: '',
    titulo: '',
    estado: 'PENDIENTE',
    prioridad: 'MEDIA',
    usuarioCreador: '',
    usuarioAsignado: null,
    departamento: '',
    estadoSla: null,
    minutosRestantesSla: null,
    fechaActualizacion: null
  });
  nodeClicked = output<NodeData>();

  tooltipText = computed(() => {
    const d = this.data();
    const responsable = d.usuarioAsignado || d.usuarioCreador || 'Sin asignar';
    const sla = d.estadoSla ? `SLA: ${this.formatearSla(d.estadoSla, d.minutosRestantesSla)}` : 'SLA: Sin dato';
    const actualizacion = d.fechaActualizacion ? `Actualizado: ${d.fechaActualizacion}` : 'Actualizado: Sin dato';

    return [
      `Codigo: ${d.codigo}`,
      `Estado: ${d.estado}`,
      `Prioridad: ${d.prioridad}`,
      `Departamento: ${d.departamento}`,
      `Responsable: ${responsable}`,
      sla,
      actualizacion,
    ].join('\n');
  });

  cardClass = computed(() => {
    const map: Record<string, string> = {
      PENDIENTE: 'border-amber-200/70 hover:border-amber-400 hover:shadow-amber-100/20',
      EN_REVISION: 'border-indigo-200/70 hover:border-indigo-400 hover:shadow-indigo-100/20',
      APROBADO: 'border-teal-200/70 hover:border-teal-400 hover:shadow-teal-100/20',
      RECHAZADO: 'border-rose-200/70 hover:border-rose-400 hover:shadow-rose-100/20',
    };
    return map[this.data().estado] ?? 'border-slate-200';
  });

  accentBarClass = computed(() => {
    const map: Record<string, string> = {
      PENDIENTE: 'bg-amber-400',
      EN_REVISION: 'bg-indigo-500',
      APROBADO: 'bg-teal-500',
      RECHAZADO: 'bg-rose-500',
    };
    return map[this.data().estado] ?? 'bg-slate-400';
  });

  bulletStateClass = computed(() => {
    const map: Record<string, string> = {
      PENDIENTE: 'bg-amber-400 animate-pulse',
      EN_REVISION: 'bg-indigo-500 animate-pulse',
      APROBADO: 'bg-teal-500',
      RECHAZADO: 'bg-rose-500',
    };
    return map[this.data().estado] ?? 'bg-slate-400';
  });
  
  estadoClass = computed(() => {
    const map: Record<string, string> = {
      PENDIENTE: 'border-amber-500 text-amber-700 bg-amber-50',
      EN_REVISION: 'border-indigo-500 text-indigo-700 bg-indigo-50',
      APROBADO: 'border-teal-500 text-teal-700 bg-teal-50',
      RECHAZADO: 'border-rose-500 text-rose-700 bg-rose-50',
    };
    return map[this.data().estado] ?? 'border-slate-450 text-slate-700';
  });
  
  prioridadClass = computed(() => PRIORIDAD_COLORS[this.data().prioridad] ?? 'bg-slate-200 text-slate-700');

  onNodeClick() {
    this.nodeClicked.emit(this.data());
  }

  private formatearSla(estadoSla: string, minutosRestantesSla?: number | null): string {
    if (minutosRestantesSla === null || minutosRestantesSla === undefined) {
      return estadoSla;
    }

    if (minutosRestantesSla < 0) {
      return `${estadoSla} (${Math.abs(minutosRestantesSla)}m excedido)`;
    }

    return `${estadoSla} (${minutosRestantesSla}m restantes)`;
  }
}

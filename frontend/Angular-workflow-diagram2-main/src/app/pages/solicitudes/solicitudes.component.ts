import { Component, computed, inject, OnInit, signal, effect } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { WorkflowDepartamentalService } from '../../api/api/workflowDepartamental.service';
import { SolicitudResponse } from '../../api/model/solicitudResponse';
import { AuthService } from '../../auth/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { BASE_PATH } from '../../api/variables';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

type Prioridad = 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';
type Estado = 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO';
type EstadoSla = 'EN_TIEMPO' | 'POR_VENCER' | 'VENCIDO' | 'CERRADO';

@Component({
  selector: 'app-solicitudes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    PageHeaderComponent
  ],
  templateUrl: './solicitudes.component.html',
  styleUrl: './solicitudes.component.css'
})
export class SolicitudesComponent implements OnInit {
  private workflowService = inject(WorkflowDepartamentalService);
  public authService = inject(AuthService);
  private router = inject(Router);
  public basePath = inject(BASE_PATH);

  // Poll state to auto-refresh list
  private pollTick = signal(0);

  // View modes: 'tarjetas' (Premium dossier cards) or 'tabla' (Compact corporate table)
  vista = signal<'tarjetas' | 'tabla'>('tarjetas');
  
  // Clipboard alert message state
  copiadoMensaje = signal<string | null>(null);

  // Filter signals
  searchQuery = signal<string>('');
  searchInputValue = signal<string>('');
  
  filtroEstado = signal<Estado | 'TODOS'>('TODOS');
  filtroPrioridad = signal<Prioridad | 'TODAS'>('TODAS');
  filtroSla = signal<EstadoSla | 'TODOS'>('TODOS');
  ordenarPor = signal<'FECHA_DESC' | 'FECHA_ASC' | 'PRIORIDAD' | 'SLA'>('FECHA_DESC');

  // Load requests using modern Angular 19 rxResource
  solicitudesResource = rxResource({
    params: () => {
      const user = this.authService.currentUser();
      const tick = this.pollTick();
      const query = this.searchQuery();
      return { user, tick, query };
    },
    stream: ({ params }) => {
      const { user, query } = params;
      if (!user) return of({ datos: [] } as any);

      // Dedicated search
      if (query && query.trim() !== '') {
        const q = query.trim();
        return this.workflowService.buscarPorTitulo(q).pipe(
          switchMap(res => {
            if (res.datos && res.datos.length > 0) return of(res);
            return this.workflowService.obtenerPorCodigo(q.toUpperCase()).pipe(
              map(resCod => ({ datos: resCod.datos ? [resCod.datos] : [] }))
            );
          }),
          catchError(() => of({ datos: [] }))
        );
      }

      // Rollout-based request list
      if (user.rol === 'SOLICITANTE') {
        return this.workflowService.listarPorUsuario(user.username);
      } else if (user.rol === 'REVISOR') {
        return this.workflowService.listarPorDepartamento(user.departamento);
      } else {
        return this.workflowService.listarTodas();
      }
    }
  });

  // Base list of items
  solicitudesBase = computed<SolicitudResponse[]>(() => {
    return (this.solicitudesResource.value() as any)?.datos || [];
  });

  // Filtered and sorted solicitudes to bind to UI
  solicitudes = computed<SolicitudResponse[]>(() => {
    let list = [...this.solicitudesBase()];

    // Apply state filter
    const estado = this.filtroEstado();
    if (estado !== 'TODOS') {
      list = list.filter(t => t.estado === estado);
    }

    // Apply priority filter
    const prioridad = this.filtroPrioridad();
    if (prioridad !== 'TODAS') {
      list = list.filter(t => t.prioridad === prioridad);
    }

    // Apply SLA filter
    const sla = this.filtroSla();
    if (sla !== 'TODOS') {
      list = list.filter(t => t.estadoSla === sla);
    }

    // Sorting weights
    const prioridadPeso: Record<string, number> = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };
    const slaPeso: Record<string, number> = { VENCIDO: 0, POR_VENCER: 1, EN_TIEMPO: 2, CERRADO: 3 };

    // Apply sort order
    const orden = this.ordenarPor();
    list.sort((a, b) => {
      if (orden === 'FECHA_DESC') {
        const tA = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
        const tB = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
        return tB - tA;
      }
      if (orden === 'FECHA_ASC') {
        const tA = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
        const tB = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
        return tA - tB;
      }
      if (orden === 'PRIORIDAD') {
        const wA = prioridadPeso[a.prioridad || 'MEDIA'] ?? 99;
        const wB = prioridadPeso[b.prioridad || 'MEDIA'] ?? 99;
        return wA - wB;
      }
      if (orden === 'SLA') {
        const wA = slaPeso[a.estadoSla || 'EN_TIEMPO'] ?? 99;
        const wB = slaPeso[b.estadoSla || 'EN_TIEMPO'] ?? 99;
        return wA - wB;
      }
      return 0;
    });

    return list;
  });

  // KPI summaries derived from the reactive base list
  kpiStats = computed(() => {
    const list = this.solicitudesBase();
    const stats = {
      totales: list.length,
      pendientes: 0,
      enRevision: 0,
      aprobadas: 0,
      vencidas: 0
    };

    for (const t of list) {
      if (t.estado === 'PENDIENTE') stats.pendientes++;
      if (t.estado === 'EN_REVISION') stats.enRevision++;
      if (t.estado === 'APROBADO') stats.aprobadas++;
      if (t.estadoSla === 'VENCIDO') stats.vencidas++;
    }

    return stats;
  });

  constructor() {
    // Background polling every 20 seconds
    effect((onCleanup) => {
      const timer = setInterval(() => {
        this.pollTick.update(t => t + 1);
      }, 20000);
      onCleanup(() => clearInterval(timer));
    });
  }

  ngOnInit() {}

  buscar() {
    this.searchQuery.set(this.searchInputValue());
  }

  limpiarFiltros() {
    this.searchInputValue.set('');
    this.searchQuery.set('');
    this.filtroEstado.set('TODOS');
    this.filtroPrioridad.set('TODAS');
    this.filtroSla.set('TODOS');
    this.ordenarPor.set('FECHA_DESC');
  }

  verDetalle(id?: string) {
    if (!id) return;
    this.router.navigate(['/detalle', id]);
  }

  copiarCodigo(event: MouseEvent, codigo?: string) {
    event.stopPropagation();
    if (!codigo) return;
    navigator.clipboard.writeText(codigo);
    this.copiadoMensaje.set(codigo);
    setTimeout(() => {
      if (this.copiadoMensaje() === codigo) {
        this.copiadoMensaje.set(null);
      }
    }, 2000);
  }

  nuevaSolicitud() {
    this.router.navigate(['/crear']);
  }

  getPrioridadBadgeClass(p?: string): string {
    const base = 'px-2.5 py-1 rounded-full font-sans text-[10px] font-bold uppercase ';
    switch (p) {
      case 'URGENTE': return base + 'bg-red-50 text-red-700 border border-red-100';
      case 'ALTA': return base + 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'MEDIA': return base + 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'BAJA': return base + 'bg-slate-50 text-slate-600 border border-slate-100';
      default: return base + 'bg-slate-50 text-slate-600 border border-slate-100';
    }
  }

  getEstadoBadgeClass(e?: string): string {
    const base = 'px-2.5 py-1 rounded-full font-sans text-[10px] font-bold uppercase ';
    switch (e) {
      case 'PENDIENTE': return base + 'bg-slate-50 text-slate-700 border border-slate-100';
      case 'EN_REVISION': return base + 'bg-blue-50 text-blue-700 border border-blue-100';
      case 'APROBADO': return base + 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'RECHAZADO': return base + 'bg-rose-50 text-rose-700 border border-rose-100';
      default: return base + 'bg-slate-50 text-slate-600 border border-slate-100';
    }
  }

  getSlaBadgeClass(s?: string): string {
    const base = 'px-2.5 py-1 rounded-full font-sans text-[10px] font-bold uppercase ';
    switch (s) {
      case 'VENCIDO': return base + 'bg-red-50 text-red-700 border border-red-100';
      case 'POR_VENCER': return base + 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'EN_TIEMPO': return base + 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'CERRADO': return base + 'bg-slate-50 text-slate-600 border border-slate-100';
      default: return base + 'bg-slate-50 text-slate-600 border border-slate-100';
    }
  }

  etiquetaSla(estado?: string): string {
    switch (estado) {
      case 'VENCIDO': return 'Tiempo Excedido';
      case 'POR_VENCER': return 'Próximo a Vencer';
      case 'EN_TIEMPO': return 'En Tiempo';
      case 'CERRADO': return 'Cerrado';
      default: return estado || 'Normal';
    }
  }
}

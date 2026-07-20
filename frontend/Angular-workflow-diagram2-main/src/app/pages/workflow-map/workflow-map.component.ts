import {
  Component, ElementRef, OnInit, OnDestroy, ViewChild, inject,
  AfterViewInit, ApplicationRef, EnvironmentInjector, createComponent,
  ChangeDetectorRef, ViewEncapsulation,
  signal,
  computed
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import * as joint from '@joint/core';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import { WorkflowDepartamentalService } from '../../api/api/workflowDepartamental.service';
import { CambiarEstadoRequest } from '../../api/model/cambiarEstadoRequest';
import { ReasignarDepartamentoRequest } from '../../api/model/reasignarDepartamentoRequest';
import { SolicitudResponse } from '../../api/model/solicitudResponse';
import { AuthService } from '../../auth/auth.service';
import {
  PresenciaResumen,
  PresenciaUsuario,
  ReasignacionRecomendacion,
  WorkflowSupportService
} from '../../workflow/workflow-support.service';
import { WorkflowNodeComponent, NodeData } from './workflow-node.component';
import { AiCopilotComponent } from '../../components/ai-copilot/ai-copilot.component';
import { CopilotEvent } from '../../components/ai-copilot/ai-copilot.types';

// Custom Element Model with foreignObject (JointJS docs pattern)
class WorkflowNode extends joint.dia.Element {
  override defaults() {
    return {
      ...super.defaults,
      type: 'WorkflowNode',
      size: { width: 240, height: 110 },
      markup: [{
        tagName: 'foreignObject',
        selector: 'foreignObject',
        attributes: { overflow: 'visible' },
        children: [{
          tagName: 'div',
          selector: 'container',
          namespaceURI: 'http://www.w3.org/1999/xhtml',
          style: { width: '100%', height: '100%' }
        }]
      }],
      data: {} as NodeData,
      attrs: {
        foreignObject: { width: 'calc(w)', height: 'calc(h)' }
      }
    };
  }
}

// Custom Element View (Angular component embedded in JointJS node)
class WorkflowNodeView extends joint.dia.ElementView<WorkflowNode> {
  static appRef?: ApplicationRef;
  static injector?: EnvironmentInjector;
  static onNodeClick?: (data: NodeData) => void;

  protected get appRef(): ApplicationRef | undefined {
    return (this.constructor as typeof WorkflowNodeView).appRef;
  }

  protected get injector(): EnvironmentInjector | undefined {
    return (this.constructor as typeof WorkflowNodeView).injector;
  }

  private componentRef: ReturnType<typeof createComponent<WorkflowNodeComponent>> | null = null;
  private nodeClickSub: Subscription | { unsubscribe: () => void } | null = null;
  static DATA_FLAG = 'DATA';

  override presentationAttributes() {
    return joint.dia.ElementView.addPresentationAttributes({
      data: WorkflowNodeView.DATA_FLAG,
      selected: 'SELECTED_FLAG'
    });
  }

  override confirmUpdate(flag: number, options: Record<string, unknown>): number {
    let flags = super.confirmUpdate(flag, options);
    if (this.hasFlag(flags, WorkflowNodeView.DATA_FLAG) || this.hasFlag(flags, 'SELECTED_FLAG')) {
      this.updateAngularComponent();
      flags = this.removeFlag(flags, WorkflowNodeView.DATA_FLAG);
      flags = this.removeFlag(flags, 'SELECTED_FLAG');
    }
    return flags;
  }

  override render(): this {
    this.destroyAngularComponent();
    super.render();
    this.renderAngularComponent();
    return this;
  }

  private renderAngularComponent(): void {
    const container = this.findNode('container') as HTMLDivElement;
    const { appRef, injector } = this;
    if (appRef && injector) {
      this.componentRef = createComponent(WorkflowNodeComponent, {
        hostElement: container,
        environmentInjector: injector,
      });
      appRef.attachView(this.componentRef.hostView);

      this.nodeClickSub = this.componentRef.instance.nodeClicked.subscribe((data: NodeData) => {
        this.componentRef?.changeDetectorRef.detectChanges();
        const handler = (this.constructor as typeof WorkflowNodeView).onNodeClick;
        handler?.(data);
      });

      this.updateAngularComponent();
      this.componentRef.changeDetectorRef.detectChanges();
    }
  }

  override update(): void {
    super.update();
    this.updateAngularComponent();
  }

  private updateAngularComponent(): void {
    if (!this.componentRef) return;
    const data = this.model.get('data');
    const selected = this.model.get('selected') || false;
    if (data) {
      this.componentRef.setInput('data', data);
      this.componentRef.setInput('selected', selected);
      this.componentRef.changeDetectorRef.detectChanges();
    }
  }

  override onRemove(): void {
    this.destroyAngularComponent();
    super.onRemove();
  }

  private destroyAngularComponent(): void {
    this.nodeClickSub?.unsubscribe();
    this.nodeClickSub = null;

    if (this.componentRef) {
      this.appRef?.detachView(this.componentRef.hostView);
      this.componentRef.destroy();
      this.componentRef = null;
    }
  }
}

function createWorkflowNodeView(
  appRef: ApplicationRef,
  injector: EnvironmentInjector,
  onNodeClick?: (data: NodeData) => void
): typeof WorkflowNodeView {
  return class extends WorkflowNodeView {
    static override appRef = appRef;
    static override injector = injector;
    static override onNodeClick = onNodeClick;
  };
}

const LANE_COLORS = ['var(--theme-primary-color)', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];
const PRIORIDAD_PESO: Record<string, number> = {
  URGENTE: 0,
  ALTA: 1,
  MEDIA: 2,
  BAJA: 3,
};

interface LaneSummary {
  departamento: string;
  total: number;
  pendientes: number;
  enRevision: number;
  aprobados: number;
  rechazados: number;
  urgentes: number;
  colaboradores: number;
}

interface NodeTransitionAction {
  estado: CambiarEstadoRequest.NuevoEstadoEnum;
  label: string;
  buttonClass: string;
}

@Component({
  selector: 'app-workflow-map',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, NgClass, AiCopilotComponent, FormsModule, MatIconModule],
  styles: [`
    app-workflow-map, :host {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 3.75rem);
      height: calc(100dvh - 3.75rem);
      width: 100%;
      overflow: hidden;
      background-color: #f8fafc;
    }

    /* ── Toolbar ── */
    .wf-map-toolbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;
      z-index: 10;
      flex-shrink: 0;
      flex-wrap: wrap;
      justify-content: space-between;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }

    /* ── Legend ── */
    .wf-map-legend {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 0.5rem 1.5rem;
      background: #ffffff;
      border-bottom: 1px solid #f1f5f9;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
      overflow-x: auto;
      white-space: nowrap;
      color: var(--theme-slate-500);
    }

    /* ── Body ── */
    .wf-map-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      position: relative;
    }

    @media (min-width: 768px) {
      .wf-map-body {
        flex-direction: row;
      }
    }

    .wf-map-canvas {
      flex: 1;
      position: relative;
      overflow: hidden;
      background: #f8fafc;
      min-height: 40vh;
    }

    /* ── Sidebar ── */
    .wf-map-sidebar {
      width: min(92vw, 380px);
      max-width: 92vw;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      min-height: 0;
      z-index: 50;
      border-left: 1px solid #e2e8f0;
    }

    @media (min-width: 768px) {
      .wf-map-sidebar {
        width: clamp(350px, 30vw, 400px);
        max-width: 400px;
        position: relative !important;
      }
    }

    .wf-sidebar-header {
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      background: #fafbfb;
      color: var(--theme-primary-color);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      flex-shrink: 0;
    }

    .wf-sidebar-scroll {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }

    .wf-sidebar-tabs {
      align-items: stretch;
    }

    .wf-section-title {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 0.5rem 1rem;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--theme-slate-500);
    }

    /* ── JointJS link overrides ── */
    .joint-paper .joint-link .connection {
      stroke: #94a3b8 !important;
      stroke-width: 2px !important;
      fill: none !important;
    }

    .joint-paper .joint-link:hover .connection,
    .joint-paper .joint-link.selected .connection {
      stroke: #0d9488 !important;
    }

    .joint-paper .joint-link .connection-wrap,
    .joint-paper .joint-link .link-tools,
    .joint-paper .joint-link .marker-vertices,
    .joint-paper .joint-link .marker-arrowheads {
      stroke: transparent !important;
      fill: none !important;
      opacity: 0 !important;
    }

    .joint-paper .joint-link .marker-target,
    .joint-paper .joint-link .marker-source {
      fill: #94a3b8 !important;
      stroke: #94a3b8 !important;
    }

    .joint-paper .joint-link:hover .marker-target,
    .joint-paper .joint-link.selected .marker-target {
      fill: #0d9488 !important;
      stroke: #0d9488 !important;
    }

    /* ── Animations ── */
    @keyframes slide-up {
      0% {
        transform: translateY(100%);
      }
      100% {
        transform: translateY(0);
      }
    }
    
    .animate-slide-up {
      animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-fade-in {
      animation: fade-in 0.2s ease-out forwards;
    }

    /* ── Mobile Layout Specifics ── */
    @media (max-width: 767px) {
      .wf-map-canvas {
        position: absolute !important;
        left: -9999px !important;
        top: -9999px !important;
        width: 100% !important;
        height: 100% !important;
        z-index: -10 !important;
        min-height: auto !important;
      }
      
      .wf-map-canvas.mobile-active-canvas {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        z-index: 10 !important;
      }
    }
  `],
  template: `
    <!-- Responsive layout wrapper -->
    <div class="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#f8fafc]">
      
      <!-- ═══ DESKTOP TOOLBAR (Hidden on Mobile) ═══ -->
      <div class="hidden md:flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200/80 bg-white shrink-0 shadow-sm relative z-10">
        <div class="flex items-center gap-3.5 mr-auto">
          <div class="h-10 w-10 bg-teal-50 border border-teal-150 text-teal-700 rounded-xl flex items-center justify-center shrink-0">
            <mat-icon fontSet="material-symbols-rounded" class="!text-xl font-bold">map</mat-icon>
          </div>
          <div class="space-y-0.5">
            <h2 class="text-xs font-black uppercase tracking-tight text-slate-900 leading-tight">Mapa Operativo del Workflow</h2>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[9px] font-black bg-teal-50 border border-teal-200/80 text-teal-700 px-2 py-0.5 uppercase rounded-md">Joint.js Core Engine</span>
              @if (lastSyncLabel) {
                <span class="text-[9px] font-bold text-slate-450 uppercase bg-slate-50 border border-slate-250/50 px-2.5 py-0.5 rounded-md">Sync {{ lastSyncLabel }}</span>
              }
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button (click)="syncNow()" class="flex items-center gap-1.5 px-3.5 py-2 border border-teal-250 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl text-xs font-bold uppercase transition-all shadow-sm cursor-pointer">
            <mat-icon fontSet="material-symbols-rounded" class="!text-sm font-bold">sync</mat-icon>
            <span>Sincronizar</span>
          </button>
          
          <button (click)="toggleAutoSync()" class="flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold uppercase transition-all shadow-sm cursor-pointer"
            [ngClass]="autoSync ? 'bg-teal-600 text-white border-teal-750 hover:bg-teal-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'">
            <mat-icon fontSet="material-symbols-rounded" class="!text-sm font-bold">{{ autoSync ? 'sync_saved_locally' : 'sync_disabled' }}</mat-icon>
            <span>Auto {{ autoSync ? 'Activo' : 'Pausado' }}</span>
          </button>

          <div class="hidden sm:flex items-center border border-slate-200/85 rounded-xl bg-white ml-2 overflow-hidden px-1.5 py-1 shadow-sm">
            <button (click)="zoomOut()" class="w-7 h-7 flex items-center justify-center font-bold text-sm hover:bg-slate-50 text-slate-600 rounded-lg cursor-pointer">-</button>
            <span class="px-2.5 font-mono text-[10px] font-black min-w-[45px] text-center select-none text-slate-700">{{ zoomLevel }}%</span>
            <button (click)="zoomIn()" class="w-7 h-7 flex items-center justify-center font-bold text-sm hover:bg-slate-50 text-slate-600 rounded-lg cursor-pointer">+</button>
          </div>

          <button (click)="resetZoom()" class="hidden sm:flex items-center gap-1 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold uppercase transition shadow-sm cursor-pointer ml-1">
            <mat-icon fontSet="material-symbols-rounded" class="!text-xs font-bold">aspect_ratio</mat-icon>
            <span>Reajustar</span>
          </button>
          
          <button (click)="fitAll()" class="flex items-center gap-1.5 px-3.5 py-2 border border-teal-250 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl text-xs font-bold uppercase shadow-sm transition-all cursor-pointer">
            <mat-icon fontSet="material-symbols-rounded" class="!text-sm font-bold">zoom_out_map</mat-icon>
            <span>Ver Todo</span>
          </button>

           <button [routerLink]="['/']" class="flex items-center gap-1 px-3.5 py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold uppercase shadow-sm cursor-pointer ml-2">
            <mat-icon fontSet="material-symbols-rounded" class="!text-sm font-bold">arrow_back</mat-icon>
            <span>Volver</span>
          </button>
        </div>
      </div>

      <!-- ═══ DESKTOP LEGEND (Hidden on Mobile) ═══ -->
      <div class="hidden md:flex items-center gap-4 px-6 py-2.5 bg-slate-50/50 border-b border-slate-200/75 text-[9px] font-black uppercase tracking-wider text-slate-500 shrink-0">
        <span class="text-slate-400 font-extrabold flex items-center gap-1">
          <mat-icon fontSet="material-symbols-rounded" class="!text-xs font-bold text-slate-400">info</mat-icon>
          <span>Indicadores:</span>
        </span>
        <div class="flex items-center gap-4">
          @for (item of legendItems; track item.label) {
            <span class="flex items-center gap-1.5 bg-white border border-slate-200/50 px-2.5 py-1 rounded-lg shadow-sm">
              <span class="h-2 w-2 rounded-full border border-slate-200/20" [ngClass]="item.class"></span>
              <span class="text-slate-600 font-bold">{{ item.label }}</span>
            </span>
          }
        </div>
        @if (loading) {
          <span class="ml-auto text-teal-600 font-black animate-pulse flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping"></span>
            <span>Buscando cambios en tiempo real...</span>
          </span>
        }
        @if (!loading && errorMessage) {
          <span class="ml-auto text-rose-600 font-bold bg-rose-50 border border-rose-150 px-2.5 py-1 rounded-lg shadow-sm">{{ errorMessage }}</span>
        }
      </div>

      <!-- ═══ MOBILE PWA TOP BAR (Hidden on Desktop) ═══ -->
      <div class="md:hidden flex items-center justify-between px-4 py-3.5 bg-white border-b border-slate-100 shrink-0 shadow-sm">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 bg-teal-600 rounded-full animate-pulse"></span>
          <h2 class="text-xs font-black uppercase tracking-wider text-slate-800">Mapa Operativo PWA</h2>
        </div>
        <div class="flex items-center gap-1.5">
          <button (click)="syncNow()" class="p-2 rounded-full hover:bg-slate-50 text-slate-600 bg-white border border-slate-100 flex items-center justify-center shrink-0" title="Sincronizar">
            <mat-icon fontSet="material-symbols-rounded" class="!text-sm font-bold">sync</mat-icon>
          </button>
        </div>
      </div>

      <!-- ═══ PRIMARY CONTENT CONTAINER ═══ -->
      <div class="wf-map-body relative">
        
        <!-- Shared JointJS Canvas (Responsive Positioning) -->
        <div class="wf-map-canvas" #paperContainer
            [ngClass]="{'mobile-active-canvas': activeMobileTab() === 'mapa'}"
            (wheel)="onWheel($event)"
            (mousedown)="onMouseDown($event)"
            (mousemove)="onMouseMove($event)"
            (mouseup)="onMouseUp()"
            (mouseleave)="onMouseUp()"
            (touchstart)="onTouchStart($event)"
            (touchmove)="onTouchMove($event)"
            (touchend)="onTouchEnd()"
            style="cursor: grab;">
          
          <!-- Mobile Overlaid Map Toolbar -->
          <div class="md:hidden absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            <div class="flex items-center gap-1 pointer-events-auto">
              <button (click)="zoomOut()" class="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-600 flex items-center justify-center font-bold text-sm shadow-md hover:bg-slate-50">-</button>
              <span class="px-2.5 py-1.5 bg-white border border-slate-100 rounded-full font-mono text-[9px] font-bold text-slate-700 shadow-md">{{ zoomLevel }}%</span>
              <button (click)="zoomIn()" class="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-600 flex items-center justify-center font-bold text-sm shadow-md hover:bg-slate-50">+</button>
            </div>
            <div class="flex items-center gap-1.5 pointer-events-auto">
              <button (click)="resetZoom()" class="border border-slate-200 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase bg-white text-slate-600 shadow-md">Reajustar</button>
              <button (click)="fitAll()" class="border border-teal-200 bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase shadow-md">Ver Todo</button>
            </div>
          </div>

          <div #canvas></div>
        </div>

        <!-- Desktop Sidebar (Hidden on Mobile) -->
        <aside class="hidden md:flex wf-map-sidebar bg-white border-l border-slate-200/80">
          <div class="wf-sidebar-main-header px-4 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-800">Panel de Control Operativo</span>
          </div>

          <!-- Modern KPI Cards Deck -->
          <div class="grid grid-cols-3 gap-2 border-b border-slate-150/65 bg-slate-50/40 p-3 shrink-0">
            <div class="bg-white border border-slate-200/70 p-2.5 rounded-xl text-center shadow-sm">
              <span class="text-[8px] font-bold uppercase text-slate-450 tracking-wider block">Calles</span>
              <span class="text-sm font-black text-slate-850 block mt-0.5">{{ totalDepartamentos }}</span>
            </div>
            <div class="bg-white border border-slate-200/70 p-2.5 rounded-xl text-center shadow-sm">
              <span class="text-[8px] font-bold uppercase text-slate-455 tracking-wider block">Trámites</span>
              <span class="text-sm font-black text-slate-850 block mt-0.5">{{ totalSolicitudes }}</span>
            </div>
            <div class="bg-white border border-slate-200/70 p-2.5 rounded-xl text-center shadow-sm flex flex-col justify-between">
              <span class="text-[8px] font-bold uppercase text-slate-455 tracking-wider block">Online</span>
              <div class="flex items-center justify-center gap-1.5 mt-0.5">
                <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
                <span class="text-sm font-black text-emerald-600">{{ presenciaResumen?.totalOnlineVisible || 0 }}</span>
              </div>
            </div>
          </div>

          <!-- Tabs -->
          <div class="wf-sidebar-tabs flex border-b border-slate-100 shrink-0 bg-slate-50/50 p-1.5 gap-1.5">
            <button (click)="activeSidebarTab.set('ia')" [class.bg-white]="activeSidebarTab() === 'ia'" [class.shadow-sm]="activeSidebarTab() === 'ia'" [class.text-teal-700]="activeSidebarTab() === 'ia'" class="wf-sidebar-tab flex-1 py-2 rounded-xl text-[9px] font-black uppercase text-slate-500 tracking-wider transition-all flex items-center justify-center gap-1.5 hover:bg-white/60 cursor-pointer">
              <span class="h-1.5 w-1.5 bg-teal-500 rounded-full animate-pulse"></span>
              <span>Copiloto IA</span>
            </button>
            <button (click)="activeSidebarTab.set('calles')" [class.bg-white]="activeSidebarTab() === 'calles'" [class.shadow-sm]="activeSidebarTab() === 'calles'" [class.text-teal-700]="activeSidebarTab() === 'calles'" class="wf-sidebar-tab flex-1 py-2 rounded-xl text-[9px] font-black uppercase text-slate-500 tracking-wider transition-all hover:bg-white/60 cursor-pointer">
              <span>Calles y Flujos</span>
            </button>
          </div>

          <div class="flex-1 flex flex-col min-h-0 bg-white relative">
            @if (activeSidebarTab() === 'calles') {
              <div class="flex flex-col flex-1 min-h-0 overflow-y-auto">
                @if (selectedNode) {
                  <div class="border-b border-slate-150 bg-teal-50/15 p-4 shrink-0 z-10 sticky top-0 backdrop-blur-md">
                    <p class="text-[8.5px] font-black uppercase tracking-wider text-emerald-600 mb-2 flex items-center gap-1.5">
                      <mat-icon fontSet="material-symbols-rounded" class="!text-xs font-bold text-teal-600">my_location</mat-icon>
                      <span>Elemento en Foco</span>
                    </p>
                    <div class="border border-teal-150/70 bg-white p-3.5 rounded-xl shadow-sm mb-3.5 relative overflow-hidden">
                      <div class="absolute left-0 top-0 h-full w-1 bg-teal-500"></div>
                      <div class="flex justify-between items-start gap-2.5">
                        <p class="text-[9px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">{{ selectedNode.codigo }}</p>
                        <span class="text-[8px] font-black uppercase px-2.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600 shrink-0">{{ selectedNode.estado }}</span>
                      </div>
                      <p class="text-xs font-black text-slate-900 leading-snug mt-2.5 text-left">{{ selectedNode.titulo }}</p>
                      <div class="flex items-center gap-1 text-[8.5px] font-bold text-slate-400 mt-3 uppercase tracking-wider">
                        <span>Dpto Asignado:</span>
                        <span class="text-slate-700 font-extrabold">{{ selectedNode.departamento }}</span>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2 mb-3.5">
                      <button (click)="abrirDetalleSeleccionado()" class="border border-teal-250 bg-teal-50 hover:bg-teal-100 text-teal-700 py-2.5 rounded-xl text-[9px] font-bold uppercase shadow-sm transition-all flex items-center justify-center cursor-pointer gap-1">
                        <mat-icon fontSet="material-symbols-rounded" class="!text-xs font-bold">folder_open</mat-icon>
                        <span>Ver Expediente</span>
                      </button>
                      <button (click)="enfocarNodoSeleccionado()" class="border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2.5 rounded-xl text-[9px] font-bold uppercase shadow-sm transition-all flex items-center justify-center cursor-pointer gap-1">
                        <mat-icon fontSet="material-symbols-rounded" class="!text-xs font-bold">gps_fixed</mat-icon>
                        <span>Centrar Mapa</span>
                      </button>
                    </div>

                    @if (puedeEjecutarAccionesNodo()) {
                      <div class="space-y-2 mb-3.5">
                        <span class="text-[8.5px] font-black text-slate-450 uppercase tracking-widest block">Transiciones Disponibles</span>
                        <div class="grid grid-cols-2 gap-2">
                          @for (accion of transicionesDisponibles(); track accion.estado) {
                            <button (click)="cambiarEstadoSeleccionado(accion.estado)" [disabled]="loadingOperacion"
                              class="border py-2.5 rounded-xl text-[9.5px] font-bold uppercase shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-center cursor-pointer bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              [ngClass]="accion.estado === 'APROBADO' ? 'bg-emerald-50 border-emerald-250 text-emerald-800 hover:bg-emerald-100' : 
                                         (accion.estado === 'RECHAZADO' ? 'bg-rose-50 border-rose-250 text-rose-800 hover:bg-rose-100' : '')">
                              {{ accion.label }}
                            </button>
                          }
                        </div>
                      </div>
                    }

                    @if (puedeRecomendarReasignacion()) {
                      <div class="space-y-2 mb-3.5">
                        <span class="text-[8.5px] font-black text-slate-450 uppercase tracking-widest block">Inteligencia Artificial de Carga</span>
                        <button (click)="cargarRecomendacionSeleccionada()" class="w-full border border-amber-250 bg-amber-50 hover:bg-amber-100 text-amber-800 py-2.5 rounded-xl text-[9px] font-black uppercase shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                          <mat-icon fontSet="material-symbols-rounded" class="!text-sm font-bold animate-pulse text-amber-600">psychology</mat-icon>
                          <span>Sugerencia IA de Cargas</span>
                        </button>
                        
                        @if (loadingRecomendacion) { <p class="text-[8.5px] font-black text-emerald-600 uppercase animate-pulse py-1 text-center">Consultando TensorFlow...</p> }
                        @if (errorRecomendacion) { <p class="text-[8.5px] font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-150 mt-1 leading-normal">{{ errorRecomendacion }}</p> }
                        @if (recomendacionSeleccionada) {
                          <div class="border border-emerald-200 bg-emerald-50/20 p-3.5 rounded-xl mt-2 shadow-sm space-y-2">
                            <div class="flex items-center gap-1.5 text-emerald-800">
                              <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                              <span class="text-[8.5px] font-bold uppercase tracking-wider">Destino Sugerido:</span>
                            </div>
                            <p class="font-black text-emerald-850 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 text-[11px] text-center uppercase tracking-wide shadow-inner">{{ recomendacionSeleccionada.departamentoSugerido || 'Sin reasignación' }}</p>
                            
                            @if (puedeAplicarRecomendacion()) {
                              <button (click)="aplicarRecomendacionSeleccionada()" [disabled]="loadingOperacion"
                                class="w-full bg-emerald-500 text-white py-2.5 rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer gap-1">
                                <mat-icon fontSet="material-symbols-rounded" class="!text-sm">done_all</mat-icon>
                                <span>Aplicar Reasignación</span>
                              </button>
                            }
                          </div>
                        }
                      </div>
                    }

                    @if (loadingOperacion) { <p class="text-[8.5px] font-black text-emerald-600 uppercase text-center animate-pulse py-1">Procesando cambio...</p> }
                    @if (operacionError) { <p class="text-[8.5px] font-bold text-rose-600 text-center bg-rose-50 border border-rose-150 p-2 rounded-xl mt-1.5">{{ operacionError }}</p> }
                    @if (operacionMensaje) { <p class="text-[8.5px] font-bold text-emerald-700 text-center bg-emerald-50 border border-emerald-150 p-2 rounded-xl uppercase mt-1.5 tracking-wider font-extrabold">{{ operacionMensaje }}</p> }
                  </div>
                }

                <div class="flex-1 overflow-y-auto bg-white">
                  <div class="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-wider sticky top-0 z-[5]">Listado de Calles / Departamentos</div>
                  @for (lane of filteredLanes(); track lane.departamento) {
                    <button class="w-full text-left px-4 py-3.5 border-b border-slate-100 hover:bg-slate-50/50 transition-colors group focus:bg-teal-50/40 focus:outline-none cursor-pointer" (click)="focusLane(lane.departamento)">
                      <div class="flex items-start justify-between gap-3 mb-2">
                        <span class="text-[10px] font-black text-slate-800 uppercase tracking-wide group-hover:text-teal-750 transition-colors leading-tight text-left">{{ lane.departamento }}</span>
                        <span class="text-[9px] font-black bg-slate-150/70 text-slate-700 px-2.5 py-0.5 rounded-md shrink-0">{{ lane.total }}</span>
                      </div>
                      <div class="flex items-center gap-2.5 text-[8px] font-black uppercase text-slate-400 flex-wrap">
                        <span class="flex items-center gap-1.5 bg-amber-50/60 text-amber-700 px-2 py-0.5 rounded border border-amber-100/50"><div class="w-1.5 h-1.5 bg-amber-400 rounded-full animate-fade-in shrink-0"></div> {{ lane.pendientes }} Pend</span>
                        <span class="flex items-center gap-1.5 bg-indigo-50/60 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100/50"><div class="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-fade-in shrink-0"></div> {{ lane.enRevision }} Rev</span>
                        <span class="flex items-center gap-1.5 bg-emerald-50/60 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100/50"><div class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-fade-in shrink-0"></div> {{ lane.aprobados }} Aprob</span>
                      </div>
                    </button>
                  }
                </div>
              </div>
            } @else {
              <div class="flex-1 overflow-hidden relative">
                <app-ai-copilot
                  [callesData]="callesDataSnapshot()"
                  [presencia]="presenciaResumen"
                  (copilotEvent)="onCopilotEvent($event)">
                </app-ai-copilot>
              </div>
            }
          </div>
        </aside>

        <!-- ═══ MOBILE CONTENT SELECTORS (Hidden on Desktop) ═══ -->
        
        <!-- Mobile Calles View tab content -->
        <div class="md:hidden flex-1 flex flex-col min-h-0 bg-[#f8fafc]" [class.hidden]="activeMobileTab() !== 'calles'">
          <div class="flex-1 flex flex-col min-h-0 overflow-y-auto bg-slate-50/30 px-4 py-4 gap-3">
            
            <!-- Small Overview KPI banner -->
            <div class="grid grid-cols-3 gap-3 bg-white p-3.5 border border-slate-100 rounded-2xl shadow-sm shrink-0">
              <div class="flex flex-col items-center text-center">
                <span class="text-[8px] font-bold uppercase tracking-wider text-slate-400">Calles/Dptos</span>
                <span class="text-sm font-bold text-slate-800 mt-0.5">{{ totalDepartamentos }}</span>
              </div>
              <div class="flex flex-col items-center text-center">
                <span class="text-[8px] font-bold uppercase tracking-wider text-slate-400">En Tránsito</span>
                <span class="text-sm font-bold text-slate-800 mt-0.5">{{ totalSolicitudes }}</span>
              </div>
              <div class="flex flex-col items-center text-center">
                <span class="text-[8px] font-bold uppercase tracking-wider text-slate-400">Presencia</span>
                <span class="text-sm font-bold text-emerald-600 mt-0.5 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
                  {{ presenciaResumen?.totalOnlineVisible || 0 }}
                </span>
              </div>
            </div>

            <!-- Search input inside the list -->
            <div class="relative shrink-0">
              <input type="text" [ngModel]="laneSearchQuery()" (ngModelChange)="laneSearchQuery.set($event)" 
                     placeholder="Filtrar por departamento..." 
                     class="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[11px] font-semibold text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-50 shadow-sm" />
            </div>

            <!-- Lanes List -->
            <div class="flex-1 flex flex-col gap-3 min-h-0">
              @for (lane of filteredLanes(); track lane.departamento) {
                <div class="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
                  
                  <!-- Lane Accordion Header -->
                  <button (click)="toggleLaneExpand(lane.departamento)" class="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 bg-white border-none outline-none cursor-pointer hover:bg-slate-50 transition-colors">
                    <div class="flex flex-col gap-1">
                      <span class="text-[11px] font-bold text-slate-800 uppercase tracking-wide leading-tight text-left">{{ lane.departamento }}</span>
                      <div class="flex items-center gap-2.5 text-[9px] font-bold uppercase text-slate-400">
                        <span class="flex items-center gap-1"><div class="w-1.5 h-1.5 bg-amber-400 rounded-full animate-fade-in"></div> {{ lane.pendientes }}</span>
                        <span class="flex items-center gap-1"><div class="w-1.5 h-1.5 bg-blue-400 rounded-full animate-fade-in"></div> {{ lane.enRevision }}</span>
                        <span class="flex items-center gap-1"><div class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-fade-in"></div> {{ lane.aprobados }}</span>
                      </div>
                    </div>
                    
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">{{ lane.total }}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                           class="text-slate-400 transition-transform duration-300"
                           [class.rotate-180]="expandedLane() === lane.departamento">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  </button>

                  <!-- Lane Solicitudes Cards List (Collapsible) -->
                  @if (expandedLane() === lane.departamento) {
                    <div class="px-4 pb-4 pt-1.5 flex flex-col gap-2.5 bg-slate-50/50 border-t border-slate-50 transition-all duration-300">
                      @for (sol of getSolicitudesPorDepartamento(lane.departamento); track sol.id) {
                        <div (click)="openMobileSolicitudDrawer(sol)" class="bg-white border border-slate-100 p-3.5 rounded-xl shadow-sm hover:shadow active:scale-[0.99] transition-all flex flex-col gap-2 cursor-pointer">
                          <div class="flex items-center justify-between gap-2">
                            <span class="font-mono text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">{{ sol.codigoSeguimiento }}</span>
                            <span class="text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                                  [ngClass]="getPrioridadBadgeTailwind(sol.prioridad)">{{ sol.prioridad }}</span>
                          </div>
                          <p class="text-[11px] font-bold text-slate-800 leading-normal text-left">{{ sol.titulo }}</p>
                          <div class="flex items-center justify-between gap-2 text-[9px] text-slate-400 font-bold">
                            <span class="text-teal-600 bg-teal-50/50 px-1.5 py-0.5 rounded uppercase">{{ sol.estado }}</span>
                            <span class="truncate max-w-[120px]">{{ sol.usuarioAsignado || sol.usuarioCreador }}</span>
                          </div>
                        </div>
                      } @empty {
                        <p class="text-[9px] font-bold uppercase text-slate-400 text-center py-4">Sin solicitudes en esta calle</p>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Mobile IA View tab content -->
        <div class="md:hidden flex-1 flex flex-col min-h-0" [class.hidden]="activeMobileTab() !== 'ia'">
          <app-ai-copilot
            [callesData]="callesDataSnapshot()"
            [presencia]="presenciaResumen"
            (copilotEvent)="onCopilotEvent($event)">
          </app-ai-copilot>
        </div>

      </div>

      <!-- Mobile Floating Tab Bar -->
      <div class="md:hidden fixed bottom-4 left-4 right-4 bg-white/90 backdrop-filter backdrop-blur-md border border-slate-100 shadow-xl rounded-2xl flex items-center justify-around py-2.5 px-4 z-50">
        <button (click)="switchMobileTab('mapa')" 
                [class.text-teal-600]="activeMobileTab() === 'mapa'" 
                [class.text-slate-400]="activeMobileTab() !== 'mapa'"
                class="flex flex-col items-center gap-1 bg-transparent border-none outline-none cursor-pointer transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>
          <span class="text-[9px] font-bold uppercase tracking-wider">Mapa</span>
        </button>
        
        <button (click)="switchMobileTab('calles')" 
                [class.text-teal-600]="activeMobileTab() === 'calles'" 
                [class.text-slate-400]="activeMobileTab() !== 'calles'"
                class="flex flex-col items-center gap-1 bg-transparent border-none outline-none cursor-pointer transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          <span class="text-[9px] font-bold uppercase tracking-wider">Calles</span>
        </button>
        
        <button (click)="switchMobileTab('ia')" 
                [class.text-teal-600]="activeMobileTab() === 'ia'" 
                [class.text-slate-400]="activeMobileTab() !== 'ia'"
                class="flex flex-col items-center gap-1 bg-transparent border-none outline-none cursor-pointer transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span class="text-[9px] font-bold uppercase tracking-wider">Copiloto</span>
        </button>
      </div>

    </div>

    <!-- Bottom Sheet Drawer for Mobile -->
    @if (selectedNode && showBottomDrawer()) {
      <div class="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] transition-opacity flex items-end animate-fade-in" (click)="closeMobileDrawer()">
        <div class="w-full bg-white rounded-t-[2rem] border-t border-slate-100 shadow-2xl p-6 flex flex-col gap-4 animate-slide-up relative max-h-[85vh] overflow-y-auto" (click)="$event.stopPropagation()">
          
          <!-- Handle -->
          <div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto shrink-0 mb-2"></div>
          
          <!-- Header -->
          <div class="flex justify-between items-start gap-4">
            <div class="flex flex-col gap-1">
              <span class="font-mono text-[9px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-100 max-w-max">{{ selectedNode.codigo }}</span>
              <h3 class="text-sm font-black text-slate-950 leading-snug mt-1.5 text-left">{{ selectedNode.titulo }}</h3>
            </div>
            <button (click)="closeMobileDrawer()" class="p-2 rounded-full hover:bg-slate-100 text-slate-400 bg-transparent border-none outline-none cursor-pointer flex items-center justify-center">
              <mat-icon fontSet="material-symbols-rounded" class="!text-lg">close</mat-icon>
            </button>
          </div>
          
          <!-- Meta details grid -->
          <div class="grid grid-cols-2 gap-3 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-150/60">
            <div class="text-left space-y-0.5">
              <span class="text-[8px] font-bold uppercase text-slate-455 tracking-wider">Estado</span>
              <p class="text-[10px] font-black text-slate-800 uppercase">{{ selectedNode.estado }}</p>
            </div>
            <div class="text-left space-y-0.5">
              <span class="text-[8px] font-bold uppercase text-slate-455 tracking-wider">Prioridad</span>
              <p class="text-[10px] font-black text-rose-600 uppercase">{{ selectedNode.prioridad }}</p>
            </div>
            <div class="text-left space-y-0.5">
              <span class="text-[8px] font-bold uppercase text-slate-455 tracking-wider">Responsable</span>
              <p class="text-[10px] font-black text-slate-800 truncate">{{ selectedNode.usuarioAsignado || selectedNode.usuarioCreador || 'Sin asignar' }}</p>
            </div>
            <div class="text-left space-y-0.5">
              <span class="text-[8px] font-bold uppercase text-slate-455 tracking-wider">Calle/Dpto</span>
              <p class="text-[10px] font-black text-teal-600 truncate">{{ selectedNode.departamento }}</p>
            </div>
          </div>
          
          <!-- Operations / Actions -->
          @if (puedeEjecutarAccionesNodo()) {
            <div class="flex flex-col gap-2 mt-1">
              <span class="text-[8.5px] font-black uppercase text-slate-455 tracking-widest text-left">Acciones de Transición</span>
              <div class="grid gap-2.5" [class.grid-cols-2]="transicionesDisponibles().length > 1" [class.grid-cols-1]="transicionesDisponibles().length === 1">
                @for (accion of transicionesDisponibles(); track accion.estado) {
                  <button (click)="cambiarEstadoSeleccionado(accion.estado)" [disabled]="loadingOperacion"
                    class="py-3 rounded-xl text-[10px] font-bold uppercase shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-center bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                    [ngClass]="accion.estado === 'APROBADO' ? 'bg-emerald-50 border-emerald-250 text-emerald-800 hover:bg-emerald-100' : 
                               (accion.estado === 'RECHAZADO' ? 'bg-rose-50 border-rose-250 text-rose-800 hover:bg-rose-100' : '')">
                    {{ accion.label }}
                  </button>
                }
              </div>
            </div>
          }
          
          <!-- IA Suggestions -->
          @if (puedeRecomendarReasignacion()) {
            <div class="flex flex-col gap-2 mt-1">
              <span class="text-[8.5px] font-black uppercase text-slate-455 tracking-widest text-left">Inteligencia Artificial de Carga</span>
              @if (!recomendacionSeleccionada) {
                <button (click)="cargarRecomendacionSeleccionada()" class="w-full border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 py-3 rounded-xl text-[10px] font-bold uppercase shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                  <mat-icon fontSet="material-symbols-rounded" class="!text-sm font-bold text-amber-600">psychology</mat-icon>
                  <span>Sugerencia de Reasignación IA</span>
                </button>
              }
              @if (loadingRecomendacion) {
                <p class="text-[9px] font-black text-emerald-600 uppercase animate-pulse text-center py-2">Calculando recomendación en TensorFlow...</p>
              }
              @if (errorRecomendacion) {
                <p class="text-[9px] font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-left leading-normal">{{ errorRecomendacion }}</p>
              }
              @if (recomendacionSeleccionada) {
                <div class="border border-emerald-200 bg-emerald-50/20 p-3.5 rounded-2xl shadow-sm flex flex-col gap-2">
                  <div class="flex items-center gap-1.5 text-emerald-800">
                    <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping shrink-0"></span>
                    <span class="text-[8.5px] font-bold uppercase tracking-wider text-left">Destino recomendado:</span>
                  </div>
                  <p class="font-black text-emerald-850 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 text-xs text-center uppercase tracking-wide shadow-inner">{{ recomendacionSeleccionada.departamentoSugerido }}</p>
                  @if (puedeAplicarRecomendacion()) {
                    <button (click)="aplicarRecomendacionSeleccionada()" [disabled]="loadingOperacion"
                      class="w-full bg-emerald-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer gap-1">
                      <mat-icon fontSet="material-symbols-rounded" class="!text-sm">done_all</mat-icon>
                      <span>Aplicar Sugerencia</span>
                    </button>
                  }
                </div>
              }
            </div>
          }

          <!-- General operation status messages -->
          @if (loadingOperacion) { <p class="text-[9px] font-black text-emerald-600 uppercase text-center animate-pulse py-1">Guardando cambios...</p> }
          @if (operacionError) { <p class="text-[9px] font-bold text-rose-600 text-center bg-rose-50 border border-rose-150 p-2.5 rounded-xl mt-1 leading-normal">{{ operacionError }}</p> }
          @if (operacionMensaje) { <p class="text-[9px] font-bold text-emerald-700 text-center bg-emerald-50 border border-emerald-150 p-2.5 rounded-xl uppercase mt-1 leading-normal tracking-wider font-extrabold">{{ operacionMensaje }}</p> }

          <!-- Secondary details button -->
          <button (click)="abrirDetalleSeleccionado()" class="w-full border border-slate-250 hover:bg-slate-50 text-slate-600 py-3 rounded-xl text-[10px] font-bold uppercase shadow-sm transition-all flex items-center justify-center mt-2 bg-slate-50/50 cursor-pointer gap-1">
            <mat-icon fontSet="material-symbols-rounded" class="!text-sm">folder_open</mat-icon>
            <span>Ver Expediente Completo</span>
          </button>
        </div>
      </div>
    }
  `
})
export class WorkflowMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef;
  @ViewChild('paperContainer', { static: true }) paperContainer!: ElementRef;

  private graph!: joint.dia.Graph;
  private paper!: joint.dia.Paper;

  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly workflowApi = inject(WorkflowDepartamentalService);
  private readonly workflowSupportService = inject(WorkflowSupportService);
  private readonly cdr = inject(ChangeDetectorRef);

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private laneFocusMap: Record<string, { x: number; y: number }> = {};
  private nodeFocusMap: Record<string, { x: number; y: number }> = {};
  private nodeDataMap: Record<string, NodeData> = {};

  showMobileSidebar = signal(false);
  activeMobileTab = signal<'mapa' | 'calles' | 'ia'>('calles');
  expandedLane = signal<string | null>(null);
  showBottomDrawer = signal(false);
  zoomLevel = 100;
  loading = false;
  autoSync = true;

  errorMessage = '';
  lastSyncLabel = '';

  totalDepartamentos = 0;
  totalSolicitudes = 0;
  activeSidebarTab = signal<'calles' | 'ia'>('ia');

  /** Snapshot of calles data to feed into the AI Copilot component */
  callesDataSnapshot = signal<Record<string, SolicitudResponse[]>>({});

  presenciaResumen: PresenciaResumen | null = null;
  laneSummary = signal<LaneSummary[]>([]);
  laneSearchQuery = signal('');
  filteredLanes = computed(() => {
    const q = this.laneSearchQuery().toLowerCase();
    return this.laneSummary().filter(l => l.departamento.toLowerCase().includes(q));
  });

  selectedNode: NodeData | null = null;
  selectedNodePanelOpen = signal(true);
  recomendacionSeleccionada: ReasignacionRecomendacion | null = null;
  loadingRecomendacion = false;
  errorRecomendacion = '';
  loadingOperacion = false;
  operacionError = '';
  operacionMensaje = '';

  legendItems = [
    { label: 'PENDIENTE', class: 'border-amber-500 bg-amber-50' },
    { label: 'EN REVISION', class: 'border-blue-500 bg-blue-50' },
    { label: 'APROBADO', class: 'border-emerald-500 bg-emerald-50' },
    { label: 'RECHAZADO', class: 'border-red-500 bg-red-50' },
  ];

  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private originTranslate = { tx: 0, ty: 0 };

  /** Handle events from the AI Copilot panel */
  onCopilotEvent(event: CopilotEvent) {
    switch (event.type) {
      case 'focus_lane':
        this.focusLane(event.payload);
        break;
      case 'focus_node':
        if (event.payload && this.nodeFocusMap[event.payload]) {
          this.selectedNode = this.nodeDataMap[event.payload] ?? null;
          this.enfocarNodoSeleccionado();
        }
        break;
      case 'refresh':
        this.syncNow(true);
        break;
      case 'navigate':
        if (event.payload) {
          this.router.navigate(event.payload);
        }
        break;
    }
  }

  switchMobileTab(tab: 'mapa' | 'calles' | 'ia') {
    this.activeMobileTab.set(tab);
    if (tab === 'mapa') {
      setTimeout(() => {
        if (this.paper && this.paperContainer) {
          const width = this.paperContainer.nativeElement.offsetWidth || 1600;
          this.paper.setDimensions(width, 1800);
          this.fitAll();
        }
      }, 200);
    }
  }

  toggleLaneExpand(laneName: string) {
    if (this.expandedLane() === laneName) {
      this.expandedLane.set(null);
    } else {
      this.expandedLane.set(laneName);
    }
  }

  getSolicitudesPorDepartamento(departamento: string): SolicitudResponse[] {
    const list = this.callesDataSnapshot()[departamento] || [];
    return this.ordenarSolicitudes(list);
  }

  getPrioridadBadgeTailwind(prioridad?: string): string {
    switch (prioridad) {
      case 'URGENTE': return 'bg-red-50 text-red-700 border border-red-100';
      case 'ALTA': return 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'MEDIA': return 'bg-sky-50 text-sky-700 border border-sky-100';
      case 'BAJA': return 'bg-slate-50 text-slate-600 border border-slate-100';
      default: return 'bg-slate-50 text-slate-600 border border-slate-100';
    }
  }

  openMobileSolicitudDrawer(sol: SolicitudResponse) {
    const nodeData: NodeData = {
      id: sol.id ?? '',
      codigo: sol.codigoSeguimiento ?? 'SIN-CODIGO',
      titulo: sol.titulo ?? 'Sin titulo',
      estado: sol.estado ?? 'PENDIENTE',
      prioridad: sol.prioridad ?? 'MEDIA',
      usuarioCreador: sol.usuarioCreador ?? 'sin-usuario',
      usuarioAsignado: sol.usuarioAsignado ?? null,
      departamento: sol.departamentoActual ?? '',
      estadoSla: sol.estadoSla ?? null,
      minutosRestantesSla: sol.minutosRestantesSla ?? null,
      fechaActualizacion: sol.fechaActualizacion ?? sol.fechaCreacion ?? null
    };
    this.selectedNode = nodeData;
    this.recomendacionSeleccionada = null;
    this.errorRecomendacion = '';
    this.operacionError = '';
    this.operacionMensaje = '';
    this.showBottomDrawer.set(true);
    this.cdr.detectChanges();
  }

  closeMobileDrawer() {
    this.showBottomDrawer.set(false);
    this.limpiarSeleccionNodo();
  }

  ngOnInit() {
    this.graph = new joint.dia.Graph({}, { cellNamespace: { ...joint.shapes, WorkflowNode } });
  }

  ngAfterViewInit() {
    const CustomNodeView = createWorkflowNodeView(
      this.appRef,
      this.injector,
      (data: NodeData) => this.seleccionarNodo(data)
    );

    this.paper = new joint.dia.Paper({
      el: this.canvas.nativeElement,
      model: this.graph,
      width: this.paperContainer.nativeElement.offsetWidth || 1600,
      height: 5000,
      gridSize: 10,
      drawGrid: { name: 'dot', args: { color: '#cbd5e1', thickness: 1 } },
      background: { color: '#f8fafc' },
      frozen: true,
      async: true,
      interactive: (cellView) => {
        if (cellView.model.isLink()) {
          return false;
        }
        return { elementMove: false, addLinkFromMagnet: false };
      },
      preventDefaultBlankAction: false,
      preventDefaultViewAction: false,
      cellViewNamespace: {
        ...joint.shapes,
        WorkflowNode,
        WorkflowNodeView: CustomNodeView
      }
    });

    this.paper.on('blank:pointerdown', () => {
      this.limpiarSeleccionNodo();
    });

    setTimeout(() => {
      this.syncNow();
      this.configureAutoSync();
    });
  }

  ngOnDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.paper?.remove();
  }

  get scale() {
    return this.zoomLevel / 100;
  }

  syncNow(fromAutoRefresh = false) {
    const user = this.authService.currentUser();
    if (!user) {
      this.errorMessage = 'No hay sesion activa para cargar calles';
      return;
    }

    if (!fromAutoRefresh) {
      this.loading = true;
    }

    this.errorMessage = '';
    this.cdr.detectChanges();

    forkJoin({
      calles: this.workflowSupportService.obtenerDiagramaCalles(),
      presencia: this.workflowSupportService.obtenerResumenPresencia().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ calles, presencia }) => {
        this.loading = false;
        this.presenciaResumen = presencia;

        this.callesDataSnapshot.set(calles);
        this.construirSwimlanes(calles);
        this.actualizarResumenCalles(calles);

        if (this.selectedNode?.id) {
          const refreshed = this.nodeDataMap[this.selectedNode.id];
          if (refreshed) {
            this.selectedNode = refreshed;
          } else {
            this.limpiarSeleccionNodo();
          }
        }

        this.lastSyncLabel = this.formatearHora(new Date());
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.extraerMensajeError(err);
        this.cdr.detectChanges();
        console.error('Error cargando calles', err);
      }
    });
  }

  toggleAutoSync() {
    this.autoSync = !this.autoSync;
    this.configureAutoSync();

    if (this.autoSync) {
      this.syncNow(true);
    }
  }

  private configureAutoSync() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.autoSync) {
      this.refreshTimer = setInterval(() => this.syncNow(true), 30000);
    }
  }

  private esLandscapeCompacto(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }

    return window.matchMedia('(orientation: landscape) and (max-width: 900px) and (max-height: 520px)').matches;
  }

  onlineUsersVisible() {
    return (this.presenciaResumen?.usuariosOnline ?? []).slice(0, 12);
  }

  colaPendienteResumen(): Array<{ departamento: string; cantidad: number }> {
    const cola = this.recomendacionSeleccionada?.colaPendiente;
    if (!cola) {
      return [];
    }

    return Object.entries(cola)
      .map(([departamento, cantidad]) => ({ departamento, cantidad: cantidad as number }))
      .sort((a, b) => a.cantidad - b.cantidad || a.departamento.localeCompare(b.departamento));
  }

  puedeRecomendarReasignacion(): boolean {
    const rol = this.authService.currentUser()?.rol;
    return rol === 'ADMINISTRADOR' || rol === 'REVISOR';
  }

  puedeEjecutarAccionesNodo(): boolean {
    const rol = this.authService.currentUser()?.rol;
    return !!this.selectedNode?.id && (rol === 'ADMINISTRADOR' || rol === 'REVISOR');
  }

  transicionesDisponibles(): NodeTransitionAction[] {
    if (!this.selectedNode || !this.puedeEjecutarAccionesNodo()) {
      return [];
    }

    const estado = this.selectedNode.estado;
    if (estado === 'PENDIENTE') {
      return [{
        estado: 'EN_REVISION',
        label: 'PASAR A REVISION',
        buttonClass: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
      }];
    }

    if (estado === 'EN_REVISION') {
      return [
        {
          estado: 'APROBADO',
          label: 'APROBAR',
          buttonClass: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
        },
        {
          estado: 'RECHAZADO',
          label: 'RECHAZAR',
          buttonClass: 'bg-red-100 hover:bg-red-200 text-red-700'
        }
      ];
    }

    const rol = this.authService.currentUser()?.rol;
    if (rol === 'ADMINISTRADOR') {
      return [{
        estado: 'EN_REVISION',
        label: 'REABRIR REVISION',
        buttonClass: 'bg-amber-100 hover:bg-amber-200 text-amber-800'
      }];
    }

    return [];
  }

  puedeAplicarRecomendacion(): boolean {
    const sugerido = this.recomendacionSeleccionada?.departamentoSugerido;
    if (!sugerido || !this.selectedNode) {
      return false;
    }

    return this.normalizarTexto(sugerido) !== this.normalizarTexto(this.selectedNode.departamento)
      && this.puedeRecomendarReasignacion();
  }

  seleccionarNodo(data: NodeData) {
    if (this.selectedNode?.id) {
      const prevModel = this.graph.getCell(this.selectedNode.id);
      if (prevModel) {
        prevModel.set('selected', false);
        const view = this.paper.findViewByModel(prevModel);
        if (view && (view as any).updateAngularComponent) {
          (view as any).updateAngularComponent();
        }
      }
    }
    this.selectedNode = data;
    const newModel = this.graph.getCell(data.id);
    if (newModel) {
      newModel.set('selected', true);
      const view = this.paper.findViewByModel(newModel);
      if (view && (view as any).updateAngularComponent) {
        (view as any).updateAngularComponent();
      }
    }
    this.selectedNodePanelOpen.set(!this.esLandscapeCompacto());
    this.errorRecomendacion = '';
    this.recomendacionSeleccionada = null;
    this.operacionError = '';
    this.operacionMensaje = '';
    this.showMobileSidebar.set(true); // Auto-open sidebar when selecting a node
    this.cdr.detectChanges();
  }

  limpiarSeleccionNodo() {
    if (this.selectedNode?.id) {
      const prevModel = this.graph.getCell(this.selectedNode.id);
      if (prevModel) {
        prevModel.set('selected', false);
        const view = this.paper.findViewByModel(prevModel);
        if (view && (view as any).updateAngularComponent) {
          (view as any).updateAngularComponent();
        }
      }
    }
    this.selectedNode = null;
    this.selectedNodePanelOpen.set(true);
    this.errorRecomendacion = '';
    this.recomendacionSeleccionada = null;
    this.loadingRecomendacion = false;
    this.loadingOperacion = false;
    this.operacionError = '';
    this.operacionMensaje = '';
    this.cdr.detectChanges();
  }

  enfocarNodoSeleccionado() {
    if (!this.selectedNode?.id) return;

    const focus = this.nodeFocusMap[this.selectedNode.id];
    if (!focus) return;

    const container = this.paperContainer.nativeElement as HTMLElement;
    const scale = this.scale;
    const tx = (container.offsetWidth / 2) - (focus.x * scale);
    const ty = (container.offsetHeight / 2) - (focus.y * scale);

    this.paper.translate(tx, ty);
  }

  abrirDetalleSeleccionado() {
    if (!this.selectedNode?.id) return;
    this.router.navigate(['/detalle', this.selectedNode.id]);
  }

  cargarRecomendacionSeleccionada() {
    if (!this.selectedNode?.id || !this.puedeRecomendarReasignacion()) return;

    this.loadingRecomendacion = true;
    this.errorRecomendacion = '';
    this.recomendacionSeleccionada = null;
    this.operacionMensaje = '';

    this.workflowSupportService.obtenerRecomendacionReasignacion(this.selectedNode.id).subscribe({
      next: (recomendacion) => {
        this.loadingRecomendacion = false;
        this.recomendacionSeleccionada = recomendacion;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingRecomendacion = false;
        this.errorRecomendacion = this.extraerMensajeError(err);
        this.cdr.detectChanges();
      }
    });
  }

  cambiarEstadoSeleccionado(nuevoEstado: CambiarEstadoRequest.NuevoEstadoEnum) {
    if (!this.selectedNode?.id || !this.puedeEjecutarAccionesNodo()) {
      return;
    }

    const payload: CambiarEstadoRequest = {
      nuevoEstado,
      comentario: `Actualizacion desde mapa de calles: ${this.selectedNode.estado} -> ${nuevoEstado}`
    };

    this.loadingOperacion = true;
    this.operacionError = '';
    this.operacionMensaje = '';

    this.workflowApi.cambiarEstado(this.selectedNode.id, payload).subscribe({
      next: () => {
        this.loadingOperacion = false;
        this.operacionMensaje = `Estado actualizado a ${nuevoEstado}`;
        this.syncNow(true);
      },
      error: (err) => {
        this.loadingOperacion = false;
        this.operacionError = this.extraerMensajeError(err);
        this.cdr.detectChanges();
      }
    });
  }

  aplicarRecomendacionSeleccionada() {
    if (!this.selectedNode?.id || !this.puedeAplicarRecomendacion()) {
      return;
    }

    const sugerido = this.recomendacionSeleccionada?.departamentoSugerido;
    if (!sugerido) {
      return;
    }

    const payload: ReasignarDepartamentoRequest = {
      nuevoDepartamento: sugerido,
      comentario: `Reasignacion sugerida desde mapa de calles hacia ${sugerido}`
    };

    this.loadingOperacion = true;
    this.operacionError = '';
    this.operacionMensaje = '';

    this.workflowApi.reasignarDepartamento(this.selectedNode.id, payload).subscribe({
      next: () => {
        this.loadingOperacion = false;
        this.operacionMensaje = `Solicitud reasignada a ${sugerido}`;
        this.syncNow(true);
      },
      error: (err) => {
        this.loadingOperacion = false;
        this.operacionError = this.extraerMensajeError(err);
        this.cdr.detectChanges();
      }
    });
  }

  zoomIn() {
    this.zoomLevel = Math.min(150, this.zoomLevel + 10);
    this.paper.scale(this.scale, this.scale);
  }

  zoomOut() {
    this.zoomLevel = Math.max(30, this.zoomLevel - 10);
    this.paper.scale(this.scale, this.scale);
  }

  resetZoom() {
    this.zoomLevel = 100;
    this.paper.scale(1, 1);
    this.paper.translate(0, 0);
  }

  fitAll() {
    const bbox = this.graph.getBBox();
    if (!bbox) return;

    const container = this.paperContainer.nativeElement as HTMLElement;
    const scaleX = (container.offsetWidth - 60) / bbox.width;
    const scaleY = (container.offsetHeight - 60) / bbox.height;
    const scale = Math.min(scaleX, scaleY, 1);

    this.zoomLevel = Math.round(scale * 100);
    this.paper.scale(scale, scale);
    this.paper.translate(30 - bbox.x * scale, 30 - bbox.y * scale);
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.deltaY < 0) this.zoomIn(); else this.zoomOut();
  }

  onMouseDown(e: MouseEvent) {
    this.isPanning = true;
    this.panStart = { x: e.clientX, y: e.clientY };

    const t = this.paper.translate();
    this.originTranslate = { tx: t.tx, ty: t.ty };
    (this.paperContainer.nativeElement as HTMLElement).style.cursor = 'grabbing';
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isPanning) return;

    const dx = e.clientX - this.panStart.x;
    const dy = e.clientY - this.panStart.y;
    this.paper.translate(this.originTranslate.tx + dx, this.originTranslate.ty + dy);
  }

  onMouseUp() {
    this.isPanning = false;
    (this.paperContainer.nativeElement as HTMLElement).style.cursor = 'grab';
  }

  onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    this.isPanning = true;
    this.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    const t = this.paper.translate();
    this.originTranslate = { tx: t.tx, ty: t.ty };
  }

  onTouchMove(e: TouchEvent) {
    if (!this.isPanning || e.touches.length !== 1) return;
    
    if (e.cancelable) {
      e.preventDefault();
    }

    const dx = e.touches[0].clientX - this.panStart.x;
    const dy = e.touches[0].clientY - this.panStart.y;
    this.paper.translate(this.originTranslate.tx + dx, this.originTranslate.ty + dy);
  }

  onTouchEnd() {
    this.isPanning = false;
  }

  focusLane(departamento: string) {
    const target = this.laneFocusMap[departamento];
    if (!target) return;

    const container = this.paperContainer.nativeElement as HTMLElement;
    const scale = this.scale;

    const tx = (container.offsetWidth / 2) - (target.x * scale);
    const ty = (container.offsetHeight / 2) - (target.y * scale);

    this.paper.translate(tx, ty);
  }

  private actualizarResumenCalles(callesData: Record<string, SolicitudResponse[]>) {
    const entries = Object.entries(callesData);

    this.totalDepartamentos = entries.length;
    this.totalSolicitudes = entries.reduce((acc, [, solicitudes]) => acc + solicitudes.length, 0);

    this.laneSummary.set(entries
      .map(([departamento, solicitudes]) => ({
        departamento,
        total: solicitudes.length,
        pendientes: this.contarEstado(solicitudes, 'PENDIENTE'),
        enRevision: this.contarEstado(solicitudes, 'EN_REVISION'),
        aprobados: this.contarEstado(solicitudes, 'APROBADO'),
        rechazados: this.contarEstado(solicitudes, 'RECHAZADO'),
        urgentes: solicitudes.filter((s) => (s.prioridad ?? '') === 'URGENTE').length,
        colaboradores: this.contarColaboradoresDepartamento(departamento)
      }))
      .sort((a, b) => b.total - a.total || a.departamento.localeCompare(b.departamento))
    );
  }

  private contarEstado(solicitudes: SolicitudResponse[], estado: string): number {
    return solicitudes.filter((sol) => (sol.estado ?? '') === estado).length;
  }

  private contarColaboradoresDepartamento(departamento: string): number {
    const usuarios = this.presenciaResumen?.usuariosOnline ?? [];
    const deptoNormalizado = this.normalizarTexto(departamento);

    return usuarios.filter((u: PresenciaUsuario) => this.normalizarTexto(u.depto) === deptoNormalizado).length;
  }

  private normalizarTexto(valor: string | undefined | null): string {
    return (valor ?? '').trim().toLowerCase();
  }

  construirSwimlanes(callesData: Record<string, SolicitudResponse[]>) {
    this.graph.clear();
    this.laneFocusMap = {};
    this.nodeFocusMap = {};
    this.nodeDataMap = {};

    const NODE_W = 240;
    const NODE_H = 110;
    const NODE_GAP = 30;
    const LANE_PADDING_LEFT = 180;
    const LANE_PADDING_V = 40;
    const LANE_HEIGHT = NODE_H + LANE_PADDING_V * 2;
    const LANE_HEADER_W = 160;

    const pools = Object.keys(callesData);
    let currentY = 50;

    for (const [idx, poolName] of pools.entries()) {
      const solicitudes = this.ordenarSolicitudes(callesData[poolName] ?? []);
      const laneColor = LANE_COLORS[idx % LANE_COLORS.length];

      const laneContentW = solicitudes.length > 0
        ? solicitudes.length * (NODE_W + NODE_GAP) - NODE_GAP
        : NODE_W;
      const laneW = LANE_PADDING_LEFT + laneContentW + 60;

      this.laneFocusMap[poolName] = {
        x: 40 + laneW / 2,
        y: currentY + LANE_HEIGHT / 2
      };

      const laneRect = new joint.shapes.standard.Rectangle();
      laneRect.position(40, currentY);
      laneRect.resize(laneW, LANE_HEIGHT);
      laneRect.attr({
        body: {
          fill: '#ffffff',
          stroke: 'var(--theme-element-border-color)',
          strokeWidth: 1.5,
          rx: 16,
          ry: 16
        },
        label: { text: '' }
      });
      laneRect.addTo(this.graph);

      const header = new joint.shapes.standard.Rectangle();
      header.position(40, currentY);
      header.resize(LANE_HEADER_W, LANE_HEIGHT);
      header.attr({
        body: {
          fill: laneColor,
          stroke: 'var(--theme-element-border-color)',
          strokeWidth: 1.5,
          rx: 16,
          ry: 16
        },
        label: {
          text: poolName.toUpperCase(),
          fill: '#ffffff',
          fontSize: 10,
          fontWeight: '950',
          fontFamily: 'Outfit, Manrope, sans-serif',
          letterSpacing: 1
        }
      });
      header.addTo(this.graph);

      let nodeX = 40 + LANE_HEADER_W + NODE_GAP;
      const nodeY = currentY + LANE_PADDING_V;

      solicitudes.forEach((sol, si) => {
        const nodeData: NodeData = {
          id: sol.id ?? '',
          codigo: sol.codigoSeguimiento ?? 'SIN-CODIGO',
          titulo: sol.titulo ?? 'Sin titulo',
          estado: sol.estado ?? 'PENDIENTE',
          prioridad: sol.prioridad ?? 'MEDIA',
          usuarioCreador: sol.usuarioCreador ?? 'sin-usuario',
          usuarioAsignado: sol.usuarioAsignado ?? null,
          departamento: poolName,
          estadoSla: sol.estadoSla ?? null,
          minutosRestantesSla: sol.minutosRestantesSla ?? null,
          fechaActualizacion: sol.fechaActualizacion ?? sol.fechaCreacion ?? null
        };

        const node = new WorkflowNode({
          id: nodeData.id,
          position: { x: nodeX, y: nodeY },
          size: { width: NODE_W, height: NODE_H },
          data: nodeData,
          selected: this.selectedNode?.id === nodeData.id
        });
        node.addTo(this.graph);

        if (nodeData.id) {
          this.nodeFocusMap[nodeData.id] = {
            x: nodeX + (NODE_W / 2),
            y: nodeY + (NODE_H / 2)
          };
          this.nodeDataMap[nodeData.id] = nodeData;
        }

        if (si > 0) {
          const prevX = nodeX - NODE_GAP - NODE_W;
          const link = new joint.shapes.standard.Link();
          link.source({ x: prevX + NODE_W, y: nodeY + NODE_H / 2 });
          link.target({ x: nodeX, y: nodeY + NODE_H / 2 });
          link.attr({
            line: {
              stroke: '#475569',
              strokeWidth: 2,
              strokeDasharray: '0',
              targetMarker: { type: 'path', d: 'M 8 -4 0 0 8 4 Z', fill: '#475569', stroke: 'none' }
            },
            wrapper: {
              stroke: 'transparent',
              fill: 'none',
              strokeWidth: 16
            },
            outline: {
              stroke: 'transparent',
              fill: 'none',
              strokeWidth: 0
            }
          });
          link.addTo(this.graph);
        }

        nodeX += NODE_W + NODE_GAP;
      });

      if (solicitudes.length === 0) {
        const placeholder = new joint.shapes.standard.Rectangle();
        placeholder.position(40 + LANE_HEADER_W + NODE_GAP, currentY + (LANE_HEIGHT - 40) / 2);
        placeholder.resize(200, 40);
        placeholder.attr({
          body: { fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1.5, strokeDasharray: '6,3', rx: 12 },
          label: {
            text: 'SIN TAREAS',
            fill: '#94a3b8',
            fontSize: 9,
            fontWeight: '900',
            fontFamily: 'Outfit, Manrope, sans-serif',
            letterSpacing: 2
          }
        });
        placeholder.addTo(this.graph);
      }

      currentY += LANE_HEIGHT + 10;
    }

    this.paper.unfreeze();
    setTimeout(() => this.fitAll(), 100);
  }

  private ordenarSolicitudes(solicitudes: SolicitudResponse[]): SolicitudResponse[] {
    return [...solicitudes].sort((a, b) => {
      const prioridadA = PRIORIDAD_PESO[a.prioridad ?? 'MEDIA'] ?? 99;
      const prioridadB = PRIORIDAD_PESO[b.prioridad ?? 'MEDIA'] ?? 99;
      if (prioridadA !== prioridadB) {
        return prioridadA - prioridadB;
      }

      const fechaA = this.obtenerTimestamp(a);
      const fechaB = this.obtenerTimestamp(b);
      if (fechaA !== fechaB) {
        return fechaB - fechaA;
      }

      return (a.codigoSeguimiento ?? '').localeCompare(b.codigoSeguimiento ?? '');
    });
  }

  private obtenerTimestamp(solicitud: SolicitudResponse): number {
    const base = solicitud.fechaActualizacion ?? solicitud.fechaCreacion;
    if (!base) return 0;

    const time = Date.parse(base);
    return Number.isNaN(time) ? 0 : time;
  }

  private formatearHora(date: Date): string {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  }

  private extraerMensajeError(error: any): string {
    if (error?.error?.mensaje && typeof error.error.mensaje === 'string') {
      return error.error.mensaje;
    }
    if (typeof error?.error === 'string' && error.error.trim()) {
      return error.error;
    }
    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message;
    }
    return 'No se pudo sincronizar el diagrama por calles';
  }
}

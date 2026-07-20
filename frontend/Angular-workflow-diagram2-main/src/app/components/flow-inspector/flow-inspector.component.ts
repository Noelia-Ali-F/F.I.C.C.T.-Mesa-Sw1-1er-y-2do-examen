import { Component, computed, input, output } from '@angular/core';
import {
  DetalleEstado,
  DetalleTransicion,
  EstadoWorkflow,
  ESTADO_VISUAL_CONFIG,
  DESCRIPCION_ESTADO
} from '../../models/workflow.models';

/**
 * Animated Premium overlay panel that shows rich details when clicking diagram nodes/edges.
 * Designed with modern Glassmorphism aesthetics matching the dashboard.
 */
@Component({
  selector: 'app-flow-inspector',
  standalone: true,
  template: `
    @if (isActive()) {
      <div class="wf-inspector-backdrop" (click)="reset.emit()"></div>
      <div class="wf-inspector-modal">
        <!-- Decorative Glow Background -->
        <div class="wf-inspector__glow" [style.background-color]="estadoDetalle() ? getAccent(estadoDetalle()!.estado) : '#0d9488'"></div>
        
        <div class="wf-inspector-content">
          <button type="button" (click)="reset.emit()" class="wf-inspector-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          @if (estadoDetalle(); as det) {
            <!-- NODE SELECTED -->
            <div class="wf-inspector-hero">
              <div class="wf-hero-icon-container">
                <div class="wf-hero-icon-bg" [style.background-color]="getAccent(det.estado)"></div>
                <div class="wf-hero-icon" [style.color]="getAccent(det.estado)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path [attr.d]="getIconPath(det.estado)" />
                  </svg>
                </div>
              </div>
              <div class="wf-hero-text">
                <span class="wf-hero-badge">Estado de Flujo</span>
                <h2 class="wf-hero-title">{{ det.etiqueta }}</h2>
              </div>
            </div>

            <div class="wf-inspector-body">
              <div class="wf-info-block">
                <span class="wf-info-label">Descripción</span>
                <p class="wf-info-desc">{{ det.descripcion }}</p>
              </div>

              <div class="wf-info-block">
                <span class="wf-info-label">Métricas del Nodo</span>
                <div class="wf-metrics-grid">
                  <div class="wf-metric-tile">
                    <span class="wf-metric-value" [style.color]="getAccent(det.estado)">{{ det.total }}</span>
                    <span class="wf-metric-desc">En este estado</span>
                  </div>
                  <div class="wf-metric-tile">
                    <span class="wf-metric-value">{{ totalGeneral() }}</span>
                    <span class="wf-metric-desc">Total del sistema</span>
                  </div>
                  <div class="wf-metric-tile">
                    <span class="wf-metric-value" [style.color]="getAccent(det.estado)">{{ getPercentage(det.total) }}%</span>
                    <span class="wf-metric-desc">Volumen</span>
                  </div>
                </div>
              </div>

              <div class="wf-info-block">
                <span class="wf-info-label">Posición en el Pipeline</span>
                <div class="wf-pipeline">
                  @for (step of flowSteps; track step.estado) {
                    <div class="wf-pipe-step" [class.wf-pipe-step--active]="step.estado === det.estado">
                      <div class="wf-pipe-dot" [style.background-color]="step.estado === det.estado ? step.color : ''"></div>
                      <span class="wf-pipe-name" [style.color]="step.estado === det.estado ? step.color : ''">{{ step.label }}</span>
                    </div>
                    @if (!$last) {
                      <div class="wf-pipe-line" [class.wf-pipe-line--active]="step.estado === det.estado"></div>
                    }
                  }
                </div>
              </div>
            </div>

            <div class="wf-inspector-footer">
              <button type="button" (click)="enterFlow.emit()" class="wf-btn-action" [style.background]="getAccent(det.estado)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12h18m-6-6l6 6-6 6" />
                </svg>
                Explorar Solicitudes
              </button>
              <button type="button" (click)="openCase.emit()" [disabled]="!hasCaseTarget()" class="wf-btn-outline">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Atender Pendiente
              </button>
            </div>
          } @else if (transicionDetalle(); as trans) {
            <!-- EDGE SELECTED -->
            <div class="wf-inspector-hero">
              <div class="wf-hero-icon-container">
                <div class="wf-hero-icon-bg" style="background-color: var(--theme-secondary-color);"></div>
                <div class="wf-hero-icon" style="color: var(--theme-secondary-color);">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 5l7 7-7 7M5 12h14" />
                  </svg>
                </div>
              </div>
              <div class="wf-hero-text">
                <span class="wf-hero-badge">Regla de Transición</span>
                <h2 class="wf-hero-title">{{ trans.titulo }}</h2>
              </div>
            </div>

            <div class="wf-inspector-body">
              <div class="wf-info-block">
                <span class="wf-info-label">Descripción de la ruta</span>
                <p class="wf-info-desc">{{ trans.descripcion }}</p>
              </div>

              <div class="wf-info-block">
                <span class="wf-info-label">Ruta de salto</span>
                <div class="wf-route-map">
                  <div class="wf-route-node" [style.border-color]="getAccent(trans.desde)">
                    {{ trans.etiquetaDesde }}
                  </div>
                  <div class="wf-route-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--theme-secondary-color)" stroke-width="2.5">
                      <path d="M5 12h14m-6-6l6 6-6 6" />
                    </svg>
                  </div>
                  <div class="wf-route-node wf-route-node--target" [style.border-color]="getAccent(trans.hacia)">
                    {{ trans.etiquetaHacia }}
                    <small>Recibe {{ trans.totalDestino }}</small>
                  </div>
                </div>
              </div>
            </div>

            <div class="wf-inspector-footer">
              <button type="button" (click)="enterFlow.emit()" class="wf-btn-action" style="background: var(--theme-secondary-color)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12h18m-6-6l6 6-6 6" />
                </svg>
                Inspeccionar Destino
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .wf-inspector-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(8px);
      z-index: 100;
      animation: wf-fade-in 300ms ease;
    }

    .wf-inspector-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 101;
      width: 480px;
      max-width: 92vw;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(28px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 1);
      border-radius: 1.5rem;
      box-shadow: 0 40px 80px -20px rgba(15, 23, 42, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.9);
      overflow: hidden;
      animation: wf-modal-enter 400ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .wf-inspector__glow {
      position: absolute;
      top: -150px;
      left: -50px;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.15;
      pointer-events: none;
      z-index: 0;
    }

    .wf-inspector-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
    }

    .wf-inspector-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(226, 232, 240, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--theme-slate-500);
      cursor: pointer;
      transition: all 200ms ease;
    }

    .wf-inspector-close:hover {
      background: #f1f5f9;
      color: #0f172a;
      transform: scale(1.05);
    }

    .wf-inspector-close svg {
      width: 0.9rem;
      height: 0.9rem;
    }

    /* ---- HERO ---- */
    .wf-inspector-hero {
      padding: 2rem 2rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
      border-bottom: 1px solid rgba(226, 232, 240, 0.6);
    }

    .wf-hero-icon-container {
      position: relative;
      width: 3.5rem;
      height: 3.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .wf-hero-icon-bg {
      position: absolute;
      inset: 0;
      border-radius: 1rem;
      opacity: 0.15;
    }

    .wf-hero-icon {
      position: relative;
      z-index: 1;
    }

    .wf-hero-icon svg {
      width: 1.6rem;
      height: 1.6rem;
    }

    .wf-hero-text {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .wf-hero-badge {
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--theme-slate-500);
    }

    .wf-hero-title {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.03em;
    }

    /* ---- BODY ---- */
    .wf-inspector-body {
      padding: 1.5rem 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .wf-info-block {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .wf-info-label {
      font-size: 0.7rem;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .wf-info-desc {
      margin: 0;
      font-size: 0.9rem;
      color: #334155;
      line-height: 1.5;
    }

    /* ---- METRICS GRID ---- */
    .wf-metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      margin-top: 0.25rem;
    }

    .wf-metric-tile {
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(226, 232, 240, 0.8);
      border-radius: 1rem;
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      text-align: center;
    }

    .wf-metric-value {
      font-size: 1.3rem;
      font-weight: 900;
      color: #0f172a;
      line-height: 1;
    }

    .wf-metric-desc {
      font-size: 0.6rem;
      font-weight: 700;
      color: var(--theme-slate-500);
    }

    /* ---- PIPELINE ---- */
    .wf-pipeline {
      display: flex;
      align-items: center;
      margin-top: 0.5rem;
      background: rgba(241, 245, 249, 0.5);
      border-radius: 99px;
      padding: 0.5rem 1rem;
      border: 1px solid rgba(226, 232, 240, 0.6);
    }

    .wf-pipe-step {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      opacity: 0.5;
      transition: all 300ms ease;
    }

    .wf-pipe-step--active {
      opacity: 1;
      transform: scale(1.05);
    }

    .wf-pipe-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background-color: #94a3b8;
    }

    .wf-pipe-name {
      font-size: 0.65rem;
      font-weight: 800;
      color: var(--theme-slate-500);
    }

    .wf-pipe-line {
      flex: 1;
      height: 2px;
      background-color: #cbd5e1;
      margin: 0 0.5rem;
      transition: all 300ms ease;
    }

    .wf-pipe-line--active {
      background-color: currentColor;
    }

    /* ---- ROUTE MAP ---- */
    .wf-route-map {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .wf-route-node {
      flex: 1;
      padding: 0.75rem 1rem;
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 0.85rem;
      font-size: 0.75rem;
      font-weight: 800;
      color: #1e293b;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .wf-route-node--target {
      background: rgba(241, 245, 249, 0.5);
    }
    
    .wf-route-node small {
      font-size: 0.6rem;
      font-weight: 600;
      color: var(--theme-slate-500);
    }

    /* ---- FOOTER ACTIONS ---- */
    .wf-inspector-footer {
      padding: 1.5rem 2rem;
      background: rgba(248, 250, 252, 0.5);
      border-top: 1px solid rgba(226, 232, 240, 0.6);
      display: flex;
      gap: 1rem;
    }

    .wf-btn-action, .wf-btn-outline {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.85rem 1rem;
      border-radius: 0.85rem;
      font-size: 0.8rem;
      font-weight: 800;
      cursor: pointer;
      transition: all 250ms ease;
      border: none;
    }

    .wf-btn-action {
      color: #fff;
      box-shadow: 0 10px 20px -10px rgba(0,0,0,0.2);
    }

    .wf-btn-action:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 25px -10px rgba(0,0,0,0.3);
    }

    .wf-btn-outline {
      background: #fff;
      color: #0f172a;
      border: 1px solid #cbd5e1;
    }

    .wf-btn-outline:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .wf-btn-outline:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .wf-btn-action svg, .wf-btn-outline svg {
      width: 1.1rem;
      height: 1.1rem;
    }

    @keyframes wf-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes wf-modal-enter {
      from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
  `]
})
export class FlowInspectorComponent {
  estadoDetalle = input<DetalleEstado | null>(null);
  transicionDetalle = input<DetalleTransicion | null>(null);
  estadoObjetivo = input<EstadoWorkflow | null>(null);
  hasCaseTarget = input<boolean>(false);
  contadores = input<Record<EstadoWorkflow, number>>({
    PENDIENTE: 0, EN_REVISION: 0, APROBADO: 0, RECHAZADO: 0
  });

  reset = output<void>();
  enterFlow = output<void>();
  openCase = output<void>();

  isActive = computed(() =>
    this.estadoDetalle() !== null || this.transicionDetalle() !== null
  );

  totalGeneral = computed(() => {
    const c = this.contadores();
    return c.PENDIENTE + c.EN_REVISION + c.APROBADO + c.RECHAZADO;
  });

  readonly flowSteps = [
    { estado: 'PENDIENTE' as EstadoWorkflow, label: 'PENDIENTE', color: ESTADO_VISUAL_CONFIG.PENDIENTE.color },
    { estado: 'EN_REVISION' as EstadoWorkflow, label: 'REVISION', color: ESTADO_VISUAL_CONFIG.EN_REVISION.color },
    { estado: 'APROBADO' as EstadoWorkflow, label: 'APROBADO', color: ESTADO_VISUAL_CONFIG.APROBADO.color },
    { estado: 'RECHAZADO' as EstadoWorkflow, label: 'RECHAZADO', color: ESTADO_VISUAL_CONFIG.RECHAZADO.color },
  ];

  getAccent(estado: EstadoWorkflow): string {
    return ESTADO_VISUAL_CONFIG[estado]?.color ?? '#2563eb';
  }

  getIconPath(estado: EstadoWorkflow): string {
    return ESTADO_VISUAL_CONFIG[estado]?.iconPath ?? '';
  }

  getPercentage(count: number): string {
    const total = this.totalGeneral();
    if (total === 0) return '0';
    return ((count / total) * 100).toFixed(0);
  }
}

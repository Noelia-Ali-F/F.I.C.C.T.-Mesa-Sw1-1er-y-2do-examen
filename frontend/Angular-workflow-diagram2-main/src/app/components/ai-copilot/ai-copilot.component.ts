import {
  Component,
  computed,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  input,
  output,
  signal,
  ViewChild,
  AfterViewChecked
} from '@angular/core';
import { AsistenteIAService } from '../../api/api/asistenteIA.service';
import { AuthService } from '../../auth/auth.service';
import { PresenciaResumen } from '../../workflow/workflow-support.service';
import { SolicitudResponse } from '../../api/model/solicitudResponse';
import { AiCopilotService } from './ai-copilot.service';
import {
  AiInsight,
  CopilotChatMessage,
  CopilotEvent,
  InsightCategory,
  QuickAction,
  SystemPulse,
  LaneStats
} from './ai-copilot.types';

import { MatIconModule } from '@angular/material/icon';

/**
 * AI Copilot Panel Component
 */
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ai-copilot',
  standalone: true,
  imports: [MatIconModule, CommonModule],
  templateUrl: './ai-copilot.component.html',
  styleUrl: './ai-copilot.component.css'
})
export class AiCopilotComponent implements AfterViewChecked {
  // ── Injected Services ──
  private readonly copilotService = inject(AiCopilotService);
  private readonly iaService = inject(AsistenteIAService);
  private readonly authService = inject(AuthService);

  // ── Inputs (data from parent) ──
  readonly callesData = input<Record<string, SolicitudResponse[]>>({});
  readonly presencia = input<PresenciaResumen | null>(null);

  // ── Outputs ──
  readonly copilotEvent = output<CopilotEvent>();

  // ── Template refs ──
  @ViewChild('chatScroll') private chatScrollEl?: ElementRef;

  // ── View state ──
  readonly activeView = signal<'pulse' | 'insights' | 'actions' | 'chat'>('pulse');
  readonly isExpanded = signal(false);
  readonly isThinking = signal(false);

  // ── Computed analytics ──
  private previousScore: number | undefined;

  readonly systemPulse = signal<SystemPulse>({
    overallScore: 100, slaCompliance: 100, throughputRate: 0,
    bottleneckRisk: 0, activeLoad: 0, urgentCount: 0,
    overdueCount: 0, atRiskCount: 0, onlineCollaborators: 0,
    departmentCount: 0, trend: 'stable'
  });

  readonly laneStats = signal<LaneStats[]>([]);
  readonly insights = signal<AiInsight[]>([]);

  readonly visibleInsights = computed(() =>
    this.insights().filter(i => !i.dismissed)
  );

  readonly activeInsightsCount = computed(() =>
    this.visibleInsights().length
  );

  readonly hasCriticalInsights = computed(() =>
    this.visibleInsights().some(i => i.severity === 'critical')
  );

  // ── Quick Actions ──
  readonly quickActions = signal<QuickAction[]>([]);

  // ── Chat ──
  readonly chatMessages = signal<CopilotChatMessage[]>([
    {
      id: 'welcome',
      text: 'Copilot operativo. Analizo el workflow en tiempo real.\nPregúntame algo o usa las acciones rápidas.',
      isAi: true,
      time: new Date(),
      kind: 'success'
    }
  ]);

  private shouldScrollChat = false;

  // SVG ring calculations
  private readonly RING_CIRCUMFERENCE = 2 * Math.PI * 52;

  readonly ringDashArray = computed(() => `${this.RING_CIRCUMFERENCE}`);
  readonly ringDashOffset = computed(() => {
    const score = this.systemPulse().overallScore;
    return `${this.RING_CIRCUMFERENCE - (score / 100) * this.RING_CIRCUMFERENCE}`;
  });

  constructor() {
    // React to data changes using effect
    effect(() => {
      const data = this.callesData();
      const pres = this.presencia();
      this.recompute(data, pres);
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScrollChat && this.chatScrollEl) {
      const el = this.chatScrollEl.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScrollChat = false;
    }
  }

  // ── Recompute analytics when data changes ──
  private recompute(
    data: Record<string, SolicitudResponse[]>,
    presencia: PresenciaResumen | null
  ) {
    const pulse = this.copilotService.computeSystemPulse(data, presencia, this.previousScore);
    this.previousScore = pulse.overallScore;
    this.systemPulse.set(pulse);

    const lanes = this.copilotService.computeLaneStats(data, presencia);
    this.laneStats.set(lanes);

    const newInsights = this.copilotService.generateInsights(pulse, lanes);
    this.insights.set(newInsights);

    const role = this.authService.currentUser()?.rol;
    this.quickActions.set(this.copilotService.getQuickActions(role));
  }

  // ── View navigation ──
  cycleView() {
    const views: Array<'pulse' | 'insights' | 'actions' | 'chat'> = ['pulse', 'insights', 'actions', 'chat'];
    const idx = views.indexOf(this.activeView());
    this.activeView.set(views[(idx + 1) % views.length]);
  }

  // ── Insight actions ──
  executeInsightAction(insight: AiInsight) {
    if (insight.actionCommand) {
      this.sendChat(insight.actionCommand);
      this.activeView.set('chat');
    }
  }

  // ── Quick actions ──
  executeQuickAction(action: QuickAction) {
    this.sendChat(action.command);
    this.activeView.set('chat');
  }

  // ── Chat ──
  sendChat(text: string) {
    const msg = text?.trim();
    if (!msg || this.isThinking()) return;

    const user = this.authService.currentUser();
    if (!user?.username) return;

    // Add user message
    this.chatMessages.update(m => [...m, {
      id: `user_${Date.now()}`,
      text: msg,
      isAi: false,
      time: new Date(),
      kind: 'normal'
    }]);
    this.shouldScrollChat = true;
    this.isThinking.set(true);

    // Call backend AI
    this.iaService.enviarMensajeUsuario({
      mensaje: msg,
      usuarioId: user.username
    }).subscribe({
      next: (res) => {
        this.isThinking.set(false);
        const reply = res.datos?.respuesta || res.mensaje || 'Procesado sin respuesta.';
        const intent = res.datos?.intencionDetectada;
        const kind = this.resolveKind(intent);

        this.chatMessages.update(m => [...m, {
          id: `ai_${Date.now()}`,
          text: reply,
          isAi: true,
          time: new Date(),
          intent,
          kind
        }]);
        this.shouldScrollChat = true;

        // Emit refresh event so parent re-syncs data
        this.copilotEvent.emit({ type: 'refresh' });
      },
      error: (err) => {
        this.isThinking.set(false);
        this.chatMessages.update(m => [...m, {
          id: `err_${Date.now()}`,
          text: this.extractError(err),
          isAi: true,
          time: new Date(),
          kind: 'error'
        }]);
        this.shouldScrollChat = true;
      }
    });
  }

  // ── Lane focus (emit to parent) ──
  onFocusLane(departamento: string) {
    this.copilotEvent.emit({ type: 'focus_lane', payload: departamento });
  }

  // ── Formatting helpers ──
  formatCategory(category: InsightCategory): string {
    const labels: Record<InsightCategory, string> = {
      bottleneck: 'CUELLO DE BOTELLA',
      sla_risk: 'RIESGO SLA',
      workload: 'CARGA DE TRABAJO',
      optimization: 'OPTIMIZACIÓN',
      anomaly: 'ANOMALÍA',
      suggestion: 'SUGERENCIA'
    };
    return labels[category] || category.toUpperCase();
  }

  // ── Private helpers ──
  private resolveKind(intent?: string): 'normal' | 'error' | 'success' | 'thinking' {
    if (!intent) return 'normal';
    if (intent.includes('ERROR') || intent.includes('INVALIDO') || intent.includes('NO_PERMITIDA')) return 'error';
    if (intent.includes('EXITO') || intent.includes('EJECUTADA')) return 'success';
    return 'normal';
  }

  private extractError(err: unknown): string {
    if (!err || typeof err !== 'object') return 'Error de comunicación con el satélite IA.';
    const e = err as any;
    return e?.error?.mensaje || e?.message || 'Error conectando con AI Core.';
  }
}

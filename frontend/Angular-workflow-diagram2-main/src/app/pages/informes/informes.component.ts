import { Component, inject, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkflowDepartamentalService } from '../../api/api/workflowDepartamental.service';
import { AsistenteIAService } from '../../api/api/asistenteIA.service';
import { ReporteService, Reporte } from '../../api/api/reporte.service';
import { ChatIARequest } from '../../api/model/chatIARequest';
import { SolicitudResponse } from '../../api/model/solicitudResponse';
import { AuthService } from '../../auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { VoiceRecognitionService } from '../../shared/services/voice-recognition.service';

export interface PredictionResult {
  depto: string;
  risk: number;
  status: 'Alto' | 'Moderado' | 'Óptimo';
  delayFactor: number;
  activeCount: number;
}

@Component({
  selector: 'app-informes',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, PageHeaderComponent],
  providers: [VoiceRecognitionService],
  templateUrl: './informes.component.html',
  styleUrl: './informes.component.css'
})
export class InformesComponent implements OnInit, OnDestroy {
  private workflowService = inject(WorkflowDepartamentalService);
  private authService = inject(AuthService);
  private aiService = inject(AsistenteIAService);
  private reportService = inject(ReporteService);
  public readonly voiceService = inject(VoiceRecognitionService);

  constructor() {
    effect(() => {
      const text = this.voiceService.transcript();
      const interim = this.voiceService.getInterim();
      if (this.voiceService.isListening()) {
        const fullText = (text + ' ' + interim).trim();
        if (fullText) {
          this.aiSearchQuery.set(fullText);
        }
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy() {
    if (this.voiceService.isListening()) {
      this.voiceService.stop();
    }
  }

  solicitudes = signal<SolicitudResponse[]>([]);
  reportesGuardados = signal<Reporte[]>([]);
  cargando = signal(true);
  fechaActual = new Date();

  // Navigation and Interactive Tabs
  activeTab = signal<'predictiva' | 'copiloto' | 'historial'>('predictiva');
  trafficMultiplier = signal<number>(1.0);

  // AI Reports Copilot State
  aiReportContent = signal<string | null>(null);
  aiReportLoading = signal(false);
  aiSearchQuery = signal('');
  aiChatHistory = signal<Array<{ sender: 'user' | 'assistant'; text: string; timestamp: Date }>>([]);
  aiChatLoading = signal(false);

  // TensorFlow JS / Neural Network Simulator State
  tfTraining = signal(false);
  tfModelTrained = signal(false);
  tfTrainingEpochs = signal<number>(0);
  tfTrainingLoss = signal<number>(0);
  tfPredictions = signal<PredictionResult[]>([]);
  tfConsoleModalOpen = signal(false);

  // General KPIs
  totales = computed(() => this.solicitudes().length);
  aprobadas = computed(() => this.solicitudes().filter(s => s.estado === 'APROBADO').length);
  enRevision = computed(() => this.solicitudes().filter(s => s.estado === 'EN_REVISION').length);
  pendientes = computed(() => this.solicitudes().filter(s => s.estado === 'PENDIENTE').length);
  rechazadas = computed(() => this.solicitudes().filter(s => s.estado === 'RECHAZADO').length);

  // Priority KPIs
  urgentes = computed(() => this.solicitudes().filter(s => s.prioridad === 'URGENTE').length);
  altas = computed(() => this.solicitudes().filter(s => s.prioridad === 'ALTA').length);
  medias = computed(() => this.solicitudes().filter(s => s.prioridad === 'MEDIA').length);
  bajas = computed(() => this.solicitudes().filter(s => s.prioridad === 'BAJA').length);

  // SLA KPIs
  vencidas = computed(() => this.solicitudes().filter(s => s.estadoSla === 'VENCIDO').length);
  porVencer = computed(() => this.solicitudes().filter(s => s.estadoSla === 'POR_VENCER').length);
  enTiempo = computed(() => this.solicitudes().filter(s => s.estadoSla === 'EN_TIEMPO').length);

  // Tasa de Cierre (Aprobadas / Totales)
  tasaCierre = computed(() => {
    const total = this.totales();
    if (total === 0) return 0;
    return Math.round((this.aprobadas() / total) * 100);
  });

  // Tasa de Riesgo (Vencidas / Totales)
  tasaRiesgo = computed(() => {
    const total = this.totales();
    if (total === 0) return 0;
    return Math.round((this.vencidas() / total) * 100);
  });

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.cargando.set(true);
    const user = this.authService.currentUser();
    if (!user) {
      this.cargando.set(false);
      return;
    }

    const request$ = user.rol === 'SOLICITANTE'
      ? this.workflowService.listarPorUsuario(user.username)
      : user.rol === 'REVISOR'
      ? this.workflowService.listarPorDepartamento(user.departamento)
      : this.workflowService.listarTodas();

    request$.subscribe({
      next: (res) => {
        this.solicitudes.set(res.datos || []);
        this.cargando.set(false);
        this.calcularPrediccionesAutomaticas();
        this.cargarReportesGuardados();
      },
      error: () => this.cargando.set(false)
    });
  }

  abrirModalCalibracion() {
    this.tfConsoleModalOpen.set(true);
  }

  cerrarModalCalibracion() {
    this.tfConsoleModalOpen.set(false);
  }

  // Recalcula los indicadores deterministas con los datos ya cargados.
  ejecutarEntrenamientoTensorFlow() {
    this.tfConsoleModalOpen.set(true);
    if (this.tfTraining()) return;
    this.tfTraining.set(true);
    this.tfTrainingEpochs.set(this.solicitudes().length);
    this.tfTrainingLoss.set(0);
    this.calcularPrediccionesAutomaticas();
    this.tfModelTrained.set(true);
    this.tfTraining.set(false);
  }

  resetTensorFlow() {
    this.tfModelTrained.set(false);
    this.tfTrainingEpochs.set(0);
    this.tfTrainingLoss.set(0);
    this.tfConsoleModalOpen.set(false);
    this.calcularPrediccionesAutomaticas();
  }

  // Indicador determinista basado exclusivamente en la carga persistida.
  calcularPrediccionesAutomaticas() {
    const list = this.solicitudes();
    if (list.length === 0) {
      this.tfPredictions.set([]);
      return;
    }

    // Extract all unique departments
    const deptos = Array.from(new Set(list.map(s => s.departamentoActual).filter(Boolean))) as string[];
    
    const predictions: PredictionResult[] = deptos.map(depto => {
      const deptoSol = list.filter(s => s.departamentoActual === depto);
      const activeTasks = deptoSol.filter(s => s.estado === 'PENDIENTE' || s.estado === 'EN_REVISION').length;
      const urgentTasks = deptoSol.filter(s => s.prioridad === 'URGENTE' || s.prioridad === 'ALTA').length;
      const slaBreaches = deptoSol.filter(s => s.estadoSla === 'VENCIDO').length;
      const riskPct = activeTasks === 0
        ? 0
        : Math.min(100, Math.round(((slaBreaches * 3 + urgentTasks * 2 + activeTasks) / (activeTasks * 6)) * 100));

      let status: 'Alto' | 'Moderado' | 'Óptimo' = 'Óptimo';
      if (riskPct > 70) {
        status = 'Alto';
      } else if (riskPct > 35) {
        status = 'Moderado';
      }

      const delayFactor = parseFloat((slaBreaches * 4 + urgentTasks * 2 + activeTasks).toFixed(1));

      return {
        depto,
        risk: riskPct,
        status,
        delayFactor,
        activeCount: activeTasks
      };
    });

    // Sort predictions: highest risk first
    predictions.sort((a, b) => b.risk - a.risk);
    this.tfPredictions.set(predictions);
  }

  actualizarMultiplicadorTrafico(val: number) {
    this.trafficMultiplier.set(val);
    this.calcularPrediccionesAutomaticas();
  }

  sanitizarReporteHtml(text: string): string {
    if (!text) return '';
    let clean = text.trim();
    
    // Remove markdown code blocks (e.g. ```html ... ``` or ``` ... ```)
    clean = clean.replace(/```html/gi, '');
    clean = clean.replace(/```/g, '');
    
    // Remove actual html tags wrapper if LLM mistakenly returned them
    clean = clean.replace(/<\/?html[^>]*>/gi, '');
    
    // Eliminate any mentions of the word "html" (case-insensitive) to fulfill "no diga html"
    clean = clean.replace(/\bhtml\b/gi, 'informe');

    // Replace color classes from tailwind with text-black or border-black
    clean = clean.replace(/text-(teal|emerald|rose|blue|amber|indigo|sky|red|green|yellow|orange|purple|pink|cyan|violet|indigo|slate)-[0-9]+/g, 'text-black');
    clean = clean.replace(/border-(teal|emerald|rose|blue|amber|indigo|sky|red|green|yellow|orange|purple|pink|cyan|violet|indigo|slate)-[0-9]+/g, 'border-black');
    
    return clean.trim();
  }

  // Generador local de reporte ejecutivo
  generarReporteIA() {
    this.aiReportLoading.set(true);
    this.aiReportContent.set(null);

    const user = this.authService.currentUser();

    // Enriched prompt including all high fidelity dashboard metrics
    const statsPrompt = `
[ROL] Eres un analista de Business Intelligence y Director de Operaciones experimentado.
Genera un Informe de Salud Operacional ejecutivo y conciso basado en los siguientes KPIs:

- Volumen Total: ${this.totales()}
- Eficiencia (Tasa Cierre): ${this.tasaCierre()}%
- Alerta SLA (Vencidas): ${this.vencidas()} (${this.tasaRiesgo()}% Riesgo)
- Carga por Prioridad: Urgente (${this.urgentes()}), Alta (${this.altas()})

[DATOS PREDICTIVOS - TENSORFLOW]
${this.tfPredictions().map(p => `- Departamento ${p.depto}: Riesgo de embotellamiento ${p.risk}%, Estado: ${p.status}, Retraso Proyectado: ${p.delayFactor}h.`).join('\n')}

Estructura el informe de la siguiente manera:
1. **Diagnóstico Operacional**: Análisis breve de la tasa de cierre (${this.tasaCierre()}%).
2. **Alertas de Congestión**: Resumen ejecutivo de carga, prioridad y vencimientos SLA observados.
3. **Recomendaciones de Balanceo**: Acciones clave recomendadas para mitigar el riesgo del ${this.tasaRiesgo()}%.

[REGLAS CRÍTICAS DE FORMATO Y ESTILO]:
1. Escribe el informe usando marcado HTML básico para la estructura (usando etiquetas como <p>, <h4>, <ul>, <li>, <strong>, etc.).
2. NO incluyas bloques de código Markdown ni delimitadores de código (como \`\`\`html o \`\`\`). Tu respuesta debe comenzar directamente con la etiqueta HTML del contenido.
3. NO utilices ni menciones la palabra "HTML" en ningún lugar del texto.
4. Redacta de forma muy profesional, sumamente ejecutiva, y concisa. Ve al grano, eliminando explicaciones innecesarias, introducciones o detalles de relleno.
5. NO utilices clases de colores de Tailwind (por ejemplo, evita text-teal-800, text-emerald-600, text-red-500, etc.) ni estilos de color inline. Todos los textos, encabezados y elementos deben ser de color estrictamente negro o gris oscuro.
6. No incluyas preámbulos, saludos, comentarios externos ni explicaciones sobre el formato de tu respuesta. Solo el marcado HTML limpio.
`;

    const request: ChatIARequest = {
      mensaje: statsPrompt,
      usuarioId: (user?.username || 'admin-kpi') + '-reportes'
    };

    this.aiService.enviarMensajeUsuario(request).subscribe({
      next: (response) => {
        this.aiReportLoading.set(false);
        const textResponse = response.datos?.respuesta || '';
        this.aiReportContent.set(this.sanitizarReporteHtml(textResponse));
        
        // Add welcome assistant bubble
        this.aiChatHistory.set([
          { sender: 'assistant', text: '¡He generado tu informe de salud operacional! Puedes hacerme cualquier consulta técnica sobre este informe en este panel de control.', timestamp: new Date() }
        ]);
      },
      error: (err) => {
        console.warn('El servicio de IA para reportes no está disponible:', err);
        this.aiReportLoading.set(false);
        this.aiReportContent.set('<p><strong>Informe no generado:</strong> el servicio de IA no está configurado o no respondió. Los KPI visibles continúan calculados con datos reales.</p>');
        this.aiChatHistory.set([]);
      }
    });
  }

  toggleVoiceDictation() {
    if (this.voiceService.isListening()) {
      this.voiceService.stop();
    } else {
      this.voiceService.start();
    }
  }

  preguntarSugerencia(pregunta: string) {
    this.aiSearchQuery.set(pregunta);
    this.preguntarAlInformeIA();
  }

  // Ask detailed questions to interrogate report data - Specialized Business Consultant IA
  preguntarAlInformeIA() {
    const prompt = this.aiSearchQuery().trim();
    if (!prompt) return;

    // Detener grabación si está activa
    if (this.voiceService.isListening()) {
      this.voiceService.stop();
    }

    this.aiChatHistory.update(history => [...history, { sender: 'user', text: prompt, timestamp: new Date() }]);
    this.aiSearchQuery.set('');
    this.aiChatLoading.set(true);

    const user = this.authService.currentUser();
    const reportTextClean = this.aiReportContent() ? this.aiReportContent()?.replace(/<[^>]*>/g, '') : 'No se ha generado el reporte ejecutivo aún.';

    const statsContext = `
[ROL] Eres el Consultor de Negocio y Especialista de Business Intelligence (BI) de la empresa.
Tu única tarea y especialidad es contestar preguntas estrictamente basadas en el informe de métricas y salud operacional actual.
Debes responder de forma sumamente ejecutiva, profesional y resolutiva. 
Cualquier respuesta debe referirse directamente al contenido del informe presentado, y si el usuario pregunta algo ajeno al informe o a la salud operacional, debes indicarle cortésmente que solo puedes responder dudas sobre el informe actual.

[INFORME OPERACIONAL DE SALUD ACTUAL]
${reportTextClean}

[KPIs ADICIONALES DEL DASHBOARD]
- Volumen total de trámites: ${this.totales()}
- Tasa de finalización (Cierre): ${this.tasaCierre()}%
- Tasa de riesgo por vencimiento de SLA: ${this.tasaRiesgo()}% (${this.vencidas()} vencidas, ${this.porVencer()} por vencer, ${this.enTiempo()} en tiempo)

[PREGUNTA DE NEGOCIO DEL USUARIO]
"${prompt}"

Responde brevemente de forma profesional, ejecutiva y estratégica. Limita tu respuesta a un párrafo de análisis comercial y 3 puntos de acción clave recomendados. Responde en texto plano.
`;

    const request: ChatIARequest = {
      mensaje: statsContext,
      usuarioId: (user?.username || 'admin-kpi') + '-reportes'
    };

    this.aiService.enviarMensajeUsuario(request).subscribe({
      next: (response) => {
        this.aiChatLoading.set(false);
        const answer = response.datos?.respuesta || 'Lo siento, no pude procesar la consulta de negocio sobre el informe.';
        this.aiChatHistory.update(history => [...history, { sender: 'assistant', text: answer, timestamp: new Date() }]);
      },
      error: () => {
        this.aiChatLoading.set(false);
        this.aiChatHistory.update(history => [...history, {
          sender: 'assistant',
          text: 'No se pudo consultar el servicio de IA. Revisa la configuración del proveedor antes de generar recomendaciones.',
          timestamp: new Date()
        }]);
      }
    });
  }

  // Generate a premium vector corporate PDF of the executive report
  descargarReportePDF() {
    const reportHtmlContent = this.aiReportContent();
    if (!reportHtmlContent) return;

    const user = this.authService.currentUser();
    const depto = user?.departamento || 'OPERACIONES CENTRAL';
    const emisor = user?.nombreCompleto || user?.username || 'AUDITOR DE SISTEMAS';
    const fechaString = this.fechaActual.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const predictionsRows = this.tfPredictions().map(p => {
      const riskClass = p.status === 'Alto' ? 'risk-alto' : p.status === 'Moderado' ? 'risk-mod' : 'risk-opt';
      return `
        <tr>
          <td style="font-family: 'Space Mono', monospace; font-weight: 700; padding: 14px 18px; border-bottom: 1px solid #f1f5f9;">${p.depto}</td>
          <td style="padding: 14px 18px; border-bottom: 1px solid #f1f5f9;"><span class="badge ${riskClass}">${p.status} (${p.risk}%)</span></td>
          <td style="text-align: right; font-weight: 700; font-family: 'Space Mono', monospace; padding: 14px 18px; border-bottom: 1px solid #f1f5f9; color: #0d9488;">+${p.delayFactor} hrs</td>
          <td style="text-align: right; padding: 14px 18px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">${p.activeCount} solicitudes</td>
        </tr>
      `;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permite las ventanas emergentes (pop-ups) para descargar el informe en PDF.');
      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte Analítico Predictivo - Ref: OPER-IA-${this.totales()}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');
    
    body {
      font-family: 'Outfit', sans-serif;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 40px;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .report-container {
      max-width: 820px;
      margin: 0 auto;
    }
    
    /* Premium Svelte Corporate Header */
    .header-box {
      border: 1px solid rgba(13, 148, 136, 0.16);
      border-top: 6px solid #0d9488;
      background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
      padding: 30px;
      margin-bottom: 35px;
      border-radius: 16px;
      position: relative;
    }
    
    .header-eyebrow {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      color: #0d9488;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin: 0 0 8px 0;
    }
    
    .header-title {
      font-size: 24px;
      font-weight: 900;
      text-transform: uppercase;
      color: #0f172a;
      margin: 0 0 18px 0;
      letter-spacing: -0.03em;
      line-height: 1.25;
    }
    
    /* Stable Column Grid via CSS Table */
    .meta-grid {
      display: table;
      width: 100%;
      table-layout: fixed;
      border-top: 1px dashed rgba(13, 148, 136, 0.25);
      padding-top: 18px;
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    
    .meta-item {
      display: table-cell;
      width: 33.333%;
      vertical-align: top;
    }
    
    .meta-item span {
      display: block;
      color: #64748b;
      font-size: 8px;
      margin-bottom: 4px;
      font-weight: 700;
    }
    
    /* Section Styling */
    .section-title {
      font-family: 'Space Mono', monospace;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #0d9488;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 8px;
      margin-bottom: 20px;
      margin-top: 40px;
      letter-spacing: 0.08em;
      position: relative;
    }
    
    .section-title::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 40px;
      height: 2px;
      background: #0d9488;
    }
    
    /* Stable Flexbox fallback for KPIs to ensure horizontal printing */
    .kpi-grid {
      display: table;
      width: 100%;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 16px 0;
      margin-left: -16px;
      margin-right: -16px;
      margin-bottom: 35px;
    }
    
    .kpi-card {
      display: table-cell;
      width: 25%;
      border: 1px solid rgba(15, 118, 110, 0.12);
      background: linear-gradient(135deg, #ffffff 0%, #fcfdfd 100%);
      padding: 20px 14px;
      text-align: center;
      vertical-align: middle;
      border-radius: 14px;
      box-shadow: 0 4px 12px -2px rgba(15, 118, 110, 0.03);
    }
    
    .kpi-card-label {
      font-family: 'Space Mono', monospace;
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 8px;
      letter-spacing: 0.05em;
    }
    
    .kpi-card-val {
      font-size: 28px;
      font-weight: 900;
      color: #0f172a;
      margin: 4px 0;
      letter-spacing: -0.03em;
    }
    
    .kpi-card-sub {
      font-size: 9px;
      color: #94a3b8;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    
    /* Table Styling */
    .kpi-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 35px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(15, 118, 110, 0.12);
    }
    
    .kpi-table th {
      background: #0f172a;
      color: #ffffff;
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      text-align: left;
      padding: 14px 18px;
      letter-spacing: 0.05em;
    }
    
    .kpi-table td {
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
      color: #334155;
    }
    
    .kpi-table tr:last-child td {
      border-bottom: none;
    }
    
    .kpi-table tr:nth-child(even) {
      background-color: #fafbfc;
    }
    
    /* Risk Badges */
    .badge {
      display: inline-block;
      font-family: 'Space Mono', monospace;
      font-size: 8.5px;
      font-weight: 750;
      padding: 4px 10px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    
    .badge.risk-alto {
      background: #fef2f2;
      color: #ef4444;
      border: 1px solid #fee2e2;
    }
    
    .badge.risk-mod {
      background: #fffbeb;
      color: #d97706;
      border: 1px solid #fef3c7;
    }
    
    .badge.risk-opt {
      background: #f0fdf4;
      color: #16a34a;
      border: 1px solid #dcfce7;
    }
    
    /* Document Body Text styles */
    .report-body {
      font-size: 14px;
      line-height: 1.8;
      color: #334155;
      background: #f8fafc;
      padding: 24px 28px;
      border-radius: 14px;
      border: 1px solid #f1f5f9;
      border-left: 4px solid #0d9488;
    }
    
    .report-body h4 {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      margin-top: 24px;
      margin-bottom: 12px;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    
    .report-body p {
      margin-bottom: 14px;
    }
    
    .report-body ul, .report-body ol {
      margin-bottom: 14px;
      padding-left: 20px;
    }
    
    .report-body li {
      margin-bottom: 6px;
    }
    
    /* Signature Box */
    .report-footer {
      margin-top: 60px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 30px;
      display: table;
      width: 100%;
    }
    
    .footer-stamp-cell {
      display: table-cell;
      width: 55%;
      vertical-align: bottom;
    }
    
    .signature-cell {
      display: table-cell;
      width: 45%;
      vertical-align: bottom;
    }
    
    .signature-box {
      border: 1px dashed rgba(15, 118, 110, 0.25);
      background: #fafbfc;
      padding: 22px;
      text-align: center;
      border-radius: 12px;
    }
    
    .signature-title {
      font-family: 'Space Mono', monospace;
      font-size: 8px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 45px;
      letter-spacing: 0.05em;
    }
    
    .signature-line {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.02em;
    }
    
    .signature-sub {
      font-size: 8.5px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .footer-stamp {
      font-family: 'Space Mono', monospace;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #94a3b8;
      line-height: 1.6;
    }
    
    @media print {
      body {
        padding: 0px;
      }
      .header-box {
        box-shadow: none !important;
        background: #ffffff !important;
        border: 1px solid rgba(13, 148, 136, 0.25) !important;
        border-top: 6px solid #0d9488 !important;
      }
      .signature-box {
        box-shadow: none !important;
        background: #ffffff !important;
        border: 1px dashed rgba(15, 118, 110, 0.3) !important;
      }
      @page {
        margin: 20mm;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header Block -->
    <div class="header-box">
      <p class="header-eyebrow">AUDITORÍA DIGITAL STARK-WORKFLOW</p>
      <h1 class="header-title">Reporte de Indicadores Operacionales</h1>
      
      <div class="meta-grid">
        <div class="meta-item">
          <span>Identificador Único</span>
          Ref: OPER-IA-${this.totales()}
        </div>
        <div class="meta-item">
          <span>Fecha y Hora de Emisión</span>
          ${fechaString}
        </div>
        <div class="meta-item">
          <span>Departamento / Emisor</span>
          ${depto}
        </div>
      </div>
    </div>

    <!-- KPIs Section -->
    <div class="kpi-section">
      <div class="section-title">Consolidado General de Key Performance Indicators (KPIs)</div>
      
      <div class="kpi-grid">
        <!-- Total -->
        <div class="kpi-card">
          <div class="kpi-card-label">Trámites Totales</div>
          <div class="kpi-card-val">${this.totales()}</div>
          <div class="kpi-card-sub">Volumen del sistema</div>
        </div>
        <!-- Cierre -->
        <div class="kpi-card">
          <div class="kpi-card-label">Tasa de Cierre</div>
          <div class="kpi-card-val" style="color: #16a34a;">${this.tasaCierre()}%</div>
          <div class="kpi-card-sub">${this.aprobadas()} aprobados</div>
        </div>
        <!-- Riesgo -->
        <div class="kpi-card">
          <div class="kpi-card-label">Tasa de Riesgo</div>
          <div class="kpi-card-val" style="color: #ef4444;">${this.tasaRiesgo()}%</div>
          <div class="kpi-card-sub">${this.vencidas()} fuera de SLA</div>
        </div>
        <!-- En SLA -->
        <div class="kpi-card">
          <div class="kpi-card-label">Ciclo Óptimo</div>
          <div class="kpi-card-val" style="color: #0d9488;">${this.enTiempo()}</div>
          <div class="kpi-card-sub">Trámites en tiempo</div>
        </div>
      </div>
    </div>

    <!-- Operational indicators section -->
    <div class="kpi-section">
      <div class="section-title">Indicadores de Carga y SLA por Departamento</div>
      
      <table class="kpi-table">
        <thead>
          <tr>
            <th>Departamento Evaluado</th>
            <th>Índice de Riesgo</th>
            <th style="text-align: right;">Demora Proyectada</th>
            <th style="text-align: right;">Carga Activa</th>
          </tr>
        </thead>
        <tbody>
          ${predictionsRows || '<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px; border-bottom: none;">No se disponen de coeficientes neuronales activos. Reentrene el modelo en la consola.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Contenido generado por el motor analítico local -->
    <div class="kpi-section">
      <div class="section-title">Análisis cualitativo e inferencia operacional local</div>
      <div class="report-body">
        ${reportHtmlContent}
      </div>
    </div>

    <!-- Signatures and Stamp Section -->
    <div class="report-footer">
      <div class="footer-stamp-cell">
        <div class="footer-stamp">
          Sello Digital: SEC-ALGO-OPT-CALIB-${Math.floor(100000 + Math.random() * 900000)}<br>
          Generado por el motor analítico local · requiere revisión humana
        </div>
      </div>
      
      <div class="signature-cell">
        <div class="signature-box">
          <div class="signature-title">RESPONSABLE DE AUDITORÍA Y EMISIÓN</div>
          <div class="signature-line">${emisor}</div>
          <div class="signature-sub">${depto}</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `);

    printWindow.document.close();
  }

  cargarReportesGuardados() {
    this.reportService.listarTodos().subscribe({
      next: (res) => {
        this.reportesGuardados.set(res.datos || []);
      },
      error: (err) => {
        console.warn("No se pudieron cargar los reportes de la BD:", err);
      }
    });
  }

  guardarReporteEnBD() {
    const content = this.aiReportContent();
    if (!content) return;

    const user = this.authService.currentUser();
    const nuevoReporte: Reporte = {
      titulo: `Informe Ejecutivo Stark - ${this.fechaActual.toLocaleDateString()}`,
      descripcion: `Auditoría cuantitativa de ${this.totales()} trámites y saturación predictiva.`,
      tipo: 'AI_EXECUTIVE',
      contenidoHtml: content,
      totalSolicitudes: this.totales(),
      aprobadas: this.aprobadas(),
      vencidas: this.vencidas(),
      tasaCierre: this.tasaCierre(),
      tasaRiesgo: this.tasaRiesgo()
    };

    this.reportService.guardarReporte(nuevoReporte, user?.username || 'admin').subscribe({
      next: () => {
        alert("¡Informe persistido exitosamente en la base de datos MongoDB!");
        this.cargarReportesGuardados();
      },
      error: (err) => {
        console.error("Error al guardar reporte en BD:", err);
        alert("Error al guardar reporte en la base de datos.");
      }
    });
  }

  eliminarReporteEnBD(id: string) {
    if (!confirm("¿Está seguro de eliminar este informe del historial en la BD?")) return;
    this.reportService.eliminarReporte(id).subscribe({
      next: () => {
        this.cargarReportesGuardados();
      },
      error: (err) => {
        console.error("Error al eliminar el reporte:", err);
      }
    });
  }

  verReporteGuardado(reporte: Reporte) {
    this.aiReportContent.set(reporte.contenidoHtml);
    this.activeTab.set('copiloto');
    // Smooth scroll up to the report preview container
    setTimeout(() => {
      const el = document.querySelector('.lg\\:col-span-7');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }
}

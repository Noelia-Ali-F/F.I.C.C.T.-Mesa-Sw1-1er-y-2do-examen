import { Component, computed, inject, signal, ViewChild, ElementRef, AfterViewChecked, OnDestroy, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AsistenteIAService } from '../../api/api/asistenteIA.service';
import { ApiResponseChatIAResponse } from '../../api/model/apiResponseChatIAResponse';
import { AuthService } from '../../auth/auth.service';
import { VoiceRecognitionService } from '../../shared/services/voice-recognition.service';

interface ChatMessage {
  text: string;
  isAi: boolean;
  time: Date;
  intent?: string;
  kind?: 'normal' | 'error' | 'success' | 'warning';
  actionData?: any;
  safeHtml?: SafeHtml;
}

@Component({
  selector: 'app-ai-assistant-page',
  standalone: true,
  imports: [FormsModule, DatePipe, NgClass, MatIconModule],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.css',
  providers: [VoiceRecognitionService]
})
export class AiAssistantComponent implements AfterViewChecked, OnDestroy {
  private readonly aiService = inject(AsistenteIAService);
  private readonly authService = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  public readonly voiceService = inject(VoiceRecognitionService);
  
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  readonly user = computed(() => this.authService.currentUser());

  messages = signal<ChatMessage[]>([]);
  currentMessage = signal('');
  isLoading = signal(false);
  pendingActionIntent = signal<string | null>(null);
  pendingActionSummary = signal<string | null>(null);

  constructor() {
    this.seedInitialMessage();
    
    // Bind real-time voice recognition transcript to message input
    effect(() => {
      const text = this.voiceService.transcript();
      const interim = this.voiceService.getInterim();
      if (this.voiceService.isListening()) {
        const fullText = (text + ' ' + interim).trim();
        if (fullText) {
          this.currentMessage.set(fullText);
        }
      }
    }, { allowSignalWrites: true });
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.voiceService.stop();
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  sendMessage(overrideMessage?: string) {
    const msg = (overrideMessage ?? this.currentMessage()).trim();
    if (!msg) return;

    const user = this.authService.currentUser();
    if (!user?.username) {
      this.pushAiMessage('SYS_ERROR: REQUIRES_ACTIVE_SESSION.', 'CONTEXTO_INVALIDO', 'error');
      return;
    }

    // Stop listening voice recognition if active on sending
    if (this.voiceService.isListening()) {
      this.voiceService.stop();
    }

    this.messages.update(m => [...m, { 
      text: msg, 
      isAi: false, 
      time: new Date(), 
      kind: 'normal',
      safeHtml: this.formatMessageText(msg, false)
    }]);
    this.currentMessage.set('');
    this.isLoading.set(true);

    this.aiService.enviarMensajeUsuario({
      mensaje: msg,
      usuarioId: user.username
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.processBackendResponse(res);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.pushAiMessage(this.extractErrorMessage(err), 'ERROR_COMUNICACION', 'error');
      }
    });
  }

  toggleVoice(): void {
    if (this.voiceService.isListening()) {
      this.voiceService.stop();
    } else {
      this.voiceService.start();
    }
  }

  confirmarAccionPendiente() {
    if (this.isLoading()) return;
    this.sendMessage('confirmar');
  }

  cancelarAccionPendiente() {
    if (this.isLoading()) return;
    this.sendMessage('cancelar');
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  private processBackendResponse(res: ApiResponseChatIAResponse) {
    const intent = res.datos?.intencionDetectada;
    const text = res.datos?.respuesta?.trim();

    if (!res.exito) {
      this.pushAiMessage(res.mensaje || 'SYS_FAILURE: OPERATION_INTERRUPTED.', intent || 'ERROR_BACKEND', 'error');
      this.handlePendingActionByIntent(intent, text);
      return;
    }

    if (text) {
      const kind = this.resolveMessageKind(intent);
      this.pushAiMessage(text, intent, kind);
      this.handlePendingActionByIntent(intent, text);
      return;
    }

    if (res.mensaje) {
      const kind = this.resolveMessageKind(intent);
      this.pushAiMessage(res.mensaje, intent, kind);
      this.handlePendingActionByIntent(intent, res.mensaje);
      return;
    }

    this.pushAiMessage('SYS_WARNING: EMPY_STREAM_RECEIVED.', intent || 'RESPUESTA_VACIA', 'warning');
    this.handlePendingActionByIntent(intent, '');
  }

  private pushAiMessage(text: string, intent?: string, kind: 'normal' | 'error' | 'success' | 'warning' = 'normal') {
    this.messages.update(m => [
      ...m,
      {
        text,
        isAi: true,
        time: new Date(),
        intent,
        kind,
        safeHtml: this.formatMessageText(text, true, kind)
      }
    ]);
  }

  private formatMessageText(text: string, isAi: boolean, kind?: string): SafeHtml {
    // 1. Escapar HTML base para evitar script injection
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (isAi && kind !== 'error') {
      // 2. Formatear asteriscos como negrita
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // 3. Formatear códigos de Workflow (ej. WF-2026-083) como BADGES
      html = html.replace(/(WF-\d{4}-\d{3,})/g, '<strong class="inline-flex bg-teal-50 border border-teal-200 text-teal-700 font-bold px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider">$1</strong>');
      
      // 4. Formatear Separadores con Pipes (| PALABRA |) como Micro-Badges
      html = html.replace(/&lt;([A-Z_]+)&gt;/g, '<span class="px-1 text-slate-400 font-bold">$1</span>'); 
      html = html.replace(/\|\s*([A-Za-z0-9_ÁÉÍÓÚáéíóúÑñ\s]+)\s*(?=\||$)/g, '<span class="inline-flex items-center px-2 py-0.5 bg-slate-100 border border-slate-200 text-[10px] font-extrabold text-slate-600 rounded-full mx-1 uppercase tracking-wider">$1</span>');

      // 5. Formatear listas (líneas que empiezan con "-" o "*") como TARJETAS premium svelte
      html = html.replace(/^[\-\*]\s+(.*)$/gm, 
        '<div class="flex items-start gap-2.5 my-2.5 p-3 bg-white border border-slate-250/60 rounded-xl shadow-sm"><span class="text-teal-600 font-black shrink-0 relative top-[1px]">›</span><div class="flex-1 text-[11px] leading-relaxed text-slate-700 font-medium">$1</div></div>'
      );
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private handlePendingActionByIntent(intent?: string, text?: string) {
    if (!intent) return;

    if (intent.startsWith('ACCION_PENDIENTE_')) {
      this.pendingActionIntent.set(intent);
      this.pendingActionSummary.set(this.extractPendingActionSummary(text || 'AWAITING_USER_CONFIRMATION_'));
      return;
    }

    if (
      intent.startsWith('ACCION_')
      || intent === 'SIN_ACCION_PENDIENTE'
      || intent === 'CONTEXTO_CAMBIADO'
      || intent === 'EXITO'
    ) {
      this.pendingActionIntent.set(null);
      this.pendingActionSummary.set(null);
    }
  }

  private extractPendingActionSummary(text: string): string {
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return 'AWAITING_USER_CONFIRMATION_';
    if (lines.length > 1 && (lines[0].toLowerCase().includes('preparad') || lines[0].toLowerCase().includes('reemplazo'))) {
      return lines[1];
    }
    return lines[0];
  }

  private resolveMessageKind(intent?: string): 'normal' | 'error' | 'success' | 'warning' {
    if (!intent) return 'normal';
    if (intent.includes('ERROR') || intent.includes('INVALIDO') || intent.includes('NO_PERMITIDA') || intent.includes('NO_ENCONTRADA') || intent.includes('SIN_PERMISO') || intent.includes('CONTEXTO_')) {
      return 'error';
    }
    if (intent.includes('ACCION_EJECUTADA') || intent.includes('EXITO')) {
      return 'success';
    }
    if (intent.includes('PENDIENTE')) {
      return 'warning';
    }
    return 'normal';
  }

  private seedInitialMessage() {
    const current = this.authService.currentUser();
    if (!current) {
      this.pushAiMessage('SYS_ERROR: NO_AUTHENTICATION. REQUIRES LOGIN.', 'BIENVENIDA', 'error');
      return;
    }

    const base = `WORKFLOW_AI_CORE initialized for [${current.rol}] @ ${current.departamento}.\nMemory systems online. Analytics engine connected.`;
    this.pushAiMessage(base, 'BIENVENIDA', 'success');
  }

  private extractErrorMessage(err: unknown): string {
    const fallback = 'SYS_FAILURE: CONNECTION_TIMEOUT.';
    if (!err || typeof err !== 'object') return fallback;
    const candidate = err as { error?: { mensaje?: string; errores?: Record<string, string[]> }; message?: string; };
    if (candidate.error?.mensaje) return candidate.error.mensaje;
    if (candidate.error?.errores) {
      const firstKey = Object.keys(candidate.error.errores)[0];
      if (firstKey && candidate.error.errores[firstKey]?.length) return candidate.error.errores[firstKey][0];
    }
    if (candidate.message) return candidate.message;
    return fallback;
  }
}

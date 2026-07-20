import { Component, computed, inject, signal, OnDestroy, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../auth/auth.service';
import { AsistenteIAService } from '../../api/api/asistenteIA.service';
import { VoiceRecognitionService } from '../../shared/services/voice-recognition.service';

export interface SimpleChatMessage {
  id: string;
  text: string;
  isAi: boolean;
  time: Date;
  kind?: 'normal' | 'error' | 'success';
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './chat-widget.component.html',
  providers: [VoiceRecognitionService]
})
export class ChatWidgetComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly iaService = inject(AsistenteIAService);
  public readonly voiceService = inject(VoiceRecognitionService);
  
  readonly user = computed(() => this.authService.currentUser());

  isOpen = signal(false);
  isThinking = signal(false);
  currentInput = signal('');

  readonly chatMessages = signal<SimpleChatMessage[]>([
    {
      id: 'init_welcome',
      text: '¡Hola! Soy tu Asistente Técnico IA. Puedes hacerme consultas técnicas sobre los procesos, auditar métricas de SLA o dictarme acciones por voz haciendo clic en el micrófono de los formularios de solicitud. ¿En qué te ayudo hoy?',
      isAi: true,
      time: new Date(),
      kind: 'normal'
    }
  ]);

  constructor() {
    effect(() => {
      const text = this.voiceService.transcript();
      const interim = this.voiceService.getInterim();
      if (this.voiceService.isListening()) {
        const fullText = (text + ' ' + interim).trim();
        if (fullText) {
          this.currentInput.set(fullText);
        }
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy() {
    if (this.voiceService.isListening()) {
      this.voiceService.stop();
    }
  }

  toggleChat() {
    this.isOpen.update(v => {
      const next = !v;
      if (!next && this.voiceService.isListening()) {
        this.voiceService.stop();
      }
      return next;
    });
  }

  toggleVoiceChat() {
    if (this.voiceService.isListening()) {
      this.voiceService.stop();
    } else {
      this.voiceService.start();
    }
  }

  expandirChat() {
    this.isOpen.set(false);
    this.router.navigate(['/asistente']);
  }

  enviarMensaje() {
    const msg = this.currentInput().trim();
    if (!msg || this.isThinking()) return;

    const user = this.authService.currentUser();
    if (!user?.username) return;

    // Add User Message
    this.chatMessages.update(m => [...m, {
      id: `user_${Date.now()}`,
      text: msg,
      isAi: false,
      time: new Date(),
      kind: 'normal'
    }]);

    this.currentInput.set('');
    this.isThinking.set(true);

    // Call Backend IA Service
    this.iaService.enviarMensajeUsuario({
      mensaje: msg,
      usuarioId: user.username
    }).subscribe({
      next: (res: any) => {
        this.isThinking.set(false);
        const reply = res.datos?.respuesta || res.mensaje || 'Procesado sin respuesta.';
        const intent = res.datos?.intencionDetectada;
        
        let kind: 'normal' | 'error' | 'success' = 'normal';
        if (intent) {
          if (intent.includes('ERROR') || intent.includes('INVALIDO')) kind = 'error';
          else if (intent.includes('EXITO') || intent.includes('EJECUTADA')) kind = 'success';
        }

        this.chatMessages.update(m => [...m, {
          id: `ai_${Date.now()}`,
          text: reply,
          isAi: true,
          time: new Date(),
          kind
        }]);
      },
      error: (err: any) => {
        this.isThinking.set(false);
        const errorText = err?.error?.mensaje || err?.message || 'Error conectando con AI Core.';
        this.chatMessages.update(m => [...m, {
          id: `err_${Date.now()}`,
          text: errorText,
          isAi: true,
          time: new Date(),
          kind: 'error'
        }]);
      }
    });
  }
}

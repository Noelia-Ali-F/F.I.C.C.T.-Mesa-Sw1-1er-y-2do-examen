import { Injectable, NgZone, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VoiceRecognitionService {
  recognition: any;
  isListening = signal<boolean>(false);
  transcript = signal<string>('');
  isSupported = signal<boolean>(false);
  lastError = signal<string>('');
  private interimTranscript = '';
  private startTimestamp = 0;
  private noSpeechRetries = 0;
  private manualStopRequested = false;
  private readonly maxNoSpeechRetries = 2;
  private stoppingForProcessing = false;

  constructor(private zone: NgZone) {
    this.init();
  }

  init() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const isSecureContextAllowed = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (SpeechRecognition && isSecureContextAllowed) {
      this.isSupported.set(true);
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'es-419';

      this.recognition.onstart = () => {
        this.zone.run(() => {
          this.startTimestamp = Date.now();
          this.noSpeechRetries = 0;
          this.manualStopRequested = false;
          this.stoppingForProcessing = false;
          this.lastError.set('');
          this.isListening.set(true);
        });
      };

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        // Reconstruimos la transcripción de forma limpia y sin estados persistentes desde 0 en cada evento.
        // Esto previene que índices desfasados dupliquen frases.
        for (let i = 0; i < event.results.length; ++i) {
          const resultText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += ' ' + resultText.trim();
          } else {
            interim += resultText;
          }
        }

        let cleanFinal = final.trim();
        cleanFinal = this.deduplicatePhrases(cleanFinal);

        this.zone.run(() => {
          this.transcript.set(cleanFinal);
          this.interimTranscript = interim;
          if (cleanFinal || interim.trim()) {
            this.noSpeechRetries = 0;
            this.lastError.set('');
          }
        });
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);

        if (event.error === 'no-speech' && this.canRetryNoSpeech()) {
          this.zone.run(() => {
            this.lastError.set('No te escuché aún. Sigue hablando...');
          });
          this.retryAfterSilence();
          return;
        }

        this.zone.run(() => {
          this.lastError.set(this.mapError(event.error));
          this.isListening.set(false);
        });
      };

      this.recognition.onend = () => {
        this.zone.run(() => {
          if (this.stoppingForProcessing && !this.transcript().trim() && this.interimTranscript.trim()) {
            this.transcript.set(this.deduplicatePhrases(this.interimTranscript.trim()));
          }
          if (!this.manualStopRequested && !this.transcript().trim() && this.noSpeechRetries > 0) {
            return;
          }
          this.stoppingForProcessing = false;
          this.isListening.set(false);
        });
      };
    } else {
      this.isSupported.set(false);
      this.lastError.set(
        !SpeechRecognition
          ? 'Este navegador no soporta reconocimiento de voz.'
          : 'La voz del navegador requiere HTTPS o localhost. En esta URL HTTP no puede iniciar el micrófono.'
      );
      console.warn('Speech Recognition API no soportada en este navegador o contexto.');
    }
  }

  /**
   * Elimina duplicaciones consecutivas de palabras y frases comunes que algunos navegadores móviles
   * o virtuales (como WebKit/Chrome en Android/iOS) duplican por eco en las ráfagas de SpeechRecognition.
   */
  private deduplicatePhrases(text: string): string {
    if (!text) return '';
    const words = text.split(/\s+/);
    const result: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      // Evitar duplicaciones de una sola palabra consecutiva larga (>3 caracteres)
      if (result.length > 0 && words[i].toLowerCase() === result[result.length - 1].toLowerCase()) {
        if (words[i].length > 3) {
          continue;
        }
      }
      
      // Evitar duplicaciones de frases de 2 palabras
      if (result.length >= 2 && i + 1 < words.length) {
        const prev2 = result[result.length - 2] + ' ' + result[result.length - 1];
        const next2 = words[i] + ' ' + words[i + 1];
        if (prev2.toLowerCase() === next2.toLowerCase()) {
          i++; // Saltar palabra extra
          continue;
        }
      }

      // Evitar duplicaciones de frases de 3 palabras
      if (result.length >= 3 && i + 2 < words.length) {
        const prev3 = result[result.length - 3] + ' ' + result[result.length - 2] + ' ' + result[result.length - 1];
        const next3 = words[i] + ' ' + words[i + 1] + ' ' + words[i + 2];
        if (prev3.toLowerCase() === next3.toLowerCase()) {
          i += 2; // Saltar palabras extra
          continue;
        }
      }
      
      result.push(words[i]);
    }
    
    return result.join(' ');
  }

  start() {
    if (!this.recognition) {
      this.lastError.set(
        this.lastError() || 'El reconocimiento de voz no está disponible en este navegador o conexión.'
      );
      return false;
    }
    this.clear(); // Limpiar transcripciones anteriores
    this.manualStopRequested = false;
    this.stoppingForProcessing = false;
    this.noSpeechRetries = 0;
    this.isListening.set(true);
    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('No se pudo iniciar el reconocimiento de voz', error);
      this.isListening.set(false);
      this.lastError.set('No se pudo iniciar el micrófono. Revisa permisos del navegador.');
      return false;
    }
  }

  stop(processTranscript = false) {
    if (!this.recognition) return;
    this.manualStopRequested = true;
    this.stoppingForProcessing = processTranscript;
    if (processTranscript && !this.transcript().trim() && this.interimTranscript.trim()) {
      this.transcript.set(this.deduplicatePhrases(this.interimTranscript.trim()));
    }
    this.recognition.stop();
  }

  clear() {
    this.transcript.set('');
    this.interimTranscript = '';
  }

  getInterim() {
    return this.interimTranscript;
  }

  getTranscriptCandidate(): string {
    return (this.transcript().trim() || this.interimTranscript.trim()).trim();
  }

  private canRetryNoSpeech(): boolean {
    const elapsed = Date.now() - this.startTimestamp;
    return elapsed < 8000 && this.noSpeechRetries < this.maxNoSpeechRetries && !this.manualStopRequested;
  }

  private retryAfterSilence() {
    this.noSpeechRetries += 1;
    this.isListening.set(false);

    try {
      this.recognition.stop();
    } catch {
      // no-op
    }

    window.setTimeout(() => {
      if (this.manualStopRequested) {
        return;
      }

      try {
        this.recognition.start();
      } catch (error) {
        console.error('No se pudo reintentar el reconocimiento de voz', error);
        this.zone.run(() => {
          this.lastError.set('No se pudo reiniciar el micrófono. Revisa permisos del navegador.');
          this.isListening.set(false);
        });
      }
    }, 350);
  }

  private mapError(errorCode: string): string {
    switch (errorCode) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'El navegador bloqueó el micrófono. Debes permitir acceso al audio.';
      case 'network':
        return 'El motor de voz falló por red o por contexto inseguro.';
      case 'no-speech':
        return 'No se detectó voz en el micrófono. Habla más cerca o revisa el dispositivo de entrada.';
      case 'audio-capture':
        return 'No se encontró un micrófono disponible.';
      default:
        return `Error de reconocimiento de voz: ${errorCode}`;
    }
  }
}

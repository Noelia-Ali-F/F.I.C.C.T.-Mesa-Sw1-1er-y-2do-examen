import { Component, inject, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AdminUsersService } from '../../admin/admin-users.service';
import { DomSanitizer } from '@angular/platform-browser';
import { DocumentoService, Documento, VersionDocumento } from '../../workflow/documento.service';
import { AuthService } from '../../auth/auth.service';
import { PresenceEngine } from '../../runtime/presence-engine.service';
import { BASE_PATH } from '../../api/variables';
import { Client } from '@stomp/stompjs';
import { WorkflowDepartamentalService } from '../../api/api/workflowDepartamental.service';
import { AsistenteIAService } from '../../api/api/asistenteIA.service';
import { ChatIARequest } from '../../api/model/chatIARequest';
import { VoiceRecognitionService } from '../../shared/services/voice-recognition.service';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { Editor } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import jspreadsheet from 'jspreadsheet-ce';

export interface DocComment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  timestamp: Date;
}

@Component({
  selector: 'app-document-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, RouterLink, TiptapEditorDirective],
  templateUrl: './document-editor.component.html',
  styleUrl: './document-editor.component.css',
  providers: [VoiceRecognitionService]
})
export class DocumentEditorComponent implements OnInit, OnDestroy {
  @ViewChild('chatContainer') chatContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('workspaceCanvas') workspaceCanvas!: ElementRef<HTMLDivElement>;
  @ViewChild('spreadsheetHost') spreadsheetHost?: ElementRef<HTMLDivElement>;
  private docService = inject(DocumentoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public authService = inject(AuthService);
  public presence = inject(PresenceEngine);
  private basePath = inject(BASE_PATH);
  private workflowApi = inject(WorkflowDepartamentalService);
  public voiceService = inject(VoiceRecognitionService);
  private aiService = inject(AsistenteIAService);
  public sanitizer = inject(DomSanitizer);
  private location = inject(Location);
  private adminUsersService = inject(AdminUsersService);

  // State signals for collaboration enhancements
  usuariosDisponibles = signal<any[]>([]);
  solicitudPendiente = signal<boolean>(false);
  solicitanteLock = signal<string | null>(null);
  invitacionEnviadaMap = signal<Record<string, boolean>>({});

  renderedMermaidDiagrams = signal<Record<number, string>>({});
  aiInputText = signal<string>('');

  isDictatingToEditor = signal<boolean>(false);
  private lastInsertedTranscript = '';
  private lastManualNavTime = 0;

  constructor() {
    effect(() => {
      const text = this.voiceService.transcript();
      const interim = this.voiceService.getInterim();
      
      if (this.voiceService.isListening()) {
        if (this.isDictatingToEditor()) {
          // Dictado directo al editor
          if (text.length > this.lastInsertedTranscript.length) {
            const newText = text.substring(this.lastInsertedTranscript.length).trim();
            if (newText) {
              this.editor.chain().focus().insertContent(' ' + newText).run();
              this.lastInsertedTranscript = text;
              this.recalcularPaginacion();
            }
          }
        } else {
          // Dictado al cuadro del chat de IA
          const fullText = (text + ' ' + interim).trim();
          if (fullText) {
            this.aiInputText.set(fullText);
          }
        }
      } else {
        // Si el motor de voz se apaga solo, limpiar estados
        if (this.isDictatingToEditor()) {
          this.isDictatingToEditor.set(false);
          this.lastInsertedTranscript = '';
        }
      }
    }, { allowSignalWrites: true });
  }

  documento = signal<Documento | null>(null);
  associatedDocs = signal<Documento[]>([]);
  workflowsEnEtapa = signal<any[]>([]);
  solicitudFisica = signal<any | null>(null);
  
  nombreEtapaBpmn = computed(() => {
    const doc = this.documento();
    if (!doc || !doc.solicitudId) return 'Sin asignar a Workflow';
    
    if (!this.esEtapaBpmn(doc.solicitudId)) {
      return 'Asociado a Expediente Individual';
    }
    
    switch (doc.solicitudId) {
      case 'Activity_Pendiente': return 'Bandeja de Entrada / Pendientes';
      case 'Activity_Revision': return 'Evaluación y Revisión Técnica';
      case 'Activity_Aprobado': return 'Solicitudes Aprobadas';
      case 'Activity_Rechazado': return 'Solicitudes Rechazadas';
      default: return `Etapa Técnica (${doc.solicitudId})`;
    }
  });

  esEtapaBpmn(id: string): boolean {
    if (!id) return false;
    return id.startsWith('Activity_') || 
           id.startsWith('Event_') || 
           id.startsWith('Gateway_') || 
           id === 'bpmn-central' || 
           id.startsWith('bpmn-');
  }

  cargando = signal(true);
  guardando = signal(false);
  publicandoSnapshot = signal(false);
  procesandoAprobacion = signal(false);
  modalSnapshot = signal(false);

  id = '';
  contenido = '';
  private spreadsheetWorksheet: any = null;
  private applyingRemoteSpreadsheet = false;
  esHojaCalculo = computed(() => this.documento()?.formato === 'SPREADSHEET');
  comentarioSnapshot = '';
  adquiridoLock = false;
  showBlankOverlay = signal(false);

  // Toggle drawer and popover states
  showInfo = signal(false);
  showHistory = signal(false);
  showComments = signal(false);
  showWorkflow = signal(false);
  showCollab = signal(false);
  showAiCopilot = signal(false);
  aiMessages = signal<Array<{ sender: 'user' | 'assistant'; text: string; timestamp: Date; loading?: boolean }>>([
    { sender: 'assistant', text: '¡Hola! Soy tu Copiloto de IA del Workflow. Puedo ayudarte a redactar, resumir, corregir, insertar tablas o generar diagramas a partir de tu texto o por comandos de voz.', timestamp: new Date() }
  ]);
  loadingAi = signal(false);

  // Accordions for Properties Drawer
  accordionDetalles = signal(true);
  accordionWorkflow = signal(true);
  accordionColaboradores = signal(true);
  accordionRelacionados = signal(true);

  // Comments state
  comments = signal<DocComment[]>([]);
  newCommentText = '';

  // STOMP WebSocket Client
  private stompClient: Client | null = null;
  colaboradoresActivos = signal<string[]>([]);
  private heartbeatInterval: any = null;

  // TipTap Editor Instance
  editor = new Editor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: true, allowBase64: true }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      this.contenido = editor.getHTML();
      this.onContentChange();
      this.recalcularPaginacion();
    },
    onSelectionUpdate: ({ editor }) => {
      this.recalcularPaginacion();
    }
  });

  // AI Templates
  aiTemplates = [
    { label: 'Acta de Reunión', icon: 'groups', desc: 'Resumen de acuerdos, temas y participantes.', prompt: 'Genera una plantilla de Acta de Reunión con secciones para: Fecha, Participantes, Temas Tratados y Acuerdos.' },
    { label: 'Contrato de Servicios', icon: 'draw', desc: 'Borrador contractual técnico profesional.', prompt: 'Genera un borrador de Contrato de Prestación de Servicios Técnicos profesional.' },
    { label: 'Informe de Avance', icon: 'analytics', desc: 'Estructura de progreso y KPIs del proyecto.', prompt: 'Genera una estructura de Informe de Avance de Proyecto para mi departamento.' },
    { label: 'Solicitud de Presupuesto', icon: 'payments', desc: 'Carta formal de aprobación de fondos.', prompt: 'Genera una carta formal solicitando aprobación de presupuesto extraordinario.' }
  ];

  aplicarPlantilla(template: any) {
    this.askAi(template.prompt);
    this.showAiCopilot.set(true);
    this.showBlankOverlay.set(false);
  }

  saltarBlanco() {
    this.showBlankOverlay.set(false);
    this.contenido = '<h1>Nuevo Documento</h1><p>Escribe aquí...</p>';
    this.editor.commands.setContent(this.contenido);
    setTimeout(() => {
      this.editor.chain().focus('end').run();
    }, 150);
  }

  toggleEditorDictation() {
    if (this.isDictatingToEditor()) {
      this.voiceService.stop();
      this.isDictatingToEditor.set(false);
      this.lastInsertedTranscript = '';
    } else {
      if (this.voiceService.isListening()) {
        this.voiceService.stop();
      }
      this.lastInsertedTranscript = '';
      this.isDictatingToEditor.set(true);
      setTimeout(() => {
        this.voiceService.start();
      }, 200);
    }
  }

  exportarPDF() {
    const element = document.querySelector('.tiptap-container');
    if (!element) return;

    // Usamos el visor de impresión nativo del navegador para máxima fidelidad
    // pero con un truco de CSS temporal para limpiar el UI del editor
    const originalTitle = document.title;
    const docName = this.documento()?.nombre || 'Documento';
    document.title = docName;
    
    window.print();
    
    document.title = originalTitle;
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.id = params['id'];
      if (this.id === 'nuevo') {
        this.cargando.set(false);
        this.documento.set({
          id: 'nuevo',
          nombre: 'Nuevo Documento',
          descripcion: 'Documento en blanco creado manualmente.',
          tipo: 'COLLABORATIVE',
          versionActual: 1,
          solicitudId: 'bpmn-central',
          tareaId: null,
          fechaCreacion: new Date().toISOString(),
          fechaActualizacion: new Date().toISOString(),
          creadoPor: this.authService.currentUser()?.username || 'Yo',
          bloqueadoPor: this.authService.currentUser()?.username || 'Yo',
          versiones: []
        } as unknown as Documento);
        this.contenido = '<h1>Nuevo Documento</h1><p>Escribe aquí o usa el asistente IA...</p>';
        this.editor.commands.setContent(this.contenido, { emitUpdate: false });
        this.adquiridoLock = true;
        this.showBlankOverlay.set(true);
        this.showAiCopilot.set(true);
      } else if (this.id) {
        this.cargarYBloquear();
        this.cargarComentarios();
      } else {
        this.router.navigate(['/documentos']);
      }
    });

    // Notify presence engine about active focus in the workspace
    if (this.id && this.id !== 'nuevo') {
      this.presence.publishMyFocus(`/documentos/editar/${this.id}`, 'document-content-area');
    }

    // Load system users for invitation list
    this.adminUsersService.listarUsuarios().subscribe({
      next: (users) => this.usuariosDisponibles.set(users),
      error: (err) => console.warn('Error loading users for collab invite:', err)
    });
  }

  conectarWebSocket() {
    try {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws';
      let wsUrl = '';
      if (this.basePath.startsWith('http')) {
        wsUrl = this.basePath.replace(/^http/, 'ws') + '/ws-collab';
      } else {
        wsUrl = `${wsProto}://${window.location.host}${this.basePath}/ws-collab`;
      }

      console.log('[STOMP WebSocket] Connecting live document STOMP broker to:', wsUrl);
      this.stompClient = new Client({
        brokerURL: wsUrl,
        connectHeaders: {
          Authorization: `Bearer ${this.authService.currentUser()?.token || ''}`
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: (str: string) => console.log('[STOMP Debug]', str)
      });

      this.stompClient.onConnect = (frame: any) => {
        console.log('[STOMP WebSocket] Connected to STOMP broker!');
        
        // 1. Subscribe to document room channel
        this.stompClient!.subscribe(`/topic/document/${this.id}/collab`, (message: any) => {
          try {
            const msg = JSON.parse(message.body);
            this.handleWebSocketMessage(msg);
          } catch (e) {
            console.error('[STOMP] Error parsing socket payload', e);
          }
        });

        // 2. Subscribe to active users list
        this.stompClient!.subscribe(`/topic/document/${this.id}/active-users`, (message: any) => {
          try {
            const users = JSON.parse(message.body) as string[];
            this.colaboradoresActivos.set(users);
          } catch (e) {
            console.error('[STOMP] Error parsing active users list', e);
          }
        });

        // 3. Subscribe to auto-save status channel
        this.stompClient!.subscribe(`/topic/document/${this.id}/status`, (message: any) => {
          try {
            const statusData = JSON.parse(message.body);
            if (statusData.status === 'SAVED') {
              this.guardando.set(false); // Cambios consolidados en MongoDB!
            }
          } catch (e) {}
        });

        // 4. Send JOIN message to announce ourselves
        this.enviarMensajeWebSocket({
          type: 'JOIN',
          author: this.authService.currentUser()?.username || 'Usuario',
          timestamp: Date.now()
        });

        // 5. Setup periodic heartbeat ping every 10 seconds
        this.heartbeatInterval = setInterval(() => {
          this.enviarMensajeWebSocket({
            type: 'JOIN',
            author: this.authService.currentUser()?.username || 'Usuario',
            timestamp: Date.now()
          });
        }, 10000);
      };

      this.stompClient.onStompError = (frame: any) => {
        console.error('[STOMP Error] Broker reported error:', frame.headers['message']);
        console.error('[STOMP Error] Details:', frame.body);
      };

      this.stompClient.activate();
    } catch (err) {
      console.error('[STOMP] Connection initialization failed', err);
    }
  }

  enviarMensajeWebSocket(payload: any) {
    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.publish({
        destination: `/app/document/${this.id}/collab`,
        body: JSON.stringify(payload)
      });
    }
  }

  handleWebSocketMessage(msg: any) {
    if (msg.type === 'COMMENT') {
      const comment: DocComment = {
        id: msg.id || ('c-' + Date.now()),
        author: msg.author,
        avatar: (msg.author || 'US').substring(0, 2).toUpperCase(),
        text: msg.text,
        timestamp: new Date(msg.timestamp || Date.now())
      };
      this.comments.update(current => {
        if (current.some(c => c.id === comment.id)) {
          return current;
        }
        const updated = [...current, comment];
        const key = `doc-comments-${this.id}`;
        localStorage.setItem(key, JSON.stringify(updated));
        return updated;
      });
      this.scrollToBottom();
    } else if (msg.type === 'EDIT') {
      // Discard if the message was sent by the current user (case-insensitive check) to prevent selection/cursor reset
      const myUsername = this.authService.currentUser()?.username?.toLowerCase();
      const authorUsername = msg.author?.toLowerCase();
      if (myUsername && authorUsername === myUsername) {
        return;
      }
      this.contenido = msg.content || '';
      if (this.esHojaCalculo()) {
        this.initSpreadsheet(true);
        return;
      }
      if (this.editor.getHTML() !== this.contenido) {
        try {
          const selection = this.editor.state.selection;
          this.editor.commands.setContent(this.contenido, { emitUpdate: false });
          this.editor.commands.setTextSelection(selection);
        } catch (e) {
          this.editor.commands.setContent(this.contenido, { emitUpdate: false });
        }
        this.recalcularPaginacion();
      }
    } else if (msg.type === 'CURSOR') {
      this.presence.activePeers.update(peers => {
        const newPeers = new Map(peers);
        newPeers.set(msg.author, {
          username: msg.author,
          activePath: `/documentos/editar/${this.id}`,
          elementIdFocus: 'document-content-area',
          cursor: { x: msg.cursorX || 0, y: msg.cursorY || 0 },
          lastInteraction: Date.now()
        });
        return newPeers;
      });
    } else if (msg.type === 'REQUEST_LOCK') {
      const myUsername = this.authService.currentUser()?.username?.toLowerCase();
      const targetUser = msg.targetUser?.toLowerCase();
      if (myUsername && targetUser === myUsername && this.estaBloqueadoPorMi()) {
        this.solicitanteLock.set(msg.author);
      }
    } else if (msg.type === 'REJECT_LOCK') {
      const myUsername = this.authService.currentUser()?.username?.toLowerCase();
      const targetUser = msg.targetUser?.toLowerCase();
      if (myUsername && targetUser === myUsername) {
        this.solicitudPendiente.set(false);
        alert(`El usuario ${msg.author} ha decidido mantener el control de edición por el momento.`);
      }
    } else if (msg.type === 'LOCK_TRANSFERRED') {
      const myUsername = this.authService.currentUser()?.username?.toLowerCase();
      const targetUser = msg.targetUser?.toLowerCase();
      if (myUsername && targetUser === myUsername) {
        this.solicitudPendiente.set(false);
        this.adquirirLockTransferido();
      } else {
        this.cargarDocumentoSilencioso();
      }
    } else if (msg.type === 'INVITE') {
      const myUsername = this.authService.currentUser()?.username?.toLowerCase();
      const invitedUser = msg.invitedUser?.toLowerCase();
      if (myUsername && invitedUser === myUsername) {
        alert(`El usuario ${msg.author} te invita a colaborar en el documento "${this.documento()?.nombre || 'Borrador'}".`);
      }
    }
  }

  private mapearSolicitudIdAEstado(solicitudId: string): string | null {
    switch (solicitudId) {
      case 'Activity_Pendiente': return 'PENDIENTE';
      case 'Activity_Revision': return 'EN_REVISION';
      case 'Activity_Aprobado': return 'APROBADO';
      case 'Activity_Rechazado': return 'RECHAZADO';
      default: return null;
    }
  }

  cargarYBloquear() {
    this.cargando.set(true);
    this.docService.obtenerPorId(this.id).subscribe({
      next: (doc) => {
        this.documento.set(doc);
        this.contenido = doc.contenidoColaborativo || '';
        if (doc.formato === 'SPREADSHEET') {
          setTimeout(() => this.initSpreadsheet(), 0);
        } else {
          this.editor.commands.setContent(this.contenido, { emitUpdate: false });
          this.recalcularPaginacion();
        }

        if (doc.solicitudId) {
          // Cargar otros documentos en la misma etapa o solicitud
          this.docService.listarPorSolicitud(doc.solicitudId).subscribe({
            next: (otherDocs) => {
              this.associatedDocs.set(otherDocs.filter(d => d.id !== doc.id));
            }
          });

          if (this.esEtapaBpmn(doc.solicitudId)) {
            // Cargar solicitudes físicas reales asociadas al estado de la etapa
            const estadoAsociado = this.mapearSolicitudIdAEstado(doc.solicitudId);
            if (estadoAsociado) {
              const miUser = this.authService.currentUser();
              const req$ = (miUser?.rol === 'SOLICITANTE') 
                ? this.workflowApi.listarPorUsuario(miUser.username)
                : this.workflowApi.listarTodas();

              req$.subscribe({
                next: (res) => {
                  const todas = res.datos ?? [];
                  const enEtapa = todas.filter(t => t.estado === estadoAsociado);
                  this.workflowsEnEtapa.set(enEtapa);
                  this.solicitudFisica.set(null);
                },
                error: (err) => {
                  console.warn('Error al cargar solicitudes de workflow en etapa', err);
                }
              });
            }
          } else {
            // Es una solicitud física específica, la cargamos directamente por su ID
            this.workflowApi.obtenerPorId(doc.solicitudId).subscribe({
              next: (res) => {
                this.solicitudFisica.set(res.datos ?? null);
                this.workflowsEnEtapa.set([]);
              },
              error: (err) => {
                console.warn('Error al cargar solicitud por ID físico', err);
                this.solicitudFisica.set(null);
              }
            });
          }
        }

        const miUsuario = this.authService.currentUser()?.username;
        const docUser = doc.bloqueadoPor?.toLowerCase();
        const miUsuarioLower = miUsuario?.toLowerCase();
        
        if (!docUser || docUser === miUsuarioLower) {
          this.docService.bloquearDocumento(this.id).subscribe({
            next: (lockedDoc) => {
              this.documento.set(lockedDoc);
              this.adquiridoLock = true;
              this.cargando.set(false);
              this.conectarWebSocket();
            },
            error: (err) => {
              console.error('Error locking document', err);
              this.adquiridoLock = false;
              this.cargando.set(false);
              this.conectarWebSocket();
            }
          });
        } else {
          this.adquiridoLock = false;
          this.cargando.set(false);
        }
      },
      error: (err) => {
        console.error('Error fetching document', err);
        this.router.navigate(['/documentos']);
      }
    });
  }

  public cargarComentarios() {
    const key = `doc-comments-${this.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const mapped = parsed.map((c: any) => ({
          ...c,
          timestamp: new Date(c.timestamp)
        }));
        this.comments.set(mapped);
        this.scrollToBottom();
      } catch (e) {
        console.error('Error parsing stored comments', e);
        this.seedMockComments();
      }
    } else {
      this.seedMockComments();
      localStorage.setItem(key, JSON.stringify(this.comments()));
      this.scrollToBottom();
    }
  }

  private seedMockComments() {
    this.comments.set([
      {
        id: 'c1',
        author: 'Maria.Reyes',
        avatar: 'MR',
        text: 'Revisé la cláusula del contrato y requiere una cláusula adicional de no divulgación.',
        timestamp: new Date(Date.now() - 60 * 60 * 1000)
      },
      {
        id: 'c2',
        author: 'Finance.Dept',
        avatar: 'FD',
        text: 'Aprobamos los montos preliminares pero estamos pendientes de validar la estimación de riesgos.',
        timestamp: new Date(Date.now() - 30 * 60 * 1000)
      }
    ]);
  }

  public scrollToBottom() {
    setTimeout(() => {
      if (this.chatContainer && this.chatContainer.nativeElement) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  public submitComment() {
    const text = this.newCommentText.trim();
    if (!text) return;

    const myUser = this.authService.currentUser();
    const commentMsg = {
      type: 'COMMENT',
      id: 'c-' + Date.now(),
      author: myUser?.username || 'Usuario',
      text,
      timestamp: Date.now()
    };

    // Broadcast through STOMP
    this.enviarMensajeWebSocket(commentMsg);

    // Add locally immediately
    const comment: DocComment = {
      id: commentMsg.id,
      author: commentMsg.author,
      avatar: commentMsg.author.substring(0, 2).toUpperCase(),
      text: commentMsg.text,
      timestamp: new Date(commentMsg.timestamp)
    };
    this.comments.update(current => {
      const updated = [...current, comment];
      const key = `doc-comments-${this.id}`;
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
    this.newCommentText = '';
    this.scrollToBottom();
  }

  estaBloqueadoPorMi(): boolean {
    if (this.id === 'nuevo') return true;
    const doc = this.documento();
    if (!doc) return false;
    const docUser = doc.bloqueadoPor?.toLowerCase();
    const miUsuario = this.authService.currentUser()?.username?.toLowerCase();
    return !!docUser && docUser === miUsuario;
  }

  private debounceTimer: any = null;

  onContentChange() {
    if (!this.estaBloqueadoPorMi()) return;
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Indicar en la interfaz que estamos guardando de inmediato
    this.guardando.set(true);

    this.debounceTimer = setTimeout(() => {
      // Broadcast live edits via STOMP
      this.enviarMensajeWebSocket({
        type: 'EDIT',
        author: this.authService.currentUser()?.username || 'Usuario',
        content: this.contenido,
        timestamp: Date.now()
      });
    }, 500); // Reducido a 500ms para un tiempo real súper rápido entre clientes
  }

  private parseSpreadsheetContent(): { data: any[][]; columns: any[] } {
    try {
      const parsed = JSON.parse(this.contenido || '{}');
      if (parsed.kind === 'jspreadsheet-v1' && Array.isArray(parsed.data)) {
        return { data: parsed.data, columns: Array.isArray(parsed.columns) ? parsed.columns : [] };
      }
    } catch {}
    return {
      data: Array.from({ length: 15 }, () => Array(8).fill('')),
      columns: Array.from({ length: 8 }, (_, index) => ({ type: 'text', title: String.fromCharCode(65 + index), width: 120 }))
    };
  }

  private initSpreadsheet(fromRemote = false) {
    const host = this.spreadsheetHost?.nativeElement;
    if (!host || !this.esHojaCalculo()) return;
    if (this.spreadsheetWorksheet) {
      try { jspreadsheet.destroy(host as any, true); } catch {}
      host.innerHTML = '';
    }
    const state = this.parseSpreadsheetContent();
    this.applyingRemoteSpreadsheet = fromRemote;
    const instances: any = jspreadsheet(host, {
      toolbar: true,
      worksheets: [{
        data: state.data,
        columns: state.columns,
        minDimensions: [Math.max(8, state.columns.length), Math.max(15, state.data.length)],
        editable: this.estaBloqueadoPorMi(),
        allowInsertRow: true,
        allowDeleteRow: true,
        allowInsertColumn: true,
        allowDeleteColumn: true,
        onchange: () => this.onSpreadsheetChanged(),
        oninsertrow: () => this.onSpreadsheetChanged(),
        ondeleterow: () => this.onSpreadsheetChanged(),
        oninsertcolumn: () => this.onSpreadsheetChanged(),
        ondeletecolumn: () => this.onSpreadsheetChanged(),
        onchangeheader: () => this.onSpreadsheetChanged()
      }]
    } as any);
    this.spreadsheetWorksheet = Array.isArray(instances) ? instances[0] : instances?.worksheets?.[0];
    setTimeout(() => this.applyingRemoteSpreadsheet = false, 0);
  }

  private onSpreadsheetChanged() {
    if (this.applyingRemoteSpreadsheet || !this.spreadsheetWorksheet || !this.estaBloqueadoPorMi()) return;
    const config = this.spreadsheetWorksheet.getConfig();
    this.contenido = JSON.stringify({
      kind: 'jspreadsheet-v1',
      data: this.spreadsheetWorksheet.getData(false, false),
      columns: (config.columns || []).map((column: any) => ({
        type: column.type || 'text', title: column.title || '', width: column.width || 120
      }))
    });
    this.onContentChange();
  }

  agregarFilaHoja() { this.spreadsheetWorksheet?.insertRow(1); }
  eliminarFilaHoja() { this.spreadsheetWorksheet?.deleteRow(); }
  agregarColumnaHoja() { this.spreadsheetWorksheet?.insertColumn(1); }
  eliminarColumnaHoja() { this.spreadsheetWorksheet?.deleteColumn(); }

  updateDocName(val: string) {
    this.documento.update(doc => doc ? { ...doc, nombre: val } : doc);
  }

  updateDocDesc(val: string) {
    this.documento.update(doc => doc ? { ...doc, descripcion: val } : doc);
  }

  guardarBorrador() {
    if (!this.estaBloqueadoPorMi()) return;

    const doc = this.documento();
    if (!doc) return;

    this.guardando.set(true);

    if (this.id === 'nuevo') {
      this.docService.crearDocumentoColaborativo(doc.solicitudId || 'bpmn-central', doc.nombre, doc.descripcion, this.contenido).subscribe({
        next: (created) => {
          this.id = created.id;
          this.documento.set(created);
          this.guardando.set(false);
          this.router.navigate(['/documentos/editar', created.id], { replaceUrl: true });
        },
        error: () => this.guardando.set(false)
      });
    } else {
      // First update the metadata (name, description) in case it changed
      // Wait, docService.actualizarContenido only updates the content currently.
      // Assuming it updates the content, we send it. If you have an endpoint for metadata, you'd call it here too.
      this.docService.actualizarContenido(this.id, this.contenido).subscribe({
        next: (updated) => {
          // Keep our local name/desc if the backend doesn't update it yet
          const currentName = this.documento()?.nombre;
          const currentDesc = this.documento()?.descripcion;
          this.documento.set({ ...updated, nombre: currentName || updated.nombre, descripcion: currentDesc || updated.descripcion });
          this.guardando.set(false);
        },
        error: () => this.guardando.set(false)
      });
    }
  }

  previewVersion = signal<VersionDocumento | null>(null);

  /** Replaces editor text with a historical snapshot if user has edit rights */
  restaurarVersion(version: VersionDocumento) {
    if (!this.estaBloqueadoPorMi()) return;
    if (!confirm(`¿Restaurar la Versión ${version.version}? Se creará una nueva versión y no se borrará el historial.`)) return;
    const comentario = prompt('Comentario de restauración:', `Restauración de la versión ${version.version}`) || '';
    this.docService.restaurarVersion(this.id, version.version, comentario).subscribe({
      next: updated => {
        this.documento.set(updated);
        this.contenido = updated.contenidoColaborativo || '';
        if (this.esHojaCalculo()) this.initSpreadsheet(true);
        else this.editor.commands.setContent(this.contenido, { emitUpdate: false });
        this.previewVersion.set(null);
      },
      error: err => alert(err?.error?.mensaje || 'No se pudo restaurar la versión')
    });
  }

  puedeDecidirAprobacion() {
    const user = this.authService.currentUser();
    const doc = this.documento();
    return !!user && !!doc && (user.rol === 'ADMINISTRADOR'
      || (user.rol === 'REVISOR' && user.departamento === doc.departamentoPropietario));
  }

  cambiarAprobacion(accion: 'ENVIAR' | 'APROBAR' | 'RECHAZAR') {
    const observacion = prompt('Observación de la decisión:', '') ?? '';
    if ((accion === 'APROBAR' || accion === 'RECHAZAR') && !observacion.trim()) return;
    this.procesandoAprobacion.set(true);
    this.docService.decidirAprobacion(this.id, accion, observacion).subscribe({
      next: updated => { this.documento.set(updated); this.procesandoAprobacion.set(false); },
      error: err => { this.procesandoAprobacion.set(false); alert(err?.error?.mensaje || 'No se pudo actualizar la aprobación'); }
    });
  }

  abrirModalSnapshot() {
    this.comentarioSnapshot = '';
    this.modalSnapshot.set(true);
  }

  cerrarModalSnapshot() {
    this.modalSnapshot.set(false);
  }

  confirmarSnapshot() {
    if (!this.estaBloqueadoPorMi() || !this.comentarioSnapshot.trim()) return;

    this.publicandoSnapshot.set(true);
    this.docService.actualizarContenido(this.id, this.contenido).subscribe({
      next: () => {
        this.docService.guardarSnapshot(this.id, this.comentarioSnapshot).subscribe({
          next: (updated) => {
            this.documento.set(updated);
            this.publicandoSnapshot.set(false);
            this.modalSnapshot.set(false);
            this.desbloquearYSalir();
          },
          error: () => this.publicandoSnapshot.set(false)
        });
      },
      error: () => this.publicandoSnapshot.set(false)
    });
  }

  desbloquearYSalir() {
    if (this.adquiridoLock && this.id && this.id !== 'nuevo') {
      this.docService.desbloquearDocumento(this.id).subscribe({
        next: () => {
          this.adquiridoLock = false;
          if (this.stompClient) {
            this.stompClient.deactivate();
          }
          this.location.back();
        },
        error: () => {
          if (this.stompClient) {
            this.stompClient.deactivate();
          }
          this.location.back();
        }
      });
    } else {
      if (this.stompClient) {
        this.stompClient.deactivate();
      }
      this.location.back();
    }
  }

  salir() {
    this.desbloquearYSalir();
  }

  enviarPeticionLock() {
    const doc = this.documento();
    if (!doc || !doc.bloqueadoPor) return;
    
    this.solicitudPendiente.set(true);
    this.enviarMensajeWebSocket({
      type: 'REQUEST_LOCK',
      author: this.authService.currentUser()?.username || 'Usuario',
      targetUser: doc.bloqueadoPor,
      timestamp: Date.now()
    });
  }

  aceptarTransferenciaLock() {
    const solicitante = this.solicitanteLock();
    if (!solicitante) return;

    this.guardando.set(true);
    this.docService.actualizarContenido(this.id, this.contenido).subscribe({
      next: () => {
        this.docService.desbloquearDocumento(this.id).subscribe({
          next: () => {
            this.adquiridoLock = false;
            this.solicitanteLock.set(null);
            this.guardando.set(false);
            
            this.enviarMensajeWebSocket({
              type: 'LOCK_TRANSFERRED',
              author: this.authService.currentUser()?.username || 'Usuario',
              targetUser: solicitante,
              timestamp: Date.now()
            });
            
            this.cargarYBloquear();
          },
          error: (err) => {
            console.error('Error al desbloquear para transferencia:', err);
            this.guardando.set(false);
            this.solicitanteLock.set(null);
          }
        });
      },
      error: (err) => {
        console.error('Error al guardar antes de transferencia:', err);
        this.guardando.set(false);
        this.solicitanteLock.set(null);
      }
    });
  }

  rechazarTransferenciaLock() {
    const solicitante = this.solicitanteLock();
    if (!solicitante) return;
    
    this.solicitanteLock.set(null);
    this.enviarMensajeWebSocket({
      type: 'REJECT_LOCK',
      author: this.authService.currentUser()?.username || 'Usuario',
      targetUser: solicitante,
      timestamp: Date.now()
    });
  }

  adquirirLockTransferido() {
    this.cargando.set(true);
    this.docService.bloquearDocumento(this.id).subscribe({
      next: (lockedDoc) => {
        this.documento.set(lockedDoc);
        this.adquiridoLock = true;
        this.cargando.set(false);
        alert('¡Has adquirido el control de edición del documento!');
        this.editor.commands.focus();
      },
      error: (err) => {
        console.error('Error al adquirir lock transferido:', err);
        this.cargando.set(false);
        this.cargarYBloquear();
      }
    });
  }

  cargarDocumentoSilencioso() {
    this.docService.obtenerPorId(this.id).subscribe({
      next: (doc) => {
        this.documento.set(doc);
        const docUser = doc.bloqueadoPor;
        if (!docUser) {
          this.cargarYBloquear();
        }
      }
    });
  }

  invitarColaborador(username: string) {
    this.enviarMensajeWebSocket({
      type: 'INVITE',
      author: this.authService.currentUser()?.username || 'Usuario',
      invitedUser: username,
      timestamp: Date.now()
    });

    const docUrl = window.location.origin + '/documentos/editar/' + this.id;
    navigator.clipboard.writeText(docUrl).then(() => {
      this.invitacionEnviadaMap.update(m => ({ ...m, [username]: true }));
      setTimeout(() => {
        this.invitacionEnviadaMap.update(m => ({ ...m, [username]: false }));
      }, 3000);
    });
  }

  focusEditor(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // Don't intercept clicks on inputs, buttons, toolbar, footer utilities, drawers, or the editor content itself!
    if (
      target.closest('button') || 
      target.closest('input') || 
      target.closest('.sheet-footer-utilities') || 
      target.closest('.editor-toolbar') ||
      target.closest('.dms-drawer') ||
      target.closest('.ProseMirror')
    ) {
      return;
    }
    if (this.editor && !this.editor.isFocused && this.estaBloqueadoPorMi()) {
      this.editor.commands.focus();
    }
  }

  public activePeersList = computed(() => {
    const myUsername = this.authService.currentUser()?.username;
    return this.colaboradoresActivos()
      .filter(username => username !== myUsername)
      .map(username => ({
        username,
        activePath: `/documentos/editar/${this.id}`,
        elementIdFocus: 'document-content-area',
        lastInteraction: Date.now()
      }));
  });

  // Helpers for text statistics (strip HTML for accurate counts)
  private stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  public wordCount = computed(() => {
    const text = this.stripHtml(this.contenido || '').trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  });

  public charCount = computed(() => {
    return this.stripHtml(this.contenido || '').length;
  });

  isAnyDrawerOpen = computed(() => {
    return this.showInfo() || this.showWorkflow() || this.showCollab() || this.showHistory() || this.showComments();
  });

  toggleDrawer(drawer: 'info' | 'workflow' | 'collab' | 'history' | 'comments') {
    this.showInfo.set(drawer === 'info' ? !this.showInfo() : false);
    this.showWorkflow.set(drawer === 'workflow' ? !this.showWorkflow() : false);
    this.showCollab.set(drawer === 'collab' ? !this.showCollab() : false);
    this.showHistory.set(drawer === 'history' ? !this.showHistory() : false);
    this.showComments.set(drawer === 'comments' ? !this.showComments() : false);
  }

  totalPages = signal(1);
  currentPage = signal(1);

  recalcularPaginacion() {
    setTimeout(() => {
      const pmEl = document.querySelector('.ProseMirror') as HTMLElement;
      if (!pmEl) return;

      // Estimar paginación vertical de forma limpia y sin hacks de multi-columnas CSS
      const pixelsPerPage = 1150; // Altura aproximada de una página A4 en píxeles (alineado a la relación de aspecto A4 de 812px de ancho)
      const scrollHeight = pmEl.scrollHeight;
      let computedTotal = Math.max(1, Math.ceil(scrollHeight / pixelsPerPage));

      // Agregar 1 página extra si está en edición activa para dar espacio visual fluido
      if (this.estaBloqueadoPorMi()) {
        computedTotal += 1;
      }

      this.totalPages.set(computedTotal);

      const timeSinceManualNav = Date.now() - this.lastManualNavTime;
      if (this.editor && this.editor.isFocused && timeSinceManualNav > 1500) {
        try {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const pmRect = pmEl.getBoundingClientRect();
            const cursorY = rect.top - pmRect.top + pmEl.scrollTop;
            const computedCurrent = Math.max(1, Math.min(computedTotal, Math.ceil(cursorY / pixelsPerPage)));
            this.currentPage.set(computedCurrent);
          } else {
            const chars = this.charCount();
            const computedCurrent = Math.max(1, Math.ceil(chars / 1800));
            this.currentPage.set(Math.min(computedTotal, computedCurrent));
          }
        } catch (e) {
          const chars = this.charCount();
          const computedCurrent = Math.max(1, Math.ceil(chars / 1800));
          this.currentPage.set(Math.min(computedTotal, computedCurrent));
        }
      }
    }, 100);
  }

  irAPagina(pageNumber: number) {
    const total = this.totalPages();
    if (pageNumber < 1 || pageNumber > total) return;
    
    this.lastManualNavTime = Date.now();
    this.currentPage.set(pageNumber);

    const canvasEl = this.workspaceCanvas?.nativeElement || document.querySelector('.workspace-main-canvas');
    const pmEl = document.querySelector('.ProseMirror') as HTMLElement;
    if (!canvasEl || !pmEl) return;

    // Calcular la posición relativa de ProseMirror dentro del canvas contenedor
    const canvasRect = canvasEl.getBoundingClientRect();
    const pmRect = pmEl.getBoundingClientRect();
    const pmTopInCanvas = pmRect.top - canvasRect.top + canvasEl.scrollTop;

    // Desplazamiento vertical nativo y suave, 100% libre de saltos de cursor e independiente de la altura del encabezado
    const pixelsPerPage = 1150;
    const targetY = pmTopInCanvas + (pageNumber - 1) * pixelsPerPage;
    canvasEl.scrollTo({ top: targetY, behavior: 'smooth' });
  }

  onCanvasScroll() {
    const canvasEl = this.workspaceCanvas?.nativeElement || document.querySelector('.workspace-main-canvas');
    const pmEl = document.querySelector('.ProseMirror') as HTMLElement;
    if (!canvasEl || !pmEl) return;

    const timeSinceManualNav = Date.now() - this.lastManualNavTime;
    // Evitar que el desplazamiento manual se sobreponga a una animación en curso
    if (timeSinceManualNav < 1000) return;

    const canvasRect = canvasEl.getBoundingClientRect();
    const pmRect = pmEl.getBoundingClientRect();
    const pmTopInCanvas = pmRect.top - canvasRect.top + canvasEl.scrollTop;

    // Scroll relativo dentro de la zona de escritura (ProseMirror)
    const relativeScrollY = Math.max(0, canvasEl.scrollTop - pmTopInCanvas);

    const pixelsPerPage = 1150;
    const computedCurrent = Math.max(1, Math.min(this.totalPages(), Math.round(relativeScrollY / pixelsPerPage) + 1));
    this.currentPage.set(computedCurrent);
  }

  // ─── Toolbar actions ───

  insertarTabla() {
    this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  importarArchivo(inputEl: HTMLInputElement) {
    inputEl.click();
  }

  onFileImported(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;

      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'html' || extension === 'htm') {
        this.contenido = result;
        this.editor.commands.setContent(result);
      } else if (extension === 'md') {
        let html = result
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>');
        html = `<p>${html}</p>`;
        this.contenido = html;
        this.editor.commands.setContent(html);
      } else {
        let html = result
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>');
        html = `<p>${html}</p>`;
        this.contenido = html;
        this.editor.commands.setContent(html);
      }
      this.recalcularPaginacion();
      this.onContentChange();
      target.value = '';
    };

    reader.readAsText(file);
  }

  // Utility Actions
  descargarTxt() {
    const doc = this.documento();
    const filename = `${doc?.nombre || 'documento'}.txt`;
    const plainText = this.stripHtml(this.contenido || '');
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  descargarHtml() {
    const doc = this.documento();
    const filename = `${doc?.nombre || 'documento'}.html`;
    const htmlWrapper = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${doc?.nombre || 'Documento'}</title>
<style>body{font-family:Georgia,serif;max-width:210mm;margin:2rem auto;padding:2rem;line-height:1.8;color:#0f172a}
table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:2px solid #0f172a;padding:8px 12px}
th{background:#f1f5f9;font-weight:900;text-transform:uppercase;font-family:monospace;font-size:0.85rem}
h1,h2,h3{font-weight:900}blockquote{border-left:4px solid #0f172a;margin:1rem 0;padding:0.5rem 1rem;color:#475569}</style>
</head>
<body>${this.contenido}</body></html>`;
    const blob = new Blob([htmlWrapper], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  limpiarLienzo() {
    if (!this.estaBloqueadoPorMi()) return;
    if (confirm('¿Estás seguro de que deseas limpiar todo el contenido del lienzo?')) {
      this.editor.commands.clearContent();
      this.contenido = '';
      this.onContentChange();
    }
  }

  private lastCursorSendTime = 0;

  onMouseMove(event: MouseEvent) {
    if (!this.estaBloqueadoPorMi()) return;
    
    const now = Date.now();
    if (now - this.lastCursorSendTime < 300) { // Throttle cursor movements to every 300ms
      return;
    }
    this.lastCursorSendTime = now;
    
    // Broadcast live cursor positions via STOMP
    this.enviarMensajeWebSocket({
      type: 'CURSOR',
      author: this.authService.currentUser()?.username || 'Usuario',
      cursorX: event.clientX,
      cursorY: event.clientY,
      timestamp: now
    });
  }

  ngOnDestroy() {
    this.editor.destroy();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.stompClient) {
      // Send LEAVE message to let others know we left
      this.enviarMensajeWebSocket({
        type: 'LEAVE',
        author: this.authService.currentUser()?.username || 'Usuario',
        timestamp: Date.now()
      });
      this.stompClient.deactivate();
    }
    if (this.adquiridoLock && this.id && this.id !== 'nuevo') {
      this.docService.desbloquearDocumento(this.id).subscribe();
    }
    if (this.voiceService.isListening()) {
      this.voiceService.stop();
    }
  }

  buildEnrichedContext(): string {
    const doc = this.documento();
    const sf = this.solicitudFisica();
    const stageWorkflows = this.workflowsEnEtapa();
    const otherDocs = this.associatedDocs();
    const user = this.authService.currentUser();

    // Detección inteligente del formato del documento para guiar a la IA
    const docNameLow = (doc?.nombre || '').toLowerCase();
    const docDescLow = (doc?.descripcion || '').toLowerCase();
    let detectedFormat = 'Documento General';
    let formatGuidelines = '';

    if (docNameLow.includes('acta') || docNameLow.includes('reunión') || docNameLow.includes('minuta') || docNameLow.includes('sesión') || docDescLow.includes('acta') || docDescLow.includes('reunión')) {
      detectedFormat = 'Acta de Reunión / Sesión Directiva';
      formatGuidelines = `
- Estilo y Tono: Formal, neutro, descriptivo e institucional.
- Estructura Mandatoria:
  1. ENCABEZADO: Título oficial de la reunión, fecha, hora de inicio/cierre, modalidad/lugar y facilitador.
  2. PARTICIPANTES: Lista de asistentes con cargo y departamento representados.
  3. TEMAS TRATADOS: Puntos del orden del día discutidos de forma concisa y objetiva.
  4. ACUERDOS Y COMPROMISOS: Tabla con Tarea/Acuerdo, Responsable Asignado, Fecha Límite y Estado.
  5. FIRMAS: Sección de firmas para Secretario/a y Presidente/a.
- Instrucciones Críticas: El texto redactado debe ser estructurado, evitando valoraciones subjetivas y garantizando que las tareas queden registradas de forma inequívoca.`;
    } else if (docNameLow.includes('contrato') || docNameLow.includes('convenio') || docNameLow.includes('acuerdo') || docDescLow.includes('contrato') || docDescLow.includes('convenio')) {
      detectedFormat = 'Contrato de Servicios / Convenio de Cooperación';
      formatGuidelines = `
- Estilo y Tono: Legal, sumamente formal, riguroso, preciso e imperativo.
- Estructura Mandatoria:
  1. COMPARECIENTES: Identificación plena de las partes (Ej: El Contratante, El Contratista), documentos de identidad, representación legal y domicilios.
  2. ANTECEDENTES/DECLARACIONES: Declaraciones formales de legitimidad, capacidad técnica y económica.
  3. CLÁUSULAS (Numeradas como PRIMERA, SEGUNDA, etc.): Detalle de Objeto del contrato, Precio/Honorarios (con desglose de impuestos), Plazo de vigencia, Propiedad Intelectual, Confidencialidad (NDA), Resolución de Conflictos, Causas de Rescisión y Jurisdicción aplicable.
  4. FIRMAS: Bloque final de firmas para representación legal de las partes contratantes.
- Instrucciones Críticas: No utilizar lenguaje informal ni coloquial. Utilizar terminología legal idónea como "por medio de la presente", "de conformidad con", "asimismo", "asume la entera responsabilidad".`;
    } else if (docNameLow.includes('informe') || docNameLow.includes('reporte') || docNameLow.includes('avance') || docNameLow.includes('kpi') || docDescLow.includes('informe') || docDescLow.includes('reporte') || docDescLow.includes('avance')) {
      detectedFormat = 'Informe de Avance Técnico / Reporte de Gestión';
      formatGuidelines = `
- Estilo y Tono: Analítico, profesional, ejecutivo, sintético y basado en datos/KPIs.
- Estructura Mandatoria:
  1. RESUMEN EJECUTIVO: Síntesis ejecutiva de alto nivel para la gerencia (máximo 2 párrafos).
  2. INTRODUCCIÓN Y OBJETIVOS: Qué alcance comprende y cuáles son los objetivos evaluados.
  3. ACTIVIDADES REALIZADAS: Detalle estructurado de hitos, tareas completadas, y entregables del período (apoyarse en tablas de progreso).
  4. KPIs Y MÉTRICAS: Tabla con Indicadores de Rendimiento (Nombre de KPI, Meta, Resultado, % Cumplimiento, Alerta).
  5. RIESGOS Y PLAN DE MITIGACIÓN: Desvíos del cronograma y soluciones recomendadas.
  6. PRÓXIMOS PASOS: Plan de acción para el siguiente ciclo.
- Instrucciones Críticas: Organizar la información de manera visualmente escaneable mediante listas de viñetas, negritas estratégicas y tablas claras.`;
    } else if (docNameLow.includes('carta') || docNameLow.includes('solicitud') || docNameLow.includes('oficio') || docNameLow.includes('memo') || docNameLow.includes('notificación') || docDescLow.includes('carta') || docDescLow.includes('solicitud') || docDescLow.includes('oficio')) {
      detectedFormat = 'Carta Formal / Oficio Administrativo / Memorando';
      formatGuidelines = `
- Estilo y Tono: Cortés, respetuoso, formal, persuasivo, directo y conciso.
- Estructura Mandatoria:
  1. ENCABEZADO Y FECHA: Lugar, fecha de emisión y código correlativo (Ej: OF-001-2026).
  2. DESTINATARIO: Nombre completo, Cargo formal y Departamento/Institución de destino.
  3. SALUDO FORMAL: Saludo de cortesía institucional (Ej: "Estimado/a Sr./Sra. [Apellido],", "De mi consideración:").
  4. CUERPO DE LA SOLICITUD: Exposición motivada de la solicitud, justificación técnica o legal, y pretensión explícita.
  5. DESPEDIDA FORMAL: Cierre cortés (Ej: "Atentamente,", "Sin otro particular, le saluda atentamente...").
  6. FIRMA: Nombre completo, Cargo y espacio para firma física o electrónica.
- Instrucciones Críticas: Presentar la petición en el primer o segundo párrafo; justificar de manera clara y profesional en los párrafos subsiguientes.`;
    }

    let text = `[ROL] Eres el Copiloto Inteligente de Redacción y Gestión Documental AI.
Estás posicionado dentro de la consola del Editor de Documentos del Workflow Corporativo.
Tu objetivo es dar respuestas extremadamente precisas e informadas, entendiendo exactamente el expediente de la solicitud, el flujo del proceso BPMN, sus departamentos y los KPI vinculados.

[CONTEXTO DE USUARIO ACTUAL]
- Nombre: ${user?.nombreCompleto || user?.username || 'Redactor'}
- Departamento / Oficina: ${user?.departamento || 'No especificado'}
- Rol en la Plataforma: ${user?.rol || 'COLABORADOR'}

[EXPEDIENTE DEL DOCUMENTO ACTUAL]
- ID del Fichero: ${doc?.id || 'Nuevo Borrador'}
- Nombre del Documento: "${doc?.nombre || 'Borrador sin nombre'}"
- Descripción del Fichero: "${doc?.descripcion || 'Sin descripción'}"
- Lock de Edición Activo: ${doc?.bloqueadoPor ? `Adquirido y bloqueado para edición por @${doc.bloqueadoPor}` : 'Libre'}
- Asignado a ID de Proceso/Etapa: "${doc?.solicitudId || 'Ninguno'}"
- Etapa del Proceso BPMN actual en que reside el Documento: "${this.nombreEtapaBpmn()}"

[FORMATO Y ESTILO DETECTADOS]
- Plantilla de Trabajo Recomendada: "${detectedFormat}"
- Directrices de formato para el asistente local:
${formatGuidelines || '- Sigue las mejores prácticas para redacción de documentos corporativos profesionales con tono formal, estructurado y alineado a la oficina emisora.'}
`;

    if (sf) {
      text += `\n[SOLICITUD FÍSICA VINCULADA DIRECTAMENTE AL DOCUMENTO]
- Código de Seguimiento de Expediente: #${sf.codigoSeguimiento || sf.id?.substring(0,5)}
- Título del Caso / Solicitud: "${sf.titulo}"
- Descripción del Trámite: "${sf.descripcion}"
- Estado de Aprobación: "${sf.estado}"
- Departamento de Cola Actual: "${sf.departamentoActual}"
- Usuario Creador Solicitante: "${sf.usuarioCreadorId}"
- Fecha de Creación: ${sf.fechaCreacion ? new Date(sf.fechaCreacion).toLocaleString() : 'N/A'}
- Prioridad del Trámite: "${sf.prioridad || 'MEDIA'}"
`;
    }

    if (stageWorkflows && stageWorkflows.length > 0) {
      text += `\n[OTRAS SOLICITUDES EN LA COLA DE LA ETAPA BPMN ACTUAL]
${stageWorkflows.map((t, i) => `${i+1}. Caso #${t.codigoSeguimiento || t.id?.substring(0,5)}: "${t.titulo}" (Creado por: ${t.usuarioCreadorId}, Prioridad: ${t.prioridad || 'Media'}, Estado: ${t.estado})`).join('\n')}
`;
    }

    if (otherDocs && otherDocs.length > 0) {
      text += `\n[OTROS DOCUMENTOS ANEXOS AL EXPEDIENTE DE ESTA ETAPA/CASO]
${otherDocs.map((d, i) => `${i+1}. "${d.nombre}" (ID: ${d.id}, Creado por: ${d.creadoPor}, Tipo: ${d.tipo})`).join('\n')}
`;
    }

    return text;
  }

  extractMermaidDefinition(text: string): string | null {
    if (!text) return null;
    const match = text.match(/```mermaid\s*([\s\S]*?)```/i);
    if (!match) return null;
    
    let definition = match[1].trim();
    // Limpieza de comentarios CSS estilo /* ... */ que rompen el compilador de Mermaid
    definition = definition.replace(/\/\*[\s\S]*?\*\//g, '');
    
    return definition;
  }

  async compileAndSaveMermaid(definition: string, msgIndex: number) {
    try {
      const elementId = `mermaid-render-${msgIndex}`;
      
      if (!(window as any).mermaid) {
        const module = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs' as any);
        (window as any).mermaid = module.default;
        (window as any).mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'loose'
        });
      }
      
      const mermaid = (window as any).mermaid;
      const { svg } = await mermaid.render(elementId, definition);
      
      this.renderedMermaidDiagrams.update(diagrams => ({
        ...diagrams,
        [msgIndex]: svg
      }));
    } catch (err) {
      console.error('Error al compilar diagrama Mermaid', err);
    }
  }

  insertMermaidInDocument(msgIndex: number) {
    const svg = this.renderedMermaidDiagrams()[msgIndex];
    if (!svg) return;
    
    const htmlToInsert = `
      <div class="mermaid-svg-container" style="border: 2px solid #0f172a; padding: 12px; background: #fafafa; margin: 12px 0; text-align: center; max-width: 100%; box-shadow: 3px 3px 0 0 #0f172a;">
        ${svg}
      </div>
      <p></p>
    `;
    this.editor.commands.insertContent(htmlToInsert);
    this.recalcularPaginacion();
  }

  downloadMermaidSvg(msgIndex: number) {
    const svg = this.renderedMermaidDiagrams()[msgIndex];
    if (!svg) return;
    
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flujo_proceso_${msgIndex}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  askAi(prompt: string) {
    const finalPrompt = prompt || this.voiceService.transcript();
    if (!finalPrompt.trim()) return;

    if (this.voiceService.isListening()) {
      this.voiceService.stop();
    }

    // 1. Obtener contexto de selección actual
    const selection = this.editor.state.selection;
    const hasSelection = !selection.empty;
    const selectedText = hasSelection ? this.editor.state.doc.textBetween(selection.from, selection.to, ' ') : '';

    // 2. Agregar el mensaje del usuario al chat de inmediato
    this.aiMessages.update(msgs => [...msgs, { sender: 'user', text: finalPrompt, timestamp: new Date() }]);

    // 3. Colocar al copiloto en estado "Pensando..."
    this.loadingAi.set(true);
    this.aiMessages.update(msgs => [...msgs, { sender: 'assistant', text: 'Analizando con el asistente local...', timestamp: new Date(), loading: true }]);

    // 4. Formular prompt enriquecido (truncando para evitar latencia)
    const docText = this.stripHtml(this.contenido || '').trim();
    const truncatedDoc = docText.length > 5000 ? docText.substring(0, 5000) + '... [Truncado]' : docText;
    
    const contextualPrompt = `
${this.buildEnrichedContext()}

[CONTENIDO DEL DOCUMENTO ACTUAL]
"""
${truncatedDoc || '(Vacío)'}
"""
${hasSelection ? `\n[SELECCIÓN DEL CONTENIDO ACTUAL]\n"""\n${selectedText}\n"""\n` : ''}

[SOLICITUD / PREGUNTA DEL USUARIO]
${finalPrompt}

[INSTRUCCIONES CRÍTICAS DEL ASISTENTE]
1. Si el usuario te pide crear un flujo, diagrama de flujo, o flujo de proceso, DEBES responder incorporando un bloque de código Mermaid de la siguiente forma:
\`\`\`mermaid
graph TD
  ...
\`\`\`
Diseña el flujo representando con precisión las etapas, los departamentos corporativos (Finanzas, Legal, TI, Compras) y los responsables de manera muy intuitiva.
2. Si el usuario te pide insertar/crear contenido textual, responde en Markdown limpio (tablas, negritas, #).
3. Sin preámbulos. Ve directo al grano.
4. Usa etiquetas <CONTENT>...</CONTENT> únicamente para el contenido que debe autoinserarse en el documento principal.
`;

    // 5. Armar el request API oficial compatible con ChatIARequest
    const request: ChatIARequest = {
      mensaje: contextualPrompt,
      usuarioId: this.authService.currentUser()?.username || 'user-doc-editor',
      sinHerramientas: true
    };

    // 6. Invocar al servicio del backend
    this.aiService.enviarMensajeUsuario(request).subscribe({
      next: (response) => {
        this.loadingAi.set(false);
        // Remover el globo de carga
        this.aiMessages.update(msgs => msgs.filter(m => !m.loading));

        const aiResponse = response.datos?.respuesta || 'Lo siento, no he recibido una respuesta válida del servidor.';
        
        // Agregar la respuesta final al chat
        this.aiMessages.update(msgs => [...msgs, { sender: 'assistant', text: aiResponse, timestamp: new Date() }]);
        const msgIndex = this.aiMessages().length - 1;

        // Intentar extraer diagrama Mermaid y compilarlo
        const mermaidDef = this.extractMermaidDefinition(aiResponse);
        if (mermaidDef) {
          this.compileAndSaveMermaid(mermaidDef, msgIndex);
        }

        // Auto-insertar o Reemplazar en el editor de forma inteligente si no es solo diagrama
        const lowPrompt = finalPrompt.toLowerCase();
        const keywordsInsert = ['inserta', 'tabla', 'crea', 'escribe', 'añade', 'agrega', 'genera'];
        const keywordsReplace = ['reemplaza', 'reescribe', 'mejora', 'corrige', 'actualiza', 'reformula'];

        const cleanContent = this.extractContent(aiResponse);

        if (!mermaidDef) {
          if (keywordsReplace.some(k => lowPrompt.includes(k))) {
            if (hasSelection) {
              this.insertHtmlAtCursor(cleanContent); // insertHtmlAtCursor replaces selection by default in Tiptap
            } else {
              this.replaceDocumentWithHtml(cleanContent);
            }
          } else if (keywordsInsert.some(k => lowPrompt.includes(k)) || lowPrompt.length < 20) {
            this.insertHtmlAtCursor(cleanContent);
          }
        }
      },
      error: (err) => {
        this.loadingAi.set(false);
        this.aiMessages.update(msgs => msgs.filter(m => !m.loading));
        console.warn("IA Backend falló. Usando motor local de respaldo:", err);

        setTimeout(() => {
          this.aiMessages.update(msgs => [...msgs, { 
            sender: 'assistant', 
            text: 'El satélite de IA está experimentando alta latencia o el servidor está ocupado. Por favor, intenta de nuevo en unos momentos o usa un mensaje más corto.', 
            timestamp: new Date() 
          }]);
        }, 800);
      }    });
  }

  /**
   * Extrae el contenido relevante de la respuesta de la IA, eliminando etiquetas y marcas.
   */
  private extractContent(text: string): string {
    if (!text) return '';
    
    // Si la IA envolvió el contenido en etiquetas <CONTENT>, lo extraemos
    const match = text.match(/<CONTENT>([\s\S]*?)<\/CONTENT>/i);
    let content = match ? match[1] : text;
    
    // Limpiamos la marca PROCESADO_POR_IA
    content = content.replace(/PROCESADO_POR_IA/g, '').trim();
    
    return content;
  }

  /**
   * Procesa y convierte texto en formato Markdown (tablas de pipes, listas, negritas, saltos de línea)
   * a marcado HTML limpio y compatible con TipTap con bordes definidos estilo neo-brutalismo.
   */
  convertirMarkdownAHtml(text: string): string {
    if (!text) return '';
    let html = text.trim();

    // Remove AI Marker before processing
    html = html.replace(/PROCESADO_POR_IA/g, '').trim();

    // 1. Detectar y convertir tablas Markdown de tipo: | Tarea | Estado |
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    const parsedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('|') && line.endsWith('|')) {
        // Ignorar líneas de separación como |---|---|
        if (line.includes('---') || line.includes('-:-')) {
          continue;
        }
        
        const cells = line.split('|')
          .slice(1, -1)
          .map(c => c.trim());

        if (!inTable) {
          inTable = true;
          tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 24px 0; border: 3px solid #0f172a; box-shadow: 6px 6px 0 0 #0f172a;"><thead><tr style="background-color: #f1f5f9; border-bottom: 3px solid #0f172a;">';
          cells.forEach(cell => {
            tableHtml += `<th style="border: 2px solid #0f172a; padding: 12px; text-align: left; font-weight: 900; font-family: monospace; font-size: 12px; text-transform: uppercase;">${cell}</th>`;
          });
          tableHtml += '</tr></thead><tbody>';
        } else {
          tableHtml += '<tr style="border-bottom: 2px solid #0f172a;">';
          cells.forEach(cell => {
            let cellStyle = 'border: 2px solid #0f172a; padding: 12px; font-size: 12px;';
            let cellContent = cell;
            
            // Highlight status keywords
            const lowerCell = cell.toLowerCase();
            if (lowerCell.includes('completado') || lowerCell.includes('aprobado') || lowerCell.includes('éxito')) {
              cellContent = `<span style="background: #dcfce7; color: #16a34a; font-weight: 900; padding: 2px 4px; border: 1px solid #16a34a;">${cell}</span>`;
            } else if (lowerCell.includes('pendiente') || lowerCell.includes('revisión') || lowerCell.includes('proceso')) {
              cellContent = `<span style="background: #fef9c3; color: #ca8a04; font-weight: 900; padding: 2px 4px; border: 1px solid #ca8a04;">${cell}</span>`;
            } else if (lowerCell.includes('rechazado') || lowerCell.includes('crítico') || lowerCell.includes('error') || lowerCell.includes('vencido')) {
              cellContent = `<span style="background: #fef2f2; color: #dc2626; font-weight: 900; padding: 2px 4px; border: 1px solid #dc2626;">${cell}</span>`;
            }
            
            tableHtml += `<td style="${cellStyle}">${cellContent}</td>`;
          });
          tableHtml += '</tr>';
        }
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</tbody></table>';
          parsedLines.push(tableHtml);
          tableHtml = '';
        }
        parsedLines.push(line);
      }
    }
    if (inTable) {
      tableHtml += '</tbody></table>';
      parsedLines.push(tableHtml);
    }

    html = parsedLines.join('\n');

    // 2. Bold text **texto** -> <strong>texto</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 3. Italic text *texto* -> <em>texto</em>
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 4. Listas desordenadas - item o * item -> <ul><li>item</li></ul>
    html = html.replace(/^\s*[-*]\s+(.*?)$/gm, '<li>$1</li>');
    // Wrap consecutive li items in ul
    html = html.replace(/(?:<li>.*?<\/li>\s*)+/gs, (match) => `<ul style="margin-bottom: 1.25rem; padding-left: 1.5rem;">${match}</ul>`);

    // 5. Encabezados Markdown #, ##, ###
    html = html.replace(/^\s*###\s+(.*?)$/gm, '<h3 style="font-weight: 800; font-size: 1.1rem; border-left: 4px solid #0f172a; padding-left: 8px; margin-top: 1.5rem;">$1</h3>');
    html = html.replace(/^\s*##\s+(.*?)$/gm, '<h2 style="font-weight: 900; font-size: 1.35rem; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; margin-top: 1.75rem;">$1</h2>');
    html = html.replace(/^\s*#\s+(.*?)$/gm, '<h1 style="font-weight: 900; font-size: 1.75rem; border-bottom: 4px solid #0f172a; padding-bottom: 8px; margin-top: 2rem;">$1</h1>');

    // 6. Blockquotes > texto
    html = html.replace(/^\s*>\s+(.*?)$/gm, '<blockquote style="border-left: 6px solid #0f172a; background: #f1f5f9; padding: 12px 16px; margin: 16px 0; font-style: italic; color: #334155; box-shadow: 4px 4px 0 0 #0f172a;">$1</blockquote>');

    // 7. Saltos de línea
    // Double newlines to paragraphs
    html = html.split(/\n\n+/).map(p => p.trim() ? `<p style="margin-bottom: 1.25rem;">${p}</p>` : '').join('');
    // Single newlines to breaks (if not already inside a tag)
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  insertHtmlAtCursor(text: string) {
    if (!this.estaBloqueadoPorMi()) return;
    const html = this.convertirMarkdownAHtml(text);
    this.editor.chain().focus().insertContent(html).run();
    this.contenido = this.editor.getHTML();
    this.onContentChange();
    this.recalcularPaginacion();
  }

  replaceDocumentWithHtml(text: string) {
    if (!this.estaBloqueadoPorMi()) return;
    if (confirm('¿Estás seguro de que deseas reemplazar todo el contenido del documento con esta respuesta de la IA?')) {
      const html = this.convertirMarkdownAHtml(text);
      this.editor.commands.setContent(html);
      this.contenido = html;
      this.onContentChange();
      this.recalcularPaginacion();
    }
  }

  copyToClipboard(text: string) {
    const cleanText = this.stripHtml(text);
    navigator.clipboard.writeText(cleanText).then(() => {
      alert('Contenido copiado al portapapeles.');
    });
  }
}

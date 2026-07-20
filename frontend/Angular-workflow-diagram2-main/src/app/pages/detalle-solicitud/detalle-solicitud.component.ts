import { Component, inject, OnInit, signal, computed, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { WorkflowDepartamentalService } from '../../api/api/workflowDepartamental.service';
import { SolicitudResponse } from '../../api/model/solicitudResponse';
import { CambiarEstadoRequest } from '../../api/model/cambiarEstadoRequest';
import { AsignarUsuarioRequest } from '../../api/model/asignarUsuarioRequest';
import { ReasignarDepartamentoRequest } from '../../api/model/reasignarDepartamentoRequest';
import { DatePipe, UpperCasePipe, DecimalPipe, CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { MatIconModule } from '@angular/material/icon';
import {
  ReasignacionRecomendacion,
  WorkflowSupportService,
  PresenciaUsuario
} from '../../workflow/workflow-support.service';
import { AdminUser, AdminUsersService } from '../../admin/admin-users.service';
import { FormFieldDefinition, DrillDownTab } from '../bpmn-workspace/bpmn-workspace.models';
import { VoiceRecognitionService } from '../../shared/services/voice-recognition.service';
import { AsistenteIAService } from '../../api/api/asistenteIA.service';
import { PrediccionIA } from '../../workflow/workflow-support.service';
import { DocumentoService, Documento } from '../../workflow/documento.service';
import { BASE_PATH } from '../../api/variables';

interface ResumenReasignacion {
  desde: string;
  hacia: string;
  comentario?: string;
}

interface EventoHistorialView {
  estadoAnterior?: string;
  estadoNuevo?: string;
  comentario?: string;
}

@Component({
  selector: 'app-detalle-solicitud',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, ReactiveFormsModule, FormsModule, CommonModule, MatIconModule],
  templateUrl: './detalle-solicitud.component.html',
  styleUrl: './detalle-solicitud.component.css',
  providers: [VoiceRecognitionService]
})
export class DetalleSolicitudComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private workflowService = inject(WorkflowDepartamentalService);
  private workflowSupportService = inject(WorkflowSupportService);
  private adminUsersService = inject(AdminUsersService);
  private fb = inject(FormBuilder);
  authService = inject(AuthService);
  public voiceService = inject(VoiceRecognitionService);
  private aiService = inject(AsistenteIAService);
  private router = inject(Router);
  private docService = inject(DocumentoService);
  basePath = inject(BASE_PATH);

  solicitud = signal<any | null>(null);
  cargando = signal(true);
  errorCarga = signal<string | null>(null);
  isAiFilling = signal(false);
  
  // Dynamic DMS Document Signals & Form
  ticketDocs = signal<Documento[]>([]);
  loadingDocs = signal(false);
  modalCrearDoc = signal(false);
  tipoCreacionDoc = signal<'FILE' | 'COLLABORATIVE'>('FILE');
  submittingDoc = signal(false);

  crearDocForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: ['', [Validators.maxLength(250)]],
    contenidoInicial: ['']
  });

  selectedDocFile: File | null = null;
  
  // Operations Right Drawer control
  drawerOpen = signal(false);

  toggleDrawer() {
    this.drawerOpen.update(v => !v);
  }
  
  // Predictive Engine State
  prediccionIA = signal<PrediccionIA | null>(null);
  loadingPredictivo = signal(false);
  diagnosticoAutoIa = signal<{ resumen: string; riesgo: string; justificacionRiesgo: string; recomendacionAccion: string } | null>(null);
  cargandoDiagnosticoIa = signal(false);

  /** Collaborative Presence: Global Signal */
  presenciaResumen = this.workflowSupportService.presenciaResumen;
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  
  colaboradorActivo = computed(() => {
    const s = this.solicitud();
    const online = this.presenciaResumen()?.usuariosOnline || [];
    
    if (!s) return null;
    
    // Verifica si el Revisor Asignado está en línea (asegurándose que no sea el mismo usuario navegando)
    if (s.usuarioAsignado && s.usuarioAsignado !== this.authService.currentUser()?.username) {
      const isOnline = online.find((u: PresenciaUsuario) => u.username === s.usuarioAsignado || u.nombreCompleto === s.usuarioAsignado);
      if (isOnline) return { name: isOnline.nombreCompleto || isOnline.username, role: isOnline.rol, action: 'evaluando operativas' };
    }
    
    // Check if the creator is online
    if (s.usuarioCreador && s.usuarioCreador !== this.authService.currentUser()?.username) {
      const isOnline = online.find((u: PresenciaUsuario) => u.username === s.usuarioCreador || u.nombreCompleto === s.usuarioCreador);
      if (isOnline) return { name: isOnline.nombreCompleto || isOnline.username, role: 'CREADOR', action: 'supervisando flujos' };
    }
    
    return null;
  });

  private readonly fallbackDepartamentos = ['Sistemas', 'Ventas', 'Recursos Humanos'];

  departamentosCatalogo = signal<string[]>(this.fallbackDepartamentos);
  recomendacion = signal<ReasignacionRecomendacion | null>(null);
  cargandoRecomendacion = signal(false);
  usuariosAsignables = signal<AdminUser[]>([]);
  errorAsignacion = signal<string | null>(null);
  errorReasignacion = signal<string | null>(null);
  modalConfirmacionReasignacion = signal(false);
  resumenReasignacion = signal<ResumenReasignacion | null>(null);
  
  workflowDefinitions = signal<any[]>([]);
  selectedWorkflowKey = signal<string>('');
  
  // Dynamic Forms State
  formFields = signal<FormFieldDefinition[]>([]);
  formValues = signal<Record<string, any>>({});
  tareasDisponibles = signal<Array<{ id: string, name: string, camposCount: number }>>([]);
  
  form = this.fb.group({
    comentario: ['', [Validators.required, Validators.maxLength(250)]]
  });

  asignarForm = this.fb.group({
    usuarioAsignado: ['', Validators.required]
  });

  reasignarForm = this.fb.group({
    nuevoDepartamento: ['Sistemas', Validators.required],
    comentario: ['']
  });

  isSubmitting = false;
  showAiInsights = signal(false);

  toggleAiCopilot() {
    this.showAiInsights.update(v => !v);
  }

  ngOnInit() {
    this.cargarCatalogoDepartamentos();
    this.cargarUsuariosAsignables();
    this.cargarDefinicionesBpm();
    this.iniciarAutoSync();

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.cargarDependencias(id);
        this.cargarRecomendacion(id);
      }
    });
  }

  ngOnDestroy() {
    this.detenerAutoSync();
  }

  private iniciarAutoSync() {
    if (this.autoSyncTimer) return;

    this.autoSyncTimer = setInterval(() => {
      this.syncSilencioso();
    }, 15000);
  }

  private detenerAutoSync() {
    if (!this.autoSyncTimer) return;
    clearInterval(this.autoSyncTimer);
    this.autoSyncTimer = null;
  }

  private syncSilencioso() {
    const id = this.solicitud()?.id;
    if (!id) return;
    
    this.workflowService.obtenerPorId(id).subscribe({
      next: (res) => {
        if (res.datos) {
          const current = this.solicitud();
          const incoming = res.datos as SolicitudResponse;
          const currentForm = JSON.stringify(current?.datosFormulario || {});
          const incomingForm = JSON.stringify(incoming.datosFormulario || {});
          // Incluye actividad BPMN y respuestas: pueden cambiar en otra sesión
          // sin que cambie el estado general del trámite.
          if (current && (
            current.estado !== incoming.estado ||
            current.historial?.length !== incoming.historial?.length ||
            current.departamentoActual !== incoming.departamentoActual ||
            current.usuarioAsignado !== incoming.usuarioAsignado ||
            current.tareaActualId !== incoming.tareaActualId ||
            current.tareaActualNombre !== incoming.tareaActualNombre ||
            currentForm !== incomingForm
          )) {
            this.solicitud.set(incoming);
            this.formValues.set(incoming.datosFormulario || {});
            if (incoming.workflowDefinitionId && incoming.tareaActualId &&
                incoming.tareaActualId !== current.tareaActualId) {
              this.cargarConfiguracionFormulario(incoming.workflowDefinitionId, incoming.tareaActualId);
            }
          }
        }
      }
    });
  }

  private cargarConfiguracionFormulario(workflowKey: string, tareaId: string) {
    this.workflowSupportService.obtenerWorkflowDefinition(workflowKey).subscribe({
      next: (def: any) => {
        if (def && def.xml) {
          this.extraerCamposDeXml(def.xml, tareaId, def.formularios?.[tareaId]);
          this.extraerTodasLasTareasDeXml(def.xml, def.formularios);
        }
      }
    });
  }

  private extraerTodasLasTareasDeXml(xml: string, formularios: Record<string, any[]> = {}) {
    if (!xml) return;
    try {
      const tareas: Array<{ id: string, name: string, camposCount: number }> = [];
      const userTaskRegex = /<(bpmn[2]?:(?:userTask|task))\s+([^>]+)>/gi;
      let match;
      while ((match = userTaskRegex.exec(xml)) !== null) {
        const tagContent = match[2];
        const idMatch = tagContent.match(/id="([^"]+)"/i);
        const nameMatch = tagContent.match(/name="([^"]+)"/i);
        
        if (idMatch) {
          const id = idMatch[1];
          const name = nameMatch ? nameMatch[1] : id;
          
          let camposCount = 0;
          const formMatch = tagContent.match(/[:\s]form=(["'])(.*?)\1/i);
          if (formMatch && formMatch[2]) {
            try {
              const cleanJson = formMatch[2].replace(/&quot;/g, '"').replace(/&apos;/g, "'");
              const parsed = JSON.parse(cleanJson);
              if (Array.isArray(parsed)) {
                camposCount = parsed.length;
              }
            } catch (e) {}
          }
          if (camposCount === 0 && Array.isArray(formularios[id])) {
            camposCount = formularios[id].length;
          }
          tareas.push({ id, name, camposCount });
        }
      }
      this.tareasDisponibles.set(tareas);
    } catch (e) {
      console.error('Error al extraer todas las tareas del XML', e);
    }
  }

  cambiarEtapaTicket(nuevaTareaId: string) {
    const s = this.solicitud();
    if (!s || !s.workflowDefinitionId) return;
    
    const nuevaTarea = this.tareasDisponibles().find(t => t.id === nuevaTareaId);
    const nuevaTareaNombre = nuevaTarea ? nuevaTarea.name : nuevaTareaId;
    
    this.isSubmitting = true;
    this.workflowSupportService.cambiarTareaBpm(s.id!, s.workflowDefinitionId, nuevaTareaId, nuevaTareaNombre).subscribe({
      next: (res) => {
        this.workflowSupportService.obtenerWorkflowDefinition(s.workflowDefinitionId!).subscribe({
          next: (def) => {
            if (def && def.xml) {
              let xml = def.xml;
              const ticketCode = s.codigoSeguimiento!;
              
              // Remover de todas partes
              const tagRegexAll = /wf:solicitudes="([^"]*)"/gi;
              xml = xml.replace(tagRegexAll, (match: string, p1: string) => {
                const list = p1 ? p1.split(',') : [];
                const filtered = list.filter((code: string) => code !== ticketCode);
                return `wf:solicitudes="${filtered.join(',')}"`;
              });
              
              // Vincular a la nueva
              const tagRegex = new RegExp(`(<bpmn[2]?:(?:userTask|task)[^>]*id="${nuevaTareaId}"[^>]*)(>)`, 'i');
              const tagMatch = xml.match(tagRegex);
              if (tagMatch) {
                let tagContent = tagMatch[1];
                const solicitudesMatch = tagContent.match(/wf:solicitudes="([^"]*)"/i);
                if (solicitudesMatch) {
                  const currentList = solicitudesMatch[1] ? solicitudesMatch[1].split(',') : [];
                  if (!currentList.includes(ticketCode)) {
                    currentList.push(ticketCode);
                  }
                  tagContent = tagContent.replace(/wf:solicitudes="[^"]*"/i, `wf:solicitudes="${currentList.join(',')}"`);
                } else {
                  tagContent += ` wf:solicitudes="${ticketCode}"`;
                }
                xml = xml.replace(tagRegex, `${tagContent}>`);
              }
              
              def.xml = xml;
              const user = this.authService.currentUser()?.username || 'anonimo';
              const depto = s.departamentoActual || '';
              this.workflowSupportService.guardarWorkflowDefinition(def, user, depto).subscribe({
                next: () => {
                  this.isSubmitting = false;
                  this.cargarDependencias(s.id!);
                },
                error: (err) => {
                  this.isSubmitting = false;
                  console.error('Error al guardar XML en re-enlace', err);
                  this.cargarDependencias(s.id!);
                }
              });
            } else {
              this.isSubmitting = false;
              this.cargarDependencias(s.id!);
            }
          },
          error: (err) => {
            this.isSubmitting = false;
            this.cargarDependencias(s.id!);
          }
        });
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Error al cambiar de etapa bpm', err);
      }
    });
  }

  private extraerCamposDeXml(xml: string, tareaId: string, camposPersistidos?: any[]) {
    if (!xml || !tareaId) {
      this.formFields.set([]);
      return;
    }

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');
      const taskNode = xmlDoc.getElementById(tareaId) || xmlDoc.querySelector(`[id="${tareaId}"]`);
      
      if (taskNode) {
        const formAttr = taskNode.getAttribute('wf:form') || 
                         taskNode.getAttribute('wf2:form') || 
                         taskNode.getAttribute('form') ||
                         Array.from(taskNode.attributes).find(attr => attr.nodeName.endsWith(':form'))?.nodeValue;
                         
        if (formAttr) {
          try {
            const cleanJson = String(formAttr).replace(/&quot;/g, '"').replace(/&apos;/g, "'");
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed)) {
              this.formFields.set(parsed);
              return;
            }
          } catch (e) {
            console.warn('DOMParser JSON parse failed, trying regex fallback...', e);
          }
        }
      }

      // Fallback: Regex de alto espectro
      const taskSectionRegex = new RegExp(`<[^>]*id=["']${tareaId}["'][^>]*>`, 'i');
      const taskMatch = xml.match(taskSectionRegex);
      
      if (taskMatch) {
        const taskTag = taskMatch[0];
        const formRegex = /[:\s]form=(["'])(.*?)\1/i;
        const formMatch = taskTag.match(formRegex);
        
        if (formMatch && formMatch[2]) {
          try {
            const rawContent = formMatch[2];
            const cleanJson = rawContent.replace(/&quot;/g, '"').replace(/&apos;/g, "'");
            const parsed = JSON.parse(cleanJson);
            this.formFields.set(Array.isArray(parsed) ? parsed : []);
            return;
          } catch (e) {
            console.error('Error parseando JSON con regex fallback', e);
          }
        }
      }

      this.formFields.set(Array.isArray(camposPersistidos) ? camposPersistidos : []);
    } catch (e) {
      console.error('Fallo critico en extraccion de campos', e);
      this.formFields.set(Array.isArray(camposPersistidos) ? camposPersistidos : []);
    }
  }

  updateDynamicFieldValue(name: string, value: any) {
    this.formValues.update(v => ({ ...v, [name]: value }));
  }

  getTableColumns(field: { columns?: string }): string[] {
    return (field.columns || '')
      .split(',')
      .map(column => column.trim())
      .filter(Boolean);
  }

  getTableRows(name: string): Record<string, string>[] {
    const rows = this.formValues()[name];
    return Array.isArray(rows) ? rows : [];
  }

  addTableRow(field: { name: string; columns?: string }) {
    const row = Object.fromEntries(this.getTableColumns(field).map(column => [column, '']));
    this.updateDynamicFieldValue(field.name, [...this.getTableRows(field.name), row]);
  }

  removeTableRow(name: string, index: number) {
    this.updateDynamicFieldValue(name, this.getTableRows(name).filter((_, rowIndex) => rowIndex !== index));
  }

  updateTableCell(name: string, index: number, column: string, value: string) {
    const rows = this.getTableRows(name).map((row, rowIndex) =>
      rowIndex === index ? { ...row, [column]: value } : row
    );
    this.updateDynamicFieldValue(name, rows);
  }

  guardarDatosFormulario() {
    const solicitud = this.solicitud();
    if (!solicitud || this.isSubmitting) return;

    this.isSubmitting = true;
    const request: CambiarEstadoRequest = {
      nuevoEstado: solicitud.estado as CambiarEstadoRequest.NuevoEstadoEnum,
      comentario: 'Actualización manual de campos del formulario',
      datosFormulario: this.formValues()
    };

    this.workflowService.cambiarEstado(solicitud.id!, request).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.datos) {
          this.solicitud.set(res.datos as SolicitudResponse);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Error guardando formulario', err);
      }
    });
  }

  toggleVoice() {
    if (this.voiceService.isListening()) {
      this.stopVoiceFormFilling();
    } else {
      this.startVoiceFormFilling();
    }
  }

  startVoiceFormFilling() {
    this.voiceService.start();
  }

  stopVoiceFormFilling() {
    this.voiceService.stop();
    const transcript = this.voiceService.transcript();
    
    if (transcript && transcript.trim()) {
      this.processTranscriptWithAi(transcript);
    }
  }

  private processTranscriptWithAi(text: string) {
    const s = this.solicitud();
    if (!s) return;

    this.isAiFilling.set(true);
    
    const fieldsDescription = this.formFields().map(f => `- ${f.label} (ID Técnico: ${f.name}, Tipo: ${f.type})`).join('\n');

    const prompt = `
[CONTEXTO]
Estoy rellenando un formulario técnico para la solicitud ${s.codigoSeguimiento}.
Etapa: ${s.tareaActualNombre}.

[CAMPOS DISPONIBLES EN ESTE FORMULARIO]
${fieldsDescription}

[DICTADO POR VOZ DEL USUARIO]
"${text}"

[INSTRUCCIÓN CRÍTICA]
Debes llamar obligatoriamente a la herramienta 'rellenarFormularioTool' para mapear los datos extraídos del dictado a los campos del formulario.
1. Utiliza exactamente el código de seguimiento "${s.codigoSeguimiento}".
2. Para el mapa de campos:
   - Si un campo es de Tipo 'number' (Numérico), asegúrate de convertir el valor extraído a un número real (Double/Integer).
   - Si un campo es de Tipo 'checkbox' (Booleano), conviértelo a true/false.
   - Si un campo es de Tipo 'date' (Fecha), formatea o extrae la fecha detectada.
   - Si no hay datos legibles para un campo en el dictado, NO lo incluyas en el mapa.
3. Responde de forma muy resumida y amigable confirmando qué datos técnicos pudiste procesar con éxito.
`;

    this.aiService.enviarMensajeUsuario({
      mensaje: prompt,
      usuarioId: this.authService.currentUser()?.username || 'admin'
    }).subscribe({
      next: (res) => {
        this.isAiFilling.set(false);
        // Recargar la solicitud para ver los cambios aplicados por la IA vía Tool
        this.cargarDependencias(s.id!);
        this.voiceService.clear();
      },
      error: (err) => {
        this.isAiFilling.set(false);
        console.error('Error en el llenado por voz con IA', err);
      }
    });
  }

  private cargarCatalogoDepartamentos() {
    this.workflowSupportService.obtenerCatalogoDepartamentos().subscribe({
      next: (catalogo) => {
        if (catalogo.length > 0) {
          this.departamentosCatalogo.set(catalogo);
          this.sincronizarDepartamentoSeleccionado();
        }
      },
      error: () => {
        this.departamentosCatalogo.set(this.fallbackDepartamentos);
        this.sincronizarDepartamentoSeleccionado();
      }
    });
  }

  private sincronizarDepartamentoSeleccionado() {
    const catalogo = this.departamentosCatalogo();
    const solicitud = this.solicitud();
    const sugerido = this.recomendacion()?.departamentoSugerido;

    if (sugerido && catalogo.includes(sugerido)) {
      this.reasignarForm.patchValue({ nuevoDepartamento: sugerido });
      return;
    }

    if (solicitud?.departamentoActual && catalogo.includes(solicitud.departamentoActual)) {
      this.reasignarForm.patchValue({ nuevoDepartamento: solicitud.departamentoActual });
      return;
    }

    this.reasignarForm.patchValue({ nuevoDepartamento: catalogo[0] || 'Sistemas' });
  }

  cargarDependencias(id: string) {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.cargarDocumentosAdjuntos(id);
    this.workflowService.obtenerPorId(id).subscribe({
      next: (res) => {
        this.cargando.set(false);
        if (res.datos) {
          const solicitud = res.datos as SolicitudResponse;
          this.solicitud.set(solicitud);
          this.formValues.set(solicitud.datosFormulario || {});
          
          if (solicitud.workflowDefinitionId && solicitud.tareaActualId) {
            this.cargarConfiguracionFormulario(solicitud.workflowDefinitionId, solicitud.tareaActualId);
          }

          if (
            solicitud.departamentoActual
            && this.departamentosCatalogo().includes(solicitud.departamentoActual)
          ) {
            this.reasignarForm.patchValue({
              nuevoDepartamento: solicitud.departamentoActual
            });
          } else {
            this.reasignarForm.patchValue({
              nuevoDepartamento: this.departamentosCatalogo()[0] || 'Sistemas'
            });
          }

          this.sincronizarDepartamentoSeleccionado();
          this.ejecutarAnalisisPredictivo(id);
          this.generarDiagnosticoAutonomo();
        } else {
          this.errorCarga.set("Los datos devueltos por el servidor son inválidos o están incompletos.");
        }
      },
      error: (err: any) => {
        this.cargando.set(false);
        console.error('Error fetching details', err);
        const msg = err.error?.mensaje || err.message || "Error al conectar con el servidor.";
        this.errorCarga.set(`No se pudo cargar la solicitud: ${msg}`);
      }
    });
  }

  private ejecutarAnalisisPredictivo(id: string) {
    this.loadingPredictivo.set(true);
    this.workflowSupportService.obtenerAnalisisPredictivo(id).subscribe({
      next: (pred) => {
        this.prediccionIA.set(pred);
        this.loadingPredictivo.set(false);
      },
      error: (err) => {
        console.warn('Error en análisis predictivo TensorFlow', err);
        this.loadingPredictivo.set(false);
      }
    });
  }

  generarDiagnosticoAutonomo() {
    const s = this.solicitud();
    if (!s) return;

    this.cargandoDiagnosticoIa.set(true);

    const prompt = `
[CONTEXTO DE TRABAJO]
Estás auditando la solicitud de workflow "${s.titulo}" con código ${s.codigoSeguimiento}.
- Descripción original: "${s.descripcion}"
- Prioridad actual: ${s.prioridad}
- Etapa de BPMN en curso: ${s.tareaActualNombre || 'No iniciada'}
- Historial de Transiciones:
${(s.historial || []).map((h: any) => `- De ${h.estadoAnterior || 'Inicio'} a ${h.estadoNuevo} por ${h.usuarioResponsable || h.usuario || 'Sistema'} (${h.comentario || 'sin comentarios'})`).join('\n')}

[INSTRUCCIÓN CRÍTICA]
Genera un diagnóstico estratégico ultra-resumido del estado del ticket y lo que el usuario actual debería hacer.
Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (no agregues introducciones ni explicaciones fuera del JSON):
{
  "resumen": "Resumen de una línea de la situación actual de esta solicitud.",
  "riesgo": "Bajo",
  "justificacionRiesgo": "Justificación cortísima del nivel de riesgo.",
  "recomendacionAccion": "Acción específica recomendada (ej: Aprobar y pasar a Finanzas, Solicitar más información, o Rechazar)."
}
Asegúrate de que la llave riesgo sea exactamente "Bajo", "Medio" o "Alto".
`;

    this.aiService.enviarMensajeUsuario({
      mensaje: prompt,
      usuarioId: this.authService.currentUser()?.username || 'admin',
      sinHerramientas: true
    }).subscribe({
      next: (res) => {
        this.cargandoDiagnosticoIa.set(false);
        if (res.datos && res.datos.respuesta) {
          try {
            let cleanJson = res.datos.respuesta.trim();
            if (cleanJson.startsWith('```json')) {
              cleanJson = cleanJson.substring(7);
            }
            if (cleanJson.endsWith('```')) {
              cleanJson = cleanJson.substring(0, cleanJson.length - 3);
            }
            cleanJson = cleanJson.trim();
            
            const parsed = JSON.parse(cleanJson);
            this.diagnosticoAutoIa.set(parsed);
          } catch (e) {
            console.warn('Error parseando JSON de diagnóstico IA, intentando regex fallback...', e);
            this.diagnosticoAutoIa.set({
              resumen: s.titulo || 'Trámite en curso',
              riesgo: s.prioridad === 'URGENTE' ? 'Alto' : 'Medio',
              justificacionRiesgo: 'Calculado según la prioridad.',
              recomendacionAccion: 'Proceder a la revisión estándar de la etapa.'
            });
          }
        }
      },
      error: (err) => {
        this.cargandoDiagnosticoIa.set(false);
        console.error('Error al generar diagnóstico IA autónomo', err);
      }
    });
  }

  aplicarAutoPilotoIa() {
    const diag = this.diagnosticoAutoIa();
    const rec = this.recomendacion();
    if (!diag) return;

    let decisionDraft = `[Auto-Piloto IA]: Se aconseja proceder con la acción recomendada: "${diag.recomendacionAccion}".`;
    if (diag.resumen) {
      decisionDraft += ` Síntesis contextuada: ${diag.resumen}`;
    }
    
    this.form.patchValue({ comentario: decisionDraft.slice(0, 245) });

    if (rec && rec.departamentoSugerido) {
      this.reasignarForm.patchValue({
        nuevoDepartamento: rec.departamentoSugerido,
        comentario: `Reasignación inteligente recomendada por la IA debido a: ${rec.razon || 'análisis de carga de cola'}`
      });
    }

    alert('⚡ ¡Sugerencias de la IA aplicadas con éxito al Centro de Decisiones y Reasignación! Revisa los comentarios abajo a la derecha y haz clic en "Aprobar", "Rechazar" o "Efectuar Traslado" para confirmar.');
  }

  cargarRecomendacion(id: string) {
    const user = this.authService.currentUser();
    if (!user || (user.rol !== 'REVISOR' && user.rol !== 'ADMINISTRADOR')) {
      this.recomendacion.set(null);
      return;
    }

    this.cargandoRecomendacion.set(true);
    this.workflowSupportService.obtenerRecomendacionReasignacion(id).subscribe({
      next: (recomendacion) => {
        this.cargandoRecomendacion.set(false);
        this.recomendacion.set(recomendacion);
        this.sincronizarDepartamentoSeleccionado();
      },
      error: () => {
        this.cargandoRecomendacion.set(false);
        this.recomendacion.set(null);
      }
    });
  }

  colaPendienteEntries(): Array<{ departamento: string; pendientes: number }> {
    const cola = this.recomendacion()?.colaPendiente || {};
    return Object.entries(cola)
      .map(([departamento, pendientes]) => ({
        departamento,
        pendientes: Number(pendientes)
      }))
      .sort((a, b) => a.pendientes - b.pendientes);
  }

  cambiarEstado(estadoDestino: string) {
    const user = this.authService.currentUser();
    if (this.form.invalid || !this.solicitud() || !user) return;
    
    this.isSubmitting = true;
    const request: CambiarEstadoRequest = {
      nuevoEstado: estadoDestino as CambiarEstadoRequest.NuevoEstadoEnum,
      comentario: this.form.value.comentario || undefined
    };

    this.workflowService.cambiarEstado(this.solicitud()!.id!, request).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.datos) {
          this.solicitud.set(res.datos as SolicitudResponse);
          this.form.reset();
        }
      },
      error: (err: any) => {
        this.isSubmitting = false;
        console.error('Error cambiando estado', err);
      }
    });
  }

  asignarUsuario() {
    const user = this.authService.currentUser();
    if (this.asignarForm.invalid || !this.solicitud() || !user) return;

    const entrada = this.asignarForm.value.usuarioAsignado || '';
    const usuarioAsignado = this.resolverUsernameAsignable(entrada);
    if (!usuarioAsignado) {
      this.errorAsignacion.set('Selecciona un usuario válido por nombre o username');
      return;
    }

    this.errorAsignacion.set(null);
    
    this.isSubmitting = true;
    const req: AsignarUsuarioRequest = {
      usuarioAsignado
    };
    
    this.workflowService.asignarUsuario(this.solicitud()!.id!, req).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.datos) {
          this.solicitud.set(res.datos as SolicitudResponse);
          this.asignarForm.reset();
          this.errorAsignacion.set(null);
        }
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorAsignacion.set('No se pudo asignar el usuario seleccionado');
        console.error(err);
      }
    });
  }

  solicitarConfirmacionReasignacion() {
    const user = this.authService.currentUser();
    const solicitud = this.solicitud();
    if (this.reasignarForm.invalid || !solicitud || !user) {
      return;
    }

    const desde = solicitud.departamentoActual || 'SIN_DEPARTAMENTO';
    const hacia = (this.reasignarForm.value.nuevoDepartamento || '').trim();

    if (!hacia) {
      this.errorReasignacion.set('Selecciona un departamento de destino valido');
      return;
    }

    if (desde.toLowerCase() === hacia.toLowerCase()) {
      this.errorReasignacion.set('Debes seleccionar un departamento distinto al actual');
      return;
    }

    this.errorReasignacion.set(null);
    this.resumenReasignacion.set({
      desde,
      hacia,
      comentario: (this.reasignarForm.value.comentario || '').trim() || undefined
    });
    this.modalConfirmacionReasignacion.set(true);
  }

  cancelarConfirmacionReasignacion() {
    this.modalConfirmacionReasignacion.set(false);
    this.resumenReasignacion.set(null);
  }

  confirmarReasignacion() {
    const user = this.authService.currentUser();
    const solicitud = this.solicitud();
    const resumen = this.resumenReasignacion();

    if (!user || !solicitud || !resumen) {
      return;
    }

    this.errorReasignacion.set(null);
    this.isSubmitting = true;

    const req: ReasignarDepartamentoRequest = {
      nuevoDepartamento: resumen.hacia,
      comentario: resumen.comentario
    };

    this.workflowService.reasignarDepartamento(solicitud.id!, req).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.modalConfirmacionReasignacion.set(false);
        this.resumenReasignacion.set(null);

        if (res.datos) {
          const actualizada = res.datos as SolicitudResponse;
          this.solicitud.set(actualizada);
          this.reasignarForm.patchValue({
            nuevoDepartamento: actualizada.departamentoActual || this.departamentosCatalogo()[0] || 'Sistemas',
            comentario: ''
          });

          if (actualizada.id) {
            this.cargarRecomendacion(actualizada.id);
          }
        }
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.modalConfirmacionReasignacion.set(false);
        this.resumenReasignacion.set(null);
        this.errorReasignacion.set('No se pudo completar la transferencia de departamento');
        console.error(err);
      }
    });
  }

  esEventoTransferencia(evento: EventoHistorialView): boolean {
    const comentario = (evento.comentario || '').toLowerCase();
    return (
      comentario.includes('reasignado de')
      || comentario.includes('reasignacion')
      || comentario.includes('transfer')
    );
  }

  etiquetaEventoHistorial(evento: EventoHistorialView): 'TRANSFERENCIA' | 'CAMBIO_ESTADO' | 'ACTUALIZACION' {
    if (this.esEventoTransferencia(evento)) {
      return 'TRANSFERENCIA';
    }

    if (evento.estadoAnterior && evento.estadoNuevo && evento.estadoAnterior !== evento.estadoNuevo) {
      return 'CAMBIO_ESTADO';
    }

    return 'ACTUALIZACION';
  }

  formatoUsuarioAsignable(usuario: AdminUser): string {
    return `${usuario.nombreCompleto} (${usuario.username})`;
  }

  private cargarUsuariosAsignables() {
    const user = this.authService.currentUser();
    if (!user || user.rol !== 'ADMINISTRADOR') {
      this.usuariosAsignables.set([]);
      return;
    }

    this.adminUsersService.listarUsuarios().subscribe({
      next: (usuarios) => {
        this.usuariosAsignables.set(usuarios);
      },
      error: () => {
        this.usuariosAsignables.set([]);
      }
    });
  }

  private resolverUsernameAsignable(entradaRaw: string): string | null {
    const entrada = (entradaRaw || '').trim();
    if (!entrada) {
      return null;
    }

    const usuarios = this.usuariosAsignables();
    if (usuarios.length === 0) {
      return entrada;
    }

    const porUsername = usuarios.find(
      (usuario) => usuario.username.toLowerCase() === entrada.toLowerCase()
    );
    if (porUsername) {
      return porUsername.username;
    }

    const usernameEnParentesis = entrada.match(/\(([^)]+)\)\s*$/)?.[1]?.trim();
    if (usernameEnParentesis) {
      const usuario = usuarios.find(
        (item) => item.username.toLowerCase() === usernameEnParentesis.toLowerCase()
      );
      return usuario?.username || usernameEnParentesis;
    }

    const coincidenciasNombre = usuarios.filter(
      (usuario) => usuario.nombreCompleto.toLowerCase() === entrada.toLowerCase()
    );

    if (coincidenciasNombre.length === 1) {
      return coincidenciasNombre[0].username;
    }

    return null;
  }

  /** Format minutes remaining into human readable */
  formatMinutos(minutos: number): string {
    if (minutos < 60) return `${minutos}m`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas < 24) return `${horas}h ${mins}m`;
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;
    return `${dias}d ${horasRestantes}h`;
  }

  /** Format file size for display */
  formatFileSize(bytes: number | undefined | null): string {
    if (bytes === null || bytes === undefined) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** Get file type label from MIME type */
  getFileTypeLabel(type: string | undefined | null): string {
    if (!type) return 'FILE';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('image')) return 'IMG';
    if (type.includes('word') || type.includes('document')) return 'DOC';
    if (type.includes('sheet') || type.includes('excel')) return 'XLS';
    return 'TXT';
  }

  cargarDefinicionesBpm() {
    this.workflowSupportService.listarWorkflowDefinitions().subscribe({
      next: (defs) => {
        this.workflowDefinitions.set(defs);
        if (defs.length > 0) {
          this.selectedWorkflowKey.set(defs[0].key);
        }
      },
      error: (err: any) => console.error('Error loading BPMN definitions', err)
    });
  }

  iniciarProcesoBpm() {
    const s = this.solicitud();
    const key = this.selectedWorkflowKey();
    if (!s || !key) return;

    this.isSubmitting = true;
    
    this.workflowSupportService.obtenerWorkflowDefinition(key).subscribe({
      next: (def) => {
        if (!def || !def.xml) {
          this.isSubmitting = false;
          console.error('Invalid BPMN xml content');
          return;
        }

        let firstTaskId = 'Activity_Inicio';
        let firstTaskName = 'Inicio';
        
        const xml = def.xml;
        const matchUserTask = xml.match(/<bpmn:userTask\s+id="([^"]+)"(?:\s+name="([^"]+)")?/i) || 
                              xml.match(/<bpmn2?:userTask\s+id="([^"]+)"(?:\s+name="([^"]+)")?/i) ||
                              xml.match(/<bpmn:task\s+id="([^"]+)"(?:\s+name="([^"]+)")?/i);
        
        if (matchUserTask) {
          firstTaskId = matchUserTask[1];
          firstTaskName = matchUserTask[2] || firstTaskId;
        }

        this.workflowSupportService.asociarProcesoBpm(s.id!, key, firstTaskId, firstTaskName).subscribe({
          next: (res) => {
            this.isSubmitting = false;
            this.solicitud.set(res);
            
            this.vincularTicketAlDiagramaXml(def, s.codigoSeguimiento!, firstTaskId);
          },
          error: (err: any) => {
            this.isSubmitting = false;
            console.log('Error in BPMN process association (or backend completed stage):', err);
          }
        });
      },
      error: (err: any) => {
        this.isSubmitting = false;
        console.error('Error fetching BPMN definition metadata', err);
      }
    });
  }

  private vincularTicketAlDiagramaXml(def: any, ticketCode: string, taskId: string) {
    try {
      let xml = def.xml;
      
      const tagRegex = new RegExp(`(<bpmn[2]?:(?:userTask|task)[^>]*id="${taskId}"[^>]*)(>)`, 'i');
      const match = xml.match(tagRegex);
      if (match) {
        let tagContent = match[1];
        
        const solicitudesMatch = tagContent.match(/wf:solicitudes="([^"]*)"/i);
        if (solicitudesMatch) {
          const currentList = solicitudesMatch[1] ? solicitudesMatch[1].split(',') : [];
          if (!currentList.includes(ticketCode)) {
            currentList.push(ticketCode);
          }
          tagContent = tagContent.replace(/wf:solicitudes="[^"]*"/i, `wf:solicitudes="${currentList.join(',')}"`);
        } else {
          if (!tagContent.includes('wf:solicitudes')) {
            tagContent += ` wf:solicitudes="${ticketCode}"`;
          }
        }
        
        xml = xml.replace(tagRegex, `${tagContent}>`);
        
        def.xml = xml;
        const user = this.authService.currentUser()?.username || 'anonimo';
        const depto = this.solicitud()?.departamentoActual || '';
        this.workflowSupportService.guardarWorkflowDefinition(def, user, depto).subscribe({
          next: () => console.log('Diagram XML successfully synced with ticket assignment!'),
          error: (err: any) => console.error('Error syncing updated Diagram XML', err)
        });
      }
    } catch (err) {
      console.warn('Error parsing or patching diagram XML for ticket auto-assignment', err);
    }
  }

  reiniciarEntornoDePruebas() {
    if (confirm('¿Estás seguro de que deseas reiniciar la base de datos de pruebas? Esto eliminará todos los tickets actuales y recreará el conjunto de pruebas de compras maestro.')) {
      this.isSubmitting = true;
      this.workflowSupportService.resetSeed().subscribe({
        next: () => {
          this.isSubmitting = false;
          alert('¡Base de datos reseteada y sembrada con éxito! Redirigiendo al dashboard...');
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.isSubmitting = false;
          console.error('Error al reiniciar base de datos', err);
          alert('Hubo un error al reiniciar la base de datos de pruebas. Revisa la consola.');
        }
      });
    }
  }

  cargarDocumentosAdjuntos(solicitudId: string) {
    this.loadingDocs.set(true);
    this.docService.listarPorSolicitud(solicitudId).subscribe({
      next: (docs) => {
        this.ticketDocs.set(docs);
        this.loadingDocs.set(false);
      },
      error: (err) => {
        console.error('Error al cargar documentos adjuntos', err);
        this.loadingDocs.set(false);
      }
    });
  }

  abrirModalCrearDoc() {
    this.crearDocForm.reset();
    this.crearDocForm.patchValue({ contenidoInicial: '' });
    this.selectedDocFile = null;
    this.tipoCreacionDoc.set('FILE');
    this.modalCrearDoc.set(true);
  }

  cerrarModalCrearDoc() {
    this.modalCrearDoc.set(false);
  }

  setTipoCreacionDoc(tipo: 'FILE' | 'COLLABORATIVE') {
    this.tipoCreacionDoc.set(tipo);
  }

  onDocFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedDocFile = file;
    }
  }

  crearDocumentoExpediente() {
    const s = this.solicitud();
    if (!s || this.crearDocForm.invalid) return;

    this.submittingDoc.set(true);
    const { nombre, descripcion, contenidoInicial } = this.crearDocForm.value;

    if (this.tipoCreacionDoc() === 'FILE') {
      if (!this.selectedDocFile) {
        this.submittingDoc.set(false);
        alert('Por favor selecciona un archivo físico para cargar.');
        return;
      }
      this.docService.crearDocumentoArchivo(s.id!, nombre!, descripcion || '', this.selectedDocFile).subscribe({
        next: () => {
          this.submittingDoc.set(false);
          this.modalCrearDoc.set(false);
          this.cargarDocumentosAdjuntos(s.id!);
        },
        error: (err) => {
          this.submittingDoc.set(false);
          alert('Error al subir el archivo: ' + err.message);
        }
      });
    } else {
      this.docService.crearDocumentoColaborativo(s.id!, nombre!, descripcion || '', contenidoInicial || '').subscribe({
        next: () => {
          this.submittingDoc.set(false);
          this.modalCrearDoc.set(false);
          this.cargarDocumentosAdjuntos(s.id!);
        },
        error: (err) => {
          this.submittingDoc.set(false);
          alert('Error al crear documento colaborativo: ' + err.message);
        }
      });
    }
  }

  eliminarDocumentoAdjunto(docId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este documento del expediente?')) return;

    const s = this.solicitud();
    this.docService.eliminarDocumento(docId).subscribe({
      next: () => {
        if (s) this.cargarDocumentosAdjuntos(s.id!);
      },
      error: (err) => {
        alert('Error al eliminar el documento: ' + err.message);
      }
    });
  }

  descargarArchivo(nombreAlmacenado: string | undefined | null) {
    if (!nombreAlmacenado) return;
    window.open(this.docService.archivoUrl(nombreAlmacenado, true), '_blank');
  }

  editarOnline(doc: Documento) {
    window.open(`/documentos/editar/${doc.id}`, '_blank');
  }
}

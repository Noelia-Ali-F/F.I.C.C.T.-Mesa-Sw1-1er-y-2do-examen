import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { WorkflowDepartamentalService } from '../../api/api/workflowDepartamental.service';
import { CrearSolicitudRequest } from '../../api/model/crearSolicitudRequest';
import { AuthService } from '../../auth/auth.service';
import { WorkflowSupportService } from '../../workflow/workflow-support.service';
import { DocumentoService, Documento } from '../../workflow/documento.service';
import { AdminDepartamentosService, Departamento } from '../../admin/admin-departamentos.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BASE_PATH } from '../../api/variables';
import { MatIconModule } from '@angular/material/icon';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-crear-solicitud',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, CommonModule, MatIconModule, PageHeaderComponent],
  templateUrl: './crear-solicitud.component.html',
  styleUrl: './crear-solicitud.component.css'
})
export class CrearSolicitudComponent implements OnInit {
  private fb = inject(FormBuilder);
  private workflowService = inject(WorkflowDepartamentalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private workflowSupportService = inject(WorkflowSupportService);
  private docService = inject(DocumentoService);
  private deptService = inject(AdminDepartamentosService);
  private http = inject(HttpClient);
  private basePath = inject(BASE_PATH);

  // Department catalog from backend
  departamentos = signal<Departamento[]>([]);
  departamentosCatalogo: string[] = [];
  loadingDepts = signal(true);
  submitError = '';
  recomendandoPolitica = signal(false);
  recomendacionPolitica = signal<any | null>(null);
  politicaConfirmada = signal<string | null>(null);

  // Step state for multi-step form
  currentStep = signal<number>(1);
  totalSteps = 3;

  /** SLA hours by priority */
  readonly SLA_HORAS: Record<string, number> = {
    URGENTE: 4,
    ALTA: 8,
    MEDIA: 24,
    BAJA: 72
  };

  readonly PRIORITY_CONFIG: Record<string, { icon: string; color: string; bgColor: string; label: string; description: string }> = {
    BAJA: { icon: 'schedule', color: 'var(--theme-slate-500)', bgColor: 'var(--theme-surface-hover-color)', label: 'Baja', description: 'Resolución en 3 días hábiles' },
    MEDIA: { icon: 'trending_flat', color: 'var(--theme-primary-color)', bgColor: 'var(--theme-primary-light-color)', label: 'Media', description: 'Resolución en 1 día hábil' },
    ALTA: { icon: 'priority_high', color: '#ea580c', bgColor: '#fff7ed', label: 'Alta', description: 'Resolución en 8 horas' },
    URGENTE: { icon: 'warning', color: '#dc2626', bgColor: '#fef2f2', label: 'Urgente', description: 'Resolución en 4 horas' }
  };

  form = this.fb.nonNullable.group({
    titulo: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]),
    descripcion: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]),
    prioridad: this.fb.nonNullable.control('MEDIA' as CrearSolicitudRequest.PrioridadEnum, Validators.required),
    departamentoDestino: this.fb.nonNullable.control('', Validators.required)
  });

  isSubmitting = false;
  showSuccessOverlay = signal(false);
  createdSolicitudId = signal<string | null>(null);

  /** File upload state */
  archivosSeleccionados = signal<File[]>([]);
  errorArchivo = signal<string | null>(null);
  isDragging = signal(false);

  readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  readonly TIPOS_PERMITIDOS = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  totalSize = computed(() =>
    this.archivosSeleccionados().reduce((sum, f) => sum + f.size, 0)
  );

  /** SLA preview based on selected priority */
  slaPreview = signal<{ horas: number; fechaLimite: Date; etiqueta: string }>({
    horas: 24,
    fechaLimite: new Date(Date.now() + 24 * 3600 * 1000),
    etiqueta: '1 día'
  });

  /** Selected department info */
  selectedDept = computed(() => {
    const deptName = this.form.controls.departamentoDestino.value;
    return this.departamentos().find(d => d.nombre === deptName) || null;
  });

  /** Completeness percentage for the progress indicator */
  formCompleteness = computed(() => {
    let total = 0;
    if (this.form.controls.titulo.value.trim().length >= 5) total += 30;
    if (this.form.controls.descripcion.value.trim().length >= 10) total += 30;
    if (this.form.controls.departamentoDestino.value) total += 20;
    if (this.form.controls.prioridad.value) total += 20;
    return total;
  });

  ngOnInit() {
    this.cargarDepartamentos();

    // Check for depto query param to pre-select
    this.route.queryParams.subscribe(params => {
      const depto = params['depto'];
      if (depto) {
        this.form.patchValue({ departamentoDestino: depto });
      }
    });

    // Actualizar preview de SLA reactivamente cuando cambia la prioridad
    this.form.controls.prioridad.valueChanges.subscribe((prioridad) => {
      const horas = this.SLA_HORAS[prioridad] ?? 24;
      const limite = new Date(Date.now() + horas * 3600 * 1000);
      this.slaPreview.set({
        horas,
        fechaLimite: limite,
        etiqueta: this.formatearFechaRelativa(horas)
      });
    });
    
    // Disparar valor inicial
    const valInicial = this.form.controls.prioridad.value;
    this.form.controls.prioridad.setValue(valInicial, { emitEvent: true });
  }

  private cargarDepartamentos() {
    this.loadingDepts.set(true);
    // Load full department objects from admin service
    this.deptService.listarDepartamentos().subscribe({
      next: (data) => {
        const activos = data.filter(d => d.activo);
        this.departamentos.set(activos);
        this.departamentosCatalogo = activos.map(d => d.nombre);
        this.loadingDepts.set(false);
        this.sincronizarDepartamentoPredeterminado();
      },
      error: () => {
        // Fallback to catalog endpoint
        this.workflowSupportService.obtenerCatalogoDepartamentos().subscribe({
          next: (catalogo) => {
            this.departamentosCatalogo = catalogo.length > 0 ? catalogo : ['Sistemas', 'Ventas', 'Recursos Humanos'];
            this.loadingDepts.set(false);
            this.sincronizarDepartamentoPredeterminado();
          },
          error: () => {
            this.departamentosCatalogo = ['Sistemas', 'Ventas', 'Recursos Humanos'];
            this.loadingDepts.set(false);
            this.sincronizarDepartamentoPredeterminado();
          }
        });
      }
    });
  }

  private sincronizarDepartamentoPredeterminado() {
    const user = this.authService.currentUser();
    const catalogo = this.departamentosCatalogo;
    const sugerido = user && catalogo.includes(user.departamento)
      ? user.departamento
      : catalogo[0];
    this.form.patchValue({ departamentoDestino: sugerido || 'Sistemas' });
  }

  // Step navigation
  nextStep() {
    if (this.currentStep() === 1 && !this.recomendacionPolitica()) {
      this.solicitarRecomendacionPolitica();
      return;
    }
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.set(this.currentStep() + 1);
    }
  }

  prevStep() {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
    }
  }

  canProceedStep1(): boolean {
    return this.form.controls.titulo.valid && this.form.controls.descripcion.valid;
  }

  canProceedStep2(): boolean {
    return this.form.controls.departamentoDestino.valid && this.form.controls.prioridad.valid && !!this.politicaConfirmada();
  }

  solicitarRecomendacionPolitica() {
    if (!this.canProceedStep1()) return;
    this.recomendandoPolitica.set(true);
    this.http.post<any>(`${this.basePath}/api/v1/bpmn/definitions/recomendar`, {
      descripcion: `${this.form.controls.titulo.value}. ${this.form.controls.descripcion.value}`
    }).subscribe({
      next: response => {
        const recommendation = response.datos;
        this.recomendacionPolitica.set(recommendation);
        if (!recommendation?.requiereSeleccionManual && recommendation?.recomendada?.key) {
          this.politicaConfirmada.set(recommendation.recomendada.key);
        }
        this.recomendandoPolitica.set(false);
        this.currentStep.set(2);
      },
      error: err => {
        this.recomendandoPolitica.set(false);
        this.submitError = this.extraerMensajeError(err);
      }
    });
  }

  opcionesPolitica(): any[] {
    const recommendation = this.recomendacionPolitica();
    return recommendation ? [recommendation.recomendada, ...(recommendation.alternativas || [])].filter(Boolean) : [];
  }

  seleccionarPolitica(key: string) {
    this.politicaConfirmada.set(key);
  }

  // Drag and drop handlers
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    
    if (event.dataTransfer?.files) {
      this.processFiles(Array.from(event.dataTransfer.files));
    }
  }

  /** Handle file input change */
  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.processFiles(Array.from(input.files));
    input.value = ''; // Reset input
  }

  private processFiles(files: File[]) {
    this.errorArchivo.set(null);
    const actuales = this.archivosSeleccionados();

    for (const archivo of files) {
      if (archivo.size > this.MAX_FILE_SIZE) {
        this.errorArchivo.set(`"${archivo.name}" excede el límite de 10MB`);
        return;
      }
      if (!this.TIPOS_PERMITIDOS.includes(archivo.type)) {
        this.errorArchivo.set(`"${archivo.name}" no es un tipo permitido. Usa PDF, imágenes, Word, Excel o texto.`);
        return;
      }
    }

    this.archivosSeleccionados.set([...actuales, ...files]);
  }

  /** Remove a file from the selection */
  removeFile(index: number) {
    const current = this.archivosSeleccionados();
    this.archivosSeleccionados.set(current.filter((_, i) => i !== index));
    this.errorArchivo.set(null);
  }

  /** Format file size for display */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** Get file type icon label */
  getFileTypeLabel(type: string): string {
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('image')) return 'IMG';
    if (type.includes('word') || type.includes('document')) return 'DOC';
    if (type.includes('sheet') || type.includes('excel')) return 'XLS';
    return 'TXT';
  }

  getFileTypeColor(type: string): string {
    if (type.includes('pdf')) return '#dc2626';
    if (type.includes('image')) return '#7c3aed';
    if (type.includes('word') || type.includes('document')) return '#2563eb';
    if (type.includes('sheet') || type.includes('excel')) return '#16a34a';
    return '#64748b';
  }

  private formatearFechaRelativa(horas: number): string {
    if (horas < 24) return `${horas} horas`;
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;
    if (horasRestantes === 0) return `${dias} día${dias > 1 ? 's' : ''}`;
    return `${dias}d ${horasRestantes}h`;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError = '';
    this.isSubmitting = true;
    const raw = this.form.getRawValue();
    const archivos = this.archivosSeleccionados();

    if (archivos.length > 0) {
      this.enviarConArchivos(raw, archivos);
    } else {
      this.enviarSinArchivos(raw);
    }
  }

  private enviarSinArchivos(raw: { titulo: string; descripcion: string; prioridad: CrearSolicitudRequest.PrioridadEnum; departamentoDestino: string }) {
    const request: CrearSolicitudRequest = {
      titulo: raw.titulo.trim(),
      descripcion: raw.descripcion.trim(),
      prioridad: raw.prioridad,
      departamentoDestino: raw.departamentoDestino
      ,workflowDefinitionId: this.politicaConfirmada() || undefined
    };

    this.workflowService.crearSolicitud(request).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.datos?.id) {
          this.createdSolicitudId.set(res.datos.id);
          this.showSuccessOverlay.set(true);
          return;
        }
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = this.extraerMensajeError(err);
      }
    });
  }

  private enviarConArchivos(raw: { titulo: string; descripcion: string; prioridad: CrearSolicitudRequest.PrioridadEnum; departamentoDestino: string }, archivos: File[]) {
    const user = this.authService.currentUser();
    if (!user) return;

    const formData = new FormData();

    const solicitudJson = JSON.stringify({
      titulo: raw.titulo.trim(),
      descripcion: raw.descripcion.trim(),
      prioridad: raw.prioridad,
      departamentoDestino: raw.departamentoDestino
      ,workflowDefinitionId: this.politicaConfirmada() || undefined
    });
    formData.append('solicitud', new Blob([solicitudJson], { type: 'application/json' }));

    for (const archivo of archivos) {
      formData.append('archivos', archivo);
    }

    const headers = new HttpHeaders({
      'X-Usuario': user.username,
      'X-Rol': user.rol,
      'X-Departamento': user.departamento
    });

    const url = `${this.basePath}/api/v1/workflows/con-archivos`;
    this.http.post<any>(url, formData, { headers }).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.datos?.id) {
          this.createdSolicitudId.set(res.datos.id);
          this.showSuccessOverlay.set(true);
          return;
        }
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = this.extraerMensajeError(err);
      }
    });
  }

  navigateToDetail() {
    const id = this.createdSolicitudId();
    if (id) {
      this.router.navigate(['/detalle', id]);
    }
  }

  navigateToDocuments() {
    this.router.navigate(['/documentos']);
  }

  navigateToWorkspace() {
    this.router.navigate(['/bpmn-workspace']);
  }

  private extraerMensajeError(err: unknown): string {
    const fallback = 'No se pudo crear la solicitud. Revisa los datos e intenta nuevamente.';
    if (!err || typeof err !== 'object') return fallback;

    const candidato = err as {
      error?: { mensaje?: string; errores?: Record<string, string[]> };
      message?: string;
    };

    if (candidato.error?.mensaje) return candidato.error.mensaje;
    if (candidato.error?.errores) {
      const firstKey = Object.keys(candidato.error.errores)[0];
      if (firstKey && candidato.error.errores[firstKey]?.length) {
        return candidato.error.errores[firstKey][0];
      }
    }
    if (candidato.message) return candidato.message;
    return fallback;
  }
}

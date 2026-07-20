import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DocumentoService, Documento } from '../../workflow/documento.service';
import { AuthService } from '../../auth/auth.service';
import { BASE_PATH } from '../../api/variables';
import { WorkflowDepartamentalService } from '../../api/api/workflowDepartamental.service';
import { SolicitudResponse } from '../../api/model/solicitudResponse';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-gestion-documental',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, MatIconModule, PageHeaderComponent],
  templateUrl: './gestion-documental.component.html',
  styleUrl: './gestion-documental.component.css'
})
export class GestionDocumentalComponent implements OnInit {
  private docService = inject(DocumentoService);
  private workflowService = inject(WorkflowDepartamentalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  authService = inject(AuthService);
  basePath = inject(BASE_PATH);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);

  // States
  documentos = signal<Documento[]>([]);
  solicitudes = signal<SolicitudResponse[]>([]);
  cargando = signal(true);
  seleccionado = signal<Documento | null>(null);
  submitting = signal(false);

  // Filters
  searchQuery = '';
  filtroTipo = 'TODOS';
  filtroOrden = 'RECIENTE';

  // Modals / Fullscreen Views
  modalCrear = signal(false);
  modalNuevaVersion = signal(false);
  modalSnapshot = signal(false);
  modalTrazabilidad = signal(false);
  modalContenido = signal(false);
  modalAsociar = signal(false);
  solicitudDestinoId = signal('');
  editorActivo = signal(false);
  visorActivo = signal(false);
  mostrarGuiaNegocio = signal(false);

  // Forms
  tipoCreacion = signal<'FILE' | 'COLLABORATIVE' | 'SPREADSHEET'>('FILE');
  
  crearForm = this.fb.group({
    solicitudId: ['', [Validators.required]],
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: ['', [Validators.maxLength(250)]],
    contenidoInicial: ['']
  });

  versionForm = this.fb.group({
    comentario: ['', [Validators.required, Validators.maxLength(150)]]
  });

  selectedFile: File | null = null;
  contenidoEditor = '';
  comentarioSnapshot = '';

  documentosFiltrados = computed(() => {
    let list = [...this.documentos()];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(d => d.nombre.toLowerCase().includes(q) || (d.descripcion && d.descripcion.toLowerCase().includes(q)));
    }

    if (this.filtroTipo === 'BLOQUEADOS') {
      list = list.filter(d => d.bloqueadoPor);
    } else if (this.filtroTipo !== 'TODOS') {
      list = list.filter(d => d.tipo === this.filtroTipo);
    }

    if (this.filtroOrden === 'ALFABETICO') {
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else if (this.filtroOrden === 'VERSION') {
      list.sort((a, b) => b.versionActual - a.versionActual);
    } else {
      list.sort((a, b) => new Date(b.fechaActualizacion).getTime() - new Date(a.fechaActualizacion).getTime());
    }

    return list;
  });

  documentosFisicosCount = computed(() => this.documentos().filter(d => d.tipo === 'FILE').length);
  documentosOnlineCount = computed(() => this.documentos().filter(d => d.tipo === 'COLLABORATIVE').length);
  documentosBloqueadosCount = computed(() => this.documentos().filter(d => d.bloqueadoPor).length);

  ngOnInit() {
    this.cargarDocumentos();
    this.cargarSolicitudes();

    this.route.queryParams.subscribe(params => {
      if (params['upload'] === 'true') {
        this.abrirModalCrear();
        
        // Remove the query param so refreshing doesn't keep opening it
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { upload: null },
          queryParamsHandling: 'merge'
        });
      }
    });
  }

  irADetalle(solicitudId: string, event: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.router.navigate(['/detalle', solicitudId]);
  }

  cargarDocumentos() {
    this.cargando.set(true);
    this.docService.listarTodos().subscribe({
      next: (data) => {
        this.documentos.set(data);
        this.cargando.set(false);
        const current = this.seleccionado();
        if (current) {
          const updated = data.find(d => d.id === current.id);
          if (updated) this.seleccionado.set(updated);
        }
      },
      error: () => this.cargando.set(false)
    });
  }

  cargarSolicitudes() {
    const user = this.authService.currentUser();
    if (!user) return;

    const request$ = user.rol === 'SOLICITANTE'
      ? this.workflowService.listarPorUsuario(user.username)
      : this.workflowService.listarTodas();

    request$.subscribe({
      next: (res) => {
        this.solicitudes.set(res.datos || []);
      }
    });
  }

  aplicarFiltro() {
    // Trigger recompute of documentosFiltrados by touching signals
    this.documentos.set([...this.documentos()]);
  }

  buscar() {
    if (!this.searchQuery.trim()) {
      this.cargarDocumentos();
      return;
    }
    this.docService.buscarDocumentos(this.searchQuery).subscribe({
      next: (data) => this.documentos.set(data)
    });
  }

  seleccionarDocumento(doc: Documento) {
    this.seleccionado.set(doc);
  }

  abrirModalCrear() {
    this.crearForm.reset();
    this.crearForm.patchValue({ contenidoInicial: '', solicitudId: '' });
    this.selectedFile = null;
    this.tipoCreacion.set('FILE');
    this.modalCrear.set(true);
  }

  cerrarModalCrear() {
    this.modalCrear.set(false);
  }

  setTipoCreacion(tipo: 'FILE' | 'COLLABORATIVE' | 'SPREADSHEET') {
    this.tipoCreacion.set(tipo);
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  crearDocumento() {
    if (this.crearForm.invalid) return;
    const { solicitudId, nombre, descripcion, contenidoInicial } = this.crearForm.value;
    
    this.submitting.set(true);
    
    if (this.tipoCreacion() === 'FILE') {
      if (!this.selectedFile) {
        this.submitting.set(false);
        return;
      }
      this.docService.crearDocumentoArchivo(solicitudId!, nombre!, descripcion || '', this.selectedFile).subscribe({
        next: (doc) => {
          this.submitting.set(false);
          this.modalCrear.set(false);
          this.seleccionado.set(doc);
          this.cargarDocumentos();
        },
        error: () => this.submitting.set(false)
      });
    } else {
      const spreadsheet = this.tipoCreacion() === 'SPREADSHEET';
      const initialContent = spreadsheet
        ? JSON.stringify({ kind: 'jspreadsheet-v1', data: Array.from({ length: 15 }, () => Array(8).fill('')), columns: Array.from({ length: 8 }, (_, i) => ({ type: 'text', title: String.fromCharCode(65 + i), width: 120 })) })
        : (contenidoInicial || '');
      this.docService.crearDocumentoColaborativo(solicitudId!, nombre!, descripcion || '', initialContent,
        { formato: spreadsheet ? 'SPREADSHEET' : 'TEXT' }).subscribe({
        next: (doc) => {
          this.submitting.set(false);
          this.modalCrear.set(false);
          this.seleccionado.set(doc);
          this.cargarDocumentos();
        },
        error: () => this.submitting.set(false)
      });
    }
  }

  editarOnline(doc: Documento) {
    window.open(`/documentos/editar/${doc.id}`, '_blank');
  }

  guardarCambiosColaborativos() {
    const doc = this.seleccionado();
    if (!doc) return;

    this.docService.actualizarContenido(doc.id, this.contenidoEditor).subscribe({
      next: (updated) => {
        this.seleccionado.set(updated);
      },
      error: (err) => console.error(err)
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
    const doc = this.seleccionado();
    if (!doc || !this.comentarioSnapshot.trim()) return;

    this.submitting.set(true);
    this.docService.actualizarContenido(doc.id, this.contenidoEditor).subscribe({
      next: () => {
        this.docService.guardarSnapshot(doc.id, this.comentarioSnapshot).subscribe({
          next: (updated) => {
            this.seleccionado.set(updated);
            this.submitting.set(false);
            this.modalSnapshot.set(false);
            this.editorActivo.set(false);
            this.docService.desbloquearDocumento(doc.id).subscribe({
              next: (unlocked) => {
                this.seleccionado.set(unlocked);
                this.cargarDocumentos();
              }
            });
          },
          error: () => this.submitting.set(false)
        });
      },
      error: () => this.submitting.set(false)
    });
  }

  cerrarEditor() {
    const doc = this.seleccionado();
    if (!doc) return;

    this.docService.desbloquearDocumento(doc.id).subscribe({
      next: (unlocked) => {
        this.seleccionado.set(unlocked);
        this.editorActivo.set(false);
        this.cargarDocumentos();
      },
      error: () => this.editorActivo.set(false)
    });
  }

  desbloquear(id: string) {
    this.docService.desbloquearDocumento(id).subscribe({
      next: (unlocked) => {
        this.seleccionado.set(unlocked);
        this.cargarDocumentos();
      }
    });
  }

  abrirModalNuevaVersion() {
    this.versionForm.reset();
    this.selectedFile = null;
    this.modalNuevaVersion.set(true);
  }

  cerrarModalNuevaVersion() {
    this.modalNuevaVersion.set(false);
  }

  crearNuevaVersion() {
    const doc = this.seleccionado();
    if (this.versionForm.invalid || !this.selectedFile || !doc) return;

    this.submitting.set(true);
    const { comentario } = this.versionForm.value;

    this.docService.subirNuevaVersion(doc.id, this.selectedFile, comentario!).subscribe({
      next: (updated) => {
        this.seleccionado.set(updated);
        this.submitting.set(false);
        this.modalNuevaVersion.set(false);
        this.cargarDocumentos();
      },
      error: () => this.submitting.set(false)
    });
  }

  eliminar(id: string) {
    if (!confirm('¿Estás seguro de eliminar permanentemente este documento y todas sus versiones?')) return;
    this.docService.eliminarDocumento(id).subscribe({
      next: () => {
        this.seleccionado.set(null);
        this.cargarDocumentos();
      }
    });
  }

  abrirVisorLimpio(doc: Documento) {
    this.seleccionado.set(doc);
    this.visorActivo.set(true);
  }

  cerrarVisor() {
    this.visorActivo.set(false);
  }

  esPdf(mimeType: string | undefined | null): boolean {
    if (!mimeType) return false;
    return mimeType.toLowerCase().includes('pdf');
  }

  getPdfUrl(nombreAlmacenado: string | undefined | null): SafeResourceUrl {
    if (!nombreAlmacenado) return '';
    const url = this.docService.archivoUrl(nombreAlmacenado);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  archivoUrl(nombreAlmacenado?: string | null, download = false): string {
    return this.docService.archivoUrl(nombreAlmacenado, download);
  }

  getFileTypeLabel(type: string | undefined | null): string {
    if (!type) return 'FILE';
    const t = type.toLowerCase();
    if (t.includes('pdf')) return 'PDF';
    if (t.includes('image') || t.includes('png') || t.includes('jpeg')) return 'IMG';
    if (t.includes('word') || t.includes('document') || t.includes('docx')) return 'DOC';
    if (t.includes('sheet') || t.includes('excel') || t.includes('xlsx') || t.includes('csv')) return 'XLS';
    return 'TXT';
  }

  abrirModalAsociar() {
    const doc = this.seleccionado();
    if (!doc) return;
    this.solicitudDestinoId.set(doc.solicitudId || '');
    this.modalAsociar.set(true);
  }

  confirmarAsociacion() {
    const doc = this.seleccionado();
    const destId = this.solicitudDestinoId();
    if (!doc || !destId) return;

    this.submitting.set(true);
    this.docService.asociarASolicitud(doc.id, destId).subscribe({
      next: (updated) => {
        this.seleccionado.set(updated);
        this.submitting.set(false);
        this.modalAsociar.set(false);
        this.cargarDocumentos();
      },
      error: () => this.submitting.set(false)
    });
  }

  abrirHistorialTrazabilidad(doc: Documento) {
    this.seleccionado.set(doc);
    this.modalTrazabilidad.set(true);
  }

  cerrarHistorialTrazabilidad() {
    this.modalTrazabilidad.set(false);
  }
}

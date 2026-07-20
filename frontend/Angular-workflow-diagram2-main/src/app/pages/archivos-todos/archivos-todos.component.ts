import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DocumentoService, ArchivoDetallado } from '../../workflow/documento.service';
import { AuthService } from '../../auth/auth.service';
import { BASE_PATH } from '../../api/variables';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-archivos-todos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PageHeaderComponent],
  templateUrl: './archivos-todos.component.html',
  styleUrl: './archivos-todos.component.css'
})
export class ArchivosTodosComponent implements OnInit {
  private docService = inject(DocumentoService);
  private router = inject(Router);
  authService = inject(AuthService);
  basePath = inject(BASE_PATH);

  // States
  archivos = signal<ArchivoDetallado[]>([]);
  cargando = signal(true);
  seleccionado = signal<ArchivoDetallado | null>(null);

  // Filters
  searchQuery = '';
  filtroTipo = 'TODOS';
  filtroOrden = 'RECIENTE';

  ngOnInit() {
    this.cargarArchivos();
  }

  cargarArchivos() {
    this.cargando.set(true);
    this.docService.listarTodosLosArchivos().subscribe({
      next: (data) => {
        this.archivos.set(data);
        this.cargando.set(false);
        
        // Auto-select first file if list is not empty and none is selected
        const current = this.seleccionado();
        if (current) {
          const updated = data.find(a => a.id === current.id || a.nombreAlmacenado === current.nombreAlmacenado);
          if (updated) {
            this.seleccionado.set(updated);
          } else {
            this.seleccionado.set(data.length > 0 ? data[0] : null);
          }
        } else if (data.length > 0) {
          this.seleccionado.set(data[0]);
        }
      },
      error: (err) => {
        console.error('Error al cargar archivos:', err);
        this.cargando.set(false);
      }
    });
  }

  // Helper formatting methods
  getFileTypeLabel(contentType: string, filename: string = ''): string {
    if (!contentType) {
      if (filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext) return ext.toUpperCase();
      }
      return 'FILE';
    }
    
    if (contentType.startsWith('image/')) {
      return contentType.split('/')[1].toUpperCase();
    }
    if (contentType === 'application/pdf') return 'PDF';
    if (contentType.includes('word') || contentType.includes('msword')) return 'DOC';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'XLS';
    if (contentType.includes('text') || contentType === 'text/plain') return 'TXT';
    
    return 'FILE';
  }

  getFileTypeIcon(contentType: string): string {
    if (!contentType) return 'insert_drive_file';
    
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    if (contentType.includes('word') || contentType.includes('msword')) return 'description';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'table_chart';
    if (contentType.includes('text') || contentType === 'text/plain') return 'article';
    
    return 'insert_drive_file';
  }

  getFileSizeFormatted(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  isImage(file: ArchivoDetallado | null): boolean {
    if (!file) return false;
    return !!file.tipoContenido && file.tipoContenido.startsWith('image/');
  }

  isPdf(file: ArchivoDetallado | null): boolean {
    if (!file) return false;
    return file.tipoContenido === 'application/pdf';
  }

  getDownloadUrl(file: ArchivoDetallado): string {
    return this.docService.archivoUrl(file.nombreAlmacenado, true);
  }

  descargarArchivo(file: ArchivoDetallado, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    window.open(this.getDownloadUrl(file), '_blank');
  }

  irAlOrigen(file: ArchivoDetallado, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (file.solicitudId) {
      this.router.navigate(['/detalle', file.solicitudId]);
    }
  }

  seleccionarArchivo(file: ArchivoDetallado) {
    this.seleccionado.set(file);
  }

  // Filter and compute counts
  archivosFiltrados = computed(() => {
    let list = [...this.archivos()];

    // Search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(a => 
        a.nombreOriginal.toLowerCase().includes(q) || 
        a.subidoPor.toLowerCase().includes(q) ||
        (a.origenNombre && a.origenNombre.toLowerCase().includes(q))
      );
    }

    // Category Type Filter
    if (this.filtroTipo === 'IMAGENES') {
      list = list.filter(a => !!a.tipoContenido && a.tipoContenido.startsWith('image/'));
    } else if (this.filtroTipo === 'DOCUMENTOS') {
      list = list.filter(a => 
        a.tipoContenido === 'application/pdf' || 
        a.tipoContenido.includes('word') || 
        a.tipoContenido.includes('msword') || 
        a.tipoContenido.includes('excel') || 
        a.tipoContenido.includes('spreadsheet') ||
        a.nombreOriginal.endsWith('.pdf') ||
        a.nombreOriginal.endsWith('.docx') ||
        a.nombreOriginal.endsWith('.doc') ||
        a.nombreOriginal.endsWith('.xlsx') ||
        a.nombreOriginal.endsWith('.xls')
      );
    } else if (this.filtroTipo === 'OTROS') {
      // not image, not document
      list = list.filter(a => {
        const isImg = !!a.tipoContenido && a.tipoContenido.startsWith('image/');
        const isDoc = a.tipoContenido === 'application/pdf' || 
                      a.tipoContenido.includes('word') || 
                      a.tipoContenido.includes('msword') || 
                      a.tipoContenido.includes('excel') || 
                      a.tipoContenido.includes('spreadsheet') ||
                      a.nombreOriginal.endsWith('.pdf') ||
                      a.nombreOriginal.endsWith('.docx') ||
                      a.nombreOriginal.endsWith('.xlsx');
        return !isImg && !isDoc;
      });
    }

    // Sort Order
    if (this.filtroOrden === 'ALFABETICO') {
      list.sort((a, b) => a.nombreOriginal.localeCompare(b.nombreOriginal));
    } else if (this.filtroOrden === 'TAMANO') {
      list.sort((a, b) => b.tamanoBytes - a.tamanoBytes);
    } else {
      // RECIENTE
      list.sort((a, b) => {
        if (!a.fechaSubida) return 1;
        if (!b.fechaSubida) return -1;
        return new Date(b.fechaSubida).getTime() - new Date(a.fechaSubida).getTime();
      });
    }

    return list;
  });

  // KPI telemetry counts
  totalCount = computed(() => this.archivos().length);

  imagesCount = computed(() => 
    this.archivos().filter(a => !!a.tipoContenido && a.tipoContenido.startsWith('image/')).length
  );

  pdfCount = computed(() => 
    this.archivos().filter(a => 
      a.tipoContenido === 'application/pdf' || 
      a.tipoContenido.includes('word') || 
      a.tipoContenido.includes('msword') || 
      a.tipoContenido.includes('excel') || 
      a.tipoContenido.includes('spreadsheet') ||
      a.nombreOriginal.endsWith('.pdf') ||
      a.nombreOriginal.endsWith('.docx') ||
      a.nombreOriginal.endsWith('.xlsx')
    ).length
  );

  otrosCount = computed(() => 
    this.totalCount() - this.imagesCount() - this.pdfCount()
  );
}

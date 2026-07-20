import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDepartamentosService, Departamento } from '../../admin/admin-departamentos.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PageSectionComponent } from '../../shared/components/page-section/page-section.component';

@Component({
  selector: 'app-admin-departamentos',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, PageSectionComponent],
  template: `
    <div class="wf-page wf-view-body wf-animate-in space-y-6">
      
      <!-- Unified Page Header -->
      <app-page-header
        title="Consola de Departamentos"
        subtitle="Gestión de Áreas, Flujos y Colas de Trabajo"
        eyebrow="Administración Central"
        icon="domain"
      >
        <button (click)="abrirModalCrear()" class="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm hover:shadow transition-all duration-200 cursor-pointer">
          <svg class="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Crear Departamento
        </button>
      </app-page-header>

      <div class="grid grid-cols-1 gap-8">

        @if (showModal()) {
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" (click)="cancelarEdicion()"></div>
            <div class="wf-card w-full max-w-md p-6 relative z-10 wf-animate-scale shadow-2xl bg-white">
              <div class="wf-section-header">
                <div class="wf-section-icon" [style.background]="editingId() ? 'linear-gradient(135deg, #0d9488, #f59e0b)' : 'var(--wf-gradient-primary)'">
                    {{ editingId() ? 'ED' : 'NU' }}
                </div>
                <h3 class="wf-section-title flex-1">{{ editingId() ? 'Editar departamento' : 'Crear departamento' }}</h3>
                <button type="button" (click)="cancelarEdicion()" class="text-slate-400 hover:text-slate-600 p-1">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-5">
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold text-slate-600">Nombre</label>
                  <input
                    type="text"
                    formControlName="nombre"
                    class="wf-input"
                    placeholder="Ej: Recursos Humanos"
                  />
                  @if (form.controls.nombre.invalid && form.controls.nombre.touched) {
                    <span class="text-xs text-red-500 font-medium">Nombre requerido (mín. 2 caracteres)</span>
                  }
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold text-slate-600">
                    Descripción <span class="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    formControlName="descripcion"
                    rows="3"
                    class="wf-input resize-none"
                    placeholder="Descripción del departamento..."
                  ></textarea>
                </div>

                @if (mensajeError()) {
                  <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 flex items-center gap-2">
                    <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                    {{ mensajeError() }}
                  </div>
                }

                <div class="flex gap-2 pt-1 mt-2">
                  <button
                    type="submit"
                    [disabled]="form.invalid || isSaving()"
                    class="wf-btn-primary flex-1"
                    [style.background]="editingId() ? 'linear-gradient(135deg, #0d9488, #f59e0b)' : ''"
                  >
                    @if (isSaving()) {
                      <span class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Guardando...
                    } @else {
                      {{ editingId() ? 'Actualizar' : 'Crear departamento' }}
                    }
                  </button>
                  
                  <button
                    type="button"
                    (click)="cancelarEdicion()"
                    class="wf-btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </form>

              <!-- Info box -->
              <div class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p class="text-xs text-amber-800 leading-relaxed flex items-start gap-2">
                  <svg class="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  <span><strong>Eliminación inteligente:</strong> Si un departamento tiene tareas, se
                  <strong>desactiva</strong> (sus datos se conservan). Sin tareas, se elimina permanentemente.</span>
                </p>
              </div>
            </div>
          </div>
        }

        <!-- Departments Table -->
        <app-page-section
          title="Registro de Departamentos"
          subtitle="Solo administradores"
          icon="table_chart"
        >
          <!-- Action feedback banner -->
          @if (actionMessage()) {
            <div
              class="px-5 py-3 text-sm font-medium flex items-center gap-2 border border-amber-200 bg-amber-50 text-amber-800 rounded-xl mb-4"
              [class]="actionMessage()!.tipo === 'DESACTIVADO'
                ? 'border-amber-100 bg-amber-50 text-amber-800'
                : actionMessage()!.tipo === 'ELIMINADO'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                  : 'border-amber-100 bg-amber-50 text-amber-800'"
            >
              @if (actionMessage()!.tipo === 'DESACTIVADO') { <span class="font-semibold uppercase tracking-wide">Aviso:</span> }
              @else if (actionMessage()!.tipo === 'ELIMINADO') { <span class="font-semibold uppercase tracking-wide">Listo:</span> }
              @else { <span class="font-semibold uppercase tracking-wide">Info:</span> }
              <span>{{ actionMessage()!.texto }}</span>
            </div>
          }

          @if (isLoading()) {
            <div class="p-12 text-center">
              <span class="h-6 w-6 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin inline-block"></span>
              <p class="text-sm text-slate-400 mt-3">Cargando departamentos...</p>
            </div>
          } @else {
            <!-- Header -->
            <div class="grid grid-cols-[auto_1fr_1.2fr_0.7fr_140px] wf-table-header">
              <div class="w-3 mr-3"></div>
              <div>Nombre</div>
              <div>Descripción</div>
              <div>Creado por</div>
              <div class="text-right">Acciones</div>
            </div>

            <div class="max-h-[580px] overflow-auto">
              @for (dept of departamentos(); track dept.id) {
                <div
                  class="grid grid-cols-[auto_1fr_1.2fr_0.7fr_140px] items-center wf-table-row"
                  [class.opacity-60]="!dept.activo"
                  [class.bg-amber-50/40]="!dept.activo"
                >
                  <!-- Status dot -->
                  <div class="w-3 mr-3">
                    <span
                      class="inline-block h-2.5 w-2.5 rounded-full"
                      [class]="dept.activo ? 'bg-emerald-500' : 'bg-amber-400'"
                      [title]="dept.activo ? 'Activo' : 'Desactivado'"
                    ></span>
                  </div>

                  <!-- Name -->
                  <div>
                    <div class="font-semibold text-sm" [class]="dept.activo ? 'text-slate-900' : 'text-slate-500'">
                      {{ dept.nombre }}
                    </div>
                    @if (!dept.activo) {
                      <div class="text-[11px] font-medium text-amber-600 mt-0.5">Desactivado · tiene tareas</div>
                    }
                  </div>

                  <!-- Description -->
                  <div class="text-sm text-slate-500 pr-3 truncate">{{ dept.descripcion || '—' }}</div>

                  <!-- Creator -->
                  <div class="text-xs text-slate-500">{{ dept.creadoPor || 'sistema' }}</div>

                  <!-- Actions -->
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      (click)="iniciarEdicion(dept)"
                      class="wf-btn-secondary text-xs px-3 py-1.5"
                      [disabled]="!dept.activo"
                    >
                      Editar
                    </button>
                    
                    @if (dept.activo) {
                      <button
                        type="button"
                        (click)="eliminarDepartamento(dept)"
                        class="text-xs px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 font-semibold hover:bg-red-50 transition-all"
                      >
                        Eliminar
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="reactivarDepartamento(dept)"
                        class="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 bg-white text-emerald-600 font-semibold hover:bg-emerald-50 transition-all"
                      >
                        Activar
                      </button>
                    }
                  </div>
                </div>
              } @empty {
                <div class="p-12 text-center text-sm text-slate-400">
                  No hay departamentos registrados
                </div>
              }
            </div>
          }
        </app-page-section>
      </div>
    </div>
  `
})
export class AdminDepartamentosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private svc = inject(AdminDepartamentosService);

  departamentos = signal<Departamento[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  showModal = signal(false);
  editingId = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);
  actionMessage = signal<{ tipo: 'DESACTIVADO' | 'ELIMINADO' | 'REACTIVADO' | 'ACTUALIZADO'; texto: string } | null>(null);

  // Counters derived from list
  activos = () => this.departamentos().filter(d => d.activo).length;
  inactivos = () => this.departamentos().filter(d => !d.activo).length;

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    descripcion: ['', Validators.maxLength(200)]
  });

  ngOnInit() {
    this.cargarDepartamentos();
  }

  cargarDepartamentos() {
    this.isLoading.set(true);
    this.svc.listarDepartamentos().subscribe({
      next: (data) => { this.isLoading.set(false); this.departamentos.set(data); },
      error: () => { this.isLoading.set(false); this.mensajeError.set('No se pudo cargar la lista de departamentos'); }
    });
  }

  abrirModalCrear() {
    this.editingId.set(null);
    this.form.reset();
    this.limpiarMensajes();
    this.showModal.set(true);
  }

  iniciarEdicion(dept: Departamento) {
    this.editingId.set(dept.id);
    this.form.patchValue({
      nombre: dept.nombre,
      descripcion: dept.descripcion || ''
    });
    this.limpiarMensajes();
    this.showModal.set(true);
  }

  cancelarEdicion() {
    this.editingId.set(null);
    this.form.reset();
    this.showModal.set(false);
  }

  onSubmit() {
    if (this.form.invalid || this.isSaving()) return;
    this.limpiarMensajes();
    this.isSaving.set(true);

    const nombre = (this.form.controls.nombre.value || '').trim();
    const descripcion = (this.form.controls.descripcion.value || '').trim() || undefined;
    const request = { nombre, descripcion };

    const obs = this.editingId()
      ? this.svc.actualizarDepartamento(this.editingId()!, request)
      : this.svc.crearDepartamento(request);

    obs.subscribe({
      next: (res) => {
        this.isSaving.set(false);
        const msg = this.editingId() ? `"${res.nombre}" actualizado` : `"${res.nombre}" creado`;
        this.actionMessage.set({ tipo: 'ACTUALIZADO', texto: msg });
        this.form.reset();
        this.editingId.set(null);
        this.showModal.set(false);
        this.cargarDepartamentos();
        setTimeout(() => this.actionMessage.set(null), 5000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.mensajeError.set(this.extraerError(err));
      }
    });
  }

  crearDepartamento() {
    // Replaced by onSubmit
  }

  eliminarDepartamento(dept: Departamento) {
    this.limpiarMensajes();

    const confirmado = window.confirm(
      `¿Eliminar el departamento "${dept.nombre}"?\n\n` +
      `Si tiene tareas asignadas será DESACTIVADO (sus datos se conservan).\n` +
      `Si no tiene tareas será eliminado permanentemente.`
    );
    if (!confirmado) return;

    this.svc.eliminarDepartamento(dept.id).subscribe({
      next: (res) => {
        this.actionMessage.set({
          tipo: res.accion as 'DESACTIVADO' | 'ELIMINADO',
          texto: res.mensaje
        });
        this.cargarDepartamentos();
        setTimeout(() => this.actionMessage.set(null), 8000);
      },
      error: (err) => this.mensajeError.set(this.extraerError(err))
    });
  }

  reactivarDepartamento(dept: Departamento) {
    this.limpiarMensajes();

    this.svc.reactivarDepartamento(dept.id).subscribe({
      next: (updated) => {
        this.actionMessage.set({
          tipo: 'REACTIVADO',
          texto: `El departamento "${updated.nombre}" fue reactivado. Ya aparece en los selectores de nuevas solicitudes.`
        });
        this.cargarDepartamentos();
        setTimeout(() => this.actionMessage.set(null), 6000);
      },
      error: (err) => this.mensajeError.set(this.extraerError(err))
    });
  }

  private limpiarMensajes() {
    this.mensajeExito.set(null);
    this.mensajeError.set(null);
    this.actionMessage.set(null);
  }

  private extraerError(err: unknown): string {
    if (!err || typeof err !== 'object') return 'Error inesperado';
    const e = err as { error?: { mensaje?: string }; message?: string };
    return e.error?.mensaje || e.message || 'Error inesperado';
  }
}

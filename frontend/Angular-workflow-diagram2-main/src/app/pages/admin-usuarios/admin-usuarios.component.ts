import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AdminUser,
  AdminUsersService,
  RolUsuario
} from '../../admin/admin-users.service';
import { WorkflowSupportService } from '../../workflow/workflow-support.service';
import { BASE_PATH } from '../../api/variables';
import { AuthService } from '../../auth/auth.service';


import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PageSectionComponent } from '../../shared/components/page-section/page-section.component';


@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, PageSectionComponent],
  templateUrl: './admin-usuarios.component.html'
})
export class AdminUsuariosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private adminUsersService = inject(AdminUsersService);
  private workflowSupportService = inject(WorkflowSupportService);
  private authService = inject(AuthService);
  public basePath = inject(BASE_PATH);


  readonly roles: RolUsuario[] = ['SOLICITANTE', 'REVISOR', 'ADMINISTRADOR'];
  private readonly fallbackDepartamentos = ['Sistemas', 'Ventas', 'Recursos Humanos'];

  usuarios = signal<AdminUser[]>([]);
  departamentosCatalogo = signal<string[]>(this.fallbackDepartamentos);
  isLoading = signal(false);
  isSaving = signal(false);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);
  showModal = signal(false);
  editingUserId = signal<string | null>(null);

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
    rol: this.fb.control<RolUsuario>('SOLICITANTE', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    departamento: ['Sistemas']
  });

  ngOnInit() {
    this.cargarCatalogoDepartamentos();
    this.configurarValidacionesDinamicas();
    this.cargarUsuarios();
  }

  enModoEdicion(): boolean {
    return this.editingUserId() !== null;
  }

  getInitials(name?: string | null, username?: string | null): string {
    const target = name || username || '?';
    return target
      .split(' ')
      .map((parte) => parte.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  isRealAvatar(url?: string | null): boolean {
    if (!url) return false;
    // Si la URL contiene "random" o es de un servicio de iniciales, no la consideramos una "foto real"
    const lower = url.toLowerCase();
    if (lower.includes('random') || lower.includes('ui-avatars') || lower.includes('dicebear')) return false;
    return true;
  }

  getValidAvatar(url?: string | null): string {
    return this.isRealAvatar(url) ? (url || '/icons/default-avatar.png') : '/icons/default-avatar.png';
  }

  cargarUsuarios() {
    this.isLoading.set(true);
    this.mensajeError.set(null);

    this.adminUsersService.listarUsuarios().subscribe({
      next: (usuarios) => {
        this.isLoading.set(false);
        this.usuarios.set(usuarios);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.mensajeError.set(this.extraerMensajeError(err, 'No se pudo cargar la lista de usuarios'));
      }
    });
  }

  abrirModalCrear() {
    this.editingUserId.set(null);
    this.reiniciarFormulario();
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.showModal.set(true);
  }

  iniciarEdicion(usuario: AdminUser) {
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.editingUserId.set(usuario.id);
    this.showModal.set(true);

    this.form.patchValue({
      username: usuario.username,
      password: '',
      nombreCompleto: usuario.nombreCompleto,
      rol: usuario.rol,
      departamento: usuario.departamento || ''
    });

    this.form.controls.username.disable({ emitEvent: false });
    this.actualizarValidadoresPassword();
    this.actualizarValidadoresDepartamento();
  }

  cancelarEdicion() {
    this.editingUserId.set(null);
    this.reiniciarFormulario();
    this.mensajeError.set(null);
    this.showModal.set(false);
  }

  guardarUsuario() {
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rol = this.form.controls.rol.value;
    const nombreCompleto = (this.form.controls.nombreCompleto.value || '').trim();
    const password = (this.form.controls.password.value || '').trim();
    const departamento = (this.form.controls.departamento.value || '').trim();

    this.isSaving.set(true);

    if (this.enModoEdicion()) {
      const id = this.editingUserId();
      if (!id) {
        this.isSaving.set(false);
        return;
      }

      this.adminUsersService
        .actualizarUsuario(id, {
          nombreCompleto,
          rol,
          departamento: rol === 'ADMINISTRADOR' ? undefined : departamento,
          password: password || undefined
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.mensajeExito.set('Usuario actualizado exitosamente');
            this.cargarUsuarios();
            this.cancelarEdicion();
          },
          error: (err) => {
            this.isSaving.set(false);
            this.mensajeError.set(this.extraerMensajeError(err, 'No se pudo actualizar el usuario'));
          }
        });

      return;
    }

    const username = (this.form.controls.username.value || '').trim();

    this.adminUsersService
      .crearUsuario({
        username,
        password,
        nombreCompleto,
        rol,
        departamento: rol === 'ADMINISTRADOR' ? undefined : departamento
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.mensajeExito.set('Usuario creado exitosamente');
          this.cargarUsuarios();
          this.reiniciarFormulario();
          this.showModal.set(false);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.mensajeError.set(this.extraerMensajeError(err, 'No se pudo crear el usuario'));
        }
      });
  }

  eliminarUsuario(usuario: AdminUser) {
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    if (!usuario.id) {
      this.mensajeError.set('El usuario no tiene un ID válido para eliminar');
      return;
    }

    const confirmado = window.confirm(`Eliminar al usuario ${usuario.username}?`);
    if (!confirmado) {
      return;
    }

    this.adminUsersService.eliminarUsuario(usuario.id).subscribe({
      next: () => {
        this.mensajeExito.set(`Usuario ${usuario.username} eliminado`);
        if (this.editingUserId() === usuario.id) {
          this.cancelarEdicion();
        }
        this.cargarUsuarios();
      },
      error: (err) => {
        this.mensajeError.set(this.extraerMensajeError(err, 'No se pudo eliminar el usuario'));
      }
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    const id = this.editingUserId();

    if (file && id) {
      this.isSaving.set(true);
      this.adminUsersService.subirAvatar(id, file).subscribe({
        next: (user) => {
          this.isSaving.set(false);
          this.mensajeExito.set('Foto de perfil actualizada');
          // Update list
          this.usuarios.update(list => list.map(u => u.id === id ? user : u));
          // If admin is editing their own account, refresh the navbar avatar
          const currentUsername = this.authService.currentUser()?.username;
          if (user.username === currentUsername) {
            this.authService.updateCurrentUser({
              avatarUrl: user.avatarUrl
                ? (user.avatarUrl.startsWith('http') || user.avatarUrl.startsWith('/icons/') ? user.avatarUrl : this.basePath + user.avatarUrl)
                : undefined
            });
          }
        },
        error: (err) => {
          this.isSaving.set(false);
          this.mensajeError.set(this.extraerMensajeError(err, 'No se pudo subir la foto'));
        }
      });
    }
  }


  private configurarValidacionesDinamicas() {
    this.form.controls.rol.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarValidadoresDepartamento());

    this.actualizarValidadoresDepartamento();
    this.actualizarValidadoresPassword();
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
    const rol = this.form.controls.rol.value;
    if (rol === 'ADMINISTRADOR') {
      this.form.controls.departamento.setValue('', { emitEvent: false });
      return;
    }

    const actual = (this.form.controls.departamento.value || '').trim();
    const catalogo = this.departamentosCatalogo();

    if (!actual || !catalogo.includes(actual)) {
      this.form.controls.departamento.setValue(catalogo[0] || 'Sistemas', { emitEvent: false });
    }
  }

  private actualizarValidadoresDepartamento() {
    const rol = this.form.controls.rol.value;
    const control = this.form.controls.departamento;

    if (rol === 'ADMINISTRADOR') {
      control.clearValidators();
      control.setValue('', { emitEvent: false });
    } else {
      control.setValidators([Validators.required]);
      this.sincronizarDepartamentoSeleccionado();
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private actualizarValidadoresPassword() {
    const control = this.form.controls.password;

    if (this.enModoEdicion()) {
      control.clearValidators();
    } else {
      control.setValidators([Validators.required]);
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private reiniciarFormulario() {
    this.form.controls.username.enable({ emitEvent: false });

    this.form.reset({
      username: '',
      password: '',
      nombreCompleto: '',
      rol: 'SOLICITANTE',
      departamento: this.departamentosCatalogo()[0] || 'Sistemas'
    });

    this.actualizarValidadoresPassword();
    this.actualizarValidadoresDepartamento();
  }

  private extraerMensajeError(err: unknown, fallback: string): string {
    if (!err || typeof err !== 'object') {
      return fallback;
    }

    const apiError = err as { error?: { mensaje?: string } };
    return apiError.error?.mensaje || fallback;
  }
}
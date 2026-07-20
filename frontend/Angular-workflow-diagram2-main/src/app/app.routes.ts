import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { roleGuard } from './auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'informes',
        loadComponent: () => import('./pages/informes/informes.component').then(m => m.InformesComponent)
      },
      {
        path: 'crear',
        canActivate: [roleGuard],
        data: { roles: ['SOLICITANTE', 'ADMINISTRADOR'] },
        loadComponent: () => import('./pages/crear-solicitud/crear-solicitud.component').then(m => m.CrearSolicitudComponent)
      },
      {
        path: 'documentos',
        loadComponent: () => import('./pages/gestion-documental/gestion-documental.component').then(m => m.GestionDocumentalComponent)
      },
      {
        path: 'carpetas',
        loadComponent: () => import('./pages/gestion-carpetas/gestion-carpetas.component').then(m => m.GestionCarpetasComponent)
      },
      {
        path: 'archivos',
        loadComponent: () => import('./pages/archivos-todos/archivos-todos.component').then(m => m.ArchivosTodosComponent)
      },
      {
        path: 'documentos/editar/:id',
        loadComponent: () => import('./pages/document-editor/document-editor.component').then(m => m.DocumentEditorComponent)
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'] },
        loadComponent: () => import('./pages/admin-usuarios/admin-usuarios.component').then(m => m.AdminUsuariosComponent)
      },
      {
        path: 'departamentos',
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'] },
        loadComponent: () => import('./pages/admin-departamentos/admin-departamentos.component').then(m => m.AdminDepartamentosComponent)
      },
      {
        path: 'detalle/:id',
        loadComponent: () => import('./pages/detalle-solicitud/detalle-solicitud.component').then(m => m.DetalleSolicitudComponent)
      },
      {
        path: 'asistente',
        loadComponent: () => import('./pages/ai-assistant/ai-assistant.component').then(m => m.AiAssistantComponent)
      },
      {
        path: 'mapa-avanzado',
        loadComponent: () => import('./pages/workflow-map/workflow-map.component').then(m => m.WorkflowMapComponent)
      },
      {
        path: 'solicitudes',
        loadComponent: () => import('./pages/solicitudes/solicitudes.component').then(m => m.SolicitudesComponent)
      },
      {
        path: 'bpmn-workspace',
        loadComponent: () => import('./pages/bpmn-workspace/bpmn-workspace.component').then(m => m.BpmnWorkspaceComponent)
      }
    ]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  }
];

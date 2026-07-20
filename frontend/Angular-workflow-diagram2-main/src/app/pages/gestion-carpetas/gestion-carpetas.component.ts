import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { WorkflowDepartamentalService } from '../../api/api/workflowDepartamental.service';
import { WorkflowSupportService } from '../../workflow/workflow-support.service';
import { DocumentoService, Documento } from '../../workflow/documento.service';
import { AuthService } from '../../auth/auth.service';
import { SolicitudResponse } from '../../api/model/solicitudResponse';
import { BASE_PATH } from '../../api/variables';

interface CarpetaNode {
  id: string;
  nombre: string;
  departamento: string;
  ticketCount: number;
}

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-gestion-carpetas',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, DatePipe, RouterLink, PageHeaderComponent],
  templateUrl: './gestion-carpetas.component.html',
  styleUrl: './gestion-carpetas.component.css'
})
export class GestionCarpetasComponent implements OnInit {
  private workflowService = inject(WorkflowDepartamentalService);
  private supportService = inject(WorkflowSupportService);
  private docService = inject(DocumentoService);
  public authService = inject(AuthService);
  private router = inject(Router);
  public basePath = inject(BASE_PATH);

  // States
  definitions = signal<any[]>([]);
  selectedWorkflowKey = signal<string>('');
  allTickets = signal<SolicitudResponse[]>([]);
  folders = signal<CarpetaNode[]>([]);
  selectedFolderId = signal<string | null>(null);
  selectedTicket = signal<SolicitudResponse | null>(null);
  ticketDocs = signal<Documento[]>([]);
  
  loading = signal<boolean>(false);
  loadingDocs = signal<boolean>(false);
  searchQuery = signal<string>('');

  // Moving tickets
  movingTicketId = signal<string | null>(null);
  targetFolderId = signal<string>('');

  // Computed
  selectedWorkflow = computed(() => {
    return this.definitions().find(d => d.key === this.selectedWorkflowKey());
  });

  selectedFolder = computed(() => {
    const fid = this.selectedFolderId();
    return this.folders().find(f => f.id === fid);
  });

  filteredTickets = computed(() => {
    const fid = this.selectedFolderId();
    const query = this.searchQuery().toLowerCase().trim();
    let tickets = this.allTickets();

    // Filter by workflow key
    const activeKey = this.selectedWorkflowKey();
    tickets = tickets.filter(t => t.workflowDefinitionId === activeKey);

    // Filter by folder (task ID)
    if (fid) {
      tickets = tickets.filter(t => t.tareaActualId === fid);
    }

    // Filter by query
    if (query) {
      tickets = tickets.filter(t => 
        t.titulo?.toLowerCase().includes(query) || 
        t.codigoSeguimiento?.toLowerCase().includes(query) ||
        t.descripcion?.toLowerCase().includes(query)
      );
    }

    return tickets;
  });

  ngOnInit() {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales() {
    this.loading.set(true);
    this.supportService.listarWorkflowDefinitions().subscribe({
      next: (defs) => {
        this.definitions.set(defs);
        if (defs.length > 0) {
          // Select first workflow definition
          this.selectedWorkflowKey.set(defs[0].key);
          this.onWorkflowChanged(defs[0].key);
        } else {
          this.loading.set(false);
        }
      },
      error: (err) => {
        console.error('Error listing workflow definitions:', err);
        this.loading.set(false);
      }
    });
  }

  onWorkflowChanged(key: string) {
    this.selectedWorkflowKey.set(key);
    this.selectedFolderId.set(null);
    this.selectedTicket.set(null);
    this.ticketDocs.set([]);
    this.cargarCarpetasYTickets();
  }

  cargarCarpetasYTickets() {
    this.loading.set(true);
    const key = this.selectedWorkflowKey();

    forkJoin({
      definition: this.supportService.obtenerWorkflowDefinition(key),
      tickets: this.workflowService.listarTodas().pipe(catchError(() => of({ datos: [] })))
    }).subscribe({
      next: ({ definition, tickets }) => {
        const ticketList = tickets.datos ?? [];
        this.allTickets.set(ticketList);

        // Parse diagram xml to find tasks/folders
        if (definition && definition.xml) {
          const parsedFolders = this.parseXmlToFolders(definition.xml, ticketList, key);
          this.folders.set(parsedFolders);
        } else {
          this.folders.set([]);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error fetching details:', err);
        this.loading.set(false);
      }
    });
  }

  parseXmlToFolders(xml: string, tickets: SolicitudResponse[], workflowKey: string): CarpetaNode[] {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');
      
      // Parse lanes to map lane name to its child nodes
      const laneMap = new Map<string, string>(); // Node ID -> Lane Name
      const lanes = xmlDoc.getElementsByTagName('bpmn:lane');
      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        const laneName = lane.getAttribute('name') || '';
        const flowNodeRefs = lane.getElementsByTagName('bpmn:flowNodeRef');
        for (let j = 0; j < flowNodeRefs.length; j++) {
          const ref = flowNodeRefs[j].textContent?.trim();
          if (ref) {
            laneMap.set(ref, laneName);
          }
        }
      }

      // Collect user tasks and general tasks
      const taskNodes: CarpetaNode[] = [];
      const tagNames = ['bpmn:userTask', 'bpmn:task', 'userTask', 'task'];
      
      const processTaskElement = (el: Element) => {
        const id = el.getAttribute('id');
        if (!id) return;

        const nombre = el.getAttribute('name') || id;
        
        // Find department (from attribute or lane parent name)
        let depto = el.getAttribute('wf:departamento') || el.getAttribute('departamento') || '';
        if (!depto) {
          depto = laneMap.get(id) || '';
        }

        // Count tickets currently in this task
        const ticketCount = tickets.filter(t => 
          t.workflowDefinitionId === workflowKey && 
          t.tareaActualId === id
        ).length;

        taskNodes.push({
          id,
          nombre,
          departamento: depto || 'General',
          ticketCount
        });
      };

      tagNames.forEach(tag => {
        const elements = xmlDoc.getElementsByTagName(tag);
        for (let i = 0; i < elements.length; i++) {
          processTaskElement(elements[i]);
        }
      });

      return taskNodes;
    } catch (e) {
      console.error('Error parsing BPMN XML to folders:', e);
      return [];
    }
  }

  selectFolder(folderId: string) {
    this.selectedFolderId.set(folderId);
    this.selectedTicket.set(null);
    this.ticketDocs.set([]);
  }

  clearFolderSelection() {
    this.selectedFolderId.set(null);
    this.selectedTicket.set(null);
    this.ticketDocs.set([]);
  }

  selectTicket(ticket: SolicitudResponse) {
    this.selectedTicket.set(ticket);
    this.loadingDocs.set(true);
    this.docService.listarPorSolicitud(ticket.id!).subscribe({
      next: (docs) => {
        this.ticketDocs.set(docs);
        this.loadingDocs.set(false);
      },
      error: (err) => {
        console.error('Error loading ticket documents:', err);
        this.loadingDocs.set(false);
      }
    });
  }

  iniciarReasignacion(ticketId: string) {
    this.movingTicketId.set(ticketId);
    this.targetFolderId.set('');
  }

  ejecutarReasignacion() {
    const ticketId = this.movingTicketId();
    const targetFid = this.targetFolderId();
    const targetFolder = this.folders().find(f => f.id === targetFid);

    if (!ticketId || !targetFid || !targetFolder) return;

    this.loading.set(true);
    this.supportService.cambiarTareaBpm(ticketId, this.selectedWorkflowKey(), targetFid, targetFolder.nombre).subscribe({
      next: () => {
        this.movingTicketId.set(null);
        this.selectedTicket.set(null);
        this.cargarCarpetasYTickets();
      },
      error: (err) => {
        alert('Error al mover la solicitud: ' + (err.error?.mensaje || err.message));
        this.loading.set(false);
      }
    });
  }

  cancelarReasignacion() {
    this.movingTicketId.set(null);
  }

  getPrioridadBadgeClass(p?: string): string {
    const base = 'px-2 py-0.5 border font-mono text-[9px] font-bold uppercase rounded-md ';
    switch (p) {
      case 'URGENTE': return base + 'bg-red-50 text-red-700 border-red-200';
      case 'ALTA': return base + 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MEDIA': return base + 'bg-blue-50 text-blue-700 border-blue-200';
      default: return base + 'bg-slate-50 text-slate-700 border-slate-200';
    }
  }

  verFichaTicket(ticketId?: string) {
    if (!ticketId) return;
    this.router.navigate(['/detalle', ticketId]);
  }
}

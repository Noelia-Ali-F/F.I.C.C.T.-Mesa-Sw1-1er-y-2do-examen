export * from './asistenteIA.service';
import { AsistenteIAService } from './asistenteIA.service';
export * from './autenticacin.service';
import { AutenticacinService } from './autenticacin.service';
export * from './workflowDepartamental.service';
import { WorkflowDepartamentalService } from './workflowDepartamental.service';
export const APIS = [AsistenteIAService, AutenticacinService, WorkflowDepartamentalService];

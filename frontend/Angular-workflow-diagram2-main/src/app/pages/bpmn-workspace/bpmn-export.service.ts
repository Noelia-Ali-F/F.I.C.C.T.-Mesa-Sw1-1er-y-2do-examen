import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BpmnExportService {
  generarPdf(svg: string, metadata: any) {
    console.log('Exportando PDF simulado...', metadata);
    // Para resolver la importación y la dependencia.
  }
}

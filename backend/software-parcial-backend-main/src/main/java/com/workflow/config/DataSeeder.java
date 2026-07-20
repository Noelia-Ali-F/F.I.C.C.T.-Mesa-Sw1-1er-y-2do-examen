package com.workflow.config;

import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.enums.Prioridad;
import com.workflow.domain.enums.RolUsuario;
import com.workflow.domain.model.Departamento;
import com.workflow.domain.model.SolicitudWorkflow;
import com.workflow.domain.model.Usuario;
import com.workflow.domain.model.Documento;
import com.workflow.domain.model.WorkflowDefinition;
import com.workflow.repository.DepartamentoRepository;
import com.workflow.repository.SolicitudWorkflowRepository;
import com.workflow.repository.UsuarioRepository;
import com.workflow.repository.DocumentoRepository;
import com.workflow.repository.WorkflowDefinitionRepository;
import com.workflow.service.CodigoSeguimientoGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UsuarioRepository usuarioRepository;
    private final SolicitudWorkflowRepository solicitudRepository;
    private final DepartamentoRepository departamentoRepository;
    private final DocumentoRepository documentoRepository;
    private final WorkflowDefinitionRepository workflowDefinitionRepository;
    private final CodigoSeguimientoGenerator codigoGenerator;

    // --- 1. PROCESO DE COMPRAS (3 POOLS/SWIMLANES: Sistemas, Ventas, Finanzas) ---
    private static final String PROCUREMENT_XML = 
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            "<bpmn:definitions xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\" xmlns:dc=\"http://www.omg.org/spec/DD/20100524/DC\" xmlns:di=\"http://www.omg.org/spec/DD/20100524/DI\" xmlns:wf=\"http://workflow.com/schema\" id=\"Definitions_Procurement\" targetNamespace=\"http://bpmn.io/schema/bpmn\">\n" +
            "  <bpmn:collaboration id=\"Collaboration_Procurement\">\n" +
            "    <bpmn:participant id=\"Participant_Procurement\" name=\"Adquisiciones y Compras Corporativas\" processRef=\"procurement-workflow\" />\n" +
            "  </bpmn:collaboration>\n" +
            "  <bpmn:process id=\"procurement-workflow\" name=\"Proceso de Compras\" isExecutable=\"true\">\n" +
            "    <bpmn:laneSet id=\"LaneSet_Procurement\">\n" +
            "      <bpmn:lane id=\"Lane_Proc_Sistemas\" name=\"Sistemas\" wf:departamento=\"Sistemas\">\n" +
            "        <bpmn:flowNodeRef>StartEvent_Proc</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>Activity_Pendiente</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>Activity_Sys1</bpmn:flowNodeRef>\n" +
            "      </bpmn:lane>\n" +
            "      <bpmn:lane id=\"Lane_Proc_Ventas\" name=\"Ventas\" wf:departamento=\"Ventas\">\n" +
            "        <bpmn:flowNodeRef>Activity_Venta1</bpmn:flowNodeRef>\n" +
            "      </bpmn:lane>\n" +
            "      <bpmn:lane id=\"Lane_Proc_Finanzas\" name=\"Finanzas\" wf:departamento=\"Finanzas\">\n" +
            "        <bpmn:flowNodeRef>Activity_RRHH1</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>EndEvent_Proc</bpmn:flowNodeRef>\n" +
            "      </bpmn:lane>\n" +
            "    </bpmn:laneSet>\n" +
            "    <bpmn:startEvent id=\"StartEvent_Proc\" name=\"Inicio\">\n" +
            "      <bpmn:outgoing>Flow_Proc_1</bpmn:outgoing>\n" +
            "    </bpmn:startEvent>\n" +
            "    <bpmn:userTask id=\"Activity_Pendiente\" name=\"Bandeja de Entrada / Pendientes\" wf:departamento=\"Sistemas\">\n" +
            "      <bpmn:incoming>Flow_Proc_1</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_Proc_2</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:userTask id=\"Activity_Sys1\" name=\"Analizar Requerimientos\" wf:departamento=\"Sistemas\" wf:form='[{\"name\":\"monto\",\"label\":\"Presupuesto Est. (USD)\",\"type\":\"number\",\"required\":true},{\"name\":\"motivo\",\"label\":\"Justificación Técnica\",\"type\":\"text\",\"required\":false}]'>\n" +
            "      <bpmn:incoming>Flow_Proc_2</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_Proc_3</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:userTask id=\"Activity_Venta1\" name=\"Aprobación Presupuesto\" wf:departamento=\"Ventas\">\n" +
            "      <bpmn:incoming>Flow_Proc_3</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_Proc_4</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:userTask id=\"Activity_RRHH1\" name=\"Firma de Contrato\" wf:departamento=\"Finanzas\">\n" +
            "      <bpmn:incoming>Flow_Proc_4</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_Proc_5</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:endEvent id=\"EndEvent_Proc\" name=\"Fin\">\n" +
            "      <bpmn:incoming>Flow_Proc_5</bpmn:incoming>\n" +
            "    </bpmn:endEvent>\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Proc_1\" sourceRef=\"StartEvent_Proc\" targetRef=\"Activity_Pendiente\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Proc_2\" sourceRef=\"Activity_Pendiente\" targetRef=\"Activity_Sys1\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Proc_3\" sourceRef=\"Activity_Sys1\" targetRef=\"Activity_Venta1\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Proc_4\" sourceRef=\"Activity_Venta1\" targetRef=\"Activity_RRHH1\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Proc_5\" sourceRef=\"Activity_RRHH1\" targetRef=\"EndEvent_Proc\" />\n" +
            "  </bpmn:process>\n" +
            "  <bpmndi:BPMNDiagram id=\"BPMNDiagram_Procurement\">\n" +
            "    <bpmndi:BPMNPlane id=\"BPMNPlane_Procurement\" bpmnElement=\"Collaboration_Procurement\">\n" +
            "      <bpmndi:BPMNShape id=\"Participant_Procurement_di\" bpmnElement=\"Participant_Procurement\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"120\" y=\"80\" width=\"900\" height=\"480\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Lane_Proc_Sistemas_di\" bpmnElement=\"Lane_Proc_Sistemas\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"150\" y=\"80\" width=\"870\" height=\"160\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Lane_Proc_Ventas_di\" bpmnElement=\"Lane_Proc_Ventas\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"150\" y=\"240\" width=\"870\" height=\"160\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Lane_Proc_Finanzas_di\" bpmnElement=\"Lane_Proc_Finanzas\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"150\" y=\"400\" width=\"870\" height=\"160\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"StartEvent_Proc_di\" bpmnElement=\"StartEvent_Proc\">\n" +
            "        <dc:Bounds x=\"200\" y=\"140\" width=\"36\" height=\"36\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_Pendiente_di\" bpmnElement=\"Activity_Pendiente\">\n" +
            "        <dc:Bounds x=\"280\" y=\"120\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_Sys1_di\" bpmnElement=\"Activity_Sys1\">\n" +
            "        <dc:Bounds x=\"430\" y=\"120\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_Venta1_di\" bpmnElement=\"Activity_Venta1\">\n" +
            "        <dc:Bounds x=\"580\" y=\"280\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_RRHH1_di\" bpmnElement=\"Activity_RRHH1\">\n" +
            "        <dc:Bounds x=\"730\" y=\"440\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"EndEvent_Proc_di\" bpmnElement=\"EndEvent_Proc\">\n" +
            "        <dc:Bounds x=\"890\" y=\"460\" width=\"36\" height=\"36\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Proc_1_di\" bpmnElement=\"Flow_Proc_1\">\n" +
            "        <di:waypoint x=\"236\" y=\"158\" />\n" +
            "        <di:waypoint x=\"280\" y=\"158\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Proc_2_di\" bpmnElement=\"Flow_Proc_2\">\n" +
            "        <di:waypoint x=\"380\" y=\"160\" />\n" +
            "        <di:waypoint x=\"430\" y=\"160\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Proc_3_di\" bpmnElement=\"Flow_Proc_3\">\n" +
            "        <di:waypoint x=\"530\" y=\"160\" />\n" +
            "        <di:waypoint x=\"555\" y=\"160\" />\n" +
            "        <di:waypoint x=\"555\" y=\"320\" />\n" +
            "        <di:waypoint x=\"580\" y=\"320\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Proc_4_di\" bpmnElement=\"Flow_Proc_4\">\n" +
            "        <di:waypoint x=\"680\" y=\"320\" />\n" +
            "        <di:waypoint x=\"705\" y=\"320\" />\n" +
            "        <di:waypoint x=\"705\" y=\"480\" />\n" +
            "        <di:waypoint x=\"730\" y=\"480\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Proc_5_di\" bpmnElement=\"Flow_Proc_5\">\n" +
            "        <di:waypoint x=\"830\" y=\"480\" />\n" +
            "        <di:waypoint x=\"890\" y=\"480\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "    </bpmndi:BPMNPlane>\n" +
            "  </bpmndi:BPMNDiagram>\n" +
            "</bpmn:definitions>";

    // --- 2. PROCESO DE SELECCIÓN Y ONBOARDING (2 POOLS: Recursos Humanos, Sistemas) ---
    private static final String RECRUITMENT_XML = 
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            "<bpmn:definitions xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\" xmlns:dc=\"http://www.omg.org/spec/DD/20100524/DC\" xmlns:di=\"http://www.omg.org/spec/DD/20100524/DI\" xmlns:wf=\"http://workflow.com/schema\" id=\"Definitions_Recruitment\" targetNamespace=\"http://bpmn.io/schema/bpmn\">\n" +
            "  <bpmn:collaboration id=\"Collaboration_Recruitment\">\n" +
            "    <bpmn:participant id=\"Participant_Recruitment\" name=\"Selección y Contratación\" processRef=\"hr-recruitment-workflow\" />\n" +
            "  </bpmn:collaboration>\n" +
            "  <bpmn:process id=\"hr-recruitment-workflow\" name=\"Proceso de Selección y Onboarding\" isExecutable=\"true\">\n" +
            "    <bpmn:laneSet id=\"LaneSet_Recruitment\">\n" +
            "      <bpmn:lane id=\"Lane_HR_RRHH\" name=\"Recursos Humanos\" wf:departamento=\"Recursos Humanos\">\n" +
            "        <bpmn:flowNodeRef>StartEvent_HR</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>Activity_HR_Pendiente</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>Activity_HR_Revision</bpmn:flowNodeRef>\n" +
            "      </bpmn:lane>\n" +
            "      <bpmn:lane id=\"Lane_HR_Sistemas\" name=\"Sistemas\" wf:departamento=\"Sistemas\">\n" +
            "        <bpmn:flowNodeRef>Activity_HR_Sistemas</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>EndEvent_HR</bpmn:flowNodeRef>\n" +
            "      </bpmn:lane>\n" +
            "    </bpmn:laneSet>\n" +
            "    <bpmn:startEvent id=\"StartEvent_HR\" name=\"Inicio\">\n" +
            "      <bpmn:outgoing>Flow_HR_1</bpmn:outgoing>\n" +
            "    </bpmn:startEvent>\n" +
            "    <bpmn:userTask id=\"Activity_HR_Pendiente\" name=\"Revisión de Hojas de Vida\" wf:departamento=\"Recursos Humanos\">\n" +
            "      <bpmn:incoming>Flow_HR_1</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_HR_2</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:userTask id=\"Activity_HR_Revision\" name=\"Entrevista Inicial\" wf:departamento=\"Recursos Humanos\">\n" +
            "      <bpmn:incoming>Flow_HR_2</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_HR_3</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:userTask id=\"Activity_HR_Sistemas\" name=\"Creación de Cuentas y Accesos\" wf:departamento=\"Sistemas\">\n" +
            "      <bpmn:incoming>Flow_HR_3</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_HR_4</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:endEvent id=\"EndEvent_HR\" name=\"Fin\">\n" +
            "      <bpmn:incoming>Flow_HR_4</bpmn:incoming>\n" +
            "    </bpmn:endEvent>\n" +
            "    <bpmn:sequenceFlow id=\"Flow_HR_1\" sourceRef=\"StartEvent_HR\" targetRef=\"Activity_HR_Pendiente\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_HR_2\" sourceRef=\"Activity_HR_Pendiente\" targetRef=\"Activity_HR_Revision\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_HR_3\" sourceRef=\"Activity_HR_Revision\" targetRef=\"Activity_HR_Sistemas\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_HR_4\" sourceRef=\"Activity_HR_Sistemas\" targetRef=\"EndEvent_HR\" />\n" +
            "  </bpmn:process>\n" +
            "  <bpmndi:BPMNDiagram id=\"BPMNDiagram_Recruitment\">\n" +
            "    <bpmndi:BPMNPlane id=\"BPMNPlane_Recruitment\" bpmnElement=\"Collaboration_Recruitment\">\n" +
            "      <bpmndi:BPMNShape id=\"Participant_Recruitment_di\" bpmnElement=\"Participant_Recruitment\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"120\" y=\"80\" width=\"800\" height=\"320\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Lane_HR_RRHH_di\" bpmnElement=\"Lane_HR_RRHH\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"150\" y=\"80\" width=\"770\" height=\"160\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Lane_HR_Sistemas_di\" bpmnElement=\"Lane_HR_Sistemas\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"150\" y=\"240\" width=\"770\" height=\"160\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"StartEvent_HR_di\" bpmnElement=\"StartEvent_HR\">\n" +
            "        <dc:Bounds x=\"200\" y=\"140\" width=\"36\" height=\"36\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_HR_Pendiente_di\" bpmnElement=\"Activity_HR_Pendiente\">\n" +
            "        <dc:Bounds x=\"280\" y=\"120\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_HR_Revision_di\" bpmnElement=\"Activity_HR_Revision\">\n" +
            "        <dc:Bounds x=\"430\" y=\"120\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_HR_Sistemas_di\" bpmnElement=\"Activity_HR_Sistemas\">\n" +
            "        <dc:Bounds x=\"580\" y=\"280\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"EndEvent_HR_di\" bpmnElement=\"EndEvent_HR\">\n" +
            "        <dc:Bounds x=\"740\" y=\"300\" width=\"36\" height=\"36\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_HR_1_di\" bpmnElement=\"Flow_HR_1\">\n" +
            "        <di:waypoint x=\"236\" y=\"158\" />\n" +
            "        <di:waypoint x=\"280\" y=\"158\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_HR_2_di\" bpmnElement=\"Flow_HR_2\">\n" +
            "        <di:waypoint x=\"380\" y=\"160\" />\n" +
            "        <di:waypoint x=\"430\" y=\"160\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_HR_3_di\" bpmnElement=\"Flow_HR_3\">\n" +
            "        <di:waypoint x=\"530\" y=\"160\" />\n" +
            "        <di:waypoint x=\"555\" y=\"160\" />\n" +
            "        <di:waypoint x=\"555\" y=\"320\" />\n" +
            "        <di:waypoint x=\"580\" y=\"320\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_HR_4_di\" bpmnElement=\"Flow_HR_4\">\n" +
            "        <di:waypoint x=\"680\" y=\"320\" />\n" +
            "        <di:waypoint x=\"740\" y=\"320\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "    </bpmndi:BPMNPlane>\n" +
            "  </bpmndi:BPMNDiagram>\n" +
            "</bpmn:definitions>";

    // --- 3. PROCESO COMERCIAL Y DESCUENTOS (2 POOLS: Ventas, Finanzas) ---
    private static final String SALES_XML = 
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            "<bpmn:definitions xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\" xmlns:dc=\"http://www.omg.org/spec/DD/20100524/DC\" xmlns:di=\"http://www.omg.org/spec/DD/20100524/DI\" xmlns:wf=\"http://workflow.com/schema\" id=\"Definitions_Sales\" targetNamespace=\"http://bpmn.io/schema/bpmn\">\n" +
            "  <bpmn:collaboration id=\"Collaboration_Sales\">\n" +
            "    <bpmn:participant id=\"Participant_Sales\" name=\"Aprobación de Descuentos Especiales\" processRef=\"sales-discount-workflow\" />\n" +
            "  </bpmn:collaboration>\n" +
            "  <bpmn:process id=\"sales-discount-workflow\" name=\"Proceso Comercial y Descuentos\" isExecutable=\"true\">\n" +
            "    <bpmn:laneSet id=\"LaneSet_Sales\">\n" +
            "      <bpmn:lane id=\"Lane_Sales_Ventas\" name=\"Ventas\" wf:departamento=\"Ventas\">\n" +
            "        <bpmn:flowNodeRef>StartEvent_Sales</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>Activity_Sales_Pendiente</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>Activity_Sales_Propuesta</bpmn:flowNodeRef>\n" +
            "      </bpmn:lane>\n" +
            "      <bpmn:lane id=\"Lane_Sales_Finanzas\" name=\"Finanzas\" wf:departamento=\"Finanzas\">\n" +
            "        <bpmn:flowNodeRef>Activity_Sales_Finanzas</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>EndEvent_Sales</bpmn:flowNodeRef>\n" +
            "      </bpmn:lane>\n" +
            "    </bpmn:laneSet>\n" +
            "    <bpmn:startEvent id=\"StartEvent_Sales\" name=\"Inicio\">\n" +
            "      <bpmn:outgoing>Flow_Sales_1</bpmn:outgoing>\n" +
            "    </bpmn:startEvent>\n" +
            "    <bpmn:userTask id=\"Activity_Sales_Pendiente\" name=\"Registro de Solicitud de Descuento\" wf:departamento=\"Ventas\">\n" +
            "      <bpmn:incoming>Flow_Sales_1</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_Sales_2</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:userTask id=\"Activity_Sales_Propuesta\" name=\"Validación del Margen Comercial\" wf:departamento=\"Ventas\">\n" +
            "      <bpmn:incoming>Flow_Sales_2</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_Sales_3</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:userTask id=\"Activity_Sales_Finanzas\" name=\"Aprobación Presupuestaria del Descuento\" wf:departamento=\"Finanzas\">\n" +
            "      <bpmn:incoming>Flow_Sales_3</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_Sales_4</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:endEvent id=\"EndEvent_Sales\" name=\"Fin\">\n" +
            "      <bpmn:incoming>Flow_Sales_4</bpmn:incoming>\n" +
            "    </bpmn:endEvent>\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Sales_1\" sourceRef=\"StartEvent_Sales\" targetRef=\"Activity_Sales_Pendiente\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Sales_2\" sourceRef=\"Activity_Sales_Pendiente\" targetRef=\"Activity_Sales_Propuesta\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Sales_3\" sourceRef=\"Activity_Sales_Propuesta\" targetRef=\"Activity_Sales_Finanzas\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Sales_4\" sourceRef=\"Activity_Sales_Finanzas\" targetRef=\"EndEvent_Sales\" />\n" +
            "  </bpmn:process>\n" +
            "  <bpmndi:BPMNDiagram id=\"BPMNDiagram_Sales\">\n" +
            "    <bpmndi:BPMNPlane id=\"BPMNPlane_Sales\" bpmnElement=\"Collaboration_Sales\">\n" +
            "      <bpmndi:BPMNShape id=\"Participant_Sales_di\" bpmnElement=\"Participant_Sales\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"120\" y=\"80\" width=\"800\" height=\"320\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Lane_Sales_Ventas_di\" bpmnElement=\"Lane_Sales_Ventas\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"150\" y=\"80\" width=\"770\" height=\"160\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Lane_Sales_Finanzas_di\" bpmnElement=\"Lane_Sales_Finanzas\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"150\" y=\"240\" width=\"770\" height=\"160\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"StartEvent_Sales_di\" bpmnElement=\"StartEvent_Sales\">\n" +
            "        <dc:Bounds x=\"200\" y=\"140\" width=\"36\" height=\"36\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_Sales_Pendiente_di\" bpmnElement=\"Activity_Sales_Pendiente\">\n" +
            "        <dc:Bounds x=\"280\" y=\"120\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_Sales_Propuesta_di\" bpmnElement=\"Activity_Sales_Propuesta\">\n" +
            "        <dc:Bounds x=\"430\" y=\"120\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_Sales_Finanzas_di\" bpmnElement=\"Activity_Sales_Finanzas\">\n" +
            "        <dc:Bounds x=\"580\" y=\"280\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"EndEvent_Sales_di\" bpmnElement=\"EndEvent_Sales\">\n" +
            "        <dc:Bounds x=\"740\" y=\"300\" width=\"36\" height=\"36\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Sales_1_di\" bpmnElement=\"Flow_Sales_1\">\n" +
            "        <di:waypoint x=\"236\" y=\"158\" />\n" +
            "        <di:waypoint x=\"280\" y=\"158\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Sales_2_di\" bpmnElement=\"Flow_Sales_2\">\n" +
            "        <di:waypoint x=\"380\" y=\"160\" />\n" +
            "        <di:waypoint x=\"430\" y=\"160\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Sales_3_di\" bpmnElement=\"Flow_Sales_3\">\n" +
            "        <di:waypoint x=\"530\" y=\"160\" />\n" +
            "        <di:waypoint x=\"555\" y=\"160\" />\n" +
            "        <di:waypoint x=\"555\" y=\"320\" />\n" +
            "        <di:waypoint x=\"580\" y=\"320\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Sales_4_di\" bpmnElement=\"Flow_Sales_4\">\n" +
            "        <di:waypoint x=\"680\" y=\"320\" />\n" +
            "        <di:waypoint x=\"740\" y=\"320\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "    </bpmndi:BPMNPlane>\n" +
            "  </bpmndi:BPMNDiagram>\n" +
            "</bpmn:definitions>";

    @Override
    public void run(String... args) throws Exception {
        if (Boolean.parseBoolean(System.getenv("FORCE_SEED")) || "true".equalsIgnoreCase(System.getProperty("force.seed"))) {
            log.info("FORCE_SEED detectado. Ejecutando limpieza y recarga completa.");
            forceSeed();
            return;
        }
        if (usuarioRepository.count() > 0) {
            log.info("CONEXIÓN A BASE DE DATOS EXITOSA: Sembrado omitido.");
            return;
        }
        forceSeed();
    }

    public void forceSeed() {
        log.info("INICIANDO FRESH SEED: Limpiando base de datos...");
        solicitudRepository.deleteAll();
        usuarioRepository.deleteAll();
        departamentoRepository.deleteAll();
        documentoRepository.deleteAll();
        workflowDefinitionRepository.deleteAll();

        seedDepartamentos();
        seedUsuarios();
        seedWorkflowDefinitions();
        seedSolicitudes();

        log.info("FRESH SEED FINALIZADO. Entorno listo.");
    }

    private void seedDepartamentos() {
        departamentoRepository.saveAll(List.of(
                buildDepto("Sistemas", "Tecnología, seguridad digital y soporte de infraestructura en la nube."),
                buildDepto("Recursos Humanos", "Gestión del talento humano, bienestar corporativo y nóminas."),
                buildDepto("Ventas", "Área comercial, captación de clientes corporativos y licencias de software."),
                buildDepto("Finanzas", "Control del presupuesto anual, tesorería y auditorías de gastos.")
        ));
    }

    private void seedUsuarios() {
        usuarioRepository.saveAll(List.of(
                buildDefaultUser("admin", "admin", "Súper Administrador", RolUsuario.ADMINISTRADOR, "Sistemas"),
                buildDefaultUser("revisor", "revisor", "Jefe de Talento Humano", RolUsuario.REVISOR, "Recursos Humanos"),
                buildDefaultUser("ti", "ti", "Ingeniero Cloud Systems", RolUsuario.REVISOR, "Sistemas"),
                buildDefaultUser("ventas", "ventas", "Director Comercial Global", RolUsuario.REVISOR, "Ventas"),
                buildDefaultUser("finanzas", "finanzas", "Controlador Financiero", RolUsuario.REVISOR, "Finanzas"),
                buildDefaultUser("solicitante", "solicitante", "Juan Solicitante (PM)", RolUsuario.SOLICITANTE, "Sistemas")
        ));
    }

    private void seedWorkflowDefinitions() {
        workflowDefinitionRepository.save(WorkflowDefinition.builder()
                .key("procurement-workflow").name("Proceso de Compras").description("Gestión de adquisiciones y presupuestos").xml(PROCUREMENT_XML)
                .editadoPor("admin").departamentoEditor("Sistemas").version(1).build());

        workflowDefinitionRepository.save(WorkflowDefinition.builder()
                .key("hr-recruitment-workflow").name("Proceso de Selección y Onboarding").description("Flujo de contratación de personal e inducción").xml(RECRUITMENT_XML)
                .editadoPor("admin").departamentoEditor("Recursos Humanos").version(1).build());

        workflowDefinitionRepository.save(WorkflowDefinition.builder()
                .key("sales-discount-workflow").name("Proceso Comercial y Descuentos").description("Aprobación de márgenes y descuentos comerciales").xml(SALES_XML)
                .editadoPor("admin").departamentoEditor("Ventas").version(1).build());
    }

    private void seedSolicitudes() {
        // --- 1. SOLICITUDES DE COMPRAS ---
        SolicitudWorkflow s1 = crearSolicitudCompleta(
                "Ampliación Infraestructura AWS - Campaña Q4",
                "Debido al drástico incremento de tráfico proyectado para la campaña de fin de año, solicitamos la adquisición de 3 instancias EC2 reservadas tipo m5.2xlarge, un balanceador de carga redundante (ALB) y una base de datos RDS Aurora PostgreSQL de alto rendimiento con réplica Multi-AZ. Presupuesto estimado: $14,500 USD anuales.",
                Prioridad.URGENTE, "Sistemas", "solicitante", EstadoWorkflow.EN_REVISION, "ti",
                "procurement-workflow", "Activity_Sys1", "Analizar Requerimientos");

        SolicitudWorkflow s2 = crearSolicitudCompleta(
                "Renovación Anual 25 Licencias Salesforce Enterprise",
                "Adquisición del plan anual para 25 licencias Enterprise de Salesforce CRM para el equipo de ventas internacionales. Permitirá unificar la gestión de oportunidades corporativas y la automatización de flujos de prospección.",
                Prioridad.ALTA, "Ventas", "solicitante", EstadoWorkflow.EN_REVISION, "ventas",
                "procurement-workflow", "Activity_Venta1", "Aprobación Presupuesto");

        SolicitudWorkflow s3 = crearSolicitudCompleta(
                "Seguro Médico Familiar y Dental MetLife 2026",
                "Renovación y actualización de la póliza de seguro médico colectivo corporativo para el ejercicio 2026. Se incluye el beneficio adicional de ortodoncia básica para empleados permanentes con copago del 20%.",
                Prioridad.MEDIA, "Finanzas", "solicitante", EstadoWorkflow.EN_REVISION, "finanzas",
                "procurement-workflow", "Activity_RRHH1", "Firma de Contrato");

        // --- 2. SOLICITUD DE SELECCIÓN DE RRHH ---
        SolicitudWorkflow s_hr = crearSolicitudCompleta(
                "Contratación de Especialista Senior Java / Cloud",
                "Se requiere incorporar al equipo de tecnología a un ingeniero senior backend con experiencia sólida en Java, Spring Boot y despliegues serverless en Kubernetes/Cloud Run, para dar soporte a los proyectos del núcleo transaccional.",
                Prioridad.ALTA, "Recursos Humanos", "solicitante", EstadoWorkflow.EN_REVISION, "revisor",
                "hr-recruitment-workflow", "Activity_HR_Revision", "Entrevista Inicial");

        // --- 3. SOLICITUD DE DESCUENTO EN VENTAS ---
        SolicitudWorkflow s_sales = crearSolicitudCompleta(
                "Descuento Extraordinario del 18% - Cuenta Globant",
                "Propuesta comercial de descuento del 18% para el contrato corporativo multianual de soporte e integración tecnológica. Requiere validación del director financiero para asegurar los niveles de margen bruto mínimos requeridos.",
                Prioridad.URGENTE, "Ventas", "solicitante", EstadoWorkflow.EN_REVISION, "ventas",
                "sales-discount-workflow", "Activity_Sales_Propuesta", "Validación del Margen Comercial");

        // --- 4. SOLICITUD PENDIENTE SIN ASIGNAR ---
        crearSolicitudCompleta(
                "Mantenimiento Aire Acondicionado DataCenter Piso 3",
                "Servicio preventivo semestral del sistema de enfriamiento de precisión en el Data Center local para evitar riesgos de sobrecalentamiento en servidores on-premise.",
                Prioridad.BAJA, "Sistemas", "solicitante", EstadoWorkflow.PENDIENTE, null,
                null, null, null);

        // Documentos
        seedDocumentoColaborativo(s1, "Dossier_Tecnico_AWS_2026", "Cotización detallada y especificaciones de instancias reservadas.", 
                "### COTIZACIÓN CLOUD SERVICIOS AWS Q4\n\n" +
                "| Recurso | Configuración | Cantidad | Costo Mensual |\n" +
                "| :--- | :--- | :---: | :---: |\n" +
                "| **EC2 m5.2xlarge** | Reservado 1 año (No Upfront) | 3 | $640.00 |\n" +
                "| **RDS Aurora DB** | DB.r6g.2xlarge + Multi-AZ | 1 | $480.00 |\n" +
                "| **EBS Storage** | gp3 SSD 2TB Redundante | 1 | $190.00 |\n" +
                "| **ALB + Data transfer** | Balanced Redundancy | - | $110.00 |\n\n" +
                "**Total Estimado Mensual:** $1,420.00 USD\n" +
                "**Ahorro Aplicado por Reserva:** 32.5%\n\n" +
                "**Justificación Técnica:** Soportará el pico de 15,000 transacciones concurrentes simultáneas estimadas para el Black Friday.", "solicitante");

        seedDocumentoColaborativo(s3, "Contrato_Seguros_MetLife_2026", "Borrador de términos y condiciones de coberturas colectivas.", 
                "### CONTRATO DE COBERTURA MÉDICA CORPORATIVA\n\n" +
                "- **Aseguradora:** MetLife Seguros Internacionales S.A.\n" +
                "- **Vigencia:** 01 de Enero 2026 al 31 de Diciembre 2026.\n" +
                "- **Elegibilidad:** Todo el personal con contrato indefinido activo.\n\n" +
                "#### Beneficios Clave:\n" +
                "1. **Atención Médica Primaria:** 100% libre de deducible en red preferente.\n" +
                "2. **Hospitalización:** Cobertura al 90% en cirugías programadas y accidentes.\n" +
                "3. **Dental Ampliado:** Copago de $10 USD para consultas de profilaxis corporativas.\n\n" +
                "**Responsable Operativo:** RRHH (Talento Humano).", "revisor");

        seedDocumentoColaborativo(s_hr, "Perfil_Candidato_Java_Senior", "Requerimientos y currículum del candidato preseleccionado.", 
                "### PERFIL DE CARGO: INGENIERO BACKEND SENIOR JAVA\n\n" +
                "#### Habilidades Clave:\n" +
                "- **Lenguajes:** Java 17+, SQL, TypeScript.\n" +
                "- **Frameworks:** Spring Boot 3.x, Spring Cloud, Hibernate.\n" +
                "- **Bases de Datos:** MongoDB, PostgreSQL, Redis.\n" +
                "- **Cloud:** AWS (ECS, RDS, S3), GCP Cloud Run.\n\n" +
                "#### Rango Salarial Ofrecido:\n" +
                "- Rango: $3,800 - $4,500 USD netos mensuales acorde a experiencia.", "revisor");

        // Sincronizar el XML con los códigos de los tickets creados
        actualizarXmlConSolicitudes(s1, s2, s3, s_hr, s_sales);
    }

    private void actualizarXmlConSolicitudes(SolicitudWorkflow sys, SolicitudWorkflow vta, SolicitudWorkflow fin, 
                                             SolicitudWorkflow hr, SolicitudWorkflow sales) {
        // 1. Procurement
        workflowDefinitionRepository.findByKey("procurement-workflow").ifPresent(def -> {
            String xml = def.getXml();
            xml = xml.replace("id=\"Activity_Sys1\" name=\"Analizar Requerimientos\"", "id=\"Activity_Sys1\" name=\"Analizar Requerimientos\" wf:solicitudes=\"" + sys.getCodigoSeguimiento() + "\"");
            xml = xml.replace("id=\"Activity_Venta1\" name=\"Aprobación Presupuesto\"", "id=\"Activity_Venta1\" name=\"Aprobación Presupuesto\" wf:solicitudes=\"" + vta.getCodigoSeguimiento() + "\"");
            xml = xml.replace("id=\"Activity_RRHH1\" name=\"Firma de Contrato\"", "id=\"Activity_RRHH1\" name=\"Firma de Contrato\" wf:solicitudes=\"" + fin.getCodigoSeguimiento() + "\"");
            def.setXml(xml);
            workflowDefinitionRepository.save(def);
        });

        // 2. Recruitment
        workflowDefinitionRepository.findByKey("hr-recruitment-workflow").ifPresent(def -> {
            String xml = def.getXml();
            xml = xml.replace("id=\"Activity_HR_Revision\" name=\"Entrevista Inicial\"", "id=\"Activity_HR_Revision\" name=\"Entrevista Inicial\" wf:solicitudes=\"" + hr.getCodigoSeguimiento() + "\"");
            def.setXml(xml);
            workflowDefinitionRepository.save(def);
        });

        // 3. Sales Discount
        workflowDefinitionRepository.findByKey("sales-discount-workflow").ifPresent(def -> {
            String xml = def.getXml();
            xml = xml.replace("id=\"Activity_Sales_Propuesta\" name=\"Validación del Margen Comercial\"", "id=\"Activity_Sales_Propuesta\" name=\"Validación del Margen Comercial\" wf:solicitudes=\"" + sales.getCodigoSeguimiento() + "\"");
            def.setXml(xml);
            workflowDefinitionRepository.save(def);
        });
    }

    private SolicitudWorkflow crearSolicitudCompleta(String titulo, String desc, Prioridad prio, String depto, String creador, 
                                                   EstadoWorkflow estadoFinal, String revisor, String flowId, String tareaId, String tareaNombre) {
        String codigo = codigoGenerator.generarCodigo();
        SolicitudWorkflow s = SolicitudWorkflow.builder()
                .codigoSeguimiento(codigo).titulo(titulo).descripcion(desc).prioridad(prio).estado(EstadoWorkflow.PENDIENTE)
                .departamentoActual(depto).usuarioCreador(creador).workflowDefinitionId(flowId).tareaActualId(tareaId).tareaActualNombre(tareaNombre)
                .fechaCreacion(LocalDateTime.now()).fechaLimiteAtencion(LocalDateTime.now().plusHours(48)).build();

        s.registrarTransicion(null, EstadoWorkflow.PENDIENTE, creador, "SOLICITANTE", "Registro inicial de solicitud en el panel de control.");
        if (estadoFinal != EstadoWorkflow.PENDIENTE) {
            s.setUsuarioAsignado(revisor);
            s.registrarTransicion(EstadoWorkflow.PENDIENTE, EstadoWorkflow.EN_REVISION, revisor, "REVISOR", "Iniciada auditoría y análisis en etapa: " + tareaNombre);
        }
        return solicitudRepository.save(s);
    }

    private Departamento buildDepto(String nombre, String desc) {
        return Departamento.builder().nombre(nombre).descripcion(desc).creadoPor("system").activo(true).fechaCreacion(LocalDateTime.now()).build();
    }

    private Usuario buildDefaultUser(String username, String password, String nombre, RolUsuario rol, String depto) {
        String avatarUrl = "https://ui-avatars.com/api/?name=" + nombre.replace(" ", "+") + "&background=random&color=fff&size=128";
        return Usuario.builder().username(username).password(password).nombreCompleto(nombre).rol(rol).departamento(depto).avatarUrl(avatarUrl).fechaCreacion(LocalDateTime.now()).build();
    }

    private void seedDocumentoColaborativo(SolicitudWorkflow solicitud, String nombre, String desc, String contenido, String creador) {
        Documento documento = Documento.builder()
                .solicitudId(solicitud.getId()).nombre(nombre).descripcion(desc).tipo("COLLABORATIVE").versionActual(1).creadoPor(creador)
                .fechaCreacion(LocalDateTime.now()).fechaActualizacion(LocalDateTime.now()).contenidoColaborativo(contenido).build();
        documentoRepository.save(documento);
    }
}

package com.workflow.service.impl;

import com.workflow.domain.model.WorkflowDefinition;
import com.workflow.repository.WorkflowDefinitionRepository;
import com.workflow.service.WorkflowDefinitionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowDefinitionServiceImpl implements WorkflowDefinitionService {

    private final WorkflowDefinitionRepository repository;

    private static final String COMPLEX_BPMN_XML = 
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            "<bpmn:definitions xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
            "xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" " +
            "xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\" " +
            "xmlns:dc=\"http://www.omg.org/spec/DD/20100524/DC\" " +
            "xmlns:di=\"http://www.omg.org/spec/DD/20100524/DI\" " +
            "xmlns:wf=\"http://workflow.com/schema/bpmn\" id=\"Definitions_1\" " +
            "targetNamespace=\"http://bpmn.io/schema/bpmn\">\n" +
            "  <bpmn:collaboration id=\"Collaboration_1\">\n" +
            "    <bpmn:participant id=\"Participant_1\" name=\"Proceso Departamental de Workflow\" processRef=\"Process_1\" />\n" +
            "  </bpmn:collaboration>\n" +
            "  <bpmn:process id=\"Process_1\" isExecutable=\"true\">\n" +
            "    <bpmn:laneSet id=\"LaneSet_1\">\n" +
            "      <bpmn:lane id=\"Lane_1\" name=\"Departamento Solicitante (Sistemas)\" wf:departamento=\"Sistemas\">\n" +
            "        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>Activity_Pendiente</bpmn:flowNodeRef>\n" +
            "      </bpmn:lane>\n" +
            "      <bpmn:lane id=\"Lane_2\" name=\"Revisión Técnica (Finanzas)\" wf:departamento=\"Finanzas\">\n" +
            "        <bpmn:flowNodeRef>Activity_Revision</bpmn:flowNodeRef>\n" +
            "      </bpmn:lane>\n" +
            "      <bpmn:lane id=\"Lane_3\" name=\"Cierre y Resolución (Legal)\" wf:departamento=\"Legal\">\n" +
            "        <bpmn:flowNodeRef>Activity_Aprobado</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>Activity_Rechazado</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>Gateway_Decision</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>EndEvent_Aprobado</bpmn:flowNodeRef>\n" +
            "        <bpmn:flowNodeRef>EndEvent_Rechazado</bpmn:flowNodeRef>\n" +
            "      </bpmn:lane>\n" +
            "    </bpmn:laneSet>\n" +
            "    <bpmn:startEvent id=\"StartEvent_1\" name=\"Inicio de Trámite\">\n" +
            "      <bpmn:outgoing>Flow_1</bpmn:outgoing>\n" +
            "    </bpmn:startEvent>\n" +
            "    <bpmn:userTask id=\"Activity_Pendiente\" name=\"Bandeja de Entrada / Pendientes\" wf:departamento=\"Sistemas\">\n" +
            "      <bpmn:incoming>Flow_1</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_2</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:userTask id=\"Activity_Revision\" name=\"Evaluación Técnica y Financiera\" wf:departamento=\"Finanzas\">\n" +
            "      <bpmn:incoming>Flow_2</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_3</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:exclusiveGateway id=\"Gateway_Decision\" name=\"¿Cumple Criterios?\">\n" +
            "      <bpmn:incoming>Flow_3</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_Aprobar</bpmn:outgoing>\n" +
            "      <bpmn:outgoing>Flow_Rechazar</bpmn:outgoing>\n" +
            "    </bpmn:exclusiveGateway>\n" +
            "    <bpmn:userTask id=\"Activity_Aprobado\" name=\"Solicitud Aprobada y Firmada\" wf:departamento=\"Legal\">\n" +
            "      <bpmn:incoming>Flow_Aprobar</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_4</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:userTask id=\"Activity_Rechazado\" name=\"Notificación de Rechazo\" wf:departamento=\"Legal\">\n" +
            "      <bpmn:incoming>Flow_Rechazar</bpmn:incoming>\n" +
            "      <bpmn:outgoing>Flow_5</bpmn:outgoing>\n" +
            "    </bpmn:userTask>\n" +
            "    <bpmn:endEvent id=\"EndEvent_Aprobado\" name=\"Trámite Finalizado OK\">\n" +
            "      <bpmn:incoming>Flow_4</bpmn:incoming>\n" +
            "    </bpmn:endEvent>\n" +
            "    <bpmn:endEvent id=\"EndEvent_Rechazado\" name=\"Trámite Archiva\">\n" +
            "      <bpmn:incoming>Flow_5</bpmn:incoming>\n" +
            "    </bpmn:endEvent>\n" +
            "    <bpmn:sequenceFlow id=\"Flow_1\" sourceRef=\"StartEvent_1\" targetRef=\"Activity_Pendiente\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_2\" sourceRef=\"Activity_Pendiente\" targetRef=\"Activity_Revision\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_3\" sourceRef=\"Activity_Revision\" targetRef=\"Gateway_Decision\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Aprobar\" name=\"Sí\" sourceRef=\"Gateway_Decision\" targetRef=\"Activity_Aprobado\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_Rechazar\" name=\"No\" sourceRef=\"Gateway_Decision\" targetRef=\"Activity_Rechazado\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_4\" sourceRef=\"Activity_Aprobado\" targetRef=\"EndEvent_Aprobado\" />\n" +
            "    <bpmn:sequenceFlow id=\"Flow_5\" sourceRef=\"Activity_Rechazado\" targetRef=\"EndEvent_Rechazado\" />\n" +
            "  </bpmn:process>\n" +
            "  <bpmndi:BPMNDiagram id=\"BPMNDiagram_1\">\n" +
            "    <bpmndi:BPMNPlane id=\"BPMNPlane_1\" bpmnElement=\"Collaboration_1\">\n" +
            "      <bpmndi:BPMNShape id=\"Participant_1_di\" bpmnElement=\"Participant_1\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"120\" y=\"80\" width=\"800\" height=\"650\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Lane_1_di\" bpmnElement=\"Lane_1\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"150\" y=\"80\" width=\"770\" height=\"200\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Lane_2_di\" bpmnElement=\"Lane_2\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"150\" y=\"280\" width=\"770\" height=\"200\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Lane_3_di\" bpmnElement=\"Lane_3\" isHorizontal=\"true\">\n" +
            "        <dc:Bounds x=\"150\" y=\"480\" width=\"770\" height=\"250\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"StartEvent_1_di\" bpmnElement=\"StartEvent_1\">\n" +
            "        <dc:Bounds x=\"192\" y=\"162\" width=\"36\" height=\"36\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_Pendiente_di\" bpmnElement=\"Activity_Pendiente\">\n" +
            "        <dc:Bounds x=\"280\" y=\"140\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_Revision_di\" bpmnElement=\"Activity_Revision\">\n" +
            "        <dc:Bounds x=\"420\" y=\"340\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Gateway_Decision_di\" bpmnElement=\"Gateway_Decision\" isMarkerVisible=\"true\">\n" +
            "        <dc:Bounds x=\"565\" y=\"585\" width=\"50\" height=\"50\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_Aprobado_di\" bpmnElement=\"Activity_Aprobado\">\n" +
            "        <dc:Bounds x=\"670\" y=\"510\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"Activity_Rechazado_di\" bpmnElement=\"Activity_Rechazado\">\n" +
            "        <dc:Bounds x=\"670\" y=\"620\" width=\"100\" height=\"80\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"EndEvent_Aprobado_di\" bpmnElement=\"EndEvent_Aprobado\">\n" +
            "        <dc:Bounds x=\"832\" y=\"532\" width=\"36\" height=\"36\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNShape id=\"EndEvent_Rechazado_di\" bpmnElement=\"EndEvent_Rechazado\">\n" +
            "        <dc:Bounds x=\"832\" y=\"642\" width=\"36\" height=\"36\" />\n" +
            "      </bpmndi:BPMNShape>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_1_di\" bpmnElement=\"Flow_1\">\n" +
            "        <di:waypoint x=\"228\" y=\"180\" />\n" +
            "        <di:waypoint x=\"280\" y=\"180\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_2_di\" bpmnElement=\"Flow_2\">\n" +
            "        <di:waypoint x=\"330\" y=\"220\" />\n" +
            "        <di:waypoint x=\"330\" y=\"380\" />\n" +
            "        <di:waypoint x=\"420\" y=\"380\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_3_di\" bpmnElement=\"Flow_3\">\n" +
            "        <di:waypoint x=\"470\" y=\"420\" />\n" +
            "        <di:waypoint x=\"470\" y=\"610\" />\n" +
            "        <di:waypoint x=\"565\" y=\"610\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Aprobar_di\" bpmnElement=\"Flow_Aprobar\">\n" +
            "        <di:waypoint x=\"590\" y=\"585\" />\n" +
            "        <di:waypoint x=\"590\" y=\"550\" />\n" +
            "        <di:waypoint x=\"670\" y=\"550\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_Rechazar_di\" bpmnElement=\"Flow_Rechazar\">\n" +
            "        <di:waypoint x=\"590\" y=\"635\" />\n" +
            "        <di:waypoint x=\"590\" y=\"660\" />\n" +
            "        <di:waypoint x=\"670\" y=\"660\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_4_di\" bpmnElement=\"Flow_4\">\n" +
            "        <di:waypoint x=\"770\" y=\"550\" />\n" +
            "        <di:waypoint x=\"832\" y=\"550\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "      <bpmndi:BPMNEdge id=\"Flow_5_di\" bpmnElement=\"Flow_5\">\n" +
            "        <di:waypoint x=\"770\" y=\"660\" />\n" +
            "        <di:waypoint x=\"832\" y=\"660\" />\n" +
            "      </bpmndi:BPMNEdge>\n" +
            "    </bpmndi:BPMNPlane>\n" +
            "  </bpmndi:BPMNDiagram>\n" +
            "</bpmn:definitions>";

    @Override
    public List<WorkflowDefinition> listarTodos() {
        if (repository.count() == 0) {
            seedDefinitions();
        }
        
        // Return the latest version for each unique key
        return repository.findAll().stream()
                .collect(Collectors.groupingBy(WorkflowDefinition::getKey,
                        Collectors.collectingAndThen(
                                Collectors.maxBy((a, b) -> Long.compare(a.getVersion(), b.getVersion())),
                                Optional::get
                        )))
                .values().stream()
                .collect(Collectors.toList());
    }

    private void seedDefinitions() {
        log.info("[Seeding] Inyectando definiciones de procesos de negocio...");
        repository.save(WorkflowDefinition.builder()
                .key("procurement-workflow")
                .name("Proceso de Compras y Contrataciones")
                .description("Flujo departamental de compras, validación legal y aprobación de SLAs.")
                .xml(COMPLEX_BPMN_XML)
                .editadoPor("admin")
                .departamentoEditor("Sistemas")
                .comentario("Definición maestra de compras")
                .version(1)
                .build());

        repository.save(WorkflowDefinition.builder()
                .key("hr-recruitment-workflow")
                .name("Proceso de Selección y Onboarding")
                .description("Flujo de contratación de personal, revisión de hojas de vida y bienvenida.")
                .xml(COMPLEX_BPMN_XML)
                .editadoPor("admin")
                .departamentoEditor("Recursos Humanos")
                .comentario("Definición maestra de RRHH")
                .version(1)
                .build());

        repository.save(WorkflowDefinition.builder()
                .key("sales-discount-workflow")
                .name("Proceso Comercial y Descuentos")
                .description("Flujo de análisis de márgenes, validación crediticia y descuentos extraordinarios.")
                .xml(COMPLEX_BPMN_XML)
                .editadoPor("admin")
                .departamentoEditor("Ventas")
                .comentario("Definición maestra de Ventas")
                .version(1)
                .build());
    }

    @Override
    public void resetAndSeed() {
        log.warn("[Reset-Seed] Eliminando TODAS las definiciones de workflow y re-inyectando maestros.");
        repository.deleteAll();
        seedDefinitions();
    }

    @Override
    public Optional<WorkflowDefinition> obtenerPorId(String id) {
        return repository.findById(id);
    }

    @Override
    public Optional<WorkflowDefinition> obtenerPorKey(String key) {
        return repository.findFirstByKeyOrderByVersionDesc(key);
    }

    @Override
    public WorkflowDefinition guardarOActualizar(WorkflowDefinition def, String usuario, String departamento) {
        if (!StringUtils.hasText(def.getKey())) {
            throw new IllegalArgumentException("La llave (key) del workflow no puede estar vacía");
        }
        if (!StringUtils.hasText(def.getXml())) {
            def.setXml(COMPLEX_BPMN_XML);
        }

        WorkflowDefinition existing = repository.findFirstByKeyOrderByVersionDesc(def.getKey())
                .orElse(null);

        if (existing != null) {
            existing.setName(def.getName() != null ? def.getName() : existing.getName());
            existing.setDescription(def.getDescription() != null ? def.getDescription() : existing.getDescription());
            existing.setXml(def.getXml());
            if (def.getFormularios() != null) {
                existing.setFormularios(def.getFormularios());
            }
            existing.setEditadoPor(usuario);
            existing.setDepartamentoEditor(departamento);
            existing.setComentario(def.getComentario() != null ? def.getComentario() : "Modificación de workflow");
            existing.setVersion(existing.getVersion() + 1);
            return repository.save(existing);
        } else {
            def.setEditadoPor(usuario);
            def.setDepartamentoEditor(departamento);
            if (!StringUtils.hasText(def.getComentario())) {
                def.setComentario("Creado desde el Diseñador BPMN");
            }
            def.setVersion(1);
            return repository.save(def);
        }
    }
}

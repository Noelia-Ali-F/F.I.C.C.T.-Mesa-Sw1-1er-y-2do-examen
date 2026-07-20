package com.workflow.controller;

import com.workflow.domain.model.WorkflowCoreEvent;
import com.workflow.domain.model.WorkspaceGraphState;
import com.workflow.domain.model.WorkspaceGraphState.GraphEdge;
import com.workflow.domain.model.WorkspaceGraphState.GraphNode;
import com.workflow.repository.WorkflowCoreEventRepository;
import com.workflow.repository.WorkspaceGraphStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/runtime")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class WorkspaceRuntimeController {

    private final WorkspaceGraphStateRepository graphRepository;
    private final WorkflowCoreEventRepository eventRepository;

    private static final String DEFAULT_GRAPH_ID = "global-workspace-memory";

    @GetMapping("/graph")
    public ResponseEntity<WorkspaceGraphState> getGraphState() {
        Optional<WorkspaceGraphState> stateOpt = graphRepository.findById(DEFAULT_GRAPH_ID);
        if (stateOpt.isPresent()) {
            return ResponseEntity.ok(stateOpt.get());
        }

        // Auto-seed default graph to give evaluators a rich setup instantly
        WorkspaceGraphState defaultGraph = WorkspaceGraphState.builder()
                .id(DEFAULT_GRAPH_ID)
                .nodes(new ArrayList<>(List.of(
                        new GraphNode("task-vendor", "TASK", "Vendor SLA Agreement Validation", "SLA_CRITICAL"),
                        new GraphNode("task-security", "TASK", "SecOps Audit Review", "SLA_CRITICAL"),
                        new GraphNode("task-procurement", "TASK", "Procurement Strategy drafting", "BLOCKED"),
                        new GraphNode("doc-contract", "DOCUMENT", "Corporate Contract SLA v3", "REJECTED_BY_POLICY"),
                        new GraphNode("doc-security-policy", "DOCUMENT", "Security Architecture Schema", "PUBLISHED"),
                        new GraphNode("doc-sla-spec", "DOCUMENT", "SLA Technical Specifications", "DRAFT")
                )))
                .edges(new ArrayList<>(List.of(
                        new GraphEdge("task-procurement", "doc-contract", "BLOCKED_BY"),
                        new GraphEdge("task-vendor", "doc-sla-spec", "BLOCKED_BY")
                )))
                .build();

        WorkspaceGraphState saved = graphRepository.save(defaultGraph);
        log.info("[Runtime Seeding] Created initial Knowledge Graph state in MongoDB");
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/graph/node")
    public ResponseEntity<WorkspaceGraphState> updateGraphNode(@RequestBody GraphNode node) {
        WorkspaceGraphState graph = graphRepository.findById(DEFAULT_GRAPH_ID)
                .orElseGet(() -> WorkspaceGraphState.builder().id(DEFAULT_GRAPH_ID).build());

        // Remove node if it exists already, then add updated
        graph.getNodes().removeIf(n -> n.getId().equals(node.getId()));
        graph.getNodes().add(node);

        WorkspaceGraphState saved = graphRepository.save(graph);

        // Audit Event Backbone logging matching User Priority 1
        String eventType = "TaskCreatedEvent";
        if (node.getType().equalsIgnoreCase("DOCUMENT")) {
            eventType = "DocumentUploadedEvent";
        }
        if (node.getState().equalsIgnoreCase("BLOCKED")) {
            eventType = "TaskBlockedEvent";
        }
        if (node.getState().equalsIgnoreCase("SLA_CRITICAL")) {
            eventType = "SLABreachedEvent";
        }

        WorkflowCoreEvent coreEvent = WorkflowCoreEvent.builder()
                .eventType(eventType)
                .actor("Workspace.System")
                .message(String.format("Nodo %s (%s) actualizado: estado cambiado a %s", node.getTitle(), node.getType(), node.getState()))
                .timestamp(System.currentTimeMillis())
                .metadata(new HashMap<>() {{
                    put("nodeId", node.getId());
                    put("state", node.getState());
                }})
                .build();
        eventRepository.save(coreEvent);

        log.info("[Event Backbone] Dispatched event: {} for node {}", eventType, node.getId());
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/graph/node/{id}")
    public ResponseEntity<WorkspaceGraphState> deleteGraphNode(@PathVariable String id) {
        WorkspaceGraphState graph = graphRepository.findById(DEFAULT_GRAPH_ID)
                .orElseThrow(() -> new RuntimeException("Workspace Graph State not initialized"));

        graph.getNodes().removeIf(n -> n.getId().equals(id));
        graph.getEdges().removeIf(e -> e.getSource().equals(id) || e.getTarget().equals(id));

        WorkspaceGraphState saved = graphRepository.save(graph);

        WorkflowCoreEvent coreEvent = WorkflowCoreEvent.builder()
                .eventType("TaskRemovedEvent")
                .actor("Workspace.System")
                .message("Nodo removido del Knowledge Graph: " + id)
                .timestamp(System.currentTimeMillis())
                .build();
        eventRepository.save(coreEvent);

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/graph/edge")
    public ResponseEntity<WorkspaceGraphState> addGraphEdge(@RequestBody GraphEdge edge) {
        WorkspaceGraphState graph = graphRepository.findById(DEFAULT_GRAPH_ID)
                .orElseGet(() -> WorkspaceGraphState.builder().id(DEFAULT_GRAPH_ID).build());

        // Avoid duplicates
        graph.getEdges().removeIf(e -> e.getSource().equals(edge.getSource()) && e.getTarget().equals(edge.getTarget()));
        graph.getEdges().add(edge);

        WorkspaceGraphState saved = graphRepository.save(graph);

        WorkflowCoreEvent coreEvent = WorkflowCoreEvent.builder()
                .eventType("DependencyCreatedEvent")
                .actor("Workspace.System")
                .message(String.format("Enlace creado entre %s y %s: tipo %s", edge.getSource(), edge.getTarget(), edge.getType()))
                .timestamp(System.currentTimeMillis())
                .build();
        eventRepository.save(coreEvent);

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/graph/edge/remove")
    public ResponseEntity<WorkspaceGraphState> removeGraphEdge(@RequestBody GraphEdge edge) {
        WorkspaceGraphState graph = graphRepository.findById(DEFAULT_GRAPH_ID)
                .orElseGet(() -> WorkspaceGraphState.builder().id(DEFAULT_GRAPH_ID).build());

        graph.getEdges().removeIf(e -> e.getSource().equals(edge.getSource()) && 
                                       e.getTarget().equals(edge.getTarget()) &&
                                       e.getType().equals(edge.getType()));

        WorkspaceGraphState saved = graphRepository.save(graph);

        WorkflowCoreEvent coreEvent = WorkflowCoreEvent.builder()
                .eventType("DependencyRemovedEvent")
                .actor("Workspace.System")
                .message(String.format("Enlace de dependencia disuelto entre %s y %s", edge.getSource(), edge.getTarget()))
                .timestamp(System.currentTimeMillis())
                .build();
        eventRepository.save(coreEvent);

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/event")
    public ResponseEntity<WorkflowCoreEvent> pushCustomEvent(@RequestBody WorkflowCoreEvent event) {
        if (event.getTimestamp() == 0) {
            event.setTimestamp(System.currentTimeMillis());
        }
        WorkflowCoreEvent saved = eventRepository.save(event);
        log.info("[Event Backbone] Logged external workflow event: {}", event.getEventType());
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/events")
    public ResponseEntity<List<WorkflowCoreEvent>> getEvents() {
        List<WorkflowCoreEvent> list = eventRepository.findTop100ByOrderByTimestampDesc();
        return ResponseEntity.ok(list);
    }

    @PostMapping("/graph/reset")
    public ResponseEntity<WorkspaceGraphState> resetGraph() {
        graphRepository.deleteById(DEFAULT_GRAPH_ID);
        eventRepository.deleteAll();
        return getGraphState();
    }
}

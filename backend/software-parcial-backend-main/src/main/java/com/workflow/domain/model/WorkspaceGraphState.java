package com.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

/**
 * Persistencia del Knowledge Graph y estado de WorkspaceMemory.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "workspace_graph_states")
public class WorkspaceGraphState {

    @Id
    private String id;

    @Builder.Default
    private List<GraphNode> nodes = new ArrayList<>();

    @Builder.Default
    private List<GraphEdge> edges = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GraphNode {
        private String id;
        private String type; // TASK, DOCUMENT
        private String title;
        private String state; // ACTIVE, SLA_CRITICAL, BLOCKED, PUBLISHED, etc.
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GraphEdge {
        private String source;
        private String target;
        private String type; // BLOCKED_BY, VALIDATES, etc.
    }
}

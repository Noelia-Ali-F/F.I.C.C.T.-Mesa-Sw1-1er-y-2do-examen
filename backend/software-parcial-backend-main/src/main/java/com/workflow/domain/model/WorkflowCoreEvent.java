package com.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Map;

/**
 * Evento del Event Backbone centralizado para auditoría y timeline reactivo.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "workflow_core_events")
public class WorkflowCoreEvent {

    @Id
    private String id;

    private String eventType;

    private String actor;

    private String message;

    private long timestamp;

    private Map<String, Object> metadata;
}

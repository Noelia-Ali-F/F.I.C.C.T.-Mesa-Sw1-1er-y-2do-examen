package com.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "workflow_definitions")
public class WorkflowDefinition {

    @Id
    private String id;

    private String key;
    private String name;
    private String description;
    private String xml;
    private String editadoPor;
    private String departamentoEditor;
    private String comentario;

    @Builder.Default
    private long version = 1;

    /** 
     * Configuración de formularios dinámicos por ID de tarea BPMN.
     * Key: ActivityId (ej: Activity_123)
     * Value: Lista de definiciones de campos
     */
    @Builder.Default
    private java.util.Map<String, java.util.List<FormFieldDefinition>> formularios = new java.util.HashMap<>();

    @CreatedDate
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    private LocalDateTime fechaActualizacion;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FormFieldDefinition {
        private String name;        // ID técnico del campo (ej: "monto_solicitado")
        private String label;       // Etiqueta para el usuario (ej: "Monto Solicitado")
        private String type;        // text, number, date, select, checkbox, table
        private boolean required;
        private String placeholder;
        private String options;     // Para tipo select, separado por comas
        private String columns;     // Para tipo table, nombres de columna separados por comas
        private String validation;  // Regex o regla simple
    }
}

package com.workflow.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Respuesta con datos del diagrama BPMN persistido.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DiagramaBpmnResponse {

    private String xml;
    private String editadoPor;
    private String departamentoEditor;
    private String comentario;
    private long version;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaActualizacion;
}

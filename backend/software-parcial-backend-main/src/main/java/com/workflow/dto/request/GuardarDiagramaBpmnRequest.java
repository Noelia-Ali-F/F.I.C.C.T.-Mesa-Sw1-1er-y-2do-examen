package com.workflow.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body para guardar el diagrama BPMN.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GuardarDiagramaBpmnRequest {

    @NotBlank(message = "El XML del diagrama es obligatorio")
    private String xml;

    /** Comentario opcional sobre el cambio */
    private String comentario;
}

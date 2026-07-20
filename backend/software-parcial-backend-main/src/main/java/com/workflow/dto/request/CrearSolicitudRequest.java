package com.workflow.dto.request;

import com.workflow.domain.enums.Prioridad;
import com.workflow.domain.enums.RolUsuario;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para la creación de una nueva solicitud de workflow.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CrearSolicitudRequest {

    @NotBlank(message = "El título es obligatorio")
    @Size(min = 5, max = 200, message = "El título debe tener entre 5 y 200 caracteres")
    private String titulo;

    @NotBlank(message = "La descripción es obligatoria")
    @Size(min = 10, max = 2000, message = "La descripción debe tener entre 10 y 2000 caracteres")
    private String descripcion;

    @NotNull(message = "La prioridad es obligatoria")
    private Prioridad prioridad;

    @NotBlank(message = "El departamento es obligatorio")
    private String departamentoDestino;

    private String workflowDefinitionId;
}

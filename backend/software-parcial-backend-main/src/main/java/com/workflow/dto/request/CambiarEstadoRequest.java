package com.workflow.dto.request;

import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.enums.RolUsuario;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para cambiar el estado de una solicitud de workflow.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CambiarEstadoRequest {

    @NotNull(message = "El nuevo estado es obligatorio")
    private EstadoWorkflow nuevoEstado;

    @Size(max = 500, message = "El comentario no puede exceder los 500 caracteres")
    private String comentario;

    private java.util.Map<String, Object> datosFormulario;
}

package com.workflow.dto.request;

import com.workflow.domain.enums.RolUsuario;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO para reasignar una solicitud a otro departamento (solo ADMINISTRADOR).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReasignarDepartamentoRequest {

    @NotBlank(message = "El nuevo departamento es obligatorio")
    private String nuevoDepartamento;

    private String comentario;
}

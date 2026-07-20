package com.workflow.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Peticion para crear un departamento")
public class CrearDepartamentoRequest {

    @NotBlank(message = "El nombre del departamento es obligatorio")
    @Size(min = 2, max = 60, message = "El nombre debe tener entre 2 y 60 caracteres")
    @Schema(description = "Nombre del departamento", example = "Recursos Humanos")
    private String nombre;

    @Size(max = 200, message = "La descripcion no puede superar 200 caracteres")
    @Schema(description = "Descripcion opcional", example = "Gestiona contratos y nomina")
    private String descripcion;
}

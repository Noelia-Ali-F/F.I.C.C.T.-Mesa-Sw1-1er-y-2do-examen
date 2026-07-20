package com.workflow.dto.request;

import com.workflow.domain.enums.RolUsuario;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Petición para crear un usuario desde administración")
public class CrearUsuarioRequest {

    @NotBlank(message = "El nombre de usuario es obligatorio")
    @Schema(description = "Nombre de usuario único", example = "ana.revisora")
    private String username;

    @NotBlank(message = "La contraseña es obligatoria")
    @Schema(description = "Contraseña en texto plano para esta demo", example = "123456")
    private String password;

    @NotBlank(message = "El nombre completo es obligatorio")
    @Schema(description = "Nombre completo del usuario", example = "Ana Revisora")
    private String nombreCompleto;

    @NotNull(message = "El rol del usuario es obligatorio")
    @Schema(description = "Rol del usuario", example = "REVISOR")
    private RolUsuario rol;

    @Schema(description = "Departamento. Requerido para SOLICITANTE y REVISOR", example = "Sistemas")
    private String departamento;
}
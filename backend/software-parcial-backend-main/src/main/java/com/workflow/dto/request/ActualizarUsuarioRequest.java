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
@Schema(description = "Petición para actualizar un usuario desde administración")
public class ActualizarUsuarioRequest {

    @NotBlank(message = "El nombre completo es obligatorio")
    @Schema(description = "Nombre completo del usuario", example = "Ana Patricia Revisora")
    private String nombreCompleto;

    @NotNull(message = "El rol del usuario es obligatorio")
    @Schema(description = "Rol del usuario", example = "REVISOR")
    private RolUsuario rol;

    @Schema(description = "Departamento. Requerido para SOLICITANTE y REVISOR", example = "Sistemas")
    private String departamento;

    @Schema(description = "Contraseña nueva opcional. Si se omite, se conserva la actual", example = "nueva-clave")
    private String password;

    @Schema(description = "URL de la foto de perfil", example = "https://example.com/avatar.png")
    private String avatarUrl;
}
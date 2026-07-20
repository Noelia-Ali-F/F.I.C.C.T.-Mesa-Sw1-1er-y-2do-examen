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
@Schema(description = "Petición de registro de nuevo usuario")
public class RegisterRequest {

    @NotBlank(message = "El nombre de usuario es obligatorio")
    @Schema(description = "Nombre de usuario", example = "maria.revisora")
    private String username;

    @NotBlank(message = "La contraseña es obligatoria")
    @Schema(description = "Contraseña en texto plano", example = "123456")
    private String password;

    @NotBlank(message = "El nombre completo es obligatorio")
    @Schema(description = "Nombre completo del usuario", example = "Maria Lopez")
    private String nombreCompleto;

    @NotNull(message = "El rol del usuario es obligatorio")
    @Schema(description = "Rol del usuario en el sistema", example = "REVISOR")
    private RolUsuario rol;

    @Schema(description = "Departamento al que pertenece (obligatorio para REVISOR o SOLICITANTE en algunos casos)", example = "Recursos Humanos")
    private String departamento;
}

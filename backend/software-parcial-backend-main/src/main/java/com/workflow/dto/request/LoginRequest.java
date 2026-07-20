package com.workflow.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Petición de inicio de sesión")
public class LoginRequest {

    @NotBlank(message = "El nombre de usuario es obligatorio")
    @Schema(description = "Nombre de usuario", example = "admin")
    private String username;

    @NotBlank(message = "La contraseña es obligatoria")
    @Schema(description = "Contraseña en texto plano (solo para pruebas)", example = "admin")
    private String password;
}

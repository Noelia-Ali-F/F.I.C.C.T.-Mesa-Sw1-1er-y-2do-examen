package com.workflow.dto.response;

import com.workflow.domain.enums.RolUsuario;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Respuesta tras un login o registro exitoso")
public class AuthResponse {

    @Schema(description = "Token de autenticación simulado o JWT en el futuro", example = "token-simulado-admin")
    private String token;

    @Schema(description = "Nombre de usuario", example = "admin")
    private String username;

    @Schema(description = "Nombre completo del usuario", example = "Administrador del Sistema")
    private String nombreCompleto;

    @Schema(description = "Rol del usuario", example = "ADMINISTRADOR")
    private RolUsuario rol;

    @Schema(description = "Departamento del usuario", example = "Sistemas")
    private String departamento;

    @Schema(description = "URL del avatar del usuario", example = "https://ui-avatars.com/api/?name=Admin&background=random&bold=true&size=128")
    private String avatarUrl;
}

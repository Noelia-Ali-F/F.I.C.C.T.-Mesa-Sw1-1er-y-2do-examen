package com.workflow.dto.response;

import com.workflow.domain.enums.RolUsuario;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Datos públicos de usuario para administración")
public class UsuarioAdminResponse {

    @Schema(description = "ID interno de MongoDB")
    private String id;

    @Schema(description = "Nombre de usuario", example = "ana.revisora")
    private String username;

    @Schema(description = "Nombre completo", example = "Ana Revisora")
    private String nombreCompleto;

    @Schema(description = "Rol del usuario", example = "REVISOR")
    private RolUsuario rol;

    @Schema(description = "Departamento asociado")
    private String departamento;

    @Schema(description = "Fecha de creación")
    private LocalDateTime fechaCreacion;

    @Schema(description = "URL de la foto de perfil")
    private String avatarUrl;
}
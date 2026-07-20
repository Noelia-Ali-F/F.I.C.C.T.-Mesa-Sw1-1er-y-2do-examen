package com.workflow.dto.response;

import com.workflow.domain.enums.RolUsuario;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO de presencia en linea para un usuario activo en la plataforma.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresenciaUsuarioResponse {

    private String username;
    private String nombreCompleto;
    private RolUsuario rol;
    private String departamento;
    private String avatarUrl;
    private LocalDateTime ultimoLatido;
}

package com.workflow.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Resumen colaborativo de usuarios conectados para dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresenciaResumenResponse {

    private long totalOnlineSistema;
    private long totalOnlineVisible;
    private long totalEnDepartamento;
    private String departamentoContexto;
    private List<PresenciaUsuarioResponse> usuariosOnline;
    private List<PresenciaUsuarioResponse> usuariosDepartamento;
    private LocalDateTime generadoEn;
}

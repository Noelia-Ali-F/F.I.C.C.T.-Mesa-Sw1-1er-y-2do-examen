package com.workflow.service;

import com.workflow.domain.enums.RolUsuario;
import com.workflow.dto.response.PresenciaResumenResponse;

/**
 * Contrato para monitoreo de presencia colaborativa en tiempo real.
 */
public interface PresenciaService {

    /**
     * Registra/actualiza el heartbeat del usuario autenticado.
     */
    void registrarHeartbeat(String usuarioContexto, RolUsuario rolContexto, String departamentoContexto);

    /**
     * Cierra la sesion de presencia del usuario autenticado de forma inmediata.
     */
    void cerrarSesion(String usuarioContexto, RolUsuario rolContexto, String departamentoContexto);

    /**
     * Obtiene resumen de usuarios online global y del departamento de trabajo.
     */
    PresenciaResumenResponse obtenerResumen(String usuarioSolicitante, RolUsuario rolSolicitante, String departamentoSolicitante);
}

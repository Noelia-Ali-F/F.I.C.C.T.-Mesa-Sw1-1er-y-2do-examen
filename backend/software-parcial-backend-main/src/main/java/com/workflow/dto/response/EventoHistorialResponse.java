package com.workflow.dto.response;

import com.workflow.domain.enums.EstadoWorkflow;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO de respuesta para un evento del historial.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventoHistorialResponse {

    private LocalDateTime fecha;
    private EstadoWorkflow estadoAnterior;
    private EstadoWorkflow estadoNuevo;
    private String usuarioResponsable;
    private String rolUsuario;
    private String comentario;
}

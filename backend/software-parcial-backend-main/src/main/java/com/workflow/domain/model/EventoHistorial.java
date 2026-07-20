package com.workflow.domain.model;

import com.workflow.domain.enums.EstadoWorkflow;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Registro inmutable de cada transición de estado en el workflow.
 * Se almacena como embedded document dentro de SolicitudWorkflow.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventoHistorial {

    private LocalDateTime fecha;

    private EstadoWorkflow estadoAnterior;

    private EstadoWorkflow estadoNuevo;

    private String usuarioResponsable;

    private String rolUsuario;

    private String comentario;
}

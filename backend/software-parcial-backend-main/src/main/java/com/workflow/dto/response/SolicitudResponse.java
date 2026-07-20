package com.workflow.dto.response;

import com.workflow.domain.enums.EstadoSla;
import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.enums.Prioridad;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO de respuesta con la información completa de una solicitud de workflow.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SolicitudResponse {

    private String id;
    private String codigoSeguimiento;
    private String titulo;
    private String descripcion;
    private Prioridad prioridad;
    private EstadoWorkflow estado;
    private String departamentoActual;
    private String usuarioCreador;
    private String usuarioAsignado;
    private String workflowDefinitionId;
    private String tareaActualId;
    private String tareaActualNombre;
    private List<EventoHistorialResponse> historial;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaActualizacion;
    private LocalDateTime fechaLimiteAtencion;
    private LocalDateTime fechaPrimeraAlertaSla;
    private LocalDateTime fechaEscalamientoSla;
    private List<ArchivoAdjuntoResponse> archivosAdjuntos;

    private java.util.Map<String, Object> datosFormulario;

    private EstadoSla estadoSla;
    private Long minutosRestantesSla;
    private int totalEventos;
}

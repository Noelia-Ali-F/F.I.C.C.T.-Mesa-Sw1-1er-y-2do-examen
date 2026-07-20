package com.workflow.mapper;

import com.workflow.domain.enums.EstadoSla;
import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.enums.Prioridad;
import com.workflow.domain.model.ArchivoAdjunto;
import com.workflow.domain.model.EventoHistorial;
import com.workflow.domain.model.SolicitudWorkflow;
import com.workflow.dto.request.CrearSolicitudRequest;
import com.workflow.dto.response.ArchivoAdjuntoResponse;
import com.workflow.dto.response.EventoHistorialResponse;
import com.workflow.dto.response.SolicitudResponse;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Mapper manual para convertir entre entidades de dominio y DTOs.
 * Evita dependencias en frameworks de mapping (MapStruct) para mayor control.
 */
@Component
public class SolicitudMapper {

    private static final Map<Prioridad, Long> SLA_HORAS_POR_PRIORIDAD = new EnumMap<>(Prioridad.class);

    static {
        SLA_HORAS_POR_PRIORIDAD.put(Prioridad.URGENTE, 4L);
        SLA_HORAS_POR_PRIORIDAD.put(Prioridad.ALTA, 8L);
        SLA_HORAS_POR_PRIORIDAD.put(Prioridad.MEDIA, 24L);
        SLA_HORAS_POR_PRIORIDAD.put(Prioridad.BAJA, 72L);
    }

    /**
     * Convierte una entidad SolicitudWorkflow a su DTO de respuesta.
     */
    public SolicitudResponse toResponse(SolicitudWorkflow solicitud) {
        if (solicitud == null) return null;

        List<EventoHistorialResponse> historialResponse = solicitud.getHistorial() != null
                ? solicitud.getHistorial().stream()
                    .map(this::toEventoResponse)
                    .collect(Collectors.toList())
                : Collections.emptyList();

        LocalDateTime fechaLimiteSla = calcularFechaLimiteFallback(solicitud);

        EstadoSla estadoSla = calcularEstadoSla(solicitud.getEstado(), fechaLimiteSla);
        Long minutosRestantes = calcularMinutosRestantes(estadoSla, fechaLimiteSla);

        List<ArchivoAdjuntoResponse> archivosResponse = solicitud.getArchivosAdjuntos() != null
                ? solicitud.getArchivosAdjuntos().stream()
                    .map(this::toArchivoResponse)
                    .collect(Collectors.toList())
                : Collections.emptyList();

        return SolicitudResponse.builder()
                .id(solicitud.getId())
                .codigoSeguimiento(solicitud.getCodigoSeguimiento())
                .titulo(solicitud.getTitulo())
                .descripcion(solicitud.getDescripcion())
                .prioridad(solicitud.getPrioridad())
                .estado(solicitud.getEstado())
                .departamentoActual(solicitud.getDepartamentoActual())
                .usuarioCreador(solicitud.getUsuarioCreador())
                .usuarioAsignado(solicitud.getUsuarioAsignado())
                .workflowDefinitionId(solicitud.getWorkflowDefinitionId())
                .tareaActualId(solicitud.getTareaActualId())
                .tareaActualNombre(solicitud.getTareaActualNombre())
                .historial(historialResponse)
                .archivosAdjuntos(archivosResponse)
                .datosFormulario(solicitud.getDatosFormulario())
                .fechaCreacion(solicitud.getFechaCreacion())
                .fechaActualizacion(solicitud.getFechaActualizacion())
                .fechaLimiteAtencion(fechaLimiteSla)
                .fechaPrimeraAlertaSla(solicitud.getFechaPrimeraAlertaSla())
                .fechaEscalamientoSla(solicitud.getFechaEscalamientoSla())
                .estadoSla(estadoSla)
                .minutosRestantesSla(minutosRestantes)
                .totalEventos(historialResponse.size())
                .build();
    }

    /**
     * Convierte una lista de entidades a lista de DTOs de respuesta.
     */
    public List<SolicitudResponse> toResponseList(List<SolicitudWorkflow> solicitudes) {
        if (solicitudes == null) return Collections.emptyList();
        return solicitudes.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Convierte un EventoHistorial a su DTO de respuesta.
     */
    public EventoHistorialResponse toEventoResponse(EventoHistorial evento) {
        if (evento == null) return null;

        return EventoHistorialResponse.builder()
                .fecha(evento.getFecha())
                .estadoAnterior(evento.getEstadoAnterior())
                .estadoNuevo(evento.getEstadoNuevo())
                .usuarioResponsable(evento.getUsuarioResponsable())
                .rolUsuario(evento.getRolUsuario())
                .comentario(evento.getComentario())
                .build();
    }

    /**
     * Convierte un ArchivoAdjunto a su DTO de respuesta.
     */
    public ArchivoAdjuntoResponse toArchivoResponse(ArchivoAdjunto archivo) {
        if (archivo == null) return null;

        return ArchivoAdjuntoResponse.builder()
                .id(archivo.getId())
                .nombreOriginal(archivo.getNombreOriginal())
                .tipoContenido(archivo.getTipoContenido())
                .tamanoBytes(archivo.getTamanoBytes())
                .subidoPor(archivo.getSubidoPor())
                .fechaSubida(archivo.getFechaSubida())
                .build();
    }

    /**
     * Convierte un DTO de creación al modelo de dominio.
     */
    public SolicitudWorkflow toEntity(CrearSolicitudRequest request, String codigoSeguimiento, String usuarioCreador) {
        return SolicitudWorkflow.builder()
                .codigoSeguimiento(codigoSeguimiento)
                .titulo(request.getTitulo())
                .descripcion(request.getDescripcion())
                .prioridad(request.getPrioridad())
                .departamentoActual(request.getDepartamentoDestino())
                .usuarioCreador(usuarioCreador)
                .build();
    }

    private LocalDateTime calcularFechaLimiteFallback(SolicitudWorkflow solicitud) {
        if (solicitud.getFechaLimiteAtencion() != null) {
            return solicitud.getFechaLimiteAtencion();
        }

        if (solicitud.getFechaCreacion() == null) {
            return null;
        }

        Prioridad prioridad = solicitud.getPrioridad() != null ? solicitud.getPrioridad() : Prioridad.MEDIA;
        long horas = SLA_HORAS_POR_PRIORIDAD.getOrDefault(prioridad, 24L);
        return solicitud.getFechaCreacion().plusHours(horas);
    }

    private EstadoSla calcularEstadoSla(EstadoWorkflow estado, LocalDateTime fechaLimiteAtencion) {
        if (estado == EstadoWorkflow.APROBADO || estado == EstadoWorkflow.RECHAZADO) {
            return EstadoSla.CERRADO;
        }

        if (fechaLimiteAtencion == null) {
            return EstadoSla.EN_TIEMPO;
        }

        long minutosRestantes = Duration.between(LocalDateTime.now(), fechaLimiteAtencion).toMinutes();
        if (minutosRestantes <= 0) {
            return EstadoSla.VENCIDO;
        }

        if (minutosRestantes <= 240) {
            return EstadoSla.POR_VENCER;
        }

        return EstadoSla.EN_TIEMPO;
    }

    private Long calcularMinutosRestantes(EstadoSla estadoSla, LocalDateTime fechaLimiteAtencion) {
        if (estadoSla == EstadoSla.CERRADO || fechaLimiteAtencion == null) {
            return null;
        }

        return Duration.between(LocalDateTime.now(), fechaLimiteAtencion).toMinutes();
    }
}

package com.workflow.domain.model;

import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.enums.Prioridad;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Documento principal del sistema de workflow departamental.
 * Representa una solicitud que atraviesa diferentes estados y departamentos.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "solicitudes_workflow")
@CompoundIndexes({
    @CompoundIndex(name = "idx_depto_estado", def = "{'departamentoActual': 1, 'estado': 1}"),
    @CompoundIndex(name = "idx_estado_prioridad", def = "{'estado': 1, 'prioridad': 1}"),
    @CompoundIndex(name = "idx_usuario_estado", def = "{'usuarioCreador': 1, 'estado': 1}")
})
public class SolicitudWorkflow {

    @Id
    private String id;

    @Indexed(unique = true)
    private String codigoSeguimiento;

    private String titulo;

    private String descripcion;

    @Builder.Default
    private Prioridad prioridad = Prioridad.MEDIA;

    @Builder.Default
    private EstadoWorkflow estado = EstadoWorkflow.PENDIENTE;

    @Indexed
    private String departamentoActual;

    private String usuarioCreador;

    private String usuarioAsignado;

    private String workflowDefinitionId;

    private String tareaActualId;

    private String tareaActualNombre;

    @Builder.Default
    private List<EventoHistorial> historial = new ArrayList<>();

    @Builder.Default
    private List<ArchivoAdjunto> archivosAdjuntos = new ArrayList<>();

    @Builder.Default
    private java.util.Map<String, Object> datosFormulario = new java.util.HashMap<>();

    @CreatedDate
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    private LocalDateTime fechaActualizacion;

    @Indexed
    private LocalDateTime fechaLimiteAtencion;

    private LocalDateTime fechaPrimeraAlertaSla;

    private LocalDateTime fechaEscalamientoSla;

    /**
     * Agrega un evento de historial atómicamente al workflow.
     */
    public void registrarTransicion(EstadoWorkflow estadoAnterior,
                                     EstadoWorkflow estadoNuevo,
                                     String usuario,
                                     String rol,
                                     String comentario) {
        EventoHistorial evento = EventoHistorial.builder()
                .fecha(LocalDateTime.now())
                .estadoAnterior(estadoAnterior)
                .estadoNuevo(estadoNuevo)
                .usuarioResponsable(usuario)
                .rolUsuario(rol)
                .comentario(comentario)
                .build();

        if (this.historial == null) {
            this.historial = new ArrayList<>();
        }
        this.historial.add(evento);
        this.estado = estadoNuevo;
    }
}

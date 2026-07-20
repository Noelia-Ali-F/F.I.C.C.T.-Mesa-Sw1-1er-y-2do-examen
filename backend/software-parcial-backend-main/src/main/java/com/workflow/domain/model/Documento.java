package com.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entidad principal para la Gestión Documental Avanzada (DMS).
 * Soporta control de versiones, bloqueo colaborativo, documentos en línea y adjuntos de archivos.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "documentos")
public class Documento {

    @Id
    private String id;

    @Indexed
    private String solicitudId; // ID global del caso (Expediente Único)

    @Indexed
    private String policyKey;

    @Indexed
    private String tareaId; // Opcional: ID de la tarea/etapa BPMN donde se generó/necesita

    private String taskInstanceId;

    private String categoria;

    @Builder.Default
    private String formato = "TEXT"; // TEXT, SPREADSHEET o FILE

    @Builder.Default
    private String estado = "BORRADOR";

    private String aprobadoPor;
    private LocalDateTime fechaDecision;
    private String observacionDecision;

    @Builder.Default
    private List<DecisionDocumento> historialDecisiones = new ArrayList<>();

    private String departamentoPropietario;

    private String nombre;

    private String descripcion;

    @Builder.Default
    private String tipo = "FILE"; // "FILE" (adjunto subido) o "COLLABORATIVE" (documento de texto en línea)

    @Builder.Default
    private int versionActual = 1;

    private String creadoPor;

    @CreatedDate
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    private LocalDateTime fechaActualizacion;

    // Campos para control de concurrencia / edición colaborativa
    private String bloqueadoPor; // Usuario que está editando el documento actualmente
    private LocalDateTime bloqueadoAt;

    private String contenidoColaborativo; // Contenido de texto enriquecido si es de tipo "COLLABORATIVE"

    @Builder.Default
    private List<String> colaboradores = new ArrayList<>();

    @Builder.Default
    private List<VersionDocumento> versiones = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VersionDocumento {
        private int version;
        private String nombreAlmacenado; // ID del archivo en disco si es FILE
        private String nombreOriginal;
        private String tipoContenido;
        private long tamanoBytes;
        private String subidoPor;
        private LocalDateTime fechaSubida;
        private String comentarioCambio;
        private String contenidoColaborativoSnapshot; // Snapshot de contenido si es COLLABORATIVE
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DecisionDocumento {
        private String estadoAnterior;
        private String estadoNuevo;
        private String usuario;
        private String rol;
        private String observacion;
        private LocalDateTime fecha;
    }

    public void agregarVersion(VersionDocumento nuevaVersion) {
        if (this.versiones == null) {
            this.versiones = new ArrayList<>();
        }
        this.versiones.add(nuevaVersion);
        this.versionActual = nuevaVersion.getVersion();
    }
}

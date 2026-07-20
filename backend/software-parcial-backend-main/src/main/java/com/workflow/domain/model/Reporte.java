package com.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Entidad para almacenar informes de inteligencia operacional e IA en la base de datos.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "reportes")
public class Reporte {

    @Id
    private String id;

    private String titulo;

    private String descripcion;

    @Builder.Default
    private String tipo = "AI_EXECUTIVE"; // "AI_EXECUTIVE" o "TENSORFLOW_PREDICTION"

    private String contenidoHtml;

    private String creadoPor;

    @CreatedDate
    private LocalDateTime fechaCreacion;

    // Métricas asociadas
    private int totalSolicitudes;
    private int aprobadas;
    private int vencidas;
    private int tasaCierre;
    private int tasaRiesgo;
}

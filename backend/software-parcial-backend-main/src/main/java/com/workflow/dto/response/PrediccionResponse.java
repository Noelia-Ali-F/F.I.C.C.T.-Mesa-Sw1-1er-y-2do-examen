package com.workflow.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrediccionResponse {
    private String solicitudId;
    private double probabilidadExito;    // 0.0 - 1.0
    private double riesgoRetraso;       // 0.0 - 1.0
    private long tiempoEstimadoMinutos;
    private String recomendacionPrioridad;
    private List<String> anomaliasDetectadas;
    private String insightsModel;       // Explicación técnica del motor TensorFlow
}

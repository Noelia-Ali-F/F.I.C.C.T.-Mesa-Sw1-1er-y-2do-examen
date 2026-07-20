package com.workflow.service;

import com.workflow.dto.response.PrediccionResponse;
import java.util.List;
import java.util.Map;

public interface MotorPredictivoService {
    
    /**
     * Realiza un análisis predictivo de una solicitud basado en el historial y el motor TensorFlow.
     */
    PrediccionResponse analizarSolicitud(String solicitudId);

    /**
     * Detecta anomalías globales en el sistema de workflow.
     */
    List<String> detectarAnomaliasGlobales();

    Map<String, Object> recomendarMejorRuta(String solicitudId);

    List<Map<String, Object>> recomendarPrioridades();
}

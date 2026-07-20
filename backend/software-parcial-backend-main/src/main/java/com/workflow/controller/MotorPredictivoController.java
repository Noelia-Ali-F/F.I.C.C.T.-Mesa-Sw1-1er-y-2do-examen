package com.workflow.controller;

import com.workflow.dto.response.ApiResponse;
import com.workflow.dto.response.PrediccionResponse;
import com.workflow.service.MotorPredictivoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/ia/prediccion")
@RequiredArgsConstructor
@Tag(name = "Indicadores operacionales", description = "Análisis determinista de prioridad, SLA, historial y anomalías.")
public class MotorPredictivoController {

    private final MotorPredictivoService predictivoService;

    @GetMapping("/solicitud/{id}")
    @Operation(summary = "Análisis operacional de solicitud", description = "Calcula un indicador trazable con prioridad, SLA e historial persistido.")
    public ResponseEntity<ApiResponse<PrediccionResponse>> analizarSolicitud(@PathVariable String id) {
        log.info("GET /api/v1/ia/prediccion/solicitud/{} - Calculando indicador operacional", id);
        PrediccionResponse analisis = predictivoService.analizarSolicitud(id);
        return ResponseEntity.ok(ApiResponse.ok("Análisis operacional completado", analisis));
    }

    @GetMapping("/anomalias")
    @Operation(summary = "Detección de anomalías globales", description = "Escanea el sistema en busca de cuellos de botella o procesos estancados.")
    public ResponseEntity<ApiResponse<List<String>>> detectarAnomalias() {
        log.info("GET /api/v1/ia/prediccion/anomalias - Escaneo de salud del sistema");
        List<String> anomalias = predictivoService.detectarAnomaliasGlobales();
        return ResponseEntity.ok(ApiResponse.ok("Escaneo de anomalías completado", anomalias));
    }

    @GetMapping("/solicitud/{id}/mejor-ruta")
    @Operation(summary = "Recomendar mejor ruta", description = "Combina el BPMN publicado, la actividad actual, el SLA y el riesgo local.")
    public ResponseEntity<ApiResponse<Map<String, Object>>> recomendarMejorRuta(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok("Ruta recomendada calculada",
                predictivoService.recomendarMejorRuta(id)));
    }

    @GetMapping("/prioridades")
    @Operation(summary = "Recomendar prioridades", description = "Ordena trámites activos con prioridad registrada y riesgo neuronal local.")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> recomendarPrioridades() {
        return ResponseEntity.ok(ApiResponse.ok("Prioridades recomendadas",
                predictivoService.recomendarPrioridades()));
    }
}

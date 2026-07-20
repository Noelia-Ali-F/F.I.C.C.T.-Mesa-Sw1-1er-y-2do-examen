package com.workflow.service.impl;

import com.workflow.domain.enums.Prioridad;
import com.workflow.domain.model.SolicitudWorkflow;
import com.workflow.dto.response.PrediccionResponse;
import com.workflow.repository.SolicitudWorkflowRepository;
import com.workflow.repository.WorkflowDefinitionRepository;
import com.workflow.service.MotorPredictivoService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Comparator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class MotorPredictivoServiceImpl implements MotorPredictivoService {

    private final SolicitudWorkflowRepository repository;
    private final WorkflowDefinitionRepository definitionRepository;
    private final ObjectMapper objectMapper;

    @Value("classpath:models/routing-risk-mlp-v1.json")
    private Resource modelResource;

    private LocalNeuralModel localModel;

    @PostConstruct
    void cargarModeloLocal() {
        try (var input = modelResource.getInputStream()) {
            localModel = objectMapper.readValue(input, LocalNeuralModel.class);
            validarModelo(localModel);
            log.info("Modelo local cargado: {} v{} ({} -> {} -> 1)",
                    localModel.getName(), localModel.getVersion(),
                    localModel.getInputSize(), localModel.getHiddenSize());
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo cargar el modelo neuronal local", e);
        }
    }

    @Override
    public PrediccionResponse analizarSolicitud(String solicitudId) {
        log.info("Iniciando análisis operacional para solicitud: {}", solicitudId);
        
        SolicitudWorkflow solicitud = repository.findById(solicitudId)
                .orElseThrow(() -> new RuntimeException("Solicitud no encontrada"));

        double prioridad = mapearPrioridad(solicitud.getPrioridad());
        long eventos = solicitud.getHistorial() != null ? solicitud.getHistorial().size() : 0;
        long transcurridos = solicitud.getFechaCreacion() == null ? 0
                : Math.max(0, Duration.between(solicitud.getFechaCreacion(), LocalDateTime.now()).toMinutes());
        long restantes = solicitud.getFechaLimiteAtencion() == null ? Long.MAX_VALUE
                : Duration.between(LocalDateTime.now(), solicitud.getFechaLimiteAtencion()).toMinutes();

        double factorSla = restantes <= 0 ? 1.0 : restantes <= 60 ? 0.8 : restantes <= 240 ? 0.45 : 0.1;
        double factorIteracion = Math.min(1.0, eventos / 10.0);
        double riesgo = inferirRiesgo(new double[]{prioridad, factorSla, factorIteracion});
        double probabilidad = 1.0 - riesgo;

        List<String> anomalias = new ArrayList<>();
        if (eventos > 10) anomalias.add("Proceso con más de 10 eventos registrados");
        if (restantes <= 0) anomalias.add("Plazo SLA vencido");
        else if (restantes <= 60) anomalias.add("Plazo SLA próximo a vencer");

        return PrediccionResponse.builder()
                .solicitudId(solicitudId)
                .probabilidadExito(probabilidad)
                .riesgoRetraso(riesgo)
                .tiempoEstimadoMinutos(transcurridos)
                .recomendacionPrioridad(determinarRecomendacion(riesgo, solicitud.getPrioridad()))
                .anomaliasDetectadas(anomalias)
                .insightsModel("Inferencia offline con " + localModel.getName() + " v" + localModel.getVersion()
                        + "; entradas normalizadas: prioridad, SLA e historial persistido. "
                        + "Modelo experimental con datos limitados.")
                .build();
    }

    private double inferirRiesgo(double[] entrada) {
        double[] hidden = new double[localModel.getHiddenSize()];
        for (int h = 0; h < hidden.length; h++) {
            double suma = localModel.getHiddenBias()[h];
            for (int i = 0; i < entrada.length; i++) {
                suma += entrada[i] * localModel.getHiddenWeights()[h][i];
            }
            hidden[h] = Math.max(0.0, suma);
        }
        double salida = localModel.getOutputBias();
        for (int h = 0; h < hidden.length; h++) {
            salida += hidden[h] * localModel.getOutputWeights()[h];
        }
        return 1.0 / (1.0 + Math.exp(-salida));
    }

    private void validarModelo(LocalNeuralModel model) {
        if (model == null || model.getInputSize() != 3 || model.getHiddenSize() <= 0
                || model.getHiddenWeights() == null || model.getHiddenWeights().length != model.getHiddenSize()
                || model.getHiddenBias() == null || model.getHiddenBias().length != model.getHiddenSize()
                || model.getOutputWeights() == null || model.getOutputWeights().length != model.getHiddenSize()) {
            throw new IllegalArgumentException("Arquitectura de modelo local inválida");
        }
    }

    @Data
    public static class LocalNeuralModel {
        private String name;
        private String version;
        private boolean experimental;
        private String warning;
        private String[] featureOrder;
        private int inputSize;
        private int hiddenSize;
        private double[][] hiddenWeights;
        private double[] hiddenBias;
        private double[] outputWeights;
        private double outputBias;
    }

    @Override
    public List<String> detectarAnomaliasGlobales() {
        List<String> globalAnomalias = new ArrayList<>();
        List<SolicitudWorkflow> todas = repository.findAll();
        
        long bloqueados = todas.stream().filter(s -> s.getEstado().name().equals("BLOQUEADO")).count();
        if (bloqueados > 2) globalAnomalias.add("Detección de estancamiento masivo en el flujo departamental");
        todas.forEach(solicitud -> {
            if (solicitud.getFechaLimiteAtencion() != null && solicitud.getFechaLimiteAtencion().isBefore(LocalDateTime.now())) {
                globalAnomalias.add(solicitud.getCodigoSeguimiento() + ": SLA vencido en " + solicitud.getDepartamentoActual());
            }
            if (solicitud.getHistorial() != null && solicitud.getHistorial().size() > 10) {
                globalAnomalias.add(solicitud.getCodigoSeguimiento() + ": historial inusualmente extenso ("
                        + solicitud.getHistorial().size() + " eventos)");
            }
        });
        
        return globalAnomalias;
    }

    @Override
    public Map<String, Object> recomendarMejorRuta(String solicitudId) {
        SolicitudWorkflow solicitud = repository.findById(solicitudId)
                .orElseThrow(() -> new RuntimeException("Solicitud no encontrada"));
        String definitionRef = solicitud.getWorkflowDefinitionId();
        var definition = definitionRef == null ? null : definitionRepository.findById(definitionRef)
                .or(() -> definitionRepository.findFirstByKeyOrderByVersionDesc(definitionRef))
                .orElse(null);

        List<String> siguientes = definition == null
                ? List.of()
                : extraerSiguientes(definition.getXml(), solicitud.getTareaActualId());
        PrediccionResponse prediccion = analizarSolicitud(solicitudId);
        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("solicitudId", solicitudId);
        resultado.put("politica", definition == null ? definitionRef : definition.getKey());
        resultado.put("actividadActual", solicitud.getTareaActualNombre());
        resultado.put("rutaRecomendada", siguientes.isEmpty()
                ? List.of(solicitud.getDepartamentoActual()) : siguientes);
        resultado.put("motivo", siguientes.isEmpty()
                ? "No hay una transición directa identificable; mantener la ruta persistida del trámite."
                : "Transiciones salientes definidas en el BPMN publicado, priorizadas con el riesgo local.");
        resultado.put("elementosConsiderados", List.of("BPMN publicado", "actividad actual", "departamento", "SLA", "riesgo local"));
        resultado.put("riesgoRetraso", prediccion.getRiesgoRetraso());
        return resultado;
    }

    @Override
    public List<Map<String, Object>> recomendarPrioridades() {
        return repository.findAll().stream()
                .filter(s -> !"COMPLETADO".equals(s.getEstado().name()) && !"RECHAZADO".equals(s.getEstado().name()))
                .map(s -> {
                    PrediccionResponse prediction = analizarSolicitud(s.getId());
                    double score = prediction.getRiesgoRetraso() * 0.7 + mapearPrioridad(s.getPrioridad()) * 0.3;
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("solicitudId", s.getId());
                    item.put("codigo", s.getCodigoSeguimiento());
                    item.put("prioridadRegistrada", s.getPrioridad());
                    item.put("riesgoRetraso", prediction.getRiesgoRetraso());
                    item.put("puntuacion", score);
                    item.put("explicacion", prediction.getRecomendacionPrioridad());
                    return item;
                })
                .sorted(Comparator.comparingDouble(item -> -((Number) item.get("puntuacion")).doubleValue()))
                .toList();
    }

    private List<String> extraerSiguientes(String xml, String tareaActualId) {
        if (xml == null || tareaActualId == null) return List.of();
        Pattern flowPattern = Pattern.compile("<(?:bpmn:)?sequenceFlow[^>]*sourceRef=\\\""
                + Pattern.quote(tareaActualId) + "\\\"[^>]*targetRef=\\\"([^\\\"]+)\\\"", Pattern.CASE_INSENSITIVE);
        Matcher flowMatcher = flowPattern.matcher(xml);
        List<String> targets = new ArrayList<>();
        while (flowMatcher.find()) targets.add(flowMatcher.group(1));
        if (targets.isEmpty()) return List.of();

        Pattern nodePattern = Pattern.compile("<(?:bpmn:)?(?:userTask|task|serviceTask|exclusiveGateway|parallelGateway)[^>]*>", Pattern.CASE_INSENSITIVE);
        Matcher nodeMatcher = nodePattern.matcher(xml);
        Map<String, String> labels = new LinkedHashMap<>();
        Pattern idPattern = Pattern.compile("\\bid=\\\"([^\\\"]+)\\\"", Pattern.CASE_INSENSITIVE);
        Pattern namePattern = Pattern.compile("\\bname=\\\"([^\\\"]+)\\\"", Pattern.CASE_INSENSITIVE);
        while (nodeMatcher.find()) {
            String tag = nodeMatcher.group();
            Matcher idMatcher = idPattern.matcher(tag);
            if (!idMatcher.find()) continue;
            Matcher nameMatcher = namePattern.matcher(tag);
            labels.put(idMatcher.group(1), nameMatcher.find() ? nameMatcher.group(1) : idMatcher.group(1));
        }
        return targets.stream().map(id -> {
            String label = labels.get(id);
            return label == null || label.isBlank() ? id : label;
        }).toList();
    }

    private float mapearPrioridad(Prioridad p) {
        if (p == Prioridad.URGENTE) return 1.0f;
        if (p == Prioridad.ALTA) return 0.7f;
        if (p == Prioridad.MEDIA) return 0.4f;
        return 0.1f;
    }

    private float calcularTiempoTranscurrido(LocalDateTime inicio) {
        if (inicio == null) return 0;
        return (float) Duration.between(inicio, LocalDateTime.now()).toHours() / 24.0f;
    }

    private String determinarRecomendacion(double riesgo, Prioridad actual) {
        if (riesgo > 0.7) return "ESCALAR A SUPERVISOR INMEDIATAMENTE";
        if (riesgo > 0.4 && actual != Prioridad.URGENTE) return "ELEVAR PRIORIDAD A URGENTE";
        return "MANTENER FLUJO ESTÁNDAR";
    }
}

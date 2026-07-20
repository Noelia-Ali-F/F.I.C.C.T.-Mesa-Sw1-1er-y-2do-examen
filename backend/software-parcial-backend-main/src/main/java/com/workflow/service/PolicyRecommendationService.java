package com.workflow.service;

import com.workflow.domain.model.WorkflowDefinition;
import com.workflow.repository.WorkflowDefinitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PolicyRecommendationService {
    private final WorkflowDefinitionRepository repository;

    public Map<String, Object> recomendar(String descripcion) {
        if (descripcion == null || descripcion.isBlank()) throw new IllegalArgumentException("La descripción es obligatoria");
        Set<String> query = tokens(descripcion);
        List<Map<String, Object>> ranked = repository.findAll().stream()
                .map(def -> score(def, query))
                .sorted(Comparator.comparingDouble(item -> -((Number) item.get("score")).doubleValue()))
                .toList();
        if (ranked.isEmpty()) throw new IllegalStateException("No existen políticas publicadas");
        Map<String, Object> best = ranked.get(0);
        double confidence = ((Number) best.get("score")).doubleValue();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recomendada", best);
        result.put("alternativas", ranked.stream().skip(1).limit(4).toList());
        result.put("confianza", confidence);
        result.put("requiereSeleccionManual", confidence < 0.20);
        result.put("motivo", confidence < 0.20
                ? "No hay coincidencia suficientemente clara; seleccione una política antes de crear el trámite."
                : "Coincidencia calculada con nombre, descripción y actividades BPMN publicadas.");
        return result;
    }

    private Map<String, Object> score(WorkflowDefinition def, Set<String> query) {
        Set<String> name = tokens(def.getName());
        Set<String> description = tokens(def.getDescription());
        Set<String> activities = tokens(extractActivityNames(def.getXml()));
        double weightedHits = intersection(query, name) * 3.0 + intersection(query, description) * 2.0 + intersection(query, activities);
        double max = Math.max(1.0, query.size() * 3.0);
        double score = Math.min(1.0, weightedHits / max);
        List<String> matches = new ArrayList<>();
        query.forEach(token -> { if (name.contains(token) || description.contains(token) || activities.contains(token)) matches.add(token); });
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("key", def.getKey());
        item.put("nombre", def.getName());
        item.put("descripcion", def.getDescription());
        item.put("score", score);
        item.put("motivo", matches.isEmpty() ? "Sin términos coincidentes" : "Coincide en: " + String.join(", ", matches));
        return item;
    }

    private long intersection(Set<String> left, Set<String> right) {
        return left.stream().filter(right::contains).count();
    }

    private Set<String> tokens(String value) {
        if (value == null) return Set.of();
        String normalized = Normalizer.normalize(value.toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replaceAll("[^a-z0-9]+", " ");
        Set<String> stop = Set.of("para", "como", "desde", "hasta", "este", "esta", "sobre", "solicitud", "proceso", "de", "la", "el", "los", "las", "un", "una", "y", "o", "en", "con");
        return Arrays.stream(normalized.trim().split("\\s+"))
                .filter(token -> token.length() > 2 && !stop.contains(token))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String extractActivityNames(String xml) {
        if (xml == null) return "";
        Matcher matcher = Pattern.compile("<(?:bpmn:)?(?:userTask|task|serviceTask|manualTask)[^>]*name=\\\"([^\\\"]+)\\\"", Pattern.CASE_INSENSITIVE).matcher(xml);
        List<String> names = new ArrayList<>();
        while (matcher.find()) names.add(matcher.group(1));
        return String.join(" ", names);
    }
}

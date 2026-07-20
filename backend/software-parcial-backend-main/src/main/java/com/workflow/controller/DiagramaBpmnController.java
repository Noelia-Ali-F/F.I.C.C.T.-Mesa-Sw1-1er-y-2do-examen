package com.workflow.controller;

import com.workflow.domain.model.DiagramaBpmn;
import com.workflow.dto.request.ColaboracionBpmnRequest;
import com.workflow.dto.request.GuardarDiagramaBpmnRequest;
import com.workflow.dto.response.ApiResponse;
import com.workflow.dto.response.DiagramaBpmnResponse;
import com.workflow.service.DiagramaBpmnService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Controller REST + SSE para el diagrama BPMN colaborativo.
 *
 * Endpoints:
 *   GET  /api/v1/bpmn/diagrama   → Carga el diagrama actual desde MongoDB
 *   PUT  /api/v1/bpmn/diagrama   → Guarda cambios y notifica via SSE
 *   GET  /api/v1/bpmn/eventos    → Stream SSE de eventos en tiempo real
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/bpmn")
@RequiredArgsConstructor
@Tag(name = "BPMN Colaborativo", description = "Persistencia y colaboracion en tiempo real del diagrama BPMN")
public class DiagramaBpmnController {

    private final DiagramaBpmnService diagramaService;

    /** Lista thread-safe de clientes SSE conectados */
    private final CopyOnWriteArrayList<RoomClient> emitters = new CopyOnWriteArrayList<>();
    private final ConcurrentHashMap<String, AtomicLong> roomRevisions = new ConcurrentHashMap<>();

    private record RoomClient(String policyKey, String username, SseEmitter emitter) {}

    // ─── REST Endpoints ──────────────────────────────────────────────────────

    @GetMapping("/diagrama")
    @Operation(summary = "Obtener diagrama BPMN", description = "Carga el XML del diagrama BPMN colaborativo mas reciente")
    public ResponseEntity<ApiResponse<DiagramaBpmnResponse>> obtenerDiagrama() {
        return diagramaService.obtenerDiagrama()
                .map(d -> ResponseEntity.ok(ApiResponse.ok("Diagrama BPMN cargado", toResponse(d))))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.ok("No existe diagrama guardado aun", null)));
    }

    @PutMapping("/diagrama")
    @Operation(summary = "Guardar diagrama BPMN", description = "Persiste el XML del diagrama y notifica a los demas usuarios via SSE")
    public ResponseEntity<ApiResponse<DiagramaBpmnResponse>> guardarDiagrama(
            @Valid @RequestBody GuardarDiagramaBpmnRequest request,
            @RequestHeader(value = "X-Usuario", required = false, defaultValue = "anonimo") String usuario,
            @RequestHeader(value = "X-Departamento", required = false, defaultValue = "") String departamento,
            @RequestHeader(value = "X-Rol", required = false, defaultValue = "") String rol,
            @RequestParam(value = "policyKey", defaultValue = "principal") String policyKey
    ) {
        requireEditor(rol);
        DiagramaBpmn guardado = diagramaService.guardarDiagrama(
                request.getXml(),
                usuario,
                departamento,
                request.getComentario()
        );

        // Notificar a todos los clientes SSE conectados
        emitirEvento(policyKey, "DIAGRAM_UPDATED", Map.of(
                "editadoPor", guardado.getEditadoPor(),
                "departamento", guardado.getDepartamentoEditor() != null ? guardado.getDepartamentoEditor() : "",
                "version", guardado.getVersion(),
                "timestamp", LocalDateTime.now().toString()
        ));

        return ResponseEntity.ok(ApiResponse.ok(
                "Diagrama BPMN guardado (v" + guardado.getVersion() + ")",
                toResponse(guardado)
        ));
    }

    @GetMapping("/version")
    @Operation(summary = "Obtener version actual", description = "Devuelve solo la version numerica del diagrama (para polling ligero)")
    public ResponseEntity<ApiResponse<Long>> obtenerVersion() {
        long version = diagramaService.obtenerVersionActual();
        return ResponseEntity.ok(ApiResponse.ok("Version actual", version));
    }

    @PostMapping("/colaboracion")
    @Operation(summary = "Emitir evento colaborativo", description = "Recibe eventos (cursores, movimientos) y los transmite por SSE sin guardar en BD")
    public ResponseEntity<ApiResponse<String>> emitirEventoColaborativo(
            @RequestBody ColaboracionBpmnRequest request,
            @RequestHeader(value = "X-Usuario", required = false, defaultValue = "anonimo") String usuario,
            @RequestHeader(value = "X-Departamento", required = false, defaultValue = "") String departamento,
            @RequestHeader(value = "X-Rol", required = false, defaultValue = "") String rol,
            @RequestParam String policyKey
    ) {
        if (request.getTipo() == null || !request.getTipo().startsWith("PRESENCE_")) {
            requireEditor(rol);
        }
        long baseVersion = extractBaseVersion(request.getPayload());
        long resultVersion = baseVersion;
        boolean conflict = false;
        if (!"CURSOR".equalsIgnoreCase(request.getTipo()) && !request.getTipo().startsWith("PRESENCE_")) {
            AtomicLong revision = roomRevisions.computeIfAbsent(policyKey, ignored -> new AtomicLong(baseVersion));
            long previous = revision.getAndIncrement();
            conflict = baseVersion != previous;
            resultVersion = previous + 1;
        }
        Map<String, Object> eventData = new java.util.LinkedHashMap<>();
        eventData.put("usuario", usuario);
        eventData.put("departamento", departamento);
        eventData.put("rol", rol);
        eventData.put("policyKey", policyKey);
        eventData.put("evento", request);
        eventData.put("baseVersion", baseVersion);
        eventData.put("resultVersion", resultVersion);
        eventData.put("conflict", conflict);
        eventData.put("conflictStrategy", conflict
                ? "LAST_COMPLETE_XML_WINS_WITH_VISIBLE_CONFLICT" : "SEQUENTIAL_ROOM_REVISION");
        emitirEvento(policyKey, "COLABORACION", eventData);
        return ResponseEntity.ok(ApiResponse.ok("Evento emitido", null));
    }

    // ─── SSE Stream ──────────────────────────────────────────────────────────

    @GetMapping(value = {"/eventos", "/colaboracion/stream"}, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Stream SSE de eventos", description = "Conexion persistente para recibir notificaciones de cambios en el diagrama en tiempo real")
    public SseEmitter suscribirEventos(
            @RequestHeader(value = "X-Usuario", required = false, defaultValue = "anonimo") String usuario,
            @RequestParam String policyKey
    ) {
        // Timeout de 30 minutos (el frontend se reconecta automaticamente)
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);

        RoomClient client = new RoomClient(policyKey, usuario, emitter);
        emitters.add(client);
        long roomCount = roomCount(policyKey);
        log.info("[SSE] Cliente conectado: {} policy={} (sala: {})", usuario, policyKey, roomCount);

        // Limpiar al desconectarse
        emitter.onCompletion(() -> {
            emitters.remove(client);
            log.info("[SSE] Cliente desconectado: {} policy={}", usuario, policyKey);
        });
        emitter.onTimeout(() -> {
            emitters.remove(client);
            log.info("[SSE] Timeout cliente: {} policy={}", usuario, policyKey);
        });
        emitter.onError(e -> {
            emitters.remove(client);
            log.debug("[SSE] Error cliente: {}", usuario);
        });

        // Enviar evento de bienvenida para confirmar conexion
        try {
            emitter.send(SseEmitter.event()
                    .name("CONNECTED")
                    .data(Map.of(
                            "mensaje", "Conectado al stream de colaboracion BPMN",
                            "version", diagramaService.obtenerVersionActual(),
                            "policyKey", policyKey,
                            "clientesOnline", roomCount
                    ))
            );
        } catch (IOException e) {
            emitters.remove(client);
        }

        return emitter;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private void emitirEvento(String policyKey, String nombre, Object data) {
        for (RoomClient client : emitters) {
            if (!client.policyKey().equals(policyKey)) continue;
            try {
                client.emitter().send(SseEmitter.event()
                        .name(nombre)
                        .data(data)
                );
            } catch (IOException e) {
                emitters.remove(client);
            }
        }

        log.debug("[SSE] Evento '{}' policy={} emitido a {} clientes", nombre, policyKey, roomCount(policyKey));
    }

    private long roomCount(String policyKey) {
        return emitters.stream().filter(c -> c.policyKey().equals(policyKey)).count();
    }

    @SuppressWarnings("unchecked")
    private long extractBaseVersion(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            Object value = map.get("baseVersion");
            if (value instanceof Number number) return number.longValue();
            if (value != null) try { return Long.parseLong(value.toString()); } catch (NumberFormatException ignored) {}
        }
        return 0L;
    }

    private void requireEditor(String rol) {
        if (!("ADMINISTRADOR".equalsIgnoreCase(rol) || "REVISOR".equalsIgnoreCase(rol))) {
            throw new com.workflow.exception.UnauthorizedActionException("usuario", "modificar diagramas BPMN");
        }
    }

    private DiagramaBpmnResponse toResponse(DiagramaBpmn d) {
        return DiagramaBpmnResponse.builder()
                .xml(d.getXml())
                .editadoPor(d.getEditadoPor())
                .departamentoEditor(d.getDepartamentoEditor())
                .comentario(d.getComentario())
                .version(d.getVersion())
                .fechaCreacion(d.getFechaCreacion())
                .fechaActualizacion(d.getFechaActualizacion())
                .build();
    }
}

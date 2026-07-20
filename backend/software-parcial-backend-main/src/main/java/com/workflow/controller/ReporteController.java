package com.workflow.controller;

import com.workflow.domain.model.Reporte;
import com.workflow.dto.response.ApiResponse;
import com.workflow.repository.ReporteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Controlador REST para gestionar la persistencia y lectura de reportes analíticos e IA.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/reportes")
@RequiredArgsConstructor
@Tag(name = "Reportes IA", description = "Endpoints para almacenar y consultar informes analíticos ejecutivos y de TensorFlow.")
public class ReporteController {

    private final ReporteRepository repository;

    @GetMapping
    @Operation(summary = "Listar todos los reportes", description = "Obtiene la lista completa de reportes guardados en la base de datos.")
    public ResponseEntity<ApiResponse<List<Reporte>>> listarTodos() {
        log.info("GET /api/v1/reportes");
        List<Reporte> reportes = repository.findAllByOrderByFechaCreacionDesc();
        return ResponseEntity.ok(ApiResponse.ok("Reportes recuperados con éxito", reportes));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener reporte por ID", description = "Obtiene los detalles de un reporte analítico específico.")
    public ResponseEntity<ApiResponse<Reporte>> obtenerPorId(@PathVariable String id) {
        log.info("GET /api/v1/reportes/{}", id);
        return repository.findById(id)
                .map(r -> ResponseEntity.ok(ApiResponse.ok("Reporte encontrado", r)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("Reporte no encontrado con id: " + id)));
    }

    @PostMapping
    @Operation(summary = "Guardar un nuevo reporte", description = "Registra un nuevo reporte analítico generado en la base de datos.")
    public ResponseEntity<ApiResponse<Reporte>> guardarReporte(
            @RequestBody Reporte reporte,
            @RequestHeader(value = "X-Usuario", defaultValue = "admin") String usuario) {
        log.info("POST /api/v1/reportes - Creando reporte '{}' por {}", reporte.getTitulo(), usuario);
        reporte.setCreadoPor(usuario);
        reporte.setFechaCreacion(LocalDateTime.now());
        Reporte guardado = repository.save(reporte);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Reporte guardado exitosamente", guardado));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar reporte", description = "Elimina un reporte de la base de datos por su ID.")
    public ResponseEntity<ApiResponse<Void>> eliminarReporte(@PathVariable String id) {
        log.info("DELETE /api/v1/reportes/{}", id);
        if (repository.existsById(id)) {
            repository.deleteById(id);
            return ResponseEntity.ok(ApiResponse.ok("Reporte eliminado exitosamente", null));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Reporte no encontrado para eliminar"));
    }
}

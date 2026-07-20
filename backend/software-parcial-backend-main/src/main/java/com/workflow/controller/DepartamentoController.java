package com.workflow.controller;

import com.workflow.domain.enums.RolUsuario;
import com.workflow.domain.model.Departamento;
import com.workflow.dto.request.CrearDepartamentoRequest;
import com.workflow.dto.response.ApiResponse;
import com.workflow.dto.response.DepartamentoResponse;
import com.workflow.exception.DuplicateResourceException;
import com.workflow.exception.ResourceNotFoundException;
import com.workflow.exception.UnauthorizedActionException;
import com.workflow.repository.DepartamentoRepository;
import com.workflow.repository.SolicitudWorkflowRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Controller REST para gestión de departamentos.
 * Solo el ADMINISTRADOR puede crear o desactivar departamentos.
 *
 * GET    /api/v1/departamentos          → Listar TODOS incluyendo inactivos (admin view)
 * GET    /api/v1/departamentos/nombres  → Solo nombres activos (selectores)
 * POST   /api/v1/departamentos          → Crear (solo ADMINISTRADOR)
 * DELETE /api/v1/departamentos/{id}     → Smart-delete (solo ADMINISTRADOR):
 *         - Si tiene tareas → soft-delete (activo=false, se oculta de selectores)
 *         - Si no tiene tareas → hard-delete (se elimina de BD)
 * PATCH  /api/v1/departamentos/{id}/reactivar → Reactivar un departamento inactivo (solo ADMINISTRADOR)
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/departamentos")
@RequiredArgsConstructor
@Tag(name = "Departamentos", description = "Gestión de departamentos del sistema. CRUD administrativo con soft-delete.")
public class DepartamentoController {

    private final DepartamentoRepository departamentoRepository;
    private final SolicitudWorkflowRepository solicitudRepository;


    // ─── GET: Listar todos (admin view — incluye inactivos) ───────────────────

    @GetMapping
    @Operation(summary = "Listar departamentos (admin)", description = "Retorna todos los departamentos incluyendo inactivos. Para la vista admin.")
    public ResponseEntity<ApiResponse<List<DepartamentoResponse>>> listarDepartamentos(
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario
    ) {
        validarContexto(usuario, rolUsuario);

        List<DepartamentoResponse> departamentos = departamentoRepository.findAllByOrderByNombreAsc()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok("Departamentos obtenidos", departamentos));
    }

    // ─── GET: Solo nombres activos (para selectores) ──────────────────────────

    @GetMapping("/nombres")
    @Operation(summary = "Listar nombres activos", description = "Retorna solo los nombres de departamentos ACTIVOS para selectores y catalogos.")
    public ResponseEntity<ApiResponse<List<String>>> listarNombresDepartamentos(
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario
    ) {
        validarContexto(usuario, rolUsuario);

        List<String> nombres = departamentoRepository.findAllByActivoTrueOrderByNombreAsc()
                .stream()
                .map(Departamento::getNombre)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok("Nombres de departamentos activos obtenidos", nombres));
    }

    // ─── POST: Crear (solo ADMINISTRADOR) ────────────────────────────────────

    @PostMapping
    @Operation(summary = "Crear departamento", description = "Crea un nuevo departamento. Solo ADMINISTRADOR.")
    public ResponseEntity<ApiResponse<DepartamentoResponse>> crearDepartamento(
            @Valid @RequestBody CrearDepartamentoRequest request,
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario
    ) {
        validarAdministrador(usuario, rolUsuario);

        String nombre = request.getNombre().trim();

        // If soft-deleted with same name exists, reactivate instead of creating duplicate
        departamentoRepository.findByNombreIgnoreCase(nombre).ifPresent(existente -> {
            if (!existente.isActivo()) {
                throw new DuplicateResourceException(
                        "Ya existe el departamento '" + nombre + "' (desactivado). " +
                        "Reactivalo desde la tabla en vez de crear uno nuevo."
                );
            }
            throw new DuplicateResourceException("Ya existe un departamento con el nombre: " + nombre);
        });

        Departamento nuevo = Departamento.builder()
                .nombre(nombre)
                .descripcion(StringUtils.hasText(request.getDescripcion()) ? request.getDescripcion().trim() : null)
                .creadoPor(usuario)
                .fechaCreacion(LocalDateTime.now())
                .build();

        Departamento guardado = departamentoRepository.save(nuevo);
        log.info("[Departamentos] Creado: '{}' por {}", guardado.getNombre(), usuario);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Departamento creado exitosamente", toResponse(guardado)));
    }

    // ─── DELETE: Smart-delete (solo ADMINISTRADOR) ──────────────────────────

    @DeleteMapping("/{id}")
    @Operation(
        summary = "Eliminar o desactivar departamento",
        description = "Si tiene tareas → soft-delete (desactivar, se oculta de selectores pero se conserva en BD). " +
                      "Si no tiene tareas → hard-delete. Solo ADMINISTRADOR."
    )
    public ResponseEntity<ApiResponse<Map<String, String>>> eliminarDepartamento(
            @PathVariable String id,
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario
    ) {
        validarAdministrador(usuario, rolUsuario);

        Departamento existente = departamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Departamento", "id", id));

        // Count all tasks (any state) assigned to this department
        long totalTareas = solicitudRepository
                .findByDepartamentoActualIgnoreCaseOrderByFechaCreacionDesc(existente.getNombre())
                .size();

        Map<String, String> payload = new HashMap<>();
        payload.put("id", id);
        payload.put("nombre", existente.getNombre());
        payload.put("totalTareas", String.valueOf(totalTareas));

        if (totalTareas > 0) {
            // ── SOFT DELETE: has tasks, just deactivate ──
            existente.setActivo(false);
            departamentoRepository.save(existente);

            log.info("[Departamentos] Desactivado (soft-delete): '{}' — {} tareas existentes — por {}",
                    existente.getNombre(), totalTareas, usuario);

            payload.put("accion", "DESACTIVADO");
            payload.put("mensaje",
                    "El departamento \"" + existente.getNombre() + "\" tiene " + totalTareas +
                    " tarea(s) en el sistema. Fue desactivado y ya no aparece en selectores, " +
                    "pero sus tareas y datos se conservan intactos. Puedes reactivarlo cuando quieras.");

            return ResponseEntity.ok(ApiResponse.ok(
                    "SOFT_DELETE: Departamento desactivado (tiene " + totalTareas + " tarea(s))",
                    payload
            ));
        } else {
            // ── HARD DELETE: no tasks, safe to remove ──
            departamentoRepository.delete(existente);

            log.info("[Departamentos] Eliminado permanentemente: '{}' por {}", existente.getNombre(), usuario);

            payload.put("accion", "ELIMINADO");
            payload.put("mensaje",
                    "El departamento \"" + existente.getNombre() + "\" fue eliminado permanentemente " +
                    "(no tenía tareas asociadas).");

            return ResponseEntity.ok(ApiResponse.ok(
                    "HARD_DELETE: Departamento eliminado permanentemente",
                    payload
            ));
        }
    }

    // ─── PATCH: Reactivar (solo ADMINISTRADOR) ────────────────────────────────

    @PatchMapping("/{id}/reactivar")
    @Operation(summary = "Reactivar departamento", description = "Reactiva un departamento previamente desactivado. Solo ADMINISTRADOR.")
    public ResponseEntity<ApiResponse<DepartamentoResponse>> reactivarDepartamento(
            @PathVariable String id,
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario
    ) {
        validarAdministrador(usuario, rolUsuario);

        Departamento existente = departamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Departamento", "id", id));

        if (existente.isActivo()) {
            throw new IllegalStateException("El departamento ya está activo.");
        }

        existente.setActivo(true);
        Departamento reactivado = departamentoRepository.save(existente);
        log.info("[Departamentos] Reactivado: '{}' por {}", reactivado.getNombre(), usuario);

        return ResponseEntity.ok(ApiResponse.ok(
                "Departamento \"" + reactivado.getNombre() + "\" reactivado exitosamente",
                toResponse(reactivado)
        ));
    }

    // ─── PUT: Actualizar (solo ADMINISTRADOR) ────────────────────────────────

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar departamento", description = "Actualiza el nombre y descripción de un departamento. Solo ADMINISTRADOR.")
    public ResponseEntity<ApiResponse<DepartamentoResponse>> actualizarDepartamento(
            @PathVariable String id,
            @Valid @RequestBody CrearDepartamentoRequest request,
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario
    ) {
        validarAdministrador(usuario, rolUsuario);

        Departamento existente = departamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Departamento", "id", id));

        String nuevoNombre = request.getNombre().trim();

        // Si el nombre cambia, validar que no exista otro
        if (!existente.getNombre().equalsIgnoreCase(nuevoNombre)) {
            if (departamentoRepository.existsByNombreIgnoreCase(nuevoNombre)) {
                throw new DuplicateResourceException("Ya existe un departamento con el nombre: " + nuevoNombre);
            }
            existente.setNombre(nuevoNombre);
        }

        existente.setDescripcion(StringUtils.hasText(request.getDescripcion()) ? request.getDescripcion().trim() : null);
        
        Departamento guardado = departamentoRepository.save(existente);
        log.info("[Departamentos] Actualizado: '{}' por {}", guardado.getNombre(), usuario);

        return ResponseEntity.ok(ApiResponse.ok("Departamento actualizado exitosamente", toResponse(guardado)));
    }


    // ─── Helpers ─────────────────────────────────────────────────────────────

    private void validarContexto(String usuario, RolUsuario rolUsuario) {
        if (!StringUtils.hasText(usuario) || rolUsuario == null) {
            throw new UnauthorizedActionException("Debe enviar encabezados de contexto válidos: X-Usuario y X-Rol");
        }
    }

    private void validarAdministrador(String usuario, RolUsuario rolUsuario) {
        validarContexto(usuario, rolUsuario);
        if (!rolUsuario.puedeAdministrar()) {
            throw new UnauthorizedActionException(rolUsuario.name(), "administrar departamentos");
        }
    }

    private DepartamentoResponse toResponse(Departamento d) {
        return DepartamentoResponse.builder()
                .id(d.getId())
                .nombre(d.getNombre())
                .descripcion(d.getDescripcion())
                .creadoPor(d.getCreadoPor())
                .activo(d.isActivo())
                .fechaCreacion(d.getFechaCreacion())
                .build();
    }
}

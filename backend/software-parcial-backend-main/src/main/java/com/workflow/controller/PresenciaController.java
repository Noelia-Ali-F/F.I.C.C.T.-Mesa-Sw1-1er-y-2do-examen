package com.workflow.controller;

import com.workflow.domain.enums.RolUsuario;
import com.workflow.dto.response.ApiResponse;
import com.workflow.dto.response.PresenciaResumenResponse;
import com.workflow.service.PresenciaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints para presencia colaborativa y usuarios online.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/presencia")
@RequiredArgsConstructor
@Tag(name = "Presencia", description = "Monitoreo de usuarios online y colaboración por departamento")
public class PresenciaController {

    private final PresenciaService presenciaService;

    @PostMapping("/heartbeat")
    @Operation(summary = "Registrar heartbeat de presencia", description = "Actualiza la actividad del usuario autenticado para marcarlo como online")
    public ResponseEntity<ApiResponse<Void>> registrarHeartbeat(
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
            @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario
    ) {
        validarContexto(usuario, rolUsuario, departamentoUsuario);

        presenciaService.registrarHeartbeat(usuario, rolUsuario, departamentoUsuario);
        return ResponseEntity.ok(ApiResponse.ok("Heartbeat de presencia registrado"));
    }

    @DeleteMapping("/heartbeat")
    @Operation(summary = "Cerrar presencia activa", description = "Remueve al usuario autenticado de la lista de online al cerrar sesion")
    public ResponseEntity<ApiResponse<Void>> cerrarSesionPresencia(
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
            @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario
    ) {
        validarContexto(usuario, rolUsuario, departamentoUsuario);

        presenciaService.cerrarSesion(usuario, rolUsuario, departamentoUsuario);
        return ResponseEntity.ok(ApiResponse.ok("Sesion de presencia cerrada"));
    }

    @GetMapping("/resumen")
    @Operation(summary = "Obtener resumen de colaboración", description = "Devuelve usuarios en línea visibles y usuarios en línea del departamento actual")
    public ResponseEntity<ApiResponse<PresenciaResumenResponse>> obtenerResumen(
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
            @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario
    ) {
        validarContexto(usuario, rolUsuario, departamentoUsuario);

        PresenciaResumenResponse resumen = presenciaService.obtenerResumen(usuario, rolUsuario, departamentoUsuario);
        return ResponseEntity.ok(ApiResponse.ok("Resumen de presencia obtenido", resumen));
    }

    private void validarContexto(String usuario, RolUsuario rolUsuario, String departamentoUsuario) {
        if (!StringUtils.hasText(usuario) || rolUsuario == null) {
            throw new IllegalArgumentException("Faltan headers requeridos de contexto: X-Usuario y X-Rol");
        }

        if (rolUsuario == RolUsuario.REVISOR && !StringUtils.hasText(departamentoUsuario)) {
            throw new IllegalArgumentException("El header X-Departamento es obligatorio para rol REVISOR");
        }
    }
}

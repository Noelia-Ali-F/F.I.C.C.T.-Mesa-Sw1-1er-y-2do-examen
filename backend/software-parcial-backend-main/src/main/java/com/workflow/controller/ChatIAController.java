package com.workflow.controller;

import com.workflow.domain.enums.RolUsuario;
import com.workflow.dto.request.ChatIARequest;
import com.workflow.dto.response.ApiResponse;
import com.workflow.dto.response.ChatIAResponse;
import com.workflow.exception.UnauthorizedActionException;
import com.workflow.service.ChatIAService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/chat-ia")
@RequiredArgsConstructor
@Tag(name = "Asistente IA", description = "Endpoints interactivos para comunicarse con el bot conversacional de Workflow")
public class ChatIAController {

    private final ChatIAService chatIAService;

    /**
     * Enviar mensaje al asistente de IA
     */
    @PostMapping("/preguntar")
    @Operation(summary = "Enviar consulta al Asistente IA", description = "Recibe un mensaje en texto plano del usuario y retorna una respuesta generada mediante IA.")
    public ResponseEntity<ApiResponse<ChatIAResponse>> enviarMensajeUsuario(
            @Valid @RequestBody ChatIARequest request,
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
            @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

        validarContextoConDepartamentoSiRevisor(usuario, rolUsuario, departamentoUsuario);

        if (StringUtils.hasText(request.getUsuarioId()) && !usuario.equalsIgnoreCase(request.getUsuarioId().trim())) {
            throw new UnauthorizedActionException("El usuario del body no coincide con el contexto autenticado");
        }

        // No confiar en el body para identidad: se impone el usuario del contexto.
        request.setUsuarioId(usuario);

        log.info("POST /api/v1/chat-ia/preguntar - Usuario: {}", request.getUsuarioId());
        ChatIAResponse response = chatIAService.procesarMensaje(request, rolUsuario, departamentoUsuario);

        return ResponseEntity.ok(
                ApiResponse.ok("Respuesta IA generada con éxito", response)
        );
    }

    private void validarContextoBasico(String usuario, RolUsuario rolUsuario) {
        if (!StringUtils.hasText(usuario) || rolUsuario == null) {
            throw new UnauthorizedActionException(
                    "Debe enviar encabezados de contexto válidos: X-Usuario y X-Rol"
            );
        }
    }

    private void validarContextoConDepartamentoSiRevisor(
            String usuario,
            RolUsuario rolUsuario,
            String departamentoUsuario
    ) {
        validarContextoBasico(usuario, rolUsuario);

        if (rolUsuario == RolUsuario.REVISOR && !StringUtils.hasText(departamentoUsuario)) {
            throw new UnauthorizedActionException(
                    "El rol REVISOR debe enviar el encabezado X-Departamento"
            );
        }
    }
}

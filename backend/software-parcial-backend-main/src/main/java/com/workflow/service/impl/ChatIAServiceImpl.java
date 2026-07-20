package com.workflow.service.impl;

import com.workflow.domain.enums.RolUsuario;
import com.workflow.dto.request.ChatIARequest;
import com.workflow.dto.response.ChatIAResponse;
import com.workflow.service.ChatIAService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class ChatIAServiceImpl implements ChatIAService {

    @Override
    public ChatIAResponse procesarMensaje(ChatIARequest request, RolUsuario rolUsuario, String departamentoUsuario) {
        log.info("Procesando mensaje en modo local para usuario: {}", request.getUsuarioId());

        String alcance = departamentoUsuario != null && !departamentoUsuario.isBlank()
                ? departamentoUsuario
                : "Global";

        String respuesta = switch (rolUsuario) {
            case ADMINISTRADOR -> "Asistente IA en modo local. La integración con Gemini/Vertex no está activa en este entorno Docker, "
                    + "pero el sistema sí está operativo. Puedes revisar tickets, reasignaciones y métricas manualmente desde la interfaz.";
            case REVISOR -> "Asistente IA en modo local. En este entorno no hay conexión al motor Gemini, "
                    + "así que la ayuda automática está deshabilitada para el departamento " + alcance + ".";
            case SOLICITANTE -> "Asistente IA en modo local. La ayuda conversacional avanzada no está habilitada en esta instancia, "
                    + "pero puedes seguir usando el flujo principal del sistema sin problema.";
        };

        return ChatIAResponse.builder()
                .respuesta(respuesta)
                .intencionDetectada("LLM_LOCAL_FALLBACK")
                .fecha(java.time.LocalDateTime.now().toString())
                .build();
    }
}

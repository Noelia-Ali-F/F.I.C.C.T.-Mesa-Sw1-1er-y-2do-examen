package com.workflow.service;

import com.workflow.domain.enums.RolUsuario;
import com.workflow.dto.request.ChatIARequest;
import com.workflow.dto.response.ChatIAResponse;

/**
 * Servicio para integración con Asistente de IA (ChatGPT, Claude, etc).
 * Permite a los usuarios interactuar con sus solicitudes mediante lenguaje natural.
 */
public interface ChatIAService {

    /**
     * Procesa la entrada del usuario y devuelve una respuesta estructurada.
     */
    ChatIAResponse procesarMensaje(ChatIARequest request, RolUsuario rolUsuario, String departamentoUsuario);
}

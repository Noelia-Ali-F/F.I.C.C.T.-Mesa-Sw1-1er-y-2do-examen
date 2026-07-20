package com.workflow.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Petición del usuario para hablar con el Asistente de IA")
public class ChatIARequest {
    
    @NotBlank(message = "El mensaje del usuario es obligatorio")
    @Schema(description = "Texto escrito por el usuario solicitando ayuda o información del workflow", example = "¿En qué estado se encuentra mi solicitud de vacaciones?")
    private String mensaje;

    @NotBlank(message = "El identificador del usuario es obligatorio para mantener la sesión de chat")
    @Schema(description = "Identificador del usuario", example = "usuario123")
    private String usuarioId;

    @Schema(description = "Indica si la IA debe ejecutarse sin herramientas de base de datos para máxima velocidad y ahorro de costos", example = "true")
    private Boolean sinHerramientas;
}

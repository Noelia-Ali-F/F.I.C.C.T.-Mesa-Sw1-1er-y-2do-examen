package com.workflow.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Respuesta del Asistente IA del Workflow")
public class ChatIAResponse {

    @Schema(description = "Texto generado por la Inteligencia Artificial", example = "Tu solicitud se encuentra actualmente EN_REVISION por el departamento de RRHH.")
    private String respuesta;

    @Schema(description = "Timestamp del mensaje generado", example = "2023-11-20T10:15:30")
    private String fecha;

    @Schema(description = "Intención detectada por la IA (opcional)", example = "CONSULTA_ESTADO")
    private String intencionDetectada;
}

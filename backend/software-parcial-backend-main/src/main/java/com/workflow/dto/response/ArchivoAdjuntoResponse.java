package com.workflow.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO de respuesta con los metadatos de un archivo adjunto.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArchivoAdjuntoResponse {

    private String id;

    private String nombreOriginal;

    private String tipoContenido;

    private long tamanoBytes;

    private String subidoPor;

    private LocalDateTime fechaSubida;
}

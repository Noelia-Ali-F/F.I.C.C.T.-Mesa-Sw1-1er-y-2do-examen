package com.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Embedded document representing a file attachment linked to a workflow solicitud.
 * Files are stored in the local filesystem; this document holds metadata and the storage path.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArchivoAdjunto {

    private String id;

    private String nombreOriginal;

    private String nombreAlmacenado;

    private String tipoContenido;

    private long tamanoBytes;

    private String subidoPor;

    private LocalDateTime fechaSubida;
}

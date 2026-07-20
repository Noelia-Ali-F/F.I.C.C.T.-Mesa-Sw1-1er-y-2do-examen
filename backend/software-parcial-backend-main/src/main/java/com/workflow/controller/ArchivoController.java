package com.workflow.controller;

import com.workflow.domain.model.ArchivoAdjunto;
import com.workflow.domain.model.Documento;
import com.workflow.domain.model.SolicitudWorkflow;
import com.workflow.dto.response.ApiResponse;
import com.workflow.dto.response.ArchivoAdjuntoResponse;
import com.workflow.service.ArchivoStorageService;
import com.workflow.service.DocumentoService;
import com.workflow.repository.DocumentoRepository;
import com.workflow.repository.SolicitudWorkflowRepository;
import com.workflow.exception.ResourceNotFoundException;
import com.workflow.exception.UnauthorizedActionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * REST controller for file upload and download operations.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/archivos")
@RequiredArgsConstructor
@Tag(name = "Archivos", description = "Endpoints para subir y descargar archivos adjuntos de solicitudes.")
public class ArchivoController {

    private final ArchivoStorageService storageService;
    private final DocumentoRepository documentoRepository;
    private final SolicitudWorkflowRepository solicitudRepository;
    private final DocumentoService documentoService;

    /**
     * Sube uno o más archivos y retorna metadatos.
     * Los archivos se almacenan temporalmente; el frontend usa los IDs retornados
     * para vincularlos a la solicitud al momento de crearla.
     */
    @PostMapping(value = "/subir", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir archivos", description = "Sube uno o más archivos (max 10MB cada uno). Tipos: PDF, imágenes, Word, Excel, texto.")
    public ResponseEntity<ApiResponse<List<ArchivoAdjuntoResponse>>> subirArchivos(
            @RequestParam("archivos") MultipartFile[] archivos,
            @RequestParam(value = "solicitudId", required = false) String solicitudId,
            @RequestParam(value = "policyKey", required = false) String policyKey,
            @RequestParam(value = "tareaId", required = false) String tareaId,
            @RequestParam(value = "taskInstanceId", required = false) String taskInstanceId,
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) String rol,
            @RequestHeader(value = "X-Departamento", required = false) String departamento) {

        String uploader = (usuario != null && !usuario.isBlank()) ? usuario : "anonimo";
        if (solicitudId != null || policyKey != null || tareaId != null || taskInstanceId != null) {
            if (solicitudId == null || solicitudId.isBlank()) {
                throw new IllegalArgumentException("solicitudId es obligatorio para una carga contextual");
            }
            documentoService.validarContextoCreacion(solicitudId, policyKey, tareaId, taskInstanceId,
                    uploader, rol, departamento);
        }
        log.info("POST /api/v1/archivos/subir - {} archivos por {}", archivos.length, uploader);

        List<ArchivoAdjunto> almacenados = storageService.almacenarArchivos(archivos, uploader);

        List<ArchivoAdjuntoResponse> respuesta = almacenados.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(
                ApiResponse.ok("Archivos subidos exitosamente", respuesta)
        );
    }

    /**
     * Descarga un archivo por su ID (nombre almacenado).
     */
    @GetMapping("/{archivoId}")
    @Operation(summary = "Descargar/Visualizar archivo", description = "Obtiene un archivo adjunto por su ID. Por defecto lo sirve en modo inline a menos que se especifique download=true.")
    public ResponseEntity<Resource> descargarArchivo(
            @PathVariable String archivoId,
            @RequestParam(value = "download", defaultValue = "false") boolean download,
            @RequestHeader("X-Usuario") String usuario,
            @RequestHeader("X-Rol") String rol,
            @RequestHeader(value = "X-Departamento", required = false) String departamento) {
        verificarAcceso(archivoId, usuario, rol, departamento);
        log.info("GET /api/v1/archivos/{} (download={})", archivoId, download);

        // Search for file with any extension
        Resource resource = storageService.cargarArchivo(archivoId);

        MediaType contentType = MediaTypeFactory.getMediaType(resource)
                .orElse(MediaType.APPLICATION_OCTET_STREAM);

        String disposition = download ? "attachment" : "inline";

        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }

    private void verificarAcceso(String nombreAlmacenado, String usuario, String rol, String departamento) {
        Documento documento = documentoRepository.findAll().stream()
                .filter(doc -> doc.getVersiones() != null && doc.getVersiones().stream()
                        .anyMatch(version -> nombreAlmacenado.equals(version.getNombreAlmacenado())))
                .findFirst().orElse(null);
        if (documento != null) {
            if (!documentoService.puedeAcceder(documento, usuario, rol, departamento, false)) {
                throw new UnauthorizedActionException(usuario, "descargar este documento");
            }
            return;
        }
        SolicitudWorkflow solicitud = solicitudRepository.findAll().stream()
                .filter(item -> item.getArchivosAdjuntos() != null && item.getArchivosAdjuntos().stream()
                        .anyMatch(file -> nombreAlmacenado.equals(file.getNombreAlmacenado())))
                .findFirst().orElseThrow(() -> new ResourceNotFoundException("Archivo", "id", nombreAlmacenado));
        boolean permitido = "ADMINISTRADOR".equalsIgnoreCase(rol)
                || usuario.equalsIgnoreCase(solicitud.getUsuarioCreador())
                || (solicitud.getUsuarioAsignado() != null && usuario.equalsIgnoreCase(solicitud.getUsuarioAsignado()))
                || (departamento != null && departamento.equalsIgnoreCase(solicitud.getDepartamentoActual()));
        if (!permitido) throw new UnauthorizedActionException(usuario, "descargar este archivo");
    }

    private ArchivoAdjuntoResponse toResponse(ArchivoAdjunto archivo) {
        return ArchivoAdjuntoResponse.builder()
                .id(archivo.getId())
                .nombreOriginal(archivo.getNombreOriginal())
                .tipoContenido(archivo.getTipoContenido())
                .tamanoBytes(archivo.getTamanoBytes())
                .subidoPor(archivo.getSubidoPor())
                .fechaSubida(archivo.getFechaSubida())
                .build();
    }
}

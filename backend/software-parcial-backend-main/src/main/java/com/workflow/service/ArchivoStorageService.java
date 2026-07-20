package com.workflow.service;

import com.workflow.domain.model.ArchivoAdjunto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Blob;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Servicio de almacenamiento de archivos adjuntos.
 * Soporta almacenamiento en Google Cloud Storage (producción) y sistema de archivos local (desarrollo/fallback).
 */
@Slf4j
@Service
public class ArchivoStorageService {

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    private static final List<String> TIPOS_PERMITIDOS = List.of(
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain"
    );

    @Value("${app.uploads.dir:./uploads}")
    private String uploadsDir;

    @Value("${BUCKET_NAME:${app.gcp.bucket-name:}}")
    private String bucketName;

    private Path uploadsPath;
    private Storage storage;

    @PostConstruct
    void inicializar() {
        uploadsPath = Paths.get(uploadsDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadsPath);
            log.info("Directorio de uploads local inicializado: {}", uploadsPath);
        } catch (IOException e) {
            throw new RuntimeException("No se pudo crear el directorio de uploads local: " + uploadsPath, e);
        }

        if (bucketName != null && !bucketName.trim().isEmpty()) {
            try {
                this.storage = StorageOptions.getDefaultInstance().getService();
                log.info("Google Cloud Storage inicializado con el bucket: {}", bucketName);
            } catch (Exception e) {
                log.error("No se pudo conectar a Google Cloud Storage. Se usará almacenamiento local como fallback.", e);
                this.storage = null;
            }
        } else {
            log.info("Google Cloud Storage no configurado (BUCKET_NAME no especificado). Usando almacenamiento local.");
            this.storage = null;
        }
    }

    /**
     * Almacena múltiples archivos y retorna lista de metadatos.
     */
    public List<ArchivoAdjunto> almacenarArchivos(MultipartFile[] archivos, String usuario) {
        List<ArchivoAdjunto> adjuntos = new ArrayList<>();

        if (archivos == null || archivos.length == 0) {
            return adjuntos;
        }

        for (MultipartFile archivo : archivos) {
            if (archivo.isEmpty()) continue;
            adjuntos.add(almacenarArchivo(archivo, usuario));
        }

        return adjuntos;
    }

    /**
     * Almacena un único archivo y retorna sus metadatos.
     * Si está configurado Google Cloud Storage, sube el archivo al bucket. De lo contrario, guarda localmente.
     */
    public ArchivoAdjunto almacenarArchivo(MultipartFile archivo, String usuario) {
        validarArchivo(archivo);

        String id = UUID.randomUUID().toString();
        String extension = extraerExtension(archivo.getOriginalFilename());
        String nombreAlmacenado = id + extension;

        // Intentar subir a Google Cloud Storage
        if (storage != null && bucketName != null && !bucketName.trim().isEmpty()) {
            try {
                BlobId blobId = BlobId.of(bucketName, nombreAlmacenado);
                BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                        .setContentType(archivo.getContentType())
                        .build();

                storage.create(blobInfo, archivo.getBytes());
                log.info("Archivo almacenado en GCS: {} -> {} en bucket {} por {}", 
                        archivo.getOriginalFilename(), nombreAlmacenado, bucketName, usuario);

                return ArchivoAdjunto.builder()
                        .id(id)
                        .nombreOriginal(archivo.getOriginalFilename())
                        .nombreAlmacenado(nombreAlmacenado)
                        .tipoContenido(archivo.getContentType())
                        .tamanoBytes(archivo.getSize())
                        .subidoPor(usuario)
                        .fechaSubida(LocalDateTime.now())
                        .build();

            } catch (IOException e) {
                log.error("Error al subir archivo a GCS: {}. Usando almacenamiento local como fallback.", archivo.getOriginalFilename(), e);
            }
        }

        // Fallback: almacenamiento local
        try {
            Path destino = uploadsPath.resolve(nombreAlmacenado).normalize();
            // Prevenir path traversal
            if (!destino.startsWith(uploadsPath)) {
                throw new IllegalArgumentException("Ruta de archivo inválida");
            }

            Files.copy(archivo.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);
            log.info("Archivo almacenado localmente: {} -> {} por {}", archivo.getOriginalFilename(), nombreAlmacenado, usuario);

            return ArchivoAdjunto.builder()
                    .id(id)
                    .nombreOriginal(archivo.getOriginalFilename())
                    .nombreAlmacenado(nombreAlmacenado)
                    .tipoContenido(archivo.getContentType())
                    .tamanoBytes(archivo.getSize())
                    .subidoPor(usuario)
                    .fechaSubida(LocalDateTime.now())
                    .build();

        } catch (IOException e) {
            throw new RuntimeException("Error al almacenar archivo local: " + archivo.getOriginalFilename(), e);
        }
    }

    /**
     * Carga un archivo como Resource para descarga.
     * Busca primero en Google Cloud Storage si está habilitado y, si no lo encuentra, busca localmente.
     */
    public Resource cargarArchivo(String nombreAlmacenado) {
        // Intentar cargar desde Google Cloud Storage
        if (storage != null && bucketName != null && !bucketName.trim().isEmpty()) {
            try {
                Blob blob = storage.get(BlobId.of(bucketName, nombreAlmacenado));
                if (blob != null && blob.exists()) {
                    byte[] content = blob.getContent();
                    return new ByteArrayResource(content) {
                        @Override
                        public String getFilename() {
                            return nombreAlmacenado;
                        }
                    };
                }
                log.warn("Archivo no encontrado en GCS: {}. Buscando en disco local...", nombreAlmacenado);
            } catch (Exception e) {
                log.error("Error al recuperar archivo de GCS: {}. Buscando en disco local...", nombreAlmacenado, e);
            }
        }

        // Cargar del disco local
        try {
            Path filePath = uploadsPath.resolve(nombreAlmacenado).normalize();
            if (!filePath.startsWith(uploadsPath)) {
                throw new IllegalArgumentException("Ruta de archivo inválida");
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            }
            throw new RuntimeException("Archivo no encontrado: " + nombreAlmacenado);

        } catch (MalformedURLException e) {
            throw new RuntimeException("Error al acceder al archivo local: " + nombreAlmacenado, e);
        }
    }

    private void validarArchivo(MultipartFile archivo) {
        if (archivo.isEmpty()) {
            throw new IllegalArgumentException("El archivo está vacío");
        }

        if (archivo.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException(
                    String.format("El archivo excede el limite de %d MB", MAX_FILE_SIZE / (1024 * 1024))
            );
        }

        String contentType = archivo.getContentType();
        if (contentType == null || !TIPOS_PERMITIDOS.contains(contentType)) {
            throw new IllegalArgumentException(
                    "Tipo de archivo no permitido: " + contentType + ". Permitidos: PDF, imágenes, Word, Excel, texto."
            );
        }
    }

    private String extraerExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf("."));
    }
}

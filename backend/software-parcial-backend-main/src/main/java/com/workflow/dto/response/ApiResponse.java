package com.workflow.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Respuesta API estandarizada para toda la aplicación.
 * Sigue el patrón Envelope para consistencia en las respuestas.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private boolean exito;
    private String mensaje;
    private T datos;
    private LocalDateTime timestamp;
    private Map<String, List<String>> errores;

    /**
     * Crea una respuesta exitosa con datos.
     */
    public static <T> ApiResponse<T> ok(String mensaje, T datos) {
        return ApiResponse.<T>builder()
                .exito(true)
                .mensaje(mensaje)
                .datos(datos)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Crea una respuesta exitosa sin datos.
     */
    public static <T> ApiResponse<T> ok(String mensaje) {
        return ApiResponse.<T>builder()
                .exito(true)
                .mensaje(mensaje)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Crea una respuesta de error.
     */
    public static <T> ApiResponse<T> error(String mensaje) {
        return ApiResponse.<T>builder()
                .exito(false)
                .mensaje(mensaje)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Crea una respuesta de error con detalles de validación.
     */
    public static <T> ApiResponse<T> errorValidacion(String mensaje, Map<String, List<String>> errores) {
        return ApiResponse.<T>builder()
                .exito(false)
                .mensaje(mensaje)
                .errores(errores)
                .timestamp(LocalDateTime.now())
                .build();
    }
}

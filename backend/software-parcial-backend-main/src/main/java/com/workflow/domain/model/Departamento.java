package com.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Documento MongoDB que representa un departamento del sistema.
 * Solo el ADMINISTRADOR puede crear o eliminar departamentos.
 * Si tiene tareas activas, se desactiva (soft-delete) en vez de eliminarse.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "departamentos")
public class Departamento {

    @Id
    private String id;

    /** Nombre único del departamento */
    @Indexed(unique = true)
    private String nombre;

    /** Descripcion opcional del departamento */
    private String descripcion;

    /** Usuario administrador que lo creo */
    private String creadoPor;

    /**
     * true = departamento activo y visible en selectores.
     * false = soft-deleted: tiene tareas activas, se oculta del catalogo pero no se elimina de BD.
     */
    @Builder.Default
    private boolean activo = true;

    @CreatedDate
    private LocalDateTime fechaCreacion;
}

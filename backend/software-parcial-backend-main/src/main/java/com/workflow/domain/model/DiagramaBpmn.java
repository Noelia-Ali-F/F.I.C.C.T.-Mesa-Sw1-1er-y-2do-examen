package com.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Documento MongoDB que almacena el diagrama BPMN colaborativo.
 * Usa un ID fijo ("principal") para que siempre haya un solo diagrama activo.
 * Cada guardado incrementa la version para detectar conflictos y notificar cambios.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "diagramas_bpmn")
public class DiagramaBpmn {

    @Id
    private String id;

    /** Contenido XML completo del diagrama BPMN */
    private String xml;

    /** Username del ultimo usuario que guardo cambios */
    private String editadoPor;

    /** Departamento del ultimo usuario que guardo */
    private String departamentoEditor;

    /** Comentario opcional del guardado */
    private String comentario;

    /** Version incremental para detectar cambios */
    @Builder.Default
    private long version = 1;

    @CreatedDate
    private LocalDateTime fechaCreacion;

    @LastModifiedDate
    private LocalDateTime fechaActualizacion;
}

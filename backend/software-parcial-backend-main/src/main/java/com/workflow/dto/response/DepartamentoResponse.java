package com.workflow.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DepartamentoResponse {

    private String id;
    private String nombre;
    private String descripcion;
    private String creadoPor;
    private boolean activo;
    private LocalDateTime fechaCreacion;
}

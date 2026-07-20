package com.workflow.domain.model;

import com.workflow.domain.enums.RolUsuario;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "usuarios")
public class Usuario {

    @Id
    private String id;

    @Indexed(unique = true)
    private String username;

    private String password; // Contraseña plana solo para esta demo rápida

    private String nombreCompleto;

    private RolUsuario rol;

    private String departamento;

    private String avatarUrl;

    @CreatedDate
    private LocalDateTime fechaCreacion;
}

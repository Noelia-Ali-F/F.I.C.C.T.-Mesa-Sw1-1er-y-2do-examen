package com.workflow.domain.enums;

/**
 * Roles de los actores del sistema de workflow.
 * Define los permisos y acciones permitidas por cada rol.
 */
public enum RolUsuario {
    SOLICITANTE,
    REVISOR,
    ADMINISTRADOR;

    public boolean puedeCrearSolicitud() {
        return this == SOLICITANTE || this == ADMINISTRADOR;
    }

    public boolean puedeRevisar() {
        return this == REVISOR || this == ADMINISTRADOR;
    }

    public boolean puedeAdministrar() {
        return this == ADMINISTRADOR;
    }

    public boolean puedeForzarCambioEstado() {
        return this == ADMINISTRADOR;
    }
}

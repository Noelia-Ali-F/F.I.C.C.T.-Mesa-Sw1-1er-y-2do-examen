package com.workflow.exception;

/**
 * Excepción lanzada cuando un usuario intenta una acción no permitida por su rol.
 */
public class UnauthorizedActionException extends RuntimeException {

    public UnauthorizedActionException(String mensaje) {
        super(mensaje);
    }

    public UnauthorizedActionException(String rol, String accion) {
        super(String.format("El rol '%s' no tiene permiso para: %s", rol, accion));
    }
}

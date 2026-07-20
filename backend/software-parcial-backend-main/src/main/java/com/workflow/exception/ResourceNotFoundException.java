package com.workflow.exception;

/**
 * Excepción lanzada cuando un recurso solicitado no existe.
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String recurso, String campo, String valor) {
        super(String.format("%s no encontrado con %s: '%s'", recurso, campo, valor));
    }

    public ResourceNotFoundException(String mensaje) {
        super(mensaje);
    }
}

package com.workflow.exception;

/**
 * Excepción lanzada cuando ya existe un recurso con el mismo identificador.
 */
public class DuplicateResourceException extends RuntimeException {

    public DuplicateResourceException(String mensaje) {
        super(mensaje);
    }

    public DuplicateResourceException(String recurso, String campo, String valor) {
        super(String.format("%s ya existe con %s: '%s'", recurso, campo, valor));
    }
}

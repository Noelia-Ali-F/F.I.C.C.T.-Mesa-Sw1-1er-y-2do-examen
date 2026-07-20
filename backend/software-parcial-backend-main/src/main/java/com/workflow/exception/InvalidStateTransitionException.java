package com.workflow.exception;

/**
 * Excepción lanzada cuando se intenta una transición de estado inválida.
 */
public class InvalidStateTransitionException extends RuntimeException {

    public InvalidStateTransitionException(String estadoActual, String estadoNuevo) {
        super(String.format("Transición de estado inválida: '%s' -> '%s'", estadoActual, estadoNuevo));
    }

    public InvalidStateTransitionException(String mensaje) {
        super(mensaje);
    }
}

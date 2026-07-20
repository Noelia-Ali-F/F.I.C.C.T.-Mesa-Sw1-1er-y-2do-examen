package com.workflow.exception;

public class AuthenticationRequiredException extends RuntimeException {
    public AuthenticationRequiredException() {
        super("Se requiere un contexto autenticado válido");
    }
}

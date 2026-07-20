package com.workflow.domain.enums;

/**
 * Estados del ciclo de vida de una solicitud de workflow.
 * Transiciones válidas:
 *   PENDIENTE -> EN_REVISION (Revisor)
 *   EN_REVISION -> APROBADO | RECHAZADO (Revisor)
 *   Cualquier estado -> Cualquier estado (Administrador, forzado)
 */
public enum EstadoWorkflow {
    PENDIENTE,
    EN_REVISION,
    APROBADO,
    RECHAZADO,
    BLOQUEADO,
    SLA_CRITICO;

    /**
     * Valida si la transición de estado es permitida para un Revisor.
     * Los Administradores pueden forzar cualquier transición.
     */
    public boolean puedeTransicionarA(EstadoWorkflow nuevoEstado) {
        return switch (this) {
            case PENDIENTE -> nuevoEstado == EN_REVISION || nuevoEstado == BLOQUEADO || nuevoEstado == SLA_CRITICO;
            case EN_REVISION -> nuevoEstado == APROBADO || nuevoEstado == RECHAZADO || nuevoEstado == BLOQUEADO || nuevoEstado == SLA_CRITICO;
            case BLOQUEADO -> nuevoEstado == EN_REVISION || nuevoEstado == PENDIENTE || nuevoEstado == SLA_CRITICO;
            case SLA_CRITICO -> nuevoEstado == EN_REVISION || nuevoEstado == APROBADO || nuevoEstado == RECHAZADO || nuevoEstado == BLOQUEADO;
            case APROBADO, RECHAZADO -> false; // Estados terminales para revisores
        };
    }

    public boolean esEstadoTerminal() {
        return this == APROBADO || this == RECHAZADO;
    }
}

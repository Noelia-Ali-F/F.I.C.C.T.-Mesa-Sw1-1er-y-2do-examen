package com.workflow.service;

import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.enums.Prioridad;
import com.workflow.domain.model.SolicitudWorkflow;
import com.workflow.repository.SolicitudWorkflowRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Monitor periódico de SLA.
 *
 * - Marca y registra primera alerta cuando una solicitud está por vencer.
 * - Marca y registra escalamiento cuando la solicitud vence.
 * - Normaliza fecha límite para registros legacy que aún no la tengan.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.workflow.sla.monitor.enabled", havingValue = "true", matchIfMissing = true)
public class SlaMonitorScheduler {

    private static final long MINUTOS_UMBRAL_POR_VENCER = 240;
    private static final String USUARIO_SISTEMA = "system.sla";
    private static final String ROL_SISTEMA = "SISTEMA";

    private static final Map<Prioridad, Long> SLA_HORAS_POR_PRIORIDAD = new EnumMap<>(Prioridad.class);

    static {
        SLA_HORAS_POR_PRIORIDAD.put(Prioridad.URGENTE, 4L);
        SLA_HORAS_POR_PRIORIDAD.put(Prioridad.ALTA, 8L);
        SLA_HORAS_POR_PRIORIDAD.put(Prioridad.MEDIA, 24L);
        SLA_HORAS_POR_PRIORIDAD.put(Prioridad.BAJA, 72L);
    }

    private final SolicitudWorkflowRepository repository;

    @Scheduled(
            fixedDelayString = "${app.workflow.sla.monitor.fixed-delay-ms:300000}",
            initialDelayString = "${app.workflow.sla.monitor.initial-delay-ms:20000}"
    )
    public void monitorearSla() {
        List<SolicitudWorkflow> activas = repository.findByEstadoIn(List.of(
                EstadoWorkflow.PENDIENTE,
                EstadoWorkflow.EN_REVISION
        ));

        if (activas.isEmpty()) {
            return;
        }

        LocalDateTime ahora = LocalDateTime.now();
        int actualizadas = 0;
        int alertadas = 0;
        int escaladas = 0;

        for (SolicitudWorkflow solicitud : activas) {
            boolean requiereGuardado = false;

            LocalDateTime fechaLimite = resolverFechaLimite(solicitud);
            if (solicitud.getFechaLimiteAtencion() == null && fechaLimite != null) {
                solicitud.setFechaLimiteAtencion(fechaLimite);
                requiereGuardado = true;
            }

            if (fechaLimite == null) {
                if (requiereGuardado) {
                    repository.save(solicitud);
                    actualizadas++;
                }
                continue;
            }

            long minutosRestantes = Duration.between(ahora, fechaLimite).toMinutes();
            if (minutosRestantes <= 0) {
                if (solicitud.getFechaEscalamientoSla() == null) {
                    if (solicitud.getPrioridad() != Prioridad.URGENTE) {
                        solicitud.setPrioridad(Prioridad.URGENTE);
                    }

                    solicitud.setFechaEscalamientoSla(ahora);
                    solicitud.registrarTransicion(
                            solicitud.getEstado(),
                            solicitud.getEstado(),
                            USUARIO_SISTEMA,
                            ROL_SISTEMA,
                            "Escalamiento SLA: solicitud vencida, requiere atencion inmediata"
                    );
                    requiereGuardado = true;
                    escaladas++;
                }
            } else if (minutosRestantes <= MINUTOS_UMBRAL_POR_VENCER) {
                if (solicitud.getFechaPrimeraAlertaSla() == null) {
                    solicitud.setFechaPrimeraAlertaSla(ahora);
                    solicitud.registrarTransicion(
                            solicitud.getEstado(),
                            solicitud.getEstado(),
                            USUARIO_SISTEMA,
                            ROL_SISTEMA,
                            "Alerta SLA: solicitud por vencer en menos de 4 horas"
                    );
                    requiereGuardado = true;
                    alertadas++;
                }
            }

            if (requiereGuardado) {
                repository.save(solicitud);
                actualizadas++;
            }
        }

        if (actualizadas > 0) {
            log.info(
                    "Monitor SLA ejecutado. Activas: {}, actualizadas: {}, alertadas: {}, escaladas: {}",
                    activas.size(),
                    actualizadas,
                    alertadas,
                    escaladas
            );
        }
    }

    private LocalDateTime resolverFechaLimite(SolicitudWorkflow solicitud) {
        if (solicitud.getFechaLimiteAtencion() != null) {
            return solicitud.getFechaLimiteAtencion();
        }

        if (solicitud.getFechaCreacion() == null) {
            return null;
        }

        Prioridad prioridad = solicitud.getPrioridad() != null ? solicitud.getPrioridad() : Prioridad.MEDIA;
        long horasSla = SLA_HORAS_POR_PRIORIDAD.getOrDefault(prioridad, 24L);
        return solicitud.getFechaCreacion().plusHours(horasSla);
    }
}

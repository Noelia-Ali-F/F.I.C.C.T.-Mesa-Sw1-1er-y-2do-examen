package com.workflow.service;

import org.springframework.stereotype.Service;

import java.time.Year;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Servicio especializado para generar códigos de seguimiento únicos.
 * Formato: WF-{AÑO}-{SECUENCIAL:3 dígitos mínimo}
 * Ejemplo: WF-2026-001, WF-2026-042, WF-2026-1500
 *
 * Usa AtomicLong para seguridad en entornos concurrentes.
 */
@Service
public class CodigoSeguimientoGenerator {

    private final AtomicLong secuencial = new AtomicLong(0);

    /**
     * Genera el próximo código de seguimiento.
     */
    public String generarCodigo() {
        long numero = secuencial.incrementAndGet();
        return String.format("WF-%d-%03d", Year.now().getValue(), numero);
    }

    /**
     * Inicializa el contador basándose en el último código existente.
     * Se llama desde la capa de servicio al iniciar la aplicación.
     */
    public void inicializarContador(long ultimoNumero) {
        secuencial.set(ultimoNumero);
    }
}

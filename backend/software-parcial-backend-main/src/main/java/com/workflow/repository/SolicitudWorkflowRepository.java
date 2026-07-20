package com.workflow.repository;

import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.model.SolicitudWorkflow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repositorio MongoDB para solicitudes de workflow.
 * Spring Data MongoDB genera las implementaciones automáticamente.
 */
@Repository
public interface SolicitudWorkflowRepository extends MongoRepository<SolicitudWorkflow, String> {

    /**
     * Busca solicitudes por departamento actual (para el REVISOR).
     */
    List<SolicitudWorkflow> findByDepartamentoActualIgnoreCaseOrderByFechaCreacionDesc(String departamento);

    /**
     * Busca solicitudes por departamento con paginación.
     */
    Page<SolicitudWorkflow> findByDepartamentoActualIgnoreCase(String departamento, Pageable pageable);

    /**
     * Busca solicitudes por departamento y estado.
     */
    List<SolicitudWorkflow> findByDepartamentoActualIgnoreCaseAndEstado(
            String departamento, EstadoWorkflow estado);

    /**
     * Busca solicitudes creadas por un usuario específico.
     */
    List<SolicitudWorkflow> findByUsuarioCreadorOrderByFechaCreacionDesc(String usuarioCreador);

    /**
     * Busca una solicitud por su código de seguimiento único.
     */
    Optional<SolicitudWorkflow> findByCodigoSeguimiento(String codigoSeguimiento);

    /**
     * Verifica si ya existe un código de seguimiento.
     */
    boolean existsByCodigoSeguimiento(String codigoSeguimiento);

    /**
     * Busca solicitudes por estado.
     */
    List<SolicitudWorkflow> findByEstadoOrderByFechaCreacionDesc(EstadoWorkflow estado);

    /**
     * Busca solicitudes por un conjunto de estados (útil para monitoreo SLA).
     */
    List<SolicitudWorkflow> findByEstadoIn(List<EstadoWorkflow> estados);

    /**
     * Busca por usuario asignado.
     */
    List<SolicitudWorkflow> findByUsuarioAsignadoOrderByFechaCreacionDesc(String usuarioAsignado);

    /**
     * Conteo de solicitudes por departamento y estado (para KPIs/dashboard).
     */
    long countByDepartamentoActualIgnoreCaseAndEstado(String departamento, EstadoWorkflow estado);

    /**
     * Conteo total por estado.
     */
    long countByEstado(EstadoWorkflow estado);

    /**
     * Búsqueda por título (parcial, case-insensitive).
     */
    @Query("{ 'titulo': { $regex: ?0, $options: 'i' } }")
    List<SolicitudWorkflow> buscarPorTitulo(String titulo);
}

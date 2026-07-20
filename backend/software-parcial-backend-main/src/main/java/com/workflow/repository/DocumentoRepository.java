package com.workflow.repository;

import com.workflow.domain.model.Documento;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio MongoDB para la gestión de Documentos (DMS).
 */
@Repository
public interface DocumentoRepository extends MongoRepository<Documento, String> {

    /**
     * Recupera todos los documentos de una solicitud específica.
     */
    List<Documento> findBySolicitudIdOrderByFechaCreacionDesc(String solicitudId);

    /**
     * Recupera todos los documentos de una tarea específica BPMN.
     */
    List<Documento> findByTareaIdOrderByFechaCreacionDesc(String tareaId);

    List<Documento> findByPolicyKeyOrderByFechaCreacionDesc(String policyKey);

    List<Documento> findBySolicitudIdAndTareaIdOrderByFechaCreacionDesc(String solicitudId, String tareaId);

    /**
     * Recupera documentos creados por un usuario específico.
     */
    List<Documento> findByCreadoPorOrderByFechaCreacionDesc(String creadoPor);

    /**
     * Búsqueda global de documentos por nombre (case-insensitive).
     */
    @Query("{ 'nombre': { $regex: ?0, $options: 'i' } }")
    List<Documento> buscarPorNombre(String nombre);

    /**
     * Recupera documentos bloqueados por un usuario específico.
     */
    List<Documento> findByBloqueadoPor(String bloqueadoPor);
}

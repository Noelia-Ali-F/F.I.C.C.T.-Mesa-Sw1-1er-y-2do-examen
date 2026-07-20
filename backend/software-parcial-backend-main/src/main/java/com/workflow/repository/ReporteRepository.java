package com.workflow.repository;

import com.workflow.domain.model.Reporte;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio de persistencia en MongoDB para informes operacionales.
 */
@Repository
public interface ReporteRepository extends MongoRepository<Reporte, String> {
    List<Reporte> findAllByOrderByFechaCreacionDesc();
}

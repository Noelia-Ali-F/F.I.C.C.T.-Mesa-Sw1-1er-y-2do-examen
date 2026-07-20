package com.workflow.repository;

import com.workflow.domain.model.Departamento;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartamentoRepository extends MongoRepository<Departamento, String> {

    boolean existsByNombreIgnoreCase(String nombre);

    Optional<Departamento> findByNombreIgnoreCase(String nombre);

    /** Only active departments — used for catalogs and create/assign selectors */
    List<Departamento> findAllByActivoTrueOrderByNombreAsc();

    /** All departments (active + soft-deleted) — used by admin list view */
    List<Departamento> findAllByOrderByNombreAsc();
}


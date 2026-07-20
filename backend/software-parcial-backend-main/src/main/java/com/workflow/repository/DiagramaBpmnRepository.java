package com.workflow.repository;

import com.workflow.domain.model.DiagramaBpmn;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

/**
 * Repositorio MongoDB para el diagrama BPMN colaborativo.
 */
@Repository
public interface DiagramaBpmnRepository extends MongoRepository<DiagramaBpmn, String> {
}

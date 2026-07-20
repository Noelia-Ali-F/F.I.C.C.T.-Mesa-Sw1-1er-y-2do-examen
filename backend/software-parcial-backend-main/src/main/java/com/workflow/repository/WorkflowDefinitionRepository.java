package com.workflow.repository;

import com.workflow.domain.model.WorkflowDefinition;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WorkflowDefinitionRepository extends MongoRepository<WorkflowDefinition, String> {
    Optional<WorkflowDefinition> findByKey(String key);
    Optional<WorkflowDefinition> findFirstByKeyOrderByVersionDesc(String key);
}

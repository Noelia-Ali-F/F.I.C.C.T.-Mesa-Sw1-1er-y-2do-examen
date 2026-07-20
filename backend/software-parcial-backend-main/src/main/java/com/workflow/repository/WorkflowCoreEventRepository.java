package com.workflow.repository;

import com.workflow.domain.model.WorkflowCoreEvent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowCoreEventRepository extends MongoRepository<WorkflowCoreEvent, String> {
    List<WorkflowCoreEvent> findTop100ByOrderByTimestampDesc();
}

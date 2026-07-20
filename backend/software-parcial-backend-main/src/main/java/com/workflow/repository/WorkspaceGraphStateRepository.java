package com.workflow.repository;

import com.workflow.domain.model.WorkspaceGraphState;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface WorkspaceGraphStateRepository extends MongoRepository<WorkspaceGraphState, String> {
}

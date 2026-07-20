package com.workflow.service;

import com.workflow.domain.model.WorkflowDefinition;

import java.util.List;
import java.util.Optional;

public interface WorkflowDefinitionService {
    List<WorkflowDefinition> listarTodos();
    Optional<WorkflowDefinition> obtenerPorId(String id);
    Optional<WorkflowDefinition> obtenerPorKey(String key);
    WorkflowDefinition guardarOActualizar(WorkflowDefinition def, String usuario, String departamento);
    void resetAndSeed();
}

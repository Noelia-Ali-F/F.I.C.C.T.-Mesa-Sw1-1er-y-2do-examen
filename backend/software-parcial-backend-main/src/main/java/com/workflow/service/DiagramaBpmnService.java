package com.workflow.service;

import com.workflow.domain.model.DiagramaBpmn;

import java.util.Optional;

/**
 * Contrato para persistencia y colaboracion del diagrama BPMN.
 */
public interface DiagramaBpmnService {

    /**
     * Obtiene el diagrama BPMN activo (el unico diagrama compartido).
     */
    Optional<DiagramaBpmn> obtenerDiagrama();

    /**
     * Guarda/actualiza el diagrama BPMN e incrementa la version.
     *
     * @param xml         Contenido XML del diagrama BPMN
     * @param usuario     Username del editor
     * @param departamento Departamento del editor
     * @param comentario  Comentario opcional
     * @return El diagrama guardado con la nueva version
     */
    DiagramaBpmn guardarDiagrama(String xml, String usuario, String departamento, String comentario);

    /**
     * Obtiene la version actual del diagrama (para polling rapido).
     */
    long obtenerVersionActual();
}

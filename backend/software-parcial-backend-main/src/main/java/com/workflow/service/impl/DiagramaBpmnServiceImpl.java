package com.workflow.service.impl;

import com.workflow.domain.model.DiagramaBpmn;
import com.workflow.repository.DiagramaBpmnRepository;
import com.workflow.service.DiagramaBpmnService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Optional;

/**
 * Implementacion del servicio de diagrama BPMN colaborativo.
 * Usa un ID fijo "principal" para mantener un unico diagrama compartido por todos los usuarios.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DiagramaBpmnServiceImpl implements DiagramaBpmnService {

    private static final String DIAGRAMA_ID = "principal";

    private final DiagramaBpmnRepository repository;

    @Override
    public Optional<DiagramaBpmn> obtenerDiagrama() {
        return repository.findById(DIAGRAMA_ID);
    }

    @Override
    public DiagramaBpmn guardarDiagrama(String xml, String usuario, String departamento, String comentario) {
        if (!StringUtils.hasText(xml)) {
            throw new IllegalArgumentException("El XML del diagrama BPMN no puede estar vacio");
        }

        DiagramaBpmn diagrama = repository.findById(DIAGRAMA_ID).orElse(
                DiagramaBpmn.builder()
                        .id(DIAGRAMA_ID)
                        .version(0)
                        .build()
        );

        diagrama.setXml(xml);
        diagrama.setEditadoPor(usuario);
        diagrama.setDepartamentoEditor(departamento);
        diagrama.setComentario(StringUtils.hasText(comentario) ? comentario : "Guardado desde editor BPMN");
        diagrama.setVersion(diagrama.getVersion() + 1);

        DiagramaBpmn guardado = repository.save(diagrama);
        log.info("[BPMN] Diagrama guardado por {} (v{})", usuario, guardado.getVersion());

        return guardado;
    }

    @Override
    public long obtenerVersionActual() {
        return repository.findById(DIAGRAMA_ID)
                .map(DiagramaBpmn::getVersion)
                .orElse(0L);
    }
}

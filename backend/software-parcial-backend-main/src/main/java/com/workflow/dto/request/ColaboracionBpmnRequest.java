package com.workflow.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body para eventos colaborativos en tiempo real del diagrama BPMN.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ColaboracionBpmnRequest {
    private String tipo; /* CURSOR, MOVEMENT, SELECTION */
    private Object payload;
}

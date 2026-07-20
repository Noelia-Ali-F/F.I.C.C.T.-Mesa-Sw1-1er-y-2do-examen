package com.workflow.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentCollabMessage {
    private String type; // 'CURSOR', 'EDIT', 'COMMENT'
    private String author;
    private String text;
    private String content;
    private Double cursorX;
    private Double cursorY;
    private Long timestamp;
}

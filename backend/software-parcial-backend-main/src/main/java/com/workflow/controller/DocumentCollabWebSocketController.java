package com.workflow.controller;

import com.workflow.dto.request.DocumentCollabMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import java.security.Principal;

@Slf4j
@Controller
public class DocumentCollabWebSocketController {

    @MessageMapping("/document/{docId}/collab")
    @SendTo("/topic/document/{docId}/collab")
    public DocumentCollabMessage handleCollabMessage(
            @DestinationVariable String docId,
            DocumentCollabMessage message,
            Principal principal
    ) {
        message.setAuthor(principal.getName());
        log.debug("[WebSocket] Message received for doc {}: Type: {}, Author: {}", docId, message.getType(), message.getAuthor());
        if (message.getTimestamp() == null) {
            message.setTimestamp(System.currentTimeMillis());
        }
        return message;
    }
}

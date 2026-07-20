package com.workflow.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "user_device_tokens")
public class UserDeviceToken {

    @Id
    private String id;
    
    private String usuarioId;

    private String codigoSeguimiento;
    
    private String token;
    
    private String platform; // e.g. web, android, ios
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
}

package com.workflow.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

/**
 * Configuración de MongoDB.
 * Habilita auditoría para @CreatedDate y @LastModifiedDate.
 */
@Configuration
@EnableMongoAuditing
public class MongoConfig {
    // La conexión se configura desde application.yml
    // La auditoría llena automáticamente fechaCreacion y fechaActualizacion
}

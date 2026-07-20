package com.workflow.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

@Slf4j
@Configuration
public class FirebaseConfig {

    @Value("${app.firebase.project-id:${FIREBASE_PROJECT_ID:}}")
    private String firebaseProjectId;

    @Value("${app.firebase.credentials-path:${FIREBASE_CREDENTIALS_PATH:}}")
    private String credentialsPath;

    @PostConstruct
    public void initialize() {
        try {
            if (!FirebaseApp.getApps().isEmpty()) {
                return;
            }

            GoogleCredentials credentials = loadCredentials();
            FirebaseOptions.Builder builder = FirebaseOptions.builder()
                .setCredentials(credentials);

            if (firebaseProjectId != null && !firebaseProjectId.isBlank()) {
                builder.setProjectId(firebaseProjectId);
            }

            FirebaseApp.initializeApp(builder.build());
            log.info("Firebase inicializado correctamente para el proyecto {}",
                (firebaseProjectId == null || firebaseProjectId.isBlank()) ? "default" : firebaseProjectId);
        } catch (Exception e) {
            // Evita que la app falle al arrancar si Firebase no responde
            log.error("CRITICO: No se pudo iniciar Firebase, pero la app seguira arrancando: {}", e.getMessage());
        }
    }

    private GoogleCredentials loadCredentials() throws IOException {
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            try (InputStream stream = new FileInputStream(credentialsPath)) {
                return GoogleCredentials.fromStream(stream);
            }
        }

        return GoogleCredentials.getApplicationDefault();
    }
}

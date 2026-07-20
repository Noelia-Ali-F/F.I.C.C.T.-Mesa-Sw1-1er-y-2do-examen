package com.workflow.controller;

import com.workflow.domain.model.UserDeviceToken;
import com.workflow.repository.SolicitudWorkflowRepository;
import com.workflow.repository.UserDeviceTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class NotificationController {

    private final UserDeviceTokenRepository tokenRepository;
    private final SolicitudWorkflowRepository solicitudRepository;

    @PostMapping("/register-token")
    public ResponseEntity<?> registerToken(@RequestBody Map<String, String> request) {
        String usuarioId = request.get("usuarioId");
        String token = request.get("token");
        String platform = request.getOrDefault("platform", "web");

        if (usuarioId == null || usuarioId.isBlank()) {
            return ResponseEntity.badRequest().body("usuarioId is required");
        }
        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body("Token is required");
        }

        saveToken(usuarioId, null, token, platform);
        return ResponseEntity.ok(Map.of("message", "Token registered successfully"));
    }

    @PostMapping("/register-tracking-token")
    public ResponseEntity<?> registerTrackingToken(@RequestBody Map<String, String> request) {
        String codigoSeguimiento = request.get("codigoSeguimiento");
        String token = request.get("token");
        String platform = request.getOrDefault("platform", "android");

        if (codigoSeguimiento == null || codigoSeguimiento.isBlank()) {
            return ResponseEntity.badRequest().body("codigoSeguimiento is required");
        }
        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body("Token is required");
        }
        if (!solicitudRepository.existsByCodigoSeguimiento(codigoSeguimiento)) {
            return ResponseEntity.badRequest().body("codigoSeguimiento does not exist");
        }

        saveToken(null, codigoSeguimiento, token, platform);
        return ResponseEntity.ok(Map.of("message", "Tracking token registered successfully"));
    }

    @DeleteMapping("/unregister-token")
    public ResponseEntity<?> unregisterToken(@RequestParam String token) {
        tokenRepository.deleteByToken(token);
        return ResponseEntity.ok(Map.of("message", "Token unregistered successfully"));
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(@RequestParam String usuarioId) {
        if (usuarioId == null || usuarioId.isBlank()) {
            return ResponseEntity.badRequest().body("usuarioId is required");
        }

        boolean enabled = tokenRepository.existsByUsuarioId(usuarioId);
        return ResponseEntity.ok(Map.of("enabled", enabled));
    }

    @GetMapping("/tracking-status")
    public ResponseEntity<?> getTrackingStatus(@RequestParam String codigoSeguimiento) {
        if (codigoSeguimiento == null || codigoSeguimiento.isBlank()) {
            return ResponseEntity.badRequest().body("codigoSeguimiento is required");
        }

        boolean enabled = tokenRepository.existsByCodigoSeguimiento(codigoSeguimiento);
        return ResponseEntity.ok(Map.of("enabled", enabled));
    }

    private void saveToken(String usuarioId, String codigoSeguimiento, String token, String platform) {
        tokenRepository.findByToken(token).ifPresentOrElse(
                existing -> {
                    existing.setUsuarioId(usuarioId);
                    existing.setCodigoSeguimiento(codigoSeguimiento);
                    existing.setPlatform(platform);
                    existing.setUpdatedAt(LocalDateTime.now());
                    tokenRepository.save(existing);
                },
                () -> {
                    UserDeviceToken newToken = UserDeviceToken.builder()
                            .usuarioId(usuarioId)
                            .codigoSeguimiento(codigoSeguimiento)
                            .token(token)
                            .platform(platform)
                            .createdAt(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .build();
                    tokenRepository.save(newToken);
                }
        );
    }
}

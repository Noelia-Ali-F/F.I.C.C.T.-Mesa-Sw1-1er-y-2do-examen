package com.workflow.service;

import com.google.firebase.messaging.*;
import com.workflow.repository.UserDeviceTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class FcmService {

    private final UserDeviceTokenRepository tokenRepository;

    /**
     * Envía una notificación a un único dispositivo
     */
        public String sendPushNotification(String token, String title, String body, Map<String, String> data) {
        Map<String, String> payload = buildDataPayload(title, body, data);
        Message message = Message.builder()
            .setToken(token)
            .setNotification(Notification.builder()
                .setTitle(title)
                .setBody(body)
                .build())
            .putAllData(payload)
            .setWebpushConfig(buildWebpushConfig(payload, title, body))
            .build();

        try {
            return FirebaseMessaging.getInstance().send(message);
        } catch (FirebaseMessagingException e) {
            log.error("Error enviando mensaje FCM al token {}: {}", token, e.getMessage());
            handleFirebaseError(e.getMessagingErrorCode(), token);
            return null;
        }
    }

    /**
     * Envía notificaciones a múltiples dispositivos simultáneamente (escalable y óptimo)
     */
    public void sendMulticastPushNotification(List<String> tokens, String title, String body, Map<String, String> data) {
        if (tokens == null || tokens.isEmpty()) {
            return;
        }

        Map<String, String> payload = buildDataPayload(title, body, data);
        MulticastMessage message = MulticastMessage.builder()
            .addAllTokens(tokens)
            .setNotification(Notification.builder()
                .setTitle(title)
                .setBody(body)
                .build())
            .putAllData(payload)
            .setWebpushConfig(buildWebpushConfig(payload, title, body))
            .build();

        try {
            BatchResponse response = FirebaseMessaging.getInstance().sendEachForMulticast(message);
            
            if (response.getFailureCount() > 0) {
                List<SendResponse> responses = response.getResponses();
                List<String> failedTokens = new ArrayList<>();
                
                for (int i = 0; i < responses.size(); i++) {
                    if (!responses.get(i).isSuccessful()) {
                        String failedToken = tokens.get(i);
                        MessagingErrorCode errorCode = responses.get(i).getException().getMessagingErrorCode();
                        log.warn("Fallo al enviar a token {}: {}", failedToken, errorCode);
                        handleFirebaseError(errorCode, failedToken);
                    }
                }
            }
        } catch (FirebaseMessagingException e) {
            log.error("Error crítico enviando mensaje Multicast FCM: {}", e.getMessage(), e);
        }
    }

    public void sendTopicNotification(String topic, String title, String body) {
        Map<String, String> payload = buildDataPayload(title, body, null);
        Message message = Message.builder()
            .setTopic(topic)
            .setNotification(Notification.builder()
                .setTitle(title)
                .setBody(body)
                .build())
            .putAllData(payload)
            .setWebpushConfig(buildWebpushConfig(payload, title, body))
            .build();

        try {
            FirebaseMessaging.getInstance().send(message);
            log.debug("Notificación enviada exitosamente al topic: {}", topic);
        } catch (FirebaseMessagingException e) {
            log.error("Error enviando mensaje FCM por topic {}: {}", topic, e.getMessage(), e);
        }
    }

    private Map<String, String> buildDataPayload(String title, String body, Map<String, String> data) {
        Map<String, String> payload = new HashMap<>();
        if (data != null) {
            payload.putAll(data);
        }

        if (title != null && !title.isBlank()) {
            payload.putIfAbsent("title", title);
        }
        if (body != null && !body.isBlank()) {
            payload.putIfAbsent("body", body);
        }

        payload.putIfAbsent("icon", "/favicon_io/web-app-manifest-192x192.png");
        payload.putIfAbsent("badge", "/favicon_io/favicon-96x96.png");
        payload.putIfAbsent("url", "/");

        return payload;
    }

    private WebpushConfig buildWebpushConfig(Map<String, String> payload, String title, String body) {
        String icon = payload.getOrDefault("icon", "/favicon_io/web-app-manifest-192x192.png");
        String badge = payload.getOrDefault("badge", "/favicon_io/favicon-96x96.png");
        String tag = payload.getOrDefault("codigo", "workflow");
        String link = payload.getOrDefault("url", "/");

        return WebpushConfig.builder()
                .setNotification(WebpushNotification.builder()
                        .setTitle(title)
                        .setBody(body)
                        .setIcon(icon)
                        .setBadge(badge)
                        .setTag(tag)
                        .build())
                .setFcmOptions(WebpushFcmOptions.withLink(link))
                .putAllData(payload)
                .build();
    }

    /**
     * Elimina el token de la base de datos si ya no es válido o caducó
     */
    private void handleFirebaseError(MessagingErrorCode errorCode, String token) {
        if (errorCode == MessagingErrorCode.UNREGISTERED || errorCode == MessagingErrorCode.INVALID_ARGUMENT) {
            log.info("Eliminando token inválido o expirado de la base de datos: {}", token);
            tokenRepository.deleteByToken(token);
        }
    }
}

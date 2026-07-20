package com.workflow.security;

import com.workflow.domain.model.Usuario;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

@Service
public class AuthTokenService {

    private static final long TOKEN_TTL_SECONDS = 8 * 60 * 60;

    @Value("${AUTH_TOKEN_SECRET:workflow-development-hmac-secret-change-before-production-2026}")
    private String secret;

    public String emitir(Usuario usuario) {
        long expiresAt = Instant.now().getEpochSecond() + TOKEN_TTL_SECONDS;
        String payload = encode(usuario.getUsername()) + "." + encode(usuario.getRol().name()) + "."
                + encode(usuario.getDepartamento() == null ? "" : usuario.getDepartamento()) + "." + expiresAt;
        return payload + "." + firmar(payload);
    }

    public Claims verificar(String token) {
        if (token == null || token.isBlank()) throw new IllegalArgumentException("Token ausente");
        String[] parts = token.split("\\.", -1);
        if (parts.length != 5) throw new IllegalArgumentException("Token inválido");
        String payload = String.join(".", parts[0], parts[1], parts[2], parts[3]);
        if (!constantTimeEquals(firmar(payload), parts[4])) throw new IllegalArgumentException("Firma inválida");
        long expiresAt = Long.parseLong(parts[3]);
        if (expiresAt < Instant.now().getEpochSecond()) throw new IllegalArgumentException("Token vencido");
        return new Claims(decode(parts[0]), decode(parts[1]), decode(parts[2]), expiresAt);
    }

    private String firmar(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo firmar el token", e);
        }
    }

    private boolean constantTimeEquals(String expected, String actual) {
        return java.security.MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }

    private String encode(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private String decode(String value) {
        return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
    }

    public record Claims(String username, String rol, String departamento, long expiresAt) {}
}

package com.workflow.service.impl;

import com.workflow.domain.enums.RolUsuario;
import com.workflow.domain.model.Usuario;
import com.workflow.dto.response.PresenciaResumenResponse;
import com.workflow.dto.response.PresenciaUsuarioResponse;
import com.workflow.exception.ResourceNotFoundException;
import com.workflow.exception.UnauthorizedActionException;
import com.workflow.repository.UsuarioRepository;
import com.workflow.service.PresenciaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servicio de presencia colaborativa basado en heartbeat en memoria.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PresenciaServiceImpl implements PresenciaService {

    private static final Comparator<PresenciaUsuarioResponse> ORDEN_COLABORADORES = Comparator
            .comparing(PresenciaUsuarioResponse::getDepartamento, Comparator.nullsLast(String::compareToIgnoreCase))
            .thenComparing(PresenciaUsuarioResponse::getNombreCompleto,
                    Comparator.nullsLast(String::compareToIgnoreCase))
            .thenComparing(PresenciaUsuarioResponse::getUsername, Comparator.nullsLast(String::compareToIgnoreCase));

    private final UsuarioRepository usuarioRepository;
    private final Map<String, SesionPresencia> sesionesActivas = new ConcurrentHashMap<>();

    @Value("${app.workflow.presencia.online-window-seconds:120}")
    private long ventanaOnlineSegundos;

    private static final class SesionPresencia {
        private final String username;
        private final String nombreCompleto;
        private final RolUsuario rol;
        private final String departamento;
        private final String avatarUrl;
        private final LocalDateTime ultimoLatido;

        private SesionPresencia(String username, String nombreCompleto, RolUsuario rol, String departamento,
                String avatarUrl, LocalDateTime ultimoLatido) {
            this.username = username;
            this.nombreCompleto = nombreCompleto;
            this.rol = rol;
            this.departamento = departamento;
            this.avatarUrl = avatarUrl;
            this.ultimoLatido = ultimoLatido;
        }
    }

    @Override
    public void registrarHeartbeat(String usuarioContexto, RolUsuario rolContexto, String departamentoContexto) {
        Usuario usuario = cargarYValidarContexto(usuarioContexto, rolContexto, departamentoContexto);
        LocalDateTime ahora = LocalDateTime.now();

        sesionesActivas.put(
                usuario.getUsername(),
                new SesionPresencia(
                        usuario.getUsername(),
                        usuario.getNombreCompleto(),
                        usuario.getRol(),
                        usuario.getDepartamento(),
                        usuario.getAvatarUrl(),
                        ahora));
    }

    @Override
    public void cerrarSesion(String usuarioContexto, RolUsuario rolContexto, String departamentoContexto) {
        Usuario usuario = cargarYValidarContexto(usuarioContexto, rolContexto, departamentoContexto);
        sesionesActivas.remove(usuario.getUsername());
    }

    @Override
    public PresenciaResumenResponse obtenerResumen(String usuarioSolicitante, RolUsuario rolSolicitante,
            String departamentoSolicitante) {
        Usuario solicitante = cargarYValidarContexto(usuarioSolicitante, rolSolicitante, departamentoSolicitante);

        limpiarSesionesExpiradas();

        LocalDateTime referencia = LocalDateTime.now();
        List<PresenciaUsuarioResponse> activos = sesionesActivas.values().stream()
                .filter(sesion -> estaOnline(sesion, referencia))
                .map(this::mapearSesion)
                .sorted(ORDEN_COLABORADORES)
                .toList();

        String departamentoContexto = solicitante.getDepartamento();

        List<PresenciaUsuarioResponse> visibles = activos;

        List<PresenciaUsuarioResponse> departamento = activos.stream()
                .filter(usuario -> mismoDepartamento(usuario.getDepartamento(), departamentoContexto))
                .toList();

        return PresenciaResumenResponse.builder()
                .totalOnlineSistema(activos.size())
                .totalOnlineVisible(visibles.size())
                .totalEnDepartamento(departamento.size())
                .departamentoContexto(departamentoContexto)
                .usuariosOnline(visibles)
                .usuariosDepartamento(departamento)
                .generadoEn(referencia)
                .build();
    }

    @Scheduled(fixedDelayString = "${app.workflow.presencia.cleanup-fixed-delay-ms:60000}", initialDelayString = "${app.workflow.presencia.cleanup-initial-delay-ms:15000}")
    public void limpiarSesionesExpiradasProgramado() {
        int removidas = limpiarSesionesExpiradas();
        if (removidas > 0) {
            log.debug("Limpieza de presencia completada. Sesiones expiradas removidas: {}", removidas);
        }
    }

    private int limpiarSesionesExpiradas() {
        LocalDateTime referencia = LocalDateTime.now();
        int antes = sesionesActivas.size();
        sesionesActivas.entrySet().removeIf(entry -> !estaOnline(entry.getValue(), referencia));
        return antes - sesionesActivas.size();
    }

    private boolean estaOnline(SesionPresencia sesion, LocalDateTime referencia) {
        return sesion != null
                && sesion.ultimoLatido != null
                && sesion.ultimoLatido.plusSeconds(ventanaOnlineSegundos).isAfter(referencia);
    }

    private PresenciaUsuarioResponse mapearSesion(SesionPresencia sesion) {
        return PresenciaUsuarioResponse.builder()
                .username(sesion.username)
                .nombreCompleto(sesion.nombreCompleto)
                .rol(sesion.rol)
                .departamento(sesion.departamento)
                .avatarUrl(sesion.avatarUrl)
                .ultimoLatido(sesion.ultimoLatido)
                .build();
    }

    private Usuario cargarYValidarContexto(String usuarioContexto, RolUsuario rolContexto,
            String departamentoContexto) {
        Usuario usuario = usuarioRepository.findByUsername(usuarioContexto)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario", "username", usuarioContexto));

        if (rolContexto != null && usuario.getRol() != rolContexto) {
            throw new UnauthorizedActionException("El rol del contexto no coincide con el usuario autenticado");
        }

        if (usuario.getRol() == RolUsuario.REVISOR
                && departamentoContexto != null
                && !departamentoContexto.isBlank()
                && !mismoDepartamento(usuario.getDepartamento(), departamentoContexto)) {
            throw new UnauthorizedActionException(
                    "El departamento del contexto no coincide con el usuario autenticado");
        }

        return usuario;
    }

    private boolean mismoDepartamento(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return a.equalsIgnoreCase(b);
    }
}

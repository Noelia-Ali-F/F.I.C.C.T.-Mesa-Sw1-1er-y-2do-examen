package com.workflow.service.impl;

import com.workflow.domain.enums.RolUsuario;
import com.workflow.domain.model.Usuario;
import com.workflow.dto.request.ActualizarUsuarioRequest;
import com.workflow.dto.request.CrearUsuarioRequest;
import com.workflow.dto.response.UsuarioAdminResponse;
import com.workflow.exception.DuplicateResourceException;
import com.workflow.exception.ResourceNotFoundException;
import com.workflow.repository.DepartamentoRepository;
import com.workflow.repository.UsuarioRepository;
import com.workflow.service.UsuarioAdminService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UsuarioAdminServiceImpl implements UsuarioAdminService {

    // Departments are dynamically loaded from DB via DepartamentoRepository

    private final UsuarioRepository usuarioRepository;
    private final DepartamentoRepository departamentoRepository;

    @Override
    public List<UsuarioAdminResponse> listarUsuarios() {
        return usuarioRepository.findAll(Sort.by(Sort.Direction.ASC, "username"))
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public UsuarioAdminResponse obtenerPorId(String id) {
        return toResponse(buscarUsuarioPorId(id));
    }

    @Override
    public UsuarioAdminResponse crearUsuario(CrearUsuarioRequest request) {
        String username = normalizarCampo(request.getUsername(), "El nombre de usuario es obligatorio");

        if (usuarioRepository.existsByUsername(username)) {
            throw new DuplicateResourceException("El nombre de usuario ya está registrado");
        }

        RolUsuario rol = request.getRol();
        String departamento = normalizarDepartamentoPorRol(request.getDepartamento(), rol);

        Usuario nuevoUsuario = Usuario.builder()
                .username(username)
                .password(normalizarCampo(request.getPassword(), "La contraseña es obligatoria"))
                .nombreCompleto(normalizarCampo(request.getNombreCompleto(), "El nombre completo es obligatorio"))
                .rol(rol)
                .departamento(departamento)
                .fechaCreacion(LocalDateTime.now())
                .build();

        Usuario guardado = usuarioRepository.save(nuevoUsuario);
        log.info("Usuario creado por admin: {}", guardado.getUsername());
        return toResponse(guardado);
    }

    @Override
    public UsuarioAdminResponse actualizarUsuario(String id, ActualizarUsuarioRequest request) {
        Usuario existente = buscarUsuarioPorId(id);

        RolUsuario rol = request.getRol();
        String departamento = normalizarDepartamentoPorRol(request.getDepartamento(), rol);

        existente.setNombreCompleto(normalizarCampo(request.getNombreCompleto(), "El nombre completo es obligatorio"));
        existente.setRol(rol);
        existente.setDepartamento(departamento);

        if (request.getPassword() != null && !request.getPassword().trim().isEmpty()) {
            existente.setPassword(request.getPassword().trim());
        }

        if (request.getAvatarUrl() != null) {
            existente.setAvatarUrl(request.getAvatarUrl());
        }

        Usuario actualizado = usuarioRepository.save(existente);
        log.info("Usuario actualizado por admin: {}", actualizado.getUsername());
        return toResponse(actualizado);
    }

    @Override
    public UsuarioAdminResponse actualizarAvatar(String id, String avatarUrl) {
        Usuario existente = buscarUsuarioPorId(id);
        existente.setAvatarUrl(avatarUrl);
        Usuario actualizado = usuarioRepository.save(existente);
        log.info("Avatar actualizado para usuario: {}", actualizado.getUsername());
        return toResponse(actualizado);
    }


    @Override
    public void eliminarUsuario(String id) {
        Usuario existente = buscarUsuarioPorId(id);
        usuarioRepository.delete(existente);
        log.info("Usuario eliminado por admin: {}", existente.getUsername());
    }

    private Usuario buscarUsuarioPorId(String id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario", "id", id));
    }

    private String normalizarCampo(String valor, String mensajeError) {
        if (valor == null || valor.trim().isEmpty()) {
            throw new IllegalArgumentException(mensajeError);
        }
        return valor.trim();
    }

    private String normalizarDepartamentoPorRol(String departamento, RolUsuario rol) {
        if (rol == null) {
            throw new IllegalArgumentException("El rol del usuario es obligatorio");
        }

        if (rol == RolUsuario.ADMINISTRADOR) {
            if (departamento == null || departamento.isBlank()) {
                return null;
            }
            return normalizarDepartamento(departamento);
        }

        return normalizarDepartamento(departamento);
    }

    private String normalizarDepartamento(String departamento) {
        if (departamento == null || departamento.isBlank()) {
            throw new IllegalArgumentException("El departamento es obligatorio para el rol seleccionado");
        }

        String valor = departamento.trim();

        // Load valid departments dynamically from DB
        List<String> validos = departamentoRepository.findAllByOrderByNombreAsc()
                .stream()
                .map(d -> d.getNombre())
                .toList();

        // Fallback to hardcoded list if DB is empty
        if (validos.isEmpty()) {
            validos = List.of("Sistemas", "Ventas", "Recursos Humanos");
        }

        final List<String> validosFinal = validos;
        return validosFinal.stream()
                .filter(dep -> dep.equalsIgnoreCase(valor))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        String.format(
                                "Departamento '%s' no válido. Valores permitidos: %s",
                                departamento,
                                String.join(", ", validosFinal)
                        )
                ));
    }

    private UsuarioAdminResponse toResponse(Usuario usuario) {
        return UsuarioAdminResponse.builder()
                .id(usuario.getId())
                .username(usuario.getUsername())
                .nombreCompleto(usuario.getNombreCompleto())
                .rol(usuario.getRol())
                .departamento(usuario.getDepartamento())
                .fechaCreacion(usuario.getFechaCreacion())
                .avatarUrl(usuario.getAvatarUrl())
                .build();
    }
}
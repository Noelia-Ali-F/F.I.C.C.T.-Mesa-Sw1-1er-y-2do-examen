package com.workflow.service.impl;

import com.workflow.domain.model.Usuario;
import com.workflow.dto.request.LoginRequest;
import com.workflow.dto.request.RegisterRequest;
import com.workflow.dto.response.AuthResponse;
import com.workflow.exception.DuplicateResourceException;
import com.workflow.exception.ResourceNotFoundException;
import com.workflow.exception.UnauthorizedActionException;
import com.workflow.repository.UsuarioRepository;
import com.workflow.service.AuthService;
import com.workflow.security.AuthTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UsuarioRepository usuarioRepository;
    private final AuthTokenService tokenService;

    @Override
    public AuthResponse login(LoginRequest request) {
        log.info("Intento de login para usuario: {}", request.getUsername());
        
        Usuario usuario = usuarioRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
                
        // Validación MUY básica para pruebas (sin bcrypt ni encoder en esta demo)
        if (!usuario.getPassword().equals(request.getPassword())) {
            throw new UnauthorizedActionException("Contraseña incorrecta");
        }
        
        return buildAuthResponse(usuario);
    }

    @Override
    public AuthResponse register(RegisterRequest request) {
        log.info("Intento de registro para usuario: {}", request.getUsername());
        
        if (usuarioRepository.existsByUsername(request.getUsername())) {
            throw new DuplicateResourceException("El nombre de usuario ya está registrado");
        }
        
        Usuario nuevoUsuario = Usuario.builder()
                .username(request.getUsername())
                .password(request.getPassword()) // Contraseña en texto plano para demo
                .nombreCompleto(request.getNombreCompleto())
                .rol(request.getRol())
                .departamento(request.getDepartamento())
                .avatarUrl(generarAvatarUrl(request.getNombreCompleto()))
                .fechaCreacion(LocalDateTime.now())
                .build();
                
        usuarioRepository.save(nuevoUsuario);
        
        return buildAuthResponse(nuevoUsuario);
    }
    
    private AuthResponse buildAuthResponse(Usuario usuario) {
        return AuthResponse.builder()
                .token(tokenService.emitir(usuario))
                .username(usuario.getUsername())
                .nombreCompleto(usuario.getNombreCompleto())
                .rol(usuario.getRol())
                .departamento(usuario.getDepartamento())
                .avatarUrl(usuario.getAvatarUrl())
                .build();
    }

    private String generarAvatarUrl(String nombreCompleto) {
        if (nombreCompleto == null || nombreCompleto.isBlank()) {
            return "https://ui-avatars.com/api/?name=U&background=334155&color=fff&bold=true&size=128";
        }
        String encoded = nombreCompleto.trim().replace(" ", "+");
        return "https://ui-avatars.com/api/?name=" + encoded + "&background=random&color=fff&bold=true&size=128";
    }
}

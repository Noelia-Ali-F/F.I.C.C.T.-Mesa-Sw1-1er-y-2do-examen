package com.workflow.repository;

import com.workflow.domain.enums.RolUsuario;
import com.workflow.domain.model.Usuario;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends MongoRepository<Usuario, String> {
    
    Optional<Usuario> findByUsername(String username);
    
    boolean existsByUsername(String username);

    List<Usuario> findByRol(RolUsuario rol);

    List<Usuario> findByRolAndDepartamentoIgnoreCase(RolUsuario rol, String departamento);
}

package com.workflow.service;

import com.workflow.dto.request.ActualizarUsuarioRequest;
import com.workflow.dto.request.CrearUsuarioRequest;
import com.workflow.dto.response.UsuarioAdminResponse;

import java.util.List;

public interface UsuarioAdminService {

    List<UsuarioAdminResponse> listarUsuarios();

    UsuarioAdminResponse obtenerPorId(String id);

    UsuarioAdminResponse crearUsuario(CrearUsuarioRequest request);

    UsuarioAdminResponse actualizarUsuario(String id, ActualizarUsuarioRequest request);

    UsuarioAdminResponse actualizarAvatar(String id, String avatarUrl);

    void eliminarUsuario(String id);
}
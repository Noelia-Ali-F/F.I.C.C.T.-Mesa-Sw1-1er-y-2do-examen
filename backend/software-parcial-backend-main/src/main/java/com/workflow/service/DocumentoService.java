package com.workflow.service;

import com.workflow.domain.model.Documento;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Servicio que define la lógica de negocio para la gestión documental avanzada (DMS).
 */
public interface DocumentoService {

    List<Documento> listarPorSolicitud(String solicitudId);

    List<Documento> listarPorTarea(String tareaId);

    List<Documento> listarPorPolitica(String policyKey);

    Documento obtenerPorId(String id);

    Documento crearDocumentoArchivo(String solicitudId, String nombre, String descripcion, MultipartFile archivo, String usuario);

    Documento crearDocumentoColaborativo(String solicitudId, String nombre, String descripcion, String contenidoInicial, String usuario);

    Documento crearDocumentoColaborativoContexto(String solicitudId, String policyKey, String tareaId,
                                                   String taskInstanceId, String categoria, String formato,
                                                   String nombre, String descripcion, String contenidoInicial,
                                                   String usuario, String departamento);

    boolean puedeAcceder(Documento documento, String usuario, String rol, String departamento, boolean escritura);

    Documento subirNuevaVersionArchivo(String id, MultipartFile archivo, String comentario, String usuario);

    Documento guardarSnapshotVersionColaborativo(String id, String comentario, String usuario);

    Documento actualizarContenidoColaborativo(String id, String nuevoContenido, String usuario);

    Documento bloquearDocumento(String id, String usuario);

    Documento desbloquearDocumento(String id, String usuario);

    void eliminarDocumento(String id, String usuario);

    Documento asociarASolicitudYTarea(String id, String solicitudId, String tareaId, String usuario);

    List<Documento> buscarDocumentos(String nombre);

    List<Documento> listarTodos();

    Documento gestionarColaboradores(String id, String colaborador, String accion, String usuario);

    Documento restaurarVersion(String id, int versionOrigen, String comentario, String usuario);

    Documento decidirAprobacion(String id, String accion, String observacion, String usuario, String rol, String departamento);

    void validarContextoCreacion(String solicitudId, String policyKey, String tareaId, String taskInstanceId,
                                 String usuario, String rol, String departamento);
}

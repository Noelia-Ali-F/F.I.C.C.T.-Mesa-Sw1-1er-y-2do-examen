package com.workflow.service;

import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.enums.RolUsuario;
import com.workflow.domain.model.SolicitudWorkflow;
import com.workflow.dto.request.CambiarEstadoRequest;
import com.workflow.dto.request.CrearSolicitudRequest;
import com.workflow.dto.request.ReasignarDepartamentoRequest;
import com.workflow.dto.response.SolicitudResponse;

import java.util.List;
import java.util.Map;

/**
 * Contrato del servicio de workflow departamental.
 * Define las operaciones de negocio disponibles.
 */
public interface WorkflowService {

    /**
     * Crea una nueva solicitud de workflow.
     * Solo SOLICITANTE y ADMINISTRADOR pueden crear solicitudes.
     */
    SolicitudResponse crearSolicitud(CrearSolicitudRequest request, String usuarioCreador, RolUsuario rolUsuario);

    /**
     * Crea una nueva solicitud con archivos adjuntos.
     */
    SolicitudResponse crearSolicitudConArchivos(CrearSolicitudRequest request, org.springframework.web.multipart.MultipartFile[] archivos, String usuarioCreador, RolUsuario rolUsuario);

    /**
     * Obtiene una solicitud por su ID.
     */
    SolicitudResponse obtenerPorId(String id);

    /**
     * Obtiene una solicitud por su código de seguimiento.
     */
    SolicitudResponse obtenerPorCodigoSeguimiento(String codigoSeguimiento);

    /**
     * Lista solicitudes por departamento.
     * El REVISOR solo puede ver su departamento.
     */
    List<SolicitudResponse> listarPorDepartamento(String departamento);

    /**
     * Lista solicitudes por departamento y estado.
     */
    List<SolicitudResponse> listarPorDepartamentoYEstado(String departamento, EstadoWorkflow estado);

    /**
     * Lista solicitudes creadas por un usuario.
     */
    List<SolicitudResponse> listarPorUsuarioCreador(String usuario);

    /**
     * Lista todas las solicitudes (solo ADMINISTRADOR).
     */
    List<SolicitudResponse> listarTodas();

    /**
     * Cambia el estado de una solicitud validando permisos y transiciones.
     */
    SolicitudResponse cambiarEstado(String id, CambiarEstadoRequest request, String usuarioResponsable, RolUsuario rolUsuario, String departamentoUsuario);

    /**
     * Reasigna una solicitud a otro departamento (solo ADMINISTRADOR).
     */
        SolicitudResponse reasignarDepartamento(
            String id,
            ReasignarDepartamentoRequest request,
            String usuarioResponsable,
            RolUsuario rolUsuario,
            String departamentoUsuario
        );

        /**
         * Obtiene catálogo fijo de departamentos válidos para el workflow.
         */
        List<String> obtenerCatalogoDepartamentos();

        /**
         * Obtiene recomendación de reasignación manual basada en cola PENDIENTE.
         */
        Map<String, Object> obtenerRecomendacionReasignacion(String id);

    /**
     * Asigna un usuario revisor a una solicitud.
     */
    SolicitudResponse asignarUsuario(String id, String usuarioAsignado, String usuarioResponsable, RolUsuario rol);

    /**
     * Obtiene estadísticas generales del workflow (KPIs).
     */
    Map<String, Object> obtenerEstadisticas();

    /**
     * Obtiene el mapa del diagrama por calles de departamento.
     */
    Map<String, List<SolicitudResponse>> obtenerDiagramaCalles();

    /**
     * Busca solicitudes por título.
     */
    List<SolicitudResponse> buscarPorTitulo(String titulo);

    /**
     * Asocia una definición de proceso BPMN y establece la tarea inicial.
     */
    SolicitudResponse asociarProcesoBpm(String id, String workflowDefinitionId, String tareaId, String tareaNombre, String usuarioResponsable, String rolUsuario);

    /**
     * Mueve la solicitud a otra tarea en el proceso BPMN.
     */
    SolicitudResponse cambiarTareaBpm(String id, String flowId, String tareaId, String tareaNombre, String usuarioResponsable, String rolUsuario);
}

package com.workflow.controller;

import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.enums.RolUsuario;
import com.workflow.dto.request.CambiarEstadoRequest;
import com.workflow.dto.request.CrearSolicitudRequest;
import com.workflow.dto.request.ReasignarDepartamentoRequest;
import com.workflow.dto.response.ApiResponse;
import com.workflow.dto.response.SolicitudResponse;
import com.workflow.exception.UnauthorizedActionException;
import com.workflow.service.WorkflowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Controlador REST para el sistema de workflow departamental.
 *
 * Endpoints:
 * POST   /api/v1/workflows                            → Crear solicitud
 * GET    /api/v1/workflows                             → Listar todas (Admin)
 * GET    /api/v1/workflows/{id}                        → Obtener por ID
 * GET    /api/v1/workflows/seguimiento/{codigo}        → Obtener por código
 * GET    /api/v1/workflows/departamento/{nombre}       → Listar por departamento
 * GET    /api/v1/workflows/departamento/{nombre}/estado/{estado} → Filtrar por depto y estado
 * GET    /api/v1/workflows/usuario/{usuario}           → Listar por usuario creador
 * GET    /api/v1/workflows/buscar                      → Buscar por título
 * GET    /api/v1/workflows/catalogo/departamentos      → Catálogo de departamentos
 * GET    /api/v1/workflows/{id}/recomendacion-reasignacion → Recomendación por cola
 * PATCH  /api/v1/workflows/{id}/estado                 → Cambiar estado
 * PATCH  /api/v1/workflows/{id}/departamento           → Reasignar departamento
 * GET    /api/v1/workflows/estadisticas                → KPIs
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/workflows")
@RequiredArgsConstructor
@Tag(name = "Workflow Departamental", description = "Endpoints para la gestión de solicitudes, asignaciones de departamentos y estados de Workflow.")
public class WorkflowController {

    private final WorkflowService workflowService;
    private final com.workflow.service.ArchivoStorageService archivoStorageService;

    // ═══════════════════════════════════════════════════════════════
    //  CREAR
    // ═══════════════════════════════════════════════════════════════

    /**
     * Crea una nueva solicitud de workflow.
     * Acepta JSON body + archivos opcionales como multipart.
     * Actor: SOLICITANTE
     */
    @PostMapping
    @Operation(summary = "Crear nueva solicitud (JSON)", description = "Permite a un SOLICITANTE iniciar un nuevo trámite/solicitud en un departamento específico.")
    public ResponseEntity<ApiResponse<SolicitudResponse>> crearSolicitud(
            @Valid @RequestBody CrearSolicitudRequest request,
                        @RequestHeader(value = "X-Usuario", required = false) String usuarioCreador,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario) {

                validarContextoBasico(usuarioCreador, rolUsuario);

        log.info("POST /api/v1/workflows - Creando solicitud: '{}'", request.getTitulo());
        SolicitudResponse response = workflowService.crearSolicitud(request, usuarioCreador, rolUsuario);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Solicitud creada exitosamente", response));
    }

    /**
     * Crea una nueva solicitud con archivos adjuntos (multipart).
     * El JSON de la solicitud se envía en el part "solicitud" y los archivos en "archivos".
     */
    @PostMapping(value = "/con-archivos", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Crear solicitud con archivos", description = "Crea solicitud con archivos adjuntos. El JSON va en part 'solicitud', los archivos en part 'archivos'.")
    public ResponseEntity<ApiResponse<SolicitudResponse>> crearSolicitudConArchivos(
            @RequestPart("solicitud") @Valid CrearSolicitudRequest request,
            @RequestPart(value = "archivos", required = false) org.springframework.web.multipart.MultipartFile[] archivos,
            @RequestHeader(value = "X-Usuario", required = false) String usuarioCreador,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario) {

        validarContextoBasico(usuarioCreador, rolUsuario);

        log.info("POST /api/v1/workflows/con-archivos - Creando solicitud: '{}' con {} archivos",
                request.getTitulo(), archivos != null ? archivos.length : 0);

        SolicitudResponse response = workflowService.crearSolicitudConArchivos(
                request, archivos, usuarioCreador, rolUsuario);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Solicitud creada exitosamente con archivos", response));
    }

    // ═══════════════════════════════════════════════════════════════
    //  CONSULTAS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Lista todas las solicitudes.
     * Actor: ADMINISTRADOR
     */
    @GetMapping
    @Operation(summary = "Listar todas las solicitudes", description = "Obtiene absolutamente todas las solicitudes. Ideal para vista global de Administradores.")
        public ResponseEntity<ApiResponse<List<SolicitudResponse>>> listarTodas(
                        @RequestHeader(value = "X-Usuario", required = false) String usuario,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
                        @RequestParam(value = "fechaDesde", required = false) LocalDate fechaDesde,
                        @RequestParam(value = "fechaHasta", required = false) LocalDate fechaHasta) {

                validarContextoBasico(usuario, rolUsuario);
                if (!rolUsuario.puedeAdministrar() && !rolUsuario.puedeRevisar()) {
                        throw new UnauthorizedActionException(rolUsuario.name(), "listar todas las solicitudes");
                }

        log.info("GET /api/v1/workflows - Listando todas las solicitudes");
        List<SolicitudResponse> solicitudes = workflowService.listarTodas();
        if (fechaDesde != null && fechaHasta != null && fechaDesde.isAfter(fechaHasta)) {
            throw new IllegalArgumentException("fechaDesde no puede ser posterior a fechaHasta");
        }
        if (fechaDesde != null || fechaHasta != null) {
            solicitudes = solicitudes.stream()
                    .filter(s -> s.getFechaCreacion() != null)
                    .filter(s -> fechaDesde == null || !s.getFechaCreacion().toLocalDate().isBefore(fechaDesde))
                    .filter(s -> fechaHasta == null || !s.getFechaCreacion().toLocalDate().isAfter(fechaHasta))
                    .toList();
        }

        return ResponseEntity.ok(
                ApiResponse.ok("Solicitudes obtenidas exitosamente", solicitudes)
        );
    }

    /**
     * Obtiene una solicitud por su ID.
     */
    @GetMapping("/{id}")
    @Operation(summary = "Obtener por ID interno", description = "Recuperar los detalles de una solicitud específica basándose en su ID de MongoDB.")
        public ResponseEntity<ApiResponse<SolicitudResponse>> obtenerPorId(
                        @PathVariable String id,
                        @RequestHeader(value = "X-Usuario", required = false) String usuario,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
                        @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

                validarContextoConDepartamentoSiRevisor(usuario, rolUsuario, departamentoUsuario);

        log.info("GET /api/v1/workflows/{} - Obteniendo solicitud", id);
        SolicitudResponse response = workflowService.obtenerPorId(id);

                if (!puedeVerSolicitud(response, usuario, rolUsuario, departamentoUsuario)) {
                        throw new UnauthorizedActionException(rolUsuario.name(), "ver la solicitud solicitada");
                }

        return ResponseEntity.ok(ApiResponse.ok("Solicitud encontrada", response));
    }

    /**
     * Obtiene una solicitud por su código de seguimiento.
     */
    @GetMapping("/seguimiento/{codigo}")
    @Operation(summary = "Buscar solicitud por código", description = "Busca una solicitud usando su código de seguimiento generado aleatoriamente (ej. WF-12345).")
    public ResponseEntity<ApiResponse<SolicitudResponse>> obtenerPorCodigo(
                        @PathVariable String codigo,
                        @RequestHeader(value = "X-Usuario", required = false) String usuario,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
                        @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

                if (!StringUtils.hasText(usuario) && rolUsuario == null) {
                        log.info("GET /api/v1/workflows/seguimiento/{} - Consulta pública", codigo);
                        SolicitudResponse response = workflowService.obtenerPorCodigoSeguimiento(codigo);
                        return ResponseEntity.ok(ApiResponse.ok("Solicitud encontrada", response));
                }

                validarContextoConDepartamentoSiRevisor(usuario, rolUsuario, departamentoUsuario);

        log.info("GET /api/v1/workflows/seguimiento/{} - Buscando por código", codigo);
        SolicitudResponse response = workflowService.obtenerPorCodigoSeguimiento(codigo);

                if (!puedeVerSolicitud(response, usuario, rolUsuario, departamentoUsuario)) {
                        throw new UnauthorizedActionException(rolUsuario.name(), "ver la solicitud solicitada");
                }

        return ResponseEntity.ok(ApiResponse.ok("Solicitud encontrada", response));
    }

    @GetMapping("/public/seguimiento/{codigo}")
    @Operation(summary = "Seguimiento público por código", description = "Permite a un ciudadano consultar el estado y etapa actual de su trámite sin credenciales internas.")
    public ResponseEntity<ApiResponse<SolicitudResponse>> obtenerPorCodigoPublico(@PathVariable String codigo) {
        log.info("GET /api/v1/workflows/public/seguimiento/{} - Consulta pública explícita", codigo);
        SolicitudResponse response = workflowService.obtenerPorCodigoSeguimiento(codigo);
        return ResponseEntity.ok(ApiResponse.ok("Solicitud encontrada", response));
    }

    /**
     * Lista solicitudes por departamento.
     * Actor: REVISOR (Jefe de Departamento)
     */
    @GetMapping("/departamento/{nombre}")
    @Operation(summary = "Listar por departamento", description = "Devuelve todas las solicitudes que actualmente residen en el flujo de un departamento.")
    public ResponseEntity<ApiResponse<List<SolicitudResponse>>> listarPorDepartamento(
                        @PathVariable String nombre,
                        @RequestHeader(value = "X-Usuario", required = false) String usuario,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
                        @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

                validarContextoConDepartamentoSiRevisor(usuario, rolUsuario, departamentoUsuario);

                if (rolUsuario == RolUsuario.SOLICITANTE) {
                        throw new UnauthorizedActionException(rolUsuario.name(), "listar solicitudes por departamento");
                }
                if (rolUsuario == RolUsuario.REVISOR
                                && !nombre.equalsIgnoreCase(departamentoUsuario)) {
                        throw new UnauthorizedActionException(
                                        "El revisor solo puede listar solicitudes de su propio departamento"
                        );
                }

        log.info("GET /api/v1/workflows/departamento/{} - Listando por departamento", nombre);
        List<SolicitudResponse> solicitudes = workflowService.listarPorDepartamento(nombre);

        return ResponseEntity.ok(
                ApiResponse.ok("Solicitudes del departamento obtenidas", solicitudes)
        );
    }

    /**
     * Lista solicitudes por departamento y estado.
     */
    @GetMapping("/departamento/{nombre}/estado/{estado}")
    @Operation(summary = "Filtrar por departamento y estado", description = "Combinación para encontrar, por ejemplo, solicitudes 'PENDIENTES' en el depto de 'Sistemas'.")
    public ResponseEntity<ApiResponse<List<SolicitudResponse>>> listarPorDepartamentoYEstado(
            @PathVariable String nombre,
                        @PathVariable EstadoWorkflow estado,
                        @RequestHeader(value = "X-Usuario", required = false) String usuario,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
                        @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

                validarContextoConDepartamentoSiRevisor(usuario, rolUsuario, departamentoUsuario);

                if (rolUsuario == RolUsuario.SOLICITANTE) {
                        throw new UnauthorizedActionException(rolUsuario.name(), "filtrar solicitudes por departamento y estado");
                }
                if (rolUsuario == RolUsuario.REVISOR
                                && !nombre.equalsIgnoreCase(departamentoUsuario)) {
                        throw new UnauthorizedActionException(
                                        "El revisor solo puede filtrar solicitudes de su propio departamento"
                        );
                }

        log.info("GET /api/v1/workflows/departamento/{}/estado/{} - Filtrando", nombre, estado);
        List<SolicitudResponse> solicitudes =
                workflowService.listarPorDepartamentoYEstado(nombre, estado);

        return ResponseEntity.ok(
                ApiResponse.ok("Solicitudes filtradas por departamento y estado", solicitudes)
        );
    }

    /**
     * Lista solicitudes creadas por un usuario específico.
     */
    @GetMapping("/usuario/{usuario}")
    @Operation(summary = "Mis solicitudes", description = "Busca todas las solicitudes iniciadas por un identificador de usuario creador.")
    public ResponseEntity<ApiResponse<List<SolicitudResponse>>> listarPorUsuario(
                        @PathVariable String usuario,
                        @RequestHeader(value = "X-Usuario", required = false) String usuarioSolicitante,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario) {

                validarContextoBasico(usuarioSolicitante, rolUsuario);

                if (rolUsuario == RolUsuario.REVISOR) {
                        throw new UnauthorizedActionException(rolUsuario.name(), "listar solicitudes por usuario");
                }

                if (rolUsuario == RolUsuario.SOLICITANTE
                                && !usuario.equalsIgnoreCase(usuarioSolicitante)) {
                        throw new UnauthorizedActionException(
                                        "El solicitante solo puede listar sus propias solicitudes"
                        );
                }

                log.info("GET /api/v1/workflows/usuario/{} - Listando por usuario creador", usuario);
                List<SolicitudResponse> solicitudes = workflowService.listarPorUsuarioCreador(usuario);

        return ResponseEntity.ok(
                ApiResponse.ok("Solicitudes del usuario obtenidas", solicitudes)
        );
    }

    /**
     * Busca solicitudes por título (búsqueda parcial).
     */
    @GetMapping("/buscar")
    @Operation(summary = "Busqueda global parcial", description = "Busca y retorna las solicitudes basándose en coincidencias parciales del Título.")
    public ResponseEntity<ApiResponse<List<SolicitudResponse>>> buscarPorTitulo(
            @RequestParam String titulo,
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
            @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

        validarContextoConDepartamentoSiRevisor(usuario, rolUsuario, departamentoUsuario);

        log.info("GET /api/v1/workflows/buscar?titulo={}", titulo);
        List<SolicitudResponse> solicitudes = workflowService.buscarPorTitulo(titulo)
                .stream()
                .filter(s -> puedeVerSolicitud(s, usuario, rolUsuario, departamentoUsuario))
                .collect(Collectors.toList());

        return ResponseEntity.ok(
                ApiResponse.ok("Resultados de búsqueda", solicitudes)
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  ACCIONES DE WORKFLOW
    // ═══════════════════════════════════════════════════════════════

        @GetMapping("/catalogo/departamentos")
        @Operation(summary = "Catálogo de departamentos", description = "Retorna los departamentos válidos para crear y reasignar solicitudes.")
        public ResponseEntity<ApiResponse<List<String>>> obtenerCatalogoDepartamentos(
                        @RequestHeader(value = "X-Usuario", required = false) String usuario,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
                        @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

                validarContextoConDepartamentoSiRevisor(usuario, rolUsuario, departamentoUsuario);
                List<String> catalogo = workflowService.obtenerCatalogoDepartamentos();

                return ResponseEntity.ok(ApiResponse.ok("Catálogo obtenido exitosamente", catalogo));
        }

        @GetMapping("/{id}/recomendacion-reasignacion")
        @Operation(summary = "Recomendación de reasignación", description = "Devuelve carga de cola PENDIENTE por departamento y una sugerencia para reasignación manual.")
        public ResponseEntity<ApiResponse<Map<String, Object>>> obtenerRecomendacionReasignacion(
                        @PathVariable String id,
                        @RequestHeader(value = "X-Usuario", required = false) String usuario,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
                        @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

                validarContextoConDepartamentoSiRevisor(usuario, rolUsuario, departamentoUsuario);

                if (rolUsuario != RolUsuario.REVISOR && rolUsuario != RolUsuario.ADMINISTRADOR) {
                        throw new UnauthorizedActionException(rolUsuario.name(), "consultar recomendación de reasignación");
                }

                SolicitudResponse solicitud = workflowService.obtenerPorId(id);
                if (!puedeVerSolicitud(solicitud, usuario, rolUsuario, departamentoUsuario)) {
                        throw new UnauthorizedActionException(rolUsuario.name(), "consultar recomendación de una solicitud fuera de su alcance");
                }

                Map<String, Object> recomendacion = workflowService.obtenerRecomendacionReasignacion(id);
                return ResponseEntity.ok(ApiResponse.ok("Recomendación generada", recomendacion));
        }

    /**
     * Cambia el estado de una solicitud de workflow.
     * El Service valida la máquina de estados y los permisos del rol.
     * Actor: REVISOR (transiciones normales) | ADMINISTRADOR (forzado)
     */
    @PatchMapping("/{id}/estado")
    @Operation(summary = "Actualizar estado / Aprobar / Rechazar", description = "Principal operación del Revisor. Permite mover la solicitud dentro del flujo válido.")
    public ResponseEntity<ApiResponse<SolicitudResponse>> cambiarEstado(
            @PathVariable String id,
            @Valid @RequestBody CambiarEstadoRequest request,
                        @RequestHeader(value = "X-Usuario", required = false) String usuarioResponsable,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
                        @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

                validarContextoConDepartamentoSiRevisor(usuarioResponsable, rolUsuario, departamentoUsuario);

        log.info("PATCH /api/v1/workflows/{}/estado - Cambiando a: {}", id, request.getNuevoEstado());
        SolicitudResponse response = workflowService.cambiarEstado(id, request, usuarioResponsable, rolUsuario, departamentoUsuario);

        return ResponseEntity.ok(
                ApiResponse.ok("Estado actualizado exitosamente", response)
        );
    }

    /**
     * Reasigna una solicitud a otro departamento.
     * Actor: ADMINISTRADOR
     */
    @PatchMapping("/{id}/departamento")
    @Operation(summary = "Reasignar de departamento", description = "El administrador puede transferir una solicitud a otro departamento registrando esto en el historial.")
    public ResponseEntity<ApiResponse<SolicitudResponse>> reasignarDepartamento(
            @PathVariable String id,
            @Valid @RequestBody ReasignarDepartamentoRequest request,
                        @RequestHeader(value = "X-Usuario", required = false) String usuarioResponsable,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
            @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

                validarContextoConDepartamentoSiRevisor(usuarioResponsable, rolUsuario, departamentoUsuario);

        log.info("PATCH /api/v1/workflows/{}/departamento - Reasignando a: {}",
                id, request.getNuevoDepartamento());
        SolicitudResponse response = workflowService.reasignarDepartamento(
                id,
                request,
                usuarioResponsable,
                rolUsuario,
                departamentoUsuario
        );

        return ResponseEntity.ok(
                ApiResponse.ok("Departamento reasignado exitosamente", response)
        );
    }

    /**
     * Asigna un usuario revisor a una solicitud específica.
     * Actor: ADMINISTRADOR o Jefe de Departamento
     */
    @PatchMapping("/{id}/asignar")
    @Operation(summary = "Asignar Usuario a Solicitud", description = "Asigna directamente a la persona encargada de trabajar la solicitud.")
    public ResponseEntity<ApiResponse<SolicitudResponse>> asignarUsuario(
            @PathVariable String id,
            @Valid @RequestBody com.workflow.dto.request.AsignarUsuarioRequest request,
                        @RequestHeader(value = "X-Usuario", required = false) String usuarioResponsable,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
                        @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

                validarContextoConDepartamentoSiRevisor(usuarioResponsable, rolUsuario, departamentoUsuario);

                if (rolUsuario == RolUsuario.REVISOR) {
                        SolicitudResponse solicitud = workflowService.obtenerPorId(id);
                        if (!puedeVerSolicitud(solicitud, usuarioResponsable, rolUsuario, departamentoUsuario)) {
                                throw new UnauthorizedActionException(
                                                "El revisor solo puede asignar usuarios dentro de su departamento"
                                );
                        }
                }

        log.info("PATCH /api/v1/workflows/{}/asignar - Asignando a: {}", id, request.getUsuarioAsignado());
        SolicitudResponse response = workflowService.asignarUsuario(
                id, 
                request.getUsuarioAsignado(), 
                usuarioResponsable, 
                rolUsuario
        );

        return ResponseEntity.ok(
                ApiResponse.ok("Usuario asignado exitosamente", response)
        );
    }

    @PatchMapping("/{id}/bpm-proceso")
    @Operation(summary = "Asociar proceso BPMN e iniciar primer etapa", description = "Asocia una definición de proceso BPMN y establece la tarea inicial de la solicitud")
    public ResponseEntity<ApiResponse<SolicitudResponse>> asociarProcesoBpm(
            @PathVariable String id,
            @RequestParam String workflowDefinitionId,
            @RequestParam String tareaId,
            @RequestParam String tareaNombre,
            @RequestHeader(value = "X-Usuario", required = false, defaultValue = "anonimo") String usuario,
            @RequestHeader(value = "X-Rol", required = false, defaultValue = "REVISOR") String rol
    ) {
        log.info("PATCH /api/v1/workflows/{}/bpm-proceso - Iniciando proceso {} en {}", id, workflowDefinitionId, tareaId);
        SolicitudResponse actualizada = workflowService.asociarProcesoBpm(id, workflowDefinitionId, tareaId, tareaNombre, usuario, rol);
        return ResponseEntity.ok(ApiResponse.ok("Proceso BPMN iniciado exitosamente en la tarea: " + tareaNombre, actualizada));
    }

    @PatchMapping("/{id}/bpm-tarea")
    @Operation(summary = "Cambiar tarea actual BPMN de la solicitud", description = "Mueve la solicitud a otra tarea dentro del proceso BPMN")
    public ResponseEntity<ApiResponse<SolicitudResponse>> cambiarTareaBpm(
            @PathVariable String id,
            @RequestParam String flowId,
            @RequestParam String tareaId,
            @RequestParam String tareaNombre,
            @RequestHeader(value = "X-Usuario", required = false, defaultValue = "anonimo") String usuario,
            @RequestHeader(value = "X-Rol", required = false, defaultValue = "REVISOR") String rol
    ) {
        log.info("PATCH /api/v1/workflows/{}/bpm-tarea - Moviendo a tarea {} ({}) en flow {}", id, tareaId, tareaNombre, flowId);
        SolicitudResponse actualizada = workflowService.cambiarTareaBpm(id, flowId, tareaId, tareaNombre, usuario, rol);
        return ResponseEntity.ok(ApiResponse.ok("Solicitud movida exitosamente a: " + tareaNombre, actualizada));
    }

    // ═══════════════════════════════════════════════════════════════
    //  ESTADÍSTICAS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Obtiene estadísticas generales del sistema de workflow.
     */
    @GetMapping("/estadisticas")
    @Operation(summary = "Resumen y KPIs", description = "Muestra estadisticas sobre cuántas solicitudes hay por cada estado. Útil para Dashboard.")
        public ResponseEntity<ApiResponse<Map<String, Object>>> obtenerEstadisticas(
                        @RequestHeader(value = "X-Usuario", required = false) String usuario,
                        @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
                        @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

                validarContextoConDepartamentoSiRevisor(usuario, rolUsuario, departamentoUsuario);

        log.info("GET /api/v1/workflows/estadisticas - Obteniendo KPIs");
                Map<String, Object> stats;

                if (rolUsuario.puedeAdministrar()) {
                        stats = workflowService.obtenerEstadisticas();
                } else if (rolUsuario == RolUsuario.SOLICITANTE) {
                        stats = construirEstadisticasContextuales(
                                        workflowService.listarPorUsuarioCreador(usuario)
                        );
                } else {
                        stats = construirEstadisticasContextuales(
                                        workflowService.listarPorDepartamento(departamentoUsuario)
                        );
                }

        return ResponseEntity.ok(ApiResponse.ok("Estadísticas del workflow", stats));
    }

    /**
     * Endpoint optimizado para mapeo de Nodos en diagrama tipo Kanban/Swimlanes
     */
    @GetMapping("/diagrama/calles")
    @Operation(summary = "Obtener Calles (Swimlanes)", description = "Agrupa todas las tareas (nodos) por departamento para inyectar directamente en el JointJS de Frontend.")
    public ResponseEntity<ApiResponse<Map<String, List<SolicitudResponse>>>> obtenerDiagramaCalles(
            @RequestHeader(value = "X-Usuario", required = false) String usuario,
            @RequestHeader(value = "X-Rol", required = false) RolUsuario rolUsuario,
            @RequestHeader(value = "X-Departamento", required = false) String departamentoUsuario) {

        validarContextoConDepartamentoSiRevisor(usuario, rolUsuario, departamentoUsuario);

        Map<String, List<SolicitudResponse>> diagrama = workflowService.obtenerDiagramaCalles();
        
                // Return only the allowed scope based on role logic
        if (rolUsuario == RolUsuario.REVISOR) {
            // Un revisor puede visualizar el tablero global de manera colaborativa para conectar tareas entre departamentos.
            return ResponseEntity.ok(ApiResponse.ok("Estructura de calles del diagrama", diagrama));
        }

                if (rolUsuario == RolUsuario.SOLICITANTE) {
                        Map<String, List<SolicitudResponse>> filtered = new LinkedHashMap<>();

                        for (String departamento : workflowService.obtenerCatalogoDepartamentos()) {
                                List<SolicitudResponse> visibles = diagrama.getOrDefault(departamento, List.of())
                                                .stream()
                                                .filter(s -> s.getUsuarioCreador() != null
                                                                && s.getUsuarioCreador().equalsIgnoreCase(usuario))
                                                .collect(Collectors.toList());
                                filtered.put(departamento, visibles);
                        }

                        return ResponseEntity.ok(ApiResponse.ok("Calles del diagrama para el solicitante", filtered));
                }

        return ResponseEntity.ok(ApiResponse.ok("Estructura de calles del diagrama", diagrama));
    }

        private void validarContextoBasico(String usuario, RolUsuario rolUsuario) {
                if (!StringUtils.hasText(usuario) || rolUsuario == null) {
                        throw new UnauthorizedActionException(
                                        "Debe enviar encabezados de contexto válidos: X-Usuario y X-Rol"
                        );
                }
        }

        private void validarContextoConDepartamentoSiRevisor(
                        String usuario,
                        RolUsuario rolUsuario,
                        String departamentoUsuario
        ) {
                validarContextoBasico(usuario, rolUsuario);

                if (rolUsuario == RolUsuario.REVISOR && !StringUtils.hasText(departamentoUsuario)) {
                        throw new UnauthorizedActionException(
                                        "El rol REVISOR debe enviar el encabezado X-Departamento"
                        );
                }
        }

        private boolean puedeVerSolicitud(
                        SolicitudResponse solicitud,
                        String usuario,
                        RolUsuario rolUsuario,
                        String departamentoUsuario
        ) {
                if (rolUsuario == RolUsuario.ADMINISTRADOR) {
                        return true;
                }

                if (rolUsuario == RolUsuario.SOLICITANTE) {
                        return solicitud.getUsuarioCreador() != null
                                        && solicitud.getUsuarioCreador().equalsIgnoreCase(usuario);
                }

                if (rolUsuario == RolUsuario.REVISOR) {
                        // Un REVISOR puede VER cualquier solicitud del sistema (Lectura Global)
                        // pero solo puede ACCIONAR (aprobar/rechazar) las de su depto (esto se valida en el Service).
                        return true; 
                }

                return false;
        }

        private Map<String, Object> construirEstadisticasContextuales(List<SolicitudResponse> solicitudes) {
                Map<String, Object> stats = new HashMap<>();
                Map<String, Long> porEstado = new HashMap<>();

                for (EstadoWorkflow estado : EstadoWorkflow.values()) {
                        porEstado.put(estado.name(), 0L);
                }

                for (SolicitudResponse solicitud : solicitudes) {
                        if (solicitud.getEstado() != null) {
                                porEstado.computeIfPresent(
                                                solicitud.getEstado().name(),
                                                (clave, valorActual) -> valorActual + 1
                                );
                        }
                }

                stats.put("totalSolicitudes", (long) solicitudes.size());
                stats.put("porEstado", porEstado);
                return stats;
        }
}

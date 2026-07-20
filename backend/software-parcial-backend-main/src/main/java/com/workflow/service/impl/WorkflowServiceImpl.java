package com.workflow.service.impl;

import com.workflow.domain.enums.EstadoSla;
import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.enums.Prioridad;
import com.workflow.domain.enums.RolUsuario;
import com.workflow.domain.model.SolicitudWorkflow;
import com.workflow.dto.request.CambiarEstadoRequest;
import com.workflow.dto.request.CrearSolicitudRequest;
import com.workflow.dto.request.ReasignarDepartamentoRequest;
import com.workflow.dto.response.SolicitudResponse;
import com.workflow.exception.InvalidStateTransitionException;
import com.workflow.exception.ResourceNotFoundException;
import com.workflow.exception.UnauthorizedActionException;
import com.workflow.mapper.SolicitudMapper;
import com.workflow.repository.SolicitudWorkflowRepository;
import com.workflow.repository.UsuarioRepository;
import com.workflow.repository.DepartamentoRepository;
import com.workflow.service.CodigoSeguimientoGenerator;
import com.workflow.service.ArchivoStorageService;
import com.workflow.service.WorkflowService;
import com.workflow.service.FcmService;
import com.workflow.repository.UserDeviceTokenRepository;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Implementación del servicio de workflow departamental.
 *
 * Contiene toda la lógica de negocio incluyendo:
 * - Validación de permisos por rol
 * - Validación de transiciones de estado (máquina de estados)
 * - Validación de pertenencia a departamento para revisores
 * - Registro atómico del historial de eventos
 */
@Slf4j
@Service
public class WorkflowServiceImpl implements WorkflowService {

    private static final Map<Prioridad, Long> SLA_HORAS_POR_PRIORIDAD = Map.of(
            Prioridad.URGENTE, 4L,
            Prioridad.ALTA, 8L,
            Prioridad.MEDIA, 24L,
            Prioridad.BAJA, 72L
    );

    private final SolicitudWorkflowRepository repository;
    private final UsuarioRepository usuarioRepository;
    private final DepartamentoRepository departamentoRepository;
    private final SolicitudMapper mapper;
    private final CodigoSeguimientoGenerator codigoGenerator;
    private final ArchivoStorageService archivoStorageService;
    private final FcmService fcmService;
    private final UserDeviceTokenRepository tokenRepository;
    private final com.workflow.repository.WorkflowDefinitionRepository workflowDefinitionRepository;

    public WorkflowServiceImpl(
            SolicitudWorkflowRepository repository,
            UsuarioRepository usuarioRepository,
            DepartamentoRepository departamentoRepository,
            SolicitudMapper mapper,
            CodigoSeguimientoGenerator codigoGenerator,
            ArchivoStorageService archivoStorageService,
            FcmService fcmService,
            UserDeviceTokenRepository tokenRepository,
            com.workflow.repository.WorkflowDefinitionRepository workflowDefinitionRepository
    ) {
        this.repository = repository;
        this.usuarioRepository = usuarioRepository;
        this.departamentoRepository = departamentoRepository;
        this.mapper = mapper;
        this.codigoGenerator = codigoGenerator;
        this.archivoStorageService = archivoStorageService;
        this.fcmService = fcmService;
        this.tokenRepository = tokenRepository;
        this.workflowDefinitionRepository = workflowDefinitionRepository;
    }


    /**
     * Inicializa el generador de códigos con el último secuencial de la BD.
     */
    @PostConstruct
    void inicializarGenerador() {
        String prefijo = String.format("WF-%d-", Year.now().getValue());
        repository.findAll(Sort.by(Sort.Direction.DESC, "codigoSeguimiento"))
                .stream()
                .filter(s -> s.getCodigoSeguimiento() != null && s.getCodigoSeguimiento().startsWith(prefijo))
                .findFirst()
                .ifPresent(ultima -> {
                    try {
                        String[] partes = ultima.getCodigoSeguimiento().split("-");
                        long ultimoNumero = Long.parseLong(partes[2]);
                        codigoGenerator.inicializarContador(ultimoNumero);
                        log.info("Generador de códigos inicializado en: {}", ultimoNumero);
                    } catch (NumberFormatException | ArrayIndexOutOfBoundsException e) {
                        log.warn("No se pudo parsear el último código de seguimiento, iniciando desde 0");
                    }
                });
    }

    // ═══════════════════════════════════════════════════════════════
    //  CREAR SOLICITUD
    // ═══════════════════════════════════════════════════════════════

    @Override
    public SolicitudResponse crearSolicitud(CrearSolicitudRequest request, String usuarioCreador, RolUsuario rolUsuario) {
        return crearSolicitudConArchivos(request, null, usuarioCreador, rolUsuario);
    }

    @Override
    public SolicitudResponse crearSolicitudConArchivos(CrearSolicitudRequest request, org.springframework.web.multipart.MultipartFile[] archivos, String usuarioCreador, RolUsuario rolUsuario) {
        // Validar que solo SOLICITANTE o ADMINISTRADOR pueden crear
        if (!rolUsuario.puedeCrearSolicitud()) {
            throw new UnauthorizedActionException(
                    rolUsuario.name(),
                    "crear solicitudes de workflow"
            );
        }

        String departamentoNormalizado = normalizarDepartamento(request.getDepartamentoDestino());
        request.setDepartamentoDestino(departamentoNormalizado);

        String codigo = codigoGenerator.generarCodigo();
        SolicitudWorkflow solicitud = mapper.toEntity(request, codigo, usuarioCreador);
        if (request.getWorkflowDefinitionId() != null && !request.getWorkflowDefinitionId().isBlank()) {
            String key = request.getWorkflowDefinitionId().trim();
            if (workflowDefinitionRepository.findFirstByKeyOrderByVersionDesc(key).isEmpty()) {
                throw new ResourceNotFoundException("Política", "key", key);
            }
            solicitud.setWorkflowDefinitionId(key);
        }

        Prioridad prioridadSla = solicitud.getPrioridad() != null ? solicitud.getPrioridad() : Prioridad.MEDIA;
        solicitud.setPrioridad(prioridadSla);
        solicitud.setFechaLimiteAtencion(calcularFechaLimite(prioridadSla, LocalDateTime.now()));

        // Almacenar archivos adjuntos si hay
        if (archivos != null && archivos.length > 0) {
            var adjuntos = archivoStorageService.almacenarArchivos(archivos, usuarioCreador);
            solicitud.setArchivosAdjuntos(adjuntos);
        }

        // Registrar evento de creación en el historial
        solicitud.registrarTransicion(
                null,
                EstadoWorkflow.PENDIENTE,
                usuarioCreador,
                rolUsuario.name(),
                "Solicitud creada" + (archivos != null && archivos.length > 0 ? " con " + archivos.length + " archivo(s)" : "")
        );

        SolicitudWorkflow guardada = repository.save(solicitud);
        log.info("Solicitud creada: {} por usuario: {} con {} archivos", codigo, usuarioCreador,
                archivos != null ? archivos.length : 0);

        enviarNotificacionCreacion(guardada);

        return mapper.toResponse(guardada);
    }

    // ═══════════════════════════════════════════════════════════════
    //  CONSULTAS
    // ═══════════════════════════════════════════════════════════════

    @Override
    public SolicitudResponse obtenerPorId(String id) {
        SolicitudWorkflow solicitud = buscarSolicitudPorId(id);
        return mapper.toResponse(solicitud);
    }

    @Override
    public SolicitudResponse obtenerPorCodigoSeguimiento(String codigoSeguimiento) {
        SolicitudWorkflow solicitud = repository.findByCodigoSeguimiento(codigoSeguimiento)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Solicitud", "codigoSeguimiento", codigoSeguimiento
                ));
        return mapper.toResponse(solicitud);
    }

    @Override
    public List<SolicitudResponse> listarPorDepartamento(String departamento) {
        List<SolicitudWorkflow> solicitudes =
                repository.findByDepartamentoActualIgnoreCaseOrderByFechaCreacionDesc(departamento);
        return mapper.toResponseList(solicitudes);
    }

    @Override
    public List<SolicitudResponse> listarPorDepartamentoYEstado(String departamento, EstadoWorkflow estado) {
        List<SolicitudWorkflow> solicitudes =
                repository.findByDepartamentoActualIgnoreCaseAndEstado(departamento, estado);
        return mapper.toResponseList(solicitudes);
    }

    @Override
    public List<SolicitudResponse> listarPorUsuarioCreador(String usuario) {
        List<SolicitudWorkflow> solicitudes =
                repository.findByUsuarioCreadorOrderByFechaCreacionDesc(usuario);
        return mapper.toResponseList(solicitudes);
    }

    @Override
    public List<SolicitudResponse> listarTodas() {
        List<SolicitudWorkflow> solicitudes =
                repository.findAll(Sort.by(Sort.Direction.DESC, "fechaCreacion"));
        return mapper.toResponseList(solicitudes);
    }

    @Override
    public List<SolicitudResponse> buscarPorTitulo(String titulo) {
        List<SolicitudWorkflow> solicitudes = repository.buscarPorTitulo(titulo);
        return mapper.toResponseList(solicitudes);
    }

    // ═══════════════════════════════════════════════════════════════
    //  CAMBIO DE ESTADO (Lógica principal del workflow)
    // ═══════════════════════════════════════════════════════════════

    @Override
    public SolicitudResponse cambiarEstado(String id, CambiarEstadoRequest request, String usuarioResponsable, RolUsuario rolUsuario, String departamentoUsuario) {
        SolicitudWorkflow solicitud = buscarSolicitudPorId(id);
        RolUsuario rol = rolUsuario;
        EstadoWorkflow estadoActual = solicitud.getEstado();
        EstadoWorkflow nuevoEstado = request.getNuevoEstado();

        // ADMINISTRADOR puede forzar cualquier transición
        if (rol.puedeForzarCambioEstado()) {
            log.info("ADMIN forzando transición: {} -> {} en solicitud {}",
                    estadoActual, nuevoEstado, id);
        } else if (rol == RolUsuario.REVISOR) {
            // Validar que el REVISOR pertenece al departamento de la solicitud
            validarDepartamentoRevisor(solicitud, departamentoUsuario);

            // Validar la transición de estado según la máquina de estados
            boolean actualizacionFormularioSinTransicion =
                    estadoActual == nuevoEstado && request.getDatosFormulario() != null;
            if (!actualizacionFormularioSinTransicion && !estadoActual.puedeTransicionarA(nuevoEstado)) {
                throw new InvalidStateTransitionException(estadoActual.name(), nuevoEstado.name());
            }
        } else {
            // SOLICITANTE no puede cambiar estado
            throw new UnauthorizedActionException(rol.name(), "cambiar el estado de solicitudes");
        }

        // Auto-asignación inteligente
        if (estadoActual == EstadoWorkflow.PENDIENTE && nuevoEstado == EstadoWorkflow.EN_REVISION && rol == RolUsuario.REVISOR) {
            solicitud.setUsuarioAsignado(usuarioResponsable);
            log.info("Ticket {} auto-asignado al revisor {} al iniciar la revisión.", id, usuarioResponsable);
        }

        // Actualizar datos del formulario dinámico (merge)
        if (request.getDatosFormulario() != null) {
            if (solicitud.getDatosFormulario() == null) {
                solicitud.setDatosFormulario(new java.util.HashMap<>());
            }
            solicitud.getDatosFormulario().putAll(request.getDatosFormulario());
        }

        // Registrar la transición atómicamente
        solicitud.registrarTransicion(
                estadoActual,
                nuevoEstado,
                usuarioResponsable,
                rol.name(),
                request.getComentario()
        );

        SolicitudWorkflow solicitudActualizada = repository.save(solicitud);
        log.info("Estado cambiado: {} -> {} en solicitud {} por {}",
                estadoActual, nuevoEstado, id, usuarioResponsable);

        // Notificar al creador de la solicitud sobre el cambio de estado
        enviarNotificacionCambioEstado(solicitudActualizada);

        return mapper.toResponse(solicitudActualizada);
    }

    private void enviarNotificacionCambioEstado(SolicitudWorkflow solicitud) {
        String titulo = "Actualización de Solicitud: " + solicitud.getCodigoSeguimiento();
        String mensaje = construirMensajeEstado(solicitud);

        Set<String> usuariosANotificar = new HashSet<>();
        if (solicitud.getUsuarioCreador() != null) {
            usuariosANotificar.add(solicitud.getUsuarioCreador());
        }
        if (solicitud.getUsuarioAsignado() != null && !solicitud.getUsuarioAsignado().isEmpty()) {
            usuariosANotificar.add(solicitud.getUsuarioAsignado());
        }
        agregarAdministradores(usuariosANotificar);

        Set<String> tokens = new HashSet<>(obtenerTokensParaUsuarios(usuariosANotificar));
        tokens.addAll(obtenerTokensParaCodigoSeguimiento(solicitud.getCodigoSeguimiento()));

        fcmService.sendMulticastPushNotification(tokens.stream().toList(), titulo, mensaje, Map.of(
            "solicitudId", solicitud.getId(),
            "codigo", solicitud.getCodigoSeguimiento(),
            "evento", "CAMBIO_ESTADO",
            "estado", solicitud.getEstado().name(),
            "departamentoActual", valorSeguro(solicitud.getDepartamentoActual()),
            "tareaActualNombre", valorSeguro(solicitud.getTareaActualNombre())
        ));
    }

    private void enviarNotificacionCreacion(SolicitudWorkflow solicitud) {
        String titulo = "Nueva Solicitud: " + solicitud.getCodigoSeguimiento();
        String mensaje = String.format("Se creó la solicitud '%s' en %s",
                solicitud.getTitulo(),
                solicitud.getDepartamentoActual() != null ? solicitud.getDepartamentoActual() : "el departamento asignado");

        Set<String> usuariosANotificar = new HashSet<>();
        if (solicitud.getUsuarioCreador() != null) {
            usuariosANotificar.add(solicitud.getUsuarioCreador());
        }
        agregarAdministradores(usuariosANotificar);
        agregarRevisoresDepartamento(usuariosANotificar, solicitud.getDepartamentoActual());

        Set<String> tokens = new HashSet<>(obtenerTokensParaUsuarios(usuariosANotificar));
        tokens.addAll(obtenerTokensParaCodigoSeguimiento(solicitud.getCodigoSeguimiento()));

        fcmService.sendMulticastPushNotification(tokens.stream().toList(), titulo, mensaje, Map.of(
            "solicitudId", solicitud.getId(),
            "codigo", solicitud.getCodigoSeguimiento(),
            "evento", "CREACION"
        ));
    }

    private void agregarAdministradores(Set<String> usuarios) {
        usuarioRepository.findByRol(RolUsuario.ADMINISTRADOR).stream()
                .map(u -> u.getUsername())
                .filter(u -> u != null && !u.isBlank())
                .forEach(usuarios::add);
    }

    private void agregarRevisoresDepartamento(Set<String> usuarios, String departamento) {
        if (departamento == null || departamento.isBlank()) {
            return;
        }

        usuarioRepository.findByRolAndDepartamentoIgnoreCase(RolUsuario.REVISOR, departamento).stream()
                .map(u -> u.getUsername())
                .filter(u -> u != null && !u.isBlank())
                .forEach(usuarios::add);
    }

    private List<String> obtenerTokensParaUsuarios(Set<String> usuarios) {
        if (usuarios.isEmpty()) {
            return List.of();
        }

        Set<String> tokens = new HashSet<>();
        for (String usuarioId : usuarios) {
            tokenRepository.findByUsuarioId(usuarioId).stream()
                    .map(device -> device.getToken())
                    .filter(token -> token != null && !token.isBlank())
                    .forEach(tokens::add);
        }

        return tokens.stream().toList();
    }

    private List<String> obtenerTokensParaCodigoSeguimiento(String codigoSeguimiento) {
        if (codigoSeguimiento == null || codigoSeguimiento.isBlank()) {
            return List.of();
        }

        return tokenRepository.findByCodigoSeguimiento(codigoSeguimiento).stream()
                .map(device -> device.getToken())
                .filter(token -> token != null && !token.isBlank())
                .distinct()
                .toList();
    }

    // REASIGNAR DEPARTAMENTO (Solo ADMINISTRADOR)


    @Override
    public SolicitudResponse reasignarDepartamento(
            String id,
            ReasignarDepartamentoRequest request,
            String usuarioResponsable,
            RolUsuario rolUsuario,
            String departamentoUsuario
    ) {
        SolicitudWorkflow solicitud = buscarSolicitudPorId(id);

        if (rolUsuario.puedeAdministrar()) {
            log.info("ADMIN reasignando departamento en solicitud {}", id);
        } else if (rolUsuario == RolUsuario.REVISOR) {
            validarDepartamentoRevisor(solicitud, departamentoUsuario);
            log.info("REVISOR '{}' reasignando solicitud {}", usuarioResponsable, id);
        } else {
            throw new UnauthorizedActionException(
                    rolUsuario.name(),
                    "reasignar departamentos"
            );
        }

        String departamentoAnterior = solicitud.getDepartamentoActual();
        String departamentoNormalizado = normalizarDepartamento(request.getNuevoDepartamento());

        if (departamentoAnterior != null && departamentoAnterior.equalsIgnoreCase(departamentoNormalizado)) {
            throw new IllegalArgumentException("La solicitud ya está en el departamento indicado");
        }

        solicitud.setDepartamentoActual(departamentoNormalizado);

        // Registrar la reasignación en el historial
        solicitud.registrarTransicion(
                solicitud.getEstado(),
                solicitud.getEstado(), // El estado no cambia, solo el departamento
                usuarioResponsable,
                rolUsuario.name(),
                String.format("Reasignado de '%s' a '%s'. %s",
                        departamentoAnterior,
                        departamentoNormalizado,
                        request.getComentario() != null ? request.getComentario() : "")
        );

        SolicitudWorkflow solicitudActualizada = repository.save(solicitud);
        log.info("Solicitud {} reasignada de '{}' a '{}' por {}",
            id, departamentoAnterior, departamentoNormalizado,
                usuarioResponsable);

        enviarNotificacionCambioRuta(
                solicitudActualizada,
                "Su trámite fue derivado a " + departamentoNormalizado,
                "CAMBIO_DEPARTAMENTO"
        );

        return mapper.toResponse(solicitudActualizada);
    }

    @Override
    public List<String> obtenerCatalogoDepartamentos() {
        List<String> fromDb = departamentoRepository.findAllByActivoTrueOrderByNombreAsc()
                .stream()
                .map(com.workflow.domain.model.Departamento::getNombre)
                .collect(Collectors.toList());
        // Fallback in case the collection is empty
        return fromDb.isEmpty() ? List.of("Sistemas", "Ventas", "Recursos Humanos") : fromDb;
    }

    @Override
    public Map<String, Object> obtenerRecomendacionReasignacion(String id) {
        SolicitudWorkflow solicitud = buscarSolicitudPorId(id);
        String departamentoActual = solicitud.getDepartamentoActual();

        List<String> departamentosValidos = obtenerCatalogoDepartamentos();

        Map<String, Long> colaPendiente = new LinkedHashMap<>();
        for (String departamento : departamentosValidos) {
            long cantidad = repository.countByDepartamentoActualIgnoreCaseAndEstado(
                    departamento,
                    EstadoWorkflow.PENDIENTE
            );
            colaPendiente.put(departamento, cantidad);
        }

        String departamentoSugerido = departamentosValidos.stream()
                .filter(dep -> departamentoActual == null || !dep.equalsIgnoreCase(departamentoActual))
                .min(Comparator.comparingLong(dep -> colaPendiente.getOrDefault(dep, 0L)))
                .orElse(null);

        Map<String, Object> recomendacion = new LinkedHashMap<>();
        recomendacion.put("departamentoActual", departamentoActual);
        recomendacion.put("departamentoSugerido", departamentoSugerido);
        recomendacion.put("colaPendiente", colaPendiente);
        recomendacion.put("departamentosDisponibles", departamentosValidos);

        return recomendacion;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ASIGNAR USUARIO
    // ═══════════════════════════════════════════════════════════════

    @Override
    public SolicitudResponse asignarUsuario(String id, String usuarioAsignado,
                                             String usuarioResponsable, RolUsuario rol) {
        if (!rol.puedeRevisar()) {
            throw new UnauthorizedActionException(rol.name(), "asignar usuarios a solicitudes");
        }

        if (!usuarioRepository.existsByUsername(usuarioAsignado)) {
            throw new ResourceNotFoundException("Usuario", "username", usuarioAsignado);
        }

        SolicitudWorkflow solicitud = buscarSolicitudPorId(id);
        String usuarioAnterior = solicitud.getUsuarioAsignado();
        solicitud.setUsuarioAsignado(usuarioAsignado);

        String comentario = String.format(
                "Asignación de responsable: '%s' -> '%s'",
                usuarioAnterior != null ? usuarioAnterior : "sin asignar",
                usuarioAsignado
        );

        solicitud.registrarTransicion(
                solicitud.getEstado(),
                solicitud.getEstado(),
                usuarioResponsable,
                rol.name(),
                comentario
        );

        SolicitudWorkflow solicitudActualizada = repository.save(solicitud);
        log.info("Usuario '{}' asignado a solicitud {} por {}", usuarioAsignado, id, usuarioResponsable);

        return mapper.toResponse(solicitudActualizada);
    }

    // ═══════════════════════════════════════════════════════════════
    //  ESTADÍSTICAS / KPIs
    // ═══════════════════════════════════════════════════════════════

    @Override
    public Map<String, Object> obtenerEstadisticas() {
        List<SolicitudWorkflow> solicitudes = repository.findAll();
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalSolicitudes", solicitudes.size());

        Map<EstadoWorkflow, Long> conteoEstado = new EnumMap<>(EstadoWorkflow.class);
        for (EstadoWorkflow estado : EstadoWorkflow.values()) {
            conteoEstado.put(estado, 0L);
        }

        Map<EstadoSla, Long> conteoSla = new EnumMap<>(EstadoSla.class);
        for (EstadoSla estadoSla : EstadoSla.values()) {
            conteoSla.put(estadoSla, 0L);
        }

        long totalAlertasSla = 0L;
        long totalEscaladasSla = 0L;
        LocalDateTime ahora = LocalDateTime.now();

        for (SolicitudWorkflow solicitud : solicitudes) {
            EstadoWorkflow estado = solicitud.getEstado();
            if (estado != null) {
                conteoEstado.put(estado, conteoEstado.getOrDefault(estado, 0L) + 1);
            }

            EstadoSla estadoSla = calcularEstadoSla(solicitud, ahora);
            conteoSla.put(estadoSla, conteoSla.getOrDefault(estadoSla, 0L) + 1);

            if (solicitud.getFechaPrimeraAlertaSla() != null) {
                totalAlertasSla++;
            }
            if (solicitud.getFechaEscalamientoSla() != null) {
                totalEscaladasSla++;
            }
        }

        Map<String, Long> porEstado = new LinkedHashMap<>();
        for (EstadoWorkflow estado : EstadoWorkflow.values()) {
            porEstado.put(estado.name(), conteoEstado.getOrDefault(estado, 0L));
        }
        stats.put("porEstado", porEstado);

        Map<String, Long> porSla = new LinkedHashMap<>();
        for (EstadoSla estadoSla : EstadoSla.values()) {
            porSla.put(estadoSla.name(), conteoSla.getOrDefault(estadoSla, 0L));
        }
        stats.put("porSla", porSla);

        stats.put("totalAlertasSla", totalAlertasSla);
        stats.put("totalEscaladasSla", totalEscaladasSla);

        return stats;
    }

    @Override
    public Map<String, List<SolicitudResponse>> obtenerDiagramaCalles() {
        List<SolicitudWorkflow> todas = repository.findAll();
        Map<String, List<SolicitudResponse>> calles = new LinkedHashMap<>();

        // Initialize empty lanes using the catalogue
        for (String depto : obtenerCatalogoDepartamentos()) {
            calles.put(depto, new java.util.ArrayList<>());
        }

        // Distribute mapped nodes into their lanes
        for (SolicitudWorkflow sol : todas) {
            String depto = sol.getDepartamentoActual() != null ? sol.getDepartamentoActual() : "Sistemas";
            calles.computeIfAbsent(depto, k -> new java.util.ArrayList<>())
                  .add(mapper.toResponse(sol));
        }

        return calles;
    }

    // ═══════════════════════════════════════════════════════════════
    //  MÉTODOS PRIVADOS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Busca una solicitud por ID o lanza ResourceNotFoundException.
     */
    private SolicitudWorkflow buscarSolicitudPorId(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Solicitud", "id", id));
    }

    /**
     * Valida que el revisor pertenezca al departamento de la solicitud.
     */
    private void validarDepartamentoRevisor(SolicitudWorkflow solicitud, String departamentoUsuario) {
        String departamentoSolicitud = solicitud.getDepartamentoActual();
        if (departamentoSolicitud == null
                || departamentoUsuario == null
                || !departamentoSolicitud.equalsIgnoreCase(departamentoUsuario)) {
            throw new UnauthorizedActionException(
                    String.format("El revisor del departamento '%s' no puede gestionar solicitudes del departamento '%s'",
                            departamentoUsuario, departamentoSolicitud)
            );
        }
    }

    /**
     * Normaliza y valida el departamento contra el catálogo fijo de la aplicación.
     */
    private String normalizarDepartamento(String departamento) {
        if (departamento == null || departamento.isBlank()) {
            throw new IllegalArgumentException("El departamento es obligatorio");
        }

        String valor = departamento.trim();
        List<String> validos = obtenerCatalogoDepartamentos();

        return validos.stream()
                .filter(dep -> dep.equalsIgnoreCase(valor))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        String.format(
                                "Departamento '%s' no válido. Valores permitidos: %s",
                                departamento,
                                String.join(", ", validos)
                        )
                ));
    }

    private LocalDateTime calcularFechaLimite(Prioridad prioridad, LocalDateTime base) {
        Prioridad prioridadEfectiva = prioridad != null ? prioridad : Prioridad.MEDIA;
        Long horasSla = SLA_HORAS_POR_PRIORIDAD.getOrDefault(prioridadEfectiva, 24L);
        return base.plusHours(horasSla);
    }

    private EstadoSla calcularEstadoSla(SolicitudWorkflow solicitud, LocalDateTime referencia) {
        EstadoWorkflow estado = solicitud.getEstado();
        if (estado == EstadoWorkflow.APROBADO || estado == EstadoWorkflow.RECHAZADO) {
            return EstadoSla.CERRADO;
        }

        LocalDateTime fechaLimite = solicitud.getFechaLimiteAtencion();
        if (fechaLimite == null) {
            return EstadoSla.EN_TIEMPO;
        }

        long minutosRestantes = Duration.between(referencia, fechaLimite).toMinutes();
        if (minutosRestantes <= 0) {
            return EstadoSla.VENCIDO;
        }

        if (minutosRestantes <= 240) {
            return EstadoSla.POR_VENCER;
        }

        return EstadoSla.EN_TIEMPO;
    }

    @Override
    public SolicitudResponse asociarProcesoBpm(String id, String workflowDefinitionId, String tareaId, String tareaNombre, String usuarioResponsable, String rolUsuario) {
        SolicitudWorkflow solicitud = buscarSolicitudPorId(id);
        
        solicitud.setWorkflowDefinitionId(workflowDefinitionId);
        solicitud.setTareaActualId(tareaId);
        solicitud.setTareaActualNombre(tareaNombre);
        
        EstadoWorkflow anterior = solicitud.getEstado();
        solicitud.setEstado(EstadoWorkflow.EN_REVISION);
        
        String comentario = String.format("Iniciado proceso BPMN '%s' en etapa '%s'", workflowDefinitionId, tareaNombre);
        solicitud.registrarTransicion(
                anterior,
                EstadoWorkflow.EN_REVISION,
                usuarioResponsable,
                rolUsuario,
                comentario
        );
        
        log.info("Proceso BPMN '{}' asociado a la solicitud '{}' por '{}'", workflowDefinitionId, id, usuarioResponsable);
        SolicitudWorkflow guardada = repository.save(solicitud);
        return mapper.toResponse(guardada);
    }

    @Override
    public SolicitudResponse cambiarTareaBpm(String id, String flowId, String tareaId, String tareaNombre, String usuarioResponsable, String rolUsuario) {
        SolicitudWorkflow solicitud = buscarSolicitudPorId(id);
        
        String prevTareaNombre = solicitud.getTareaActualNombre();
        solicitud.setWorkflowDefinitionId(flowId); // <--- VINCULACIÓN CRUCIAL
        solicitud.setTareaActualId(tareaId);
        solicitud.setTareaActualNombre(tareaNombre);
        
        String comentario = String.format("Mapeo BPMN: Movido de '%s' a '%s' (Workflow: %s)", 
                prevTareaNombre != null ? prevTareaNombre : "sin asignar", tareaNombre, flowId);
                
        solicitud.registrarTransicion(
                solicitud.getEstado(),
                solicitud.getEstado(),
                usuarioResponsable,
                rolUsuario,
                comentario
        );
        
        log.info("Tarea BPMN de la solicitud '{}' cambiada a '{}' [Flow: {}] por '{}'", id, tareaNombre, flowId, usuarioResponsable);
        SolicitudWorkflow guardada = repository.save(solicitud);
        enviarNotificacionCambioRuta(
                guardada,
                "Su trámite avanzó a la etapa '" + tareaNombre + "'",
                "CAMBIO_TAREA"
        );
        return mapper.toResponse(guardada);
    }

    private void enviarNotificacionCambioRuta(SolicitudWorkflow solicitud, String mensaje, String evento) {
        Set<String> tokens = new HashSet<>(obtenerTokensParaCodigoSeguimiento(solicitud.getCodigoSeguimiento()));
        if (tokens.isEmpty()) {
            return;
        }

        fcmService.sendMulticastPushNotification(
                tokens.stream().toList(),
                "Seguimiento de Solicitud: " + solicitud.getCodigoSeguimiento(),
                mensaje,
                Map.of(
                        "solicitudId", solicitud.getId(),
                        "codigo", solicitud.getCodigoSeguimiento(),
                        "evento", evento,
                        "estado", solicitud.getEstado().name(),
                        "departamentoActual", valorSeguro(solicitud.getDepartamentoActual()),
                        "tareaActualNombre", valorSeguro(solicitud.getTareaActualNombre())
                )
        );
    }

    private String construirMensajeEstado(SolicitudWorkflow solicitud) {
        if (solicitud.getEstado() == EstadoWorkflow.RECHAZADO) {
            return String.format(
                    "Atención: tu solicitud '%s' fue observada o rechazada. Revisa el detalle.",
                    solicitud.getTitulo()
            );
        }

        if (solicitud.getEstado() == EstadoWorkflow.APROBADO) {
            return String.format("Tu solicitud '%s' fue aprobada.", solicitud.getTitulo());
        }

        return String.format(
                "Tu solicitud '%s' ha pasado a estado: %s",
                solicitud.getTitulo(),
                solicitud.getEstado().name()
        );
    }

    private String valorSeguro(String valor) {
        return valor != null ? valor : "";
    }
}

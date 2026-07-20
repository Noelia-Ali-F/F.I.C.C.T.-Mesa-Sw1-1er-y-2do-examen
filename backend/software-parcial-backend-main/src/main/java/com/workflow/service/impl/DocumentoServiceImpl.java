package com.workflow.service.impl;

import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.model.ArchivoAdjunto;
import com.workflow.domain.model.Documento;
import com.workflow.domain.model.SolicitudWorkflow;
import com.workflow.exception.ResourceNotFoundException;
import com.workflow.exception.UnauthorizedActionException;
import com.workflow.repository.DocumentoRepository;
import com.workflow.repository.SolicitudWorkflowRepository;
import com.workflow.repository.WorkflowDefinitionRepository;
import com.workflow.service.ArchivoStorageService;
import com.workflow.service.DocumentoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentoServiceImpl implements DocumentoService {

    private final DocumentoRepository repository;
    private final SolicitudWorkflowRepository solicitudRepository;
    private final ArchivoStorageService storageService;
    private final WorkflowDefinitionRepository workflowDefinitionRepository;

    @Override
    public List<Documento> listarPorSolicitud(String solicitudId) {
        return repository.findBySolicitudIdOrderByFechaCreacionDesc(solicitudId);
    }

    @Override
    public List<Documento> listarPorTarea(String tareaId) {
        return repository.findByTareaIdOrderByFechaCreacionDesc(tareaId);
    }

    @Override
    public List<Documento> listarPorPolitica(String policyKey) {
        return repository.findByPolicyKeyOrderByFechaCreacionDesc(policyKey);
    }

    @Override
    public Documento obtenerPorId(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Documento", "id", id));
    }

    @Override
    public Documento crearDocumentoArchivo(String solicitudId, String nombre, String descripcion, MultipartFile archivo, String usuario) {
        validarSolicitudExiste(solicitudId);
        SolicitudWorkflow contexto = solicitudRepository.findById(solicitudId).orElse(null);

        // Almacenar el archivo físico
        ArchivoAdjunto adjunto = storageService.almacenarArchivo(archivo, usuario);

        // Crear la primera versión del documento
        Documento.VersionDocumento v1 = Documento.VersionDocumento.builder()
                .version(1)
                .nombreAlmacenado(adjunto.getNombreAlmacenado())
                .nombreOriginal(adjunto.getNombreOriginal())
                .tipoContenido(adjunto.getTipoContenido())
                .tamanoBytes(adjunto.getTamanoBytes())
                .subidoPor(usuario)
                .fechaSubida(LocalDateTime.now())
                .comentarioCambio("Carga inicial del archivo")
                .build();

        List<Documento.VersionDocumento> versiones = new ArrayList<>();
        versiones.add(v1);

        Documento documento = Documento.builder()
                .solicitudId(solicitudId)
                .policyKey(contexto == null ? null : contexto.getWorkflowDefinitionId())
                .tareaId(contexto == null ? null : contexto.getTareaActualId())
                .taskInstanceId(contexto == null ? null : contexto.getTareaActualId())
                .formato("FILE")
                .estado("BORRADOR")
                .departamentoPropietario(contexto == null ? null : contexto.getDepartamentoActual())
                .nombre(nombre)
                .descripcion(descripcion)
                .tipo("FILE")
                .versionActual(1)
                .creadoPor(usuario)
                .fechaCreacion(LocalDateTime.now())
                .fechaActualizacion(LocalDateTime.now())
                .versiones(versiones)
                .build();

        Documento guardado = repository.save(documento);
        log.info("Documento de archivo '{}' creado con versión 1 para la solicitud {}", nombre, solicitudId);

        registrarEventoEnSolicitud(solicitudId, usuario, 
                String.format("Documento de archivo creado: '%s' (Versión 1)", nombre));

        return guardado;
    }

    @Override
    public Documento crearDocumentoColaborativo(String solicitudId, String nombre, String descripcion, String contenidoInicial, String usuario) {
        return crearDocumentoColaborativoContexto(solicitudId, null, null, null, null,
                "TEXT", nombre, descripcion, contenidoInicial, usuario, null);
    }

    @Override
    public Documento crearDocumentoColaborativoContexto(String solicitudId, String policyKey, String tareaId,
                                                          String taskInstanceId, String categoria, String formato,
                                                          String nombre, String descripcion, String contenidoInicial,
                                                          String usuario, String departamento) {
        validarSolicitudExiste(solicitudId);
        SolicitudWorkflow contexto = solicitudRepository.findById(solicitudId).orElse(null);
        if (contexto != null) {
            if (policyKey == null || policyKey.isBlank()) policyKey = contexto.getWorkflowDefinitionId();
            if (tareaId == null || tareaId.isBlank()) tareaId = contexto.getTareaActualId();
            if (taskInstanceId == null || taskInstanceId.isBlank()) taskInstanceId = contexto.getTareaActualId();
            if (departamento == null || departamento.isBlank()) departamento = contexto.getDepartamentoActual();
        }

        String formatoNormalizado = formato == null ? "TEXT" : formato.trim().toUpperCase();
        if (!formatoNormalizado.equals("TEXT") && !formatoNormalizado.equals("SPREADSHEET")) {
            throw new IllegalArgumentException("Formato colaborativo inválido. Use TEXT o SPREADSHEET");
        }

        Documento.VersionDocumento v1 = Documento.VersionDocumento.builder()
                .version(1)
                .nombreOriginal(nombre + (formatoNormalizado.equals("SPREADSHEET") ? ".xlsx" : ".html"))
                .tipoContenido(formatoNormalizado.equals("SPREADSHEET")
                        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/html")
                .subidoPor(usuario)
                .fechaSubida(LocalDateTime.now())
                .comentarioCambio("Inicialización del documento colaborativo online")
                .contenidoColaborativoSnapshot(contenidoInicial)
                .build();

        List<Documento.VersionDocumento> versiones = new ArrayList<>();
        versiones.add(v1);

        Documento documento = Documento.builder()
                .solicitudId(solicitudId)
                .policyKey(policyKey)
                .tareaId(tareaId)
                .taskInstanceId(taskInstanceId)
                .categoria(categoria)
                .formato(formatoNormalizado)
                .estado("BORRADOR")
                .departamentoPropietario(departamento)
                .nombre(nombre)
                .descripcion(descripcion)
                .tipo("COLLABORATIVE")
                .versionActual(1)
                .creadoPor(usuario)
                .fechaCreacion(LocalDateTime.now())
                .fechaActualizacion(LocalDateTime.now())
                .contenidoColaborativo(contenidoInicial)
                .versiones(versiones)
                .build();

        Documento guardado = repository.save(documento);
        log.info("Documento colaborativo '{}' creado para la solicitud {}", nombre, solicitudId);

        registrarEventoEnSolicitud(solicitudId, usuario, 
                String.format("Documento colaborativo en línea creado: '%s'", nombre));

        return guardado;
    }

    @Override
    public boolean puedeAcceder(Documento documento, String usuario, String rol, String departamento, boolean escritura) {
        if (documento == null || usuario == null || usuario.isBlank() || rol == null || rol.isBlank()) return false;
        if ("ADMINISTRADOR".equalsIgnoreCase(rol)) return true;
        boolean propietario = documento.getCreadoPor() != null && documento.getCreadoPor().equalsIgnoreCase(usuario);
        boolean colaborador = documento.getColaboradores() != null
                && documento.getColaboradores().stream().anyMatch(c -> c.equalsIgnoreCase(usuario));
        if (propietario || colaborador) return true;
        if (escritura) return false;
        if (departamento != null && documento.getDepartamentoPropietario() != null
                && documento.getDepartamentoPropietario().equalsIgnoreCase(departamento)) return true;
        return documento.getSolicitudId() != null && solicitudRepository.findById(documento.getSolicitudId())
                .map(s -> usuario.equalsIgnoreCase(s.getUsuarioCreador()))
                .orElse(false);
    }

    @Override
    public Documento subirNuevaVersionArchivo(String id, MultipartFile archivo, String comentario, String usuario) {
        Documento documento = obtenerPorId(id);

        if (documento.getBloqueadoPor() != null && !documento.getBloqueadoPor().equalsIgnoreCase(usuario)) {
            throw new UnauthorizedActionException(usuario, "modificar el documento porque está bloqueado por " + documento.getBloqueadoPor());
        }

        // Guardar archivo físico
        ArchivoAdjunto adjunto = storageService.almacenarArchivo(archivo, usuario);

        int proximaVersion = documento.getVersionActual() + 1;

        Documento.VersionDocumento version = Documento.VersionDocumento.builder()
                .version(proximaVersion)
                .nombreAlmacenado(adjunto.getNombreAlmacenado())
                .nombreOriginal(adjunto.getNombreOriginal())
                .tipoContenido(adjunto.getTipoContenido())
                .tamanoBytes(adjunto.getTamanoBytes())
                .subidoPor(usuario)
                .fechaSubida(LocalDateTime.now())
                .comentarioCambio(comentario != null && !comentario.isBlank() ? comentario : "Actualización de versión a v" + proximaVersion)
                .build();

        documento.agregarVersion(version);
        documento.setVersionActual(proximaVersion);
        documento.setFechaActualizacion(LocalDateTime.now());
        // Desbloquear automáticamente al subir nueva versión si estaba bloqueado por el mismo usuario
        if (usuario.equalsIgnoreCase(documento.getBloqueadoPor())) {
            documento.setBloqueadoPor(null);
            documento.setBloqueadoAt(null);
        }

        Documento guardado = repository.save(documento);
        log.info("Documento '{}' actualizado a la versión {} por {}", documento.getNombre(), proximaVersion, usuario);

        registrarEventoEnSolicitud(documento.getSolicitudId(), usuario, 
                String.format("Nueva versión del archivo '%s' subida: v%d. Motivo: %s", 
                        documento.getNombre(), proximaVersion, comentario));

        return guardado;
    }

    @Override
    public Documento guardarSnapshotVersionColaborativo(String id, String comentario, String usuario) {
        Documento documento = obtenerPorId(id);
        if (!"COLLABORATIVE".equalsIgnoreCase(documento.getTipo())) {
            throw new IllegalArgumentException("Sólo se pueden guardar snapshots de versiones para documentos colaborativos.");
        }

        int proximaVersion = documento.getVersionActual() + 1;

        Documento.VersionDocumento version = Documento.VersionDocumento.builder()
                .version(proximaVersion)
                .nombreOriginal(documento.getNombre() + "_v" + proximaVersion + ".txt")
                .tipoContenido("text/plain")
                .subidoPor(usuario)
                .fechaSubida(LocalDateTime.now())
                .comentarioCambio(comentario != null && !comentario.isBlank() ? comentario : "Snapshot manual de versión a v" + proximaVersion)
                .contenidoColaborativoSnapshot(documento.getContenidoColaborativo())
                .build();

        documento.agregarVersion(version);
        documento.setVersionActual(proximaVersion);
        documento.setFechaActualizacion(LocalDateTime.now());

        Documento guardado = repository.save(documento);
        log.info("Snapshot guardado para documento colaborativo '{}' a la versión v{} por {}", documento.getNombre(), proximaVersion, usuario);

        registrarEventoEnSolicitud(documento.getSolicitudId(), usuario, 
                String.format("Guardada nueva versión v%d en línea del documento colaborativo '%s'", proximaVersion, documento.getNombre()));

        return guardado;
    }

    @Override
    public Documento actualizarContenidoColaborativo(String id, String nuevoContenido, String usuario) {
        Documento documento = obtenerPorId(id);
        if (!"COLLABORATIVE".equalsIgnoreCase(documento.getTipo())) {
            throw new IllegalArgumentException("No se puede actualizar contenido en línea de un documento de tipo FILE.");
        }

        boolean esCreador = documento.getCreadoPor() == null || documento.getCreadoPor().equalsIgnoreCase(usuario);
        boolean esColaborador = documento.getColaboradores() != null && 
                                 documento.getColaboradores().stream().anyMatch(c -> c.equalsIgnoreCase(usuario));

        if (!esCreador && !esColaborador) {
            throw new UnauthorizedActionException(usuario, "editar este documento porque no es el propietario ni un colaborador autorizado.");
        }

        if (documento.getBloqueadoPor() != null && !documento.getBloqueadoPor().equalsIgnoreCase(usuario)) {
            throw new UnauthorizedActionException(usuario, "editar el documento en línea porque está bloqueado por " + documento.getBloqueadoPor());
        }

        documento.setContenidoColaborativo(nuevoContenido);
        documento.setFechaActualizacion(LocalDateTime.now());

        return repository.save(documento);
    }

    @Override
    public Documento bloquearDocumento(String id, String usuario) {
        Documento documento = obtenerPorId(id);

        boolean esCreador = documento.getCreadoPor() == null || documento.getCreadoPor().equalsIgnoreCase(usuario);
        boolean esColaborador = documento.getColaboradores() != null && 
                                 documento.getColaboradores().stream().anyMatch(c -> c.equalsIgnoreCase(usuario));

        if (!esCreador && !esColaborador) {
            throw new UnauthorizedActionException(usuario, "bloquear este documento para edición porque no tiene permisos de colaboración (propietario o colaborador).");
        }

        if (documento.getBloqueadoPor() != null) {
            if (documento.getBloqueadoPor().equalsIgnoreCase(usuario)) {
                return documento; // Ya lo tiene bloqueado él mismo
            }
            throw new UnauthorizedActionException(usuario, "bloquear el documento porque ya está bloqueado por " + documento.getBloqueadoPor());
        }

        documento.setBloqueadoPor(usuario);
        documento.setBloqueadoAt(LocalDateTime.now());
        log.info("Documento '{}' bloqueado temporalmente por {}", documento.getNombre(), usuario);

        return repository.save(documento);
    }

    @Override
    public Documento desbloquearDocumento(String id, String usuario) {
        Documento documento = obtenerPorId(id);
        if (documento.getBloqueadoPor() == null) {
            return documento; // No estaba bloqueado
        }

        documento.setBloqueadoPor(null);
        documento.setBloqueadoAt(null);
        log.info("Documento '{}' desbloqueado por {}", documento.getNombre(), usuario);

        return repository.save(documento);
    }

    @Override
    public void eliminarDocumento(String id, String usuario) {
        Documento documento = obtenerPorId(id);
        if (documento.getBloqueadoPor() != null && !documento.getBloqueadoPor().equalsIgnoreCase(usuario)) {
            throw new UnauthorizedActionException(usuario, "eliminar el documento ya que está bloqueado por " + documento.getBloqueadoPor());
        }

        repository.delete(documento);
        log.info("Documento '{}' eliminado por {}", documento.getNombre(), usuario);

        registrarEventoEnSolicitud(documento.getSolicitudId(), usuario, 
                String.format("Documento '%s' ha sido eliminado del sistema", documento.getNombre()));
    }

    @Override
    public Documento asociarASolicitudYTarea(String id, String solicitudId, String tareaId, String usuario) {
        Documento documento = obtenerPorId(id);
        
        // Validar que la solicitud/etapa exista si se manda solicitudId
        if (solicitudId != null) {
            validarSolicitudExiste(solicitudId);
        }

        String antiguaSolicitudId = documento.getSolicitudId();
        
        if (solicitudId != null) {
            documento.setSolicitudId(solicitudId);
            if (tareaId == null || tareaId.trim().isEmpty()) {
                documento.setTareaId(null);
            }
        }
        if (tareaId != null) {
            documento.setTareaId(tareaId);
        }
        
        documento.setFechaActualizacion(LocalDateTime.now());

        Documento guardado = repository.save(documento);
        log.info("Documento '{}' re-asociado de la solicitud {} a la {} con tarea {}", documento.getNombre(), antiguaSolicitudId, solicitudId, tareaId);

        if (solicitudId != null && !solicitudId.trim().isEmpty() && !solicitudId.equals("bpmn-central")) {
            registrarEventoEnSolicitud(solicitudId, usuario, 
                String.format("Documento '%s' ha sido vinculado a esta solicitud/etapa", documento.getNombre()));
        }

        return guardado;
    }

    @Override
    public List<Documento> buscarDocumentos(String nombre) {
        return repository.buscarPorNombre(nombre);
    }

    @Override
    public List<Documento> listarTodos() {
        return repository.findAll();
    }

    @Override
    public Documento gestionarColaboradores(String id, String colaborador, String accion, String usuario) {
        Documento documento = obtenerPorId(id);

        // Solo el propietario original (creadoPor) puede gestionar colaboradores
        if (documento.getCreadoPor() != null && !documento.getCreadoPor().equalsIgnoreCase(usuario)) {
            throw new UnauthorizedActionException(usuario, "gestionar colaboradores en este documento. Solo el propietario (" + documento.getCreadoPor() + ") está autorizado.");
        }

        if (documento.getColaboradores() == null) {
            documento.setColaboradores(new ArrayList<>());
        }

        if ("AGREGAR".equalsIgnoreCase(accion)) {
            // No agregarse a sí mismo como colaborador (ya es propietario), ni duplicar
            if (!colaborador.equalsIgnoreCase(documento.getCreadoPor()) && 
                documento.getColaboradores().stream().noneMatch(c -> c.equalsIgnoreCase(colaborador))) {
                documento.getColaboradores().add(colaborador);
            }
        } else if ("QUITAR".equalsIgnoreCase(accion)) {
            documento.getColaboradores().removeIf(c -> c.equalsIgnoreCase(colaborador));
        }

        Documento guardado = repository.save(documento);
        log.info("Colaboradores actualizados para documento {} por propietario {}. Lista actual: {}", id, usuario, guardado.getColaboradores());

        registrarEventoEnSolicitud(documento.getSolicitudId(), usuario, 
                String.format("Colaboradores modificados en documento '%s' (%s %s)", 
                        documento.getNombre(), accion, colaborador));

        return guardado;
    }

    @Override
    public Documento restaurarVersion(String id, int versionOrigen, String comentario, String usuario) {
        Documento documento = obtenerPorId(id);
        Documento.VersionDocumento origen = documento.getVersiones() == null ? null : documento.getVersiones().stream()
                .filter(v -> v.getVersion() == versionOrigen).findFirst().orElse(null);
        if (origen == null) throw new ResourceNotFoundException("Versión de documento", "version", String.valueOf(versionOrigen));

        int nuevaVersion = documento.getVersionActual() + 1;
        if ("COLLABORATIVE".equalsIgnoreCase(documento.getTipo())) {
            documento.setContenidoColaborativo(origen.getContenidoColaborativoSnapshot());
        }
        Documento.VersionDocumento restaurada = Documento.VersionDocumento.builder()
                .version(nuevaVersion)
                .nombreAlmacenado(origen.getNombreAlmacenado())
                .nombreOriginal(origen.getNombreOriginal())
                .tipoContenido(origen.getTipoContenido())
                .tamanoBytes(origen.getTamanoBytes())
                .subidoPor(usuario)
                .fechaSubida(LocalDateTime.now())
                .comentarioCambio("Restaurada desde v" + versionOrigen + ": "
                        + (comentario == null || comentario.isBlank() ? "sin comentario adicional" : comentario))
                .contenidoColaborativoSnapshot(origen.getContenidoColaborativoSnapshot())
                .build();
        documento.agregarVersion(restaurada);
        documento.setFechaActualizacion(LocalDateTime.now());
        Documento guardado = repository.save(documento);
        registrarEventoEnSolicitud(documento.getSolicitudId(), usuario,
                "Documento '" + documento.getNombre() + "' restaurado desde v" + versionOrigen + " como v" + nuevaVersion);
        return guardado;
    }

    @Override
    public Documento decidirAprobacion(String id, String accion, String observacion, String usuario, String rol, String departamento) {
        Documento documento = obtenerPorId(id);
        String anterior = documento.getEstado() == null || "ACTIVO".equalsIgnoreCase(documento.getEstado())
                ? "BORRADOR" : documento.getEstado();
        String nueva;
        if ("ENVIAR".equalsIgnoreCase(accion)) {
            if (!("BORRADOR".equals(anterior) || "RECHAZADO".equals(anterior))) {
                throw new IllegalArgumentException("Solo un borrador o documento rechazado puede enviarse a aprobación");
            }
            nueva = "PENDIENTE_APROBACION";
        } else if ("APROBAR".equalsIgnoreCase(accion) || "RECHAZAR".equalsIgnoreCase(accion)) {
            if (!("ADMINISTRADOR".equalsIgnoreCase(rol) || "REVISOR".equalsIgnoreCase(rol))) {
                throw new UnauthorizedActionException(usuario, "decidir la aprobación documental");
            }
            if (!"PENDIENTE_APROBACION".equals(anterior)) {
                throw new IllegalArgumentException("El documento no está pendiente de aprobación");
            }
            nueva = "APROBAR".equalsIgnoreCase(accion) ? "APROBADO" : "RECHAZADO";
        } else {
            throw new IllegalArgumentException("Acción inválida. Use ENVIAR, APROBAR o RECHAZAR");
        }
        LocalDateTime ahora = LocalDateTime.now();
        if (documento.getHistorialDecisiones() == null) documento.setHistorialDecisiones(new ArrayList<>());
        documento.getHistorialDecisiones().add(Documento.DecisionDocumento.builder()
                .estadoAnterior(anterior).estadoNuevo(nueva).usuario(usuario).rol(rol)
                .observacion(observacion).fecha(ahora).build());
        documento.setEstado(nueva);
        documento.setAprobadoPor("PENDIENTE_APROBACION".equals(nueva) ? null : usuario);
        documento.setFechaDecision(ahora);
        documento.setObservacionDecision(observacion);
        documento.setFechaActualizacion(ahora);
        return repository.save(documento);
    }

    @Override
    public void validarContextoCreacion(String solicitudId, String policyKey, String tareaId, String taskInstanceId,
                                        String usuario, String rol, String departamento) {
        if (solicitudId != null && (solicitudId.equals("bpmn-central") || solicitudId.startsWith("Activity_")
                || solicitudId.startsWith("Event_") || solicitudId.startsWith("Gateway_") || solicitudId.startsWith("bpmn-"))) {
            if (!("ADMINISTRADOR".equalsIgnoreCase(rol) || "REVISOR".equalsIgnoreCase(rol))) {
                throw new UnauthorizedActionException(usuario, "crear documentos desde el diseñador BPMN");
            }
            if (policyKey != null && !policyKey.isBlank()
                    && workflowDefinitionRepository.findFirstByKeyOrderByVersionDesc(policyKey).isEmpty()
                    && workflowDefinitionRepository.findById(policyKey).isEmpty()) {
                throw new ResourceNotFoundException("Política", "key", policyKey);
            }
            return;
        }
        SolicitudWorkflow solicitud = solicitudRepository.findById(solicitudId)
                .orElseThrow(() -> new ResourceNotFoundException("Solicitud", "id", solicitudId));
        if (policyKey != null && !policyKey.isBlank()
                && !policyKey.equals(solicitud.getWorkflowDefinitionId())) {
            throw new UnauthorizedActionException(usuario, "crear documentos en una política distinta al trámite");
        }
        if (tareaId != null && !tareaId.isBlank()
                && !tareaId.equals(solicitud.getTareaActualId())) {
            throw new UnauthorizedActionException(usuario, "crear documentos fuera de la actividad actual");
        }
        if (taskInstanceId != null && !taskInstanceId.isBlank()
                && !taskInstanceId.equals(solicitud.getTareaActualId())) {
            throw new UnauthorizedActionException(usuario, "crear documentos fuera de la instancia de actividad actual");
        }
        if (solicitud.getWorkflowDefinitionId() != null
                && workflowDefinitionRepository.findFirstByKeyOrderByVersionDesc(solicitud.getWorkflowDefinitionId()).isEmpty()
                && workflowDefinitionRepository.findById(solicitud.getWorkflowDefinitionId()).isEmpty()) {
            throw new ResourceNotFoundException("Política", "key", solicitud.getWorkflowDefinitionId());
        }
        if ("ADMINISTRADOR".equalsIgnoreCase(rol)) return;
        boolean propietario = usuario.equalsIgnoreCase(solicitud.getUsuarioCreador());
        boolean asignado = solicitud.getUsuarioAsignado() != null && usuario.equalsIgnoreCase(solicitud.getUsuarioAsignado());
        boolean responsableDepartamento = "REVISOR".equalsIgnoreCase(rol) && departamento != null
                && departamento.equalsIgnoreCase(solicitud.getDepartamentoActual());
        if (!(propietario || asignado || responsableDepartamento)) {
            throw new UnauthorizedActionException(usuario, "crear documentos en un trámite ajeno");
        }
    }

    private void validarSolicitudExiste(String solicitudId) {
        if (solicitudId != null && (solicitudId.startsWith("Activity_") || 
                                    solicitudId.startsWith("Event_") || 
                                    solicitudId.startsWith("Gateway_") ||
                                    solicitudId.equals("bpmn-central") ||
                                    solicitudId.startsWith("bpmn-"))) {
            return; // Es una etapa o nodo de diseño BPMN, no requiere Solicitud física en la BD
        }
        if (!solicitudRepository.existsById(solicitudId)) {
            throw new ResourceNotFoundException("Solicitud", "id", solicitudId);
        }
    }

    private void registrarEventoEnSolicitud(String solicitudId, String usuario, String comentario) {
        solicitudRepository.findById(solicitudId).ifPresent(solicitud -> {
            solicitud.registrarTransicion(
                    solicitud.getEstado(),
                    solicitud.getEstado(),
                    usuario,
                    "USUARIO",
                    comentario
            );
            solicitudRepository.save(solicitud);
        });
    }
}

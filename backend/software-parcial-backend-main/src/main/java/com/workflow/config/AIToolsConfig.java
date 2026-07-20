package com.workflow.config;

import com.workflow.domain.enums.EstadoWorkflow;
import com.workflow.domain.enums.Prioridad;
import com.workflow.domain.enums.RolUsuario;
import com.workflow.dto.request.CambiarEstadoRequest;
import com.workflow.dto.request.ReasignarDepartamentoRequest;
import com.workflow.dto.response.SolicitudResponse;
import com.workflow.service.WorkflowService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.List;
import java.util.function.Function;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class AIToolsConfig {

    private final WorkflowService workflowService;

    // Record Data Structures for the Tools
    public record ToolResponse(String resultado) {}
    public record LeerGlobalRequest() {}
    public record LeerDepartamentoRequest(String departamento) {}
    public record ReasignarRequest(String codigoSeguimiento, String nuevoDepartamento, String justificacion) {}
    public record CambiarEstadoRevisorRequest(String codigoSeguimiento, String nuevoEstado, String comentario) {}

    @Bean
    @Description("Obtiene la lista de todas las solicitudes y tickets que están actualmente asignadas a un departamento especifico para su analisis.")
    public Function<LeerDepartamentoRequest, ToolResponse> analizarColaDepartamentoTool() {
        return request -> {
            log.info("Tool invocada: analizarColaDepartamentoTool ({})", request.departamento());
            List<SolicitudResponse> solicitudes = workflowService.listarPorDepartamento(request.departamento());
            int urgentes = (int) solicitudes.stream().filter(s -> s.getPrioridad() == Prioridad.URGENTE).count();
            return new ToolResponse(String.format(
                    "El departamento %s tiene %d tickets totales. %d son URGENTES. " +
                    "Puedes analizar esto o sugerir acciones.",
                    request.departamento(), solicitudes.size(), urgentes
            ));
        };
    }

    @Bean
    @Description("Obtiene un resumen global de TODOS los tickets en el sistema, ideal para detectar cuellos de botella y proponer optimizaciones de flujo sugeridas al usuario.")
    public Function<LeerGlobalRequest, ToolResponse> analizarSistemaGlobalTool() {
        return request -> {
            log.info("Tool invocada: analizarSistemaGlobalTool");
            List<SolicitudResponse> todas = workflowService.listarTodas();
            if (todas.isEmpty()) return new ToolResponse("El sistema no tiene tickets registrados actualmente.");
            
            long urgentes = todas.stream().filter(s -> s.getPrioridad() == Prioridad.URGENTE).count();
            return new ToolResponse(String.format(
                    "El sistema global tiene %d tickets activos. %d son URGENTES. " +
                    "Analiza estos volúmenes y sugiérele al administrador optimizaciones.",
                    todas.size(), urgentes
            ));
        };
    }

    @Bean
    @Description("Reasigna o transfiere un ticket (solicitud) de un departamento a otro. Requiere el código de seguimiento (ej. WF-2026-001) y el departamento destino (ej. Sistemas).")
    public Function<ReasignarRequest, ToolResponse> reasignarTicketTool() {
        return request -> {
            log.info("Tool invocada: reasignarTicketTool ({})", request.codigoSeguimiento());
            try {
                SolicitudResponse solicitud = workflowService.obtenerPorCodigoSeguimiento(request.codigoSeguimiento());
                ReasignarDepartamentoRequest tr = ReasignarDepartamentoRequest.builder()
                        .nuevoDepartamento(request.nuevoDepartamento())
                        .comentario("Reasignación automática IA: " + request.justificacion())
                        .build();
                // Admin mode for AI
                workflowService.reasignarDepartamento(solicitud.getId(), tr, "IA_CORE", RolUsuario.ADMINISTRADOR, null);
                return new ToolResponse("Ticket " + request.codigoSeguimiento() + " movido exitosamente a " + request.nuevoDepartamento());
            } catch (Exception e) {
                return new ToolResponse("Error al reasignar: " + e.getMessage());
            }
        };
    }

    @Bean
    @Description("Aprueba, rechaza o cambia el estado lógico de un flujo de trabajo. Requiere el código de seguimiento (ej. WF-2026-001) y el estado nuevo (APROBADO, RECHAZADO, EN_REVISION, PENDIENTE).")
    public Function<CambiarEstadoRevisorRequest, ToolResponse> cambiarEstadoTicketTool() {
        return request -> {
            log.info("Tool invocada: cambiarEstadoTicketTool ({})", request.codigoSeguimiento());
            try {
                SolicitudResponse solicitud = workflowService.obtenerPorCodigoSeguimiento(request.codigoSeguimiento());
                EstadoWorkflow estado = EstadoWorkflow.valueOf(request.nuevoEstado().toUpperCase());
                
                CambiarEstadoRequest cr = CambiarEstadoRequest.builder()
                        .nuevoEstado(estado)
                        .comentario("Operación de estado por IA: " + request.comentario())
                        .build();
                
                workflowService.cambiarEstado(solicitud.getId(), cr, "IA_CORE", RolUsuario.ADMINISTRADOR, null);
                return new ToolResponse("Ticket " + request.codigoSeguimiento() + " cambiado al estado " + estado);
            } catch (Exception e) {
                return new ToolResponse("Error al cambiar estado: " + e.getMessage());
            }
        };
    }

    public record RellenarFormularioRequest(String codigoSeguimiento, java.util.Map<String, Object> campos) {}

    @Bean
    @Description("Rellena o actualiza datos técnicos en el formulario dinámico de una solicitud. Se usa cuando el usuario dicta o escribe datos específicos (ej. 'El monto es 500' o 'Mi dirección es Calle 123'). Requiere el código de seguimiento.")
    public Function<RellenarFormularioRequest, ToolResponse> rellenarFormularioTool() {
        return request -> {
            log.info("Tool invocada: rellenarFormularioTool ({})", request.codigoSeguimiento());
            try {
                SolicitudResponse solicitud = workflowService.obtenerPorCodigoSeguimiento(request.codigoSeguimiento());
                CambiarEstadoRequest cr = CambiarEstadoRequest.builder()
                        .nuevoEstado(solicitud.getEstado())
                        .comentario("Actualización de datos vía Asistente de IA")
                        .datosFormulario(request.campos())
                        .build();
                
                workflowService.cambiarEstado(solicitud.getId(), cr, "IA_CORE", RolUsuario.ADMINISTRADOR, null);
                return new ToolResponse("Formulario de " + request.codigoSeguimiento() + " actualizado con " + request.campos().size() + " campos.");
            } catch (Exception e) {
                return new ToolResponse("Error al rellenar formulario: " + e.getMessage());
            }
        };
    }
}

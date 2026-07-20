import 'historial_event.dart';

class Solicitud {
  const Solicitud({
    required this.id,
    required this.codigoSeguimiento,
    required this.titulo,
    required this.descripcion,
    required this.estado,
    required this.departamentoActual,
    required this.workflowDefinitionId,
    required this.tareaActualId,
    required this.tareaActualNombre,
    required this.fechaCreacion,
    required this.fechaActualizacion,
    required this.fechaLimiteAtencion,
    required this.historial,
  });

  final String id;
  final String codigoSeguimiento;
  final String titulo;
  final String descripcion;
  final String estado;
  final String departamentoActual;
  final String workflowDefinitionId;
  final String tareaActualId;
  final String tareaActualNombre;
  final DateTime? fechaCreacion;
  final DateTime? fechaActualizacion;
  final DateTime? fechaLimiteAtencion;
  final List<HistorialEvent> historial;

  bool get hasWorkflowDefinition => workflowDefinitionId.isNotEmpty;

  factory Solicitud.fromJson(Map<String, dynamic> json) {
    final historialJson = json['historial'];
    return Solicitud(
      id: json['id']?.toString() ?? '',
      codigoSeguimiento: json['codigoSeguimiento']?.toString() ?? '',
      titulo: json['titulo']?.toString() ?? '',
      descripcion: json['descripcion']?.toString() ?? '',
      estado: json['estado']?.toString() ?? 'DESCONOCIDO',
      departamentoActual:
          json['departamentoActual']?.toString() ?? 'Sin asignar',
      workflowDefinitionId: json['workflowDefinitionId']?.toString() ?? '',
      tareaActualId: json['tareaActualId']?.toString() ?? '',
      tareaActualNombre: json['tareaActualNombre']?.toString() ?? '',
      fechaCreacion: DateTime.tryParse(json['fechaCreacion']?.toString() ?? ''),
      fechaActualizacion: DateTime.tryParse(
        json['fechaActualizacion']?.toString() ?? '',
      ),
      fechaLimiteAtencion: DateTime.tryParse(
        json['fechaLimiteAtencion']?.toString() ?? '',
      ),
      historial:
          historialJson is List
              ? historialJson
                  .map(
                    (item) =>
                        HistorialEvent.fromJson(item as Map<String, dynamic>),
                  )
                  .toList()
              : const [],
    );
  }
}

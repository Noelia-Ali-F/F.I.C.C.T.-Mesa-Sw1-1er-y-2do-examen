class HistorialEvent {
  const HistorialEvent({
    required this.fecha,
    required this.estadoAnterior,
    required this.estadoNuevo,
    required this.usuarioResponsable,
    required this.rolUsuario,
    required this.comentario,
  });

  final DateTime? fecha;
  final String? estadoAnterior;
  final String? estadoNuevo;
  final String? usuarioResponsable;
  final String? rolUsuario;
  final String? comentario;

  factory HistorialEvent.fromJson(Map<String, dynamic> json) {
    return HistorialEvent(
      fecha: DateTime.tryParse(json['fecha']?.toString() ?? ''),
      estadoAnterior: json['estadoAnterior']?.toString(),
      estadoNuevo: json['estadoNuevo']?.toString(),
      usuarioResponsable: json['usuarioResponsable']?.toString(),
      rolUsuario: json['rolUsuario']?.toString(),
      comentario: json['comentario']?.toString(),
    );
  }
}

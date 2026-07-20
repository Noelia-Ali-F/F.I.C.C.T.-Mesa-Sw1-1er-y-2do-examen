class ApiResponse<T> {
  const ApiResponse({
    required this.exito,
    required this.mensaje,
    required this.datos,
  });

  final bool exito;
  final String mensaje;
  final T datos;

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic value) mapper,
  ) {
    return ApiResponse<T>(
      exito: json['exito'] == true,
      mensaje: json['mensaje']?.toString() ?? '',
      datos: mapper(json['datos']),
    );
  }
}

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/app_config.dart';
import '../models/api_response.dart';
import '../models/solicitud.dart';
import '../models/workflow_definition.dart';

class WorkflowApiService {
  Future<Solicitud> fetchSolicitud(String codigoSeguimiento) async {
    final response = await http.get(
      AppConfig.apiUri(
        '/api/v1/workflows/public/seguimiento/$codigoSeguimiento',
      ),
    );

    final jsonBody = _decodeBody(response);
    if (response.statusCode >= 400 || jsonBody['exito'] != true) {
      throw WorkflowApiException(
        _extractMessage(jsonBody, response.statusCode),
      );
    }

    return ApiResponse<Solicitud>.fromJson(
      jsonBody,
      (value) => Solicitud.fromJson(value as Map<String, dynamic>),
    ).datos;
  }

  Future<WorkflowDefinition?> fetchWorkflowDefinition(String identifier) async {
    if (identifier.trim().isEmpty) {
      return null;
    }

    final directResponse = await http.get(
      AppConfig.apiUri('/api/v1/bpmn/definitions/$identifier'),
    );
    final directJson = _decodeBody(directResponse);
    if (directResponse.statusCode < 400 && directJson['datos'] != null) {
      return WorkflowDefinition.fromJson(
        directJson['datos'] as Map<String, dynamic>,
      );
    }

    final listResponse = await http.get(
      AppConfig.apiUri('/api/v1/bpmn/definitions'),
    );
    final listJson = _decodeBody(listResponse);
    if (listResponse.statusCode >= 400 || listJson['datos'] is! List) {
      return null;
    }

    final definitions =
        (listJson['datos'] as List)
            .map(
              (item) =>
                  WorkflowDefinition.fromJson(item as Map<String, dynamic>),
            )
            .toList();

    for (final item in definitions) {
      if (item.id == identifier || item.key == identifier) {
        return item;
      }
    }
    return null;
  }

  Future<void> registerTrackingToken({
    required String codigoSeguimiento,
    required String token,
    required String platform,
  }) async {
    final response = await http.post(
      AppConfig.apiUri('/api/v1/notifications/register-tracking-token'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'codigoSeguimiento': codigoSeguimiento,
        'token': token,
        'platform': platform,
      }),
    );

    if (response.statusCode >= 400) {
      throw WorkflowApiException(
        'No se pudo registrar el dispositivo para notificaciones.',
      );
    }
  }

  Future<void> unregisterToken(String token) async {
    final response = await http.delete(
      AppConfig.apiUri('/api/v1/notifications/unregister-token', {
        'token': token,
      }),
    );

    if (response.statusCode >= 400) {
      throw WorkflowApiException(
        'No se pudo desactivar la suscripcion de este dispositivo.',
      );
    }
  }

  Map<String, dynamic> _decodeBody(http.Response response) {
    if (response.body.isEmpty) {
      return const {};
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  String _extractMessage(Map<String, dynamic> jsonBody, int statusCode) {
    if (jsonBody['mensaje'] != null) {
      return jsonBody['mensaje'].toString();
    }
    return 'Error consultando el API ($statusCode).';
  }
}

class WorkflowApiException implements Exception {
  WorkflowApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

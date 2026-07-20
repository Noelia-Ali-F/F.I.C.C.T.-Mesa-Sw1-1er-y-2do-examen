import 'dart:math';

import 'workflow_api_service.dart';

class PushNotificationService {
  PushNotificationService(this._api);

  final WorkflowApiService _api;

  String? _registeredCode;
  String? _token;

  String? get registeredCode => _registeredCode;

  Future<void> registerForTrackingCode(String codigoSeguimiento) async {
    final token = _token ?? _generateDeviceToken();
    await _api.registerTrackingToken(
      codigoSeguimiento: codigoSeguimiento,
      token: token,
      platform: 'flutter',
    );

    _registeredCode = codigoSeguimiento;
    _token = token;
  }

  Future<void> unregisterCurrentDevice() async {
    if (_token == null) {
      _registeredCode = null;
      return;
    }

    await _api.unregisterToken(_token!);
    _registeredCode = null;
    _token = null;
  }

  String _generateDeviceToken() {
    final random = Random.secure();
    final buffer = StringBuffer('flutter-device-');
    for (var i = 0; i < 24; i++) {
      buffer.write(random.nextInt(16).toRadixString(16));
    }
    return buffer.toString();
  }
}

import 'package:flutter_test/flutter_test.dart';
import 'package:tramites_ciudadano_app/models/solicitud.dart';

void main() {
  test('convierte la respuesta del backend a modelo de solicitud', () {
    final solicitud = Solicitud.fromJson({
      'id': '123',
      'codigoSeguimiento': 'WF-2026-001',
      'titulo': 'Licencia',
      'descripcion': 'Revision de documento',
      'estado': 'EN_REVISION',
      'departamentoActual': 'Sistemas',
      'workflowDefinitionId': 'flujo-1',
      'tareaActualId': 'Task_2',
      'tareaActualNombre': 'Revision',
      'historial': [
        {
          'fecha': '2026-07-11T10:30:00',
          'estadoNuevo': 'EN_REVISION',
          'comentario': 'Paso a revision',
        },
      ],
    });

    expect(solicitud.codigoSeguimiento, 'WF-2026-001');
    expect(solicitud.hasWorkflowDefinition, isTrue);
    expect(solicitud.historial.length, 1);
    expect(solicitud.historial.first.estadoNuevo, 'EN_REVISION');
  });
}

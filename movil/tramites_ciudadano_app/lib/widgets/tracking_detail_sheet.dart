import 'package:flutter/material.dart';

import '../core/utils/workflow_date_utils.dart';
import '../models/solicitud.dart';
import '../models/workflow_definition.dart';
import '../services/bpmn_route_parser.dart';

class TrackingDetailSheet extends StatelessWidget {
  TrackingDetailSheet({
    super.key,
    required this.solicitud,
    required this.definition,
  });

  final Solicitud solicitud;
  final WorkflowDefinition? definition;
  final BpmnRouteParser _parser = BpmnRouteParser();

  @override
  Widget build(BuildContext context) {
    final steps =
        definition == null
            ? const <BpmnRouteStep>[]
            : _parser.parseOrderedSteps(
              definition!.xml,
              currentTaskId: solicitud.tareaActualId,
            );

    return Column(
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _InfoPill(
                      label: 'Codigo',
                      value: solicitud.codigoSeguimiento,
                    ),
                    _InfoPill(label: 'Estado', value: solicitud.estado),
                    _InfoPill(
                      label: 'Departamento',
                      value: solicitud.departamentoActual,
                    ),
                    _InfoPill(
                      label: 'Etapa',
                      value:
                          solicitud.tareaActualNombre.isNotEmpty
                              ? solicitud.tareaActualNombre
                              : 'Sin etapa BPMN',
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  solicitud.titulo,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  solicitud.descripcion.isNotEmpty
                      ? solicitud.descripcion
                      : 'Sin descripcion registrada.',
                ),
                const SizedBox(height: 16),
                Text(
                  'Creado: ${formatShortDate(solicitud.fechaCreacion)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                Text(
                  'Ultima actualizacion: ${formatShortDate(solicitud.fechaActualizacion)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hoja de ruta',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  steps.isEmpty
                      ? 'Este tramite aun no tiene un flujo BPMN asociado para mostrar el recorrido visual.'
                      : 'La etapa actual queda resaltada para que el ciudadano vea en que punto exacto se encuentra su gestion.',
                ),
                const SizedBox(height: 18),
                if (steps.isEmpty)
                  const _EmptyRouteState()
                else
                  _RouteTimeline(steps: steps),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Historial',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                if (solicitud.historial.isEmpty)
                  const Text('Todavia no existen movimientos registrados.')
                else
                  ...solicitud.historial.reversed.map(
                    (evento) => Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            margin: const EdgeInsets.only(top: 6),
                            decoration: const BoxDecoration(
                              color: Color(0xFF0B5D5B),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  evento.estadoNuevo ?? 'Movimiento registrado',
                                  style:
                                      Theme.of(context).textTheme.titleMedium,
                                ),
                                const SizedBox(height: 4),
                                Text(evento.comentario ?? 'Sin comentario'),
                                const SizedBox(height: 4),
                                Text(
                                  formatShortDate(evento.fecha),
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF1EFE8),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 4),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class _EmptyRouteState extends StatelessWidget {
  const _EmptyRouteState();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF1EFE8),
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Text(
        'Cuando un funcionario vincule este tramite con un proceso BPMN, aqui aparecera el recorrido visual completo.',
      ),
    );
  }
}

class _RouteTimeline extends StatelessWidget {
  const _RouteTimeline({required this.steps});

  final List<BpmnRouteStep> steps;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var index = 0; index < steps.length; index++)
          Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color:
                  steps[index].isCurrent
                      ? const Color(0xFFDFF2E6)
                      : const Color(0xFFF8F7F2),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color:
                    steps[index].isCurrent
                        ? const Color(0xFF3E7C59)
                        : const Color(0xFFE0DBCF),
                width: steps[index].isCurrent ? 1.4 : 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color:
                        steps[index].isCurrent
                            ? const Color(0xFF0B5D5B)
                            : Colors.white,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${index + 1}',
                    style: TextStyle(
                      color:
                          steps[index].isCurrent
                              ? Colors.white
                              : const Color(0xFF0B5D5B),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        steps[index].name,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        steps[index].isCurrent
                            ? 'Etapa actual'
                            : steps[index].type,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

import 'package:xml/xml.dart';

class BpmnRouteStep {
  const BpmnRouteStep({
    required this.id,
    required this.name,
    required this.type,
    required this.isCurrent,
  });

  final String id;
  final String name;
  final String type;
  final bool isCurrent;
}

class BpmnRouteParser {
  List<BpmnRouteStep> parseOrderedSteps(
    String xmlSource, {
    String? currentTaskId,
  }) {
    if (xmlSource.trim().isEmpty) {
      return const [];
    }

    final document = XmlDocument.parse(xmlSource);
    final processes = document.findAllElements('bpmn:process');
    if (processes.isEmpty) {
      return const [];
    }

    final process = processes.first;
    final nodes = <String, XmlElement>{};
    final outgoing = <String, String>{};

    for (final node in process.children.whereType<XmlElement>()) {
      final id = node.getAttribute('id');
      if (id == null || id.isEmpty) {
        continue;
      }

      if (_isTrackable(node.name.local)) {
        nodes[id] = node;
      }

      if (node.name.local == 'sequenceFlow') {
        final source = node.getAttribute('sourceRef');
        final target = node.getAttribute('targetRef');
        if (source != null && target != null) {
          outgoing[source] = target;
        }
      }
    }

    final start = nodes.values.firstWhere(
      (node) => node.name.local == 'startEvent',
      orElse: () => nodes.values.first,
    );

    final steps = <BpmnRouteStep>[];
    final visited = <String>{};
    String? pointer = start.getAttribute('id');

    while (pointer != null &&
        !visited.contains(pointer) &&
        nodes.containsKey(pointer)) {
      visited.add(pointer);
      final node = nodes[pointer]!;
      final type = node.name.local;
      final name = node.getAttribute('name');
      steps.add(
        BpmnRouteStep(
          id: pointer,
          name:
              name != null && name.trim().isNotEmpty
                  ? name.trim()
                  : _fallbackName(type),
          type: type,
          isCurrent: pointer == currentTaskId,
        ),
      );
      pointer = outgoing[pointer];
    }

    return steps;
  }

  bool _isTrackable(String localName) {
    return localName == 'startEvent' ||
        localName == 'userTask' ||
        localName == 'task' ||
        localName == 'serviceTask' ||
        localName == 'exclusiveGateway' ||
        localName == 'endEvent';
  }

  String _fallbackName(String type) {
    switch (type) {
      case 'startEvent':
        return 'Inicio';
      case 'exclusiveGateway':
        return 'Decision';
      case 'endEvent':
        return 'Cierre';
      default:
        return 'Paso';
    }
  }
}

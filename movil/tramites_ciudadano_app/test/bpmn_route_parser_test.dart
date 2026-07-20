import 'package:flutter_test/flutter_test.dart';
import 'package:tramites_ciudadano_app/services/bpmn_route_parser.dart';

void main() {
  test('parsea la ruta BPMN y marca la tarea actual', () {
    const xml = '''
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="StartEvent_1" name="Inicio" />
    <bpmn:userTask id="Task_1" name="Recepcion" />
    <bpmn:userTask id="Task_2" name="Revision" />
    <bpmn:endEvent id="EndEvent_1" name="Cierre" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Task_2" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_2" targetRef="EndEvent_1" />
  </bpmn:process>
</bpmn:definitions>
''';

    final parser = BpmnRouteParser();
    final steps = parser.parseOrderedSteps(xml, currentTaskId: 'Task_2');

    expect(steps.length, 4);
    expect(steps[1].name, 'Recepcion');
    expect(steps[2].isCurrent, isTrue);
    expect(steps[3].name, 'Cierre');
  });
}

class WorkflowDefinition {
  const WorkflowDefinition({
    required this.id,
    required this.key,
    required this.name,
    required this.description,
    required this.xml,
  });

  final String id;
  final String key;
  final String name;
  final String description;
  final String xml;

  factory WorkflowDefinition.fromJson(Map<String, dynamic> json) {
    return WorkflowDefinition(
      id: json['id']?.toString() ?? '',
      key: json['key']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      xml: json['xml']?.toString() ?? '',
    );
  }
}

import 'package:flutter/material.dart';

import '../models/solicitud.dart';
import '../models/workflow_definition.dart';
import '../services/push_notification_service.dart';
import '../services/workflow_api_service.dart';
import '../widgets/hero_status_panel.dart';
import '../widgets/tracking_detail_sheet.dart';

class TrackingHomePage extends StatefulWidget {
  const TrackingHomePage({
    super.key,
    required this.api,
    required this.notifications,
  });

  final WorkflowApiService api;
  final PushNotificationService notifications;

  @override
  State<TrackingHomePage> createState() => _TrackingHomePageState();
}

class _TrackingHomePageState extends State<TrackingHomePage> {
  final _codeController = TextEditingController();
  bool _loading = false;
  String? _error;
  Solicitud? _solicitud;
  WorkflowDefinition? _definition;
  bool _notificationsEnabled = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _consultar() async {
    final code = _codeController.text.trim().toUpperCase();
    if (code.isEmpty) {
      setState(() => _error = 'Ingresa un codigo de seguimiento.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final solicitud = await widget.api.fetchSolicitud(code);
      final definition =
          solicitud.hasWorkflowDefinition
              ? await widget.api.fetchWorkflowDefinition(
                solicitud.workflowDefinitionId,
              )
              : null;

      if (!mounted) {
        return;
      }

      setState(() {
        _solicitud = solicitud;
        _definition = definition;
        _notificationsEnabled =
            widget.notifications.registeredCode == solicitud.codigoSeguimiento;
      });
    } on WorkflowApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.message;
        _solicitud = null;
        _definition = null;
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _toggleNotifications(bool value) async {
    final solicitud = _solicitud;
    if (solicitud == null) {
      return;
    }

    setState(() => _loading = true);
    try {
      if (value) {
        await widget.notifications.registerForTrackingCode(
          solicitud.codigoSeguimiento,
        );
      } else {
        await widget.notifications.unregisterCurrentDevice();
      }

      if (!mounted) {
        return;
      }
      setState(() => _notificationsEnabled = value);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            value
                ? 'Este dispositivo quedo asociado al tramite ${solicitud.codigoSeguimiento}.'
                : 'Se desactivaron las alertas de este dispositivo.',
          ),
        ),
      );
    } on WorkflowApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Seguimiento Ciudadano')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const HeroStatusPanel(),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Consulta tu tramite',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Ingresa tu codigo de seguimiento para ver la hoja de ruta y el estado actual.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 18),
                    TextField(
                      controller: _codeController,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        labelText: 'Codigo de seguimiento',
                        hintText: 'Ej. WF-2026-001',
                        prefixIcon: Icon(Icons.search_rounded),
                      ),
                      onSubmitted: (_) => _consultar(),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _loading ? null : _consultar,
                      icon:
                          _loading
                              ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                              : const Icon(Icons.travel_explore_rounded),
                      label: const Text('Ver estado del tramite'),
                    ),
                  ],
                ),
              ),
            ),
            if (_solicitud != null) ...[
              const SizedBox(height: 20),
              SwitchListTile.adaptive(
                contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                title: const Text('Alertas en este dispositivo'),
                subtitle: const Text(
                  'Activa avisos cuando el tramite avance, sea observado o rechazado.',
                ),
                value: _notificationsEnabled,
                onChanged: _loading ? null : _toggleNotifications,
              ),
              const SizedBox(height: 12),
              TrackingDetailSheet(
                solicitud: _solicitud!,
                definition: _definition,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

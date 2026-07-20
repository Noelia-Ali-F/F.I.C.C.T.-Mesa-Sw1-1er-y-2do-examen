import 'package:flutter/material.dart';

import 'core/theme/app_theme.dart';
import 'pages/tracking_home_page.dart';
import 'services/push_notification_service.dart';
import 'services/workflow_api_service.dart';

void runTramitesCiudadanoApp() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TramitesCiudadanoApp());
}

class TramitesCiudadanoApp extends StatelessWidget {
  const TramitesCiudadanoApp({super.key});

  @override
  Widget build(BuildContext context) {
    final api = WorkflowApiService();
    final notifications = PushNotificationService(api);

    return MaterialApp(
      title: 'Seguimiento Ciudadano',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: TrackingHomePage(api: api, notifications: notifications),
    );
  }
}

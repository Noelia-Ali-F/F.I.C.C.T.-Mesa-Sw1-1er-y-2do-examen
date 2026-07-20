# Tramites Ciudadano App

App Flutter Android para ciudadanos que permite:

- consultar un tramite por `codigoSeguimiento`
- ver estado, departamento actual e historial
- visualizar la hoja de ruta BPMN asociada
- registrar el dispositivo para seguimiento/notificaciones por codigo

## Servicio web configurado

La app apunta por defecto al backend cloud:

```text
http://3.92.42.41:8080
```

Configuracion aplicada en:

- [app_config.dart](/home/jhasmany/Repository/Noelia/Sw1%20Mesa/SegundoParcial_SW1-main/movil/tramites_ciudadano_app/lib/core/config/app_config.dart:1)
- [AndroidManifest.xml](/home/jhasmany/Repository/Noelia/Sw1%20Mesa/SegundoParcial_SW1-main/movil/tramites_ciudadano_app/android/app/src/main/AndroidManifest.xml:1)

## Cambiar la URL del backend

Si luego cambias IP o dominio, puedes sobrescribir la URL sin tocar codigo:

```bash
flutter run -d android --dart-define=API_BASE_URL=http://TU_IP_O_DOMINIO:8080
```

Ejemplo:

```bash
fvm flutter run -d android --dart-define=API_BASE_URL=http://3.92.42.41:8080
```

## Comandos utiles

```bash
cd movil/tramites_ciudadano_app
flutter pub get
flutter analyze
flutter test
flutter run -d android
```

## Nota importante

Android quedo habilitado para trafico HTTP no cifrado (`usesCleartextTraffic="true"`), porque el backend actual se publica por `http` y no por `https`.

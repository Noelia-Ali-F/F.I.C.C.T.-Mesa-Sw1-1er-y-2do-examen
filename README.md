# Sistema Workflow Departamental

Este proyecto fue dockerizado y validado localmente con tres servicios:

- `frontend` Angular servido por Nginx
- `backend` Spring Boot
- `mongo` MongoDB

Además se creó una app Flutter para ciudadanos en:

- `movil/tramites_ciudadano_app`

## Accesos

- Frontend: `http://localhost:8081`
- Backend API: `http://localhost:8080`
- Swagger / OpenAPI: `http://localhost:8080/swagger-ui/index.html`
- MongoDB: `mongodb://localhost:27017/workflow_db`

## Preparación Cloud

La preparación para despliegue en la VM cloud quedó lista para la IP pública:

- `44.193.80.129`

Archivos agregados para cloud:

- `.env.cloud.example`
- `scripts/build-local-artifacts.sh`
- `scripts/deploy-cloud-aws.sh`

Pasos mínimos:

```bash
cd /home/jhasmany/Repository/Noelia/Sw1\ Mesa/SegundoParcial_SW1-main
cp .env.cloud.example .env.cloud
chmod +x scripts/build-local-artifacts.sh scripts/deploy-cloud-aws.sh
```

Despliegue hacia la VM `aws-mesa`:

```bash
./scripts/deploy-cloud-aws.sh
```

URLs esperadas en cloud:

- Frontend: `http://44.193.80.129:8081`
- Backend: `http://44.193.80.129:8080`
- Swagger: `http://44.193.80.129:8080/swagger-ui/index.html`

## Puertos usados

- `8081` -> frontend
- `8080` -> backend
- `27017` -> MongoDB

Antes del despliegue se verificó que estos puertos estaban libres.

## App móvil Android

Ruta del proyecto:

```bash
movil/tramites_ciudadano_app
```

Comandos útiles:

```bash
cd movil/tramites_ciudadano_app
flutter pub get
flutter analyze
flutter test
flutter build apk
flutter run -d android
```

Para ejecutar localmente contra el backend Dockerizado:

```bash
cd movil/tramites_ciudadano_app
flutter run -d android
```

Notas de conexión local:

- En este entorno la app Android apunta por defecto a `http://192.168.26.7:8080`
- En dispositivo físico debes reemplazar `API_BASE_URL` por la IP LAN de tu máquina, por ejemplo:

```bash
flutter run -d android --dart-define=API_BASE_URL=http://192.168.1.50:8080
```

Para apuntar al backend cloud:

```bash
flutter run -d android --dart-define=API_BASE_URL=http://44.193.80.129:8080
```

La app móvil permite:

1. Consultar el trámite por `codigoSeguimiento`
2. Mostrar el estado actual, departamento actual e historial
3. Mostrar una hoja de ruta visual basada en el BPMN asociado y resaltar la etapa actual
4. Asociar el dispositivo Android al `codigoSeguimiento` para el caso ciudadano

### Nota sobre notificaciones push

La integración backend para el ciudadano quedó lista con:

- `POST /api/v1/notifications/register-tracking-token`
- `GET /api/v1/notifications/tracking-status`
- `GET /api/v1/workflows/public/seguimiento/{codigo}`

En esta entrega la app Android registra un identificador de dispositivo compatible con el backend para validar el flujo ciudadano de suscripción.
Para notificaciones push nativas reales en Android todavía faltaría incorporar `google-services.json` y terminar la integración FCM móvil, archivo que no existe en este repositorio.

## Usuarios de prueba

El backend ejecuta un seed automático al iniciar y crea estos usuarios:

| Usuario | Contraseña | Rol | Departamento |
|---|---|---|---|
| `admin` | `admin` | `ADMINISTRADOR` | `Sistemas` |
| `revisor` | `revisor` | `REVISOR` | `Recursos Humanos` |
| `ti` | `ti` | `REVISOR` | `Sistemas` |
| `ventas` | `ventas` | `REVISOR` | `Ventas` |
| `finanzas` | `finanzas` | `REVISOR` | `Finanzas` |
| `solicitante` | `solicitante` | `SOLICITANTE` | `Sistemas` |

## Levantar el sistema

Desde la raíz del proyecto:

```bash
docker compose up --build -d
```

Para verificar el estado:

```bash
docker compose ps
```

Para bajar el entorno:

```bash
docker compose down
```

Si también quieres borrar volúmenes:

```bash
docker compose down -v
```

Con variables cloud:

```bash
docker compose --env-file .env.cloud up --build -d
```

## Pruebas realizadas

Se validó el funcionamiento básico del sistema con estas pruebas reales:

1. `GET /` del frontend en `http://localhost:8081` -> `200 OK`
2. `GET /env.js` del frontend -> configuración dinámica entregada correctamente
3. `GET /v3/api-docs` del backend -> `200 OK`
4. `POST /api/v1/auth/login` con `admin/admin` -> login exitoso
5. `POST /api/v1/auth/login` vía frontend proxy `http://localhost:8081/api/...` -> login exitoso
6. `GET /api/v1/workflows` con headers de administrador -> lista de solicitudes seed devuelta correctamente
7. `POST /api/v1/chat-ia/preguntar` -> respuesta exitosa en modo local fallback
8. `GET /api/v1/workflows/public/seguimiento/WF-2026-001` -> consulta ciudadana exitosa
9. `GET /api/v1/bpmn/definitions/procurement-workflow` -> XML BPMN entregado correctamente
10. `POST /api/v1/notifications/register-tracking-token` -> suscripción ciudadana registrada
11. `GET /api/v1/notifications/tracking-status?codigoSeguimiento=WF-2026-001` -> estado `enabled: true`
12. `flutter analyze` en `movil/tramites_ciudadano_app` -> sin errores
13. `flutter test` en `movil/tramites_ciudadano_app` -> pruebas unitarias exitosas
14. configuración Android ajustada para consumo local del backend vía `10.0.2.2`

## Ejemplos de prueba manual

Login directo al backend:

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'
```

Login pasando por el frontend:

```bash
curl -X POST http://localhost:8081/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'
```

Listar solicitudes como administrador:

```bash
curl http://localhost:8080/api/v1/workflows \
  -H 'X-Usuario: admin' \
  -H 'X-Rol: ADMINISTRADOR'
```

Seguimiento ciudadano por código:

```bash
curl http://localhost:8080/api/v1/workflows/public/seguimiento/WF-2026-001
```

Registrar suscripción ciudadana por código:

```bash
curl -X POST http://localhost:8080/api/v1/notifications/register-tracking-token \
  -H 'Content-Type: application/json' \
  -d '{"codigoSeguimiento":"WF-2026-001","token":"flutter-device-test-001","platform":"flutter"}'
```

## Instalaciones y dependencias usadas

Para dejar el sistema operativo en este entorno se realizaron estas acciones:

- descarga de imágenes Docker necesarias (`mongo:7`, `nginx:alpine`, `eclipse-temurin:17-jre-alpine`)
- instalación de dependencias del frontend con `npm ci --legacy-peer-deps`
- compilación del frontend con `npm run build -- --configuration production`
- compilación del backend con Maven dentro de contenedor Java 17
- instalación local de Flutter SDK `3.29.3`
- instalación de dependencias Flutter con `flutter pub get`

No fue necesario instalar paquetes del sistema operativo fuera de Docker.

## Notas importantes

- El frontend quedó configurado para consumir la API local por proxy Nginx.
- El backend arranca con seed automático y llena MongoDB con usuarios, workflows y solicitudes demo.
- Firebase no está configurado localmente; el backend registra ese problema en logs pero continúa arrancando.
- La integración con Gemini / Vertex AI quedó en modo fallback local para que el sistema pueda ejecutarse sin credenciales cloud.
- Código de prueba ciudadano validado: `WF-2026-001`
- La app móvil se considera entrega local Android, no parte del despliegue Docker.
- El despliegue cloud quedó preparado para usar proxy Nginx en frontend y backend público en `8080`.

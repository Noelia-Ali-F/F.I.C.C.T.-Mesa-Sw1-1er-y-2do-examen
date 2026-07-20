# Sistema Workflow y TensorFlow

Este repositorio reúne la entrega del **primer examen** y del **segundo examen** de la materia, sobre una misma base de software. El proyecto implementa un sistema de gestión de trámites internos por departamentos, donde cada solicitud avanza por etapas, registra historial, puede asociarse a un flujo BPMN y, en la segunda etapa del trabajo, incorpora capacidades de análisis inteligente, seguimiento ciudadano y componentes predictivos.

La solución quedó organizada en cuatro bloques principales:

- `backend`: API REST en Spring Boot con MongoDB
- `frontend`: aplicación Angular para funcionarios y administradores
- `movil/tramites_ciudadano_app`: app Flutter para seguimiento ciudadano
- `deploy` y `scripts`: apoyo para despliegue local y cloud

## Contexto académico

### Primer examen

El **primer examen** corresponde al núcleo del sistema: un **workflow departamental** para registrar, revisar, aprobar, rechazar y reasignar solicitudes entre distintas áreas de una organización.

La idea central del primer examen es modelar un proceso burocrático real de forma digital, trazable y controlada. Para eso se implementó:

- creación de solicitudes por parte del usuario solicitante
- bandejas de trabajo por departamento para revisores
- control de estados del trámite
- reasignación entre departamentos
- historial auditable de cada cambio
- paneles de consulta por rol
- soporte para visualizar el proceso como workflow

#### Qué hace el primer examen en detalle

El flujo base del primer examen funciona así:

1. Un **SOLICITANTE** crea una solicitud con título, descripción, prioridad y departamento destino.
2. El sistema genera un **código de seguimiento** y registra la fecha de creación.
3. La solicitud nace en estado `PENDIENTE`.
4. Un usuario con rol **REVISOR** del departamento correspondiente la recibe en su bandeja.
5. El revisor puede moverla a `EN_REVISION`.
6. Desde `EN_REVISION`, la solicitud puede pasar a `APROBADO` o `RECHAZADO`.
7. Un **ADMINISTRADOR** puede ver todo el sistema, consultar estadísticas y reasignar trámites a otros departamentos cuando existan cuellos de botella o errores de derivación.
8. Cada cambio deja una marca en el historial para mantener trazabilidad.

#### Roles del primer examen

- `SOLICITANTE`: crea trámites y consulta únicamente los suyos.
- `REVISOR`: trabaja las solicitudes de su departamento y ejecuta transiciones operativas.
- `ADMINISTRADOR`: tiene visión global, puede reasignar, auditar y consultar KPIs.

#### Workflow del primer examen

La lógica principal del primer examen está basada en una máquina de estados y en reglas por rol:

- `PENDIENTE -> EN_REVISION`
- `EN_REVISION -> APROBADO`
- `EN_REVISION -> RECHAZADO`
- también existen estados operativos extendidos como `BLOQUEADO` y `SLA_CRITICO`

Además del cambio de estado, el sistema maneja:

- cambio de departamento
- asignación de responsables
- búsqueda por código o título
- estadísticas del sistema
- agrupación visual por departamentos tipo swimlanes

#### Tecnologías que sostienen el primer examen

- **Spring Boot** para la API REST
- **MongoDB** para persistencia de solicitudes, historial, usuarios y definiciones
- **Angular** para el panel web
- **Swagger/OpenAPI** para documentación y pruebas de endpoints
- **Docker Compose** para levantar el entorno completo

### Segundo examen

El **segundo examen** extiende el primer examen con una capa de **inteligencia operacional**, representación BPMN más rica, seguimiento ciudadano y componentes predictivos relacionados con riesgo de retraso y priorización.

En esta segunda parte ya no solo se registra y mueve un trámite: también se intenta **analizar su comportamiento**, **detectar anomalías**, **estimar riesgo** y **recomendar acciones**.

#### Qué agrega el segundo examen

- asociación de solicitudes a definiciones BPMN
- seguimiento visual de la etapa actual del trámite
- monitoreo de SLA
- detección de anomalías globales
- recomendación de mejor ruta basada en BPMN y riesgo
- priorización automática de trámites activos
- asistente IA para consultas operativas
- notificaciones
- app móvil para consulta ciudadana

## TensorFlow en el segundo examen

Una parte importante del segundo examen es el módulo predictivo del backend.

En el proyecto se incluyó un **motor predictivo** soportado por la pila:

- `ai.djl:api`
- `ai.djl.tensorflow:tensorflow-engine`

El objetivo de este módulo es evaluar el **riesgo de retraso** de una solicitud usando variables operativas del workflow.

### Qué analiza el modelo

El modelo usa tres entradas normalizadas:

- `priority_norm`: convierte la prioridad del trámite en un valor numérico
- `sla_factor`: mide la cercanía o vencimiento del SLA
- `history_factor`: mide cuánto historial acumuló el trámite

Estas variables permiten construir una señal de riesgo sobre el comportamiento de la solicitud.

### Arquitectura del modelo

El script de entrenamiento `backend/software-parcial-backend-main/training/train_routing_risk.py` genera un modelo tipo:

- **3 entradas**
- **1 capa oculta ReLU de 4 neuronas**
- **1 salida Sigmoid**

En otras palabras, es un **MLP pequeño** orientado a clasificación binaria:

- salida cercana a `1`: mayor riesgo de retraso
- salida cercana a `0`: menor riesgo de retraso

### Cómo se entrena

El entrenamiento toma como base eventos históricos exportados del sistema, especialmente:

- eventos de creación del trámite
- eventos de escalamiento SLA

El script produce:

- `routing-risk-mlp-v1.json`: pesos y sesgos del modelo
- `metrics.json`: métricas de entrenamiento y validación

### Cómo se usa dentro del sistema

En ejecución, el backend carga el archivo del modelo desde:

- `src/main/resources/models/routing-risk-mlp-v1.json`

Luego el servicio `MotorPredictivoServiceImpl` calcula:

- probabilidad de éxito
- riesgo de retraso
- tiempo transcurrido
- anomalías detectadas
- recomendación operativa

Este análisis se expone por endpoints como:

- `GET /api/v1/ia/prediccion/solicitud/{id}`
- `GET /api/v1/ia/prediccion/anomalias`
- `GET /api/v1/ia/prediccion/solicitud/{id}/mejor-ruta`
- `GET /api/v1/ia/prediccion/prioridades`

### Qué hace realmente TensorFlow en esta entrega

En esta entrega académica, TensorFlow forma parte del stack previsto para el motor predictivo y el proyecto incluye entrenamiento, serialización del modelo y dependencia de ejecución mediante DJL. La inferencia operativa que usa el sistema se ejecuta localmente a partir de los pesos exportados del modelo neuronal, lo que permite mantener una ejecución offline, controlada y reproducible dentro del backend.

## Arquitectura funcional del proyecto

### Backend

El backend implementa la lógica de negocio del workflow:

- autenticación básica de pruebas
- CRUD y consultas de solicitudes
- control de estados y permisos
- historial de eventos
- catálogo de departamentos
- asociación de procesos BPMN
- endpoints públicos de seguimiento
- analítica predictiva
- notificaciones
- soporte para IA

### Frontend web

El frontend Angular es la interfaz principal para el personal interno. Desde ahí se puede:

- iniciar sesión
- crear solicitudes
- revisar bandejas por departamento
- consultar detalle e historial
- ver estadísticas
- trabajar con diagramas BPMN
- consumir recomendaciones operativas
- usar componentes de copiloto IA

### App móvil

La app Flutter `movil/tramites_ciudadano_app` está orientada al ciudadano o usuario final del trámite. Permite:

1. Consultar un trámite por `codigoSeguimiento`
2. Ver el estado actual
3. Ver el departamento actual
4. Ver el historial resumido
5. Visualizar la ruta BPMN y resaltar la etapa actual
6. Asociar el dispositivo al código para el escenario de notificaciones

## Accesos locales

- Frontend: `http://localhost:8081`
- Backend API: `http://localhost:8080`
- Swagger / OpenAPI: `http://localhost:8080/swagger-ui/index.html`
- MongoDB: `mongodb://localhost:27017/workflow_db`

## Estructura principal

```text
.
├── backend/software-parcial-backend-main
├── frontend/Angular-workflow-diagram2-main
├── movil/tramites_ciudadano_app
├── scripts
├── deploy
├── docker-compose.yml
└── README.md
```

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

## Puertos usados

- `8081` -> frontend
- `8080` -> backend
- `27017` -> MongoDB

## Endpoints importantes

### Workflow base

- `POST /api/v1/workflows`
- `POST /api/v1/workflows/con-archivos`
- `GET /api/v1/workflows`
- `GET /api/v1/workflows/{id}`
- `GET /api/v1/workflows/seguimiento/{codigo}`
- `GET /api/v1/workflows/public/seguimiento/{codigo}`
- `GET /api/v1/workflows/departamento/{nombre}`
- `GET /api/v1/workflows/usuario/{usuario}`
- `PATCH /api/v1/workflows/{id}/estado`
- `PATCH /api/v1/workflows/{id}/departamento`
- `GET /api/v1/workflows/estadisticas`

### BPMN

- `GET /api/v1/bpmn/definitions`
- `GET /api/v1/bpmn/definitions/{key}`
- `POST /api/v1/bpmn/definitions`
- `PATCH /api/v1/workflows/{id}/bpm-proceso`
- `PATCH /api/v1/workflows/{id}/bpm-tarea`

### IA y analítica

- `POST /api/v1/chat-ia/preguntar`
- `GET /api/v1/ia/prediccion/solicitud/{id}`
- `GET /api/v1/ia/prediccion/anomalias`
- `GET /api/v1/ia/prediccion/solicitud/{id}/mejor-ruta`
- `GET /api/v1/ia/prediccion/prioridades`

### Notificaciones

- `POST /api/v1/notifications/register-tracking-token`
- `GET /api/v1/notifications/tracking-status`

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

Notas de conexión local:

- En este entorno la app Android apunta por defecto a `http://192.168.26.7:8080`
- En dispositivo físico debes reemplazar `API_BASE_URL` por la IP LAN de tu máquina

Ejemplo:

```bash
flutter run -d android --dart-define=API_BASE_URL=http://192.168.1.50:8080
```

Para apuntar al backend cloud:

```bash
flutter run -d android --dart-define=API_BASE_URL=http://44.193.80.129:8080
```

### Nota sobre notificaciones push

La integración backend para el ciudadano quedó lista con:

- `POST /api/v1/notifications/register-tracking-token`
- `GET /api/v1/notifications/tracking-status`
- `GET /api/v1/workflows/public/seguimiento/{codigo}`

En esta entrega la app Android registra un identificador de dispositivo compatible con el backend para validar el flujo ciudadano de suscripción. Para notificaciones push nativas reales en Android todavía faltaría incorporar `google-services.json` y terminar la integración FCM móvil.

## Preparación cloud

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

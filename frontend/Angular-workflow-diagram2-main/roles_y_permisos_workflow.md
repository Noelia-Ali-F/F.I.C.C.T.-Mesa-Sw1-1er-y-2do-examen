# Guía de Actores, Roles y Permisos (Workflow Departamental)

Este documento sirve como puente e instrucción para el desarrollo del **Frontend (Angular)** que consumirá la API. Resume la funcionalidad de cada Rol y cómo el usuario interactuará con el flujo de información usando Swagger/OpenAPI como contrato.

---

## 1. Sistema de Autenticación (Pruebas)

He pre-cargado **3 usuarios por defecto** en la Base de Datos al arrancar el servidor `Spring Boot`. Puedes usar los siguientes usuarios y contraseñas (que coinciden) en el endpoint `/api/v1/auth/login`.

| Username        | Password      | Rol (Enum)    | Departamento      |
|-----------------|---------------|---------------|-------------------|
| `admin`         | `admin`       | ADMINISTRADOR | Sistemas         |
| `solicitante`   | `solicitante` | SOLICITANTE   | Ventas           |
| `revisor`       | `revisor`     | REVISOR       | Recursos Humanos |

> [!TIP]
> Tras el login, tu frontend recibirá un `token` simulado (o futuro JWT) y todos los datos del perfil (nombre completo, rol y departamento). Debes usar este objeto para crear el menú de navegación condicional (ej. `ngIf` o guardas de rutas) en Angular 21.

---

## 2. Descripción y Capacidades de los Actores

### 👉 Actor: SOLICITANTE
Es el usuario base de la empresa. Inicia los procesos burocráticos y necesita seguirlos.

* **Vista en Frontend:**
  * Debe ver un listado llamado **"Mis Solicitudes"**. (Endpoint: `/api/v1/workflows/usuario/{usuario}`)
  * Debe tener un botón principal de **+ Nueva Solicitud**. (Endpoint: `POST /api/v1/workflows`)
* **Reglas Burocráticas:**
  * Solo puede **CREAR**.
  * No puede aprobar, ni rechazar, ni editar estados.
  * Solo ve las solicitudes que él mismo haya creado con su `username`.
  * La solicitud nace con estado `PENDIENTE`.

### 👉 Actor: REVISOR (O Jefe de Departamento)
Es el empleado asignado a un departamento en específico (ej. Recursos Humanos, IT) que recibe las solicitudes del solicitante.

* **Vista en Frontend:**
  * Dashboard de **Bandeja de Entrada**. Lista TODAS las solicitudes que caen a su departamento (Endpoint: `GET /api/v1/workflows/departamento/{nombre}`).
  * Puede filtrar: "Ver Pendientes", "Ver Aprobadas" (Endpoint: `/api/v1/workflows/departamento/{nombre}/estado/{estado}`).
* **Reglas Burocráticas:**
  * Puede transicionar la solicitud de `PENDIENTE` a `EN_REVISION`.
  * Y de `EN_REVISION` a `APROBADO` o `RECHAZADO`. (Endpoint: `PATCH /api/v1/workflows/{id}/estado`).
  * Una vez que la solicitud está *Aprobada* o *Rechazada* ya no puede seguir iterando (estados terminales).
  * No puede ver solicitudes de otros departamentos que no sean el suyo.

### 👉 Actor: ADMINISTRADOR
El usuario "Dios" o Super Administrador. Diseñado para auditar, trasladar trámites atascados o reabrir casos.

* **Vista en Frontend:**
  * Visión Global. Ve listados masivos. (Endpoint: `GET /api/v1/workflows`)
  * Vista de Estadísticas Administrativas / KPIs. (Endpoint: `GET /api/v1/workflows/estadisticas`)
  * Herramienta universal de búsqueda. (Endpoint: `GET /api/v1/workflows/buscar`)
* **Reglas Burocráticas:**
  * Puede cambiar libremente cualquier estado forzándolo (ignorando la máquina de estados lógica del revisor).
  * Tiene la característica clave de **REASIGNAR**. Puede mandar un workflow de `Ventas` a `Finanzas` registrando dicho salto en el Historial (Endpoint: `PATCH /api/v1/workflows/{id}/departamento`).

---

## 3. Dinámica del Historial (`EventoHistorial`)
Cada vez que un actor hace uso de un `PATCH`, ya sea para cambiar el estado o de departamento, debe mandar obligatoriamente la cadena de su propio usuario y comentario (ver request schema en Swagger). 

El backend lo guardará **atómicamente** empujándolo al array del `Historial` general de ese Workflow, de esta forma el frontend solo tiene que iterar con un `*ngFor` el arreglo de `Historial` y mostrar como una "Línea de Tiempo" al usuario final (similar a una compra de Amazon: "Pedido Recibido -> Revisión -> Repartidor").

## 4. Consumo en Frontend

Dado que todo está anotado con `@Operation` y `@Tag`, puedes abrir tu navegador en:
`http://localhost:8080/swagger-ui/index.html` 

Allí verás agrupado perfectamente bajo **"Autenticación"** y **"Workflow Departamental"** cada verbo HTTP, con sus JSON de demostración, facilitando que el frontend simplemente copie, pegue y consuma.

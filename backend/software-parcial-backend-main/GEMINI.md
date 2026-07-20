# Backend Business Policies & Logic

This document outlines the core business rules and architectural decisions for the Spring Boot backend.

## 1. Access Control & Visibility
- **SOLICITANTE**: Restricted to viewing and managing only their own requests.
- **REVISOR**: Scoped to their specific `X-Departamento`. They can view and transition requests within their department.
- **ADMINISTRADOR**: Global access. Can view all requests, reassign departments, and manage system-wide settings.

## 2. Request Lifecycle
- Requests follow a state machine: `PENDIENTE` -> `EN_REVISION` -> `APROBADO`/`RECHAZADO`.
- **Validation**: Status changes require authorized roles and valid transitions.
- **BPMN Integration**: Requests can be associated with BPMN process definitions (`workflowDefinitionId`) and specific tasks (`tareaId`).

## 3. Document Management
- **Collaboration**: Collaborative documents use explicit locking. A document must be "blocked" by a user to be edited.
- **Snapshots**: Users can save immutable "Snapshots" (versions) of documents for audit purposes.
- **Real-time**: Edits and cursors are broadcasted via WebSocket (STOMP) for live collaboration.

## 4. AI & Intelligence
- **Asistente IA**: Integrated with Google Vertex AI (Gemini).
- **Contextual Awareness**: The AI is provided with document content, workflow stage, and user context to provide accurate assistance.
- **Neo-Brutalism Output**: AI is instructed to output Markdown that is converted to high-contrast, structured HTML.

## 5. Persistence & Data
- **MongoDB**: Primary storage for requests, documents, and the Knowledge Graph.
- **Event Backbone**: Every significant action (node update, state change) triggers a `WorkflowCoreEvent` for audit and real-time monitoring.

## 6. Deployment (GCP)
- **Frontend**: Deployed to Google Cloud Run / Firebase.
- **Backend**: Deployed to Google Cloud Run.
- **Databases**: MongoDB (Atlas or Cloud-hosted) and Google Cloud Storage for large files.

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend/software-parcial-backend-main"
FRONTEND_DIR="$ROOT_DIR/frontend/Angular-workflow-diagram2-main"

echo "[1/2] Compilando backend con Maven en contenedor..."
docker run --rm \
  -v "$BACKEND_DIR:/app" \
  -v "$HOME/.m2:/root/.m2" \
  -w /app \
  maven:3.9.9-eclipse-temurin-17-alpine \
  mvn clean package -DskipTests

echo "[2/2] Compilando frontend Angular..."
(cd "$FRONTEND_DIR" && npm run build -- --configuration production)

echo "Artefactos listos."

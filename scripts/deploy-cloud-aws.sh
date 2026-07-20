#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-aws-mesa}"
REMOTE_DIR="${REMOTE_DIR:-/home/admin/SegundoParcial_SW1-main}"
ENV_FILE="$ROOT_DIR/.env.cloud"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Falta $ENV_FILE. Copia .env.cloud.example a .env.cloud y ajusta valores."
  exit 1
fi

echo "[1/5] Compilando artefactos locales..."
"$ROOT_DIR/scripts/build-local-artifacts.sh"

echo "[2/5] Creando directorio remoto..."
ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_DIR'"

echo "[3/5] Sincronizando proyecto..."
rsync -az --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".angular" \
  --exclude ".dart_tool" \
  --exclude "build" \
  "$ROOT_DIR/" "$REMOTE_HOST:$REMOTE_DIR/"

echo "[4/5] Copiando variables cloud..."
scp "$ENV_FILE" "$REMOTE_HOST:$REMOTE_DIR/.env"

echo "[5/5] Levantando Docker en remoto..."
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && docker compose --env-file .env up --build -d"

echo "Despliegue lanzado en $REMOTE_HOST"

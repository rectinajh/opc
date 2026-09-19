#!/bin/bash
# GCE startup: run official Paperclip image with Secret Manager credentials + Cloud SQL.
set -euo pipefail

PROJECT=$(curl -sf -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/project/project-id)
IMAGE="${PAPERCLIP_IMAGE:-asia-east1-docker.pkg.dev/boxwood-scope-364905/paperclip/paperclip:latest}"
NAME=paperclip
DATA_DIR=/var/lib/paperclip

EXTERNAL_IP=$(curl -sf -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || true)
PUBLIC_URL="http://${EXTERNAL_IP}:3100"

mkdir -p "$DATA_DIR"
export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y --no-install-recommends docker.io curl ca-certificates python3
  systemctl enable --now docker
fi

command -v python3 >/dev/null 2>&1 || apt-get install -y --no-install-recommends python3

fetch_secret() {
  local secret_id="$1"
  local token
  token=$(curl -sf -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
  curl -sf \
    -H "Authorization: Bearer ${token}" \
    "https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${secret_id}/versions/latest:access" \
    | python3 -c 'import json,sys,base64; print(base64.b64decode(json.load(sys.stdin)["payload"]["data"]).decode())'
}

GEMINI_API_KEY=$(fetch_secret paperclip-gemini-api-key)
BETTER_AUTH_SECRET=$(fetch_secret paperclip-better-auth-secret)
TOOL_SECRET=$(fetch_secret paperclip-tool-action-signing-secret)
DATABASE_URL=$(fetch_secret paperclip-database-url)

# Artifact Registry is private, unlike the public GHCR image this replaced, so
# log Docker in with the instance's own access token before pulling.
if [[ "$IMAGE" == asia-east1-docker.pkg.dev/* ]]; then
  REGISTRY_TOKEN=$(curl -sf -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
  echo "$REGISTRY_TOKEN" | docker login -u oauth2accesstoken --password-stdin "https://asia-east1-docker.pkg.dev"
fi

docker pull "$IMAGE"
docker rm -f "$NAME" 2>/dev/null || true
docker run -d --name "$NAME" --restart=unless-stopped \
  -p 3100:3100 \
  -v "${DATA_DIR}:/paperclip" \
  -e HOST=0.0.0.0 \
  -e PORT=3100 \
  -e SERVE_UI=true \
  -e PAPERCLIP_HOME=/paperclip \
  -e PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  -e PAPERCLIP_DEPLOYMENT_EXPOSURE=public \
  -e "PAPERCLIP_PUBLIC_URL=${PUBLIC_URL}" \
  -e "DATABASE_URL=${DATABASE_URL}" \
  -e "GEMINI_API_KEY=${GEMINI_API_KEY}" \
  -e GEMINI_CLI_TRUST_WORKSPACE=true \
  -e "BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}" \
  -e "PAPERCLIP_TOOL_ACTION_SIGNING_SECRET=${TOOL_SECRET}" \
  "$IMAGE"

echo "Paperclip started at ${PUBLIC_URL}"

#!/usr/bin/env bash
set -euo pipefail

# Build and serve the web + WASM version using Trunk and npx serve
# Usage:
#   PORT=8080 ./scripts/build_and_serve.sh

check_cmd() { command -v "$1" >/dev/null 2>&1; }

# Resolve repo root based on script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
if [[ ! -f "$REPO_ROOT/index.html" && -f "$SCRIPT_DIR/../index.html" ]]; then
  REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
cd "$REPO_ROOT"

PORT="${PORT:-8080}"

echo "==> Checking prerequisites..."
if ! check_cmd rustup; then
  echo "ERROR: rustup não encontrado. Instale Rust via https://rustup.rs e tente novamente." >&2
  exit 1
fi

echo "==> Adicionando target wasm32-unknown-unknown (idempotente)..."
rustup target add wasm32-unknown-unknown >/dev/null 2>&1 || true

if ! check_cmd trunk; then
  if check_cmd cargo; then
    echo "==> Instalando trunk (cargo install trunk)..."
    cargo install trunk
  else
    echo "ERROR: trunk não encontrado e cargo ausente. Instale Rust/cargo e tente novamente." >&2
    exit 1
  fi
fi

if ! check_cmd npx; then
  echo "ERROR: npx não encontrado. Instale Node.js (https://nodejs.org) e tente novamente." >&2
  exit 1
fi

echo "==> Compilando web + WASM (release) com Trunk..."
trunk build --release

if [[ ! -d "dist" ]]; then
  echo "ERROR: diretório de saída 'dist' não encontrado após build." >&2
  exit 1
fi

echo "==> Copiando assets estáticos para dist..."
mkdir -p dist/assets
cp -r assets/* dist/assets/ 2>/dev/null || true
cp -f favicon.png dist/ 2>/dev/null || true

echo "==> Servindo './dist' via npx serve na porta ${PORT}"
echo "Abra: http://localhost:${PORT}/"
exec npx serve -s dist -l "$PORT"